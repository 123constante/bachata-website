import { supabase } from './client';
import type { Database } from './types';
import type { MapEvent } from '@/modules/home-map/mapTypes';
import {
  asWallClock,
  asWallClockOrNull,
  asEventTimeZone,
  type WallClock,
} from '@/lib/time/wallClock';

// ============================================================================
// Types for RPC 1: get_calendar_events_v2
// ============================================================================

/**
 * The raw wire row, straight from the regenerated schema (Phase 2, c93fb83) --
 * the single source of truth for which columns `get_calendar_events_v2` returns.
 * We DERIVE the branded row from it (below) rather than hand-maintain a shape
 * that drifts from the wire.
 */
type RawCalendarEventRow =
  Database['public']['Functions']['get_calendar_events_v2']['Returns'][number];

/**
 * The branded calendar row. Every stored wall clock is a `WallClock` so the
 * compiler forbids `new Date(row.start_time)` (the +1h-in-BST bug); produced
 * ONLY by parseCalendarEventRow below. We keep all non-time columns from the
 * generated `Returns` and override only the time fields + city_timezone.
 *
 * Both `start_time` (SPACE form "2026-07-17 20:00:00+00", ::text cast) and
 * `occurrence_starts_at` (T form, same value) are present -- PREFER
 * occurrence_starts_at, both parse identically. `instance_date` stays a raw
 * 'YYYY-MM-DD' date key. class/party/original_* are bare "HH:MM" with a
 * COALESCE(...,'') sentinel that the codec maps to null.
 */
export type CalendarEventRow = Omit<
  RawCalendarEventRow,
  | 'start_time'
  | 'end_time'
  | 'occurrence_starts_at'
  | 'occurrence_ends_at'
  | 'class_start'
  | 'class_end'
  | 'party_start'
  | 'party_end'
  | 'original_class_start'
  | 'original_class_end'
  | 'original_party_start'
  | 'original_party_end'
  | 'city_timezone'
> & {
  start_time: WallClock;
  end_time: WallClock | null;
  occurrence_starts_at: WallClock;
  occurrence_ends_at: WallClock | null;
  class_start: WallClock | null;
  class_end: WallClock | null;
  party_start: WallClock | null;
  party_end: WallClock | null;
  original_class_start: WallClock | null;
  original_class_end: WallClock | null;
  original_party_start: WallClock | null;
  original_party_end: WallClock | null;
  city_timezone: string | null; // via asEventTimeZone ('UTC' -> null -> London default)
};

/**
 * The one producer of a branded CalendarEventRow. Replaces the old blanket
 * `data as CalendarEventRow[]` cast, which asserted nothing. Runs each stored
 * wall clock through the brand (mapping the '' session sentinel to null) and
 * normalises city_timezone at the boundary so every downstream consumer's
 * `?? 'Europe/London'` default applies.
 */
export function parseCalendarEventRow(raw: RawCalendarEventRow): CalendarEventRow {
  return {
    ...raw,
    start_time: asWallClock(raw.start_time),
    end_time: asWallClockOrNull(raw.end_time),
    occurrence_starts_at: asWallClock(raw.occurrence_starts_at),
    occurrence_ends_at: asWallClockOrNull(raw.occurrence_ends_at),
    class_start: asWallClockOrNull(raw.class_start),
    class_end: asWallClockOrNull(raw.class_end),
    party_start: asWallClockOrNull(raw.party_start),
    party_end: asWallClockOrNull(raw.party_end),
    original_class_start: asWallClockOrNull(raw.original_class_start),
    original_class_end: asWallClockOrNull(raw.original_class_end),
    original_party_start: asWallClockOrNull(raw.original_party_start),
    original_party_end: asWallClockOrNull(raw.original_party_end),
    city_timezone: asEventTimeZone(raw.city_timezone),
  };
}

export interface GetCalendarEventsParams {
  range_start: string; // ISO8601
  range_end: string; // ISO8601
  city_slug_param?: string | null; // optional, omit for all cities
}

// ============================================================================
// Types for RPC 2: get_event_page_snapshot_v2
// ============================================================================

export interface EventPerson {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_primary?: boolean;
}

export interface EventLineup {
  teachers?: EventPerson[];
  djs?: EventPerson[];
  dancers?: EventPerson[];
  vendors?: EventPerson[];
  mcs?: EventPerson[];
  performers?: EventPerson[];
  videographers?: EventPerson[];
}

export interface Occurrence {
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  local_date: string;
  lineup: EventLineup;
}

export interface EventActions {
  website_url?: string | null;
  ticket_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
}

export interface KeyTimes {
  classes?: {
    active: boolean;
    start: string | null;
    end: string | null;
  };
  party?: {
    active: boolean;
    start: string | null;
    end: string | null;
  };
}

