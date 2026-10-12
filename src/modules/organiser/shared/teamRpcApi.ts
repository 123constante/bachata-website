import { supabase } from '@/integrations/supabase/client';
import { parseTeamRead, type TeamMember, type TeamRole } from './teamModel';

// The owner-only team RPCs (admin arc PR 2/4b) are not in the generated Database type yet
// (a bot regenerates it; never hand-edited), so they go through a string-named boundary
// rather than an `as never` on the name, which check:rpc-typing forbids.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const organiserTeamQueryKey = (organiserId: string | undefined) => ['organiser-team', organiserId] as const;

/** Any member reads the team; only an owner (or admin) receives the emails. */
export async function fetchOrganiserTeam(organiserId: string): Promise<{ myRole: TeamRole | 'admin' | null; members: TeamMember[] }> {
  const { data, error } = await rpc('organiser_team_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return parseTeamRead(data);
}

/** Owner only: add a person by email as manager or contributor, or change an existing member's role. */
export async function setTeamMember(organiserId: string, email: string, role: 'manager' | 'contributor') {
  const { data, error } = await rpc('organiser_team_set_member_v1', { p_organiser_id: organiserId, p_email: email.trim(), p_member_role: role });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Owner or admin only (admin #773): people with a visible dancer profile and a
 * confirmed account whose name matches, never by email, members left out. Fewer
 * than two letters answers nothing; at most 8 rows.
 */
export async function searchTeamPeople(organiserId: string, query: string, limit = 8): Promise<unknown> {
  const { data, error } = await rpc('organiser_team_search_people_v1', { p_organiser_id: organiserId, p_query: query, p_limit: limit });
  if (error) throw error;
  return data;
}

/** Owner or admin only (admin #773): add a person found by the search, as manager or contributor. An admin must give a reason. */
export async function addTeamMemberByProfile(organiserId: string, profileId: string, role: 'manager' | 'contributor', reason: string | null) {
  const { data, error } = await rpc('organiser_team_add_member_by_profile_v1', {
    p_organiser_id: organiserId, p_profile_id: profileId, p_member_role: role, p_reason: reason,
  });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

/** Owner only: hand ownership to an existing member; the caller becomes a manager. */
export async function transferOwnership(organiserId: string, toUserId: string) {
  const { data, error } = await rpc('organiser_transfer_ownership_v1', { p_organiser_id: organiserId, p_to_user_id: toUserId });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}
