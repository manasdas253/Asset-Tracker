import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { requireDb } from "./_core/localAuth";
import type { TrpcContext } from "./_core/context";
import {
  appSettings,
  assets,
  qrCodes,
  assetEvents,
  auditLogs,
  assetDocuments,
  assetAssignments,
  assetTransactions,
  notificationEvents,
} from "../drizzle/schema";

const photo = {
  name: "proof.png",
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
};
function context(role: "admin" | "employee" = "admin"): TrpcContext {
  return {
    user: {
      id: 99,
      employeeId: "LOGIN-ADMIN",
      name: "Signed in admin",
      employeeRecordId: null,
      mustChangePassword: false,
      role,
      email: null,
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}
const input = {
  token: "QR-VERIFICATION-TEST",
  employeeName: "Manually Entered Person",
  employeeCode: "ANY-MANUAL-ID",
  date: "2026-11-16",
  time: "09:45",
  location: "Main Store",
  condition: "good" as const,
  photos: [photo],
  remarks: "Manual observation",
};
const action = {
  token: input.token,
  employeeName: input.employeeName,
  employeeCode: input.employeeCode,
  purpose: "Field work",
  expectedReturnDate: "2026-12-01",
  description: "Broken casing",
  photos: [photo],
};
describe.skipIf(!process.env.VERIFICATION_TEST_DATABASE_URL)(
  "physical verification with disposable MySQL",
  () => {
    let db: Awaited<ReturnType<typeof requireDb>>;
    let assetId: number;
    const caller = appRouter.createCaller(context());
    beforeAll(async () => {
      const url = new URL(process.env.VERIFICATION_TEST_DATABASE_URL!);
      if (
        !/^\/asset_tracker_verification_test_\d+$/.test(url.pathname) ||
        process.env.DATABASE_URL !== url.toString()
      )
        throw new Error("Use the disposable verification integration runner.");
      db = await requireDb();
    });
    beforeEach(async () => {
      for (const table of [
        assetEvents,
        auditLogs,
        assetDocuments,
        assetAssignments,
        assetTransactions,
        notificationEvents,
        qrCodes,
        appSettings,
        assets,
      ])
        await db.delete(table);
      assetId = Number(
        (
          await db.insert(assets).values({
            assetId: "VERIFY-001",
            name: "Existing asset",
            locationName: "Main Store",
            status: "available",
            condition: "good",
          })
        )[0].insertId
      );
      await db.insert(qrCodes).values({
        assetId,
        token: input.token,
        publicUrl: "https://old.example/asset/QR-VERIFICATION-TEST",
        qrDataUrl: "existing-qr-image",
      });
      await caller.asset.verification.startCycle({
        name: "November stocktake",
      });
    });
    it("starts Pending without changing the asset or QR; saves manual details, proof and audit atomically", async () => {
      const before = await db.select().from(assets);
      const qrBefore = await db.select().from(qrCodes);
      expect((await caller.asset.verification.report()).rows[0]).toMatchObject({
        status: "Pending",
        latestVerificationDate: "",
      });
      expect(
        (await caller.asset.verification.summary({ assetId })).status
      ).toBe("Pending");
      const result = await caller.asset.verification.submit(input);
      expect(result.status).toBe("Verified");
      const report = await caller.asset.verification.report();
      expect(report.rows).toHaveLength(1);
      expect(report.rows[0]).toMatchObject({
        employeeName: input.employeeName,
        employeeCode: input.employeeCode,
        date: input.date,
        time: input.time,
        location: input.location,
        condition: "good",
        status: "Verified",
        latestVerificationDate: "2026-11-16 09:45",
        photos: [{ name: photo.name, dataUrl: photo.dataUrl }],
      });
      expect(
        await caller.asset.verification.summary({ assetId })
      ).toMatchObject({
        status: "Verified",
        latestVerificationDate: "2026-11-16 09:45",
      });
      expect(await db.select().from(assets)).toEqual(before);
      expect(await db.select().from(qrCodes)).toEqual(qrBefore);
      expect(
        await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.action, "physical_verification"))
      ).toHaveLength(1);
      expect(await db.select().from(assetDocuments)).toHaveLength(1);
    });
    it("flags mismatches, notifies admins, preserves the registered location and records append-only review", async () => {
      const result = await caller.asset.verification.submit({
        ...input,
        location: "Different Store",
      });
      expect(result.status).toBe("Flagged");
      expect(
        await caller.asset.verification.summary({ assetId })
      ).toMatchObject({ status: "Flagged", latestVerificationDate: null });
      const [eventBefore] = await db
        .select()
        .from(assetEvents)
        .where(eq(assetEvents.id, result.id));
      await caller.asset.verification.review({
        id: result.id,
        notes:
          "Confirmed asset movement; request a new verification after correction.",
      });
      const [eventAfter] = await db
        .select()
        .from(assetEvents)
        .where(eq(assetEvents.id, result.id));
      expect(eventAfter).toEqual(eventBefore);
      expect(
        (await caller.asset.verification.report()).rows[0].review
      ).toContain("Confirmed asset movement");
      expect(await db.select().from(notificationEvents)).toHaveLength(1);
      expect((await db.select().from(assets))[0]).toMatchObject({
        status: "available",
        locationName: "Main Store",
      });
    });
    it("stores each submission and starts a fresh Pending cycle while retaining historical records and latest successful date", async () => {
      await caller.asset.verification.submit(input);
      await caller.asset.verification.submit({
        ...input,
        date: "2026-11-17",
        time: "11:00",
      });
      // Backdated submission must not move the latest successful verification backwards.
      await caller.asset.verification.submit({ ...input, date: "2026-11-15" });
      expect((await caller.asset.verification.report()).rows).toHaveLength(3);
      expect(
        (await caller.asset.verification.summary({ assetId }))
          .latestVerificationDate
      ).toBe("2026-11-17 11:00");
      await caller.asset.verification.startCycle({ name: "Next cycle" });
      const report = await caller.asset.verification.report();
      expect(report.rows).toHaveLength(1);
      expect(report.rows[0]).toMatchObject({
        status: "Pending",
        latestVerificationDate: "2026-11-17 11:00",
      });
      expect(report.history).toHaveLength(3);
      expect(
        await db
          .select()
          .from(assetEvents)
          .where(eq(assetEvents.eventType, "physical_verification"))
      ).toHaveLength(3);
    });
    it("normalizes case and spacing; missing registered location never counts as a match", async () => {
      expect(
        (
          await caller.asset.verification.submit({
            ...input,
            location: " main   STORE ",
          })
        ).status
      ).toBe("Verified");
      await db
        .update(assets)
        .set({ locationName: null })
        .where(eq(assets.id, assetId));
      expect((await caller.asset.verification.submit(input)).status).toBe(
        "Flagged"
      );
    });
    it("alerts for damaged condition without changing operational state", async () => {
      await caller.asset.verification.submit({
        ...input,
        condition: "damaged",
      });
      expect((await db.select().from(assets))[0]).toMatchObject({
        status: "available",
        condition: "good",
      });
      expect((await db.select().from(notificationEvents))[0].message).toContain(
        "Damaged condition reported"
      );
    });
    it("requires all manual fields and validates calendar dates, time, condition and photo content", async () => {
      for (const patch of [
        { employeeName: "" },
        { employeeCode: "" },
        { date: "" },
        { date: "2026-02-30" },
        { time: "24:00" },
        { location: "" },
        { condition: "critical" },
        { photos: [] },
        { photos: [{ ...photo, dataUrl: "data:image/png;base64,YWJj" }] },
      ]) {
        await expect(
          caller.asset.verification.submit({ ...input, ...patch } as any)
        ).rejects.toThrow();
      }
      expect(await db.select().from(assetDocuments)).toHaveLength(0);
      expect(await db.select().from(assetEvents)).toHaveLength(0);
    });
    it("retains existing access rules without binding manual verifier identity to the account", async () => {
      const employee = appRouter.createCaller(context("employee"));
      const anonymous = appRouter.createCaller({ ...context(), user: null });
      for (const denied of [employee, anonymous]) {
        await expect(denied.asset.verification.submit(input)).rejects.toThrow();
        await expect(denied.asset.verification.report()).rejects.toThrow();
        await expect(
          denied.asset.verification.startCycle({ name: "Denied" })
        ).rejects.toThrow();
        await expect(
          denied.asset.verification.action({ ...action, action: "damage" })
        ).rejects.toThrow();
      }
      await expect(
        caller.asset.verification.submit(input)
      ).resolves.toMatchObject({ status: "Verified" });
    });
    it("checks out only Available assets and captures assignment, expected return and audit", async () => {
      await expect(
        caller.asset.publicCheckout({
          token: input.token,
          employeeName: input.employeeName,
          purpose: "",
          expectedReturnDate: "2026-12-01",
        })
      ).rejects.toThrow();
      await caller.asset.publicCheckout({
        token: input.token,
        employeeName: input.employeeName,
        employeeCode: input.employeeCode,
        purpose: action.purpose,
        expectedReturnDate: action.expectedReturnDate,
      });
      expect((await db.select().from(assets))[0]).toMatchObject({
        status: "checked_out",
        assignedEmployeeName: action.employeeName,
      });
      expect((await db.select().from(assetAssignments))[0]).toMatchObject({
        purpose: action.purpose,
        expectedReturnDate: new Date("2026-12-01T00:00:00Z"),
      });
      expect(await db.select().from(assetTransactions)).toHaveLength(1);
      await expect(
        caller.asset.verification.action({ ...action, action: "checkout" })
      ).rejects.toThrow("Only Available");
      for (const status of [
        "assigned",
        "under_maintenance",
        "lost",
        "damaged",
        "retired",
        "disposed",
      ] as const) {
        await db.update(assets).set({ status }).where(eq(assets.id, assetId));
        await expect(
          caller.asset.verification.action({ ...action, action: "checkout" })
        ).rejects.toThrow("Only Available");
      }
      expect(await db.select().from(assetAssignments)).toHaveLength(1);
    });
    it("serializes simultaneous checkouts so only one assignment succeeds", async () => {
      const results = await Promise.allSettled([
        caller.asset.verification.action({ ...action, action: "checkout" }),
        caller.asset.verification.action({ ...action, action: "checkout" }),
      ]);
      expect(
        results.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(await db.select().from(assetAssignments)).toHaveLength(1);
    });
    it("records damage photos, operational Damaged status, audit and admin attention", async () => {
      await expect(
        caller.asset.publicReportDamage({
          token: input.token,
          reportedBy: input.employeeName,
          description: action.description,
          severity: "damaged",
          photos: [],
        })
      ).rejects.toThrow();
      await caller.asset.publicReportDamage({
        token: input.token,
        reportedBy: input.employeeName,
        description: action.description,
        severity: "damaged",
        photos: action.photos,
      });
      expect((await db.select().from(assets))[0].status).toBe("damaged");
      expect((await db.select().from(assetTransactions))[0]).toMatchObject({
        type: "damage",
        damageDescription: action.description,
      });
      expect(await db.select().from(assetDocuments)).toHaveLength(1);
      expect(await db.select().from(notificationEvents)).toHaveLength(1);
      expect(
        await db.select().from(auditLogs).where(eq(auditLogs.action, "damage"))
      ).toHaveLength(1);
      expect(
        (await caller.asset.verification.summary({ assetId })).status
      ).toBe("Pending");
    });
    it("rejects inactive QR identities without creating records", async () => {
      await db
        .update(qrCodes)
        .set({ isActive: 0 })
        .where(eq(qrCodes.assetId, assetId));
      await expect(caller.asset.verification.submit(input)).rejects.toThrow();
      expect(await db.select().from(assetEvents)).toHaveLength(0);
      expect(await db.select().from(assetDocuments)).toHaveLength(0);
    });
    it("rolls back uploaded documents if the verification event cannot be stored", async () => {
      await db.execute(
        sql.raw(
          "CREATE TRIGGER reject_verification BEFORE INSERT ON asset_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Intentional test failure'"
        )
      );
      try {
        await expect(caller.asset.verification.submit(input)).rejects.toThrow();
        expect(await db.select().from(assetDocuments)).toHaveLength(0);
        expect(
          await db
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.action, "physical_verification"))
        ).toHaveLength(0);
      } finally {
        await db.execute(sql.raw("DROP TRIGGER reject_verification"));
      }
    });
  }
);
