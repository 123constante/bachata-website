// Pure model for the Option B join on /invite (PLAN.md section 4, W1). The step is DERIVED from server
// truth on every render -- the invite preview, the session, the profile completeness, the membership --
// never kept as local state, so a reload, the back button or a second device all resume correctly.
// Action outcomes (a code sent, a refused redeem) are mapped here too, one mapping per fact.
import { isOtpRateLimitedError, isSignupAllowlistRefusal, type SignupRole } from '@/lib/auth-otp-routing';
import { PROFILE_INCOMPLETE_CODE } from '@/lib/accountRouting';
import type { ProfileCompletionStatus } from '@/lib/profileCompletion';
import { hintMatchesEmail, parsePreview, type InvitePreview } from '../inviteModel';

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** The profile a person-bound invite is for: a first name, a photo and a city, never an email or an id. */
export interface JoinPerson {
  firstName: string | null;
  avatarUrl: string | null;
  city: string | null;
}

/** What the sender typed for a new person: pre-fills About you (it is never saved by itself). */
export interface JoinPrefill {
  firstName: string | null;
  cityId: string | null;
}

/**
 * The preview plus A2's two objects (orchestrator contract decision, 2026-10-23):
 * `person` = { first_name, avatar_url, city } -- present = a person-bound invite, absent = a page invite
 * (no person_profile_id is exposed); `prefill` = { first_name, city_id }. Agreed names: person, prefill.
 */
export interface JoinPreview extends InvitePreview {
  person: JoinPerson | null;
  prefill: JoinPrefill | null;
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function parseJoinPreview(raw: unknown): JoinPreview | null {
  const base = parsePreview(raw);
  if (!base) return null;
  const r = raw as Record<string, unknown>;
  const person = obj(r.person);
  const prefill = obj(r.prefill);
  return {
    ...base,
    person: person ? { firstName: str(person.first_name), avatarUrl: str(person.avatar_url), city: str(person.city) } : null,
    prefill: prefill ? { firstName: str(prefill.first_name), cityId: str(prefill.city_id) } : null,
  };
}

/** A person-bound invite: the server named the profile this link is for. */
export const isPersonBound = (p: JoinPreview | null | undefined): boolean => p?.person != null;

// ---- the step table -------------------------------------------------------------------------

export type JoinStep =
  | 'checking'
  | 'dead'
  | 'unreachable'
  | 'email'
  | 'code'
  | 'about'
  | 'join'
  | 'done'
  | 'wrong_account'
  | 'no_profile';

export type DeadReason = 'used' | 'expired' | 'revoked' | 'invalid';

export interface DeriveInput {
  /** 'loading' while the preview is in flight; 'failed' when the lookup itself failed; null when the server knows no such link. */
  preview: 'loading' | 'failed' | JoinPreview | null;
  authStatus: 'resolving' | 'ready';
  user: { email?: string | null } | null;
  /** `?step=code&email=` from the address bar (signed out only). */
  url: { step: string | null; email: string | null };
  completion: ProfileCompletionStatus;
  /** Already on this organiser's team (own home list matched by name); null while that is still being read. */
  member: boolean | null;
  /** This visit's redeem landed (redeemed or already_member). */
  redeemed: boolean;
  /** A used link, signed in: the one redeem call that tells "used by me" from "used by someone else" is in flight. */
  usedCheckPending: boolean;
}

export type Derived = { step: Exclude<JoinStep, 'dead'> } | { step: 'dead'; reason: DeadReason };

export const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** THE step table (PLAN.md section 4), in precedence order. */
export function deriveJoinStep(i: DeriveInput): Derived {
  if (i.preview === 'loading') return { step: 'checking' };
  if (i.preview === 'failed') return { step: 'unreachable' };
  if (i.redeemed) return { step: 'done' };
  if (i.preview === null) return { step: 'dead', reason: 'invalid' };
  if (i.preview.status !== 'open') {
    if (i.authStatus === 'resolving') return { step: 'checking' };
    if (i.preview.status === 'used' && i.user && i.usedCheckPending) return { step: 'checking' };
    return { step: 'dead', reason: i.preview.status };
  }
  if (i.authStatus === 'resolving') return { step: 'checking' };
  if (!i.user) {
    const email = i.url.email?.trim() ?? '';
    return i.url.step === 'code' && EMAIL_SHAPE.test(email) ? { step: 'code' } : { step: 'email' };
  }
  if (i.preview.emailHint && !hintMatchesEmail(i.preview.emailHint, i.user.email)) return { step: 'wrong_account' };
  if (i.member === true) return { step: 'done' };
  if (i.completion === 'loading' || i.completion === 'signed_out') return { step: 'checking' };
  if (i.completion === 'error') return { step: 'unreachable' };
  if (i.completion === 'no_profile') return { step: 'no_profile' };
  if (i.completion === 'incomplete') return { step: 'about' };
  if (i.member === null) return { step: 'checking' };
  return { step: 'join' };
}

/**
 * The "Step n of 3" bar over email/code, about and join. The total is ALWAYS 3: a signed-out person cannot
 * know yet whether their profile is complete, so a total that dropped to 2 once they signed in made the
 * count change mid-journey (1 of 3, then 2 of 2). A complete account simply skips step 2.
 */
export function joinProgress(step: JoinStep, _completion?: ProfileCompletionStatus): { n: number; total: number; label: string } | null {
  const total = 3;
  if (step === 'email' || step === 'code') return { n: 1, total, label: 'Your email' };
  if (step === 'about') return { n: 2, total, label: 'About you' };
  if (step === 'join' || step === 'done') return { n: total, total, label: 'Join' };
  return null;
}

/** `?step=code&email=x` -> the email the code went to, or null. */
export function codeStepFromSearch(search: string): string | null {
  const q = new URLSearchParams(search);
  if (q.get('step') !== 'code') return null;
  const email = (q.get('email') ?? '').trim().toLowerCase();
  return EMAIL_SHAPE.test(email) ? email : null;
}

export const codeStepSearch = (email: string): string => `?step=code&email=${encodeURIComponent(email.trim().toLowerCase())}`;

// ---- typed email --------------------------------------------------------------------------------

/** Printable ASCII only (no spaces, no invisible characters): the server's invisible-character list is incomplete. */
const ASCII_EMAIL = /^[\x21-\x7e]+$/;

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: 'empty' | 'not_ascii' | 'bad_shape' };

