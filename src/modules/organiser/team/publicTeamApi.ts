// "Show me on the public team" (People arc A-DB2): the person's OWN row in the
// public team (organiser_team_members) that visitors see on the organiser page.
// organiser_team_set_public_v1 is not in the generated Database type yet:
// string-named boundary (check:rpc-typing), parsed with a refusing parser.
import { supabase } from '@/integrations/supabase/client';
import { selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';

type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export const publicTeamQueryKey = (organiserId: string | undefined, profileId: string | null | undefined) =>
  ['organiser-public-team-me', organiserId ?? null, profileId ?? null] as const;

/** Is this person's public row active? (The same rows the public page reads: is_active = true.) */
export async function fetchShownOnPublicTeam(organiserId: string, profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('organiser_team_members')
    .select('id')
    .eq('organiser_profile_id', organiserId)
    .eq('member_profile_id', profileId)
    .eq('is_active', true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export type SetPublicStatus = 'hidden' | 'public' | 'unchanged';

export function parseSetPublic(raw: unknown): SetPublicStatus {
  const status = (raw as { status?: unknown } | null)?.status;
  if (status === 'hidden' || status === 'public' || status === 'unchanged') return status;
  throw new Error('set_public_bad_shape');
}

export async function setShownOnPublicTeam(organiserId: string, show: boolean): Promise<SetPublicStatus> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_team_set_public_v1', { p_organiser_id: organiserId, p_public: show });
  if (error) throw error;
  return parseSetPublic(data);
}

/** The public team shows at most 20 people: its own words, not the access team's. */
export const PUBLIC_TEAM_FULL = 'The team on your page already shows 20 people. Ask an owner to hide someone first.';

export function publicTeamErrorMessage(err: unknown): string {
  return selfServeErrorCode(err) === 'team_full' ? PUBLIC_TEAM_FULL : teamErrorMessage(err);
}
