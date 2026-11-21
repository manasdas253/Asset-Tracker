import "dotenv/config";
import { eq } from "drizzle-orm";
import { authAccounts } from "../drizzle/schema";
import { requireDb, securityAudit } from "../server/_core/localAuth";
import { generateTemporaryPassword, hashPassword } from "../server/_core/passwords";

async function main() {
  const [mode, loginIdInput, name] = process.argv.slice(2).filter(value => value !== "--");
  const loginId = loginIdInput?.trim().toUpperCase();
  if (!["create", "recover"].includes(mode) || !loginId || !/^[A-Z0-9._-]{1,80}$/.test(loginId) || (mode === "create" && (!name || name.length > 160))) {
    console.error('Usage: pnpm.cmd auth:bootstrap create ADMIN001 "Workspace Admin"\nRecovery (server operator only): pnpm.cmd auth:bootstrap recover ADMIN001');
    process.exit(1);
  }
  try {
    const db = await requireDb();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    await db.transaction(async tx => {
      const admins = await tx.select().from(authAccounts).where(eq(authAccounts.role, "admin")).for("update");
      if (mode === "create") {
        if (admins.length) throw new Error("An administrator already exists. Use operator recovery if needed.");
        await tx.insert(authAccounts).values({ loginId, name, role: "admin", passwordHash, temporaryPasswordExpiresAt });
      } else {
        const account = admins.find(account => account.loginId === loginId);
        if (!account) throw new Error("No administrator matches this ID.");
        await tx.update(authAccounts).set({ passwordHash, mustChangePassword: 1, temporaryPasswordExpiresAt, passwordVersion: account.passwordVersion + 1, isActive: 1 }).where(eq(authAccounts.id, account.id));
      }
      await securityAudit({ actor: loginId, action: mode === "create" ? "admin_bootstrapped" : "admin_recovered", outcome: "success" }, undefined, tx);
    });
    console.log(`Admin Employee ID: ${loginId}\nTemporary password (share privately): ${temporaryPassword}\nExpires: ${temporaryPasswordExpiresAt.toISOString()}\nChange the password at first login.`);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Administrator setup failed.");
    process.exit(1);
  }
}
void main();