/** Trim and lower-case, then refuse anything the server could mishandle (ported from #959). */
export function checkTypedEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, reason: 'empty' };
  if (!ASCII_EMAIL.test(email)) return { ok: false, reason: 'not_ascii' };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, reason: 'bad_shape' };
  return { ok: true, email };
}

// ---- action outcomes ----------------------------------------------------------------------------

/** What stopped the journey. Shown over the derived step until the person acts; never persisted. */
export type JoinStop =
  | { kind: 'blocked_domain' }
  | { kind: 'rate_limited'; from: 'code' | 'join' }
  | { kind: 'network'; from: 'send' | 'verify' | 'join' | 'bind' }
  | { kind: 'email_unproven' }
  | { kind: 'not_linked' }
  /** email_mismatch answered AFTER the Join tap (the preview carried no hint): the same wrong-account screen. */
  | { kind: 'wrong_account'; emailHint: string | null }
  | { kind: 'already_bound' }
  | { kind: 'refused'; reason: string; emailHint: string | null };

/** The roles a join writes silently (no role picker): Dancer and Organiser, through the sign-up path's writer. */
export const JOIN_ROLES: readonly SignupRole[] = ['dancer', 'organiser'];

const status = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : null;
};
const text = (e: unknown): string => String((e as { message?: unknown } | null)?.message ?? '').toLowerCase();

/** signInWithOtp({ shouldCreateUser: true }) failed: which screen? */
export function classifySendError(error: unknown): JoinStop {
  // hook_before_user_created_v2: HTTP 403 "Sign-up with this email provider is not accepted" (12 blocked domains).
  if (isSignupAllowlistRefusal(error, true) || text(error).includes('not accepted') || text(error).includes('email provider')) return { kind: 'blocked_domain' };
  if (isOtpRateLimitedError(error) || status(error) === 429 || text(error).includes('rate limit')) return { kind: 'rate_limited', from: 'code' };
  return { kind: 'network', from: 'send' };
}

