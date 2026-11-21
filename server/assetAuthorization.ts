import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { employeeAssetPermissions, qrCodes, assets } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { digest, requireDb, securityAudit } from "./_core/localAuth";
import { getAssetById, getAssetByToken } from "./assetDb";

async function authorize(ctx: TrpcContext, assetId?: number, token?: string) {
  const details = token ? { tokenDigest: digest(token) } : undefined;
  if (token) await securityAudit({ accountId: ctx.user?.id, actor: ctx.user?.employeeId, action: "qr_scan", outcome: ctx.user && !ctx.user.mustChangePassword ? "success" : "denied", assetId, details }, ctx.req);
  let allowed = Boolean(ctx.user && !ctx.user.mustChangePassword && ctx.user.role === "admin");
  if (ctx.user && !ctx.user.mustChangePassword && ctx.user.role === "employee" && assetId) {
    const db = await requireDb();
    const [grant] = await db.select({ id: employeeAssetPermissions.id }).from(employeeAssetPermissions).where(and(eq(employeeAssetPermissions.accountId, ctx.user.id), eq(employeeAssetPermissions.assetId, assetId))).limit(1);
    allowed = Boolean(grant);
  }
  await securityAudit({ accountId: ctx.user?.id, actor: ctx.user?.employeeId, action: "asset_access", outcome: allowed ? "success" : "denied", assetId, details }, ctx.req);
  if (!allowed) throw new TRPCError({ code: ctx.user ? "FORBIDDEN" : "UNAUTHORIZED", message: ctx.user?.mustChangePassword ? "Change your temporary password before continuing." : "Asset access denied. Sign in with an authorized account." });
}

export async function authorizedAssetByToken(ctx: TrpcContext, token: string) {
  const db = await requireDb();
  // Resolve identity only; permission checks run before any asset details are loaded.
  const [qr] = await db.select().from(qrCodes).where(and(eq(qrCodes.token, token), eq(qrCodes.isActive, 1))).limit(1);
  await authorize(ctx, qr?.assetId, token);
  return qr ? getAssetByToken(token) : undefined;
}

export async function authorizedAssetById(ctx: TrpcContext, id: number) {
  await authorize(ctx, id);
  if (ctx.user?.role === "admin") return getAssetById(id);
  const db = await requireDb();
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) return undefined;
  const [qr] = await db.select().from(qrCodes).where(and(eq(qrCodes.assetId, id), eq(qrCodes.isActive, 1))).limit(1);
  // Employee reads omit private audit, document and transaction collections.
  return { asset, qr, events: [], transactions: [], assignments: [], maintenance: [], audits: [], documents: [] };
}
