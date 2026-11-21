// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordForm } from "./AccountPages";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ invalidate: vi.fn() }), auth: { changePassword: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } } } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("mandatory first password change", () => {
  function fill(confirm: string) {
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "Temporary password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "A personal password 123!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  }
  it("requires matching confirmation before submitting", () => {
    render(<PasswordForm required />);
    fill("A different password 456!");
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("New passwords do not match.");
  });
  it("submits the current password and a new personal password", () => {
    render(<PasswordForm required />);
    fill("A personal password 123!");
    expect(mocks.mutate).toHaveBeenCalledWith({ currentPassword: "Temporary password", newPassword: "A personal password 123!" });
    expect(screen.getByLabelText("New password").getAttribute("minLength")).toBe("12");
  });
});
