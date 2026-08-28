// Festival Map -- shared types + pure helpers for the map homepage module.
// Data comes from get_map_events_v1 (admin baseline schema; refined by
// 20260627120000), a thin wrapper over get_calendar_events_v2 that adds
// added/updated freshness. Its time fields inherit v2's wall-clock (local-as-UTC)
// convention -- see the CalendarEventRow note in eventRpcs.ts.

import { haversineKm } from '@/lib/geo/haversineKm';
import { isFestivalByFormat } from '@/lib/eventFormat';
import { eventHref } from '@/lib/seo/eventHref';
import {
  instantToLondonWallClockStamp,
  londonDateKey,
  londonMinutesOfDay,
  londonWallClockToInstant,
  normalisePostgrestTimestamp,
} from '@/lib/londonDate';

export type MapCategory = 'class' | 'party' | 'mix' | 'fest' | 'social';
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

/**
 * A "remote" row: a festival merged in from the SITEWIDE upcoming-festivals
 * feed (useUpcomingFestivalsGlobal) because the city-scoped 90-day occurrence
 * query did not already return it. pages/Index.tsx stamps those synthetic rows
 * with a 'remote-' occurrence_id; every surface that must treat them
 * differently (route to /festival/:id rather than /event/:id, render
 * RemoteFestivalRow, exempt them from the feed's day window) tests them here.
 *
 * Sentinel-based, deliberately NOT date- or coord-based. A far-future LONDON
 * festival is a normal local row and must stay one, and a local row with no
 * coords is not "abroad" -- so `lat == null` and `city_slug == null` both
 * MISCLASSIFY real local rows and must not be used for this. (Separately,
 * mapListDerivations.isOnCityMap decides map PINS by city_slug; that is a
 * different question from where a row belongs in the list.)
 */
export const isRemoteRow = (e: Pick<MapEvent, 'occurrence_id'>): boolean =>
  e.occurrence_id.startsWith('remote-');

/**
 * The href for a feed row. Remote rows resolve to /festival/:id; everything
 * else to the event page for its occurrence.
 *
 * Exists because getting this wrong is INVISIBLE in normal use: useMapList's
 * fromCard intercepts left-click and routes correctly, so a row whose href
 * still pointed at /event/:id?occurrenceId=remote-<uuid> looked fine until you
 * middle-clicked, cmd-clicked, copied the link, or were a crawler -- and then
 * you landed on an event route with a synthetic occurrence id that matches no
 * occurrence. Every row component takes its href from here so the three
 * surfaces (feed, Tonight, News) cannot drift apart again.
 */
export const rowHref = (e: MapEvent): string =>
  isRemoteRow(e) ? `/festival/${e.event_id}` : eventHref(e, e.occurrence_id);

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

/** Is `e` on the caller's `today` (a London day key)? The SINGLE definition of
 *  the day match -- todayLiveStatus gates on it, and so does the JSX that decides
 *  whether to mount a LiveBadge at all. Kept in one place deliberately: when the
 *  two were written separately, a mount gate could suppress a badge that
 *  todayLiveStatus would have returned, and no test would have caught it.
 *
 *  `today` is deliberately NOT nullable. An earlier signature accepted
 *  null/undefined and returned true for it, which fails OPEN twice over: an
 *  event dated next year reported 'on-now' at its start time on any date, and a
 *  call site that forgot the prop silently re-subscribed every feed row to the
 *  clock. Callers with no pinned day should let todayLiveStatus derive one. */
