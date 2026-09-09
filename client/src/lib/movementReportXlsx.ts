import * as XLSX from "xlsx";

export type MovementRow = {
  assetId: string;
  assetName: string;
  category: string | null;
  subcategory: string | null;
  assetType: string | null;
  currentStatus: string;
  currentLocation: string | null;
  building: string | null;
  floor: string | null;
  storageLocation: string | null;
  currentAssignee: string | null;
  assigneeCode: string | null;
  department: string | null;
  availability: string;
  checkoutStatus: string;
  serialNumber: string | null;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  modelNumber: string | null;
  sku: string | null;
  barcodeNumber: string | null;
  condition: string;
  lastMovementDate: Date | string | null;
  lastMovementType: string | null | undefined;
  lastUpdatedDate: Date | string | null;
};

const columns: Array<[string, keyof MovementRow, number]> = [
  ["Asset ID / Tag", "assetId", 18], ["Asset Name", "assetName", 28], ["Category", "category", 18], ["Subcategory", "subcategory", 18], ["Asset Type", "assetType", 18],
  ["Current Status", "currentStatus", 18], ["Availability", "availability", 14], ["Checkout Status", "checkoutStatus", 18], ["Current Location", "currentLocation", 22], ["Building", "building", 16], ["Floor", "floor", 12], ["Storage Location", "storageLocation", 20],
  ["Current Assignee", "currentAssignee", 22], ["Assignee ID", "assigneeCode", 16], ["Department", "department", 18], ["Condition", "condition", 14], ["Last Movement Date", "lastMovementDate", 21], ["Last Movement Type", "lastMovementType", 20], ["Last Updated Date", "lastUpdatedDate", 21],
  ["Serial Number", "serialNumber", 20], ["Manufacturer", "manufacturer", 18], ["Brand", "brand", 18], ["Model", "model", 18], ["Model Number", "modelNumber", 18], ["SKU", "sku", 16], ["Barcode", "barcodeNumber", 18],
];

const dateText = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const titleCase = (value: string | null | undefined) => value ? value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "";

/** Creates a standards-compliant Excel workbook, with one row per current asset state. */
export function buildMovementReportXlsx(rows: MovementRow[]) {
  const sheetRows = [
    ["Movement Report — Current Asset State"],
    columns.map(([label]) => label),
    ...rows.map(row => columns.map(([_, key]) => {
      const value = row[key];
      if (key === "lastMovementDate" || key === "lastUpdatedDate") return dateText(value as Date | string | null);
      if (key === "currentStatus" || key === "condition" || key === "lastMovementType") return titleCase(value as string | null);
      return value ?? "";
    })),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
  sheet["!cols"] = columns.map(([_, __, width]) => ({ wch: width }));
  sheet["!autofilter"] = { ref: `A2:${XLSX.utils.encode_col(columns.length - 1)}${Math.max(2, rows.length + 2)}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 2, topLeftCell: "A3", activePane: "bottomLeft", state: "frozen" };

  for (let column = 0; column < columns.length; column += 1) {
    const title = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    const header = sheet[XLSX.utils.encode_cell({ r: 1, c: column })];
    if (title) title.s = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "7F0D12" } }, alignment: { vertical: "center" } };
    if (header) header.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "7F0D12" } }, alignment: { vertical: "center", wrapText: true } };
  }
  sheet["!rows"] = [{ hpt: 28 }, { hpt: 24 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Current Movement");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
}

export function downloadMovementReportXlsx(rows: MovementRow[]) {
  const file = new Blob([buildMovementReportXlsx(rows)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "assettrack-movement-report.xlsx";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
