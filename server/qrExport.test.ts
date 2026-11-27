import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { qrExportFilters, qrExportInput } from "./qrExport";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: async () => ({
  select: () => ({ from: () => {
    const chain: any = { leftJoin: () => chain, where: () => chain, orderBy: () => chain, limit: () => chain, then: (resolve: any) => Promise.resolve([]).then(resolve) };
    return chain;
  } }),
}) }));

function context(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role ? { id: 1, employeeId: "E1", employeeRecordId: null, mustChangePassword: false, name: "T", email: null, role } as TrpcContext["user"] : null,
    req: { protocol: "https", headers: {}, get: () => "assettrack.test" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bulk QR export", () => {
  it("is restricted to administrators", async () => {
    await expect(appRouter.createCaller(context(null)).asset.qrExport({})).rejects.toThrow();
    await expect(appRouter.createCaller(context("user")).asset.qrExport({})).rejects.toThrow();
    await expect(appRouter.createCaller(context("admin")).asset.qrExport({})).resolves.toEqual({ items: [], nextAfterId: null, total: 0 });
  });

  it("caps the page size so one request cannot pull the whole register", () => {
    expect(qrExportInput.safeParse({ limit: 251 }).success).toBe(false);
    expect(qrExportInput.parse({})).toMatchObject({ afterId: 0, limit: 250 });
  });

  it("applies the same filters as the asset register and ignores 'all'", () => {
    expect(qrExportFilters({})).toHaveLength(0);
    expect(qrExportFilters({ status: "all", category: "all", department: "all", location: "all" })).toHaveLength(0);
    expect(qrExportFilters({ search: "Dell", status: "available", category: "IT", department: "IT", location: "HQ" })).toHaveLength(5);
  });
});
