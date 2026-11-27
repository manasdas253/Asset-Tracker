import { buildZip, type ZipEntry } from "./zip";

export type QrExportFilters = { search?: string; status?: string; category?: string; department?: string; location?: string };

export type QrExportRecord = {
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

export type QrExportPage = { items: QrExportRecord[]; nextAfterId: number | null; total: number | null };
export type QrExportProgress = { fetched: number; total: number };
export type QrExportResult = { zip: Uint8Array; exported: number; missing: number; fileName: string };

const PAGE_SIZE = 250;

/** Windows/macOS-safe file name that still reads like the Asset ID. */
export function safeFileName(assetId: string) {
  const cleaned = assetId.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return (cleaned || "asset").slice(0, 120);
}

/** CSV cell, quoted, with spreadsheet formula injection neutralised. */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function dataUrlToBytes(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function exportFileName(filters: QrExportFilters, now = new Date()) {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const scope = [filters.location, filters.department, filters.category, filters.status]
    .filter(value => value && value !== "all")
    .map(value => String(value).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("_");
  return `QR-codes_${scope ? `${scope}_` : ""}${stamp}.zip`;
}

/** Builds the archive: one PNG per asset under qr/, plus an index.csv. */
export function buildQrExportArchive(records: QrExportRecord[], fileName: string, now = new Date()): QrExportResult {
  const encoder = new TextEncoder();
  const used = new Map<string, number>();
  const entries: ZipEntry[] = [];
  const lines = [["Asset ID", "Name", "Serial number", "Category", "Department", "Location", "Status", "QR link", "QR file"].map(csvCell).join(",")];
  let exported = 0;
  let missing = 0;

  for (const record of records) {
    const bytes = record.qrDataUrl ? dataUrlToBytes(record.qrDataUrl) : null;
    let qrFile = "";
    if (bytes) {
      const base = safeFileName(record.assetId);
      const seen = used.get(base.toLowerCase()) ?? 0;
      used.set(base.toLowerCase(), seen + 1);
      qrFile = `qr/${seen ? `${base} (${seen + 1})` : base}.png`;
      entries.push({ name: qrFile, data: bytes, modified: now });
      exported++;
    } else {
      missing++;
    }
    lines.push([record.assetId, record.name, record.serialNumber, record.categoryName, record.departmentName, record.locationName, record.status, record.publicUrl, qrFile || "No QR code"].map(csvCell).join(","));
  }

  // BOM so Excel opens the UTF-8 index correctly.
  entries.unshift({ name: "index.csv", data: encoder.encode(`﻿${lines.join("\r\n")}\r\n`), modified: now });
  return { zip: buildZip(entries), exported, missing, fileName };
}

export async function collectQrExport(
  fetchPage: (input: QrExportFilters & { afterId: number; limit: number }) => Promise<QrExportPage>,
  filters: QrExportFilters,
  onProgress?: (progress: QrExportProgress) => void,
) {
  const records: QrExportRecord[] = [];
  let afterId = 0;
  let total = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    const page = await fetchPage({ ...filters, afterId, limit: PAGE_SIZE });
    if (page.total !== null) total = page.total;
    records.push(...page.items);
    onProgress?.({ fetched: records.length, total: Math.max(total, records.length) });
    if (page.nextAfterId === null) break;
    afterId = page.nextAfterId;
  }
  return records;
}

export function downloadBytes(bytes: Uint8Array, fileName: string, type = "application/zip") {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
