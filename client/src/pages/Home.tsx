import { Link } from "wouter";
import React, { useEffect, useState } from "react";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  DollarSign,
  Download,
  FilePlus2,
  Laptop,
  LogIn,
  LogOut,
  Monitor,
  Package,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  Router,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatINR } from "@/lib/currency";

const STATUS_COLORS: Record<string, string> = {
  available: "#16b99a",
  assigned: "#3498db",
  checked_out: "#7c67f2",
  under_maintenance: "#f3b548",
  lost: "#d71920",
  damaged: "#e76f51",
  retired: "#8b9bab",
  disposed: "#64748b",
};
const DONUT_COLORS = [
  "#c5161d",
  "#38b8c2",
  "#d71920",
  "#f4bd5c",
  "#7c67f2",
  "#7b91a1",
];
const STATUS_DISTRIBUTION_KEYS = [
  "available",
  "checked_out",
  "under_maintenance",
  "lost",
  "retired",
  "disposed",
] as const;
const STATUS_DISTRIBUTION_LABELS: Record<
  (typeof STATUS_DISTRIBUTION_KEYS)[number],
  string
> = {
  available: "Available",
  checked_out: "Checked Out",
  under_maintenance: "Under Maintenance",
  lost: "Lost",
  retired: "Retired",
  disposed: "Disposed",
};

function statusIcon(key: string) {
  if (key === "available") return CheckCircle2;
  if (key === "checked_out") return PackageCheck;
  if (key === "under_maintenance") return Wrench;
  if (key === "lost") return CircleAlert;
  if (key === "retired") return Archive;
  if (key === "disposed") return Trash2;
  return Boxes;
}

function categoryIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("computer") || normalized.includes("laptop"))
    return Laptop;
  if (normalized.includes("monitor") || normalized.includes("display"))
    return Monitor;
  if (normalized.includes("network") || normalized.includes("router"))
    return Router;
  if (normalized.includes("mobile") || normalized.includes("phone"))
    return Smartphone;
  if (normalized.includes("vehicle") || normalized.includes("fleet"))
    return Truck;
  if (normalized.includes("furniture") || normalized.includes("facility"))
    return Building2;
  if (normalized.includes("equipment") || normalized.includes("supply"))
    return Package;
  return Boxes;
}

