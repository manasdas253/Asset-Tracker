import { z } from "zod";

export const verificationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date.");
export const photoSchema = z.object({
  name: z.string().trim().min(1).max(180),
  dataUrl: z
    .string()
    .max(60000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
});
export const verificationInput = z.object({
  token: z.string().trim().min(8).max(96),
  employeeName: z.string().trim().min(1).max(160),
  employeeCode: z.string().trim().min(1).max(80),
  date: verificationDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().min(1).max(160),
  condition: z.enum(["new", "good", "fair", "damaged"]),
  photos: z.array(photoSchema).min(1).max(4),
  remarks: z.string().trim().max(2000).optional(),
});
export type VerificationInput = z.infer<typeof verificationInput>;
export type VerificationRecord = Omit<VerificationInput, "token" | "photos"> & {
  version: 1;
  cycleId: string;
  assetCode: string;
  assetName: string;
  category: string | null;
  registeredLocation: string | null;
  status: "Verified" | "Flagged";
  photoIds: number[];
};
export type VerificationRow = {
  id: number | null;
  assetDbId: number;
  assetCode: string;
  assetName: string;
  category: string | null;
  status: "Verified" | "Flagged" | "Pending";
  employeeName: string;
  employeeCode: string;
  date: string;
  time: string;
  location: string;
  registeredLocation: string | null;
  condition: string;
  remarks: string;
  photos: { id: number; name: string; dataUrl: string }[];
  latestVerificationDate: string;
  review: string;
};
export function locationsMatch(actual: string, registered: string | null) {
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("en-IN");
  return (
    Boolean(registered?.trim()) && normalize(actual) === normalize(registered!)
  );
}
