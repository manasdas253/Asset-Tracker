import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  appSettings,
  assetCategories,
  importErrors,
  importJobs,
  assetAssignments,
  assetDocuments,
  assetEvents,
  assetTransactions,
  assets,
  auditLogs,
  departments,
  employees,
  locations,
  maintenanceRecords,
  notificationEvents,
  qrCodes,
} from "../drizzle/schema";

export const STATUS_LABELS = {
  available: "Available",
  assigned: "Assigned",
  checked_out: "Checked Out",
  under_maintenance: "Under Maintenance",
  lost: "Lost",
  damaged: "Damaged",
  retired: "Retired",
  disposed: "Disposed",
} as const;

export const CONDITION_LABELS = {
  new: "New",
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  critical: "Critical",
} as const;

function toDate(value: unknown) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getDashboardData() {
  const db = await getDb();
  if (!db) return { kpis: emptyKpis(), status: [], categories: [], departments: [], locations: [], conditions: [], warranty: [], activity: [] };

  const [rows, events, maintenance, notices] = await Promise.all([
    db.select().from(assets).orderBy(desc(assets.lastActivityAt)),
    db.select().from(assetEvents).orderBy(desc(assetEvents.occurredAt)).limit(12),
    db.select().from(maintenanceRecords).orderBy(asc(maintenanceRecords.dueDate)).limit(20),
    db.select().from(notificationEvents).orderBy(desc(notificationEvents.createdAt)).limit(8),
  ]);

  const now = Date.now();
  const soon = now + 1000 * 60 * 60 * 24 * 45;
  const totalCost = rows.reduce((sum, row) => sum + Number(row.purchaseCost ?? 0), 0);
  const dueWarranty = rows.filter(row => {
    const expiry = row.warrantyExpiryDate?.getTime();
    return expiry && expiry >= now && expiry <= soon;
  }).length;
  const underMaintenance = rows.filter(row => row.status === "under_maintenance").length;
  const checkedOut = rows.filter(row => row.status === "checked_out").length;
  const assigned = rows.filter(row => row.status === "assigned").length;
  const utilization = rows.length ? Math.round(((checkedOut + assigned) / rows.length) * 100) : 0;

  return {
    kpis: {
      total: rows.length,
      available: rows.filter(row => row.status === "available").length,
      assigned,
      checkedOut,
      underMaintenance,
      damaged: rows.filter(row => row.status === "damaged" || row.condition === "damaged" || row.condition === "critical").length,
      lost: rows.filter(row => row.status === "lost").length,
      retired: rows.filter(row => row.status === "retired" || row.status === "disposed").length,
      totalCost,
      utilization,
      dueWarranty,
      maintenanceDue: maintenance.filter(row => row.dueDate && row.dueDate.getTime() <= soon).length,
    },
    status: groupBy(rows, row => row.status, STATUS_LABELS),
    categories: groupBy(rows, row => row.categoryName || "Uncategorized"),
    departments: groupBy(rows, row => row.departmentName || "Unassigned"),
    locations: groupBy(rows, row => row.locationName || "Unassigned"),
    conditions: groupBy(rows, row => row.condition, CONDITION_LABELS),
    warranty: rows.filter(row => row.warrantyExpiryDate).slice(0, 8).map(row => ({ assetId: row.assetId, name: row.name, expiry: row.warrantyExpiryDate })),
    activity: events.map(event => ({ ...event, asset: rows.find(row => row.id === event.assetId) })),
    notices,
  };
}

function emptyKpis() {
  return { total: 0, available: 0, assigned: 0, checkedOut: 0, underMaintenance: 0, damaged: 0, lost: 0, retired: 0, totalCost: 0, utilization: 0, dueWarranty: 0, maintenanceDue: 0 };
}

function groupBy<T>(rows: T[], getKey: (row: T) => string, labels?: Record<string, string>) {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([key, value]) => ({ name: labels?.[key] ?? key, value, key }));
}

