// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PhysicalVerificationPanel } from "./PhysicalVerificationPanel";
import type { VerificationRow } from "@shared/physicalVerification";
const mocks = vi.hoisted(() => ({
  report: {} as any,
  export: vi.fn(),
  review: vi.fn(),
  cycle: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    asset: {
      verification: {
        report: { useQuery: () => mocks.report },
        review: { useMutation: () => ({ mutate: mocks.review }) },
        startCycle: { useMutation: () => ({ mutate: mocks.cycle }) },
      },
    },
  },
}));
vi.mock("@/lib/physicalVerificationXlsx", () => ({
  downloadPhysicalVerificationXlsx: mocks.export,
}));
const base: VerificationRow = {
  id: 1,
  assetDbId: 1,
  assetCode: "MATCHED-001",
  assetName: "Laptop",
  category: "IT",
  status: "Verified",
  employeeName: "Manual Person",
  employeeCode: "ANY001",
  date: "2026-11-16",
  time: "08:05",
  location: "Main Store",
  registeredLocation: "Main Store",
  condition: "good",
  photos: [],
  remarks: "All good",
  latestVerificationDate: "2026-11-16 08:05",
  review: "",
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function show() {
  const rows = [
    base,
    {
      ...base,
      id: 2,
      assetDbId: 2,
      assetCode: "FLAGGED-002",
      status: "Flagged",
      location: "Wrong Store",
      employeeName: "Another Person",
      condition: "damaged",
      photos: [
        { id: 4, name: "proof.jpg", dataUrl: "data:image/jpeg;base64,/9j/" },
      ],
    },
    {
      ...base,
      id: null,
      assetDbId: 3,
      assetCode: "PENDING-003",
      status: "Pending",
      date: "",
      time: "",
      employeeName: "",
      employeeCode: "",
      location: "",
      photos: [],
    },
  ];
  mocks.report = {
    data: { cycle: { name: "November cycle" }, rows, history: [base] },
    refetch: vi.fn(),
  };
  render(<PhysicalVerificationPanel />);
}
describe("Physical Verification admin log", () => {
  it("filters by status and exports only the displayed rows", () => {
    show();
    expect(screen.getByRole("cell", { name: /PENDING-003/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Verification Status"), {
      target: { value: "Flagged" },
    });
    expect(screen.queryByRole("cell", { name: /MATCHED-001/ })).toBeNull();
    expect(screen.queryByRole("cell", { name: /PENDING-003/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review details" }));
    expect(screen.getByAltText("proof.jpg")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Download Physical Verification/ })
    );
    expect(mocks.export).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          assetCode: "FLAGGED-002",
          status: "Flagged",
        }),
      ],
      "November cycle"
    );
  });
  it("combines employee, location, condition and date filters", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Employee name / ID"), {
      target: { value: "ANY001" },
    });
    fireEvent.change(screen.getByLabelText("Verification location"), {
      target: { value: "Main" },
    });
    fireEvent.change(screen.getByLabelText("Asset Condition"), {
      target: { value: "good" },
    });
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-11-16" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-11-17" },
    });
    expect(screen.getByRole("cell", { name: /MATCHED-001/ })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: /FLAGGED-002/ })).toBeNull();
    expect(screen.queryByRole("cell", { name: /PENDING-003/ })).toBeNull();
  });
  it("saves admin mismatch notes against the verification ID", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Review details" }));
    fireEvent.change(screen.getByLabelText("Review FLAGGED-002"), {
      target: { value: "Investigated the mismatch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    expect(mocks.review).toHaveBeenCalledWith({
      id: 2,
      notes: "Investigated the mismatch",
    });
  });
  it("starts a named cycle and offers historical records", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "New cycle" }));
    fireEvent.change(screen.getByLabelText("New verification cycle"), {
      target: { value: "December count" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start new cycle" }));
    expect(mocks.cycle).toHaveBeenCalledWith({ name: "December count" });
    fireEvent.click(screen.getByRole("button", { name: "All history" }));
    expect(screen.getByRole("cell", { name: /MATCHED-001/ })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: /PENDING-003/ })).toBeNull();
  });
  it("filters from summary cards and clears the empty result state", () => {
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "Filter Flagged assets" })
    );
    expect(screen.queryByRole("cell", { name: /MATCHED-001/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Asset / category"), {
      target: { value: "no-such-asset" },
    });
    expect(screen.getByText("No matching records")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("cell", { name: /MATCHED-001/ })).toBeTruthy();
    expect(screen.getByRole("cell", { name: /PENDING-003/ })).toBeTruthy();
  });
});
