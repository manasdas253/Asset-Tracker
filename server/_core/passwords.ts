import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";

// OWASP scrypt minimum: N=2^17, r=8, p=1. Node's default maxmem is too low.
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let activeDerivations = 0;
async function derive(password: string, salt: string): Promise<Buffer> {
  if (activeDerivations >= 4) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Password service is busy. Retry shortly." });
  activeDerivations++;
  try { return await new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key))); }
  finally { activeDerivations--; }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$131072$8$1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "131072" || r !== "8" || p !== "1" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, "hex"));
}

export const generateTemporaryPassword = () => randomBytes(18).toString("base64url");
// Same work for unknown accounts; never allow account discovery via a fast path.
export const DUMMY_HASH = `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
