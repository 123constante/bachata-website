/**
 * Which stats the public organiser page shows in its stats strip. One pure
 * decision (no I/O, no Date.now(): `now` is an input), pinned by
 * src/modules/profile/__tests__/organiserStats.matrix.test.ts over the real
 * shapes prod holds. Rendered by OrganiserProfile via organiserStatsByFeed.
 *
 * The strip offers ONLY three stats, in this order: Next night, Nights hosted,
 * Running since (owner decision 5). Each qualifies on its own; fewer
 * qualifying means fewer shown (MAX_ORGANISER_STATS is the natural cap). A stat qualifies only when its value is a
 * real, non-zero fact -- never 0, empty, "--" or a placeholder. Nothing
 * qualifying returns [] and the screen hides the strip.
 *
 * Dates are London nights. A start between 00:00 and ROLLOVER_HOUR (08:00)
 * belongs to the previous night (src/lib/programDayRollover.ts), and so does
 * `now`: at 01:00 Friday, Thursday's night is still "Tonight".
 */
import {
  addDaysToKey,
  isRealDateKey,
  keyToUtcNoon,
  londonDateKey,
  londonDaysBetweenKeys,
  londonMinutesOfDay,
  parseUtcIso,
} from '@/lib/londonDate';
import { ROLLOVER_HOUR } from '@/lib/programDayRollover';

// ---- Thresholds (owner's first guesses; the ONE place to tune them) --------
export const MAX_ORGANISER_STATS = 3;
/** Past non-cancelled nights needed before "Nights hosted" shows. */
export const NIGHTS_HOSTED_MIN = 5;
/** Earliest founded_year accepted as real (anything older is junk input). */
export const FOUNDED_YEAR_MIN = 1950;

export type OrganiserStatKey =
  | 'next_night'
  | 'nights_hosted'
  | 'running_since';

export interface OrganiserStat {
  key: OrganiserStatKey;
  value: string;
  label: string;
  /** Hover/aria detail, only where the value is an estimate. */
  title?: string;
}

export interface OrganiserStatNight {
  /**
   * London wall-clock start ('YYYY-MM-DDTHH:MM[:SS]', space or T, a '+00'
   * suffix is the stored as-if-UTC convention and is read as wall clock) or a
   * bare 'YYYY-MM-DD' instance_date. Unparseable values are ignored.
   */
  start: string | null | undefined;
  cancelled?: boolean;
  /**
   * The server's is_past flag when the caller has it (it carries the 6h grace
   * window). Absent: a night is past when its night is before now's night.
   */
  isPast?: boolean;
}

export interface OrganiserStatsInput {
  now: Date;
  /** One entry per listed date (occurrence), upcoming and past together. */
  nights: OrganiserStatNight[];
  /** The organiser's own founded_year. */
  foundedYear?: number | null;
}

// ---- Night keys ------------------------------------------------------------

/** Night key of `now`: London today, rolled back before ROLLOVER_HOUR. */
export function nowNightKey(now: Date): string {
  const key = londonDateKey(now);
  return londonMinutesOfDay(now) < ROLLOVER_HOUR * 60 ? addDaysToKey(key, -1) : key;
}

const WALL_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(?:[zZ]|[+-]00(?::?00)?)?$/;

/** Night key of a stored start, or null when it is not a real date. */
export function nightKeyOf(start: string | null | undefined): string | null {
  if (!start) return null;
  const trimmed = start.trim();
  const m = WALL_RE.exec(trimmed);
  let key: string;
  let hour: number;
  if (m) {
    key = m[1];
    hour = m[2] === undefined ? 12 : Number(m[2]);
  } else {
    // A true instant with a non-zero offset: read it on the London clock.
    const d = parseUtcIso(trimmed);
    if (!d) return null;
    key = londonDateKey(d);
    hour = Math.floor(londonMinutesOfDay(d) / 60);
  }
  if (!isRealDateKey(key)) return null;
  return hour < ROLLOVER_HOUR ? addDaysToKey(key, -1) : key;
}

