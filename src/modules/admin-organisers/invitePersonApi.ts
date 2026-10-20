import { supabase } from '@/integrations/supabase/client';
import { fetchOrganiserFutureOccEvents } from '@/modules/profile/organiserPublicProfile';
import { parsePersonInvite, type PersonInvite, type UpcomingEvent } from './invitePersonModel';

// admin_invite_person_v1 is not in the generated Database type yet (admin slice
// A-DB1 builds it), so it goes through one string-named boundary, never an
// `as never` on the name (check:rpc-typing forbids it). Same pattern as adminApi.ts.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export interface PersonHit {
  id: string;
  name: string;
}

export const personSearchQueryKey = (q: string) => ['admin-invite-person-search', q] as const;
export const pageLeaderQueryKey = (organiserId: string | null) => ['admin-invite-page-leader', organiserId] as const;
export const pageUpcomingQueryKey = (organiserId: string | null) => ['admin-invite-page-upcoming', organiserId] as const;

/** admin_search_people_v1 (typed, admin only). Two letters minimum so a keystroke is not a query. */
export async function searchPeople(query: string): Promise<PersonHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('admin_search_people_v1', { p_query: q, p_limit: 10, p_include_archived: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: [r.first_name, r.surname].filter(Boolean).join(' ').trim() || r.display_name || 'Unnamed person',
  }));
}

/** The page's Leader from its public team (organiser_team_members.is_leader), or null when it has none. */
export async function fetchPageLeader(organiserId: string): Promise<PersonHit | null> {
  const { data: rows, error } = await supabase
    .from('organiser_team_members')
    .select('member_profile_id')
    .eq('organiser_profile_id', organiserId)
    .eq('is_active', true)
    .eq('is_leader', true)
    .limit(1);
  if (error) throw error;
  const memberId = rows?.[0]?.member_profile_id;
  if (!memberId) return null;
  const { data: p, error: pe } = await supabase.from('dancer_profiles').select('id, first_name, surname, display_name').eq('id', memberId).maybeSingle();
  if (pe) throw pe;
  if (!p) return null;
  return { id: p.id, name: [p.first_name, p.surname].filter(Boolean).join(' ').trim() || p.display_name || 'Unnamed person' };
}

/** Upcoming dates for the message, from the same public feed the organiser page uses. */
export async function fetchUpcoming(organiserId: string): Promise<UpcomingEvent[]> {
  const rows = await fetchOrganiserFutureOccEvents(organiserId);
  return rows
    .filter((r) => !r.is_cancelled && r.name && r.instance_date)
    .map((r) => ({ name: r.name as string, date: r.instance_date as string }));
}

export async function invitePerson(personId: string, email: string, organiserId: string | null): Promise<PersonInvite> {
  const { data, error } = await rpc('admin_invite_person_v1', {
    p_dancer_profile_id: personId,
    p_email: email.trim(),
    p_organiser_id: organiserId,
  });
  if (error) throw error;
  // The pinned contract reports refusals as {ok:false, reason} or raises; handle both.
  const reason = (data as { reason?: unknown } | null)?.reason;
  if (typeof reason === 'string') throw new Error(reason);
  const parsed = parsePersonInvite(data);
  if (!parsed) throw new Error('malformed_invite_answer');
  return parsed;
}
