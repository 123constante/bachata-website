import { supabase } from '@/integrations/supabase/client';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';
import type { ClaimCandidate, ClaimHint, ClaimableOrganiser } from './claimHint';
import type { HomeSeriesFull } from './homeModel';
import type { Json } from '@/integrations/supabase/types';
import { parseDateDetail, parseWorkspace, type DateDetail, type SeriesWorkspace } from './seriesModel';
import { upsertCommand, type CommandEnvelope, type OwnerCommand } from './seriesCommands';
import { parseProgramme, parseSaveResult, type PeopleRole, type Programme, type SaveResult, type WireSession } from './programmeModel';
import {
  parseIncomingRequests,
  parseRemoval,
  parseTeam,
  type IncomingAccessRequest,
  type MemberRemoval,
  type TeamMember,
} from './teamModel';

export type { ClaimHint } from './claimHint';

/**
 * The Website's organiser self-serve reads and writes (Lever 2, W1). Every
 * write goes through a SECURITY DEFINER RPC in the admin repo; the only
 * direct table read is the public organiser search, which reads the same
 * columns the public organiser page already reads.
 */

export type OrganiserLifecycle = 'draft' | 'pending_review' | 'live' | 'rejected' | 'paused' | 'ended' | string;

export interface Decision {
  action: string;
  from_state: string | null;
  to_state: string | null;
  reason: string | null;
  created_at: string;
}

export interface HomeOrganiser {
  id: string;
  name: string;
  slug: string | null;
  avatar_url: string | null;
  city_id: string | null;
  lifecycle_status: OrganiserLifecycle;
  role: 'owner' | 'manager';
  latest_decision: Decision | null;
  series: HomeSeriesFull[];
  /** The owner and manager rows (admin D7); parse with parseTeam. Absent before D7. */
  team?: unknown;
}

export interface OrganiserHome {
  /** London calendar date the server computed the home for, YYYY-MM-DD. */
  today: string;
  organisers: HomeOrganiser[];
}

/** camelCase at this boundary: see the RPC-key note on fetchMyAccessRequests. */
export interface MyAccessRequest {
  requestId: string;
  organiserId: string;
  organiserName: string | null;
  status: 'open' | 'granted' | 'declined' | string;
  createdAt: string;
  /** When an admin or owner answered; null while open. */
  resolvedAt: string | null;
}

export type { ClaimCandidate, ClaimableOrganiser };

/** Prefix of every organiser-home query: what a write to an organiser or its series invalidates. */
export const ORGANISER_HOME_KEY = ['organiser-home'] as const;
export const organiserHomeQueryKey = (userId: string | undefined) => [...ORGANISER_HOME_KEY, userId] as const;
export const myAccessRequestsQueryKey = (userId: string | undefined) => ['my-access-requests', userId] as const;

export async function fetchOrganiserHome(): Promise<OrganiserHome> {
  const { data, error } = await supabase.rpc('organiser_home_v1');
  if (error) throw error;
  const home = (data ?? {}) as { today?: string; organisers?: HomeOrganiser[] };
  return {
    today: typeof home.today === 'string' ? home.today : '',
    organisers: Array.isArray(home.organisers) ? home.organisers : [],
  };
}

export async function fetchMyAccessRequests(): Promise<MyAccessRequest[]> {
  const { data, error } = await supabase.rpc('list_organiser_access_requests_v1', { p_scope: 'mine' });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  // The D4 RPCs key rows by `organiser_id` (an organiser_profiles id). This file
  // is the one place allowed to read that key (scripts/lint-runtime-architecture
  // .mjs bans the word app-wide for the legacy events.organiser_id columns), so
  // it maps to camelCase here and nothing downstream names it.
  return (data as Record<string, unknown>[]).map((row) => ({
    requestId: String(row.request_id),
    organiserId: String(row.organiser_id),
    organiserName: typeof row.organiser_name === 'string' ? row.organiser_name : null,
    status: String(row.status),
    createdAt: String(row.created_at),
    resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
  }));
}

export const organiserClaimHintQueryKey = (organiserId: string | undefined, userId: string | undefined) =>
  ['organiser-claim-hint', organiserId, userId ?? null] as const;

const CLAIM_HINTS: readonly ClaimHint[] = ['yours', 'managed', 'no_email', 'email_matches', 'email_differs'];

