import { PhysicalVerificationPanel } from "@/components/PhysicalVerificationPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  FileBarChart,
  FileUp,
  Filter,
  History,
  MapPin,
  Package,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { QrExportButton } from "@/components/QrExportButton";
import { formatINR, formatINRForExport } from "@/lib/currency";
import { downloadMovementReportXlsx, type MovementRow } from "@/lib/movementReportXlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AssetQrLabel, buildQrLabelDocument, printQrLabelDocument, qrLabelStyles, type LabelSize } from "@/lib/qrLabels";

const inputClass =
  "h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none focus:border-[#7dcac4] focus:ring-[#ccebe7]";
const statusLabel: Record<string, string> = {
  available: "Available",
  assigned: "Assigned",
  checked_out: "Checked out",
  under_maintenance: "Under maintenance",
  lost: "Lost",
  damaged: "Damaged",
  retired: "Retired",
  disposed: "Disposed",
};
const statusStyle: Record<string, string> = {
  available: "bg-[#e8f8f2] text-[#128564] border-[#bfe8d8]",
  assigned: "bg-[#eaf4fb] text-[#2476a6] border-[#c7e0f0]",
  checked_out: "bg-[#f0edff] text-[#6c58d8] border-[#d9d1ff]",
  under_maintenance: "bg-[#fff7df] text-[#aa7813] border-[#f1dfa6]",
  lost: "bg-[#fff0ed] text-[#d76554] border-[#f3c9c1]",
  damaged: "bg-[#fff0ed] text-[#d76554] border-[#f3c9c1]",
};

