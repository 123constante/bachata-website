// Festival Map -- pure, React-free derivations for the discovery list/map state.
// Extracted from useMapList so each rule (dedupe, per-tab list, map visibility,
// glow, calendar dots, date grouping) is unit-testable in isolation. Everything
// is keyed by occurrence_id (string), never array index.

import type { MapEvent, MapCategory, MapFilter, MapTab } from './mapTypes';
import {
  matchesFilter,
  matchesQuery,
  distanceMiles,
  startMinutes,
  isFreshNew,
  freshnessDisplay,
  isFestivalFormat,
  parseInstant,
  todayStr,
} from './mapTypes';

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Pin identity = event + physical coordinate (rounded ~11m). Coords, not
// venue_name, so two same-named-but-distinct venues don't collapse to one pin
// and one location vanish from the map (audit #5). pinKey is only called for
// coord-bearing rows (hasCoords guard), so lat/lng are present.
const pinKey = (e: MapEvent) =>
  `${e.event_id}|${e.lat?.toFixed(4) ?? ''},${e.lng?.toFixed(4) ?? ''}`;
const hasCoords = (e: MapEvent) => e.lat != null && e.lng != null;

/**
 * A row belongs on the CITY map when it has no city_slug (local/legacy rows) or
 * its city_slug matches the page city. Festivals are surfaced feed-wide by
 * design (get_calendar_events_v2 lets any festival bypass the city filter), so a
 * London-tab festival physically in another city carries real foreign coords --
 * pinning it drags fitBounds abroad (audit: Tunisia festival -> France centre).
 * Keeping such rows OFF the map (still listable, "further afield") is the fix.
 */
export const isOnCityMap = (e: MapEvent, citySlug: string | null | undefined) =>
  e.city_slug == null || citySlug == null || e.city_slug === citySlug;

export interface DedupedPins {
  pins: MapEvent[];
  /** every coord-bearing occurrence_id -> the occurrence_id of its pin */
  pinKeyForOcc: Map<string, string>;
}

/**
 * Collapse one-row-per-occurrence-day into one pin per physical event+venue
 * (soonest day wins), and map every day's occurrence to its representative pin.
 * Coordless rows get no pin (still listable, just not on the map).
 */
export function dedupePins(events: MapEvent[]): DedupedPins {
  const rep = new Map<string, MapEvent>();
  for (const e of events) {
    if (!hasCoords(e)) continue;
    const k = pinKey(e);
    const cur = rep.get(k);
    if (!cur || (e.instance_date ?? '9999-99-99') < (cur.instance_date ?? '9999-99-99')) {
      rep.set(k, e);
    }
  }
  const pinKeyForOcc = new Map<string, string>();
  for (const e of events) {
    if (!hasCoords(e)) continue;
    const r = rep.get(pinKey(e));
    if (r) pinKeyForOcc.set(e.occurrence_id, r.occurrence_id);
  }
  return { pins: [...rep.values()], pinKeyForOcc };
}

/**
 * One representative row per event_id, preferring the soonest occurrence on or
 * after `today` (else the soonest overall). Used by the News feed so a weekly
 * class freshened once doesn't appear once per future date.
 */
export function dedupeByEvent(events: MapEvent[], today = todayStr()): MapEvent[] {
  const best = new Map<string, MapEvent>();
  for (const e of events) {
    const cur = best.get(e.event_id);
    if (!cur) {
      best.set(e.event_id, e);
      continue;
    }
    best.set(e.event_id, preferRow(cur, e, today));
  }
  return [...best.values()];
}

function preferRow(a: MapEvent, b: MapEvent, today: string): MapEvent {
  const ad = a.instance_date ?? '';
  const bd = b.instance_date ?? '';
  const aUp = ad >= today;
  const bUp = bd >= today;
  if (aUp && bUp) return ad <= bd ? a : b; // both upcoming -> soonest
  if (aUp) return a;
  if (bUp) return b;
  return ad >= bd ? a : b; // both past -> most recent
}

