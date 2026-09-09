import {
  Archive,
  BarChart3,
  Bell,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Menu,
  PackagePlus,
  QrCode,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

const primaryNav = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Asset registry", path: "/assets", icon: Boxes },
  { label: "Add asset", path: "/assets/new", icon: PackagePlus },
  { label: "Lifecycle", path: "/lifecycle", icon: Truck },
  { label: "Maintenance", path: "/maintenance", icon: Wrench },
];

const workspaceNav = [
  { label: "Scan QR", path: "/scan", icon: ScanLine },
  { label: "QR labels", path: "/qr-labels", icon: QrCode },
  { label: "Reports", path: "/reports", icon: FileBarChart },
  { label: "Audit & verification", path: "/audit", icon: ClipboardCheck },
  { label: "Settings", path: "/settings", icon: Settings2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const value = query.trim(); if (value) navigate(`/assets?search=${encodeURIComponent(value)}`); };
  const navItems = [...primaryNav, ...workspaceNav];
  const active = navItems.find(item => location === item.path) ?? navItems.find(item => item.path !== "/" && location.startsWith(item.path));

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#18212b]">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col overflow-hidden border-r border-[#202831] bg-[#101419] text-white shadow-[18px_0_48px_rgba(17,20,24,0.22)] transition-transform duration-200 ease-out lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative flex items-center justify-between border-b border-white/[0.07] bg-[#0c1014] px-5 py-5">
          <Link href="/" onClick={() => setMobileOpen(false)} className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1014]">
            <div className="flex h-14 w-[188px] items-center justify-start overflow-hidden rounded-xl bg-black px-3 ring-1 ring-white/[0.10] transition group-hover:ring-white/20"><img src="/iims-logo-white.png" alt="CKA Birla Group | IIMS" className="h-full w-full scale-[1.32] object-cover object-center" /></div>
          </Link>
          <button aria-label="Close navigation" className="rounded-lg p-2 text-white/50 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1014] lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#151b22] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c5161d] text-[11px] font-black text-white shadow-[0_8px_18px_rgba(197,22,29,0.24)]">OP</div>
            <div className="min-w-0"><p className="truncate text-xs font-bold text-white">Workspace operator</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">Asset operations</p></div>
            <span className="ml-auto h-2 w-2 rounded-full bg-[#2bc2a8] shadow-[0_0_0_4px_rgba(43,194,168,0.12)]" />
          </div>
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Workspace</p>
          <nav aria-label="Workspace navigation" className="space-y-1.5">
            {primaryNav.map(item => <NavItem key={item.path} item={item} active={active?.path === item.path} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
          <p className="mb-2 mt-7 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Operations</p>
          <nav aria-label="Operations navigation" className="space-y-1.5">
            {workspaceNav.map(item => <NavItem key={item.path} item={item} active={active?.path === item.path} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
        </div>

        <div className="relative mx-4 mb-4 rounded-xl border border-white/[0.08] bg-[#151b22] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#202a33] text-[#f46b70] ring-1 ring-white/[0.07]"><ShieldCheck className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs font-bold text-white">Trusted records</p><p className="mt-1 text-[11px] leading-4 text-white/52">Every change is recorded with an immutable activity trail.</p></div></div>
        </div>
      </aside>

      {mobileOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dfe3e7] bg-[#f4f6f8]/95 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Open navigation" className="focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0">
              <div className="hidden items-center gap-2 text-[11px] font-semibold text-slate-400 sm:flex"><span>Workspace</span><ChevronRight className="h-3 w-3" /><span className="text-slate-600">{active?.label ?? "Overview"}</span></div>
              <p className="truncate text-sm font-bold tracking-[-0.02em] text-slate-900 sm:mt-1">{active?.label ?? "Overview"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <form onSubmit={submitSearch} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm lg:flex"><Search className="h-4 w-4 text-slate-400" /><input ref={searchRef} aria-label="Search assets by Asset ID, serial, brand, or model" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assets" className="h-9 w-44 bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 xl:w-56" /><kbd className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">⌘K</kbd></form>
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm md:flex"><span className="h-2 w-2 rounded-full bg-[#1bb89d]" /> Live workspace</div>
            <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#7ccbc7] hover:text-[#0b6f73]"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f68172]" /></Link>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#123f57] text-xs font-black text-white">OP</div><div className="hidden sm:block"><p className="text-xs font-bold text-slate-800">Workspace operator</p><p className="text-[10px] text-slate-400">Phase 1 · no login</p></div></div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-72px)] px-5 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <LogoutControl />
    </div>
  );
}

function LogoutControl() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return <button type="button" onClick={() => void logout()} className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:text-[#c5161d]">Sign out</button>;
}

function NavItem({ item, active, onNavigate }: { item: (typeof primaryNav)[number]; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const [, navigate] = useLocation();
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate();
    if (item.path === "/assets/new") {
      event.preventDefault();
      navigate("/assets/new");
    }
  };
  return <Link href={item.path} onClick={handleClick} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold tracking-[-0.01em] transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101419] ${active ? "bg-white text-[#141a20] shadow-[0_10px_26px_rgba(0,0,0,0.18)]" : "text-white/62 hover:bg-white/[0.07] hover:text-white"}`}><span className={`absolute left-0 top-2.5 h-6 w-1 rounded-r-full transition-colors ${active ? "bg-[#c5161d]" : "bg-transparent group-hover:bg-white/30"}`} /><span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${active ? "bg-[#f7e8e9] text-[#c5161d]" : "bg-white/[0.045] text-white/42 group-hover:bg-white/10 group-hover:text-white/85"}`}><Icon className="h-[16px] w-[16px]" /></span><span className="truncate">{item.label}</span>{active && <ChevronRight className="ml-auto h-4 w-4 text-[#c5161d]" />}</Link>;
}
