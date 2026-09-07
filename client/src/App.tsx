import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import { AssetDetail, AssetEdit, AssetForm, AssetRegistry, PublicActionPage } from "./pages/AssetPages";
import PublicAssetStatusPage from "./pages/PublicAssetStatusPage";
import { AuditPage, ImportPage, LifecyclePage, MaintenancePage, NotificationsPage, QrLabelsPage, ReportsPage, ScanPage, SettingsPage, BulkOperationsPage } from "./pages/OperationsPages";

function InternalRouter() {
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/assets/new" component={AssetForm} /><Route path="/assets/:id/edit" component={AssetEdit} /><Route path="/assets/:id" component={AssetDetail} /><Route path="/assets" component={AssetRegistry} /><Route path="/scan" component={ScanPage} /><Route path="/bulk" component={BulkOperationsPage} /><Route path="/lifecycle" component={LifecyclePage} /><Route path="/maintenance" component={MaintenancePage} /><Route path="/qr-labels" component={QrLabelsPage} /><Route path="/reports" component={ReportsPage} /><Route path="/audit" component={AuditPage} /><Route path="/settings" component={SettingsPage} /><Route path="/notifications" component={NotificationsPage} /><Route path="/import" component={ImportPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

function Router() { return <Switch><Route path="/asset/:token/checkout"><PublicActionPage action="checkout" /></Route><Route path="/asset/:token/report-damage"><PublicActionPage action="damage" /></Route><Route path="/asset/:token" component={PublicAssetStatusPage} /><Route component={InternalRouter} /></Switch>; }

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
