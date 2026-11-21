// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PhysicalVerificationPage from "./PhysicalVerificationPage";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  result: {} as any,
  query: {} as any,
}));
vi.mock("wouter", () => ({
  useRoute: () => [true, { token: "QR-EXISTING-TOKEN" }],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    asset: {
      publicByToken: { useQuery: () => mocks.query },
      verification: {
        submit: {
          useMutation: () => ({ mutate: mocks.mutate, ...mocks.result }),
        },
      },
    },
  },
}));
vi.mock("@/components/VerificationPhotos", () => ({
  VerificationPhotos: ({ onChange }: any) => (
    <button
      type="button"
      onClick={() =>
        onChange([
          { name: "proof.jpg", dataUrl: "data:image/jpeg;base64,/9j/" },
        ])
      }
    >
      Select photo
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.result = {};
});
function show() {
  mocks.query = {
    data: {
      asset: {
        id: 12,
        assetId: "ASSET-0012",
        name: "Scanned laptop",
        status: "available",
        locationName: "Main Store",
      },
    },
  };
  render(<PhysicalVerificationPage />);
}
describe("manual physical verification form", () => {
  it("links the scanned asset and leaves employee, date, time, location and condition blank", () => {
    show();
    expect(screen.getByText("ASSET-0012")).toBeTruthy();
    expect(screen.getByText("Scanned laptop")).toBeTruthy();
    for (const label of [
      "Employee Name",
      "Employee ID",
      "Verification Date",
      "Verification Time",
      "Verification Location",
      "Asset Condition",
    ])
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    expect(
      screen
        .getByRole("button", { name: "Save verification" })
        .hasAttribute("disabled")
    ).toBe(true);
  });
  it("submits exactly the entered details and photos for the scanned token", () => {
    show();
    for (const [label, value] of [
      ["Employee Name", "Manual Person"],
      ["Employee ID", "ANY001"],
      ["Verification Date", "2026-11-16"],
      ["Verification Time", "08:05"],
      ["Verification Location", "Other Store"],
      ["Asset Condition", "fair"],
      ["Remarks (optional)", "Observed manually"],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Select photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save verification" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      token: "QR-EXISTING-TOKEN",
      employeeName: "Manual Person",
      employeeCode: "ANY001",
      date: "2026-11-16",
      time: "08:05",
      location: "Other Store",
      condition: "fair",
      photos: [{ name: "proof.jpg", dataUrl: "data:image/jpeg;base64,/9j/" }],
      remarks: "Observed manually",
    });
  });
  it("shows a flagged result without claiming successful verification", () => {
    mocks.result = { data: { status: "Flagged" } };
    show();
    expect(screen.getByRole("status").textContent).toContain(
      "Flagged for admin review"
    );
    expect(screen.queryByLabelText("Employee Name")).toBeNull();
  });
  it("hides the form when asset access is denied", () => {
    mocks.query = { isError: true };
    render(<PhysicalVerificationPage />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Employee Name")).toBeNull();
  });
});
