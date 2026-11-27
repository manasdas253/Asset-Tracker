import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { listQrExportPage, qrExportInput } from "./qrExport";
import {
  appSettings,
  assetAssignments,
  assetCategories,
  assetDocuments,
  assetEvents,
  assetTransactions,
  importErrors,
  importJobs,
  assets,
  departments,
  employees,
  locations,
  maintenanceRecords,
  notificationEvents,
  qrCodes,
} from "../drizzle/schema";
import {
  CONDITION_LABELS,
  createAssetId,
  createAuditLog,
  getAssetById,
  getAssetByToken,
  getApprovalQueue,
  getCatalog,
  getDashboardData,
  getImportHistory,
  getNotificationSummary,
  getRecentActivity,
  getCurrentMovementReport,
  listAssets,
  exportAssets,
  parseAssetDates,
  safeNumber,
} from "./assetDb";
import { getDb } from "./db";
import { authorizedAssetById, authorizedAssetByToken } from "./assetAuthorization";
import { physicalVerificationRouter } from "./physicalVerification";
import { verificationDate, photoSchema } from "../shared/physicalVerification";

const statuses = ["available", "assigned", "checked_out", "under_maintenance", "lost", "damaged", "retired", "disposed"] as const;
const conditions = ["new", "good", "fair", "damaged", "critical"] as const;
const statusSchema = z.enum(statuses);
const conditionSchema = z.enum(conditions);

const assetInput = z.object({
  assetId: z.string().trim().max(80).optional(),
  subAssetId: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2).max(220),
  categoryName: z.string().trim().max(120).optional(),
  subcategory: z.string().trim().max(120).optional(),
  assetType: z.string().trim().max(120).optional(),
  description: z.string().max(5000).optional(),
  serialNumber: z.string().trim().max(160).optional(),
  manufacturer: z.string().trim().max(160).optional(),
  brand: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional(),
  modelNumber: z.string().trim().max(160).optional(),
  sku: z.string().trim().max(160).optional(),
  barcodeNumber: z.string().trim().max(160).optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.union([z.string(), z.number()]).optional(),
  currency: z.string().trim().max(8).optional(),
  vendor: z.string().trim().max(180).optional(),
  invoiceNumber: z.string().trim().max(120).optional(),
  purchaseOrderNumber: z.string().trim().max(120).optional(),
  warrantyProvider: z.string().trim().max(180).optional(),
  warrantyStartDate: z.string().optional(),
  warrantyExpiryDate: z.string().optional(),
  warrantyTerms: z.string().max(5000).optional(),
  departmentName: z.string().trim().max(120).optional(),
  locationName: z.string().trim().max(160).optional(),
  building: z.string().trim().max(120).optional(),
  floor: z.string().trim().max(80).optional(),
  storageLocation: z.string().trim().max(160).optional(),
  condition: conditionSchema.optional(),
  status: statusSchema.optional(),
  notes: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isDemo: z.boolean().optional(),
});

function getPublicBaseUrl(req: { protocol?: string; get?: (name: string) => string | undefined; headers?: Record<string, string | string[] | undefined> }) {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("APP_BASE_URL must be a public HTTP(S) origin.");
    }
    return url.origin;
  }
  const forwarded = req.headers?.["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol ?? "https";
  const host = req.get?.("host") ?? (typeof req.headers?.host === "string" ? req.headers.host : "localhost");
  return `${protocol}://${host}`;
}

function asOptional(value: string | undefined) {
  return value?.trim() ? value.trim() : undefined;
}

