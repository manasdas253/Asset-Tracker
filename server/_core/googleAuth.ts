import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";

// Do not use the `__Host-` prefix here: browsers require prefixed cookies to
// be Secure, but Google OAuth must also work on http://localhost in development.
// Production still marks this host-only cookie Secure below.
const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function required(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "JWT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function appBaseUrl(req: Request) {
  const configured = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol;
  return `${protocol || "https"}://${req.get("host")}`;
}

function allowedEmails() {
  return new Set((process.env.GOOGLE_ALLOWED_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
}

function adminEmails() {
  return new Set((process.env.GOOGLE_ADMIN_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function secret() {
  return new TextEncoder().encode(required("JWT_SECRET"));
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const openId = typeof payload.sub === "string" ? payload.sub : "";
    return openId ? (await db.getUserByOpenId(openId)) ?? null : null;
  } catch {
    return null;
  }
}

async function createSession(user: User) {
  return new SignJWT({ email: user.email ?? "", name: user.name ?? "", role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.openId)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secret());
}

type GoogleUser = { sub?: string; email?: string; email_verified?: boolean; name?: string };

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req, res) => {
    try {
      const state = crypto.randomBytes(32).toString("base64url");
      const returnTo = safeReturnTo(req.query.returnTo);
      res.cookie(GOOGLE_STATE_COOKIE, JSON.stringify({ state, returnTo }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60_000 });
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set("client_id", required("GOOGLE_CLIENT_ID"));
      url.searchParams.set("redirect_uri", `${appBaseUrl(req)}/api/auth/google/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      url.searchParams.set("prompt", "select_account");
      res.redirect(url.toString());
    } catch (error) {
      console.error("[Auth] Google sign-in setup failed", error);
      res.status(503).send("Google sign-in is not configured.");
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const stateCookie = parseCookieHeader(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    let saved: { state?: string; returnTo?: string } = {};
    try { saved = stateCookie ? JSON.parse(stateCookie) : {}; } catch { /* rejected below */ }
    const receivedState = typeof req.query.state === "string" ? req.query.state : "";
    if (!saved.state || Buffer.byteLength(saved.state) !== Buffer.byteLength(receivedState) || !crypto.timingSafeEqual(Buffer.from(saved.state), Buffer.from(receivedState))) {
      res.status(403).send("Invalid Google sign-in state.");
      return;
    }
    if (typeof req.query.code !== "string") {
      res.status(400).send("Google did not return an authorization code.");
      return;
    }
    try {
      const redirectUri = `${appBaseUrl(req)}/api/auth/google/callback`;
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: req.query.code, client_id: required("GOOGLE_CLIENT_ID"), client_secret: required("GOOGLE_CLIENT_SECRET"), redirect_uri: redirectUri, grant_type: "authorization_code" }) });
      const token = await tokenResponse.json() as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token) throw new Error("Google token exchange failed");
      const profileResponse = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json() as GoogleUser;
      if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) throw new Error("Google did not return a verified email address");
      const email = profile.email.toLowerCase();
      const allowed = allowedEmails();
      if (!allowed.has(email)) {
        res.status(403).send("This Google account is not authorized for this workspace.");
        return;
      }
      const user = await db.upsertGoogleUser({ openId: `google:${profile.sub}`, email, name: profile.name ?? email, role: adminEmails().has(email) ? "admin" : "user" });
      if (!user) throw new Error("Unable to create the application user");
      const session = await createSession(user);
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, safeReturnTo(saved.returnTo));
    } catch (error) {
      console.error("[Auth] Google callback failed", error);
      res.status(500).send("Google sign-in failed. Please try again.");
    }
  });
}