export interface EventSnapshot {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  photo_urls: string[] | null;
  music_styles: string[] | null;
  type: 'standard' | 'festival' | string;
  // Phase 8 (format/category split): `format` drives layout, `category` is genre.
  // Nullable for legacy-only events; consumers read format-primary + `type` fallback.
  format?: 'one_off' | 'recurring' | 'course' | 'festival' | null;
  category?: string | null;
  is_recurring: boolean;
  actions: EventActions;
  key_times?: KeyTimes;
  meta_data_public?: Record<string, any>;
}

export interface Venue {
  name: string;
  address_line: string | null;
  google_maps_link: string | null;
  image_url: string | null;
}

export interface City {
  id: string;
  name: string;
  slug: string;
}

export interface LocationDefault {
  venue?: Venue;
  city?: City;
}

export interface EventPageSnapshot {
  event: EventSnapshot;
  organisers: EventPerson[];
  occurrence_effective: Occurrence;
  occurrences: Occurrence[];
  location_default: LocationDefault;
}

export interface GetEventPageSnapshotParams {
  p_event_id: string;
  p_occurrence_id?: string | null;
}

// ============================================================================
// Types for RPC 3: get_public_festival_detail
// ============================================================================

export interface FestivalIdentity {
  name: string;
  description: string | null;
  edition: string | null;
  is_qualifier: boolean;
  features: string[] | null;
  languages: string[] | null;
  dress_code: string | null;
  livestream_url: string | null;
  aftermovie_url: string | null;
  tiktok_url: string | null;
  poster_url: string | null; // Festival poster (NOT cover_image_url)
  gallery_urls: string[] | null;
  music_styles: string[] | null;
  age_restriction: string | null;
}

export interface FestivalDates {
  starts_at: string;
  ends_at: string;
  local_start: string;
  local_end: string;
  timezone: string;
}

export interface FestivalLinks {
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  ticket_url?: string | null;
  whatsapp_link?: string | null;
  volunteer_url?: string | null;
  code_of_conduct_url?: string | null;
}

export interface FestivalPrimaryVenue {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
}

export interface FestivalLocation {
  city?: City;
  primary_venue?: FestivalPrimaryVenue;
}

export interface FestivalScheduleItem {
  day: string;
  start_time: string;
  end_time: string;
  title: string;
  type: string;
  teachers?: EventPerson[];
  djs?: EventPerson[];
}

export interface FestivalCompetition {
  name: string;
  style: string;
  judges?: EventPerson[];
}

export interface FestivalPass {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  type: string | null;
  tier: number | null;
  available_until: string | null;
}

export interface FestivalVenue {
  id: string;
  name: string;
  address: string | null;
  is_primary: boolean;
}

export interface FestivalHotel {
  name: string;
  stars: number | null;
  address: string | null;
  distance_text: string | null;
  booking_url: string | null;
  price_from: number | null;
  currency: string | null;
  amenities: string[] | null;
}

export interface FestivalPromoCode {
  id?: string | null;
  code: string;
  discount_type: string | null;
  discount_amount: number | null;
  limit?: string | null;
  valid_until?: string | null;
}

export interface FestivalPublish {
  has_code_of_conduct: boolean;
  code_of_conduct_url?: string | null;
  has_volunteer_info: boolean;
  volunteer_url?: string | null;
  press_media_contact_name?: string | null;
  press_media_contact_email?: string | null;
}

// NOTE: the festival DETAIL boundary (the aggregate `FestivalDetail` type + its
// v1 RPC reader) moved to get_public_festival_detail_v2 in Phase 2 -- see
// src/modules/event-page/festivalEventQuery.ts. The Festival* leaf types above
// are still the shared shapes for that v2 path; the v1 aggregate + fetcher were
// removed as dead code (WallClock Phase 3).

// ============================================================================
// RPC Utilities
// ============================================================================

/**
 * RPC 1: Fetch calendar events for a date range
 * Returns one row per occurrence. For festivals, returns ONE ROW PER DAY.
 *
 * Phase 1E #2 cutover (2026-05-27): routes through get_calendar_events_v2,
 * which reads exclusively from event_series_p5 + event_occurrence_p5 + typed
 * overrides. Return shape is byte-identical to the legacy v1.
 */
export async function getCalendarEvents(
  params: GetCalendarEventsParams,
): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase.rpc('get_calendar_events_v2', {
    range_start: params.range_start,
    range_end: params.range_end,
    city_slug_param: params.city_slug_param ?? undefined,
  });

  if (error) {
    console.error('getCalendarEvents RPC error:', error);
    throw error;
  }

  return (data ?? []).map(parseCalendarEventRow);
}

/**
 * RPC 2: Fetch event detail page snapshot
 * Works for both standard events and festivals. Can optionally specify an occurrence.
 *
 * Phase 5.6 cutover: routes through event_view_p5 in snapshot_compat mode.
 * Compat is byte-equal to the legacy get_event_page_snapshot_v2 by delegation
 * (admin migration 20260601030000); swap to a P5-native body any time before §5.10.
 */
