import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPhysicalVerificationXlsx } from "./physicalVerificationXlsx";
import type { VerificationRow } from "@shared/physicalVerification";

describe("Physical Verification Excel report", () => {
  it("reopens actual XLSX bytes and preserves manual values, status, photos and pending records", () => {
    const row: VerificationRow = {
      id: 1,
      assetDbId: 1,
      assetCode: "0000123",
      assetName: "Laptop",
      category: "IT",
      status: "Flagged",
      employeeName: "Manual Name",
      employeeCode: "000007",
      date: "2026-11-16",
      time: "09:05",
      location: "Other Store",
      registeredLocation: "Main Store",
      condition: "fair",
      remarks: "=SUM(A1:A2)",
      photos: [
        { id: 12, name: "proof.jpg", dataUrl: "data:image/jpeg;base64,test" },
      ],
      latestVerificationDate: "2026-10-02 10:00",
      review: "Movement confirmed",
    };
    const bytes = buildPhysicalVerificationXlsx(
      [
        row,
        {
          ...row,
          id: null,
          assetCode: "PENDING",
          status: "Pending",
          employeeName: "",
          employeeCode: "",
          date: "",
          time: "",
          location: "",
          photos: [],
        },
      ],
      "November cycle",
      "https://assets.example"
    );
    const book = XLSX.read(bytes, { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    const cells = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(cells[0]).toEqual([
      "Physical Verification Report",
      "November cycle",
    ]);
    expect(cells[2]).toEqual([
      "0000123",
      "Laptop",
      "IT",
      "Manual Name",
      "000007",
      "2026-11-16",
      "09:05",
      "Other Store",
      "Main Store",
      "fair",
      "proof.jpg (document 12)",
      "=SUM(A1:A2)",
      "Flagged",
      "2026-10-02 10:00",
      "Movement confirmed",
    ]);
    expect(cells[3][12]).toBe("Pending");
    expect(sheet.L3.f).toBeUndefined();
    expect(sheet.K3.l?.Target).toBe(
      "https://assets.example/audit#verification-1"
    );
    expect(sheet["!autofilter"]?.ref).toBe("A2:O4");
  });
});