/** Today's events, nearest first (events without coords sort last, stably). */
export function tonightEvents(
  events: MapEvent[],
  user: { lat: number; lng: number } | null,
  today = todayStr(),
): MapEvent[] {
  const list = events.filter((e) => e.instance_date === today);
  return [...list].sort((a, b) => {
    const da = distanceMiles(a, user);
    const db = distanceMiles(b, user);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
}

/** Recently added/updated events, freshest first, one row per event. */
export function newsEvents(events: MapEvent[], today = todayStr()): MapEvent[] {
  return dedupeByEvent(events, today).sort((a, b) => {
    const ia = freshnessDisplay(a).iso;
    const ib = freshnessDisplay(b).iso;
    // parseInstant normalises the PostgREST timestamptz so iOS Safari sorts News
    // correctly (audit #6); NaN (unparseable) sinks to the bottom.
    const ta = ia ? parseInstant(ia) : NaN;
    const tb = ib ? parseInstant(ib) : NaN;
    return (Number.isNaN(tb) ? -Infinity : tb) - (Number.isNaN(ta) ? -Infinity : ta);
  });
}

/** Full British date label from a 'YYYY-MM-DD' instance_date, e.g. "Friday, 6 June". */
export function formatDayLabel(instanceDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(instanceDate);
  if (!m) return instanceDate;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dow = new Date(y, mo - 1, d).getDay();
  return `${WEEKDAYS[dow]}, ${d} ${MONTHS[mo - 1]}`;
}

export interface DateGroup {
  key: string;
  label: string;
  items: MapEvent[];
}

/** Group events by instance_date, ascending, with a full-weekday label + count. */
export function groupByDate(events: MapEvent[]): DateGroup[] {
  const map = new Map<string, MapEvent[]>();
  for (const e of events) {
    const k = e.instance_date ?? '';
    const arr = map.get(k);
    if (arr) arr.push(e);
    else map.set(k, [e]);
  }
  return [...map.keys()]
    .sort()
    .map((key) => ({
      key,
      label: key ? formatDayLabel(key) : 'Date TBC',
      // Within a day, order chronologically so a group reads as a timeline;
      // rows with no parseable start sink to the end (stable).
      items: [...map.get(key)!].sort((a, b) => {
        const sa = startMinutes(a);
        const sb = startMinutes(b);
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sa - sb;
      }),
    }));
}

/** Per-day distinct dot categories (drives the calendar dots). A class+party
 *  event contributes BOTH a party and a class dot rather than a single 'mix'
 *  dot, so the grid answers "parties? classes? festival?" at a glance. Dots are
 *  emitted in a stable order (party, class, fest); 'social' is a fallback only
 *  for a day whose events are neither class, party nor festival. */
export function calendarDays(events: MapEvent[]): Map<string, MapCategory[]> {
  const flags = new Map<string, { party: boolean; class: boolean; fest: boolean; other: boolean }>();
  for (const e of events) {
    if (!e.instance_date) continue;
    const f = flags.get(e.instance_date) ?? { party: false, class: false, fest: false, other: false };
    if (isFestivalFormat(e)) {
      f.fest = true;
    } else if (e.has_party || e.has_class) {
      if (e.has_party) f.party = true;
      if (e.has_class) f.class = true;
    } else {
      f.other = true;
    }
    flags.set(e.instance_date, f);
  }
  const m = new Map<string, MapCategory[]>();
  for (const [date, f] of flags) {
    const cats: MapCategory[] = [];
    if (f.party) cats.push('party');
    if (f.class) cats.push('class');
    if (f.fest) cats.push('fest');
    if (cats.length === 0 && f.other) cats.push('social');
    m.set(date, cats);
  }
  return m;
}

export interface ListArgs {
  events: MapEvent[];
  day: string | null;
  filter: MapFilter;
  q: string;
  user: { lat: number; lng: number } | null;
  today: string;
}

/** The events shown in the list for the current tab (search applied last). */
export function listFor(tab: MapTab, a: ListArgs): MapEvent[] {
  let base: MapEvent[];
  if (tab === 'tonight') base = tonightEvents(a.events, a.user, a.today);
  else if (tab === 'cal') base = a.day == null ? [] : a.events.filter((e) => e.instance_date === a.day);
  else if (tab === 'news') base = newsEvents(a.events, a.today);
  else base = a.events;
  // Category filter is an orthogonal axis: apply it on every tab so the chips
  // compose with each lens (Tonight + Classes, What's New + Festivals, ...).
  return base.filter((e) => matchesFilter(e, a.filter) && matchesQuery(e, a.q));
}

/**
 * Which pins (occurrence_ids) the map shows. News + empty Calendar keep the
 * whole city on the map for context; every other tab mirrors the list.
 */
export function mapVisibleFor(
  tab: MapTab,
  day: string | null,
  listEvents: MapEvent[],
  pinKeyForOcc: Map<string, string>,
  allEvents: MapEvent[],
  q: string,
  filter: MapFilter,
): string[] {
  const source =
    tab === 'news' || (tab === 'cal' && day == null)
      ? allEvents.filter((e) => matchesFilter(e, filter) && matchesQuery(e, q))
      : listEvents;
  const pins = new Set<string>();
  for (const e of source) {
    const pin = pinKeyForOcc.get(e.occurrence_id);
    if (pin) pins.add(pin);
  }
  return [...pins];
}

/** Pins that should pulse: newly-added events, News tab only. */
export function glowFor(
  tab: MapTab,
  events: MapEvent[],
  pinKeyForOcc: Map<string, string>,
  now = Date.now(),
): string[] {
  if (tab !== 'news') return [];
  const pins = new Set<string>();
  for (const e of events) {
    if (!isFreshNew(e, 30, now)) continue;
    const pin = pinKeyForOcc.get(e.occurrence_id);
    if (pin) pins.add(pin);
  }
  return [...pins];
}

// ---- calendar month grid --------------------------------------------------

export interface MonthCell {
  /** 'YYYY-MM-DD' for a real day, or null for a leading/trailing blank. */
  date: string | null;
  day: number | null;
  cats: MapCategory[];
  isToday: boolean;
  isSelected: boolean;
  /** date < today (a past day). Blanks are never past. */
  isPast: boolean;
}

export interface MonthGrid {
  year: number;
  /** 0-based month. */
  month: number;
  label: string; // e.g. 'June 2026'
  weeks: MonthCell[][]; // Monday-first rows of 7
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Lay out one month as Monday-first week rows, tagging each day with its
 * distinct event categories (for dots), today, and the selected day. Pure so
 * the calendar grid stays React-free and unit-testable.
 */
export function buildMonthCells(
  year: number,
  month: number, // 0-based
  cal: Map<string, MapCategory[]>,
  today: string,
  selectedDay: string | null,
): MonthGrid {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS getDay(): 0=Sun..6=Sat. Convert to Monday-first leading-blank count.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push({ date: null, day: null, cats: [], isToday: false, isSelected: false, isPast: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    cells.push({
      date,
      day: d,
      cats: cal.get(date) ?? [],
      isToday: date === today,
      isSelected: date === selectedDay,
      isPast: date < today,
    });
  }
  // Pad the final week to a multiple of 7.
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, cats: [], isToday: false, isSelected: false, isPast: false });
  }

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, label: `${MONTHS[month]} ${year}`, weeks };
}

