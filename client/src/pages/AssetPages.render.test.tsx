// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetDetail } from "./AssetPages";

const asset = { id: 1, assetId: "AST-000001", name: "Test Laptop", isDemo: 0, status: "available", condition: "good", categoryName: "Computers", assetType: "Laptop", serialNumber: "SN-1", brand: "Test", model: "Book", currency: "INR", purchaseCost: "1000.00", lastActivityAt: new Date(), locationName: "HQ", departmentName: "Engineering", assignedEmployeeName: null, assignedEmployeeCode: null, expectedReturnDate: null, warrantyExpiryDate: null };
const detail = { asset, qr: { token: "QR-TESTTOKEN123", publicUrl: "https://example.com/asset/QR-TESTTOKEN123", qrDataUrl: "data:image/png;base64,abc" }, events: [], transactions: [], assignments: [], maintenance: [], audits: [], documents: [] };

vi.mock("@/lib/trpc", () => ({ trpc: { asset: { byId: { useQuery: () => ({ isLoading: false, data: detail }) }, addDocument: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } }, useUtils: () => ({ asset: { byId: { invalidate: vi.fn() }, list: { invalidate: vi.fn() }, dashboard: { invalidate: vi.fn() } } }) } }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>, useRoute: () => [true, { id: "1" }] }));

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/assets/1"); });

describe("AssetDetail rendered tabs", () => {
  it("renders every required tab trigger", () => {
    render(<AssetDetail />);
    for (const label of ["Overview", "Assignment", "QR identity", "Lifecycle", "Maintenance", "Audit history", "Documents & photos"]) expect(screen.getByRole("tab", { name: label })).toBeTruthy();
  });

  it("renders each tab content from a deep link", () => {
    for (const [tab, content] of [["overview", "Identification"], ["assignment", "Current accountability"], ["qr", "Persistent QR identity"], ["lifecycle", "No lifecycle events recorded yet."], ["maintenance", "Maintenance records"], ["audit", "Immutable audit events"], ["documents", "Attach a document or photo"]] as const) {
      cleanup();
      window.history.replaceState({}, "", `/assets/1?tab=${tab}`);
      render(<AssetDetail />);
      expect(screen.getByText(content)).toBeTruthy();
    }
  });

  it.each([["assignment", "Current accountability"], ["qr", "Persistent QR identity"], ["documents", "Attach a document or photo"]])("activates the %s tab from its query parameter", (tab, content) => {
    window.history.replaceState({}, "", `/assets/1?tab=${tab}`);
    render(<AssetDetail />);
    expect(screen.getByText(content)).toBeTruthy();
  });
});
