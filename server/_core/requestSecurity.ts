import type { RequestHandler } from "express";

// tRPC mutations use POST and JSON. Validate browser origin as well as SameSite cookies.
export const requestSecurity: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.get("origin");
    const expected = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : `${req.protocol}://${req.get("host")}`;
    if (req.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected) || !req.is("application/json")) {
      res.status(403).json({ error: "Cross-origin or non-JSON request denied." });
      return;
    }
  }
  next();
};
