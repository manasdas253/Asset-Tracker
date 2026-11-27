import { and, asc, count, eq, gt, like, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { assets, qrCodes } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Bulk QR export. Returns QR codes page by page (keyset pagination on the
 * asset id) so the browser can assemble a ZIP of every label without the
 * server ever holding the whole register in memory. Filters mirror the asset
 * register so "export what I am looking at" behaves the same as the list.
 */
export const QR_EXPORT_MAX_PAGE = 250;

export const qrExportInput = z.object({
  search: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  category: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  afterId: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(QR_EXPORT_MAX_PAGE).default(QR_EXPORT_MAX_PAGE),
});

export type QrExportInput = z.infer<typeof qrExportInput>;

export type QrExportItem = {
  id: number;
  assetId: string;
  name: string;
  serialNumber: string | null;
  categoryName: string | null;
  departmentName: string | null;
  locationName: string | null;
  status: string;
  publicUrl: string | null;
  qrDataUrl: string | null;
};

export function qrExportFilters(input: Pick<QrExportInput, "search" | "status" | "category" | "department" | "location">) {
  const filters: SQL[] = [];
  if (input.search) {
    const term = `%${input.search}%`;
    const match = or(like(assets.assetId, term), like(assets.subAssetId, term), like(assets.name, term), like(assets.serialNumber, term), like(assets.brand, term), like(assets.model, term));
    if (match) filters.push(match);
  }
  if (input.status && input.status !== "all") filters.push(eq(assets.status, input.status as typeof assets.status.enumValues[number]));
  if (input.category && input.category !== "all") filters.push(eq(assets.categoryName, input.category));
  if (input.department && input.department !== "all") filters.push(eq(assets.departmentName, input.department));
  if (input.location && input.location !== "all") filters.push(eq(assets.locationName, input.location));
  return filters;
}

export async function listQrExportPage(input: QrExportInput): Promise<{ items: QrExportItem[]; nextAfterId: number | null; total: number | null }> {
  const db = await getDb();
  if (!db) return { items: [], nextAfterId: null, total: 0 };
  const filters = qrExportFilters(input);
  const pageWhere = and(...filters, gt(assets.id, input.afterId));
  const rows = await db
    .select({
      id: assets.id,
      assetId: assets.assetId,
      name: assets.name,
      serialNumber: assets.serialNumber,
      categoryName: assets.categoryName,
      departmentName: assets.departmentName,
      locationName: assets.locationName,
      status: assets.status,
      publicUrl: qrCodes.publicUrl,
      qrDataUrl: qrCodes.qrDataUrl,
    })
    .from(assets)
    .leftJoin(qrCodes, eq(qrCodes.assetId, assets.id))
    .where(pageWhere)
    .orderBy(asc(assets.id))
    .limit(input.limit);

  // The total is only needed once, to drive the progress indicator.
  let total: number | null = null;
  if (input.afterId === 0) {
    const [counted] = await db.select({ value: count() }).from(assets).where(filters.length ? and(...filters) : undefined);
    total = Number(counted?.value ?? 0);
  }

  const items = rows as QrExportItem[];
  const nextAfterId = items.length === input.limit ? items[items.length - 1].id : null;
  return { items, nextAfterId, total };
}
