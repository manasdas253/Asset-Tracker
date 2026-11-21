import { VerificationSummary } from "@/components/VerificationSummary";
import React from "react";
import { CircleAlert, Package, QrCode } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const labels: Record<string, string> = { available: "Available", assigned: "Assigned", checked_out: "Checked out", under_maintenance: "Under maintenance", lost: "Lost", damaged: "Damaged", retired: "Retired", disposed: "Disposed" };
const formatDate = (value: Date | string | null | undefined, time = false) => value
  ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", ...(time ? { timeStyle: "short" as const } : {}) }).format(new Date(value))
  : "—";

export default function PublicAssetStatusPage({ byId = false }: { byId?: boolean }) {
  const { user } = useAuth();
  const [, idParams] = useRoute("/assets/:id");
  const [, params] = useRoute("/asset/:token");
  const tokenQuery = trpc.asset.publicByToken.useQuery({ token: params?.token ?? "" }, {
    enabled: !byId && Boolean(params?.token), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 15_000,
  });
  const idQuery = trpc.asset.byId.useQuery({ id: Number(idParams?.id) }, { enabled: byId && Boolean(idParams?.id), retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 15_000 });
  const query = byId ? idQuery : tokenQuery;
  if (query.isLoading) return <div role="status" className="flex min-h-screen items-center justify-center bg-[#f8fbfc]"><span className="sr-only">Loading asset details</span><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#bde5e1] border-t-[#c5161d]" /></div>;
  if (query.isError) return <div className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md text-center"><CardContent className="space-y-4 p-8"><CircleAlert className="mx-auto h-8 w-8 text-[#c5161d]" /><h1 className="text-xl font-bold">Asset details unavailable</h1><p className="text-sm text-slate-500">Access may have expired or been denied. Ask your administrator for access, or retry if your connection failed.</p><Button onClick={() => query.refetch()}>Try again</Button></CardContent></Card></div>;
  if (!query.data) return <div className="flex min-h-screen items-center justify-center bg-[#f8fbfc] p-6"><Card className="max-w-md rounded-[24px] text-center"><CardContent className="p-8"><CircleAlert className="mx-auto h-8 w-8 text-[#e67261]" /><h1 className="mt-4 text-xl font-black">Asset not found</h1><p className="mt-2 text-sm text-slate-500">This QR identity is invalid, inactive, or no longer available.</p></CardContent></Card></div>;

  const { asset, qr } = query.data;
  const groups = [
    { title: "Product details", values: [["Unique ID", asset.assetId], ["Product name", asset.name], ["Category", asset.categoryName], ["Subcategory", asset.subcategory], ["Asset type", asset.assetType], ["Manufacturer", asset.manufacturer], ["Brand", asset.brand], ["Model", asset.model], ["Model number", asset.modelNumber], ["Serial number", asset.serialNumber], ["SKU", asset.sku], ["Barcode", asset.barcodeNumber], ["Condition", asset.condition], ["Description", asset.description]] },
    { title: "Location & assignment", values: [["Location", asset.locationName], ["Building", asset.building], ["Floor", asset.floor], ["Storage location", asset.storageLocation], ["Department", asset.departmentName], ["Assigned to", asset.assignedEmployeeName], ["Employee ID", asset.assignedEmployeeCode], ["Assigned date", formatDate(asset.assignedAt)], ["Expected return", formatDate(asset.expectedReturnDate)]] },
    { title: "Purchase & warranty", values: [["Purchase date", formatDate(asset.purchaseDate)], ["Purchase cost", asset.purchaseCost == null ? null : `${asset.currency} ${Number(asset.purchaseCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`], ["Vendor", asset.vendor], ["Invoice number", asset.invoiceNumber], ["Purchase order", asset.purchaseOrderNumber], ["Warranty provider", asset.warrantyProvider], ["Warranty start", formatDate(asset.warrantyStartDate)], ["Warranty expiry", formatDate(asset.warrantyExpiryDate)], ["Warranty terms", asset.warrantyTerms]] },
    { title: "Record & movement", values: [["Checked out", formatDate(asset.lastCheckoutAt, true)], ["Checked in", formatDate(asset.lastCheckinAt, true)], ["Registered", formatDate(asset.createdAt, true)], ["Last updated", formatDate(asset.updatedAt, true)], ["Last activity", formatDate(asset.lastActivityAt, true)], ["Retired", formatDate(asset.retiredAt)], ["Notes", asset.notes]] },
  ];
  const isCheckedOut = asset.status === "checked_out";
  return <main className="min-h-screen bg-[#f8fbfc] px-4 py-6 sm:px-6 sm:py-10">
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3 px-2"><QrCode className="h-7 w-7 text-[#c5161d]" /><div><p className="text-sm font-black text-slate-900">AssetTrack</p><p className="text-xs text-slate-500">Authorized asset details</p></div></div>
      <Card className="overflow-hidden rounded-[26px] border-slate-200/80 shadow-lg">
        <header className="bg-[#111418] px-6 py-7 text-white"><p className="break-all font-mono text-xs font-bold text-[#a8e7e1]">{asset.assetId}</p><h1 className="mt-3 break-words text-2xl font-black">{asset.name}</h1><p className="mt-2 break-words text-sm text-[#b7d1d5]">{[asset.brand, asset.model].filter(Boolean).join(" · ")}</p><span className="mt-5 inline-flex rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold">{labels[asset.status] ?? asset.status}</span></header>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {query.isError && <p role="alert" className="text-sm text-amber-700">Updates are temporarily unavailable. Showing the last loaded details.</p>}
          {asset.imageUrl && <img src={asset.imageUrl} alt={asset.name} className="max-h-64 w-full rounded-xl object-contain" />}
          {groups.map(group => <section key={group.title}><h2 className="mb-3 text-base font-bold text-slate-900">{group.title}</h2><dl className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">{group.values.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">{value || "—"}</dd></div>)}</dl></section>)}
          {user?.role === "admin" && <VerificationSummary assetId={asset.id} />}
          {user?.role === "admin" && qr && <Link href={`/asset/${qr.token}/verify`}><Button className="h-11 w-full rounded-xl">Verified</Button></Link>}
          {user?.role === "admin" && qr && <div className="grid gap-2 sm:grid-cols-2">{asset.status !== "available" ? <Button disabled className="h-11 w-full rounded-xl"><Package className="mr-2 h-4 w-4" /> {isCheckedOut ? "Checked out" : labels[asset.status]}</Button> : <Link href={`/asset/${qr.token}/checkout`}><Button className="h-11 w-full rounded-xl bg-[#151a20] text-white"><Package className="mr-2 h-4 w-4" /> Check out</Button></Link>}<Link href={`/asset/${qr.token}/report-damage`}><Button variant="outline" className="h-11 w-full rounded-xl text-[#c5161d]"><CircleAlert className="mr-2 h-4 w-4" /> Report damage</Button></Link></div>}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-slate-500">Access is verified for your account. Details refresh automatically; the QR code stays the same.</p>
    </div>
  </main>;
}
