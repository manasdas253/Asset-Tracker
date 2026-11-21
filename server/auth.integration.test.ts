import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import { appRouter, type AppRouter } from "./routers";
import { createContext } from "./_core/context";
import { requestSecurity } from "./_core/requestSecurity";
import { registerStorageProxy } from "./_core/storageProxy";
import { authAccounts, authRateLimits, authSessions, employeeAssetPermissions, employees, securityAuditLogs, qrCodes, assets } from "../drizzle/schema";
import { digest, requireDb } from "./_core/localAuth";
import { hashPassword, verifyPassword } from "./_core/passwords";
import { COOKIE_NAME } from "../shared/const";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const enabled = Boolean(process.env.AUTH_TEST_DATABASE_URL);
const password = "Original secure password 123!";
describe.skipIf(!enabled)("real Express/tRPC/MySQL authentication and authorization", () => {
  let db: Awaited<ReturnType<typeof requireDb>>;
  let server: Server;
  let endpoint: string;
  let passwordHash: string;
  let adminId: number;
  let employeeId: number;
  let assetId: number;
  let otherAssetId: number;
  let token: string;
  let qrSnapshot: string;
  let assetSnapshot: string;

  function browser(origin = "http://localhost:3000") {
    let cookie = "";
    let lastCookie = "";
    const client = createTRPCProxyClient<AppRouter>({ links: [httpLink({ url: endpoint, transformer: superjson, fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set("origin", origin);
      if (cookie) headers.set("cookie", cookie);
      const response = await fetch(url, { ...init, headers });
      const value = response.headers.get("set-cookie");
      if (value) { lastCookie = value; cookie = value.split(";")[0]; }
      return response;
    } })] });
    return { client, get cookie() { return cookie; }, get lastCookie() { return lastCookie; }, setCookie: (value: string) => { cookie = value; } };
  }
  async function signIn(id = "EMP001") {
    const session = browser();
    await session.client.auth.login.mutate({ employeeId: id, password });
    return session;
  }
  beforeAll(async () => {
    const url = new URL(process.env.AUTH_TEST_DATABASE_URL!);
    if (!/^\/asset_tracker_auth_test_\d+$/.test(url.pathname) || process.env.DATABASE_URL !== url.toString()) throw new Error("Use the disposable integration runner.");
    db = await requireDb();
    passwordHash = await hashPassword(password);
    await db.insert(assets).values([{ assetId: "PRESERVE-001", name: "Existing laptop" }, { assetId: "PRESERVE-002", name: "Another asset" }]);
    const fixtureAssets = await db.select().from(assets);
    assetSnapshot = JSON.stringify(fixtureAssets);
    assetId = fixtureAssets[0].id;
    otherAssetId = fixtureAssets[1].id;
    token = "QR-EXISTING-STABLE-TOKEN";
    await db.insert(qrCodes).values({ assetId, token, publicUrl: `https://old.example.com/asset/${token}`, qrDataUrl: "data:image/png;base64,existing-unmodified-code" });
    qrSnapshot = JSON.stringify(await db.select().from(qrCodes));
    const app = express();
    app.use(express.json());
    registerStorageProxy(app);
    app.use("/api", requestSecurity);
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc`;
  }, 30_000);
  beforeEach(async () => {
    await db.delete(authSessions);
    await db.delete(employeeAssetPermissions);
    await db.delete(authAccounts);
    await db.delete(employees);
    await db.delete(authRateLimits);
    await db.delete(securityAuditLogs);
    const employeeRecordId = Number((await db.insert(employees).values({ employeeId: "EMP001", name: "First Employee" }))[0].insertId);
    adminId = Number((await db.insert(authAccounts).values({ loginId: "ADMIN001", name: "Admin", role: "admin", passwordHash, mustChangePassword: 0 }))[0].insertId);
    employeeId = Number((await db.insert(authAccounts).values({ loginId: "EMP001", name: "First Employee", role: "employee", employeeRecordId, passwordHash, mustChangePassword: 0 }))[0].insertId);
  });
  afterAll(async () => {
    if (db && qrSnapshot) {
      expect(JSON.stringify(await db.select().from(qrCodes))).toBe(qrSnapshot);
      expect(JSON.stringify(await db.select().from(assets))).toBe(assetSnapshot);
    }
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it("hashes salted passwords, validates credentials, and never returns password/session secrets", async () => {
    expect(passwordHash).not.toContain(password);
    expect(await verifyPassword("wrong password", passwordHash)).toBe(false);
    const session = await signIn("emp001");
    const user = await session.client.auth.me.query();
    expect(user).toMatchObject({ role: "employee", employeeId: "EMP001", mustChangePassword: false });
    expect(user).not.toHaveProperty("passwordHash");
    expect(session.lastCookie).toContain("HttpOnly");
    expect(session.lastCookie).toContain("SameSite=Lax");
    const [stored] = await db.select().from(authSessions);
    expect(stored.tokenHash).toBe(digest(session.cookie.split("=")[1]));
    const wrong = browser();
    await expect(wrong.client.auth.login.mutate({ employeeId: "EMP001", password: "wrong" })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await expect(wrong.client.auth.login.mutate({ employeeId: "UNKNOWN", password })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });

  it("denies anonymous/direct asset requests, permits explicit grants, and revokes them immediately", async () => {
    const anonymous = browser();
    await expect(anonymous.client.asset.publicByToken.query({ token })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await expect(anonymous.client.asset.byId.query({ id: assetId })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    const employee = await signIn();
    await expect(employee.client.asset.publicByToken.query({ token })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(employee.client.asset.byId.query({ id: assetId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const admin = await signIn("ADMIN001");
    await admin.client.auth.setAssetPermission.mutate({ accountId: employeeId, assetId, allowed: true });
    expect((await employee.client.asset.publicByToken.query({ token }))?.asset.assetId).toBe("PRESERVE-001");
    const detail = await employee.client.asset.byId.query({ id: assetId });
    expect(detail?.asset.id).toBe(assetId);
    expect(detail?.audits).toEqual([]);
    expect(detail?.documents).toEqual([]);
    await expect(employee.client.asset.byId.query({ id: otherAssetId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await admin.client.auth.setAssetPermission.mutate({ accountId: employeeId, assetId, allowed: false });
    await expect(employee.client.asset.publicByToken.query({ token })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const logs = await admin.client.auth.audit.query({ page: 1 });
    for (const action of ["login", "qr_scan", "asset_access", "asset_permission_changed"]) expect(logs.some(row => row.action === action)).toBe(true);
    expect(logs.filter(row => row.action === "asset_access").map(row => row.outcome)).toEqual(expect.arrayContaining(["denied", "success"]));
    expect(JSON.stringify(logs)).not.toContain(password);
    expect(JSON.stringify(logs)).not.toContain(token);
  });

  it("enforces first-login password changes and session rotation", async () => {
    const admin = await signIn("ADMIN001");
    const created = await admin.client.auth.registerEmployee.mutate({ employeeId: "NEW001", name: "New Employee", role: "admin" } as any);
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(20);
    const employee = browser();
    expect(await employee.client.auth.login.mutate({ employeeId: "NEW001", password: created.temporaryPassword })).toMatchObject({ role: "employee" });
    const oldCookie = employee.cookie;
    await admin.client.auth.setAssetPermission.mutate({ accountId: created.accountId, assetId, allowed: true });
    await expect(employee.client.asset.byId.query({ id: assetId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(employee.client.auth.changePassword.mutate({ currentPassword: created.temporaryPassword, newPassword: "short" })).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    await employee.client.auth.changePassword.mutate({ currentPassword: created.temporaryPassword, newPassword: "New personal secure password!" });
    expect(employee.cookie).not.toBe(oldCookie);
    expect((await employee.client.auth.me.query())?.mustChangePassword).toBe(false);
    expect((await employee.client.asset.publicByToken.query({ token }))?.asset.id).toBe(assetId);
    const stolenOldSession = browser(); stolenOldSession.setCookie(oldCookie);
    expect(await stolenOldSession.client.auth.me.query()).toBeNull();
    await expect(browser().client.auth.login.mutate({ employeeId: "NEW001", password: created.temporaryPassword })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  }, 20_000);

  it("resets credentials, blocks inactive accounts and invalidates all existing sessions", async () => {
    const employee = await signIn();
    const second = await signIn();
    const admin = await signIn("ADMIN001");
    const reset = await admin.client.auth.resetPassword.mutate({ accountId: employeeId });
    expect(await employee.client.auth.me.query()).toBeNull();
    expect(await second.client.auth.me.query()).toBeNull();
    await expect(browser().client.auth.login.mutate({ employeeId: "EMP001", password })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    const fresh = browser();
    await fresh.client.auth.login.mutate({ employeeId: "EMP001", password: reset.temporaryPassword });
    await admin.client.auth.setActive.mutate({ accountId: employeeId, active: false });
    expect(await fresh.client.auth.me.query()).toBeNull();
    await expect(browser().client.auth.login.mutate({ employeeId: "EMP001", password: reset.temporaryPassword })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await admin.client.auth.setActive.mutate({ accountId: employeeId, active: true });
    await expect(browser().client.auth.login.mutate({ employeeId: "EMP001", password: reset.temporaryPassword })).resolves.toMatchObject({ mustChangePassword: true });
  }, 20_000);

  it("rejects expired/tampered sessions and revokes logout tokens server-side", async () => {
    const employee = await signIn();
    const cookie = employee.cookie;
    await employee.client.auth.logout.mutate();
    employee.setCookie(cookie);
    expect(await employee.client.auth.me.query()).toBeNull();
    const expired = await signIn();
    await db.update(authSessions).set({ expiresAt: new Date(Date.now() - 60_000) });
    expect(await expired.client.auth.me.query()).toBeNull();
    expired.setCookie(`${COOKIE_NAME}=${"A".repeat(43)}`);
    expect(await expired.client.auth.me.query()).toBeNull();
  });

  it("rejects expired temporary passwords and inactive employee records", async () => {
    await db.update(authAccounts).set({ mustChangePassword: 1, temporaryPasswordExpiresAt: new Date(Date.now() - 60_000) }).where(eq(authAccounts.id, employeeId));
    await expect(signIn()).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await db.update(authAccounts).set({ mustChangePassword: 0 }).where(eq(authAccounts.id, employeeId));
    await db.update(employees).set({ status: "inactive" });
    await expect(signIn()).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });

  it("denies every management API to employees including direct QR actions", async () => {
    const employee = await signIn();
    const documentUrl = endpoint.replace("/api/trpc", "/manus-storage/private-document.pdf");
    expect((await fetch(documentUrl)).status).toBe(401);
    expect((await fetch(documentUrl, { headers: { cookie: employee.cookie } })).status).toBe(403);
    const queries = ["dashboard", "catalog", "notifications", "activity", "importHistory", "approvalQueue", "list", "qrSheet", "exportCsv", "movementReport"];
    for (const route of queries) await expect((employee.client.asset as any)[route].query({})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const mutations = ["create", "addDocument", "bulkValidate", "bulkCreate", "update", "publicCheckout", "checkout", "checkin", "transfer", "publicReportDamage", "reportDamage", "setLifecycle", "createMaintenance", "markNotificationRead", "saveCatalogItem", "bulkUpdate", "importCsv", "saveSetting", "seedDemo"];
    for (const route of mutations) await expect((employee.client.asset as any)[route].mutate({})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    for (const route of ["registerEmployee", "resetPassword", "setActive", "setAssetPermission"]) await expect((employee.client.auth as any)[route].mutate({})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    for (const route of ["accounts", "permissions", "audit"]) await expect((employee.client.auth as any)[route].query({})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const admin = await signIn("ADMIN001");
    expect((await admin.client.asset.byId.query({ id: otherAssetId }))?.asset.id).toBe(otherAssetId);
    expect((await admin.client.asset.list.query({ page: 1, pageSize: 8 })).total).toBe(2);
  });

  it("limits repeated password guesses and rejects cross-origin login", async () => {
    const attacker = browser();
    for (let index = 0; index < 10; index++) await expect(attacker.client.auth.login.mutate({ employeeId: "EMP001", password: "wrong" })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await expect(attacker.client.auth.login.mutate({ employeeId: "EMP001", password })).rejects.toMatchObject({ data: { code: "TOO_MANY_REQUESTS" } });
    const crossSite = browser("https://attacker.example");
    await expect(crossSite.client.auth.login.mutate({ employeeId: "ADMIN001", password })).rejects.toThrow();
    expect(await crossSite.client.auth.me.query()).toBeNull();
  }, 30_000);

  it("bootstraps and recovers the first Admin only through the server CLI", async () => {
    const execute = promisify(execFile);
    const run = (...args: string[]) => execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/bootstrap-admin.ts", ...args], { env: process.env });
    await expect(run("create", "ANOTHERADMIN", "Another admin")).rejects.toThrow();
    await db.delete(authAccounts);
    const initial = await run("create", "BOOTADMIN", "Bootstrap Admin");
    const extractPassword = (output: string) => output.match(/Temporary password \(share privately\): ([^\r\n]+)/)?.[1] ?? "";
    const admin = browser();
    await expect(admin.client.auth.login.mutate({ employeeId: "BOOTADMIN", password: extractPassword(initial.stdout) })).resolves.toMatchObject({ role: "admin", mustChangePassword: true });
    await run("recover", "BOOTADMIN");
    expect(await admin.client.auth.me.query()).toBeNull();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.loginId, "BOOTADMIN"));
    expect(account.passwordVersion).toBe(2);
  }, 30_000);

  it("links existing employee records without overwriting their data or activation status", async () => {
    const record = { employeeId: "LEGACY/001", name: "Existing Employee", email: "original@example.com", phone: "1234567890", status: "inactive" as const };
    const id = Number((await db.insert(employees).values(record))[0].insertId);
    const admin = await signIn("ADMIN001");
    const created = await admin.client.auth.registerEmployee.mutate({ employeeId: record.employeeId, name: "Do not overwrite", email: "replacement@example.com" });
    const [existing] = await db.select().from(employees).where(eq(employees.id, id));
    expect(existing).toMatchObject(record);
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, created.accountId));
    expect(account).toMatchObject({ employeeRecordId: id, name: record.name, email: record.email, isActive: 0 });
    await admin.client.auth.setActive.mutate({ accountId: created.accountId, active: true });
    await expect(browser().client.auth.login.mutate({ employeeId: record.employeeId, password: created.temporaryPassword })).resolves.toMatchObject({ role: "employee", mustChangePassword: true });
    await expect(admin.client.auth.registerEmployee.mutate({ employeeId: record.employeeId, name: record.name })).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });
});