export default function Home() {
  const dashboard = trpc.asset.dashboard.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const seed = trpc.asset.seedDemo.useMutation({
    onSuccess: result => {
      toast.success(
        result.created
          ? `${result.created} clearly marked demo assets loaded`
          : "Demo data is already loaded"
      );
      dashboard.refetch();
    },
  });
  const data = dashboard.data;
  const kpis = data?.kpis;
  const hasData = Boolean(kpis?.total);
  const activity = data?.activity ?? [];
  const chartStatus = data?.status ?? [];
  const conditionData = data?.conditions ?? [];
  const statusDistribution = STATUS_DISTRIBUTION_KEYS.map(key => ({
    key,
    name: STATUS_DISTRIBUTION_LABELS[key],
    value: chartStatus.find(item => item.key === key)?.value ?? 0,
  }));
  const statusChartData = statusDistribution.filter(item => item.value > 0);
  const damagedCondition = conditionData.find(item => item.key === "damaged");
  const categoryData = data?.categories ?? [];
  const deptData = data?.departments ?? [];
  const activeRate = kpis?.utilization ?? 0;
  const categoryRows = categoryData.slice(0, 6);
  const categoryTotal =
    kpis?.total ?? categoryRows.reduce((sum, item) => sum + item.value, 0);

  const [liveSnapshots, setLiveSnapshots] = useState<Array<{ label: string; total: number; available: number; checkedOut: number }>>([]);
  useEffect(() => {
    if (!kpis) return;
    const snapshot = {
      label: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date()),
      total: kpis.total,
      available: kpis.available,
      checkedOut: kpis.checkedOut,
    };
    setLiveSnapshots(current => [...current, snapshot].slice(-20));
  }, [dashboard.dataUpdatedAt, kpis?.total, kpis?.available, kpis?.checkedOut]);
  const trendData = liveSnapshots.length ? liveSnapshots : [{ label: "Current", total: kpis?.total ?? 0, available: kpis?.available ?? 0, checkedOut: kpis?.checkedOut ?? 0 }];

  if (dashboard.isLoading) return <DashboardSkeleton />;

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-[#bde5e1] bg-[#e9f8f6] px-6 py-7 sm:px-9 sm:py-9">
        <div className="absolute -right-4 -top-24 h-72 w-72 rounded-full border-[36px] border-white/50" />
        <div className="absolute right-32 top-8 h-28 w-48 -skew-x-12 rotate-12 rounded-[28px] border border-[#8bd8d0]/60 bg-[#6ec8c2]/30" />
        <div className="absolute bottom-[-64px] right-14 h-40 w-72 rotate-[-12deg] rounded-[32px] bg-[#d71920]/20" />
        <div className="relative z-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#c5161d]">
              <Sparkles className="h-4 w-4" /> Asset intelligence
            </div>
            <h1 className="max-w-xl text-3xl font-black tracking-[-0.06em] text-[#111418] sm:text-5xl">
              Know every asset.
              <br />
              <span className="text-[#c5161d]">Move with confidence.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#3c6e77] sm:text-base">
              A single trusted record for every device, space, handoff, and
              lifecycle decision across your organization.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/assets/new">
              <Button className="h-11 rounded-xl bg-[#151a20] px-4 text-white shadow-[0_8px_18px_rgba(11,111,115,0.22)] hover:bg-[#7f0d12]">
                <Plus className="mr-2 h-4 w-4" /> Add asset
              </Button>
            </Link>
            <Link href="/qr-labels">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-[#a6d9d5] bg-white/80 px-4 text-[#151a20] hover:bg-white"
              >
                <QrCode className="mr-2 h-4 w-4" /> Print labels
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {!hasData && (
        <EmptyWorkspace
          onSeed={() => seed.mutate()}
          isLoading={seed.isPending}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total assets"
          value={kpis?.total ?? 0}
          caption="Tracked in workspace"
          icon={Boxes}
          accent="teal"
          href="/assets"
        />
        <MetricCard
          label="Available"
          value={kpis?.available ?? 0}
          caption={`${activeRate}% utilization`}
          icon={CheckCircle2}
          accent="mint"
          href="/assets?status=available"
        />
        <MetricCard
          label="Checked out"
          value={kpis?.checkedOut ?? 0}
          caption="Currently in use"
          icon={PackageCheck}
          accent="purple"
          href="/assets?status=checked_out"
        />
        <MetricCard
          label="Needs attention"
          value={
            (kpis?.underMaintenance ?? 0) +
            (kpis?.damaged ?? 0) +
            (kpis?.lost ?? 0)
          }
          caption={`${kpis?.maintenanceDue ?? 0} due soon`}
          icon={ShieldAlert}
          accent="coral"
          href="/lifecycle"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-6 pb-2 pt-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Portfolio pulse
              </p>
              <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-900">
                Lifecycle activity
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="border-[#bde5e1] bg-[#fbf1f1] text-[#a50f16]"
            >
              <TrendingUp className="mr-1 h-3 w-3" /> Live data
            </Badge>
          </CardHeader>
          <CardContent className="px-3 pb-5 pt-4 sm:px-5">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ left: -18, right: 10, top: 5, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#edf1f2" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #e6edef",
                      boxShadow: "0 10px 30px rgba(20,54,72,.1)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#38b8c2"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Total"
                  />
                  <Line
                    type="monotone"
                    dataKey="available"
                    stroke="#16b99a"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Available"
                  />
                  <Line
                    type="monotone"
                    dataKey="checkedOut"
                    stroke="#7c67f2"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Checked out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex items-center justify-center gap-5 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-[#38b8c2]" /> Total assets
              </span>
              <span className="flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-[#16b99a]" /> Available
              </span>
              <span className="flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-[#7c67f2]" /> Checked out
              </span>
            </div>
          </CardContent>
        </Card>
        <Card
          data-testid="asset-status-card"
          className="rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]"
        >
          <CardHeader className="px-6 pb-2 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Distribution
                </p>
                <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-900">
                  Asset status
                </CardTitle>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Current state of the asset register
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-[#bde5e1] bg-[#effaf8] text-[#238f91]"
              >
                {statusDistribution.reduce((sum, item) => sum + item.value, 0)}{" "}
                tracked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-4 pb-5 pt-2 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-[174px] w-[46%] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                      strokeWidth={0}
                    >
                      {statusChartData.map(entry => (
                        <Cell
                          key={entry.key}
                          fill={STATUS_COLORS[entry.key] ?? "#9aa9b2"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid #e6edef",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {statusDistribution.map(item => {
                  const Icon = statusIcon(item.key);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-600">
                        <Icon
                          className="h-3.5 w-3.5 shrink-0"
                          style={{
                            color: STATUS_COLORS[item.key] ?? "#9aa9b2",
                          }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-black text-slate-900">
                        {item.value}
                      </span>
                    </div>
                  );
                })}
                {!statusChartData.length && (
                  <span className="text-xs text-slate-400">
                    No current status records yet.
                  </span>
                )}
              </div>
            </div>
            {damagedCondition && (
              <div className="flex items-center justify-between rounded-xl border border-[#f6d9c8] bg-[#fff8f3] px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs font-bold text-[#9b5a36]">
                  <CircleAlert className="h-3.5 w-3.5" /> Condition signal ·
                  Damaged
                </span>
                <span className="text-sm font-black text-[#9b5a36]">
                  {damagedCondition.value}
                </span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Lifecycle flow
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Statuses and actions, shown distinctly
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  Operational path
                </span>
              </div>
              <div className="pb-1">
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1"
                  aria-label="Available to Checked Out and back to Available lifecycle flow"
                >
                  {[
                    { label: "Available", type: "status", Icon: CheckCircle2 },
                    { label: "Check Out", type: "action", Icon: LogOut },
                    {
                      label: "Checked Out",
                      type: "status",
                      Icon: PackageCheck,
                    },
                    { label: "Check In", type: "action", Icon: LogIn },
                    { label: "Available", type: "status", Icon: CheckCircle2 },
                  ].map((step, index) => (
                    <React.Fragment key={`${step.label}-${index}`}>
                      <div
                        className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-center ${step.type === "action" ? "border border-dashed border-[#bde5e1] bg-[#f4fbfa]" : "border border-[#f0d1d2] bg-[#fff8f8]"}`}
                      >
                        <step.Icon
                          className={`h-3.5 w-3.5 ${step.type === "action" ? "text-[#238f91]" : "text-[#c5161d]"}`}
                        />
                        <span className="break-words text-[9px] font-black leading-3 text-slate-700">
                          {step.label}
                        </span>
                        <span
                          className={`text-[8px] font-bold uppercase tracking-[0.06em] ${step.type === "action" ? "text-[#238f91]" : "text-[#a50f16]"}`}
                        >
                          {step.type}
                        </span>
                      </div>
                      {index < 4 && (
                        <ArrowRight
                          className="h-3 w-3 shrink-0 text-slate-300"
                          aria-hidden="true"
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card className="relative overflow-hidden rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]">
          <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full border-[18px] border-[#f7e8e9]" />
          <CardHeader className="relative flex flex-row items-start justify-between space-y-0 px-6 pb-2 pt-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Inventory mix
              </p>
              <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-900">
                By category
              </CardTitle>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Where the register is concentrated
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#f0c9cb] bg-[#fff7f7] text-[#a50f16]"
            >
              <Boxes className="mr-1.5 h-3 w-3" />
              {categoryTotal} assets
            </Badge>
          </CardHeader>
          <CardContent className="relative grid gap-6 px-6 pb-6 pt-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              {categoryRows.map((item, index) => {
                const Icon = categoryIcon(item.name);
                const percentage = categoryTotal
                  ? Math.round((item.value / categoryTotal) * 100)
                  : 0;
                return (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-slate-100 bg-white/80 p-3 transition hover:border-[#f0c9cb] hover:bg-[#fffafa]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index % 2 === 0 ? "bg-[#f7e8e9] text-[#c5161d]" : "bg-[#edf8f7] text-[#238f91]"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-slate-800">
                          {item.name}
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#c5161d] transition-all"
                            style={{ width: `${Math.min(100, percentage)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">
                          {item.value}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {percentage}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!categoryRows.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Category distribution appears as assets are registered.
                </div>
              )}
            </div>
            <div className="min-h-[210px] rounded-2xl bg-[#fbfcfc] px-2 py-3 sm:px-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Asset count
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Top {categoryRows.length}
                </span>
              </div>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryRows}
                    layout="vertical"
                    margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
                    barCategoryGap={12}
                  >
                    <CartesianGrid horizontal={false} stroke="#edf1f2" />
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#667b84" }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f6f8f8" }}
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid #e6edef",
                        boxShadow: "0 10px 30px rgba(20,54,72,.1)",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [
                        `${value} assets`,
                        "Count",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                      fill="#c5161d"
                      background={{ fill: "#edf1f2", radius: 8 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]">
          <CardHeader className="px-6 pb-2 pt-6">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
              Ownership map
            </p>
            <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em]">
              By department
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            {deptData.slice(0, 5).map((item, index) => (
              <div key={item.key}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-semibold text-slate-600">
                    {item.name}
                  </span>
                  <span className="font-black text-slate-900">
                    {item.value}
                  </span>
                </div>
                <Progress
                  value={kpis?.total ? (item.value / kpis.total) * 100 : 0}
                  className={`h-2 bg-slate-100 ${index % 2 ? "[&>div]:bg-[#38b8c2]" : "[&>div]:bg-[#c5161d]"}`}
                />
              </div>
            ))}
            {!deptData.length && (
              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-400">
                Department distribution appears as assets are registered.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-slate-200/80 bg-[#111418] text-white shadow-[0_14px_44px_rgba(18,63,87,0.16)]">
          <CardHeader className="px-6 pb-2 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8bd8d0]">
                  Financial view
                </p>
                <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em] text-white">
                  Portfolio value
                </CardTitle>
              </div>
              <DollarSign className="h-5 w-5 text-[#d71920]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <p className="text-3xl font-black tracking-[-0.06em]">
              {formatINR(kpis?.totalCost ?? 0)}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#b7d1d5]">
              Recorded purchase cost across the live asset register. Demo
              records are marked in the registry.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-bold text-[#8bd8d0]">
              <BarChart3 className="h-4 w-4" /> {kpis?.total ?? 0} records
              valued
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]">
          <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Audit stream
              </p>
              <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em]">
                Recent activity
              </CardTitle>
            </div>
            <Link
              href="/lifecycle"
              className="flex items-center text-xs font-bold text-[#c5161d] hover:underline"
            >
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            {activity.length ? (
              <div className="divide-y divide-slate-100">
                {activity.slice(0, 6).map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3 first:pt-1"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-[#e7f7f5] text-[#c5161d]" : index % 3 === 1 ? "bg-[#fff0ed] text-[#e67261]" : "bg-[#f0edff] text-[#7c67f2]"}`}
                    >
                      <ActivityIcon type={item.eventType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {item.asset?.assetId ?? "Asset record"} ·{" "}
                        {item.actorName ?? "Workspace operator"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                      {formatRelative(item.occurredAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                No activity yet. Register an asset or load the clearly marked
                demo workspace to see the audit stream.
              </div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="rounded-[24px] border-slate-200/80 shadow-[0_14px_44px_rgba(26,67,85,0.06)]">
            <CardHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Watchlist
                </p>
                <CardTitle className="mt-1 text-lg font-black tracking-[-0.03em]">
                  Warranty & maintenance
                </CardTitle>
              </div>
              <CalendarClock className="h-5 w-5 text-[#d71920]" />
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {(data?.warranty ?? []).slice(0, 3).map(item => (
                <div
                  key={item.assetId}
                  className="flex items-center justify-between rounded-xl bg-[#fff8f6] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{item.assetId}</p>
                  </div>
                  <span className="ml-3 whitespace-nowrap text-[11px] font-black text-[#df705f]">
                    {formatDate(item.expiry)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="font-semibold text-slate-500">
                  Due in 45 days
                </span>
                <span className="font-black text-slate-900">
                  {kpis?.dueWarranty ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink href="/assets/new" icon={FilePlus2} label="Register" />
            <QuickLink href="/qr-labels" icon={QrCode} label="QR labels" />
            <QuickLink href="/reports" icon={Download} label="Export" />
            <QuickLink href="/maintenance" icon={Wrench} label="Maintenance" />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: number;
  caption: string;
  icon: React.ElementType;
  accent: string;
  href: string;
}) {
  const accents: Record<string, string> = {
    teal: "bg-[#f7e8e9] text-[#c5161d]",
    mint: "bg-[#eaf9f2] text-[#159d77]",
    purple: "bg-[#f0edff] text-[#7661ea]",
    coral: "bg-[#fff0ed] text-[#e67261]",
  };
  return (
    <Link href={href} className="group">
      <Card className="h-full rounded-[22px] border-slate-200/80 shadow-[0_10px_30px_rgba(26,67,85,0.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(26,67,85,0.1)]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${accents[accent]}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#c5161d]" />
          </div>
          <p className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-slate-900">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{caption}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-bold text-slate-600 shadow-[0_8px_25px_rgba(26,67,85,0.035)] transition hover:border-[#e7bfc2] hover:text-[#c5161d]"
    >
      <Icon className="h-4 w-4 text-[#c5161d]" />
      {label}
      <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
    </Link>
  );
}

function EmptyWorkspace({
  onSeed,
  isLoading,
}: {
  onSeed: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-[#94d6d1] bg-white/70 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7e8e9] text-[#c5161d]">
          <CircleAlert className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">
            Your workspace is ready for its first record.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Load clearly marked demo data for a guided preview, or start
            registering real assets.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={onSeed}
        disabled={isLoading}
        className="shrink-0 rounded-xl border-[#e7bfc2] bg-white text-xs font-bold text-[#a50f16] hover:bg-[#fbf1f1]"
      >
        <RefreshCw
          className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
        />{" "}
        Load demo workspace
      </Button>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  if (type === "checkout") return <PackageCheck className="h-4 w-4" />;
  if (type === "checkin") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "maintenance") return <Wrench className="h-4 w-4" />;
  if (type === "damage") return <CircleAlert className="h-4 w-4" />;
  return <Boxes className="h-4 w-4" />;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function formatRelative(value: Date | string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] animate-pulse space-y-7">
      <div className="h-56 rounded-[28px] bg-[#e5f2f1]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-[22px] bg-white" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-80 rounded-[24px] bg-white" />
        <div className="h-80 rounded-[24px] bg-white" />
      </div>
    </div>
  );
}
