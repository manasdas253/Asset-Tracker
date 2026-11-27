import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import QRCode from "qrcode";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { assetRouter } from "./assetRouter";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, failQr: false }));
vi.mock("./db", () => ({ getDb: async () => fakeDb }));
const dialect = new MySqlDialect();
const fakeDb: any = {
  insert: (table: any) => ({ values: async (values: any) => {
    const name = getTableName(table);
    if (name === "qr_codes" && state.failQr) throw new Error("QR storage failed");
    const rows = state.rows[name] ??= [];
    const id = rows.length + 1;
    rows.push({ id, isActive: 1, createdAt: new Date(), updatedAt: new Date(), ...values });
    return [{ insertId: id }];
  } }),
  select: () => ({ from: (table: any) => {
    const name = getTableName(table);
    let rows = state.rows[name] ?? [];
    const chain: any = {
      where: (sql: SQL) => {
        const params = dialect.sqlToQuery(sql).params;
        rows = rows.filter(row => name === "qr_codes" ? (typeof params[0] === "string" ? row.token === params[0] && row.isActive === params[1] : row.assetId === params[0]) : name === "assets" ? (typeof params[0] === "string" ? String(row.assetId).toLowerCase() === params[0].toLowerCase() : row.id === params[0]) : row.assetId === params[0]);
        return chain;
      },
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      orderBy: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  } }),
  update: (table: any) => ({ set: (patch: any) => ({ where: async (sql: SQL) => {
    const [id] = dialect.sqlToQuery(sql).params;
    const row = state.rows[getTableName(table)]?.find(row => row.id === id);
    if (row) Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)));
  } }) }),
  transaction: async (callback: any) => {
    const snapshot = structuredClone(state.rows);
    try { return await callback(fakeDb); }
    catch (error) { state.rows = snapshot; throw error; }
  },
};
const context = (authenticated = true): TrpcContext => ({
  user: authenticated ? { id: 1, role: "admin" } as TrpcContext["user"] : null,
  req: { protocol: "http", headers: {}, get: () => "localhost:3000" } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

beforeEach(() => { state.rows = {}; state.failQr = false; vi.stubEnv("APP_BASE_URL", "https://assets.example.com/"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("persistent QR registration and lookup", () => {
  it("validates and persists optional Sub Asset IDs in bulk uploads", async () => {
    const caller = assetRouter.createCaller(context());
    const rows = [
      { assetId: "BULK-1", name: "First laptop", subAssetId: "  PART-A  " },
      { assetId: "BULK-2", name: "Second laptop" },
      { assetId: "BULK-3", name: "Invalid laptop", subAssetId: "A".repeat(81) },
    ];
    const checks = await caller.bulkValidate({ rows });
    expect(checks.map(row => row.valid)).toEqual([true, true, false]);
    expect(checks[2].errors.join(" ")).toContain("subAssetId");
    await expect(caller.bulkCreate({ fileName: "assets.xlsx", rows: rows.slice(0, 2).map((row, index) => ({ row, rowNumber: index + 2 })) })).resolves.toMatchObject({ successfulRows: 2, failedRows: 0 });
    expect(state.rows.assets[0]).toMatchObject({ assetId: "BULK-1", subAssetId: "PART-A" });
    expect(state.rows.assets[1].subAssetId).toBeUndefined();
    expect(state.rows.qr_codes).toHaveLength(2);
  });

  it("imports Sub Asset IDs from CSV and reports overlong values", async () => {
    const result = await assetRouter.createCaller(context()).importCsv({
      fileName: "assets.csv",
      csv: `Asset Name,Asset ID,Sub Asset ID\nFirst laptop,CSV-1, PART-A \nSecond laptop,CSV-2,\nInvalid laptop,CSV-3,${"A".repeat(81)}`,
    });
    expect(result).toMatchObject({ successfulRows: 2, failedRows: 1 });
    expect(result.errors[0]).toMatchObject({ rowNumber: 4, fieldName: "Sub Asset ID" });
    expect(state.rows.assets[0]).toMatchObject({ assetId: "CSV-1", subAssetId: "PART-A" });
    expect(state.rows.assets[1].subAssetId).toBeUndefined();
  });

  it("saves, edits, and clears an optional Sub Asset ID without changing Asset ID", async () => {
    const caller = assetRouter.createCaller(context());
    const created = await caller.create({ assetId: "TEST-1", name: "Laptop", subAssetId: "  PART-A  " });
    expect((await caller.byId({ id: created.id }))?.asset).toMatchObject({ assetId: "TEST-1", subAssetId: "PART-A" });
    await caller.update({ id: created.id, changes: { name: "Renamed laptop" } });
    expect((await caller.byId({ id: created.id }))?.asset.subAssetId).toBe("PART-A");
    await caller.update({ id: created.id, changes: { subAssetId: "  PART-B  " } });
    expect((await caller.byId({ id: created.id }))?.asset.subAssetId).toBe("PART-B");
    await caller.update({ id: created.id, changes: { subAssetId: "  " } });
    expect((await caller.byId({ id: created.id }))?.asset).toMatchObject({ assetId: "TEST-1", subAssetId: null });
    await expect(caller.create({ assetId: "TEST-2", name: "Second laptop" })).resolves.toMatchObject({ assetId: "TEST-2" });
    await expect(caller.create({ name: "Invalid laptop", subAssetId: "A".repeat(81) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a user-entered Asset ID everywhere and never generates one", async () => {
    const caller = assetRouter.createCaller(context());
    await expect(caller.create({ name: "No ID laptop" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.create({ assetId: "   ", name: "Blank ID laptop" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.create({ assetId: "  IIMS-LAP-0001  ", name: "Laptop" })).resolves.toMatchObject({ assetId: "IIMS-LAP-0001" });
    await expect(caller.create({ assetId: "IIMS-LAP-0001", name: "Duplicate laptop" })).rejects.toMatchObject({ code: "CONFLICT", message: 'Asset ID "IIMS-LAP-0001" already exists.' });
    expect(state.rows.assets).toHaveLength(1);

    const checks = await caller.bulkValidate({ rows: [{ name: "Missing ID" }, { assetId: "IIMS-LAP-0002", name: "Ok" }] });
    expect(checks.map(row => row.valid)).toEqual([false, true]);
    expect(checks[0].errors.join(" ")).toContain("Asset ID is required.");

    const imported = await caller.importCsv({ fileName: "assets.csv", csv: "Asset Name,Asset ID\nNo ID laptop,\nTagged laptop,IIMS-LAP-0003" });
    expect(imported).toMatchObject({ successfulRows: 1, failedRows: 1 });
    expect(imported.errors[0]).toMatchObject({ rowNumber: 2, fieldName: "Asset ID", message: "Asset ID is required." });
    expect(state.rows.assets.map(row => row.assetId)).toEqual(["IIMS-LAP-0001", "IIMS-LAP-0003"]);
    expect(state.rows.assets.some(row => /^AST-/.test(row.assetId))).toBe(false);
  });

  it("automatically saves distinct QR identities and encodes the canonical public URL", async () => {
    const encode = vi.spyOn(QRCode, "toDataURL");
    const caller = assetRouter.createCaller(context());
    const first = await caller.create({ assetId: "TEST-1", name: "First laptop" });
    const second = await caller.create({ assetId: "TEST-2", name: "Second laptop" });
    expect(first.qr.token).not.toBe(second.qr.token);
    expect(first.qr.publicUrl).toBe(`https://assets.example.com/asset/${first.qr.token}`);
    expect(first.qr.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(encode).toHaveBeenCalledWith(first.qr.publicUrl, expect.objectContaining({ margin: 4 }));
    expect(state.rows.qr_codes).toHaveLength(2);
  });

  it("serves current details to an authorized admin through the unchanged QR after an edit", async () => {
    const caller = assetRouter.createCaller(context());
    const created = await caller.create({ assetId: "TEST-1", name: "Laptop", model: "5440", serialNumber: "SN-1", locationName: "HQ" });
    const publicCaller = assetRouter.createCaller(context());
    expect((await publicCaller.publicByToken({ token: created.qr.token }))?.asset.locationName).toBe("HQ");
    await caller.update({ id: created.id, changes: { name: "Updated laptop", locationName: "Branch office", model: "5450", purchaseDate: "2026-03-15" } });
    const scanned = await publicCaller.publicByToken({ token: created.qr.token });
    expect(scanned?.asset).toMatchObject({ name: "Updated laptop", locationName: "Branch office", model: "5450", serialNumber: "SN-1" });
    expect(scanned?.qr).toMatchObject(created.qr);
    expect(state.rows.qr_codes).toHaveLength(1);
    await expect(assetRouter.createCaller(context(false)).create({ name: "Unauthorized asset" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns no details for unknown and inactive tokens", async () => {
    const created = await assetRouter.createCaller(context()).create({ assetId: "TEST-1", name: "Laptop" });
    const caller = assetRouter.createCaller(context());
    await expect(caller.publicByToken({ token: "QR-DOES-NOT-EXIST" })).resolves.toBeUndefined();
    state.rows.qr_codes[0].isActive = 0;
    await expect(caller.publicByToken({ token: created.qr.token })).resolves.toBeUndefined();
  });

  it("rolls back registration when QR persistence fails", async () => {
    state.failQr = true;
    await expect(assetRouter.createCaller(context()).create({ assetId: "TEST-1", name: "Laptop" })).rejects.toThrow("Could not save");
    expect(state.rows.assets ?? []).toHaveLength(0);
    expect(state.rows.qr_codes ?? []).toHaveLength(0);
  });
});
