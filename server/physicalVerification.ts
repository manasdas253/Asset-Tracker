import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  appSettings,
  assets,
  qrCodes,
  assetEvents,
  assetDocuments,
  auditLogs,
  notificationEvents,
  assetAssignments,
  assetTransactions,
} from "../drizzle/schema";
import {
  verificationInput,
  verificationDate,
  photoSchema,
  locationsMatch,
  type VerificationRecord,
  type VerificationRow,
} from "../shared/physicalVerification";
import { adminProcedure, router } from "./_core/trpc";
import { requireDb } from "./_core/localAuth";

const cycleKey = "physical_verification_cycle";
async function currentCycle(
  db: Pick<Awaited<ReturnType<typeof requireDb>>, "select">
) {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, cycleKey))
    .limit(1);
  if (setting?.value)
    return JSON.parse(setting.value) as { id: string; name: string };
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  return { id: `annual-${year}`, name: `Calendar year ${year}` };
}
function checkPhotos(photos: z.infer<typeof photoSchema>[]) {
  for (const photo of photos) {
    const bytes = Buffer.from(photo.dataUrl.split(",")[1], "base64");
    const mime = photo.dataUrl.slice(5, photo.dataUrl.indexOf(";"));
    const valid =
      mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid photo content.",
      });
  }
}