// ---- homepage stat strip --------------------------------------------------

export interface HomeStats {
  /** distinct events with an instance today */
  tonight: number;
  /** distinct events with an instance in the next 7 days */
  thisWeek: number;
  /** distinct venues with an upcoming listing */
  venues: number;
}

/** Shift a 'YYYY-MM-DD' date string by n days (pure, tz-safe). */
function shiftDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * Live headline stats for the News-tab brand card, derived from the same
 * map-events window the page already loaded (no extra query). Distinct by
 * event_id / venue so recurring listings don't inflate the counts.
 */
export function homeStats(events: MapEvent[], today = todayStr()): HomeStats {
  const weekEnd = shiftDate(today, 7);
  const tonight = new Set<string>();
  const week = new Set<string>();
  const venues = new Set<string>();
  for (const e of events) {
    if (e.venue_name) venues.add(e.venue_name);
    if (e.instance_date === today) tonight.add(e.event_id);
    if (e.instance_date && e.instance_date >= today && e.instance_date < weekEnd) week.add(e.event_id);
  }
  return { tonight: tonight.size, thisWeek: week.size, venues: venues.size };
}
/** Parse 'YYYY-MM-DD' into numeric calendar parts (no tz). */
function parseYMD(s: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

/**
 * Compact festival date-range label from a set of 'YYYY-MM-DD' dates:
 *   same month  -> "19-21 June"
 *   cross month -> "29 June - 1 July"
 * Returns null for a single distinct day (nothing to range). The separator is an
 * en-dash written as the \u2013 escape so source stays ASCII (FUSE/cp1252
 * mojibake guard) yet renders a real en-dash.
 */
export function festivalRangeLabel(dates: string[]): string | null {
  const uniq = [...new Set(dates.filter(Boolean))].sort();
  if (uniq.length < 2) return null;
  const first = parseYMD(uniq[0]);
  const last = parseYMD(uniq[uniq.length - 1]);
  if (!first || !last) return null;
  const DASH = '\u2013';
  if (first.y === last.y && first.mo === last.mo) {
    return `${first.d}${DASH}${last.d} ${MONTHS[first.mo - 1]}`;
  }
  return `${first.d} ${MONTHS[first.mo - 1]} ${DASH} ${last.d} ${MONTHS[last.mo - 1]}`;
}

/**
 * Collapse multi-day festivals to a single representative row (earliest day),
 * stamping festivalDateRange so flat lists show the festival ONCE with a date
 * range instead of one row per spanned day. Non-festival rows pass through
 * unchanged; single-day festivals get no range badge. The calendar grid keeps
 * per-day rows (it needs a dot per day) -- this is for flat list surfaces only.
 */
/** Representative-row preference for a collapsed festival: a non-cancelled
 *  day wins over a cancelled one, then the earliest instance_date. Keeps a
 *  festival shown as live unless EVERY day is cancelled, so a cancelled first
 *  day no longer mislabels the whole festival. */
function preferFestivalRep(a: MapEvent, b: MapEvent): boolean {
  if (a.is_cancelled !== b.is_cancelled) return !a.is_cancelled;
  return (a.instance_date ?? '9999-99-99') < (b.instance_date ?? '9999-99-99');
}

export function collapseFestivals(events: MapEvent[]): MapEvent[] {
  const rep = new Map<string, MapEvent>();
  const dates = new Map<string, string[]>();
  for (const e of events) {
    if (!isFestivalFormat(e)) continue;
    const d = e.instance_date ?? '';
    const ds = dates.get(e.event_id);
    if (ds) ds.push(d);
    else dates.set(e.event_id, [d]);
    const cur = rep.get(e.event_id);
    if (!cur || preferFestivalRep(e, cur)) rep.set(e.event_id, e);
  }
  const emitted = new Set<string>();
  const out: MapEvent[] = [];
  for (const e of events) {
    if (!isFestivalFormat(e)) {
      out.push(e);
      continue;
    }
    if (emitted.has(e.event_id)) continue;
    emitted.add(e.event_id);
    const r = rep.get(e.event_id) ?? e;
    const range = festivalRangeLabel(dates.get(e.event_id) ?? []);
    out.push(range ? { ...r, festivalDateRange: range } : r);
  }
  return out;
}

// ---- colocated events: one map pin per venue-coordinate -------------------

export interface LocationGroup {
  /** representative occurrence_id -- the marker's stable identity + face. */
  repOccId: string;
  /** the representative event (live-wins): drives the pin face + colour. */
  rep: MapEvent;
  lat: number;
  lng: number;
  venueName: string | null;
  area: string | null;
  /** all events at this venue-coordinate (already event-deduped by dedupePins). */
  members: MapEvent[];
  /** every member occurrence_id, for occ -> marker resolution. */
  memberOccs: string[];
  /** >= 2 distinct events here. */
  isStack: boolean;
  /** offset slot for the rare same-coord-different-venue case (0 otherwise). */
  offsetIndex: number;
}

/** Round coords to ~11m, matching pinKey, so grouping lines up with dedupePins. */
const groupCoordKey = (e: MapEvent) =>
  `${e.lat?.toFixed(4) ?? ''},${e.lng?.toFixed(4) ?? ''}`;

// Sentinel venue key so colocated rows with a NULL venue_name collapse together
// (same coord, no name to claim) -- rendered with the neutral "N events here".
const NO_VENUE = '__NO_VENUE__';

/** Live-wins representative: a non-cancelled event beats a cancelled one, then
 *  the soonest date -- so a busy venue's face is never a cancelled flyer. */
function pickLiveRep(members: MapEvent[]): MapEvent {
  return members.reduce((best, e) => {
    if (best.is_cancelled !== e.is_cancelled) return best.is_cancelled ? e : best;
    return (e.instance_date ?? '9999-99-99') < (best.instance_date ?? '9999-99-99') ? e : best;
  });
}

/**
 * Group already-deduped pins into one entry per physical venue-coordinate, so
 * the map renders ONE marker per location instead of overlapping per-event pins.
 * Only events that AGREE on venue_name collapse together (there is no venue_id);
 * same coord but different venue_name -> separate groups (offset so markercluster
 * still bundles them). Pins are already one-per-event_id+coord (dedupePins), so
 * members are distinct events (no festival day-duplication to dedupe again).
 */
export function groupPinsByLocation(pins: MapEvent[]): LocationGroup[] {
  const byCoord = new Map<string, MapEvent[]>();
  for (const e of pins) {
    if (e.lat == null || e.lng == null) continue;
    const k = groupCoordKey(e);
    const arr = byCoord.get(k);
    if (arr) arr.push(e);
    else byCoord.set(k, [e]);
  }
  const groups: LocationGroup[] = [];
  for (const atCoord of byCoord.values()) {
    const byVenue = new Map<string, MapEvent[]>();
    for (const e of atCoord) {
      const vk = e.venue_name ?? NO_VENUE;
      const arr = byVenue.get(vk);
      if (arr) arr.push(e);
      else byVenue.set(vk, [e]);
    }
    const venueGroups = [...byVenue.values()];
    venueGroups.forEach((members, i) => {
      const rep = pickLiveRep(members);
      groups.push({
        repOccId: rep.occurrence_id,
        rep,
        lat: members[0].lat as number,
        lng: members[0].lng as number,
        venueName: rep.venue_name ?? null,
        area: rep.area ?? null,
        members,
        memberOccs: members.map((m) => m.occurrence_id),
        isStack: members.length >= 2,
        // only the rare multi-venue-at-one-coord case needs an offset.
        offsetIndex: venueGroups.length > 1 ? i : 0,
      });
    });
  }
  return groups;
}

/**
 * Split the flat list into local rows and remote (other-city) festival rows.
 * Remote rows carry a 'remote-' occurrence_id sentinel (Index merges the global
 * upcoming-festivals query). Keeping them out of the default chronological
 * London stream stops a far-future festival abroad sitting under the
 * "What's on in London" h1; surfaces render them in a separate "Festivals
 * further afield" section instead. Sentinel-based, NOT date/coord based, so a
 * far-future LONDON festival stays local and a coordless local row is not
 * mistaken for "abroad".
 */
export function partitionRemote(events: MapEvent[]): { local: MapEvent[]; remote: MapEvent[] } {
  const local: MapEvent[] = [];
  const remote: MapEvent[] = [];
  for (const e of events) {
    if (e.occurrence_id.startsWith('remote-')) remote.push(e);
    else local.push(e);
  }
  return { local, remote };
}
