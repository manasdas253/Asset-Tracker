import { createHash, randomBytes } from "node:crypto";
import { parse } from "cookie";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authAccounts, authSessions, employees, securityAuditLogs } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { getDb } from "../db";
import { getSessionCookieOptions } from "./cookies";

export type SessionUser = {
  id: number; employeeId: string; employeeRecordId: number | null;
  name: string; email: string | null; role: "admin" | "employee"; mustChangePassword: boolean;
};
export type Account = typeof authAccounts.$inferSelect;
export function sessionUser(account: Account): SessionUser {
  return { id: account.id, employeeId: account.loginId, employeeRecordId: account.employeeRecordId, name: account.name, email: account.email, role: account.role, mustChangePassword: account.mustChangePassword === 1 };
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
  return db;
}
export type AuthDb = Awaited<ReturnType<typeof requireDb>>;
export type AuthTransaction = Parameters<Parameters<AuthDb["transaction"]>[0]>[0];
export type AuditInput = { accountId?: number; actor?: string; action: string; outcome: "success" | "denied"; assetId?: number; details?: Record<string, unknown> };
export async function securityAudit(input: AuditInput, req?: Pick<Request, "ip">, db?: Pick<AuthDb, "insert">) {
  await (db ?? await requireDb()).insert(securityAuditLogs).values({ ...input, details: input.details ? JSON.stringify(input.details) : undefined, ipAddress: req?.ip?.slice(0, 64) });
}
export function requestSessionToken(req: Pick<Request, "headers">) {
  const value = parse(req.headers.cookie ?? "")[COOKIE_NAME];
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function authenticateRequest(req: Request): Promise<SessionUser | null> {
  const token = requestSessionToken(req);
  if (!token) return null;
  const db = await requireDb();
  const [session] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, digest(token)), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, session.accountId)).limit(1);
  if (!account || !account.isActive || account.passwordVersion !== session.passwordVersion) return null;
  if (account.mustChangePassword && (!account.temporaryPasswordExpiresAt || account.temporaryPasswordExpiresAt <= new Date())) return null;
  if (account.employeeRecordId) {
    const [employee] = await db.select().from(employees).where(eq(employees.id, account.employeeRecordId)).limit(1);
    if (!employee || employee.status !== "active") return null;
  }
  return sessionUser(account);
}
export async function insertSession(db: Pick<AuthDb, "insert">, account: Account) {
  const token = randomBytes(32).toString("base64url");
  const duration = account.mustChangePassword ? 15 * 60_000 : 8 * 60 * 60_000;
  const expiresAt = new Date(Math.min(Date.now() + duration, account.temporaryPasswordExpiresAt?.getTime() ?? Infinity));
  await db.insert(authSessions).values({ tokenHash: digest(token), accountId: account.id, passwordVersion: account.passwordVersion, expiresAt });
  return { token, expiresAt };
}
export function setSessionCookie(req: Request, res: Response, session: { token: string; expiresAt: Date }) {
  res.cookie(COOKIE_NAME, session.token, { ...getSessionCookieOptions(req), expires: session.expiresAt });
}
