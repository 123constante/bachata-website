export const AUTH_PENDING_RETURN_TO_KEY = "auth_pending_return_to";

/**
 * `exclude`: a page that must not be the target either -- a screen's own "go
 * back" link pointing at itself (Skip on /finish-profile?returnTo=/finish-profile
 * went nowhere). Judged by the same decoded, case-folded path as /auth.
 */
export const sanitizeReturnTo = (value: string | null, opts: { exclude?: string } = {}): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  // Backslashes and control characters: browsers' URL parsers turn "/\\evil" and
  // "/\t/evil" into the protocol-relative "//evil", i.e. off-site.
  for (const ch of trimmed) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || code < 0x20 || code === 0x7f) return null;
  }
  // Judge the PATH alone, decoded and case-folded the way the router matches it:
  // "/auth?mode=x", "/Auth" and "/%61uth" are all the auth page, and would
  // bounce a reader straight back to it.
  let path: string;
  try {
    path = decodeURIComponent(trimmed.split(/[?#]/, 1)[0]).toLowerCase();
  } catch {
    return null;
  }
  if (path === "/auth" || path.startsWith("/auth/")) return null;
  const excluded = opts.exclude?.toLowerCase();
  if (excluded && (path === excluded || path === `${excluded}/`)) return null;
  return trimmed;
};

// The shared "sign in (or up), then come back here" URL. An unsafe returnTo
// (off-site, or an auth page itself) is dropped, leaving plain /auth?mode=...
export const buildSignInHref = (returnTo: string | null, mode: "signin" | "signup" = "signin"): string => {
  const safe = sanitizeReturnTo(returnTo);
  return `/auth?mode=${mode}${safe ? `&returnTo=${encodeURIComponent(safe)}` : ""}`;
};

export const stashPendingReturnTo = (returnTo: string | null) => {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (!safeReturnTo) return;
  localStorage.setItem(AUTH_PENDING_RETURN_TO_KEY, safeReturnTo);
};

export const popPendingReturnTo = (): string | null => {
  const safeReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
  localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
  return safeReturnTo;
};