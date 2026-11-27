import { useState } from "react";
import * as XLSX from "xlsx";
import { Link } from "wouter";
import { ArrowLeft, Download, FileUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const fields = [
  ["Asset name", "name"], ["Asset ID", "assetId"], ["Sub Asset ID", "subAssetId"], ["Category", "categoryName"], ["Subcategory", "subcategory"], ["Asset type", "assetType"], ["Serial number", "serialNumber"], ["Brand", "brand"], ["Model", "model"], ["Purchase date", "purchaseDate"], ["Purchase cost (INR ₹)", "purchaseCost"], ["Vendor / supplier", "vendor"], ["Warranty expiry", "warrantyExpiryDate"], ["Department", "departmentName"], ["Location", "locationName"], ["Condition", "condition"], ["Lifecycle status", "status"], ["Notes", "notes"],
] as const;
type Row = Record<string, string>;

export function BulkUploadPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [checks, setChecks] = useState<{ rowNumber: number; valid: boolean; errors: string[] }[]>([]);
  const [failures, setFailures] = useState<{ rowNumber: number; message: string }[]>([]);
  const [finished, setFinished] = useState(false);
  const validate = trpc.asset.bulkValidate.useMutation({ onSuccess: result => { setChecks(result); toast.success(`${result.filter(row => row.valid).length} valid rows · ${result.filter(row => !row.valid).length} rows with errors`); }, onError: error => toast.error(error.message) });
  const create = trpc.asset.bulkCreate.useMutation({ onSuccess: result => { setFailures(result.failures); setFinished(true); toast.success(`${result.successfulRows} imported · ${result.failedRows} failed`); }, onError: error => toast.error(error.message) });
  const loadFile = async (file: File) => {
    setFileName(file.name); setRows([]); setChecks([]); setFailures([]); setFinished(false);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "", raw: true });
      const values = source.map(record => {
        const row: Row = {};
        for (const [label, key] of fields) {
          const header = Object.keys(record).find(candidate => candidate.trim().toLowerCase() === label.toLowerCase());
          const value = header ? record[header] : "";
          if (value !== "" && value != null) {
            if ((key === "purchaseDate" || key === "warrantyExpiryDate") && value instanceof Date) row[key] = value.toISOString().slice(0, 10);
            else if ((key === "purchaseDate" || key === "warrantyExpiryDate") && typeof value === "number") { const date = XLSX.SSF.parse_date_code(value); row[key] = date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : String(value); }
            else row[key] = String(value).trim();
          }
        }
        row.categoryName ||= "Computers"; row.assetType ||= "Laptop"; row.condition ||= "good"; row.status ||= "available";
        return row;
      });
      setRows(values);
      if (!values.length) toast.error("The selected file contains no asset rows.");
    } catch { toast.error("Could not read this file. Please use .xlsx, .xls, or .csv."); }
  };
  const template = () => {
    const sheet = XLSX.utils.aoa_to_sheet([fields.map(([label]) => label)]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Asset Master"); XLSX.writeFile(book, "asset-master-template.xlsx");
  };
  const errorReport = () => {
    const rejected = [...checks.flatMap((check, index) => check.valid ? [] : [{ rowNumber: check.rowNumber, message: check.errors.join("; ") }]), ...failures];
    const data = rejected.map(failure => ({ "Row number": failure.rowNumber, Error: failure.message, "Asset name": rows[failure.rowNumber - 2]?.name ?? "", "Asset ID": rows[failure.rowNumber - 2]?.assetId ?? "", "Sub Asset ID": rows[failure.rowNumber - 2]?.subAssetId ?? "" }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), "Failed rows"); XLSX.writeFile(book, "asset-import-errors.xlsx");
  };
  const validRows = rows.flatMap((row, index) => checks[index]?.valid ? [{ row, rowNumber: index + 2 }] : []);
  return <main className="mx-auto max-w-[1200px] space-y-6 p-5 md:p-8">
    <div className="flex items-center gap-3"><Link href="/assets"><Button variant="outline" size="icon" aria-label="Back to asset register"><ArrowLeft className="h-4 w-4" /></Button></Link><div><p className="text-xs font-bold uppercase tracking-wider text-[#a50f16]">Data operations</p><h1 className="text-2xl font-black">Bulk Upload Asset Master Data</h1><p className="text-sm text-slate-500">Upload, validate, preview, then create assets with persistent QR identities.</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><Card><CardHeader><CardTitle>Upload workflow</CardTitle></CardHeader><CardContent className="space-y-4"><Button variant="outline" className="w-full" onClick={template}><Download className="mr-2 h-4 w-4" />Download Excel template</Button><p className="text-xs leading-5 text-slate-500">The template uses the same fields as Register Asset. Asset name is required. Leave Asset ID blank to generate one. Sub Asset ID is optional (up to 80 characters). Optional blank values use Register Asset defaults.</p><Input type="file" accept=".xlsx,.xls,.csv" onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} /><p className="text-xs text-slate-400">{fileName || "Choose .xlsx, .xls, or .csv"}</p><p className="text-xs text-slate-500">Condition values: new, good, fair, damaged, critical. Status values: available, assigned, checked_out, under_maintenance, lost, damaged, retired, disposed.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Preview & validation</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-xs text-slate-500">{rows.length} rows loaded · showing up to 100 preview rows</p><div className="max-h-[440px] overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="p-2">Row</th><th className="p-2">Asset name</th><th className="p-2">Asset ID</th><th className="p-2">Sub Asset ID</th><th className="p-2">Result</th></tr></thead><tbody>{rows.slice(0, 100).map((row, index) => { const check = checks[index]; return <tr key={index} className={`border-t ${check?.valid === false ? "bg-red-50" : ""}`}><td className="p-2">{index + 2}</td><td className="p-2">{row.name ?? ""}</td><td className="p-2">{row.assetId || "Missing"}</td><td className="p-2">{row.subAssetId || "-"}</td><td className={`p-2 ${check?.valid === false ? "text-red-700" : "text-emerald-700"}`}>{check ? check.valid ? "Valid" : check.errors.join("; ") : "Not validated"}</td></tr>; })}</tbody></table></div><div className="flex flex-wrap gap-2"><Button disabled={!rows.length || validate.isPending || create.isPending} onClick={() => { setChecks([]); validate.mutate({ rows }); }}><FileUp className="mr-2 h-4 w-4" />{validate.isPending ? "Validating…" : "Validate all rows"}</Button><Button variant="outline" disabled={!validRows.length || create.isPending} onClick={() => { setFinished(false); setFailures([]); create.mutate({ fileName, rows: validRows as { row: Row & { name: string; assetId: string }; rowNumber: number }[] }); }}>{create.isPending ? "Importing…" : `Import ${validRows.length} valid rows`}</Button></div>{create.isPending && <div><p className="mb-1 text-xs text-slate-500">Import progress · processing records and generating QR codes</p><div className="h-2 animate-pulse rounded-full bg-[#c5161d]/70" /> </div>}{finished && <p className="text-sm font-semibold">Import complete: {Math.max(0, rows.filter((_, index) => checks[index]?.valid).length - failures.length)} succeeded, {failures.length} failed.</p>}{(failures.length > 0 || checks.some(check => !check.valid)) && <Button variant="outline" onClick={errorReport}><Download className="mr-2 h-4 w-4" />Download failed row report</Button>}</CardContent></Card></div>
  </main>;
}
