import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { parseAssetDates, safeNumber } from "./assetDb";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "google:test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, get: () => "assettrack.test" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("asset foundation", () => {
  it("parses business dates without trusting browser-local formatting", () => {
    const dates = parseAssetDates({ purchaseDate: "2026-08-30", warrantyExpiryDate: "2027-08-30" });
    expect(dates.purchaseDate).toBeInstanceOf(Date);
    expect(dates.warrantyExpiryDate).toBeInstanceOf(Date);
    expect(dates.expectedReturnDate).toBeUndefined();
  });

  it("rejects non-numeric purchase cost values instead of persisting invalid money", () => {
    expect(safeNumber("1299.00")).toBe(1299);
    expect(safeNumber("not-a-cost")).toBeUndefined();
  });

  it("keeps public QR lookup separate and returns no record for an unknown token", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.asset.publicByToken({ token: "QR-UNKNOWN-TOKEN" })).resolves.toBeUndefined();
  });

  it("rejects CSV uploads that omit the required Asset Name column", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.asset.importCsv({ fileName: "invalid.csv", csv: "Category,Serial Number\nComputers,S-1" })).rejects.toThrow("Asset Name");
  });

  it("requires explicit confirmation for bulk updates", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.asset.bulkUpdate({ ids: [1], confirm: false })).rejects.toThrow();
  });

  it("enforces bounded pagination at the router boundary", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.asset.list({ page: 0, pageSize: 8 })).rejects.toThrow();
    await expect(caller.asset.list({ page: 1, pageSize: 8 })).resolves.toMatchObject({ page: 1, pageSize: 8 });
  });
});
