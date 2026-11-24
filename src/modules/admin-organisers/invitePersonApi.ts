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
  /** For the message greeting; null when the profile has no first or display name. */
  firstName: string | null;
  /** The profile is already joined to a login (claimed_by set). Unknown (undefined) when the read does not include claimed_by. */
  hasLogin?: boolean;
}

/** One person on a page's team list, for "Who is this for?". */
export type TeamPerson = PersonHit;

type NameRow = { id: string; first_name: string | null; surname: string | null; display_name: string | null; claimed_by?: string | null };
const toPersonHit = (r: NameRow): PersonHit => ({
  id: r.id,
  name: [r.first_name, r.surname].filter(Boolean).join(' ').trim() || r.display_name || 'Unnamed person',
  firstName: r.first_name?.trim() || r.display_name?.trim() || null,
  ...(r.claimed_by !== undefined ? { hasLogin: r.claimed_by !== null } : {}),
});

export const personSearchQueryKey = (q: string) => ['admin-invite-person-search', q] as const;
export const pageTeamQueryKey = (organiserId: string) => ['admin-invite-page-team', organiserId] as const;
export const pageUpcomingQueryKey = (organiserId: string | null) => ['admin-invite-page-upcoming', organiserId] as const;

/** admin_search_people_v1 (typed, admin only). Two letters minimum so a keystroke is not a query. */
export async function searchPeople(query: string): Promise<PersonHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('admin_search_people_v1', { p_query: q, p_limit: 10, p_include_archived: false });
  if (error) throw error;
  return (data ?? []).map(toPersonHit);
}

const TEAM_LIMIT = 20;

/**
 * The page's public team list (organiser_team_members, active), oldest first, for "Who is this for?".
 * 52 people sit on team lists and 49 have no login (2026-10-23), so these are the usual invitees.
 */
export async function fetchPageTeam(organiserId: string): Promise<TeamPerson[]> {
  const { data: rows, error } = await supabase
    .from('organiser_team_members')
    .select('member_profile_id')
    .eq('organiser_profile_id', organiserId)
    .eq('is_active', true)
    .order('created_at')
    .limit(TEAM_LIMIT);
  if (error) throw error;
  const ids = [...new Set((rows ?? []).map((r) => r.member_profile_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return [];
  const { data: people, error: pe } = await supabase
    .from('dancer_profiles')
    // Never claimed_by: a private column (no SELECT for authenticated; dancerProfilePrivateColumns test).
    // Whether a team member has a login is unknown here; the admin search RPC returns it.
    .select('id, first_name, surname, display_name')
    .in('id', ids)
    .is('archived_at', null);
  if (pe) throw pe;
  const byId = new Map((people ?? []).map((p) => [p.id, p] as const));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [toPersonHit(p)] : [];
  });
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
