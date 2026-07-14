// Festival Map -- shared types + pure helpers for the map homepage module.
// Data comes from get_map_events_v1 (admin baseline schema; refined by
// 20260627120000), a thin wrapper over get_calendar_events_v2 that adds
// added/updated freshness. Its time fields inherit v2's wall-clock (local-as-UTC)
// convention -- see the CalendarEventRow note in eventRpcs.ts.

import { haversineKm } from '@/lib/geo/haversineKm';
import { isFestivalByFormat } from '@/lib/eventFormat';
import { londonDateKey, londonMinutesOfDay, normalisePostgrestTimestamp } from '@/lib/londonDate';

export type MapCategory = 'class' | 'party' | 'mix' | 'fest' | 'social';
export type MapFilter = 'all' | 'parties' | 'classes' | 'festivals';
export type MapTab = 'all' | 'tonight' | 'news' | 'cal';

/** One row of get_map_events_v1 -- one occurrence-day. */
export interface MapEvent {
  occurrence_id: string;
  event_id: string;
  name: string;
  cover_image_url: string | null;
  venue_name: string | null;
  area: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  instance_date: string | null; // 'YYYY-MM-DD' in city tz (display day)
  start_time: string | null; // ISO 'YYYY-MM-DD HH:MM:SS+00' -- wall-clock, do NOT tz-convert
  end_time: string | null;
  type: string; // 'standard' | 'festival' | 'course' | ... (legacy GENERATED proxy)
  // Phase 8 (format/category split): `format` drives layout/festival routing,
  // `category` is the discovery genre. Nullable for legacy-only series — read
  // format-primary with a `type` fallback (see isFestivalFormat / deriveCategory).
  format?: 'one_off' | 'recurring' | 'course' | 'festival' | null;
  category?: string | null;
  has_party: boolean;
  has_class: boolean;
  // Split class/party times for "Class & Party" events ('HH:MM' wall-clock,
  // or null when the RPC has no split / the build predates 20260823000000).
  class_start: string | null;
  class_end: string | null;
  party_start: string | null;
  party_end: string | null;
  created_at: string | null; // real timestamptz instant
  updated_at: string | null; // real timestamptz instant (human curation), nullable
  freshness_kind: 'added' | 'updated' | null;
  is_cancelled: boolean;
  cancellation_reason_label: string | null;
  slug?: string | null;
  /** Client-derived by collapseFestivals(): a "19-21 June" range stamped on
   *  the representative row of a collapsed multi-day festival. Not from the RPC. */
  festivalDateRange?: string;
}

// Category colour system (handoff bc-base.css --cat-*).
export const CATEGORY_COLORS: Record<MapCategory, string> = {
  class: '#46B7C9',
  party: '#E2415C',
  mix: '#B06CE0',
  fest: '#C57B2C',
  social: '#5FBF7F',
};

// Gradient cover "scene" used when an event has no cover_image_url.
export const CATEGORY_SCENE: Record<MapCategory, string> = {
  class: 'sc-teal',
  party: 'sc-rose',
  mix: 'sc-plum',
  fest: 'sc-stage',
  social: 'sc-crowd',
};

export const CATEGORY_LABEL: Record<MapCategory, string> = {
  class: 'Class',
  party: 'Party',
  mix: 'Class & Party',
  fest: 'Festival',
  social: 'Party',
};

/**
 * Festival check, format-primary (Phase 8). Thin re-export of the shared
 * `isFestivalByFormat` predicate (src/lib/eventFormat.ts) so the map module and the
 * calendar module decide festival-ness with one definition of the null-format
 * fallback. Kept as a named export here for the existing map-module call sites.
 */
export const isFestivalFormat = isFestivalByFormat;

/** Map an event's format/flags to a single display category. */
export function deriveCategory(e: Pick<MapEvent, 'type' | 'format' | 'has_party' | 'has_class'>): MapCategory {
  if (isFestivalFormat(e)) return 'fest';
  if (e.has_party && e.has_class) return 'mix';
  if (e.has_party) return 'party';
  if (e.has_class) return 'class';
  return 'social';
}

export function categoryColor(e: MapEvent): string {
  return CATEGORY_COLORS[deriveCategory(e)];
}

export function eventScene(e: MapEvent): string {
  return CATEGORY_SCENE[deriveCategory(e)];
}

/** Category filter taxonomy mirrored from the live site (All/Parties/Classes/Festivals). */
export function matchesFilter(e: MapEvent, f: MapFilter): boolean {
  if (f === 'all') return true;
  if (f === 'parties') return e.has_party;
  if (f === 'classes') return e.has_class;
  if (f === 'festivals') return isFestivalFormat(e);
  return true;
}