export async function getEventPageSnapshot(
  params: GetEventPageSnapshotParams,
): Promise<EventPageSnapshot | null> {
  const { data, error } = await supabase.rpc('event_view_p5' as never, {
    p_target: {
      series_id: params.p_event_id,
      ...(params.p_occurrence_id ? { occurrence_id: params.p_occurrence_id } : {}),
    },
    p_viewer: { role: 'anon', shape: 'snapshot_compat' },
  } as never);

  if (error) {
    console.error('getEventPageSnapshot RPC error:', error);
    throw error;
  }

  return (data as EventPageSnapshot) || null;
}

// RPC 3 (getPublicFestivalDetail / getEventDetailWithFestival) removed as dead
// code in WallClock Phase 3: it called the superseded v1 get_public_festival_detail
// RPC and its only caller (the unused useEventWithFestival hook) is gone. Festival
// detail now flows through get_public_festival_detail_v2 (Phase 2).

// ============================================================================
// RPC 4: get_latest_events_v1 (newest uploads -- homepage "Just added" wheel)
// ============================================================================

export interface LatestEventRow {
  event_id: string;
  name: string;
  created_at: string; // ISO timestamp, no tz (treat as UTC) -- for "added/updated X ago"
  freshness_kind: 'added' | 'updated'; // 'added' = new event; 'updated' = older event freshened by a human edit / new date
  cover_image_url: string | null;
  photo_url: string[];
  location: string;
  occurrence_id: string | null;
  instance_date: string | null; // 'YYYY-MM-DD' in city tz (soonest upcoming occurrence)
  city_slug: string | null;
  city_timezone: string | null;
  type: 'standard' | 'festival' | string;
  has_class: boolean;
  has_party: boolean;
}

export interface GetLatestEventsParams {
  p_city_slug?: string | null; // omit / null for all cities
  p_limit?: number; // default 6 server-side
}

/**
 * RPC 4: Most recently *uploaded* events (events.created_at DESC), one row per
 * event. Powers the homepage "Just added" carousel.
 *
 * Still cast through `as never`: this wrapper's hand-written LatestEventRow has
 * not yet been migrated to the typed/branded Returns pattern (see
 * getCalendarEvents above). The RPC IS in the regenerated schema now -- dropping
 * the cast is a recorded Phase-3 follow-up, deferred here to keep this PR scoped
 * to the calendar-row boundary.
 */
export async function getLatestEvents(
  params: GetLatestEventsParams = {},
): Promise<LatestEventRow[]> {
  const { data, error } = await supabase.rpc('get_latest_events_v2' as never, {
    p_city_slug: params.p_city_slug ?? null,
    p_limit: params.p_limit ?? 6,
  } as never);

  if (error) {
    // Deploy gap: the RPC may not exist yet (PGRST202). Treat "function not
    // found" as an empty feed so the homepage hides the section gracefully
    // rather than erroring to Sentry on every load until the migration lands.
    if ((error as { code?: string }).code === 'PGRST202') return [];
    console.error('getLatestEvents RPC error:', error);
    throw error;
  }

  return (data as unknown as LatestEventRow[]) ?? [];
}

// ============================================================================
// RPC 5: get_map_events_v1 (Festival Map homepage -- coords + freshness)
// ============================================================================

export interface GetMapEventsParams {
  city_slug_param: string; // city slug, e.g. 'london-gb'
  range_start: string; // 'YYYY-MM-DD' date-only text (RPC accepts '' -> now())
  range_end: string; // 'YYYY-MM-DD'
}

/**
 * RPC 5: One row per occurrence-day for the Festival Map homepage -- venue
 * coords, cover, times, category flags and added/updated freshness. Thin
 * wrapper over get_calendar_events_v2 (defined in the admin baseline schema;
 * refined by 20260627120000_venue_is_public_predicate_and_gate_v1).
 *
 * Still cast through `as never`: this wrapper's hand-written MapEvent (from the
 * home-map module) has not yet been migrated to the typed/branded Returns
 * pattern (see getCalendarEvents above). The RPC IS in the regenerated schema
 * now -- dropping the cast is a recorded Phase-3 follow-up, deferred here to keep
 * this PR scoped to the calendar-row boundary. Errors (incl. a future
 * rename/regression) surface to the UI + Sentry, not a silent [].
 */
export async function getMapEvents(
  params: GetMapEventsParams,
): Promise<MapEvent[]> {
  const { data, error } = await supabase.rpc('get_map_events_v1' as never, {
    city_slug_param: params.city_slug_param,
    range_start: params.range_start,
    range_end: params.range_end,
  } as never);

  if (error) {
    // get_map_events_v1 is deployed; surface failures (incl. a future rename or
    // regression) as a real error so the UI shows RetryNotice and the global
    // QueryCache onError reports them to Sentry -- never a silently empty map.
    console.error('getMapEvents RPC error:', error);
    throw error;
  }

  return (data as unknown as MapEvent[]) ?? [];
}
