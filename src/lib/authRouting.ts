export const AUTH_PENDING_RETURN_TO_KEY = "auth_pending_return_to";

export const sanitizeReturnTo = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed === "/auth" || trimmed.startsWith("/auth/")) return null;
  if (trimmed === "/auth/callback" || trimmed.startsWith("/auth/callback")) return null;
  return trimmed;
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