/** Free-text match over title + venue + area (case-insensitive substring). */
export function matchesQuery(e: MapEvent, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${e.name} ${e.venue_name ?? ''} ${e.area ?? ''}`.toLowerCase().includes(needle);
}

/** Two-letter monogram from an event name (drops separators like x and &). */
export function monogram(name: string): string {
  const words = (name || '').replace(/[×x&+]/gi, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || (name?.[0] ?? '?').toUpperCase();
}

// ---- time helpers ---------------------------------------------------------
// start_time/end_time are stored naive "local-as-UTC" (+00 == wall-clock).
// Read the HH:MM straight off the string -- NEVER via Date (which tz-shifts).

function wallClock(iso: string | null): { h: number; m: number } | null {
  if (!iso) return null;
  // Also matches a bare 'HH:MM' (the RPC split-time fields), not just the time
  // portion of an ISO instant, so formatTime serves both split + merged ranges.
  const m = /(?:^|[T ])(\d{1,2}):(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** '20:00' -> '8:00pm'; '00:30' -> '12:30am'. */
export function formatTime(iso: string | null): string {
  const t = wallClock(iso);
  if (!t) return '';
  const period = t.h < 12 ? 'am' : 'pm';
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  const mm = t.m.toString().padStart(2, '0');
  return `${h12}:${mm}${period}`;
}

/** '8:00pm - 2:00am' from start/end (rendered with an en-dash). */
export function formatTimeRange(e: MapEvent): string {
  const s = formatTime(e.start_time);
  const en = formatTime(e.end_time);
  if (s && en) return `${s} \u2013 ${en}`;
  return s || en || '';
}

// ---- split class/party times ----------------------------------------------

export interface TimeSegment {
  label: 'Class' | 'Party';
  /** category whose colour the dot/label uses ('class' teal, 'party' rose) */
  category: 'class' | 'party';
  range: string;
}

function clockRange(s: string | null, en: string | null): string {
  // Reuse formatTimeRange (am/pm + en-dash) so the time formatting lives in one
  // place; wallClock now also parses the bare 'HH:MM' split tokens.
  return formatTimeRange({ start_time: s, end_time: en } as MapEvent);
}

/**
 * For a "Class & Party" event (has_class && has_party) with split times present,
 * two coloured segments -- Class then Party. Returns null when the event isn't a
 * mix, or when either side's split times are missing (caller renders the merged
 * range via formatTimeRange instead). Both segments must resolve so we never show
 * a half-split that reads as if the other half doesn't exist.
 */
export function formatSplitTimes(e: MapEvent): TimeSegment[] | null {
  if (!(e.has_class && e.has_party)) return null;
  const cls = clockRange(e.class_start, e.class_end);
  const pty = clockRange(e.party_start, e.party_end);
  if (!cls || !pty) return null;
  return [
    { label: 'Class', category: 'class', range: cls },
    { label: 'Party', category: 'party', range: pty },
  ];
}

// ---- freshness / relative time -------------------------------------------

/** Parse a PostgREST timestamptz instant ('YYYY-MM-DD HH:MM:SS.sss+00' --
 *  space-separated, 2-digit zone offset) into epoch ms. iOS Safari rejects
 *  that form while Chromium tolerates it, so normalise to strict ISO first
 *  (audit #6) via the shared normaliser in lib/londonDate. */
export function parseInstant(iso: string | null): number {
  if (!iso) return NaN;
  return new Date(normalisePostgrestTimestamp(iso)).getTime();
}

/** Compact "5m", "3h 12m", "2d" from a past instant relative to `now`. */
export function relativeShort(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const then = parseInstant(iso);
  if (Number.isNaN(then)) return '';
  let secs = Math.max(0, Math.floor((now - then) / 1000));
  const d = Math.floor(secs / 86400); secs -= d * 86400;
  const h = Math.floor(secs / 3600); secs -= h * 3600;
  const m = Math.floor(secs / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return 'just now';
}

/** The timestamp + verb the News tab should show for a row. */
export function freshnessDisplay(e: MapEvent): { verb: 'Added' | 'Updated'; iso: string | null } {
  if (e.freshness_kind === 'updated' && e.updated_at) return { verb: 'Updated', iso: e.updated_at };
  return { verb: 'Added', iso: e.created_at };
}

export type FreshnessHeat = 'now' | 'fresh' | 'warm' | 'cool' | 'stale';

/** Bucket a freshness instant into an age "heat" level for the News stamp:
 *  now <1 hr, fresh <8 hr, warm <24 hr, cool <4 days, else stale. */
export function freshnessHeat(iso: string | null, now = Date.now()): FreshnessHeat {
  if (!iso) return 'stale';
  const then = parseInstant(iso);
  if (Number.isNaN(then)) return 'stale';
  const mins = Math.max(0, (now - then) / 60000);
  if (mins < 60) return 'now';
  if (mins < 480) return 'fresh';
  if (mins < 1440) return 'warm';
  if (mins < 5760) return 'cool';
  return 'stale';
}

/** A News row is a "new" badge when added within `days` (default 30). */
export function isFreshNew(e: MapEvent, days = 30, now = Date.now()): boolean {
  if (e.freshness_kind !== 'added' || !e.created_at) return false;
  const then = parseInstant(e.created_at);
  return !Number.isNaN(then) && now - then <= days * 86400000;
}

/** Was the event added OR updated within `days` (default 14)? Gates the freshness
 *  stamp on the events list so only genuinely-recent listings show "Added 2h ago"
 *  while older ones stay quiet -- liveness without turning the list into timestamps. */
export function isRecentlyChanged(e: MapEvent, days = 14, now = Date.now()): boolean {
  const { iso } = freshnessDisplay(e);
  if (!iso) return false;
  const then = parseInstant(iso);
  return !Number.isNaN(then) && now - then <= days * 86400000;
}

// ---- distance -------------------------------------------------------------

/** Miles from user coords to an event, or null if either is missing. */
export function distanceMiles(e: MapEvent, user: { lat: number; lng: number } | null): number | null {
  if (!user || e.lat == null || e.lng == null) return null;
  return haversineKm(user.lat, user.lng, e.lat, e.lng) * 0.621371;
}

/** LONDON-calendar date key of an instant, 'YYYY-MM-DD'. instance_date is a
 *  London calendar day, so "today/tonight" membership must be measured on the
 *  London clock — the old browser-local version emptied the Tonight tab for
 *  non-London visitors once London crossed midnight. */
export function todayStr(d = new Date()): string {
  return londonDateKey(d);
}


// ---- time-of-day + live status -------------------------------------------

/** Parse a time-bearing string to minutes-from-midnight. Accepts 'HH:MM',
 *  'HH:MM:SS', or a full 'YYYY-MM-DD HH:MM:SS+00' wall-clock string. Null if it
 *  has no parseable time. Regex-free to keep this hot path cheap. */
function hhmmToMinutes(s) {
  if (!s) return null;
  const timePart = s.includes(' ') ? s.slice(s.indexOf(' ') + 1) : s;
  const parts = timePart.split(':');
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/** Earliest start of an event in minutes-from-midnight: the split class/party
 *  starts when present, else the wall-clock time in start_time. Null if unknown.
 *  Orders a day's rows chronologically. */
export function startMinutes(e: MapEvent): number | null {
  const split = [hhmmToMinutes(e.class_start), hhmmToMinutes(e.party_start)].filter(
    (n): n is number => n != null,
  );
  return split.length ? Math.min(...split) : hhmmToMinutes(e.start_time);
}

/** Latest end of an event in minutes-from-midnight (split ends, else end_time). */
export function endMinutes(e: MapEvent): number | null {
  const split = [hhmmToMinutes(e.class_end), hhmmToMinutes(e.party_end)].filter(
    (n): n is number => n != null,
  );
  return split.length ? Math.max(...split) : hhmmToMinutes(e.end_time);
}

export type LiveStatus = 'on-now' | 'soon' | null;

/** Real-time status for a TODAY row: 'on-now' while inside the window, 'soon'
 *  when it starts within 90 min, else null. Cancelled / non-today rows return
 *  null. A crossing-midnight end is wrapped so a 9pm-2am party still reads
 *  'on-now' at 11pm. */
export function todayLiveStatus(e: MapEvent, now = new Date()): LiveStatus {
  if (e.is_cancelled || e.instance_date !== todayStr(now)) return null;
  const start = startMinutes(e);
  if (start == null) return null;
  let end = endMinutes(e);
  if (end != null && end < start) end += 1440;
  // Event minutes are London wall-clock, so "now" must be too — browser-local
  // minutes shift the on-now/soon window by the visitor's offset.
  const nowMin = londonMinutesOfDay(now);
  if (nowMin >= start && (end == null || nowMin <= end)) return 'on-now';
  if (start > nowMin && start - nowMin <= 90) return 'soon';
  return null;
}
