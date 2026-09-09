import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildMovementReportXlsx } from "./movementReportXlsx";

describe("Movement Report workbook", () => {
  it("creates a valid Excel workbook containing the current asset row", () => {
    const bytes = buildMovementReportXlsx([{
      assetId: "AST-000001", assetName: "Engineering laptop", category: "IT", subcategory: null, assetType: "Laptop",
      currentStatus: "checked_out", currentLocation: "Hyderabad", building: null, floor: null, storageLocation: null,
      currentAssignee: "Manas", assigneeCode: "EMP-001", department: "IT", availability: "Unavailable", checkoutStatus: "Checked out",
      serialNumber: "SN-001", manufacturer: "Dell", brand: "Dell", model: "Latitude", modelNumber: null, sku: null, barcodeNumber: null,
      condition: "good", lastMovementDate: "2026-09-08T09:00:00.000Z", lastMovementType: "checkout", lastUpdatedDate: "2026-09-08T09:00:00.000Z",
    }]);
    const workbook = XLSX.read(bytes, { type: "array" });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Current Movement"], { header: 1 });

    expect(workbook.SheetNames).toEqual(["Current Movement"]);
    expect(rows[1]).toContain("Asset ID / Tag");
    expect(rows[2]).toContain("AST-000001");
    expect(rows[2]).toContain("Manas");
  });
});
