import { supabase } from '@/integrations/supabase/client';
import { parseInvitesSent } from './r4InvitedModel';

// list_organiser_invites_sent_v1 is not in the generated Database type yet (a bot regenerates it;
// never hand-edited), so it goes through the same string-named boundary as teamRpcApi.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export const invitesSentQueryKey = (organiserId: string | undefined) => ['organiser-invites-sent', organiserId] as const;

/** Owners and managers: pending team invites and open door invites. Throws on a failed read. */
export async function fetchInvitesSent(organiserId: string) {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('list_organiser_invites_sent_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return parseInvitesSent(data);
}
