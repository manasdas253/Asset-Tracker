// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

const navigate = vi.fn();
let currentLocation = "/";
let currentRole = "admin";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: currentRole, name: "Test operator" }, logout: vi.fn() }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, onClick, ...props }: any) => <a href={href} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) navigate(href); }} {...props}>{children}</a>,
  useLocation: () => [currentLocation, navigate],
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

afterEach(() => {
  cleanup();
  navigate.mockReset();
  currentLocation = "/";
  currentRole = "admin";
});

describe("DashboardLayout sidebar accessibility", () => {
  it("limits employee navigation to profile and scanner", () => {
    currentRole = "employee";
    render(<DashboardLayout><div>Employee content</div></DashboardLayout>);
    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: "Scan QR" }).getAttribute("href")).toBe("/scan");
    for (const label of ["Overview", "Asset registry", "Add asset", "Reports", "Employee access"]) expect(screen.queryByRole("link", { name: label })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Search assets/ })).toBeNull();
  });

  it("exposes a visible focus contract for sidebar links", () => {
    render(<DashboardLayout><div>Page content</div></DashboardLayout>);
    const overview = screen.getByRole("link", { name: "Overview" });
    overview.focus();
    expect(document.activeElement).toBe(overview);
    expect(overview.className).toContain("focus-visible:ring-2");
    expect(overview.getAttribute("aria-current")).toBe("page");
  });

  it("keeps the Home Add asset entry point on registration", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain('href="/assets/new"');
  });

  it("highlights Registration instead of Asset registry on /assets/new", () => {
    currentLocation = "/assets/new";
    render(<DashboardLayout><div>Page content</div></DashboardLayout>);
    expect(screen.getByRole("link", { name: "Add asset" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Asset registry" }).getAttribute("aria-current")).toBeNull();
  });

  it("routes Add asset directly to registration", () => {
    render(<DashboardLayout><div>Page content</div></DashboardLayout>);
    fireEvent.click(screen.getByRole("link", { name: "Add asset" }));
    expect(navigate).toHaveBeenCalledWith("/assets/new");
  });

  it("preserves the Asset registry navigation route on click", () => {
    render(<DashboardLayout><div>Page content</div></DashboardLayout>);
    const registry = screen.getByRole("link", { name: "Asset registry" });
    expect(registry.getAttribute("href")).toBe("/assets");
    fireEvent.click(registry);
    expect(navigate).toHaveBeenCalledWith("/assets");
  });

  it("opens and closes mobile navigation with labeled controls", () => {
    render(<DashboardLayout><div>Page content</div></DashboardLayout>);
    const open = screen.getByRole("button", { name: "Open navigation" });
    open.focus();
    expect(document.activeElement).toBe(open);
    expect(open.className).toContain("focus-visible:ring-2");
    fireEvent.click(open);
    const close = screen.getByRole("button", { name: "Close navigation" });
    close.focus();
    expect(document.activeElement).toBe(close);
    expect(close.className).toContain("focus-visible:ring-2");
    fireEvent.click(close);
  });
});
