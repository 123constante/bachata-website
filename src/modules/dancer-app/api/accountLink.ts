import { rpcLoose } from '@/integrations/supabase/rpcLoose';

/**
 * Buyer duplicate-account linking (brief docs/briefs/onboard-dups-website.md; DB half admin
 * migration 20270323070000). A buyer proves they own their OTHER account with a 6-digit code
 * mailed to that email; nothing merges without it. Every RPC answers `error:'disabled'` while
 * app_feature_flags.buyer_account_link is off: the UI then hides itself quietly.
 *
 * Shapes read from prod (pg_get_functiondef, 2026-11-18). Not in types.ts yet, so rpcLoose.
 */
export const ACCOUNT_LINK_RPC = {
  request: 'request_account_link_v1', // (p_other_email text) -> jsonb
  confirm: 'confirm_account_link_v1', // (p_code text) -> jsonb
  list: 'my_account_links_v1', // () -> jsonb {ok, links:[{user_id,email,linked_at}]}
  unlink: 'unlink_account_v1', // (p_other_user_id uuid) -> jsonb {ok, unlinked}
} as const;

export type LinkedAccount = { userId: string; email: string; linkedAt: string | null };

/** ok=false carries `code`: 'disabled' = flag off (hide); 'error' = transport / unknown failure. */
export type LinkResult<T = null> = { ok: boolean; code: string; value: T | null };
const fail = <T = null>(code: string): LinkResult<T> => ({ ok: false, code, value: null });

/** The neutral answer to "Send code": the same whether or not the email has an account. */
export const SENT_LINE = "If that email has an account, we've sent a code. It works for 15 minutes.";
/** With one order's card in view (?o=) the card shows that order only, so "here" would not be true yet. */
export const linkedLine = (email: string, orderInView = false) =>
  orderInView ? `Linked. Tickets from ${email} now show on this account.` : `Linked. Tickets from ${email} now show here.`;

/** Every refusal the four RPCs can return, as a plain sentence with a way forward. */
export const LINK_ERROR_COPY: Record<string, string> = {
  invalid_email: 'Enter a valid email, like you@example.com.',
  own_email: 'That is the email you are signed in with. Enter your other email.',
  rate_limited: 'You have asked for too many codes. Try again in an hour.',
  not_signed_in: 'You are signed out. Sign in again, then link your other email.',
  wrong_code: 'That code is not right. Check the email and try again.',
  expired: 'That code has expired. Send a new code.',
  too_many_attempts: 'Too many tries. Send a new code, or try again tomorrow.',
  no_pending_request: 'That code is no longer active. Send a new code.',
  error: 'Something went wrong. Check your connection and try again.',
};
export const linkErrorLine = (code: string): string => LINK_ERROR_COPY[code] ?? LINK_ERROR_COPY.error;
/** Refusals after which the only way on is a fresh code (step 1 again). */
export const NEEDS_NEW_CODE = new Set(['expired', 'too_many_attempts', 'no_pending_request']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

async function call(fn: string, args?: Record<string, unknown>): Promise<LinkResult<Record<string, unknown>>> {
  try {
    const { data, error } = await rpcLoose(fn, args);
    if (error || !isRecord(data)) return fail('error');
    if (data.ok === true) return { ok: true, code: '', value: data };
    return fail(typeof data.error === 'string' ? data.error : 'error');
  } catch {
    return fail('error');
  }
}

export const parseLinks = (v: unknown): LinkedAccount[] =>
  (Array.isArray(v) ? v : []).flatMap((r) =>
    isRecord(r) && typeof r.user_id === 'string' && typeof r.email === 'string'
      ? [{ userId: r.user_id, email: r.email, linkedAt: typeof r.linked_at === 'string' ? r.linked_at : null }]
      : [],
  );

export async function fetchAccountLinks(): Promise<LinkResult<LinkedAccount[]>> {
  const r = await call(ACCOUNT_LINK_RPC.list);
  return r.ok ? { ok: true, code: '', value: parseLinks(r.value?.links) } : fail(r.code);
}

export async function requestAccountLink(email: string): Promise<LinkResult> {
  const r = await call(ACCOUNT_LINK_RPC.request, { p_other_email: email.trim() });
  return r.ok ? { ok: true, code: '', value: null } : fail(r.code);
}

export async function confirmAccountLink(code: string): Promise<LinkResult> {
  const r = await call(ACCOUNT_LINK_RPC.confirm, { p_code: code });
  return r.ok ? { ok: true, code: '', value: null } : fail(r.code);
}

export async function unlinkAccount(userId: string): Promise<LinkResult> {
  const r = await call(ACCOUNT_LINK_RPC.unlink, { p_other_user_id: userId });
  return r.ok ? { ok: true, code: '', value: null } : fail(r.code);
}
