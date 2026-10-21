import { supabase } from '@/integrations/supabase/client';
import { previewOrganiserInvite } from './adminApi';
import { parsePreview, type InvitePreview } from './inviteModel';

// Public-side invite RPCs (arc 1). Not in the generated Database type yet, so they go through
// the same string-named boundary as adminApi (check:rpc-typing forbids `as never` on the name).
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const invitePreviewQueryKey = (token: string) => ['invite-preview', token] as const;

/**
 * THE preview fetcher: organiser_invite_preview_v1 (anon-callable) through adminApi, parsed by parsePreview
 * (which runs the hint through safeEmailHint, D36). null = unknown or garbled link; a transport error throws
 * and the page falls back to the plain flow.
 */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await previewOrganiserInvite(token);
  if (error) throw error;
  return parsePreview(data);
}

/**
 * Screen 2e: email a sign-in code + link to the signed-in (unproven) address, coming back to the invite.
 * Same call as the /auth sign-in send (existing accounts only).
 */
export function sendInviteSignInEmail(email: string, returnTo: string) {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('mode', 'signin');
  callbackUrl.searchParams.set('returnTo', returnTo);
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: callbackUrl.toString() } });
}

/** request_new_invite_v1: raw answer, interpreted by newLinkResultCopy. */
export const requestNewInvite = (token: string) => rpc('request_new_invite_v1', { p_token: token });

/** request_signup_access_v1: raw answer, interpreted by accessResultCopy. */
export const requestSignupAccess = (email: string, note: string) => rpc('request_signup_access_v1', { p_email: email, p_note: note });