export function isTodayRow(e: MapEvent, today: string): boolean {
  return e.instance_date === today;
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
 *  'HH:MM:SS', a 'YYYY-MM-DD HH:MM:SS+00' wall-clock string, or a T-separated
 *  ISO instant. Null if it has no parseable time. Regex-free to keep this hot
 *  path cheap.
 *
 *  The T form is accepted DEFENSIVELY, to keep this in step with formatTime's
 *  regex (which has always matched both). When the two disagreed, a row could
 *  PRINT a time and then sort to the END of its day-group.
 *
 *  It is NOT a licence to feed this function a true instant. The HH:MM is read
 *  as-stored and never tz-converted, so an instant must be normalised to the
 *  naive local-as-UTC convention BEFORE it gets here -- see
 *  instantToLondonWallClockStamp, applied to the global festivals feed at the
 *  pages/Index.tsx boundary. Parsing an instant's digits directly renders it an
 *  hour early for the whole BST season. */
function hhmmToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const space = s.indexOf(' ');
  const sep = space >= 0 ? space : s.indexOf('T');
  const timePart = sep >= 0 ? s.slice(sep + 1) : s;
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

/** Latest end of an event in minutes-from-midnight (split ends, else end_time).
 *  MAY EXCEED 1440: a split end past midnight is wrapped BEFORE the max, so a
 *  Class & Party row (class 19:00-20:30, party 21:00-02:00) returns 1560 and not
 *  1230. Taking the raw max let the class end outrank the party end, and
 *  todayLiveStatus's own `end < start` wrap could not recover it -- 1230 is not
 *  less than the 19:00 start, so nothing looked wrong and the "On now" badge
 *  went dark at 20:31 with the party still five hours from closing. */
export function endMinutes(e: MapEvent): number | null {
  // PAIRED, not global. Each end is wrapped against ITS OWN start, because only
  // that comparison means "this end is on the following day". Wrapping against
  // the earliest start across both halves reads a class ending 20:30 on a row
  // whose only start is a 21:00 party as 20:30 TOMORROW, which outranks the real
  // 23:00 party end by 21 hours -- a false "On now" all evening, and one the
  // marks cannot expire because a mark past 1440 is left to the day bound. An
  // end whose own start is absent is not wrapped: nothing on the row says it
  // belongs to the next day.
  const split = [
    [hhmmToMinutes(e.class_start), hhmmToMinutes(e.class_end)],
    [hhmmToMinutes(e.party_start), hhmmToMinutes(e.party_end)],
  ]
    .map(([s, end]) => (end == null ? null : s != null && end < s ? end + 1440 : end))
    .filter((n): n is number => n != null);
  return split.length ? Math.max(...split) : hhmmToMinutes(e.end_time);
}

export type LiveStatus = 'on-now' | 'soon' | null;

/** How long before its start an event reads 'soon'. Named rather than inline
 *  because it is the width of a claim the edge cache is NOT bounded on: see
 *  soonestLiveStatusChangeMs, which tracks the on-now window only and says why.
 *  NOT exported: nothing outside this file consumes it, and an export whose
 *  documented link lives only in prose is API surface bought for nothing. */
const SOON_WINDOW_MINUTES = 90;

/** Real-time status for a TODAY row: 'on-now' while inside the window, 'soon'
 *  when it starts within 90 min, else null. Cancelled / non-today rows return
 *  null. A crossing-midnight end is wrapped so a 9pm-2am party still reads
 *  'on-now' at 11pm.
 *
 *  `today` is the caller's already-derived London day key. Pass it wherever one
 *  is in hand (the feed pins one in state.today): deriving it here instead runs
 *  an Intl.format() per row per render. Defaults to deriving from `now`.
 *  Caveat: when passed, `today` and `now` are two independent clocks and can
 *  disagree for up to a minute either side of London midnight -- so a row can
 *  briefly miss its badge at the rollover. Deliberate: the alternative is an
 *  Intl.format() per row per render, and the cell is decorative. */
export function todayLiveStatus(
  e: MapEvent,
  now = new Date(),
  today = todayStr(now),
): LiveStatus {
  if (e.is_cancelled || !isTodayRow(e, today)) return null;
  const start = startMinutes(e);
  if (start == null) return null;
  let end = endMinutes(e);
  if (end != null && end < start) end += 1440;
  // Event minutes are London wall-clock, so "now" must be too — browser-local
  // minutes shift the on-now/soon window by the visitor's offset.
  const nowMin = londonMinutesOfDay(now);
  if (nowMin >= start && (end == null || nowMin <= end)) return 'on-now';
  if (start > nowMin && start - nowMin <= SOON_WINDOW_MINUTES) return 'soon';
  return null;
}

/**
 * The next instant at which `todayLiveStatus` would open or close an ON-NOW
 * window for ANY of these rows -- or null if none does again today.
 *
 * WHY IT EXISTS. The homepage loader pins its clock and the feed server-renders
 * the badge from it, so "On now" ships in the crawled HTML rather than
 * appearing after hydration. That document is edge-cached, and time passing is
 * not a content edit, so nothing evicts it: a document rendered at 22:55 while
 * a social was running is otherwise still served at 23:30, to a reader or to
 * Googlebot, claiming the social is on. The DAY bound (secondsUntilKeyRollsOver)
 * does not reach this -- 23:30 is the same calendar day as 22:55 -- which is why
 * home needs a second, tighter bound and the SEO landings do not.
 *
 * DERIVED FROM THE SAME PREDICATE IT BOUNDS. The edges are read off
 * `startMinutes`/`endMinutes` -- the inputs todayLiveStatus itself branches on
 * -- so a change to the split-time precedence moves the badge and its expiry
 * together. Anything less would be a second copy of the rule, silently
 * outliving the first.
 *
 * THE 'SOON' DECORATION IS NOT BOUNDED, and this is the difference between a
 * usable TTL and a punitive one. Three marks a row rather than two, all of them
 * 90 minutes ahead of a start, is what collapses the busiest document's edge TTL
 * to minutes through the exact hours it is busiest -- and what it buys is
 * precision on the one transition where a stale document does not make a false
 * claim. Missing a "Soon" is an omitted advance warning; showing "Soon" while an
 * event runs, or "On now" after it finished, is a statement about the present
 * that is untrue, and those are the two edges below. Same line the freshness
 * stamps are excluded on in app/routes/home.tsx: bound what can be WRONG, not
 * everything that can be DIFFERENT.
 *
 * ONLY MARKS INSIDE THE PINNED DAY. A start before 00:00, or an on-now window
 * running past midnight, is left to the caller's day bound, which is tighter
 * than either. Inside the day one wall-clock hour a year is still
 * ambiguous and one does not exist at all; the conversion below resolves both
 * downwards, never upwards.
 *
 * `pinnedNowMs` is the instant the BADGE was computed at, not the instant this
 * is called at. Marks at or before it have already been spent, and a caller
 * measuring seconds-until from a later clock read gets a non-positive answer for
 * a mark the pin has passed but emission has not -- which is the honest one: the
 * document is already wrong and must not be cached.
 *
 * Returns epoch ms so the caller owns the "how long from now" reading; see
 * app/routes/home.tsx for why that has to be measured at emission.
 */
export function soonestLiveStatusChangeMs(
  events: MapEvent[],
  today: string,
  pinnedNowMs: number,
): number | null {
  const marks = new Set<number>();
  for (const e of events) {
    // Same two gates todayLiveStatus opens with: a cancelled or non-today row
    // never shows a badge, so it never expires one either.
    if (e.is_cancelled || !isTodayRow(e, today)) continue;
    const start = startMinutes(e);
    if (start == null) continue;
    let end = endMinutes(e);
    if (end != null && end < start) end += 1440;
    // The two edges of the ON-NOW window, and deliberately not the null ->
    // 'soon' edge at start - SOON_WINDOW_MINUTES (see the note above).
    marks.add(start); //                       -> 'on-now'
    // on-now holds while nowMin <= end, so the FIRST minute it does not is
    // end + 1. Off-by-one here would expire the badge a minute early, which is
    // merely wasteful, or a minute late, which is the defect.
    if (end != null) marks.add(end + 1); //    'on-now' -> null
  }

  // SELECT IN MINUTE SPACE, CONVERT ONCE. Minutes are totally ordered inside the
  // pinned day and todayLiveStatus decides in exactly this space, so converting
  // every mark would pay two Intl passes each -- dozens of them on a busy
  // evening -- on the SSR path of the busiest document, to produce one number.
  //
  // The precondition that makes it sound is the one todayLiveStatus is already
  // called under: `today` is the London day `pinnedNowMs` falls in. home.tsx
  // holds it by reading both from a single Date.now(), on the straddle path too.
  const nowMin = londonMinutesOfDay(new Date(pinnedNowMs));
  let soonestMin: number | null = null;
  for (const minute of marks) {
    if (minute < 0 || minute >= 1440) continue;
    if (minute <= nowMin) continue; // already spent at the pin
    if (soonestMin === null || minute < soonestMin) soonestMin = minute;
  }
  if (soonestMin === null) return null;

  const hh = String(Math.floor(soonestMin / 60)).padStart(2, '0');
  const mm = String(soonestMin % 60).padStart(2, '0');
  const stamp = `${today} ${hh}:${mm}:00+00`;
  // The row times are London wall-clock, so the mark is too; convert to a true
  // instant rather than treating the stamp as UTC (an hour out all BST).
  const at = londonWallClockToInstant(stamp);
  if (!at) return null;
  const ms = at.getTime();
  // THE TWO DAYS A YEAR THE WALL CLOCK IS NOT A FUNCTION. In October 01:00-01:59
  // happens twice and londonWallClockToInstant's fixed point lands on the SECOND
  // (GMT) pass, an hour LATE; in March it does not happen at all and the fixed
  // point lands after the jump, up to an hour late again. Late is the one
  // direction a cache bound must never err in -- it buys servability for a claim
  // that is already false -- which is why secondsUntilKeyRollsOver carries its
  // own "never once long" invariant. Round-trip the instant: if it does not
  // reproduce the stamp (the March gap) or the PREVIOUS hour also reproduces it
  // (the October repeat), the honest mark is an hour earlier. Two extra Intl
  // passes, on one mark, never in the loop.
  const earlier = ms - 3_600_000;
  const roundTrips = instantToLondonWallClockStamp(at.toISOString()) === stamp;
  const earlierAlsoTrips = instantToLondonWallClockStamp(new Date(earlier).toISOString()) === stamp;
  // Inside the repeated hour itself this can land at or before `pinnedNowMs`,
  // and the caller reads that as a non-positive bound and declines to cache --
  // which is the right answer while the badge's own minute is ambiguous.
  return roundTrips && !earlierAlsoTrips ? ms : earlier;
}
