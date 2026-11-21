import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authAccounts, authRateLimits, authSessions, employees, assets, employeeAssetPermissions, securityAuditLogs } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { adminProcedure, publicProcedure, router, signedInProcedure } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { digest, insertSession, requestSessionToken, requireDb, securityAudit, sessionUser, setSessionCookie } from "./_core/localAuth";
import { DUMMY_HASH, generateTemporaryPassword, hashPassword, verifyPassword } from "./_core/passwords";

const loginIdSchema = z.string().trim().min(1).max(80).transform(value => value.toUpperCase());
const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
const accountIdSchema = z.object({ accountId: z.number().int().positive() });
const invalidLogin = () => new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Employee ID or password, or account unavailable." });
let activePasswordChecks = 0;

// Persistent, atomic fixed windows cover both distributed account attacks and IP spraying.
async function rateLimit(key: string, max: number) {
  const db = await requireDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  // Use the timestamp column's UTC encoder, matching insert values on every host timezone.
  const cutoffValue = sql.param(cutoff, authRateLimits.windowStart);
  const nowValue = sql.param(now, authRateLimits.windowStart);
  const bucketKey = digest(key);
  await db.insert(authRateLimits).values({ bucketKey, attempts: 1, windowStart: now }).onDuplicateKeyUpdate({ set: {
    attempts: sql`IF(${authRateLimits.windowStart} <= ${cutoffValue}, 1, ${authRateLimits.attempts} + 1)`,
    windowStart: sql`IF(${authRateLimits.windowStart} <= ${cutoffValue}, ${nowValue}, ${authRateLimits.windowStart})`,
  } });
  const [bucket] = await db.select().from(authRateLimits).where(eq(authRateLimits.bucketKey, bucketKey)).limit(1);
  if (!bucket || bucket.attempts > max) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in 15 minutes." });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  login: publicProcedure.input(z.object({ employeeId: loginIdSchema, password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    const audit = { actor: input.employeeId, action: "login", outcome: "denied" as const };
    try {
      await rateLimit(`ip:${ctx.req.ip ?? "unknown"}`, 40);
      await rateLimit(`account:${input.employeeId}`, 10);
    } catch (error) { await securityAudit(audit, ctx.req); throw error; }
    // Bound memory usage of the memory-hard password KDF under concurrent requests.
    if (activePasswordChecks >= 4) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Sign-in is busy. Please retry shortly." });
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.loginId, input.employeeId)).limit(1);
    activePasswordChecks++;
    let verified: boolean;
    try { verified = await verifyPassword(input.password, account?.passwordHash ?? DUMMY_HASH); }
    catch (error) { await securityAudit({ ...audit, accountId: account?.id }, ctx.req); throw error; }
    finally { activePasswordChecks--; }
    if (!verified || !account || !account.isActive || (account.mustChangePassword && (!account.temporaryPasswordExpiresAt || account.temporaryPasswordExpiresAt <= new Date()))) {
      await securityAudit({ ...audit, accountId: account?.id }, ctx.req);
      throw invalidLogin();
    }
    // Recheck under lock to prevent a reset/deactivation racing a successful login.
    const session = await db.transaction(async tx => {
      const [current] = await tx.select().from(authAccounts).where(eq(authAccounts.id, account.id)).for("update");
      if (!current || !current.isActive || current.passwordVersion !== account.passwordVersion) throw invalidLogin();
      if (current.employeeRecordId) {
        const [employee] = await tx.select().from(employees).where(eq(employees.id, current.employeeRecordId)).limit(1);
        if (!employee || employee.status !== "active") throw invalidLogin();
      }
      const session = await insertSession(tx, current);
      await securityAudit({ accountId: account.id, actor: account.loginId, action: "login", outcome: "success" }, ctx.req, tx);
      return session;
    }).catch(async error => { await securityAudit({ ...audit, accountId: account.id }, ctx.req); throw error; });
    setSessionCookie(ctx.req, ctx.res, session);
    return sessionUser(account);
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = requestSessionToken(ctx.req);
    if (token) {
      const db = await requireDb();
      await db.delete(authSessions).where(eq(authSessions.tokenHash, digest(token)));
      await securityAudit({ accountId: ctx.user?.id, actor: ctx.user?.employeeId, action: "logout", outcome: "success" }, ctx.req);
    }
    ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
    return { success: true } as const;
  }),
  changePassword: signedInProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })).mutation(async ({ input, ctx }) => {
    await rateLimit(`change:${ctx.user.id}`, 10);
    const db = await requireDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, ctx.user.id)).limit(1);
    if (!account || !await verifyPassword(input.currentPassword, account.passwordHash)) {
      await securityAudit({ accountId: ctx.user.id, action: "password_change", outcome: "denied" }, ctx.req);
      throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
    }
    if (input.currentPassword === input.newPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different password." });
    const passwordHash = await hashPassword(input.newPassword);
    const session = await db.transaction(async tx => {
      const [current] = await tx.select().from(authAccounts).where(eq(authAccounts.id, account.id)).for("update");
      if (!current?.isActive || current.passwordVersion !== account.passwordVersion) throw invalidLogin();
      const updated = { ...current, passwordHash, passwordVersion: current.passwordVersion + 1, mustChangePassword: 0, temporaryPasswordExpiresAt: null };
      await tx.update(authAccounts).set({ passwordHash, passwordVersion: updated.passwordVersion, mustChangePassword: 0, temporaryPasswordExpiresAt: null }).where(eq(authAccounts.id, account.id));
      await tx.delete(authSessions).where(eq(authSessions.accountId, account.id));
      const session = await insertSession(tx, updated);
      await securityAudit({ accountId: account.id, actor: account.loginId, action: "password_change", outcome: "success" }, ctx.req, tx);
      return session;
    });
    setSessionCookie(ctx.req, ctx.res, session);
    return { success: true };
  }),
  accounts: adminProcedure.query(async () => {
    const db = await requireDb();
    const rows = await db.select().from(authAccounts).orderBy(desc(authAccounts.createdAt));
    return rows.map(account => ({ ...sessionUser(account), isActive: Boolean(account.isActive), createdAt: account.createdAt }));
  }),
  registerEmployee: adminProcedure.input(z.object({ employeeId: loginIdSchema, name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional() })).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    try {
      const accountId = await db.transaction(async tx => {
        const [existing] = await tx.select().from(employees).where(eq(employees.employeeId, input.employeeId)).limit(1);
        const employeeRecordId = existing?.id ?? Number((await tx.insert(employees).values({ employeeId: input.employeeId, name: input.name, email: input.email }))[0].insertId);
        const result = await tx.insert(authAccounts).values({ loginId: input.employeeId, employeeRecordId, name: existing?.name ?? input.name, email: existing?.email ?? input.email, role: "employee", passwordHash, temporaryPasswordExpiresAt: expiresAt, isActive: existing?.status === "inactive" ? 0 : 1 });
        const accountId = Number(result[0].insertId);
        await securityAudit({ accountId: ctx.user.id, actor: ctx.user.employeeId, action: "employee_registered", outcome: "success", details: { targetAccountId: accountId, employeeId: input.employeeId } }, ctx.req, tx);
        return accountId;
      });
      return { accountId, employeeId: input.employeeId, temporaryPassword, expiresAt };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY" || (error as { cause?: { code?: string } }).cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "This employee already has an account." });
      throw error;
    }
  }),
  resetPassword: adminProcedure.input(accountIdSchema).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    await db.transaction(async tx => {
      const [account] = await tx.select().from(authAccounts).where(eq(authAccounts.id, input.accountId)).for("update");
      if (!account || account.role !== "employee") throw new TRPCError({ code: "BAD_REQUEST", message: "Select an employee account." });
      await tx.update(authAccounts).set({ passwordHash, mustChangePassword: 1, temporaryPasswordExpiresAt: expiresAt, passwordVersion: account.passwordVersion + 1 }).where(eq(authAccounts.id, account.id));
      await tx.delete(authSessions).where(eq(authSessions.accountId, account.id));
      await securityAudit({ accountId: ctx.user.id, actor: ctx.user.employeeId, action: "password_reset", outcome: "success", details: { targetAccountId: account.id } }, ctx.req, tx);
    });
    return { temporaryPassword, expiresAt };
  }),
  setActive: adminProcedure.input(accountIdSchema.extend({ active: z.boolean() })).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    await db.transaction(async tx => {
      const [account] = await tx.select().from(authAccounts).where(eq(authAccounts.id, input.accountId)).for("update");
      if (!account || account.role !== "employee") throw new TRPCError({ code: "BAD_REQUEST", message: "Select an employee account." });
      await tx.update(authAccounts).set({ isActive: input.active ? 1 : 0, passwordVersion: account.passwordVersion + 1 }).where(eq(authAccounts.id, account.id));
      if (account.employeeRecordId) await tx.update(employees).set({ status: input.active ? "active" : "inactive" }).where(eq(employees.id, account.employeeRecordId));
      await tx.delete(authSessions).where(eq(authSessions.accountId, account.id));
      await securityAudit({ accountId: ctx.user.id, actor: ctx.user.employeeId, action: "account_status_changed", outcome: "success", details: { targetAccountId: account.id, active: input.active } }, ctx.req, tx);
    });
    return { success: true };
  }),
  permissions: adminProcedure.input(accountIdSchema).query(async ({ input }) => (await requireDb()).select().from(employeeAssetPermissions).where(eq(employeeAssetPermissions.accountId, input.accountId))),
  setAssetPermission: adminProcedure.input(accountIdSchema.extend({ assetId: z.number().int().positive(), allowed: z.boolean() })).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    await db.transaction(async tx => {
      const [account] = await tx.select().from(authAccounts).where(eq(authAccounts.id, input.accountId)).limit(1);
      const [asset] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, input.assetId)).limit(1);
      if (!account || account.role !== "employee" || !asset) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an employee and an existing asset." });
      if (input.allowed) await tx.insert(employeeAssetPermissions).values({ accountId: account.id, assetId: input.assetId, grantedBy: ctx.user.id }).onDuplicateKeyUpdate({ set: { grantedBy: ctx.user.id } });
      else await tx.delete(employeeAssetPermissions).where(and(eq(employeeAssetPermissions.accountId, account.id), eq(employeeAssetPermissions.assetId, input.assetId)));
      await securityAudit({ accountId: ctx.user.id, actor: ctx.user.employeeId, action: "asset_permission_changed", outcome: "success", assetId: input.assetId, details: { targetAccountId: account.id, allowed: input.allowed } }, ctx.req, tx);
    });
    return { success: true };
  }),
  audit: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1) }).default({ page: 1 })).query(async ({ input }) => (await requireDb()).select().from(securityAuditLogs).orderBy(desc(securityAuditLogs.id)).limit(100).offset((input.page - 1) * 100)),
});