/**
 * organiser_claim_hints_v1's jsonb array -> Map keyed by organiser id. Lives here
 * because this file is the one place allowed to read the `organiser_id` key
 * (scripts/lint-runtime-architecture.mjs); unknown hints and malformed rows drop.
 */
export function parseClaimHints(raw: unknown): Map<string, ClaimHint> {
  const out = new Map<string, ClaimHint>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const { organiser_id: id, hint } = row as Record<string, unknown>;
    if (typeof id === 'string' && CLAIM_HINTS.includes(hint as ClaimHint)) out.set(id, hint as ClaimHint);
  }
  return out;
}

// Not in the generated Database type yet (a bot regenerates it; never hand-edited), so this
// one call goes through a string-named boundary rather than an `as never` on the name,
// which check:rpc-typing forbids. Delete the cast when the types land.
type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Signed-in only (anon is refused). Ids the caller may not see are omitted. At most 50 per call. */
export async function fetchClaimHints(organiserIds: readonly string[]): Promise<Map<string, ClaimHint>> {
  const ids = [...new Set(organiserIds)].slice(0, 50);
  if (ids.length === 0) return new Map();
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_claim_hints_v1', { p_organiser_ids: ids });
  if (error) throw error;
  return parseClaimHints(data);
}

/** One organiser's hint; null when signed out, not visible, or the call failed (then only "ask to join" is offered). */
export async function fetchClaimHint(organiserId: string): Promise<ClaimHint | null> {
  try {
    return (await fetchClaimHints([organiserId])).get(organiserId) ?? null;
  } catch {
    return null;
  }
}

/** `%` and `_` are wildcards to ILIKE; a typed name means them literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function searchClaimableOrganisers(query: string): Promise<ClaimableOrganiser[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('organiser_profiles')
    .select('id, name, slug, avatar_url, city_id')
    .eq('lifecycle_status', 'live')
    .not(...NOT_DEACTIVATED)
    .ilike('name', `%${escapeLike(term)}%`)
    .order('name')
    .limit(8);
  if (error) throw error;
  const rows = (data ?? []) as ClaimCandidate[];
  // The hint is computed in the database from the private claim email; a failed
  // hint call degrades to "no hint" (ask to join), never a failed search.
  const hints = await fetchClaimHints(rows.map((r) => r.id)).catch(() => new Map<string, ClaimHint>());
  return rows.map((r) => ({ ...r, hint: hints.get(r.id) ?? null }));
}

export async function claimOrganiser(organiserId: string) {
  const { data, error } = await supabase.rpc('claim_organiser_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return data as { already_claimed: boolean };
}

export async function requestOrganiserAccess(organiserId: string, message: string) {
  const { data, error } = await supabase.rpc('request_organiser_access_v1', {
    p_organiser_id: organiserId,
    p_message: message.trim() || undefined,
  });
  if (error) throw error;
  return data as { request_id: string; status: string };
}

export interface CreateOrganiserInput {
  name: string;
  cityId: string;
  /** The caller's own email, or empty for none (the server refuses any other). */
  contactEmail: string;
  instagram: string;
  website: string;
}

