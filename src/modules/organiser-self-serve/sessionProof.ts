/**
 * Did this session prove the user owns their mailbox? (D-7, Lever 2.)
 *
 * The server decides with `_mailbox_proven_p5()`: the session's
 * auth.mfa_amr_claims must hold one of the methods below. Supabase copies the
 * same claims into the access token's `amr` array, so the browser can tell in
 * advance and offer "sign in with an email code" BEFORE the claim is refused.
 * This is a hint only; the RPC is the authority.
 */

const MAILBOX_METHODS = new Set(['otp', 'magiclink', 'recovery', 'email/signup', 'invite']);

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isMailboxProvenToken(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  const amr = decodePayload(accessToken)?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    const method = entry && typeof entry === 'object' ? (entry as { method?: unknown }).method : entry;
    return typeof method === 'string' && MAILBOX_METHODS.has(method);
  });
}