export async function listAssets(input: { search?: string; status?: string; category?: string; department?: string; location?: string; page: number; pageSize: number }) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0, page: input.page, pageSize: input.pageSize };
  const filters = [];
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(like(assets.assetId, term), like(assets.subAssetId, term), like(assets.name, term), like(assets.serialNumber, term), like(assets.brand, term), like(assets.model, term)));
  }
  if (input.status && input.status !== "all") filters.push(eq(assets.status, input.status as typeof assets.status.enumValues[number]));
  if (input.category && input.category !== "all") filters.push(eq(assets.categoryName, input.category));
  if (input.department && input.department !== "all") filters.push(eq(assets.departmentName, input.department));
  if (input.location && input.location !== "all") filters.push(eq(assets.locationName, input.location));
  const where = filters.length ? and(...filters) : undefined;
  const all = await db.select().from(assets).where(where).orderBy(desc(assets.lastActivityAt));
  const start = (input.page - 1) * input.pageSize;
  return { rows: all.slice(start, start + input.pageSize), total: all.length, page: input.page, pageSize: input.pageSize };
}

export async function exportAssets(input: { search?: string; status?: string; category?: string; department?: string; location?: string }) {
  const result = await listAssets({ ...input, page: 1, pageSize: 100_000 });
  return result.rows;
}

/**
 * A read-only snapshot for the Movement Report.  The asset row is the source
 * of truth for the current state; transactions are used only to identify the
 * latest recorded movement, never to replay or substitute the current state.
 */
export async function getCurrentMovementReport(input: { status?: string; category?: string }) {
  const db = await getDb();
  if (!db) return [];

  const filters = [];
  if (input.status && input.status !== "all") filters.push(eq(assets.status, input.status as typeof assets.status.enumValues[number]));
  if (input.category && input.category !== "all") filters.push(eq(assets.categoryName, input.category));
  const where = filters.length ? and(...filters) : undefined;

  const [currentAssets, transactions] = await Promise.all([
    db.select().from(assets).where(where).orderBy(asc(assets.assetId)),
    db.select().from(assetTransactions).orderBy(desc(assetTransactions.occurredAt), desc(assetTransactions.id)),
  ]);
  const latestTransactionByAsset = new Map<number, typeof transactions[number]>();
  for (const transaction of transactions) {
    if (!latestTransactionByAsset.has(transaction.assetId)) latestTransactionByAsset.set(transaction.assetId, transaction);
  }

  return currentAssets.map(asset => {
    const latestMovement = latestTransactionByAsset.get(asset.id);
    const isCheckedOut = asset.status === "checked_out";
    return {
      assetId: asset.assetId,
      assetName: asset.name,
      category: asset.categoryName,
      subcategory: asset.subcategory,
      assetType: asset.assetType,
      currentStatus: asset.status,
      currentLocation: asset.locationName,
      building: asset.building,
      floor: asset.floor,
      storageLocation: asset.storageLocation,
      currentAssignee: asset.assignedEmployeeName,
      assigneeCode: asset.assignedEmployeeCode,
      department: asset.departmentName,
      availability: asset.status === "available" ? "Available" : "Unavailable",
      checkoutStatus: isCheckedOut ? "Checked out" : "Not checked out",
      serialNumber: asset.serialNumber,
      manufacturer: asset.manufacturer,
      brand: asset.brand,
      model: asset.model,
      modelNumber: asset.modelNumber,
      sku: asset.sku,
      barcodeNumber: asset.barcodeNumber,
      condition: asset.condition,
      lastMovementDate: latestMovement?.occurredAt ?? asset.assignedAt ?? asset.lastCheckoutAt ?? asset.lastCheckinAt ?? null,
      lastMovementType: latestMovement?.type,
      lastUpdatedDate: asset.updatedAt,
    };
  });
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) return undefined;
  const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.assetId, id)).limit(1);
  const events = await db.select().from(assetEvents).where(eq(assetEvents.assetId, id)).orderBy(desc(assetEvents.occurredAt)).limit(30);
  const transactions = await db.select().from(assetTransactions).where(eq(assetTransactions.assetId, id)).orderBy(desc(assetTransactions.occurredAt)).limit(30);
  const assignments = await db.select().from(assetAssignments).where(eq(assetAssignments.assetId, id)).orderBy(desc(assetAssignments.createdAt)).limit(30);
  const maintenance = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.assetId, id)).orderBy(desc(maintenanceRecords.createdAt)).limit(20);
  const audits = await db.select().from(auditLogs).where(eq(auditLogs.assetId, id)).orderBy(desc(auditLogs.occurredAt)).limit(30);
  const documents = await db.select().from(assetDocuments).where(eq(assetDocuments.assetId, id)).orderBy(desc(assetDocuments.createdAt)).limit(30);
  return { asset, qr, events, transactions, assignments, maintenance, audits, documents };
}

