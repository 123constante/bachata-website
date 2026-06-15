// Festival Map -- pure, React-free derivations for the discovery list/map state.
// Extracted from useMapList so each rule (dedupe, per-tab list, map visibility,
// glow, calendar dots, date grouping) is unit-testable in isolation. Everything
// is keyed by occurrence_id (string), never array index.

import type { MapEvent, MapCategory, MapFilter, MapTab } from './mapTypes';
import {
  matchesFilter,
  matchesQuery,
  distanceMiles,
  isFreshNew,
  freshnessDisplay,
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
      items: map.get(key)!,
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
    if (e.type === 'festival') {
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
  const week = new Set<string>();
  const venues = new Set<string>();
  for (const e of events) {
    if (e.venue_name) venues.add(e.venue_name);
    if (e.instance_date && e.instance_date >= today && e.instance_date < weekEnd) week.add(e.event_id);
  }
  return { thisWeek: week.size, venues: venues.size };
}
