// The join journey's calls. Every function here is thin: the words and the next step live in joinModel /
// joinCopy. The token goes into RPC arguments only; it is never logged, tagged or sent to the error reporter.
import { supabase } from '@/integrations/supabase/client';
import { reportClientErrorLazy } from '@/lib/reportClientErrorLazy';
import { PENDING_ROLE_INTENT_KEY, ROLE_INTENT_META_KEY, SET_MY_ROLE_INTENT_RPC, isFirstSignIn, parseRoleIntentResult } from '@/lib/auth-otp-routing';
import { previewOrganiserInvite, redeemOrganiserInvite } from '../adminApi';
import { INVITE_PATH } from '../inviteModel';
import { JOIN_ROLES, failureTag, interpretBind, interpretJoinRedeem, parseJoinPreview, type BindOutcome, type JoinPreview, type JoinRedeemOutcome } from './joinModel';

// Public-side RPCs not in the generated Database type yet: the same string-named boundary as inviteRedeemApi.
type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> };
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const joinPreviewQueryKey = (token: string) => ['invite-join-preview', token] as const;

/** organiser_invite_preview_v1 -> JoinPreview. null = the server knows no such link; a transport error throws. */
export async function fetchJoinPreview(token: string): Promise<JoinPreview | null> {
  const { data, error } = await previewOrganiserInvite(token);
  if (error) throw error;
  return parseJoinPreview(data);
}

/** bind_organiser_invite_email_v1: the server binds the email BEFORE the code is sent (PLAN.md section 3). Never rejects. */
export async function bindInviteEmail(token: string, email: string): Promise<BindOutcome> {
  try {
    const { data, error } = await rpc('bind_organiser_invite_email_v1', { p_token: token, p_email: email });
    return interpretBind(data, error);
  } catch {
    return interpretBind(null, { message: 'network' });
  }
}

/**
 * ONE sign-in path for new and returning people: signInWithOtp({ shouldCreateUser: true }), no
 * account_exists_by_email call (no email enumeration). The emailed LINK comes back to this invite
 * through /auth/callback, which reads the roles from the stash / metadata as a sign-up does.
 */
export function sendJoinCode(email: string, token: string) {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('returnTo', `${INVITE_PATH}/${token}`);
  try {
    localStorage.setItem(PENDING_ROLE_INTENT_KEY, JSON.stringify(JOIN_ROLES));
  } catch {
    /* storage blocked: the metadata still carries the roles */
  }
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callbackUrl.toString(), data: { [ROLE_INTENT_META_KEY]: [...JOIN_ROLES], user_type: 'organiser' } },
  });
}

export const verifyJoinCode = (email: string, code: string) => supabase.auth.verifyOtp({ email, token: code, type: 'email' });

/**
 * Dancer + Organiser, written silently through the sign-up path's writer (set_my_role_intent_v1), on the
 * account's FIRST sign-in only -- it replaces the stored roles, and a returning person's choice must stand.
 * Never throws, never holds the join.
 */
export async function recordJoinRoles(user: { email_confirmed_at?: string | null; last_sign_in_at?: string | null } | null | undefined): Promise<void> {
  try {
    localStorage.removeItem(PENDING_ROLE_INTENT_KEY);
  } catch {
    /* nothing stored */
  }
  if (!isFirstSignIn(user)) return;
  try {
    const { data, error } = await rpc(SET_MY_ROLE_INTENT_RPC, { p_roles: [...JOIN_ROLES] });
    if (error || !parseRoleIntentResult(data)) console.debug('[set_my_role_intent] not recorded');
  } catch {
    console.debug('[set_my_role_intent] not recorded');
  }
}

/**
 * One in-flight redeem per token for the whole page lifetime: StrictMode mounts effects twice and a
 * refresh remounts the page; the RPC must run once (a second call would answer already_member or used
 * and hide the real outcome). Cleared when the attempt settles.
 */
const inFlight = new Map<string, Promise<JoinRedeemOutcome>>();

export function attemptRedeem(token: string): Promise<JoinRedeemOutcome> {
  let attempt = inFlight.get(token);
  if (!attempt) {
    attempt = redeemOrganiserInvite(token)
      .then(({ data, error }) => interpretJoinRedeem(data, error))
      .catch(() => interpretJoinRedeem(null, { message: 'network' }))
      .finally(() => { inFlight.delete(token); });
    inFlight.set(token, attempt);
  }
  return attempt;
}

/**
 * Observability (PLAN.md section 3): the step and the outcome code reach the error reporter; no PII, no
 * token. Through the ONE lazy call site, so the reporter stays off the first-load path (tests/clientErrorReporterLazy).
 */
export function reportJoinFailure(step: string, code: string): void {
  reportClientErrorLazy(new Error(failureTag(step, code)), 'error');
}

/** The token leaves the address bar (history, share sheet, Referer) once the link is finished with. */
export function stripToken(): void {
  try {
    window.history.replaceState(window.history.state, '', INVITE_PATH);
  } catch {
    /* a sandboxed frame may refuse; the page works either way */
  }
}