export const physicalVerificationRouter = router({
  summary: adminProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const cycle = await currentCycle(db);
      const events = await db
        .select()
        .from(assetEvents)
        .where(
          and(
            eq(assetEvents.assetId, input.assetId),
            eq(assetEvents.eventType, "physical_verification")
          )
        )
        .orderBy(desc(assetEvents.id));
      const records = events.map(
        event => JSON.parse(event.metadata!) as VerificationRecord
      );
      return {
        status:
          records.find(record => record.cycleId === cycle.id)?.status ??
          "Pending",
        latestVerificationDate:
          records
            .filter(record => record.status === "Verified")
            .map(record => `${record.date} ${record.time}`)
            .sort()
            .at(-1) ?? null,
      };
    }),
  submit: adminProcedure
    .input(verificationInput)
    .mutation(async ({ input }) => {
      checkPhotos(input.photos);
      const db = await requireDb();
      return db.transaction(async tx => {
        const [identity] = await tx
          .select()
          .from(qrCodes)
          .where(and(eq(qrCodes.token, input.token), eq(qrCodes.isActive, 1)))
          .limit(1);
        if (!identity)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "QR identity is invalid or inactive.",
          });
        const [asset] = await tx
          .select()
          .from(assets)
          .where(eq(assets.id, identity.assetId))
          .for("update");
        if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
        const cycle = await currentCycle(tx);
        const photoIds: number[] = [];
        for (const photo of input.photos) {
          const result = await tx.insert(assetDocuments).values({
            assetId: asset.id,
            fileName: photo.name,
            fileUrl: photo.dataUrl,
            mimeType: photo.dataUrl.slice(5, photo.dataUrl.indexOf(";")),
          });
          photoIds.push(Number(result[0].insertId));
        }
        const { token, photos, ...manual } = input;
        const status = locationsMatch(input.location, asset.locationName)
          ? "Verified"
          : "Flagged";
        const record: VerificationRecord = {
          ...manual,
          version: 1,
          cycleId: cycle.id,
          assetCode: asset.assetId,
          assetName: asset.name,
          category: asset.categoryName,
          registeredLocation: asset.locationName,
          status,
          photoIds,
        };
        const result = await tx.insert(assetEvents).values({
          assetId: asset.id,
          eventType: "physical_verification",
          title: `Physical verification: ${status}`,
          actorName: input.employeeName,
          description: `${input.employeeName} (${input.employeeCode}) verified at ${input.location} on ${input.date} ${input.time}. ${status === "Flagged" ? "Location mismatch requires admin review." : "Location matched."}`,
          metadata: JSON.stringify(record),
        });
        const id = Number(result[0].insertId);
        await tx.insert(auditLogs).values({
          assetId: asset.id,
          action: "physical_verification",
          entityType: "asset_event",
          entityId: id,
          actorName: input.employeeName,
          afterData: JSON.stringify(record),
        });
        if (status === "Flagged" || input.condition === "damaged")
          await tx.insert(notificationEvents).values({
            assetId: asset.id,
            type: "audit",
            title: "Physical verification requires attention",
            message: `${asset.assetId}: ${status === "Flagged" ? "verification location does not match registered location. " : ""}${input.condition === "damaged" ? "Damaged condition reported." : ""}`,
            severity: "warning",
          });
        // Successful dates are derived from these append-only events; operational state is untouched.
        return { id, status };
      });
    }),
  report: adminProcedure.query(async () => {
    const db = await requireDb();
    const cycle = await currentCycle(db);
    const [assetRows, events, reviews] = await Promise.all([
      db.select().from(assets),
      db
        .select()
        .from(assetEvents)
        .where(eq(assetEvents.eventType, "physical_verification"))
        .orderBy(desc(assetEvents.id)),
      db
        .select()
        .from(assetEvents)
        .where(eq(assetEvents.eventType, "verification_review"))
        .orderBy(desc(assetEvents.id)),
    ]);
    const records = events.map(event => ({
      event,
      record: JSON.parse(event.metadata!) as VerificationRecord,
    }));
    const ids = records.flatMap(({ record }) => record.photoIds);
    const documents = ids.length
      ? await db
          .select()
          .from(assetDocuments)
          .where(inArray(assetDocuments.id, ids))
      : [];
    const rows: VerificationRow[] = [];
    const allHistory: VerificationRow[] = [];
    for (const asset of assetRows) {
      const history = records.filter(({ event }) => event.assetId === asset.id);
      const latestVerificationDate =
        history
          .filter(({ record }) => record.status === "Verified")
          .map(({ record }) => `${record.date} ${record.time}`)
          .sort()
          .at(-1) ?? "";
      const current = history.filter(
        ({ record }) => record.cycleId === cycle.id
      );
      if (!current.length)
        rows.push({
          id: null,
          assetDbId: asset.id,
          assetCode: asset.assetId,
          assetName: asset.name,
          category: asset.categoryName,
          status: "Pending",
          employeeName: "",
          employeeCode: "",
          date: "",
          time: "",
          location: "",
          registeredLocation: asset.locationName,
          condition: "",
          remarks: "",
          photos: [],
          latestVerificationDate,
          review: "",
        });
      for (const { event, record } of history) {
        const review = reviews.find(
          item => JSON.parse(item.metadata!).verificationId === event.id
        );
        const row: VerificationRow = {
          ...record,
          id: event.id,
          assetDbId: asset.id,
          remarks: record.remarks ?? "",
          latestVerificationDate,
          review: review?.description ?? "",
          photos: record.photoIds.flatMap(id => {
            const photo = documents.find(item => item.id === id);
            return photo
              ? [{ id, name: photo.fileName, dataUrl: photo.fileUrl }]
              : [];
          }),
        };
        allHistory.push(row);
        if (record.cycleId === cycle.id) rows.push(row);
      }
    }
    return { cycle, rows, history: allHistory };
  }),
  startCycle: adminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const cycle = { id: nanoid(), name: input.name };
      await db.transaction(async tx => {
        await tx
          .insert(appSettings)
          .values({ key: cycleKey, value: JSON.stringify(cycle) })
          .onDuplicateKeyUpdate({ set: { value: JSON.stringify(cycle) } });
        await tx.insert(auditLogs).values({
          action: "verification_cycle_started",
          entityType: "app_setting",
          afterData: JSON.stringify(cycle),
        });
      });
      return cycle;
    }),
  review: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        notes: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      await db.transaction(async tx => {
        const [record] = await tx
          .select()
          .from(assetEvents)
          .where(
            and(
              eq(assetEvents.id, input.id),
              eq(assetEvents.eventType, "physical_verification")
            )
          )
          .limit(1);
        if (
          !record ||
          (JSON.parse(record.metadata!) as VerificationRecord).status !==
            "Flagged"
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Select a flagged verification.",
          });
        await tx.insert(assetEvents).values({
          assetId: record.assetId,
          eventType: "verification_review",
          title: "Verification mismatch reviewed",
          description: input.notes,
          actorName: ctx.user.name,
          metadata: JSON.stringify({ verificationId: input.id }),
        });
        await tx.insert(auditLogs).values({
          assetId: record.assetId,
          action: "verification_review",
          entityType: "asset_event",
          entityId: input.id,
          actorName: ctx.user.name,
          reason: input.notes,
        });
      });
    }),
  // These actions belong to the scanned-asset workflow and retain the existing Admin access.
  action: adminProcedure
    .input(
      z
        .object({
          token: z.string().trim().min(8).max(96),
          action: z.enum(["checkout", "damage"]),
          employeeName: z.string().trim().min(1).max(160),
          employeeCode: z.string().trim().max(80),
          purpose: z.string().trim().max(220),
          expectedReturnDate: z.string(),
          description: z.string().trim().max(2000),
          photos: z.array(photoSchema).max(4),
          notes: z.string().trim().max(2000).optional(),
          departmentName: z.string().trim().max(120).optional(),
          locationName: z.string().trim().max(160).optional(),
          condition: z
            .enum(["new", "good", "fair", "damaged", "critical"])
            .optional(),
          severity: z.enum(["damaged", "critical"]).optional(),
        })
        .superRefine((value, ctx) => {
          if (
            value.action === "checkout" &&
            (!value.purpose ||
              !verificationDate.safeParse(value.expectedReturnDate).success)
          )
            ctx.addIssue({
              code: "custom",
              message: "Purpose and valid expected return date are required.",
            });
          if (
            value.action === "damage" &&
            (!value.description || !value.photos.length)
          )
            ctx.addIssue({
              code: "custom",
              message: "Damage description and supporting photos are required.",
            });
        })
    )
    .mutation(async ({ input }) => {
      checkPhotos(input.photos);
      const db = await requireDb();
      return db.transaction(async tx => {
        const [qr] = await tx
          .select()
          .from(qrCodes)
          .where(and(eq(qrCodes.token, input.token), eq(qrCodes.isActive, 1)))
          .limit(1);
        if (!qr) throw new TRPCError({ code: "NOT_FOUND" });
        const [asset] = await tx
          .select()
          .from(assets)
          .where(eq(assets.id, qr.assetId))
          .for("update");
        if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.action === "checkout" && asset.status !== "available")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only Available assets can be checked out.",
          });
        const now = new Date();
        const status = input.action === "checkout" ? "checked_out" : "damaged";
        const photoIds: number[] = [];
        for (const photo of input.photos)
          photoIds.push(
            Number(
              (
                await tx.insert(assetDocuments).values({
                  assetId: asset.id,
                  fileName: photo.name,
                  fileUrl: photo.dataUrl,
                  mimeType: photo.dataUrl.slice(5, photo.dataUrl.indexOf(";")),
                })
              )[0].insertId
            )
          );
        if (input.action === "checkout") {
          const expectedReturnDate = new Date(
            `${input.expectedReturnDate}T00:00:00Z`
          );
          await tx.insert(assetAssignments).values({
            assetId: asset.id,
            employeeName: input.employeeName,
            employeeCode: input.employeeCode,
            purpose: input.purpose,
            expectedReturnDate,
            checkedOutAt: now,
            notes: input.notes,
            departmentName: input.departmentName,
            locationName: input.locationName,
          });
          await tx
            .update(assets)
            .set({
              status,
              assignedEmployeeName: input.employeeName,
              assignedEmployeeCode: input.employeeCode,
              assignedAt: now,
              expectedReturnDate,
              lastCheckoutAt: now,
              lastActivityAt: now,
              departmentName: input.departmentName || asset.departmentName,
              locationName: input.locationName || asset.locationName,
              condition: input.condition ?? asset.condition,
            })
            .where(eq(assets.id, asset.id));
        } else {
          await tx
            .update(assets)
            .set({
              status,
              condition: input.severity ?? "damaged",
              lastActivityAt: now,
            })
            .where(eq(assets.id, asset.id));
          await tx.insert(notificationEvents).values({
            assetId: asset.id,
            type: "approval",
            title: "Asset reported damaged",
            message: `${asset.assetId}: ${input.description}`,
            severity: "critical",
          });
        }
        await tx.insert(assetTransactions).values({
          assetId: asset.id,
          type: input.action === "checkout" ? "checkout" : "damage",
          actorName: input.employeeName,
          fromLocation: asset.locationName,
          toLocation: input.locationName || asset.locationName,
          toEmployee:
            input.action === "checkout" ? input.employeeName : undefined,
          condition:
            input.action === "checkout"
              ? (input.condition ?? asset.condition)
              : (input.severity ?? "damaged"),
          purpose: input.purpose || undefined,
          damageDescription: input.description || undefined,
          notes: input.notes,
          occurredAt: now,
        });
        const metadata = JSON.stringify({
          ...input,
          token: undefined,
          photos: undefined,
          photoIds,
        });
        await tx.insert(assetEvents).values({
          assetId: asset.id,
          eventType: input.action === "checkout" ? "checkout" : "damage_report",
          title:
            input.action === "checkout"
              ? "Asset checked out"
              : "Asset reported damaged",
          actorName: input.employeeName,
          description:
            input.action === "checkout" ? input.purpose : input.description,
          metadata,
          occurredAt: now,
        });
        await tx.insert(auditLogs).values({
          assetId: asset.id,
          action: input.action,
          entityType: "asset",
          entityId: asset.id,
          actorName: input.employeeName,
          beforeData: JSON.stringify({ status: asset.status }),
          afterData: metadata,
        });
        return { status, assetId: asset.id };
      });
    }),
});
