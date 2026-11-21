export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value) || value.startsWith("/login")) return "/";
  return value;
}

export const startLogin = () => {
  if (window.location.pathname === "/login") return;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
};