export async function createOrganiserProfile(input: CreateOrganiserInput) {
  const { data, error } = await supabase.rpc('create_organiser_profile_v1', {
    p_name: input.name.trim(),
    p_city_id: input.cityId,
    p_contact_email: input.contactEmail.trim() || undefined,
    p_instagram: input.instagram.trim() || undefined,
    p_website: input.website.trim() || undefined,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    organiserId: typeof row.organiser_id === 'string' ? row.organiser_id : null,
    slug: typeof row.slug === 'string' ? row.slug : null,
    lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : 'draft',
  };
}

/** camelCase at this boundary, as for fetchMyAccessRequests. */
export interface SubmittedOrganiser {
  organiserId: string;
  fromState: string;
  lifecycleStatus: string;
}

/**
 * Send a draft or rejected organiser for review (admin D6,
 * submit_organiser_profile_v1). The server moves it to pending_review and
 * records the submit; an owner or manager only.
 */
export async function submitOrganiserProfile(organiserId: string): Promise<SubmittedOrganiser> {
  const { data, error } = await supabase.rpc('submit_organiser_profile_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    organiserId: typeof row.organiser_id === 'string' ? row.organiser_id : organiserId,
    fromState: String(row.from_state ?? ''),
    lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : 'pending_review',
  };
}

// ---- W4/W5: the series page and one date --------------------------------------

export const seriesWorkspaceQueryKey = (seriesId: string | undefined) => ['series-workspace', seriesId] as const;
export const dateDetailQueryKey = (occurrenceId: string | undefined) => ['date-detail', occurrenceId] as const;

/**
 * The series with its programme and its dates (the newest 100, by date).
 * admin_event_workspace_p5 admits an organiser member of the series
 * (_assert_can_edit_series_p5); anyone else gets permission_denied.
 */
export async function fetchSeriesWorkspace(seriesId: string): Promise<SeriesWorkspace> {
  const { data, error } = await supabase.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
  if (error) throw error;
  return parseWorkspace(data);
}

/** One date as it stands, overrides included (event_view_p5, organiser viewer role). */
export async function fetchDateDetail(occurrenceId: string): Promise<DateDetail> {
  const { data, error } = await supabase.rpc('event_view_p5', {
    p_target: { occurrence_id: occurrenceId },
    p_viewer: { role: 'organiser' },
  });
  if (error) throw error;
  return parseDateDetail(data);
}

export interface CancellationReason {
  key: string;
  label: string;
}

/** The reasons an owner may give (the server checks the label against this table). */
export async function fetchCancellationReasons(): Promise<CancellationReason[]> {
  const { data, error } = await supabase
    .from('cancellation_reasons')
    .select('key, label')
    .is('archived_at', null)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as CancellationReason[];
}

export interface CommandResponse {
  ok: boolean;
  new_version?: number;
  data?: Record<string, unknown>;
}

export async function runSeriesCommand(env: CommandEnvelope): Promise<CommandResponse> {
  const { data, error } = await supabase.rpc('series_command_p5', { p_envelope: env as unknown as Json });
  if (error) throw error;
  return (data ?? { ok: true }) as unknown as CommandResponse;
}

export async function runOccurrenceCommand(env: CommandEnvelope): Promise<CommandResponse> {
  const { data, error } = await supabase.rpc('occurrence_command_p5', { p_envelope: env as unknown as Json });
  if (error) throw error;
  return (data ?? { ok: true }) as unknown as CommandResponse;
}

// ---- the programme of one date (admin 20261109560000) -------------------------

export const occurrenceProgrammeQueryKey = (occurrenceId: string | undefined) => ['occurrence-programme', occurrenceId] as const;

/**
 * organiser_get_occurrence_programme_v1 and organiser_set_occurrence_programme_v1
 * are not in the generated `Database` types until admin PR #668 is applied to
 * prod (types-drift regenerates them from the live schema). Until then they go
 * through this one narrow caller; the results are parsed by programmeModel, never
 * trusted as a typed shape. Swap for `supabase.rpc` once the types carry them.
 */
type ProgrammeRpc = (
  fn: 'organiser_get_occurrence_programme_v1' | 'organiser_set_occurrence_programme_v1' | 'organiser_search_people_v1',
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
const programmeRpc = (...args: Parameters<ProgrammeRpc>) => (supabase.rpc as unknown as ProgrammeRpc)(...args);

/** Every session of one date, in exactly the shape the save takes back (removed ones included). */
export async function fetchOccurrenceProgramme(occurrenceId: string): Promise<Programme> {
  const { data, error } = await programmeRpc('organiser_get_occurrence_programme_v1', { p_occurrence_id: occurrenceId });
  if (error) throw error;
  return parseProgramme(data);
}

/**
 * Save the COMPLETE programme of one date (programmeModel.buildPayload): every
 * session the reader returned plus the new ones. A live date shows the change at
 * once. version_conflict when someone else saved first.
 */
export async function saveOccurrenceProgramme(occurrenceId: string, expectedVersion: number, sessions: WireSession[]): Promise<SaveResult> {
  const { data, error } = await programmeRpc('organiser_set_occurrence_programme_v1', {
    p_occurrence_id: occurrenceId,
    p_expected_version: expectedVersion,
    p_sessions: sessions,
  });
  if (error) throw error;
  return parseSaveResult(data);
}

// ---- the line-up picker (admin 20261109700000) ---------------------------------

export const searchPeopleQueryKey = (role: PeopleRole, term: string) => ['organiser-search-people', role, term] as const;

/** One person the picker offers: a teacher or DJ an organiser may put on a session. */
export interface PersonResult {
  id: string;
  /** The name the line-up shows for this role (a DJ's DJ name when they have one). */
  name: string;
  photoUrl: string | null;
  /** "Leeds" or "Leeds, GB"; null when not set. */
  place: string | null;
}

export const PEOPLE_SEARCH_MIN = 2;
export const PEOPLE_SEARCH_LIMIT = 20;

/**
 * organiser_search_people_v1 (read-only; owners and managers): active, line-up
 * visible people holding the role, by name or DJ name. It refuses a query under
 * 2 characters, so a shorter one never calls it. Rows: id, display_name,
 * dj_name, photo_url, city_name, country_code, roles.
 */
export async function searchPeople(query: string, role: PeopleRole): Promise<PersonResult[]> {
  const term = query.trim().slice(0, 100);
  if (term.length < PEOPLE_SEARCH_MIN) return [];
  const { data, error } = await programmeRpc('organiser_search_people_v1', {
    p_query: term,
    p_role: role,
    p_limit: PEOPLE_SEARCH_LIMIT,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return (data as Record<string, unknown>[]).flatMap((row) => {
    const id = text(row.id);
    const display = text(row.display_name);
    const dj = text(row.dj_name);
    const name = role === 'djing' ? dj ?? display : display ?? dj;
    if (!id || !name) return [];
    const city = text(row.city_name);
    const country = text(row.country_code);
    return [{ id, name, photoUrl: text(row.photo_url), place: city ? (country ? `${city}, ${country}` : city) : null }];
  });
}

// ---- W3: create ----------------------------------------------------------------

/**
 * The create envelope's command: the payload the create screen built
 * (seriesCommands.createPayload) plus the organiser the series belongs to. The
 * server's create rule (admin migration 20261108180000, D-12) wants
 * `organiser_ids` naming exactly one organiser the caller owns or manages. That
 * key is the legacy column name scripts/lint-runtime-architecture.mjs bans
 * app-wide, so it is attached here, in the one allow-listed file, and nothing
 * else in the module spells it.
 */
export function createSeriesCommand(payload: Record<string, unknown>, organiserId: string): OwnerCommand {
  return upsertCommand({ ...payload, organiser_ids: [organiserId] });
}

// ---- W6: team and access requests --------------------------------------------

export const incomingAccessRequestsQueryKey = (organiserId: string | undefined) =>
  ['incoming-access-requests', organiserId] as const;

/** The organiser's team as organiser_home_v1 lists it to an owner or manager. */
export const teamOf = (organiser: HomeOrganiser | null | undefined): TeamMember[] => parseTeam(organiser?.team);

/**
 * The OPEN requests to join one organiser, with the requester's email and
 * message (D4 'incoming' scope: an owner or manager of that organiser; anyone
 * else is refused not_authorised). The rows also carry organiser_id, which this
 * per-organiser read does not need, so the model never names it.
 */
export async function fetchIncomingAccessRequests(organiserId: string): Promise<IncomingAccessRequest[]> {
  const { data, error } = await supabase.rpc('list_organiser_access_requests_v1', {
    p_organiser_id: organiserId,
    p_scope: 'incoming',
  });
  if (error) throw error;
  return parseIncomingRequests(data);
}

export type AccessDecision = 'grant' | 'decline';

/**
 * Grant (as a manager: D-8 exposes owner and manager, and v1 adds managers
 * only) or decline a request. An owner of the organiser or an admin; a
 * manager is refused not_authorised. No note is sent in v1.
 */
export async function resolveAccessRequest(requestId: string, decision: AccessDecision) {
  const { data, error } = await supabase.rpc('resolve_organiser_access_request_v1', {
    p_request_id: requestId,
    p_decision: decision,
    ...(decision === 'grant' ? { p_member_role: 'manager' } : {}),
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return { requestId, decision, memberRole: typeof row.member_role === 'string' ? row.member_role : null };
}

/**
 * Remove a member (an owner removes a manager) or leave (the caller names
 * themself). The server refuses the last owner (last_owner) and an owner
 * naming another owner (cannot_remove_owner); see teamErrorMessage.
 */
export async function removeOrganiserMember(organiserId: string, userId: string): Promise<MemberRemoval> {
  const { data, error } = await supabase.rpc('remove_organiser_member_v1', {
    p_organiser_id: organiserId,
    p_user_id: userId,
  });
  if (error) throw error;
  return parseRemoval(data, userId);
}

export const LIFECYCLE_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  live: 'Live',
  rejected: 'Changes needed',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
};