export function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera scanner…");
  const [manual, setManual] = useState("");
  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    const start = async () => {
      if (
        !("BarcodeDetector" in window) ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatus(
          "Camera scanning is not supported in this browser. Use the manual QR token field below."
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Detector = (
          window as Window & {
            BarcodeDetector?: new (options?: { formats: string[] }) => {
              detect: (
                source: HTMLVideoElement
              ) => Promise<{ rawValue?: string }[]>;
            };
          }
        ).BarcodeDetector;
        if (!Detector) return;
        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!active || !videoRef.current) return;
          try {
            const result = await detector.detect(videoRef.current);
            const value = result[0]?.rawValue;
            if (value) {
              const token =
                value.match(/\/asset\/([^/?#]+)/)?.[1] ?? value.trim();
              window.location.assign(`/asset/${encodeURIComponent(token)}`);
              return;
            }
          } catch {
            /* camera frames can fail while autofocus settles */
          }
          requestAnimationFrame(scan);
        };
        setStatus("Point the camera at an AssetTrack QR label.");
        requestAnimationFrame(scan);
      } catch {
        setStatus(
          "Camera access was blocked. Use the manual QR token field below or allow camera access in browser settings."
        );
      }
    };
    void start();
    return () => {
      active = false;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);
  const openManual = (event: React.FormEvent) => {
    event.preventDefault();
    const token =
      manual.trim().match(/\/asset\/([^/?#]+)/)?.[1] ?? manual.trim();
    if (token) window.location.assign(`/asset/${encodeURIComponent(token)}`);
  };
  return (
    <ModuleShell
      eyebrow="Field tools"
      title="Scan an asset QR"
      description="Use a phone camera to open the authorized asset page, or paste a QR token when camera access is unavailable."
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden rounded-[22px] border-slate-200/80">
          <CardContent className="p-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#111418]">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-[#9be3dc]/75" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#9be3dc]/50" />
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-[#092d40]/85 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                {status}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[22px] border-slate-200/80">
          <CardHeader className="px-6 pb-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7e8e9] text-[#c5161d]">
              <Camera className="h-5 w-5" />
            </div>
            <CardTitle className="mt-4 text-base font-black">
              Manual QR token
            </CardTitle>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Paste a token such as QR-QVIAHXICM4VGLY4P or a full AssetTrack
              public URL.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={openManual} className="space-y-3">
              <Input
                className={inputClass}
                value={manual}
                onChange={event => setManual(event.target.value)}
                placeholder="QR-…"
              />
              <Button
                type="submit"
                className="w-full rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12]"
              >
                Open public asset page
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ModuleShell>
  );
}

export function LifecyclePage() {
  const activity = trpc.asset.activity.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const dashboard = trpc.asset.dashboard.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const items = activity.data ?? [];
  return (
    <ModuleShell
      eyebrow="Operations"
      title="Lifecycle control"
      description="A live movement stream for check-outs, returns, transfers, damage, and maintenance events."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric
          label="Checked out"
          value={dashboard.data?.kpis.checkedOut ?? 0}
          color="purple"
        />
        <MiniMetric
          label="Under maintenance"
          value={dashboard.data?.kpis.underMaintenance ?? 0}
          color="amber"
        />
        <MiniMetric
          label="Lost / damaged"
          value={
            (dashboard.data?.kpis.lost ?? 0) +
            (dashboard.data?.kpis.damaged ?? 0)
          }
          color="coral"
        />
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Movement timeline
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Server-recorded events · refreshes automatically
            </p>
          </div>
          <RefreshCw
            className={`h-4 w-4 text-[#c5161d] ${activity.isFetching ? "animate-spin" : ""}`}
          />
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {items.length ? (
            <div className="space-y-1">
              {items.map((item, index) => (
                <div
                  key={item.event.id}
                  className="flex gap-4 border-b border-slate-100 py-4 last:border-0"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index % 2 ? "bg-[#f0edff] text-[#7661ea]" : "bg-[#f7e8e9] text-[#c5161d]"}`}
                  >
                    <History className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col justify-between gap-1 sm:flex-row">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {item.event.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.event.description}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                        {formatDateTime(item.event.occurredAt)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-400">
                      <span className="font-mono text-[#a50f16]">
                        {item.asset?.assetId ?? "Asset"}
                      </span>
                      <span>
                        {item.event.actorName ?? "Workspace operator"}
                      </span>
                      <span>
                        {item.asset?.locationName ?? "Location pending"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No lifecycle events yet"
              text="Register an asset or load the clearly marked demo workspace to begin the movement trail."
            />
          )}
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function MaintenancePage() {
  const dashboard = trpc.asset.dashboard.useQuery();
  const assets = trpc.asset.list.useQuery({
    page: 1,
    pageSize: 100,
    status: "all",
    category: "all",
    department: "all",
    location: "all",
  });
  const attention = (assets.data?.rows ?? []).filter(
    row => row.status === "under_maintenance" || row.warrantyExpiryDate
  );
  return (
    <ModuleShell
      eyebrow="Operations"
      title="Maintenance & warranty"
      description="Keep service work and coverage windows visible before they become interruptions."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniMetric
          label="Maintenance due"
          value={dashboard.data?.kpis.maintenanceDue ?? 0}
          color="amber"
        />
        <MiniMetric
          label="Warranty expiring"
          value={dashboard.data?.kpis.dueWarranty ?? 0}
          color="coral"
        />
        <MiniMetric
          label="Under maintenance"
          value={dashboard.data?.kpis.underMaintenance ?? 0}
          color="purple"
        />
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Attention queue
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Assets requiring a maintenance or warranty decision
            </p>
          </div>
          <Wrench className="h-4 w-4 text-[#c5161d]" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="divide-y divide-slate-100">
            {attention.map(row => (
              <Link
                key={row.id}
                href={`/assets/${row.id}`}
                className="flex items-center gap-4 px-6 py-4 transition hover:bg-[#fbfefe]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff7df] text-[#aa7813]">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {row.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {row.assetId} · {row.locationName ?? "Location pending"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-600">
                    {row.status === "under_maintenance"
                      ? "In service"
                      : "Warranty"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatDate(row.warrantyExpiryDate)}
                  </p>
                </div>
              </Link>
            ))}
            {!attention.length && (
              <div className="p-12">
                <EmptyState
                  icon={Wrench}
                  title="Maintenance queue is clear"
                  text="Maintenance records and warranty alerts will appear here as the register grows."
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function QrLabelsPage() {
  const assets = trpc.asset.list.useQuery({
    page: 1,
    pageSize: 100,
    status: "all",
    category: "all",
    department: "all",
    location: "all",
  });
  const [selected, setSelected] = useState<number[]>(() =>
    (new URLSearchParams(window.location.search).get("ids") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite)
  );
  const rows = assets.data?.rows ?? [];
  const [labelSize, setLabelSize] = useState<LabelSize>("standard");
  const sheet = trpc.asset.qrSheet.useQuery(
    { ids: selected },
    { enabled: selected.length > 0 }
  );
  const toggle = (id: number) =>
    setSelected(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : [...current, id]
    );
  const ready = selected.length > 0 && !sheet.isFetching && !sheet.isError && sheet.data?.length === selected.length && sheet.data.every(item => item.qr?.qrDataUrl);
  const labelDocument = () => buildQrLabelDocument(sheet.data ?? [], labelSize, window.location.origin);
  const print = () => {
    if (!ready) return toast.error("Wait for all selected QR labels to load");
    void printQrLabelDocument(labelDocument());
  };
  const downloadSheet = () => {
    if (!ready) return toast.error("Wait for all selected QR labels to load");
    download(labelDocument(), `iims-${labelSize}-labels.html`, "text/html");
    toast.success("Print-ready labels downloaded. Open the file and print at 100% scale.");
  };
  return (
    <ModuleShell
      eyebrow="Identity"
      title="QR label studio"
      description="Select assets, preview branded labels, and print persistent QR identities for physical tagging."
    >
      <style>{qrLabelStyles}</style>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="label-size">Label size</Label>
        <select id="label-size" className={`${inputClass} px-3`} value={labelSize} onChange={event => setLabelSize(event.target.value as LabelSize)}>
          <option value="standard">Standard (60 x 40 mm)</option>
          <option value="compact">Compact (35 x 35 mm)</option>
        </select>
        <p className="text-xs text-slate-500">Print at 100% scale with background graphics enabled.</p>
      </div>
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#bde5e1] bg-[#fbf1f1] p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <QrCode className="mt-0.5 h-5 w-5 text-[#c5161d]" />
          <div>
            <p className="text-sm font-black text-slate-800">
              {selected.length} labels selected
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Each label keeps its URL even as asset details change.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-[#e7bfc2] bg-white text-xs font-bold text-[#a50f16]"
            onClick={() =>
              setSelected(
                selected.length === rows.length ? [] : rows.map(row => row.id)
              )
            }
          >
            {selected.length === rows.length ? "Clear all" : "Select all"}
          </Button>
          <QrExportButton label="Export all QR (ZIP)" className="rounded-xl border-[#e7bfc2] bg-white text-xs font-bold text-[#a50f16]" />
          <Button
            onClick={print}
            disabled={!ready}
            className="rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12]"
          >
            <Printer className="mr-2 h-4 w-4" /> Print sheet
          </Button>
          <Button
            variant="outline"
            onClick={downloadSheet}
            disabled={!ready}
            className="rounded-xl border-[#e7bfc2] bg-white text-xs font-bold text-[#a50f16]"
          >
            <Download className="mr-2 h-4 w-4" />{" "}
            {sheet.isLoading ? "Preparing…" : "Download sheet"}
          </Button>
        </div>
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Choose assets
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              {rows.length} QR identities available from the register
            </p>
          </div>
          <Link href="/assets">
            <Button
              variant="ghost"
              className="text-xs font-bold text-[#a50f16]"
            >
              Open registry
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(row => (
            <button
              type="button"
              key={row.id}
              onClick={() => toggle(row.id)}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${selected.includes(row.id) ? "border-[#70c8c1] bg-[#fbf1f1]" : "border-slate-200 bg-white hover:border-[#e7bfc2]"}`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected.includes(row.id) ? "border-[#c5161d] bg-[#c5161d] text-white" : "border-slate-300 text-transparent"}`}
              >
                <span className="text-xs">✓</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">
                  {row.name}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {row.assetId}
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {row.locationName ?? "Unassigned"}
                </p>
              </div>
            </button>
          ))}
          {!rows.length && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState
                icon={QrCode}
                title="No QR identities available"
                text="Register an asset first, then its persistent QR identity will appear here."
              />
            </div>
          )}
        </CardContent>
      </Card>
      {sheet.isError && <p role="alert" className="text-sm text-red-700">Could not load labels. <Button variant="outline" onClick={() => sheet.refetch()}>Try again</Button></p>}
      <div className="flex flex-wrap gap-4">
        {sheet.data?.map(item => <div key={item.asset.id} className="max-w-full space-y-2 overflow-x-auto"><AssetQrLabel {...item} size={labelSize} />{item.qr?.qrDataUrl && <Button asChild variant="outline" className="rounded-xl"><a href={item.qr.qrDataUrl} download={`${item.asset.assetId}-qr.png`}>Download QR</a></Button>}</div>)}
      </div>
    </ModuleShell>
  );
}

export function ReportsPage() {
  const dashboard = trpc.asset.dashboard.useQuery();
  const catalog = trpc.asset.catalog.useQuery();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const list = trpc.asset.list.useQuery({
    page: 1,
    pageSize: 100,
    status: statusFilter,
    category: categoryFilter,
    department: "all",
    location: "all",
  });
  const utils = trpc.useUtils();
  const kpis = dashboard.data?.kpis;
  const currentRegisterRows = list.data?.rows ?? [];
  const movementRowsFromRegister = (): MovementRow[] => currentRegisterRows.map(row => {
    const movements = [
      { date: row.assignedAt, type: "assignment" },
      { date: row.lastCheckoutAt, type: "checkout" },
      { date: row.lastCheckinAt, type: "checkin" },
    ].filter((movement): movement is { date: Date; type: string } => Boolean(movement.date));
    const latestMovement = movements.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
    return {
      assetId: row.assetId, assetName: row.name, category: row.categoryName, subcategory: row.subcategory, assetType: row.assetType,
      currentStatus: row.status, currentLocation: row.locationName, building: row.building, floor: row.floor, storageLocation: row.storageLocation,
      currentAssignee: row.assignedEmployeeName, assigneeCode: row.assignedEmployeeCode, department: row.departmentName,
      availability: row.status === "available" ? "Available" : "Unavailable", checkoutStatus: row.status === "checked_out" ? "Checked out" : "Not checked out",
      serialNumber: row.serialNumber, manufacturer: row.manufacturer, brand: row.brand, model: row.model, modelNumber: row.modelNumber, sku: row.sku, barcodeNumber: row.barcodeNumber,
      condition: row.condition, lastMovementDate: latestMovement?.date ?? null, lastMovementType: latestMovement?.type, lastUpdatedDate: row.updatedAt,
    };
  });
  const exportMovementReport = async () => {
    try {
      // Fetch on demand so the exported snapshot always reflects the database
      // at the moment Download Excel is selected, rather than a stale query.
      const rows = await utils.asset.movementReport.fetch({
        status: statusFilter,
        category: categoryFilter,
      });
      if (rows.length) {
        downloadMovementReportXlsx(rows);
        toast.success(`${rows.length} current asset states exported`);
        return;
      }
      const fallbackRows = movementRowsFromRegister();
      if (!fallbackRows.length) {
        toast.error("No assets match the current report filters. No file was downloaded.");
        return;
      }
      downloadMovementReportXlsx(fallbackRows);
      toast.success(`${fallbackRows.length} current asset states exported`);
    } catch (error) {
      const fallbackRows = movementRowsFromRegister();
      if (fallbackRows.length) {
        downloadMovementReportXlsx(fallbackRows);
        toast.success(`${fallbackRows.length} current asset states exported`);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Unable to generate the movement report");
    }
  };
  const exportCsv = () => {
    const rows = list.data?.rows ?? [];
    const header = [
      "Asset ID",
      "Name",
      "Category",
      "Status",
      "Condition",
      "Department",
      "Location",
      "Purchase Cost (INR ₹)",
    ];
    const body = rows.map(row =>
      [
        row.assetId,
        row.name,
        row.categoryName ?? "",
        row.status,
        row.condition,
        row.departmentName ?? "",
        row.locationName ?? "",
        formatINRForExport(row.purchaseCost),
      ]
        .map(csvEscape)
        .join(",")
    );
    download(
      [header.join(","), ...body].join("\n"),
      "asset-register.csv",
      "text/csv"
    );
    toast.success("Asset register exported");
  };
  return (
    <ModuleShell
      eyebrow="Intelligence"
      title="Reports & exports"
      description="Turn live asset records into a clear financial, lifecycle, and accountability view."
    >
      <Card className="rounded-[22px] border-slate-200/80">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className={`${inputClass} px-3`}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabel).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className={`${inputClass} px-3`}
          >
            <option value="all">All categories</option>
            {(catalog.data?.categories ?? []).map(item => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          icon={Package}
          label="Asset register"
          value={`${kpis?.total ?? 0} records`}
        />
        <ReportCard
          icon={UserRound}
          label="Utilization"
          value={`${kpis?.utilization ?? 0}%`}
        />
        <ReportCard
          icon={Wrench}
          label="Maintenance due"
          value={`${kpis?.maintenanceDue ?? 0} assets`}
        />
        <ReportCard
          icon={ShieldAlert}
          label="Portfolio value"
          value={formatINR(kpis?.totalCost ?? 0)}
        />
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Export center
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Exports are generated from current database records.
            </p>
          </div>
          <FileBarChart className="h-4 w-4 text-[#c5161d]" />
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          <ExportAction
            title="Asset register"
            text="All core fields in CSV format"
            icon={Download}
            onClick={exportCsv}
          />
      <ExportAction
        title="Movement report"
        text="Current asset location, status, assignee, and latest movement in Excel"
        icon={History}
        onClick={exportMovementReport}
      />
          <ExportAction
            title="Warranty report"
            text="Coverage windows and attention queue"
            icon={Wrench}
            href="/maintenance"
          />
        </CardContent>
      </Card>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="px-6 pb-3 pt-6">
          <CardTitle className="text-base font-black">
            Lifecycle summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(statusLabel).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <i
                  className={`h-2 w-2 rounded-full ${key === "available" ? "bg-[#16b99a]" : key === "checked_out" ? "bg-[#7c67f2]" : key === "damaged" ? "bg-[#e76f51]" : "bg-[#94a3b8]"}`}
                />
                {label}
              </span>
              <span className="text-sm font-black text-slate-900">
                {(dashboard.data?.status ?? []).find(item => item.key === key)
                  ?.value ?? 0}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function AuditPage() {
  const activity = trpc.asset.activity.useQuery();
  const [activitySearch, setActivitySearch] = useState("");
  const [activityLimit, setActivityLimit] = useState(10);
  const events = (activity.data ?? []).filter(item =>
    `${item.event.title} ${item.event.description ?? ""} ${item.asset?.assetId ?? "GLOBAL"} ${item.event.eventType}`.toLowerCase().includes(activitySearch.toLowerCase())
  );
  return (
    <ModuleShell
      eyebrow="Governance"
      title="Audit & verification"
      description="Verify assets, resolve exceptions, and keep every movement accountable."
    >
      <PhysicalVerificationPanel />
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Asset activity trail
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Every event is written server-side and tied to an asset record.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-[#bde5e1] bg-[#fbf1f1] text-[#a50f16]"
          >
            <History className="mr-1 h-3 w-3" /> Event history
          </Badge>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="relative mb-3 mt-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input aria-label="Search activity trail" className="h-10 rounded-xl pl-10 text-xs shadow-none" placeholder="Search activity, asset ID or event type…" value={activitySearch} onChange={event => { setActivitySearch(event.target.value); setActivityLimit(10); }} />
          </div>
          {activity.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Loading activity trail…</p>}
          {activity.isError && <p role="alert" className="py-6 text-sm text-red-700">Activity could not be loaded. <button type="button" className="underline" onClick={() => void activity.refetch()}>Try again</button></p>}
          {events.slice(0, activityLimit).map(item => (
            <div
              key={item.event.id}
              className="flex gap-4 border-b border-slate-100 py-4 last:border-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f7e8e9] text-[#c5161d]">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-1 sm:flex-row">
                  <p className="text-sm font-bold text-slate-800">
                    {item.event.title}
                  </p>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formatDateTime(item.event.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.event.description}
                </p>
                <p className="mt-2 font-mono text-[10px] font-bold text-[#a50f16]">
                  {item.asset?.assetId ?? "GLOBAL"} · {item.event.eventType}
                </p>
              </div>
            </div>
          ))}
          {!activity.isLoading && !activity.isError && !events.length && (
            <EmptyState
              icon={History}
              title={activitySearch ? "No matching activity" : "No audit events yet"}
              text={activitySearch ? "Try another asset ID or search term." : "The event trail will populate as the workspace is used."}
            />
          )}
          {events.length > activityLimit && <div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">Showing {Math.min(activityLimit, events.length)} of {events.length} events</span><Button variant="outline" onClick={() => setActivityLimit(current => current + 10)}>Show more activity</Button></div>}
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function SettingsPage() {
  const catalog = trpc.asset.catalog.useQuery();
  const save = trpc.asset.saveCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved");
      catalog.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const [kind, setKind] = useState<"category" | "department" | "location">(
    "category"
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [workspaceName, setWorkspaceName] = useState("AssetTrack");
  const [timezone, setTimezone] = useState("UTC");
  const [reminderDays, setReminderDays] = useState("45");
  const [assetPrefix, setAssetPrefix] = useState("AST");
  const saveSetting = trpc.asset.saveSetting.useMutation({
    onSuccess: () => toast.success("Workspace setting saved"),
    onError: error => toast.error(error.message),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate({ kind, name, code: code || undefined });
    setName("");
    setCode("");
  };
  return (
    <ModuleShell
      eyebrow="Configuration"
      title="Workspace settings"
      description="Manage the vocabulary that keeps assets consistent across departments, locations, and categories."
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[22px] border-slate-200/80">
          <CardHeader className="px-6 pb-3 pt-6">
            <CardTitle className="text-base font-black">
              Add configuration
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              Settings are stored as database records and can be extended later.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Configuration type
                </Label>
                <select
                  value={kind}
                  onChange={e => setKind(e.target.value as typeof kind)}
                  className={`${inputClass} w-full px-3`}
                >
                  <option value="category">Category</option>
                  <option value="department">Department</option>
                  <option value="location">Location</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Name
                </Label>
                <Input
                  className={inputClass}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </div>
              {kind === "department" && (
                <div>
                  <Label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Code
                  </Label>
                  <Input
                    className={inputClass}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="ENG"
                  />
                </div>
              )}
              <Button
                type="submit"
                disabled={save.isPending}
                className="w-full rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12]"
              >
                {save.isPending ? "Saving..." : "Save configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="rounded-[22px] border-slate-200/80">
          <CardHeader className="px-6 pb-3 pt-6">
            <CardTitle className="text-base font-black">
              Current vocabulary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-6">
            <ConfigGroup
              title="Categories"
              items={(catalog.data?.categories ?? []).map(item => item.name)}
            />
            <ConfigGroup
              title="Departments"
              items={(catalog.data?.departments ?? []).map(
                item => `${item.name} · ${item.code}`
              )}
            />
            <ConfigGroup
              title="Locations"
              items={(catalog.data?.locations ?? []).map(item => item.name)}
            />
            <ConfigGroup
              title="Statuses"
              items={[
                "Available",
                "Assigned",
                "Checked out",
                "Under maintenance",
                "Lost",
                "Damaged",
                "Retired",
                "Disposed",
              ]}
            />
            <ConfigGroup
              title="Conditions"
              items={["New", "Good", "Fair", "Damaged", "Critical"]}
            />
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardContent className="flex gap-3 p-5">
          <Settings2 className="mt-0.5 h-4 w-4 text-[#c5161d]" />
          <div>
            <p className="text-sm font-bold text-slate-800">
              Future-ready controls
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Branding, date/time, reminder, Asset ID, and label settings are
              modeled as configuration extension points. Authentication and
              authorization remain intentionally disabled in Phase 1.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="px-6 pb-3 pt-6">
          <CardTitle className="text-base font-black">
            Workspace defaults
          </CardTitle>
          <p className="mt-1 text-xs text-slate-400">
            Persisted values for labels, reminders, and future reports.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-600">
              Workspace name
            </Label>
            <Input
              className={inputClass}
              value={workspaceName}
              onChange={event => setWorkspaceName(event.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-600">
              Timezone
            </Label>
            <Input
              className={inputClass}
              value={timezone}
              onChange={event => setTimezone(event.target.value)}
              placeholder="UTC or America/New_York"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-600">
              Warranty reminder days
            </Label>
            <Input
              className={inputClass}
              type="number"
              min="1"
              value={reminderDays}
              onChange={event => setReminderDays(event.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-bold text-slate-600">
              Asset ID prefix
            </Label>
            <Input
              className={inputClass}
              value={assetPrefix}
              onChange={event =>
                setAssetPrefix(event.target.value.toUpperCase())
              }
            />
          </div>
          <Button
            className="rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12] sm:col-span-2"
            disabled={saveSetting.isPending}
            onClick={() => {
              saveSetting.mutate({
                key: "workspace_name",
                value: workspaceName,
              });
              saveSetting.mutate({ key: "timezone", value: timezone });
              saveSetting.mutate({
                key: "warranty_reminder_days",
                value: reminderDays,
              });
              saveSetting.mutate({
                key: "asset_id_prefix",
                value: assetPrefix,
              });
            }}
          >
            Save workspace defaults
          </Button>
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function NotificationsPage() {
  const query = trpc.asset.notifications.useQuery();
  const approvals = trpc.asset.approvalQueue.useQuery();
  const mark = trpc.asset.markNotificationRead.useMutation({
    onSuccess: () => query.refetch(),
  });
  return (
    <ModuleShell
      eyebrow="Workspace"
      title="Notification center"
      description="Stay ahead of warranty, maintenance, audit, and system attention items."
    >
      {approvals.data?.length ? (
        <Card className="rounded-[22px] border-[#f1dfa6] bg-[#fffdf5]">
          <CardHeader className="px-6 pb-3 pt-6">
            <CardTitle className="text-base font-black">
              Approval queue
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Requests requiring an operator review.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-6 pb-6">
            {approvals.data.map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-[#f1dfa6] bg-white p-3"
              >
                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">Alerts</CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              {query.data?.unread ?? 0} unread notification
              {query.data?.unread === 1 ? "" : "s"}
            </p>
          </div>
          <ShieldAlert className="h-4 w-4 text-[#e67261]" />
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          {(query.data?.rows ?? []).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.isRead === 0 && mark.mutate({ id: item.id })}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-[#e7bfc2] ${item.isRead ? "border-slate-200 bg-white" : "border-[#f2d4ce] bg-[#fffaf9]"}`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.severity === "critical" ? "bg-[#fff0ed] text-[#d76554]" : "bg-[#fff7df] text-[#aa7813]"}`}
              >
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.message}
                </p>
                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  {formatDateTime(item.createdAt)} ·{" "}
                  {item.isRead ? "Read" : "Mark read"}
                </p>
              </div>
            </button>
          ))}
          {!query.data?.rows.length && (
            <EmptyState
              icon={ShieldAlert}
              title="No notifications"
              text="New warranty, maintenance, approval, and audit alerts will appear here."
            />
          )}
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function ImportPage() {
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState(
    "Asset Name,Asset ID,Sub Asset ID,Category,Brand,Model,Serial Number,Department,Location,Purchase Cost (INR ₹)\n"
  );
  const [preview, setPreview] = useState<string[][]>([]);
  const history = trpc.asset.importHistory.useQuery();
  const importCsv = trpc.asset.importCsv.useMutation({
    onSuccess: result => {
      toast.success(
        `${result.successfulRows} rows imported · ${result.failedRows} rows rejected`
      );
      setPreview([]);
      history.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const validate = () => {
    const rows = csv
      .trim()
      .split(/\r?\n/)
      .map(row => row.split(","));
    setPreview(rows.slice(0, 6));
    toast.success(`${Math.max(0, rows.length - 1)} rows ready for validation`);
  };
  return (
    <ModuleShell
      eyebrow="Data operations"
      title="Bulk import assets"
      description="Prepare a controlled CSV upload with preview and validation before records enter the register."
    >
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-[22px] border-slate-200/80">
          <CardHeader className="px-6 pb-3 pt-6">
            <CardTitle className="text-base font-black">
              Upload workflow
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              A downloadable instruction template is available as a starting
              point.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl border-slate-200 bg-white"
              onClick={() =>
                download(
                  "Asset Name,Asset ID,Sub Asset ID,Category,Brand,Model,Serial Number,Department,Location,Purchase Cost (INR ₹)\n",
                  "asset-import-template.csv",
                  "text/csv"
                )
              }
            >
              <Download className="mr-2 h-4 w-4 text-[#c5161d]" /> Download CSV
              template
            </Button>
            <div className="rounded-xl bg-[#fbf1f1] p-4 text-xs leading-5 text-[#397c7d]">
              Required: <b>Asset Name</b>. Asset ID is generated when blank. Sub Asset ID is optional (up to 80 characters). Purchase Cost values are entered in
              Indian Rupees (₹). Asset IDs and QR identities are generated on
              import for blank values. Invalid rows should be corrected before
              committing.
            </div>
            <Input
              type="file"
              accept=".csv,text/csv"
              className={inputClass}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                file.text().then(text => {
                  setCsv(text);
                  setPreview([]);
                });
              }}
            />
            <p className="text-xs text-slate-400">
              {fileName || "No file selected · paste a CSV sample on the right"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[22px] border-slate-200/80">
          <CardHeader className="px-6 pb-3 pt-6">
            <CardTitle className="text-base font-black">
              Preview & validation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <Textarea
              className="min-h-40 rounded-xl border-slate-200 font-mono text-xs"
              value={csv}
              onChange={e => setCsv(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={validate}
                className="rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12]"
              >
                <FileUp className="mr-2 h-4 w-4" /> Validate preview
              </Button>
              {preview.length > 1 && (
                <Button
                  variant="outline"
                  disabled={importCsv.isPending}
                  onClick={() =>
                    importCsv.mutate({
                      fileName: fileName || "pasted-assets.csv",
                      csv,
                    })
                  }
                  className="rounded-xl border-[#e7bfc2] bg-white text-[#a50f16]"
                >
                  {importCsv.isPending ? "Importing..." : "Import valid rows"}
                </Button>
              )}
            </div>
            {preview.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-[11px]">
                  <tbody>
                    {preview.map((row, index) => (
                      <tr
                        key={index}
                        className={
                          index === 0
                            ? "bg-slate-50 font-black"
                            : "border-t border-slate-100"
                        }
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="whitespace-nowrap px-3 py-2"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="px-6 pb-3 pt-6">
          <CardTitle className="text-base font-black">Import history</CardTitle>
          <p className="mt-1 text-xs text-slate-400">
            Server-recorded jobs and the latest row-level errors.
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-2">
            {(history.data?.jobs ?? []).map(job => (
              <div
                key={job.id}
                className="flex flex-col justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:flex-row"
              >
                <span className="font-bold text-slate-700">{job.fileName}</span>
                <span className="text-slate-400">
                  {job.successfulRows} imported · {job.failedRows} rejected ·{" "}
                  {formatDateTime(job.createdAt)}
                </span>
              </div>
            ))}
            {history.data?.errors?.length ? (
              <div className="mt-4 rounded-xl border border-[#f3c9c1] bg-[#fffaf9] p-3 text-xs text-[#b55647]">
                Latest error: row {history.data.errors[0].rowNumber} ·{" "}
                {history.data.errors[0].fieldName ?? "row"} ·{" "}
                {history.data.errors[0].message}
              </div>
            ) : null}
            {!history.data?.jobs.length && (
              <p className="text-xs text-slate-400">
                No import jobs recorded yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

export function BulkOperationsPage() {
  const list = trpc.asset.list.useQuery({
    page: 1,
    pageSize: 100,
    status: "all",
    category: "all",
    department: "all",
    location: "all",
  });
  const catalog = trpc.asset.catalog.useQuery();
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [locationName, setLocationName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const utils = trpc.useUtils();
  const update = trpc.asset.bulkUpdate.useMutation({
    onSuccess: result => {
      toast.success(`${result.updated} assets updated`);
      setSelected([]);
      list.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const rows = list.data?.rows ?? [];
  const exportCsv = async () => {
    const result = await utils.asset.exportCsv.fetch({
      ids: selected.length ? selected : undefined,
    });
    download(
      result.csv,
      selected.length
        ? "assettrack-selected-assets.csv"
        : "assettrack-assets.csv",
      "text/csv"
    );
    toast.success(`${result.count} assets exported`);
  };
  return (
    <ModuleShell
      eyebrow="Data operations"
      title="Bulk operations"
      description="Export the live register or apply a confirmed status, location, or category update to selected assets."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={exportCsv}
          className="rounded-xl border-[#e7bfc2] bg-white text-[#a50f16]"
        >
          <Download className="mr-2 h-4 w-4" /> Export current register
        </Button>
        <Badge
          variant="outline"
          className="rounded-xl border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
        >
          {selected.length} selected
        </Badge>
      </div>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-base font-black">
              Select assets
            </CardTitle>
            <p className="mt-1 text-xs text-slate-400">
              {rows.length} live records · updates are written to each audit
              trail.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setSelected(
                selected.length === rows.length ? [] : rows.map(row => row.id)
              )
            }
            className="rounded-xl border-slate-200 bg-white text-xs font-bold"
          >
            {selected.length === rows.length ? "Clear all" : "Select all"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 px-6 pb-6">
          {rows.map(row => (
            <label
              key={row.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-[#fbfefe]"
            >
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={() =>
                  setSelected(current =>
                    current.includes(row.id)
                      ? current.filter(id => id !== row.id)
                      : [...current, row.id]
                  )
                }
                className="h-4 w-4 accent-[#c5161d]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-700">
                  {row.name}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {row.assetId} · {row.locationName ?? "Unassigned"}
                </span>
              </span>
              <BulkStatusBadge status={row.status} />
            </label>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-[22px] border-slate-200/80">
        <CardHeader className="px-6 pb-3 pt-6">
          <CardTitle className="text-base font-black">
            Confirmed update
          </CardTitle>
          <p className="mt-1 text-xs text-slate-400">
            Leave a field blank to preserve its current value. All selected rows
            receive an activity and audit event.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
          <BulkSelect
            value={status}
            onChange={setStatus}
            options={[
              ["", "Preserve status"],
              ["available", "Available"],
              ["assigned", "Assigned"],
              ["checked_out", "Checked out"],
              ["under_maintenance", "Maintenance"],
              ["lost", "Lost"],
              ["damaged", "Damaged"],
              ["retired", "Retired"],
              ["disposed", "Disposed"],
            ]}
          />
          <BulkSelect
            value={categoryName}
            onChange={setCategoryName}
            options={[
              ["", "Preserve category"],
              ...(catalog.data?.categories ?? []).map(
                item => [item.name, item.name] as [string, string]
              ),
            ]}
          />
          <BulkSelect
            value={locationName}
            onChange={setLocationName}
            options={[
              ["", "Preserve location"],
              ...(catalog.data?.locations ?? []).map(
                item => [item.name, item.name] as [string, string]
              ),
            ]}
          />
          <Button
            disabled={
              !selected.length ||
              update.isPending ||
              (!status && !locationName && !categoryName)
            }
            onClick={() => {
              if (!window.confirm(`Update ${selected.length} selected assets?`))
                return;
              update.mutate({
                ids: selected,
                status: status ? (status as any) : undefined,
                locationName: locationName || undefined,
                categoryName: categoryName || undefined,
                confirm: true,
              });
            }}
            className="rounded-xl bg-[#151a20] text-white hover:bg-[#7f0d12] sm:col-span-3"
          >
            {update.isPending ? "Updating…" : "Confirm bulk update"}
          </Button>
        </CardContent>
      </Card>
    </ModuleShell>
  );
}

function BulkSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className={`${inputClass} w-full px-3`}
    >
      <option value="">Select…</option>
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
function BulkStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className="border-[#bde5e1] bg-[#fbf1f1] text-[#a50f16]"
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function ModuleShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c5161d]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.06em] text-slate-900">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
function MiniMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const classes: Record<string, string> = {
    purple: "bg-[#f0edff] text-[#7661ea]",
    amber: "bg-[#fff7df] text-[#aa7813]",
    coral: "bg-[#fff0ed] text-[#e67261]",
  };
  return (
    <Card className="rounded-[20px] border-slate-200/80">
      <CardContent className="p-5">
        <div
          className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${classes[color]}`}
        >
          <span className="text-sm font-black">{value}</span>
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Current database count
        </p>
      </CardContent>
    </Card>
  );
}
function ReportCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-[20px] border-slate-200/80">
      <CardContent className="p-5">
        <Icon className="h-5 w-5 text-[#c5161d]" />
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-900">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
function ExportAction({
  title,
  text,
  icon: Icon,
  onClick,
  href,
}: {
  title: string;
  text: string;
  icon: React.ElementType;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7e8e9] text-[#c5161d]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{text}</p>
      </div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#e7bfc2]"
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#e7bfc2]"
    >
      {content}
    </button>
  );
}
function ConfigGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.map(item => (
            <span
              key={item}
              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-400">Nothing configured yet</span>
        )}
      </div>
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7e8e9] text-[#c5161d]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
        {text}
      </p>
    </div>
  );
}
function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
