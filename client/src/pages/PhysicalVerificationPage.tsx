import React, { useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  VerificationPhotos,
  type UploadedPhoto,
} from "@/components/VerificationPhotos";

export default function PhysicalVerificationPage() {
  const [, params] = useRoute("/asset/:token/verify");
  const token = params?.token ?? "";
  const asset = trpc.asset.publicByToken.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );
  const save = trpc.asset.verification.submit.useMutation();
  const [form, setForm] = useState({
    employeeName: "",
    employeeCode: "",
    date: "",
    time: "",
    location: "",
    condition: "",
    remarks: "",
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) =>
    setForm(current => ({ ...current, [key]: value }));
  if (asset.isLoading) return <p role="status">Loading asset details…</p>;
  if (asset.isError || !asset.data)
    return (
      <p role="alert">
        Asset details unavailable. Return to Scan QR and try again.
      </p>
    );
  const { asset: record } = asset.data;
  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link
          className="inline-flex items-center gap-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
          href={`/asset/${token}`}
        >
          <ArrowLeft size={15} /> Back to asset
        </Link>
        <Card className="overflow-hidden rounded-[22px] border-slate-200/80 py-0 shadow-sm">
          <CardHeader className="gap-3 bg-[#19232f] px-6 py-8 text-white sm:px-8">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-slate-300">
              <ShieldCheck size={16} /> ASSET ASSURANCE
            </div>
            <CardTitle className="text-3xl">Physical verification</CardTitle>
            <p className="text-sm text-slate-300">
              Confirm the asset, record its condition, and attach your evidence.
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-1 font-mono text-xs text-slate-300">
                {record.assetId}
              </p>
              <p className="font-semibold">{record.name}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <MapPin size={13} />
                {record.status} ·{" "}
                {record.locationName || "No registered location"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            {save.data ? (
              <div
                role="status"
                className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7"
              >
                <CheckCircle2 className="h-8 w-8 text-slate-600" />
                <p>
                  {save.data.status === "Verified"
                    ? "Verification saved: Verified."
                    : "Verification saved: Flagged for admin review because the location does not match."}
                </p>
                <Link
                  className="inline-flex font-semibold text-[#b21b24] underline underline-offset-4"
                  href={`/asset/${token}`}
                >
                  Return to asset
                </Link>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={event => {
                  event.preventDefault();
                  save.mutate({
                    token,
                    ...form,
                    condition: form.condition as
                      | "new"
                      | "good"
                      | "fair"
                      | "damaged",
                    photos,
                  });
                }}
              >
                <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                  <UserRound size={19} className="mt-1 text-slate-400" />
                  <div>
                    <h2 className="text-base font-bold">
                      Verification details
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      Enter all details manually. All fields are required unless
                      marked optional.
                    </p>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      ["employeeName", "Employee Name", "text"],
                      ["employeeCode", "Employee ID", "text"],
                      ["date", "Verification Date", "date"],
                      ["time", "Verification Time", "time"],
                      ["location", "Verification Location", "text"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        type={type}
                        required
                        maxLength={
                          key === "employeeCode"
                            ? 80
                            : key === "date" || key === "time"
                              ? undefined
                              : 160
                        }
                        className="h-11 rounded-xl shadow-none"
                        value={form[key]}
                        onChange={event => set(key, event.target.value)}
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="condition">Asset Condition</Label>
                    <select
                      id="condition"
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={form.condition}
                      onChange={event => set("condition", event.target.value)}
                    >
                      <option value="">Select condition</option>
                      {["New", "Good", "Fair", "Damaged"].map(label => (
                        <option key={label} value={label.toLowerCase()}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-t border-slate-100 pt-6">
                  <Camera size={19} className="mt-1 text-slate-400" />
                  <div>
                    <h2 className="text-base font-bold">
                      Evidence & observations
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      Add at least one clear photo showing the asset and its
                      condition.
                    </p>
                  </div>
                </div>
                <VerificationPhotos onChange={setPhotos} onBusy={setBusy} />
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Textarea
                    id="remarks"
                    maxLength={2000}
                    value={form.remarks}
                    onChange={event => set("remarks", event.target.value)}
                  />
                </div>
                {save.error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
                  >
                    {save.error.message}
                  </p>
                )}
                {!photos.length && (
                  <p className="text-xs text-slate-500">
                    Attach a photo to enable saving.
                  </p>
                )}
                <Button
                  className="h-12 w-full rounded-xl bg-[#c5161d] text-white hover:bg-[#a51119]"
                  disabled={busy || save.isPending || !photos.length}
                >
                  <ClipboardCheck size={17} />{" "}
                  {busy
                    ? "Preparing photos…"
                    : save.isPending
                      ? "Saving verification…"
                      : "Save verification"}
                </Button>
                <p className="text-center text-[11px] leading-5 text-slate-400">
                  Location mismatches are automatically flagged for admin
                  review.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
