// "Show me on the public team" (People arc A-DB2): the person's OWN row in the
// public team (organiser_team_members) that visitors see on the organiser page.
// organiser_team_set_public_v1 is not in the generated Database type yet:
// string-named boundary (check:rpc-typing), parsed with a refusing parser.
import { supabase } from '@/integrations/supabase/client';
import { selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import type { PublicTeamRow } from '@/modules/profile/organiserTeam';

type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; hint?: string } | null }>;
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

// ---------------------------------------------------------------------------
// P2 (organiser page Team): the public list, who is hidden from it, and the
// hide/show command. All three RPCs are admin #1259 + the hidden-flag brief;
// none is in the generated Database type yet (string-named, check:rpc-typing),
// so each answer goes through a refusing parser: a bad shape throws.

/** organiser_public_team_v1: the page's public Team (visitor read). */
export const organiserPublicTeamKey = (organiserId: string | undefined) => ['organiser-public-team', organiserId ?? null] as const;
/** organiser_team_hidden_v1: who is hidden from that list (owner/manager read). */
export const organiserTeamHiddenKey = (organiserId: string | undefined) => ['organiser-team-hidden', organiserId ?? null] as const;

const isUuidish = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const optText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new Error('public_team_bad_shape');
  return v;
};

export function parsePublicTeam(raw: unknown): PublicTeamRow[] {
  if (!Array.isArray(raw)) throw new Error('public_team_bad_shape');
  return raw.map((r) => {
    const row = r as Record<string, unknown> | null;
    if (!row || typeof row !== 'object' || !isUuidish(row.person_id)) throw new Error('public_team_bad_shape');
    if (typeof row.sort_key !== 'number' || !Number.isFinite(row.sort_key)) throw new Error('public_team_bad_shape');
    return { person_id: row.person_id, slug: optText(row.slug), public_name: optText(row.public_name), avatar_url: optText(row.avatar_url), sort_key: row.sort_key };
  });
}

export async function fetchOrganiserPublicTeam(organiserId: string): Promise<PublicTeamRow[]> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_public_team_v1', { p_organiser_profile_id: organiserId });
  // Throw, never `[]`: a failed read is the section's error line, not "no team" (E3/E9 rule).
  if (error) throw error;
  return parsePublicTeam(data);
}

export function parseTeamHidden(raw: unknown): Set<string> {
  const ids = (raw as { hidden_person_ids?: unknown } | null)?.hidden_person_ids;
  if (!Array.isArray(ids) || !ids.every(isUuidish)) throw new Error('team_hidden_bad_shape');
  return new Set(ids as string[]);
}

export async function fetchTeamHidden(organiserId: string): Promise<Set<string>> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_team_hidden_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return parseTeamHidden(data);
}

export interface SetHiddenResult { personId: string; hidden: boolean; changed: boolean }

export function parseSetHidden(raw: unknown): SetHiddenResult {
  const r = raw as Record<string, unknown> | null;
  if (!r || r.ok !== true || !isUuidish(r.person_id) || typeof r.hidden !== 'boolean' || typeof r.changed !== 'boolean') throw new Error('set_hidden_bad_shape');
  return { personId: r.person_id, hidden: r.hidden, changed: r.changed };
}

/** `changed: false` (already in that state) is success, not a failure. */
export async function setTeamMemberHidden(organiserId: string, personId: string, hidden: boolean): Promise<SetHiddenResult> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('set_organiser_team_member_hidden_v1', { p_organiser_profile_id: organiserId, p_person_id: personId, p_hidden: hidden });
  if (error) throw error;
  return parseSetHidden(data);
}

/**
 * set_organiser_team_member_hidden_v1 refusals: MESSAGE = code, HINT = plain
 * words. The copy below is the RPC's HINT, pinned here so a server wording
 * change never leaks unreviewed text, with "organiser" said as "page" (team
 * copy rule, consistency G3); an unknown code (or a network failure)
 * falls back to the generic team error.
 */
export const HIDE_ERROR_COPY: Record<string, string> = {
  not_signed_in: 'Sign in to change who is shown on the team.',
  invalid_input: 'Pick a page, a person, and whether to hide or show them.',
  organiser_not_found: 'That page does not exist.',
  not_allowed: 'Only an owner or manager of this page, or the person themself, can do this.',
  person_not_on_team: 'That person is not on this page\u2019s team.',
  owner_protected: 'Only an owner can hide or show an owner.',
};

export function hideErrorMessage(err: unknown): string {
  const code = selfServeErrorCode(err);
  return (code && HIDE_ERROR_COPY[code]) || teamErrorMessage(err);
}
