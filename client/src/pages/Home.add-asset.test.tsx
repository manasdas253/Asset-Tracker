// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", () => ({
  Link: ({ href, children, onClick, ...props }: any) => (
    <a href={href} onClick={(event) => {
      onClick?.(event);
      if (!event.defaultPrevented) navigate(href);
    }} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    asset: {
      dashboard: { useQuery: () => ({ isLoading: false, data: { kpis: { total: 9, available: 3, assigned: 1, checkedOut: 2, underMaintenance: 1, damaged: 1, lost: 1, retired: 1, utilization: 22, totalCost: 0, dueWarranty: 0, maintenanceDue: 0 }, status: [{ key: "available", name: "Available", value: 3 }, { key: "assigned", name: "Assigned", value: 1 }, { key: "checked_out", name: "Checked Out", value: 2 }, { key: "under_maintenance", name: "Under Maintenance", value: 1 }, { key: "lost", name: "Lost", value: 1 }, { key: "damaged", name: "Damaged", value: 1 }, { key: "retired", name: "Retired", value: 1 }, { key: "disposed", name: "Disposed", value: 0 }], conditions: [{ key: "good", name: "Good", value: 7 }, { key: "damaged", name: "Damaged", value: 1 }], categories: [], departments: [], activity: [], warranty: [] }, refetch: vi.fn() }) },
      seedDemo: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("recharts", () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  const Empty = () => null;
  return { Bar: Empty, BarChart: Box, CartesianGrid: Empty, Cell: Empty, Line: Empty, LineChart: Box, Pie: Empty, PieChart: Box, ResponsiveContainer: Box, Tooltip: Empty, XAxis: Empty, YAxis: Empty };
});

import Home from "./Home";

afterEach(() => { cleanup(); navigate.mockReset(); });

describe("Home Add asset CTA", () => {
  it("renders current statuses separately from actions and condition signals", () => {
    render(<Home />);
    const statusCard = within(screen.getByTestId("asset-status-card"));
    expect(statusCard.getAllByText("Available").length).toBe(3);
    expect(statusCard.getAllByText("Checked Out").length).toBe(2);
    expect(statusCard.getByText("Under Maintenance")).toBeTruthy();
    expect(statusCard.getByText("Lost")).toBeTruthy();
    expect(statusCard.getByText("Retired")).toBeTruthy();
    expect(statusCard.getByText("Disposed")).toBeTruthy();
    expect(statusCard.queryByText("Assigned")).toBeNull();
    expect(statusCard.getByText("Check Out")).toBeTruthy();
    expect(statusCard.getByText("Check In")).toBeTruthy();
    expect(statusCard.getByText(/Condition signal · Damaged/)).toBeTruthy();
    expect(statusCard.getByText("Lifecycle flow")).toBeTruthy();
  });

  it("navigates to the Registration page when clicked", () => {
    render(<Home />);
    const addAsset = screen.getByRole("link", { name: /Add asset/i });
    expect(addAsset.getAttribute("href")).toBe("/assets/new");
    fireEvent.click(addAsset);
    expect(navigate).toHaveBeenCalledWith("/assets/new");
  });
});
