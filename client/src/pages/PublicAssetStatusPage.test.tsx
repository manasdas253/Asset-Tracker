// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicAssetStatusPage from "./PublicAssetStatusPage";

vi.mock("@/components/VerificationSummary", () => ({ VerificationSummary: () => null }));
const mocks = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn(), user: { role: "admin" } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { asset: { publicByToken: { useQuery: mocks.query }, byId: { useQuery: vi.fn(() => ({})) } } } }));
vi.mock("wouter", () => ({ useRoute: () => [true, { token: "QR-PERMANENT" }], Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
afterEach(() => cleanup());

const asset = { assetId: "IIMS-IT-0012", name: "Dell Laptop", model: "Latitude 5440", modelNumber: "5440", serialNumber: "7K2F9Q3", purchaseDate: new Date("2026-03-15T00:00:00Z"), locationName: "Hyderabad HO", status: "available", manufacturer: "Dell", warrantyTerms: "Three year onsite", notes: "Handle with care", currency: "INR", purchaseCost: "0.00", building: "Tower A", floor: "4", description: "Office laptop" };
const result = (record = asset) => ({ data: { asset: record, qr: { token: "QR-PERMANENT" } }, isLoading: false, isError: false });

describe("public scan view", () => {
  it("clears cached details immediately after a denied refresh", () => {
    mocks.query.mockReturnValue(result());
    const view = render(<PublicAssetStatusPage />);
    expect(screen.getByRole("heading", { name: "Dell Laptop" })).toBeTruthy();
    mocks.query.mockReturnValue({ ...result(), isError: true });
    view.rerender(<PublicAssetStatusPage />);
    expect(screen.queryByText("Dell Laptop")).toBeNull();
    expect(screen.getByText("Asset details unavailable")).toBeTruthy();
  });

  it("hides checkout and damage actions from employees", () => {
    mocks.user.role = "employee";
    mocks.query.mockReturnValue(result());
    render(<PublicAssetStatusPage />);
    expect(screen.queryByRole("button", { name: "Check out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Report damage" })).toBeNull();
    mocks.user.role = "admin";
  });

  it("shows the complete authorized product record", () => {
    mocks.query.mockReturnValue(result());
    render(<PublicAssetStatusPage />);
    for (const value of ["Latitude 5440", "7K2F9Q3", "15 Mar 2026", "Hyderabad HO", "Tower A", "Three year onsite", "Handle with care", "Office laptop", "INR 0.00"]) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(mocks.query).toHaveBeenCalledWith({ token: "QR-PERMANENT" }, expect.objectContaining({ refetchInterval: 15000, refetchOnWindowFocus: true, refetchOnMount: "always" }));
  });

  it("renders updated details using the same token", () => {
    mocks.query.mockReturnValue(result());
    const view = render(<PublicAssetStatusPage />);
    mocks.query.mockReturnValue(result({ ...asset, locationName: "Mumbai Office", status: "checked_out" }));
    view.rerender(<PublicAssetStatusPage />);
    expect(screen.getByText("Mumbai Office")).toBeTruthy();
    expect(screen.queryByText("Hyderabad HO")).toBeNull();
    expect(screen.getByRole("button", { name: "Checked out" }).hasAttribute("disabled")).toBe(true);
  });

  it("distinguishes an inactive QR from a connection error", () => {
    mocks.query.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    const view = render(<PublicAssetStatusPage />);
    expect(screen.getByText("Asset not found")).toBeTruthy();
    mocks.query.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.refetch });
    view.rerender(<PublicAssetStatusPage />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
