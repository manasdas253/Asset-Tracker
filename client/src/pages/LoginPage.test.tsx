// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import { safeReturnTo } from "@/const";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), error: null as null | { message: string } }));
vi.mock("@/lib/trpc", () => ({ trpc: { auth: { login: { useMutation: () => ({ mutate: mocks.mutate, isPending: false, error: mocks.error }) } } } }));
afterEach(() => { cleanup(); mocks.mutate.mockReset(); mocks.error = null; });

describe("local employee login", () => {
  it("submits Employee ID/password and preserves the existing brand panel", () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "EMP001" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Temporary secret password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ employeeId: "EMP001", password: "Temporary secret password" });
    expect(screen.getAllByAltText("CKA Birla Group | IIMS").length).toBe(2);
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });
  it("shows rejected login feedback without exposing a password", () => {
    mocks.error = { message: "Invalid Employee ID or password, or account unavailable." };
    render(<LoginPage />);
    expect(screen.getByRole("alert").textContent).toBe(mocks.error.message);
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
  });
  it("preserves local QR return paths and rejects external redirects", () => {
    expect(safeReturnTo("/asset/QR-EXISTING?scan=1")).toBe("/asset/QR-EXISTING?scan=1");
    for (const path of ["https://attacker.example", "//attacker.example", "/\\attacker.example", "/login?returnTo=//attacker.example", null]) expect(safeReturnTo(path)).toBe("/");
  });
});