async function createQr(db: Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "insert">, assetDbId: number, req: Parameters<typeof getPublicBaseUrl>[0]) {
  const token = `QR-${nanoid(24)}`;
  const publicUrl = `${getPublicBaseUrl(req)}/asset/${token}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: "M", margin: 4, width: 640 });
  await db.insert(qrCodes).values({ assetId: assetDbId, token, publicUrl, qrDataUrl });
  return { token, publicUrl, qrDataUrl };
}

async function findAssetOrThrow(id: number) {
  const detail = await getAssetById(id);
  if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Asset record not found." });
  return detail;
}

async function createAssetRecord(input: z.infer<typeof assetInput>, req: Parameters<typeof getPublicBaseUrl>[0], source = "Workspace operator") {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
  const assetId = asOptional(input.assetId) ?? await createAssetId();
  const dates = parseAssetDates(input);
  const cost = safeNumber(input.purchaseCost);
  const now = new Date();
  const values = {
    assetId, subAssetId: asOptional(input.subAssetId), name: input.name, categoryName: asOptional(input.categoryName), subcategory: asOptional(input.subcategory), assetType: asOptional(input.assetType),
    description: asOptional(input.description), serialNumber: asOptional(input.serialNumber), manufacturer: asOptional(input.manufacturer), brand: asOptional(input.brand), model: asOptional(input.model),
    modelNumber: asOptional(input.modelNumber), sku: asOptional(input.sku), barcodeNumber: asOptional(input.barcodeNumber), purchaseDate: dates.purchaseDate, purchaseCost: cost?.toFixed(2),
    currency: input.currency ?? "USD", vendor: asOptional(input.vendor), invoiceNumber: asOptional(input.invoiceNumber), purchaseOrderNumber: asOptional(input.purchaseOrderNumber),
    warrantyProvider: asOptional(input.warrantyProvider), warrantyStartDate: dates.warrantyStartDate, warrantyExpiryDate: dates.warrantyExpiryDate, warrantyTerms: asOptional(input.warrantyTerms),
    departmentName: asOptional(input.departmentName), locationName: asOptional(input.locationName), building: asOptional(input.building), floor: asOptional(input.floor), storageLocation: asOptional(input.storageLocation),
    condition: input.condition ?? "good", status: input.status ?? "available", notes: asOptional(input.notes), imageUrl: asOptional(input.imageUrl), isDemo: input.isDemo ? 1 : 0, lastActivityAt: now,
  };
  const { id, qr } = await db.transaction(async tx => {
    const result = await tx.insert(assets).values(values);
    const id = Number(result[0].insertId);
    const qr = await createQr(tx, id, req);
    return { id, qr };
  });
  await db.insert(assetEvents).values({ assetId: id, eventType: "created", title: source === "Workspace operator" ? "Asset registered" : "Asset imported", description: `${assetId} was added to the asset register.`, actorName: source, occurredAt: now });
  await createAuditLog({ assetId: id, action: source === "Workspace operator" ? "create" : "import", entityType: "asset", entityId: id, afterData: { ...values, qrToken: qr.token }, actorName: source });
  return { id, assetId, qr };
}

function csvEscape(value: unknown) { const text = value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += character;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export const assetRouter = router({
  verification: physicalVerificationRouter,
  dashboard: adminProcedure.query(() => getDashboardData()),
  catalog: adminProcedure.query(() => getCatalog()),
  notifications: adminProcedure.query(() => getNotificationSummary()),
  activity: adminProcedure.query(() => getRecentActivity()),
  importHistory: adminProcedure.query(() => getImportHistory()),
  approvalQueue: adminProcedure.query(() => getApprovalQueue()),
  list: adminProcedure.input(z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    category: z.string().optional(),
    department: z.string().optional(),
    location: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
  })).query(({ input }) => listAssets(input)),
  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => authorizedAssetById(ctx, input.id)),
  addDocument: adminProcedure.input(z.object({ assetId: z.number().int().positive(), fileName: z.string().trim().min(1).max(220), fileUrl: z.string().url(), mimeType: z.string().max(120).optional(), sizeBytes: z.number().int().nonnegative().optional() })).mutation(async ({ input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." }); await db.insert(assetDocuments).values({ assetId: input.assetId, fileName: input.fileName, fileUrl: input.fileUrl, mimeType: input.mimeType, sizeBytes: input.sizeBytes }); await db.insert(assetEvents).values({ assetId: input.assetId, eventType: "document_added", title: "Document attached", description: `${input.fileName} was added to the asset record.`, actorName: "Workspace operator", occurredAt: new Date() }); await createAuditLog({ assetId: input.assetId, action: "document_added", entityType: "asset_document", actorName: "Workspace operator", afterData: { fileName: input.fileName, fileUrl: input.fileUrl } }); return getAssetById(input.assetId); }),
  publicByToken: publicProcedure.input(z.object({ token: z.string().trim().min(8).max(96) })).query(({ input, ctx }) => authorizedAssetByToken(ctx, input.token)),
  qrSheet: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) })).query(async ({ input }) => { const details = await Promise.all(input.ids.map(id => getAssetById(id))); return details.filter((detail): detail is NonNullable<typeof detail> => Boolean(detail)).map(detail => ({ asset: detail.asset, qr: detail.qr })); }),
  qrExport: adminProcedure.input(qrExportInput).query(({ input }) => listQrExportPage(input)),
  create: adminProcedure.input(assetInput).mutation(async ({ input, ctx }) => {
    try {
      return await createAssetRecord(input, ctx.req);
    } catch (error) {
      const message = error instanceof Error && error.message.includes("Duplicate") ? "Asset ID or serial number already exists." : "Could not save the asset. Please review the fields and try again.";
      throw new TRPCError({ code: "CONFLICT", message });
    }
  }),
  bulkValidate: adminProcedure.input(z.object({ rows: z.array(z.unknown()).min(1).max(500) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const [assetRows, serialRows] = await Promise.all([db.select({ assetId: assets.assetId }).from(assets), db.select({ serialNumber: assets.serialNumber }).from(assets)]);
    const knownIds = new Set(assetRows.map(row => row.assetId.toLowerCase()));
    const knownSerials = new Set(serialRows.map(row => row.serialNumber?.toLowerCase()).filter(Boolean) as string[]);
    const seenIds = new Set<string>();
    const seenSerials = new Set<string>();
    return input.rows.map((row, index) => {
      const parsed = assetInput.safeParse(row);
      const errors: string[] = [];
      if (!parsed.success) errors.push(...parsed.error.issues.map(issue => `${String(issue.path[0] ?? "Row")}: ${issue.message}`));
      if (parsed.success) {
        const costValue = parsed.data.purchaseCost;
        if (costValue !== undefined && (safeNumber(costValue) === undefined || safeNumber(costValue)! < 0)) errors.push("Purchase cost must be a non-negative number.");
        for (const [field, label] of [[parsed.data.purchaseDate, "Purchase date"], [parsed.data.warrantyExpiryDate, "Warranty expiry"]] as const) {
          if (field && (!/^\d{4}-\d{2}-\d{2}$/.test(field) || Number.isNaN(Date.parse(`${field}T00:00:00`)))) errors.push(`${label} must use a valid YYYY-MM-DD date.`);
        }
        const id = parsed.data.assetId?.trim().toLowerCase();
        const serial = parsed.data.serialNumber?.trim().toLowerCase();
        if (id && (knownIds.has(id) || seenIds.has(id))) errors.push("Asset ID is duplicated.");
        if (serial && (knownSerials.has(serial) || seenSerials.has(serial))) errors.push("Serial number is duplicated.");
        if (id) seenIds.add(id);
        if (serial) seenSerials.add(serial);
      }
      return { rowNumber: index + 2, valid: errors.length === 0, errors };
    });
  }),
  bulkCreate: adminProcedure.input(z.object({ fileName: z.string().trim().min(1).max(220), rows: z.array(z.object({ row: assetInput, rowNumber: z.number().int().positive() })).min(1).max(500) })).mutation(async ({ input, ctx }) => {
    const failures: { rowNumber: number; message: string }[] = [];
    let successfulRows = 0;
    for (let index = 0; index < input.rows.length; index += 1) {
      const { row, rowNumber } = input.rows[index];
      try {
        await createAssetRecord(row, ctx.req, "Bulk upload");
        successfulRows += 1;
      } catch (error) {
        failures.push({ rowNumber, message: error instanceof Error ? error.message : "Could not create this asset row." });
      }
    }
    return { totalRows: input.rows.length, successfulRows, failedRows: failures.length, failures };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int().positive(), changes: assetInput.partial() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    const dates = parseAssetDates(input.changes);
    const patch: Record<string, unknown> = {};
    const allowed = ["name", "categoryName", "subcategory", "assetType", "description", "serialNumber", "manufacturer", "brand", "model", "modelNumber", "sku", "barcodeNumber", "currency", "vendor", "invoiceNumber", "purchaseOrderNumber", "warrantyProvider", "warrantyTerms", "departmentName", "locationName", "building", "floor", "storageLocation", "condition", "status", "notes", "imageUrl"] as const;
    allowed.forEach(key => {
      if (input.changes[key] !== undefined) patch[key] = typeof input.changes[key] === "string" ? asOptional(input.changes[key]) : input.changes[key];
    });
    if (input.changes.subAssetId !== undefined) patch.subAssetId = asOptional(input.changes.subAssetId) ?? null;
    if (input.changes.purchaseCost !== undefined) patch.purchaseCost = safeNumber(input.changes.purchaseCost)?.toFixed(2);
    if (input.changes.purchaseDate !== undefined) patch.purchaseDate = dates.purchaseDate;
    if (input.changes.warrantyStartDate !== undefined) patch.warrantyStartDate = dates.warrantyStartDate;
    if (input.changes.warrantyExpiryDate !== undefined) patch.warrantyExpiryDate = dates.warrantyExpiryDate;
    patch.lastActivityAt = new Date();
    await db.update(assets).set(patch).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: "updated", title: "Asset details updated", description: `${detail.asset.assetId} was updated.`, actorName: "Workspace operator" });
    await createAuditLog({ assetId: input.id, action: "update", entityType: "asset", entityId: input.id, beforeData: detail.asset, afterData: patch });
    return getAssetById(input.id);
  }),
  publicCheckout: adminProcedure.input(z.object({ token: z.string().trim().min(8).max(96), employeeName: z.string().trim().min(2).max(160), employeeCode: z.string().trim().max(80).optional(), departmentName: z.string().trim().max(120).optional(), locationName: z.string().trim().max(160).optional(), purpose: z.string().trim().min(1).max(220), expectedReturnDate: verificationDate, condition: conditionSchema.default("good"), notes: z.string().max(2000).optional() })).mutation(async ({ input, ctx }) => {
    const result = await physicalVerificationRouter.createCaller(ctx).action({ ...input, action: "checkout", employeeCode: input.employeeCode ?? "", description: "", photos: [] });
    return getAssetById(result.assetId);
  }),
  checkout: adminProcedure.input(z.object({ id: z.number().int().positive(), employeeName: z.string().trim().min(2).max(160), employeeCode: z.string().trim().max(80).optional(), departmentName: z.string().trim().max(120).optional(), locationName: z.string().trim().max(160).optional(), purpose: z.string().trim().max(220).optional(), expectedReturnDate: z.string().optional(), condition: conditionSchema.default("good"), notes: z.string().max(2000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    if (["retired", "disposed", "lost", "under_maintenance"].includes(detail.asset.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "This asset is not available for checkout in its current state." });
    const now = new Date();
    const expectedReturnDate = input.expectedReturnDate ? new Date(input.expectedReturnDate) : undefined;
    await db.insert(assetAssignments).values({ assetId: input.id, employeeName: input.employeeName, employeeCode: asOptional(input.employeeCode), departmentName: asOptional(input.departmentName), locationName: asOptional(input.locationName), purpose: asOptional(input.purpose), expectedReturnDate, checkedOutAt: now, notes: asOptional(input.notes) });
    await db.insert(assetTransactions).values({ assetId: input.id, type: "checkout", actorName: input.employeeName, fromLocation: detail.asset.locationName, toLocation: input.locationName, toEmployee: input.employeeName, condition: input.condition, purpose: asOptional(input.purpose), notes: asOptional(input.notes), occurredAt: now });
    await db.update(assets).set({ status: "checked_out", assignedEmployeeName: input.employeeName, assignedEmployeeCode: asOptional(input.employeeCode), assignedAt: now, expectedReturnDate, lastCheckoutAt: now, lastActivityAt: now, locationName: asOptional(input.locationName) ?? detail.asset.locationName, departmentName: asOptional(input.departmentName) ?? detail.asset.departmentName, condition: input.condition }).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: "checkout", title: "Asset checked out", description: `${detail.asset.assetId} was checked out to ${input.employeeName}.`, actorName: input.employeeName, occurredAt: now });
    await createAuditLog({ assetId: input.id, action: "checkout", entityType: "asset_transaction", entityId: input.id, beforeData: detail.asset, afterData: { status: "checked_out", employeeName: input.employeeName }, reason: input.purpose });
    return getAssetById(input.id);
  }),
  checkin: adminProcedure.input(z.object({ id: z.number().int().positive(), condition: conditionSchema, damageDescription: z.string().max(2000).optional(), locationName: z.string().trim().max(160).optional(), notes: z.string().max(2000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    const now = new Date();
    const nextStatus = input.condition === "damaged" || input.condition === "critical" ? "damaged" : "available";
    await db.insert(assetAssignments).values({ assetId: input.id, employeeName: detail.asset.assignedEmployeeName ?? "Unassigned", employeeCode: detail.asset.assignedEmployeeCode, locationName: input.locationName ?? detail.asset.locationName, checkedInAt: now, returnCondition: input.condition, notes: asOptional(input.notes) });
    await db.insert(assetTransactions).values({ assetId: input.id, type: "checkin", actorName: detail.asset.assignedEmployeeName, fromLocation: detail.asset.locationName, toLocation: input.locationName ?? detail.asset.locationName, fromEmployee: detail.asset.assignedEmployeeName, condition: input.condition, damageDescription: asOptional(input.damageDescription), notes: asOptional(input.notes), occurredAt: now });
    await db.update(assets).set({ status: nextStatus, assignedEmployeeName: null, assignedEmployeeCode: null, assignedAt: null, expectedReturnDate: null, lastCheckinAt: now, lastActivityAt: now, condition: input.condition, locationName: input.locationName ?? detail.asset.locationName }).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: "checkin", title: nextStatus === "damaged" ? "Asset returned with damage" : "Asset checked in", description: `${detail.asset.assetId} was returned and marked ${CONDITION_LABELS[input.condition].toLowerCase()}.`, actorName: detail.asset.assignedEmployeeName, occurredAt: now });
    await createAuditLog({ assetId: input.id, action: "checkin", entityType: "asset_transaction", entityId: input.id, beforeData: detail.asset, afterData: { status: nextStatus, condition: input.condition }, reason: input.damageDescription });
    return getAssetById(input.id);
  }),
  transfer: adminProcedure.input(z.object({ id: z.number().int().positive(), employeeName: z.string().trim().min(2).max(160).optional(), employeeCode: z.string().trim().max(80).optional(), departmentName: z.string().trim().max(120).optional(), locationName: z.string().trim().max(160).optional(), notes: z.string().max(2000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    if (!input.employeeName && !input.locationName) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a new employee or location for the transfer." });
    const now = new Date();
    const employee = input.employeeName ?? detail.asset.assignedEmployeeName;
    const location = input.locationName ?? detail.asset.locationName;
    await db.insert(assetTransactions).values({ assetId: input.id, type: "transfer", actorName: "Workspace operator", fromLocation: detail.asset.locationName, toLocation: location, fromEmployee: detail.asset.assignedEmployeeName, toEmployee: employee, notes: asOptional(input.notes), occurredAt: now });
    await db.update(assets).set({ status: employee ? "assigned" : detail.asset.status, assignedEmployeeName: employee, assignedEmployeeCode: input.employeeCode ?? detail.asset.assignedEmployeeCode, departmentName: input.departmentName ?? detail.asset.departmentName, locationName: location, lastActivityAt: now }).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: "transfer", title: "Asset transferred", description: `${detail.asset.assetId} moved to ${location ?? "a new location"}.`, actorName: "Workspace operator", occurredAt: now });
    await createAuditLog({ assetId: input.id, action: "transfer", entityType: "asset_transaction", entityId: input.id, beforeData: detail.asset, afterData: { employee, location }, reason: input.notes });
    return getAssetById(input.id);
  }),
  publicReportDamage: adminProcedure.input(z.object({ token: z.string().trim().min(8).max(96), severity: z.enum(["damaged", "critical"]), description: z.string().trim().min(5).max(2000), reportedBy: z.string().trim().min(2).max(160), photos: z.array(photoSchema).min(1).max(4) })).mutation(async ({ input, ctx }) => {
    const result = await physicalVerificationRouter.createCaller(ctx).action({ ...input, action: "damage", employeeName: input.reportedBy, employeeCode: "", purpose: "", expectedReturnDate: "" });
    return getAssetById(result.assetId);
  }),
  reportDamage: adminProcedure.input(z.object({ id: z.number().int().positive(), severity: z.enum(["damaged", "critical"]), description: z.string().trim().min(5).max(3000), reportedBy: z.string().trim().min(2).max(160) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    const now = new Date();
    await db.insert(assetTransactions).values({ assetId: input.id, type: "damage", actorName: input.reportedBy, condition: input.severity, damageDescription: input.description, occurredAt: now });
    await db.update(assets).set({ status: "damaged", condition: input.severity, lastActivityAt: now }).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: "damage", title: "Damage reported", description: input.description, actorName: input.reportedBy, occurredAt: now });
    await db.insert(notificationEvents).values({ type: "system", title: "Damage report requires review", message: `${detail.asset.assetId} was reported ${input.severity}.`, assetId: input.id, severity: input.severity === "critical" ? "critical" : "warning" });
    await createAuditLog({ assetId: input.id, action: "damage_report", entityType: "asset_transaction", entityId: input.id, beforeData: detail.asset, afterData: { condition: input.severity }, reason: input.description, actorName: input.reportedBy });
    return getAssetById(input.id);
  }),
  setLifecycle: adminProcedure.input(z.object({ id: z.number().int().positive(), action: z.enum(["retire", "dispose", "maintenance_start", "maintenance_end"]), notes: z.string().max(2000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const detail = await findAssetOrThrow(input.id);
    const now = new Date();
    const status = input.action === "retire" ? "retired" : input.action === "dispose" ? "disposed" : input.action === "maintenance_start" ? "under_maintenance" : "available";
    await db.insert(assetTransactions).values({ assetId: input.id, type: input.action, actorName: "Workspace operator", notes: asOptional(input.notes), occurredAt: now });
    await db.update(assets).set({ status, retiredAt: input.action === "retire" || input.action === "dispose" ? now : detail.asset.retiredAt, lastActivityAt: now }).where(eq(assets.id, input.id));
    await db.insert(assetEvents).values({ assetId: input.id, eventType: input.action, title: input.action === "maintenance_start" ? "Maintenance started" : input.action === "maintenance_end" ? "Maintenance completed" : `Asset ${input.action}d`, description: input.notes, actorName: "Workspace operator", occurredAt: now });
    await createAuditLog({ assetId: input.id, action: input.action, entityType: "asset_transaction", entityId: input.id, beforeData: detail.asset, afterData: { status }, reason: input.notes });
    return getAssetById(input.id);
  }),
  createMaintenance: adminProcedure.input(z.object({ assetId: z.number().int().positive(), title: z.string().trim().min(2).max(220), provider: z.string().trim().max(180).optional(), dueDate: z.string().optional(), cost: z.union([z.number(), z.string()]).optional(), notes: z.string().max(2000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    await findAssetOrThrow(input.assetId);
    const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    const cost = safeNumber(input.cost);
    const now = new Date();
    await db.insert(maintenanceRecords).values({ assetId: input.assetId, title: input.title, provider: asOptional(input.provider), dueDate, cost: cost?.toFixed(2), notes: asOptional(input.notes) });
    await db.update(assets).set({ status: "under_maintenance", lastActivityAt: now }).where(eq(assets.id, input.assetId));
    await db.insert(assetEvents).values({ assetId: input.assetId, eventType: "maintenance", title: "Maintenance scheduled", description: input.title, actorName: "Workspace operator", occurredAt: now });
    return getAssetById(input.assetId);
  }),
  markNotificationRead: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { success: false };
    await db.update(notificationEvents).set({ isRead: 1 }).where(eq(notificationEvents.id, input.id));
    return { success: true };
  }),
  saveCatalogItem: adminProcedure.input(z.object({ kind: z.enum(["category", "department", "location"]), name: z.string().trim().min(2).max(160), code: z.string().trim().max(32).optional(), subcategory: z.string().trim().max(120).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    if (input.kind === "category") await db.insert(assetCategories).values({ name: input.name, subcategory: asOptional(input.subcategory) });
    if (input.kind === "department") await db.insert(departments).values({ name: input.name, code: input.code?.toUpperCase() || input.name.slice(0, 4).toUpperCase() });
    if (input.kind === "location") await db.insert(locations).values({ name: input.name });
    return getCatalog();
  }),
  exportCsv: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).max(10000).optional(), search: z.string().trim().max(200).optional(), status: z.string().optional(), category: z.string().optional(), department: z.string().optional(), location: z.string().optional() })).query(async ({ input }) => { const rows = await exportAssets(input); const selected = input.ids?.length ? rows.filter(row => input.ids!.includes(row.id)) : rows; const csv = ["Asset ID,Asset Name,Category,Location,Status,Condition,Serial Number", ...selected.map(row => [row.assetId, row.name, row.categoryName, row.locationName, row.status, row.condition, row.serialNumber].map(csvEscape).join(","))].join("\n"); return { csv, count: selected.length }; }),
  movementReport: adminProcedure.input(z.object({ status: z.string().optional(), category: z.string().optional() }).optional()).query(({ input }) => getCurrentMovementReport(input ?? {})),
  bulkUpdate: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100), status: z.enum(["available", "assigned", "checked_out", "under_maintenance", "lost", "damaged", "retired", "disposed"]).optional(), locationName: z.string().trim().max(160).optional(), categoryName: z.string().trim().max(120).optional(), confirm: z.literal(true) })).mutation(async ({ input }) => { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." }); const now = new Date(); for (const id of input.ids) { const before = await findAssetOrThrow(id); await db.update(assets).set({ status: input.status, locationName: input.locationName || before.asset.locationName, categoryName: input.categoryName || before.asset.categoryName, lastActivityAt: now }).where(eq(assets.id, id)); await db.insert(assetEvents).values({ assetId: id, eventType: "bulk_update", title: "Asset updated in bulk", description: "Status, location, or category was updated from bulk operations.", actorName: "Workspace operator", occurredAt: now }); await createAuditLog({ assetId: id, action: "bulk_update", entityType: "asset", entityId: id, beforeData: before.asset, afterData: { status: input.status, locationName: input.locationName, categoryName: input.categoryName } }); } return { updated: input.ids.length }; }),
  importCsv: adminProcedure.input(z.object({ fileName: z.string().trim().min(1).max(220), csv: z.string().min(1).max(2_000_000) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const rows = parseCsv(input.csv);
    if (!rows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The CSV contains no data rows." });
    const headers = rows[0].map(value => value.trim().toLowerCase());
    const column = (names: string[]) => { const index = headers.findIndex(header => names.includes(header)); return index; };
    const nameIndex = column(["asset name", "name"]);
    if (nameIndex < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The CSV must include an Asset Name column." });
    const indexMap = { assetId: column(["asset id", "assetid"]), subAssetId: column(["sub asset id", "subassetid"]), category: column(["category", "asset category"]), brand: column(["brand", "manufacturer"]), model: column(["model"]), serial: column(["serial number", "serialnumber", "serial"]), department: column(["department"]), location: column(["location"]), cost: column(["purchase cost (inr ₹)", "purchase cost (inr)", "purchase cost", "purchasecost", "cost"]) };
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim()));
    const existingSerials = new Set((await db.select({ serialNumber: assets.serialNumber }).from(assets)).map(row => row.serialNumber).filter(Boolean) as string[]);
    const seenSerials = new Set<string>();
    const jobResult = await db.insert(importJobs).values({ fileName: input.fileName, totalRows: dataRows.length, status: "validated" });
    const jobId = Number(jobResult[0].insertId);
    const errors: { rowNumber: number; fieldName: string; message: string; rawData: string }[] = [];
    let successfulRows = 0;
    for (let offset = 0; offset < dataRows.length; offset += 1) {
      const row = dataRows[offset];
      const rowNumber = offset + 2;
      const get = (index: number) => index >= 0 ? row[index]?.trim() || undefined : undefined;
      const name = get(nameIndex);
      const serial = get(indexMap.serial);
      const subAssetId = get(indexMap.subAssetId);
      if (subAssetId && subAssetId.length > 80) { errors.push({ rowNumber, fieldName: "Sub Asset ID", message: "Sub Asset ID must be at most 80 characters.", rawData: JSON.stringify(row) }); continue; }
      if (!name) { errors.push({ rowNumber, fieldName: "Asset Name", message: "Asset Name is required.", rawData: JSON.stringify(row) }); continue; }
      if (serial && (existingSerials.has(serial) || seenSerials.has(serial))) { errors.push({ rowNumber, fieldName: "Serial Number", message: "Serial number is duplicated.", rawData: JSON.stringify(row) }); continue; }
      const cost = safeNumber(get(indexMap.cost));
      if (get(indexMap.cost) && cost === undefined) { errors.push({ rowNumber, fieldName: "Purchase Cost (INR ₹)", message: "Purchase Cost (INR ₹) must be a number.", rawData: JSON.stringify(row) }); continue; }
      try {
        const now = new Date();
        const assetId = get(indexMap.assetId) ?? await createAssetId();
        const result = await db.insert(assets).values({ assetId, subAssetId, name, categoryName: get(indexMap.category), brand: get(indexMap.brand), model: get(indexMap.model), serialNumber: serial, departmentName: get(indexMap.department), locationName: get(indexMap.location), purchaseCost: cost?.toFixed(2), currency: "USD", condition: "good", status: "available", isDemo: 0, lastActivityAt: now });
        const assetDbId = Number(result[0].insertId);
        await createQr(db, assetDbId, ctx.req);
        await db.insert(assetEvents).values({ assetId: assetDbId, eventType: "created", title: "Asset imported", description: `${assetId} was created from ${input.fileName}.`, actorName: "Bulk import", occurredAt: now });
        await createAuditLog({ assetId: assetDbId, action: "import", entityType: "asset", entityId: assetDbId, afterData: { assetId, sourceFile: input.fileName }, actorName: "Bulk import" });
        successfulRows += 1;
        if (serial) { existingSerials.add(serial); seenSerials.add(serial); }
      } catch (error) {
        errors.push({ rowNumber, fieldName: "Asset ID", message: error instanceof Error && error.message.includes("Duplicate") ? "Asset ID already exists." : "Could not create this asset row.", rawData: JSON.stringify(row) });
      }
    }
    if (errors.length) await db.insert(importErrors).values(errors.map(error => ({ importJobId: jobId, ...error })));
    await db.update(importJobs).set({ successfulRows, failedRows: errors.length, errorCount: errors.length, status: successfulRows ? "completed" : "failed" }).where(eq(importJobs.id, jobId));
    return { jobId, totalRows: dataRows.length, successfulRows, failedRows: errors.length, errors };
  }),
  saveSetting: adminProcedure.input(z.object({ key: z.string().trim().min(2).max(120), value: z.string().max(2000), description: z.string().max(500).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    await db.insert(appSettings).values(input).onDuplicateKeyUpdate({ set: { value: input.value, description: input.description } });
    return getCatalog();
  }),
  seedDemo: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
    const existing = await db.select({ id: assets.id }).from(assets).where(eq(assets.isDemo, 1)).limit(1);
    if (existing.length) return { created: 0 };
    const demo = [
      { name: "Latitude 7440", assetId: "AST-000101", categoryName: "Computers", assetType: "Laptop", brand: "Dell", model: "Latitude 7440", serialNumber: "DL7440-7K2P", purchaseCost: "1299.00", departmentName: "Engineering", locationName: "HQ · Floor 4", status: "checked_out" as const, condition: "good" as const, assignedEmployeeName: "Maya Patel", assignedEmployeeCode: "EMP-1042", lastCheckoutAt: new Date(Date.now() - 86400000 * 2), expectedReturnDate: new Date(Date.now() + 86400000 * 12), warrantyExpiryDate: new Date(Date.now() + 86400000 * 26) },
      { name: "iPhone 15 Pro", assetId: "AST-000102", categoryName: "Mobile Devices", assetType: "Phone", brand: "Apple", model: "iPhone 15 Pro", serialNumber: "AP15P-91QX", purchaseCost: "999.00", departmentName: "Sales", locationName: "HQ · Floor 2", status: "assigned" as const, condition: "good" as const, assignedEmployeeName: "Jordan Lee", assignedEmployeeCode: "EMP-1028", warrantyExpiryDate: new Date(Date.now() + 86400000 * 18) },
      { name: "ThinkPad T14 Gen 4", assetId: "AST-000103", categoryName: "Computers", assetType: "Laptop", brand: "Lenovo", model: "ThinkPad T14 Gen 4", serialNumber: "LN14-5V82", purchaseCost: "1180.00", departmentName: "Finance", locationName: "HQ · Floor 3", status: "available" as const, condition: "new" as const, warrantyExpiryDate: new Date(Date.now() + 86400000 * 280) },
      { name: "Epson WorkForce Pro", assetId: "AST-000104", categoryName: "Office Equipment", assetType: "Printer", brand: "Epson", model: "WorkForce Pro WF-C5890", serialNumber: "EPWF-2012", purchaseCost: "740.00", departmentName: "Operations", locationName: "HQ · Floor 1", status: "under_maintenance" as const, condition: "fair" as const, warrantyExpiryDate: new Date(Date.now() + 86400000 * 90) },
      { name: "MacBook Pro 14", assetId: "AST-000105", categoryName: "Computers", assetType: "Laptop", brand: "Apple", model: "MacBook Pro 14 M3", serialNumber: "APMB-44F9", purchaseCost: "1999.00", departmentName: "Design", locationName: "Studio · Floor 2", status: "damaged" as const, condition: "damaged" as const, assignedEmployeeName: "Avery Chen", assignedEmployeeCode: "EMP-1087", warrantyExpiryDate: new Date(Date.now() + 86400000 * 62) },
      { name: "Cisco Catalyst 9300", assetId: "AST-000106", categoryName: "Network", assetType: "Switch", brand: "Cisco", model: "C9300-24T", serialNumber: "CS93-9902", purchaseCost: "3650.00", departmentName: "Infrastructure", locationName: "Data Center · Rack A", status: "available" as const, condition: "good" as const, warrantyExpiryDate: new Date(Date.now() + 86400000 * 420) },
    ];
    for (const item of demo) {
      const now = new Date();
      const result = await db.insert(assets).values({ ...item, isDemo: 1, currency: "USD", lastActivityAt: now });
      const id = Number(result[0].insertId);
      const qr = await createQr(db, id, ctx.req);
      await db.insert(assetEvents).values({ assetId: id, eventType: "created", title: "Demo asset registered", description: `${item.assetId} is clearly marked as demo data.`, actorName: "Demo seed", occurredAt: now });
      if (item.status === "checked_out") await db.insert(assetEvents).values({ assetId: id, eventType: "checkout", title: "Demo checkout recorded", description: `Checked out to ${item.assignedEmployeeName}.`, actorName: "Demo seed", occurredAt: item.lastCheckoutAt ?? now });
      await createAuditLog({ assetId: id, action: "seed_demo", entityType: "asset", entityId: id, afterData: { assetId: item.assetId, qrToken: qr.token }, actorName: "Demo seed" });
    }
    await db.insert(notificationEvents).values([
      { type: "warranty", title: "Warranty renewals approaching", message: "Three demo assets have warranty expiry within the next 90 days.", severity: "warning" },
      { type: "maintenance", title: "Maintenance queue needs attention", message: "Epson WorkForce Pro is under maintenance in the demo workspace.", severity: "info" },
    ]);
    return { created: demo.length };
  }),
});
