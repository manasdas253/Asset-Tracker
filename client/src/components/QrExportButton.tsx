import React, { useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildQrExportArchive, collectQrExport, downloadBytes, exportFileName, type QrExportFilters } from "@/lib/qrExport";

type Props = {
  filters?: QrExportFilters;
  label?: string;
  className?: string;
};

/**
 * Downloads every QR code matching the filters as one ZIP:
 * qr/<Asset ID>.png for each asset plus an index.csv.
 */
export function QrExportButton({ filters = {}, label = "Export QR (ZIP)", className }: Props) {
  const utils = trpc.useUtils();
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);

  const run = async () => {
    if (progress) return;
    setProgress({ fetched: 0, total: 0 });
    try {
      const records = await collectQrExport(
        input => utils.asset.qrExport.fetch(input, { staleTime: 0 }),
        filters,
        setProgress,
      );
      if (!records.length) {
        toast.error("No assets match the current filters. Nothing was exported.");
        return;
      }
      const result = buildQrExportArchive(records, exportFileName(filters));
      downloadBytes(result.zip, result.fileName);
      toast.success(
        `Exported ${result.exported.toLocaleString("en-IN")} QR codes${result.missing ? ` (${result.missing} assets have no QR code yet; listed in index.csv)` : ""}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? `QR export failed: ${error.message}` : "QR export failed. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const busyText = progress
    ? progress.total
      ? `Preparing ${progress.fetched.toLocaleString("en-IN")} / ${progress.total.toLocaleString("en-IN")}…`
      : "Preparing…"
    : label;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={run}
      disabled={Boolean(progress)}
      aria-busy={Boolean(progress)}
      className={className ?? "rounded-xl border-slate-200 bg-white"}
    >
      {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
      {busyText}
    </Button>
  );
}
