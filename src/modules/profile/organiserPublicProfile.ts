import { supabase } from '@/integrations/supabase/client';
import { ORGANISER_PUBLIC_COLS } from '@/lib/organiserPublicCols';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';

/**
 * Shared query keys + queryFns for an organiser's public profile data: the
 * entity row and its three feed queries (organiser events, and the future/past
 * occurrence-backed calendars). app/routes/organiser.tsx's SSR loader and
 * src/pages/OrganiserProfile.tsx's client queries both read these -- they
 * used to be four hand-copied implementations, the exact drift class
 * ORGANISER_PUBLIC_COLS (src/lib/organiserPublicCols.ts) already fixed for
 * the column list alone. One definition per query, imported by both, so the
 * SSR-dehydrated cache entry and the client's own query can never disagree.
 *
 * `id` is typed `string | undefined` on the key builders (a route param can
 * still be resolving) but `string` on the queryFns themselves -- callers gate
 * execution with `enabled: !!id` (React Query, not a guard inside the body).
 */

export type EventRow = {
  id: string;
  name: string;
  date: string | null;
  start_time: string | null;
  is_active: boolean | null;
  poster_url: string | null;
  location: string | null;
  city: string | null;
};

export type OrgOccRow = {
  event_id: string;
  name: string | null;
  occurrence_id: string | null;
  instance_date: string | null;
  start_time: string | null;
  photo_url: string[] | null;
  cover_image_url: string | null;
  location: string | null;
  is_cancelled: boolean | null;
  is_past: boolean | null;
};

export const organiserEntityQueryKey = (id: string | undefined) => ['entity', id] as const;
export const organiserEventsQueryKey = (id: string | undefined) => ['organiser-events', id] as const;
export const organiserOccEventsQueryKey = (id: string | undefined) => ['organiser-occ-events', id] as const;
export const organiserOccEventsPastQueryKey = (id: string | undefined) =>
  ['organiser-occ-events-past', id] as const;

export async function fetchOrganiserEntity(id: string) {
  return readOrganiserEntity(id, true);
}

/**
 * The organiser area's read of the caller's OWN organiser (/account/o/profile):
 * the same columns with NO is_active filter, because create_organiser_profile_v1
 * inserts a draft with is_active = false and the public filter hid it from its
 * own creator (2026-10-09 walk). Visibility is RLS alone
 * (organiser_profiles_ss_select: live, admin, the organiser's owner/manager, or
 * its city ambassador), so a stranger still gets null for a non-live row. Its
 * own cache key: a non-live row must never land in the public page's
 * ['entity', id] entry.
 */
export const ownOrganiserEntityQueryKey = (id: string | undefined) => ['own-organiser-entity', id] as const;

export async function fetchOwnOrganiserEntity(id: string) {
  return readOrganiserEntity(id, false);
}

async function readOrganiserEntity(id: string, publicOnly: boolean) {
  if (!id) throw new Error('Entity ID is required');
  let query = supabase
    .from('organiser_profiles')
    .select(ORGANISER_PUBLIC_COLS)
    .eq('id', id);
  if (publicOnly) query = query.not(...NOT_DEACTIVATED);
  const { data, error } = await query.maybeSingle();
  // A TRANSIENT supabase error must propagate as a retryable failure --
  // swallowing it here would 404 a valid organiser on a DB blip. null = a
  // real miss.
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  if (!data) return null;
  let city = null;
  if (data.city_id) {
    const { data: cityData } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('id', data.city_id)
      .maybeSingle();
    city = cityData;
  }
  return { ...data, cities: city };
}

export async function fetchOrganiserEvents(id: string): Promise<EventRow[]> {
  if (!id) return [];
  // M5: P5 organiser links (live + ended series), not legacy event_entities.
  // `id` keeps the legacy event id where one exists so the occurrence feeds
  // below still join on event_id.
  const { data, error } = await supabase.rpc('get_organiser_public_events_v1', { p_organiser_id: id });
  if (error) return [];
  return (data ?? []) as unknown as EventRow[];
}

// No `as never` on the name or the args: get_organiser_calendar_events_v1 IS
// in the generated Database type, so a cast would only collapse `data` to
// never and discard its Returns. check:rpc-typing refuses a new laundered
// call -- both RPC fetches below were already typed this way in the loader;
// moving OrganiserProfile.tsx's two onto the same path drops its grandfathered
// scripts/rpc-typing-allowlist.json entries (shrink with `--write`).
export async function fetchOrganiserFutureOccEvents(id: string): Promise<OrgOccRow[]> {
  const { data, error } = await supabase.rpc('get_organiser_calendar_events_v1', { p_organiser_id: id });
  if (error) return [];
  return (data ?? []) as unknown as OrgOccRow[];
}

// 3650 days (~10y), not a shorter cap: the Past nights accordion groups by
// year and needs to reach back to when the organiser actually started -- a
// short cap silently hides whole years for any organiser older than that.
// The window is computed HERE, once, so the SSR loader's prefetch and the
// page's own query can no longer disagree the way two hand-synced copies
// could (a few milliseconds of drift is fine -- it is not part of the cache
// key).
export async function fetchOrganiserPastOccEvents(id: string): Promise<OrgOccRow[]> {
  const from = new Date(Date.now() - 3650 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc('get_organiser_calendar_events_v1', {
    p_organiser_id: id,
    p_from: from,
    p_to: to,
    p_include_past: true,
  });
  if (error) return [];
  return (data ?? []) as unknown as OrgOccRow[];
}
