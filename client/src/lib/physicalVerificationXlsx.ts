import * as XLSX from "xlsx";
import type { VerificationRow } from "@shared/physicalVerification";

export function buildPhysicalVerificationXlsx(
  rows: VerificationRow[],
  cycle: string,
  appOrigin?: string
) {
  const columns = [
    "Asset ID",
    "Asset Name",
    "Category",
    "Verified By",
    "Employee ID",
    "Verification Date",
    "Verification Time",
    "Verification Location",
    "Registered Location",
    "Asset Condition",
    "Photos",
    "Remarks",
    "Verification Status",
    "Latest Verification Date",
    "Admin Review",
  ];
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Physical Verification Report", cycle],
    columns,
    ...rows.map(row => [
      row.assetCode,
      row.assetName,
      row.category ?? "",
      row.employeeName,
      row.employeeCode,
      row.date,
      row.time,
      row.location,
      row.registeredLocation ?? "",
      row.condition,
      row.photos
        .map(photo => `${photo.name} (document ${photo.id})`)
        .join("; "),
      row.remarks,
      row.status,
      row.latestVerificationDate,
      row.review,
    ]),
  ]);
  sheet["!cols"] = columns.map(() => ({ wch: 24 }));
  sheet["!autofilter"] = { ref: `A2:O${Math.max(2, rows.length + 2)}` };
  rows.forEach((row, index) => {
    if (appOrigin && row.id && row.photos.length)
      sheet[`K${index + 3}`].l = {
        Target: `${appOrigin}/audit#verification-${row.id}`,
        Tooltip: "Open photos in the Physical Verification log",
      };
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Physical Verification");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
export function downloadPhysicalVerificationXlsx(
  rows: VerificationRow[],
  cycle: string
) {
  const url = URL.createObjectURL(
    new Blob(
      [buildPhysicalVerificationXlsx(rows, cycle, window.location.origin)],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    )
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "physical-verification-report.xlsx";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
