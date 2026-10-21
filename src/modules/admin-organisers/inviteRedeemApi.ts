import { supabase } from '@/integrations/supabase/client';
import { parsePreview, type InvitePreview } from './inviteModel';

// Public-side invite RPCs (arc 1). Not in the generated Database type yet, so they go through
// the same string-named boundary as adminApi (check:rpc-typing forbids `as never` on the name).
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const invitePreviewQueryKey = (token: string) => ['invite-preview', token] as const;

/** organiser_invite_preview_v1 (anon-callable). null = unknown or garbled link; a transport error throws. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await rpc('organiser_invite_preview_v1', { p_token: token });
  if (error) throw error;
  return parsePreview(data);
}

/** request_new_invite_v1: raw answer, interpreted by newLinkResultCopy. */
export const requestNewInvite = (token: string) => rpc('request_new_invite_v1', { p_token: token });

/** request_signup_access_v1: raw answer, interpreted by accessResultCopy. */
export const requestSignupAccess = (email: string, note: string) => rpc('request_signup_access_v1', { p_email: email, p_note: note });