export async function getAssetByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [qr] = await db.select().from(qrCodes).where(and(eq(qrCodes.token, token), eq(qrCodes.isActive, 1))).limit(1);
  if (!qr) return undefined;
  const [asset] = await db.select().from(assets).where(eq(assets.id, qr.assetId)).limit(1);
  return asset ? { asset, qr } : undefined;
}

export async function getCatalog() {
  const db = await getDb();
  if (!db) return { categories: [], departments: [], locations: [], employees: [], settings: [] };
  const [categories, departmentsRows, locationsRows, employeesRows, settings] = await Promise.all([
    db.select().from(assetCategories).where(eq(assetCategories.isActive, 1)).orderBy(asc(assetCategories.name)),
    db.select().from(departments).where(eq(departments.isActive, 1)).orderBy(asc(departments.name)),
    db.select().from(locations).where(eq(locations.isActive, 1)).orderBy(asc(locations.name)),
    db.select().from(employees).where(eq(employees.status, "active")).orderBy(asc(employees.name)),
    db.select().from(appSettings).orderBy(asc(appSettings.key)),
  ]);
  return { categories: categories, departments: departmentsRows, locations: locationsRows, employees: employeesRows, settings };
}

export async function getRecentActivity() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ event: assetEvents, asset: assets }).from(assetEvents).leftJoin(assets, eq(assetEvents.assetId, assets.id)).orderBy(desc(assetEvents.occurredAt)).limit(20);
}

export async function getImportHistory() {
  const db = await getDb();
  if (!db) return { jobs: [], errors: [] };
  const jobs = await db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(20);
  const errors = jobs.length ? await db.select().from(importErrors).where(eq(importErrors.importJobId, jobs[0].id)).orderBy(asc(importErrors.rowNumber)).limit(100) : [];
  return { jobs, errors };
}

export async function getApprovalQueue() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationEvents).where(eq(notificationEvents.type, "approval")).orderBy(desc(notificationEvents.createdAt)).limit(30);
}

export async function getNotificationSummary() {
  const db = await getDb();
  if (!db) return { unread: 0, rows: [] };
  const rows = await db.select().from(notificationEvents).orderBy(desc(notificationEvents.createdAt)).limit(20);
  return { unread: rows.filter(row => row.isRead === 0).length, rows };
}

export async function createAuditLog(input: { assetId?: number; action: string; entityType: string; entityId?: number; actorName?: string; beforeData?: unknown; afterData?: unknown; reason?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    assetId: input.assetId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorName: input.actorName ?? "Workspace operator",
    beforeData: input.beforeData ? JSON.stringify(input.beforeData) : undefined,
    afterData: input.afterData ? JSON.stringify(input.afterData) : undefined,
    reason: input.reason,
  });
}

export function parseAssetDates(input: Record<string, unknown>) {
  return {
    purchaseDate: toDate(input.purchaseDate),
    warrantyStartDate: toDate(input.warrantyStartDate),
    warrantyExpiryDate: toDate(input.warrantyExpiryDate),
    expectedReturnDate: toDate(input.expectedReturnDate),
  };
}

export function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export const sqlNow = sql`CURRENT_TIMESTAMP`;
