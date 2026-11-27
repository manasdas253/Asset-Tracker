import { describe, expect, it, vi } from "vitest";
import { buildZip, crc32 } from "./zip";
import { buildQrExportArchive, collectQrExport, csvCell, dataUrlToBytes, exportFileName, safeFileName, type QrExportRecord } from "./qrExport";

// 1x1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endAt = bytes.length - 22;
  expect(view.getUint32(endAt, true)).toBe(0x06054b50);
  const count = view.getUint16(endAt + 10, true);
  let at = view.getUint32(endAt + 16, true);
  const files: { name: string; data: Uint8Array; crc: number }[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(localAt, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localAt + 26, true);
    const dataAt = localAt + 30 + localNameLength;
    files.push({ name, data: bytes.subarray(dataAt, dataAt + size), crc });
    at += 46 + nameLength;
  }
  return files;
}

const record = (overrides: Partial<QrExportRecord>): QrExportRecord => ({
  id: 1, assetId: "AST-000001", name: "Dell Latitude 5440", serialNumber: "SN-1", categoryName: "IT Equipment",
  departmentName: "IT", locationName: "Hyderabad HQ", status: "available", publicUrl: "https://example.com/asset/abc", qrDataUrl: PNG, ...overrides,
});

describe("zip writer", () => {
  it("computes standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes a readable archive whose entries round-trip byte for byte", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new TextEncoder().encode("hello");
    const files = readZip(buildZip([{ name: "a.bin", data: a }, { name: "dir/b.txt", data: b }]));
    expect(files.map(f => f.name)).toEqual(["a.bin", "dir/b.txt"]);
    expect(Array.from(files[0].data)).toEqual([1, 2, 3]);
    expect(files[1].crc).toBe(crc32(b));
  });
});

describe("QR export archive", () => {
  it("creates one PNG per asset named by Asset ID plus an index", () => {
    const result = buildQrExportArchive([record({}), record({ id: 2, assetId: "AST-000002" })], "x.zip");
    const files = readZip(result.zip);
    expect(files.map(f => f.name)).toEqual(["index.csv", "qr/AST-000001.png", "qr/AST-000002.png"]);
    expect(Array.from(files[1].data)).toEqual(Array.from(dataUrlToBytes(PNG)!));
    expect(result.exported).toBe(2);
    expect(result.missing).toBe(0);
  });

  it("keeps unsafe or duplicate Asset IDs as distinct, valid file names", () => {
    const result = buildQrExportArchive([record({ assetId: "IIMS/HYD:01" }), record({ id: 2, assetId: "iims/hyd:01" })], "x.zip");
    const names = readZip(result.zip).map(f => f.name);
    expect(names).toContain("qr/IIMS-HYD-01.png");
    expect(names).toContain("qr/iims-hyd-01 (2).png");
  });

  it("lists assets without a QR code in the index instead of failing", () => {
    const result = buildQrExportArchive([record({ qrDataUrl: null })], "x.zip");
    const index = new TextDecoder().decode(readZip(result.zip)[0].data);
    expect(result.missing).toBe(1);
    expect(index).toContain('"No QR code"');
  });

  it("neutralises spreadsheet formulas in the index", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("Plain, text")).toBe('"Plain, text"');
    expect(csvCell(null)).toBe('""');
  });

  it("only accepts PNG data URLs", () => {
    expect(dataUrlToBytes("data:text/html;base64,PGI+")).toBeNull();
    expect(dataUrlToBytes(PNG)?.[1]).toBe(0x50); // "P" of the PNG signature
  });

  it("names the download after the active filters", () => {
    const now = new Date(2026, 10, 27);
    expect(exportFileName({}, now)).toBe("QR-codes_2026-11-27.zip");
    expect(exportFileName({ location: "Hyderabad HQ", status: "all", category: "IT Equipment" }, now)).toBe("QR-codes_Hyderabad-HQ_IT-Equipment_2026-11-27.zip");
    expect(safeFileName("...")).toBe("asset");
  });
});

describe("collectQrExport", () => {
  it("follows pages until the server reports no more and passes filters through", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [record({ id: 1 })], nextAfterId: 1, total: 2 })
      .mockResolvedValueOnce({ items: [record({ id: 2, assetId: "AST-000002" })], nextAfterId: null, total: null });
    const progress = vi.fn();
    const records = await collectQrExport(fetchPage, { location: "Noida Office" }, progress);
    expect(records.map(r => r.id)).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { location: "Noida Office", afterId: 0, limit: 250 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { location: "Noida Office", afterId: 1, limit: 250 });
    expect(progress).toHaveBeenLastCalledWith({ fetched: 2, total: 2 });
  });
});