export type VerifyFailure = 'wrong_code' | 'rate_limited' | 'network';

/** verifyOtp failed: a wrong or expired code stays on the boxes; anything else is a stop. */
export function classifyVerifyError(error: unknown): VerifyFailure {
  const t = text(error);
  if (isOtpRateLimitedError(error) || status(error) === 429) return 'rate_limited';
  if (t.includes('invalid') || t.includes('expired') || t.includes('otp') || status(error) === 403 || status(error) === 400) return 'wrong_code';
  return 'network';
}

export type BindStatus = 'bound' | 'already_bound' | 'not_open' | 'bad_email' | 'rate_limited';
export type BindOutcome = { kind: 'status'; status: BindStatus } | { kind: 'unavailable' } | { kind: 'failed' };
const BIND_STATUSES: readonly string[] = ['bound', 'already_bound', 'not_open', 'bad_email', 'rate_limited'];
const FUNCTION_MISSING = /(could not find the function|function .* does not exist|PGRST202|42883)/i;

/** bind_organiser_invite_email_v1's answer (ported from #959). Missing on the server = unavailable: the redeem still guards. */
export function interpretBind(data: unknown, error: { message?: string; code?: string } | null): BindOutcome {
  if (error) return FUNCTION_MISSING.test(`${error.code ?? ''} ${error.message ?? ''}`) ? { kind: 'unavailable' } : { kind: 'failed' };
  const s = (data as { status?: unknown } | null)?.status;
  return typeof s === 'string' && BIND_STATUSES.includes(s) ? { kind: 'status', status: s as BindStatus } : { kind: 'failed' };
}

export type JoinRedeemOutcome =
  | { kind: 'done'; organiserId: string | null; alreadyMember: boolean }
  /** A2: the login did not land on the invited profile; the seat is NOT granted and the invite stays open. */
  | { kind: 'not_linked' }
  | { kind: 'dead'; reason: DeadReason }
  | { kind: 'wrong_account'; emailHint: string | null }
  | { kind: 'email_unproven' }
  | { kind: 'rate_limited' }
  | { kind: 'profile_incomplete' }
  | { kind: 'sign_in' }
  | { kind: 'refused'; reason: string; emailHint: string | null }
  | { kind: 'failed' };

const DEAD: readonly string[] = ['used', 'expired', 'revoked', 'invalid'];

/** redeem_organiser_invite_v1's answer -> what the page does next. ONE mapping; the screen never reads the raw reason. */
export function interpretJoinRedeem(data: unknown, error: { message?: string } | null): JoinRedeemOutcome {
  if (error) {
    const msg = error.message ?? '';
    if (/authentication_required/.test(msg)) return { kind: 'sign_in' };
    if (msg.includes(PROFILE_INCOMPLETE_CODE)) return { kind: 'profile_incomplete' };
    return { kind: 'failed' };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === true && (row.status === 'redeemed' || row.status === 'already_member')) {
    return { kind: 'done', organiserId: str(row.organiser_id), alreadyMember: row.status === 'already_member' };
  }
  const reason = typeof row.reason === 'string' ? row.reason : '';
  const hint = str(row.invite_email_hint);
  if (reason === 'not_linked') return { kind: 'not_linked' };
  if (DEAD.includes(reason)) return { kind: 'dead', reason: reason as DeadReason };
  if (reason === 'email_mismatch') return { kind: 'wrong_account', emailHint: hint };
  if (reason === 'email_unproven') return { kind: 'email_unproven' };
  if (reason === 'rate_limited') return { kind: 'rate_limited' };
  if (reason === PROFILE_INCOMPLETE_CODE) return { kind: 'profile_incomplete' };
  if (reason === 'sign_in_required' || reason === 'authentication_required') return { kind: 'sign_in' };
  // unconfirmed_account (login audit L3) is NOT a sign-in: signing out would hide why. It falls through to
  // `refused`, so the screen shows REDEEM_COPY's "Confirm your account first".
  if (reason) return { kind: 'refused', reason, emailHint: hint };
  return { kind: 'failed' };
}

/** Sentry / client-error tag: the step and the outcome code, never an email or the token. */
export const failureTag = (step: string, code: string): string => `invite_join:${step}:${code}`;