/** The same calendar day one year earlier (29 Feb -> 28 Feb). */
const keyOneYearBefore = (key: string): string => {
  const y = Number(key.slice(0, 4)) - 1;
  const candidate = `${y}${key.slice(4)}`;
  return isRealDateKey(candidate) ? candidate : `${y}-02-28`;
};

// ---- Formatting ------------------------------------------------------------

const keyFmt = new Map<string, Intl.DateTimeFormat>();
const fmtUtc = (d: Date, opts: Intl.DateTimeFormatOptions): string => {
  const k = JSON.stringify(opts);
  let f = keyFmt.get(k);
  if (!f) { f = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }); keyFmt.set(k, f); }
  return f.format(d);
};

/** "Thu 12 Nov" (UTC-noon anchored, so every client timezone agrees). */
export const shortNightLabel = (key: string): string => {
  const d = new Date(keyToUtcNoon(key));
  return `${fmtUtc(d, { weekday: 'short' })} ${d.getUTCDate()} ${fmtUtc(d, { month: 'short' })}`;
};

const countFmt = new Intl.NumberFormat('en-GB');

// ---- The decision ----------------------------------------------------------

export function organiserStats(input: OrganiserStatsInput): OrganiserStat[] {
  const todayKey = nowNightKey(input.now);

  const upcoming: string[] = [];
  const past: string[] = [];
  for (const n of input.nights) {
    if (n.cancelled) continue;
    const key = nightKeyOf(n.start);
    if (!key) continue;
    // The server flag can only move a night to past (its 6h grace is for a night that just ended); it can never
    // keep a night from before tonight upcoming, or yesterday would read "Tonight".
    const isPast = n.isPast === true || key < todayKey;
    (isPast ? past : upcoming).push(key);
  }
  upcoming.sort();
  past.sort();

  const candidates: Array<() => OrganiserStat | null> = [
    // 1. Next night -- only when an upcoming night exists (no Last night fallback).
    () => {
      if (upcoming.length === 0) return null;
      const key = upcoming[0];
      const diff = londonDaysBetweenKeys(todayKey, key);
      const value = diff <= 0 ? 'Tonight' : diff === 1 ? 'Tomorrow' : shortNightLabel(key);
      return { key: 'next_night', value, label: 'Next night' };
    },
    // 2. Nights hosted.
    () => (new Set(past).size >= NIGHTS_HOSTED_MIN
      ? { key: 'nights_hosted', value: countFmt.format(new Set(past).size), label: 'Nights hosted' }
      : null),
    // 3. Running since: real founded_year, else first night > 1 year ago.
    () => {
      const thisYear = Number(todayKey.slice(0, 4));
      const fy = input.foundedYear;
      if (fy != null && Number.isInteger(fy) && fy >= FOUNDED_YEAR_MIN && fy <= thisYear) {
        return { key: 'running_since', value: `Since ${fy}`, label: 'Running' };
      }
      const first = [...past, ...upcoming].sort()[0];
      if (!first || first > keyOneYearBefore(todayKey)) return null;
      let years = thisYear - Number(first.slice(0, 4));
      if (todayKey.slice(5) < first.slice(5)) years -= 1;
      if (years < 1) return null;
      return {
        key: 'running_since',
        value: `~${years} ${years === 1 ? 'yr' : 'yrs'}`,
        label: 'Running',
        title: `Estimated from the earliest listed night (${first.slice(0, 4)}) -- not a confirmed founding date`,
      };
    },
  ];

  const out: OrganiserStat[] = [];
  for (const c of candidates) {
    if (out.length >= MAX_ORGANISER_STATS) break;
    const s = c();
    if (s && s.value.trim() !== '' && s.value !== '--' && s.value !== '0') out.push(s);
  }
  return out;
}
