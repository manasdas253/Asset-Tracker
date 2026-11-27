// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), download: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ asset: { qrExport: { fetch: mocks.fetch } } }) } }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/lib/qrExport", async original => ({ ...(await original<typeof import("@/lib/qrExport")>()), downloadBytes: mocks.download }));

import { QrExportButton } from "./QrExportButton";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("QrExportButton", () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it("fetches the filtered QR codes and downloads one ZIP", async () => {
    mocks.fetch.mockResolvedValueOnce({ items: [{ id: 1, assetId: "AST-1", name: "Laptop", serialNumber: null, categoryName: null, departmentName: null, locationName: "Noida Office", status: "available", publicUrl: "https://x/asset/a", qrDataUrl: PNG }], nextAfterId: null, total: 1 });
    render(<QrExportButton filters={{ location: "Noida Office" }} />);
    fireEvent.click(screen.getByRole("button", { name: /export qr/i }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    expect(mocks.fetch).toHaveBeenCalledWith({ location: "Noida Office", afterId: 0, limit: 250 }, { staleTime: 0 });
    expect(mocks.download.mock.calls[0][1]).toMatch(/^QR-codes_Noida-Office_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining("Exported 1 QR codes"));
  });

  it("tells the user when nothing matches instead of downloading an empty file", async () => {
    mocks.fetch.mockResolvedValueOnce({ items: [], nextAfterId: null, total: 0 });
    render(<QrExportButton />);
    fireEvent.click(screen.getByRole("button", { name: /export qr/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("reports a failed request and re-enables the button", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Network down"));
    render(<QrExportButton />);
    fireEvent.click(screen.getByRole("button", { name: /export qr/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("QR export failed: Network down"));
    await waitFor(() => expect((screen.getByRole("button", { name: /export qr/i }) as HTMLButtonElement).disabled).toBe(false));
  });
});
