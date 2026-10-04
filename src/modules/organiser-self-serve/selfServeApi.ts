import { supabase } from '@/integrations/supabase/client';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';
import type { ClaimCandidate } from './claimHint';
import type { HomeSeriesFull } from './homeModel';
import type { Json } from '@/integrations/supabase/types';
import { parseDateDetail, parseWorkspace, type DateDetail, type SeriesWorkspace } from './seriesModel';
import type { CommandEnvelope } from './seriesCommands';

export { claimHint, type ClaimHint } from './claimHint';

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
}

export type { ClaimCandidate };

export const organiserHomeQueryKey = (userId: string | undefined) => ['organiser-home', userId] as const;
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
  }));
}

/** `%` and `_` are wildcards to ILIKE; a typed name means them literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function searchClaimableOrganisers(query: string): Promise<ClaimCandidate[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('organiser_profiles')
    .select('id, name, slug, avatar_url, city_id, claimed_by, contact_email')
    .eq('lifecycle_status', 'live')
    .not(...NOT_DEACTIVATED)
    .ilike('name', `%${escapeLike(term)}%`)
    .order('name')
    .limit(8);
  if (error) throw error;
  return (data ?? []) as ClaimCandidate[];
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
  return data as { slug: string | null; lifecycle_status: string };
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

export const LIFECYCLE_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  live: 'Live',
  rejected: 'Changes needed',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
};
