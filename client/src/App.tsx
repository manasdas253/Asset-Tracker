import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import { BulkUploadPage } from "./pages/BulkUploadPage";
import { AssetDetail, AssetEdit, AssetForm, AssetRegistry, PublicActionPage } from "./pages/AssetPages";
import PhysicalVerificationPage from "./pages/PhysicalVerificationPage";
import PublicAssetStatusPage from "./pages/PublicAssetStatusPage";
import { AuditPage, ImportPage, LifecyclePage, MaintenancePage, NotificationsPage, QrLabelsPage, ReportsPage, ScanPage, SettingsPage, BulkOperationsPage } from "./pages/OperationsPages";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./_core/hooks/useAuth";
import { EmployeeAccountsPage, FirstPasswordPage, ProfilePage } from "./pages/AccountPages";

function AuthGate({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading, error } = useAuth();
  if (loading) return <div role="status" className="p-12 text-center">Loading workspace...</div>;
  if (error) return <div role="alert" className="p-12 text-center">Unable to verify your session. Please reload.</div>;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <FirstPasswordPage />;
  if (admin && user.role !== "admin") return <div role="alert" className="p-12 text-center">Administrator access required.</div>;
  return <>{children}</>;
}

function EmployeeAssetPage() { return <PublicAssetStatusPage byId />; }

function EmployeeRouter() {
  return <DashboardLayout><Switch><Route path="/scan" component={ScanPage} /><Route path="/profile" component={ProfilePage} /><Route path="/assets/:id" component={EmployeeAssetPage} /><Route path="/" component={ProfilePage} /><Route><div role="alert">You do not have permission to access this page.</div></Route></Switch></DashboardLayout>;
}

function InternalRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#bde5e1] border-t-[#c5161d]" /></div>;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <FirstPasswordPage />;
  if (user.role !== "admin") return <EmployeeRouter />;
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/bulk-upload" component={BulkUploadPage} /><Route path="/assets/new" component={AssetForm} /><Route path="/assets/:id/edit" component={AssetEdit} /><Route path="/assets/:id" component={AssetDetail} /><Route path="/assets" component={AssetRegistry} /><Route path="/scan" component={ScanPage} /><Route path="/profile" component={ProfilePage} /><Route path="/employees" component={EmployeeAccountsPage} /><Route path="/bulk" component={BulkOperationsPage} /><Route path="/lifecycle" component={LifecyclePage} /><Route path="/maintenance" component={MaintenancePage} /><Route path="/qr-labels" component={QrLabelsPage} /><Route path="/reports" component={ReportsPage} /><Route path="/audit" component={AuditPage} /><Route path="/settings" component={SettingsPage} /><Route path="/notifications" component={NotificationsPage} /><Route path="/import" component={ImportPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

function Router() { return <Switch><Route path="/login" component={LoginPage} /><Route path="/asset/:token/verify"><AuthGate admin><PhysicalVerificationPage /></AuthGate></Route><Route path="/asset/:token/checkout"><AuthGate admin><PublicActionPage action="checkout" /></AuthGate></Route><Route path="/asset/:token/report-damage"><AuthGate admin><PublicActionPage action="damage" /></AuthGate></Route><Route path="/asset/:token"><AuthGate><PublicAssetStatusPage /></AuthGate></Route><Route component={InternalRouter} /></Switch>; }

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
