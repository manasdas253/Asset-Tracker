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
import "./DashboardSidebar.css";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const visiblePrimary = isAdmin ? primaryNav : [{ label: "My profile", path: "/profile", icon: ShieldCheck }];
  const visibleWorkspace = isAdmin ? [...workspaceNav, { label: "Employee access", path: "/employees", icon: ShieldCheck }, { label: "My profile", path: "/profile", icon: ShieldCheck }] : [{ label: "Scan QR", path: "/scan", icon: ScanLine }];
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); const value = query.trim(); if (value) navigate(`/assets?search=${encodeURIComponent(value)}`); };
  const navItems = [...visiblePrimary, ...visibleWorkspace];
  const active = navItems.find(item => location === item.path) ?? navItems.find(item => item.path !== "/" && location.startsWith(item.path));

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#18212b]">
      <aside id="workspace-sidebar" className={`enterprise-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="enterprise-sidebar__header">
          <Link href="/" onClick={() => setMobileOpen(false)} className="enterprise-sidebar__brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101419]">
            <div className="enterprise-sidebar__logo"><img src="/iims-logo-white.png" alt="CKA Birla Group | IIMS" /></div>
          </Link>
          <button aria-label="Close navigation" className="enterprise-sidebar__close focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-[18px] w-[18px]" /></button>
        </div>

        <div className="enterprise-sidebar__scroll">
          <div className="enterprise-sidebar__workspace">
            <div className="enterprise-sidebar__avatar">OP</div>
            <div className="min-w-0"><p className="enterprise-sidebar__operator">{user?.name ?? "Workspace operator"}</p><p className="enterprise-sidebar__subtitle">Asset operations</p></div>
            <span className="enterprise-sidebar__status" />
          </div>
          <p className="enterprise-sidebar__section">Workspace</p>
          <nav aria-label="Workspace navigation" className="enterprise-sidebar__nav">
            {visiblePrimary.map(item => <NavItem key={item.path} item={item} active={active?.path === item.path} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
          <p className="enterprise-sidebar__section enterprise-sidebar__section--operations">Operations</p>
          <nav aria-label="Operations navigation" className="enterprise-sidebar__nav">
            {visibleWorkspace.map(item => <NavItem key={item.path} item={item} active={active?.path === item.path} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
        </div>

        <div className="enterprise-sidebar__footer">
          <ShieldCheck className="enterprise-sidebar__trust-icon" /><div className="min-w-0"><p className="enterprise-sidebar__trust-title">Trusted records</p><p className="enterprise-sidebar__trust-description">Every change is recorded with an immutable activity trail.</p></div>
        </div>
      </aside>

      {mobileOpen && <button aria-label="Close navigation overlay" className="enterprise-sidebar-overlay lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dfe3e7] bg-[#f4f6f8]/95 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Open navigation" aria-controls="workspace-sidebar" aria-expanded={mobileOpen} className="focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0">
              <div className="hidden items-center gap-2 text-[11px] font-semibold text-slate-400 sm:flex"><span>Workspace</span><ChevronRight className="h-3 w-3" /><span className="text-slate-600">{active?.label ?? "Overview"}</span></div>
              <p className="truncate text-sm font-bold tracking-[-0.02em] text-slate-900 sm:mt-1">{active?.label ?? "Overview"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isAdmin && <form onSubmit={submitSearch} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm lg:flex"><Search className="h-4 w-4 text-slate-400" /><input ref={searchRef} aria-label="Search assets by Asset ID, serial, brand, or model" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assets" className="h-9 w-44 bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 xl:w-56" /><kbd className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">⌘K</kbd></form>}
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm md:flex"><span className="h-2 w-2 rounded-full bg-[#1bb89d]" /> Live workspace</div>
            {isAdmin && <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#7ccbc7] hover:text-[#0b6f73]"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f68172]" /></Link>}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#123f57] text-xs font-black text-white">OP</div><div className="hidden sm:block"><p className="text-xs font-bold text-slate-800">{user?.name ?? "Workspace operator"}</p><p className="text-[10px] text-slate-400">{isAdmin ? "Administrator" : "Employee"}</p></div></div>
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
  return <Link href={item.path} onClick={handleClick} aria-current={active ? "page" : undefined} className={`enterprise-sidebar__link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d71920] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101419] ${active ? "is-active" : ""}`}><span className="enterprise-sidebar__link-icon"><Icon aria-hidden="true" /></span><span className="enterprise-sidebar__link-label">{item.label}</span>{active && <ChevronRight aria-hidden="true" className="enterprise-sidebar__active-chevron" />}</Link>;
}
