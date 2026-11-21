// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "./App";

const mocks = vi.hoisted(() => ({ user: null as null | { role: string; mustChangePassword: boolean } }));
vi.mock("./_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false, error: null }) }));
vi.mock("./components/DashboardLayout", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("./components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("./pages/LoginPage", () => ({ default: () => <div>Employee login form</div> }));
vi.mock("./pages/Home", () => ({ default: () => <div>Admin dashboard</div> }));
vi.mock("./pages/AccountPages", () => ({ FirstPasswordPage: () => <div>Mandatory password change</div>, ProfilePage: () => <div>Employee profile</div>, EmployeeAccountsPage: () => <div>Account administration</div> }));
vi.mock("./pages/PublicAssetStatusPage", () => ({ default: ({ byId }: any) => <div>{byId ? "Authorized direct asset view" : "Authorized QR view"}</div> }));
vi.mock("./pages/OperationsPages", () => ({ ScanPage: () => <div>QR scanner</div>, AuditPage: () => null, ImportPage: () => null, LifecyclePage: () => null, MaintenancePage: () => null, NotificationsPage: () => null, QrLabelsPage: () => null, ReportsPage: () => null, SettingsPage: () => null, BulkOperationsPage: () => null }));
afterEach(() => { cleanup(); mocks.user = null; });
function visit(path: string) {
  const location = memoryLocation({ path });
  render(<Router hook={location.hook}><App /></Router>);
}
describe("authentication route boundaries", () => {
  it("requires a login when an existing QR URL is opened", () => {
    visit("/asset/QR-EXISTING");
    expect(screen.getByText("Employee login form")).toBeTruthy();
    expect(screen.queryByText("Authorized QR view")).toBeNull();
  });
  it("requires a password change before opening a QR", () => {
    mocks.user = { role: "employee", mustChangePassword: true };
    visit("/asset/QR-EXISTING");
    expect(screen.getByText("Mandatory password change")).toBeTruthy();
    expect(screen.queryByText("Authorized QR view")).toBeNull();
  });
  it.each(["/employees", "/assets/1/edit", "/reports", "/bulk-upload"])("denies employee navigation to %s", path => {
    mocks.user = { role: "employee", mustChangePassword: false };
    visit(path);
    expect(screen.getByRole("alert").textContent).toContain("do not have permission");
  });
  it.each([["/profile", "Employee profile"], ["/scan", "QR scanner"], ["/assets/1", "Authorized direct asset view"], ["/asset/QR-EXISTING", "Authorized QR view"]])("renders the employee surface at %s", (path, text) => {
    mocks.user = { role: "employee", mustChangePassword: false };
    visit(path);
    expect(screen.getByText(text)).toBeTruthy();
  });
  it("denies employee QR actions", () => {
    mocks.user = { role: "employee", mustChangePassword: false };
    visit("/asset/QR-EXISTING/checkout");
    expect(screen.getByRole("alert").textContent).toContain("Administrator access required");
  });
  it("keeps account administration available to Admin", () => {
    mocks.user = { role: "admin", mustChangePassword: false };
    visit("/employees");
    expect(screen.getByText("Account administration")).toBeTruthy();
  });
});
