/**
 * Which stats the public organiser page shows in its stats strip. One pure
 * decision (no I/O, no Date.now(): `now` is an input), pinned by
 * src/modules/profile/__tests__/organiserStats.matrix.test.ts over the real
 * shapes prod holds. NOT wired into any screen yet (brief
 * docs/briefs/organiser-stats-mapping.md, branch brief/organiser-stats-mapping).
 *
 * The rule: walk the stats in PRIORITY order and keep the first
 * MAX_ORGANISER_STATS that qualify. A stat qualifies only when its value is a
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
  weekdayOfKey,
} from '@/lib/londonDate';
import { ROLLOVER_HOUR } from '@/lib/programDayRollover';

// ---- Thresholds (owner's first guesses; the ONE place to tune them) --------
export const MAX_ORGANISER_STATS = 3;
/** Tickets sold below this are never shown. */
export const TICKETS_SOLD_MIN = 100;
/** Unique Going dancers below this are never shown. */
export const DANCERS_CAME_MIN = 100;
/** Past non-cancelled nights needed before "Nights hosted" shows. */
export const NIGHTS_HOSTED_MIN = 5;
/** Weekly rhythm: dates in the last 12 months on the top weekday ... */
export const WEEKLY_RHYTHM_MIN_DATES = 4;
/** ... and that weekday's share of all dates in the window. */
export const WEEKLY_RHYTHM_MIN_SHARE = 0.6;
/** Earliest founded_year accepted as real (anything older is junk input). */
export const FOUNDED_YEAR_MIN = 1950;

export type OrganiserStatKey =
  | 'next_night'
  | 'last_night'
  | 'tickets_sold'
  | 'dancers_came'
  | 'nights_hosted'
  | 'weekly_rhythm'
  | 'running_since'
  | 'venues';

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
  /** Tickets sold for this organiser. null/undefined = ticketing not live. */
  ticketsSold?: number | null;
  /** Unique Going dancers. null/undefined = Going data not live. */
  dancersCame?: number | null;
  /** The organiser's own founded_year. */
  foundedYear?: number | null;
  /** Venue names of the organiser's nights; shown only when exactly one distinct. */
  venueNames?: ReadonlyArray<string | null | undefined>;
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

const WEEKDAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const countFmt = new Intl.NumberFormat('en-GB');

/** Largest of 1, 2.5, 5 x 10^n (n >= 2) not above n: 100, 250, 500, 1000, ... */
export function niceFloor(n: number): number | null {
  if (!Number.isFinite(n) || n < 100) return null;
  let best = 100;
  for (let base = 100; base <= n; base *= 10) {
    for (const m of [1, 2.5, 5]) {
      const step = m * base;
      if (step <= n) best = step;
    }
  }
  return best;
}

/** "250+" / "1,000+", or null below 100. */
export const roundedCount = (n: number | null | undefined): string | null => {
  if (n === null || n === undefined) return null;
  const step = niceFloor(n);
  return step === null ? null : `${countFmt.format(step)}+`;
};

// ---- The decision ----------------------------------------------------------

export function organiserStats(input: OrganiserStatsInput): OrganiserStat[] {
  const todayKey = nowNightKey(input.now);

  const upcoming: string[] = [];
  const past: string[] = [];
  for (const n of input.nights) {
    if (n.cancelled) continue;
    const key = nightKeyOf(n.start);
    if (!key) continue;
    const isPast = n.isPast ?? key < todayKey;
    (isPast ? past : upcoming).push(key);
  }
  upcoming.sort();
  past.sort();

  const candidates: Array<() => OrganiserStat | null> = [
    // 1. Next night, else last night.
    () => {
      if (upcoming.length > 0) {
        const key = upcoming[0];
        const diff = londonDaysBetweenKeys(todayKey, key);
        const value = diff <= 0 ? 'Tonight' : diff === 1 ? 'Tomorrow' : shortNightLabel(key);
        return { key: 'next_night', value, label: 'Next night' };
      }
      if (past.length > 0) {
        return { key: 'last_night', value: shortNightLabel(past[past.length - 1]), label: 'Last night' };
      }
      return null;
    },
    // 2. Tickets sold (ticketing live and >= TICKETS_SOLD_MIN).
    () => {
      if (input.ticketsSold == null || input.ticketsSold < TICKETS_SOLD_MIN) return null;
      const value = roundedCount(input.ticketsSold);
      return value ? { key: 'tickets_sold', value, label: 'Tickets sold' } : null;
    },
    // 3. Dancers came (Going live and >= DANCERS_CAME_MIN).
    () => {
      if (input.dancersCame == null || input.dancersCame < DANCERS_CAME_MIN) return null;
      const value = roundedCount(input.dancersCame);
      return value ? { key: 'dancers_came', value, label: 'Dancers came' } : null;
    },
    // 4. Nights hosted.
    () => (new Set(past).size >= NIGHTS_HOSTED_MIN
      ? { key: 'nights_hosted', value: countFmt.format(new Set(past).size), label: 'Nights hosted' }
      : null),
    // 5. Weekly rhythm over the last 12 months (distinct dates, up to today).
    () => {
      const fromKey = keyOneYearBefore(todayKey);
      const dates = new Set([...past, ...upcoming].filter((k) => k > fromKey && k <= todayKey));
      if (dates.size === 0) return null;
      const perDay = [0, 0, 0, 0, 0, 0, 0];
      for (const k of dates) perDay[weekdayOfKey(k)] += 1;
      const top = Math.max(...perDay);
      if (top < WEEKLY_RHYTHM_MIN_DATES || top / dates.size < WEEKLY_RHYTHM_MIN_SHARE) return null;
      return { key: 'weekly_rhythm', value: WEEKDAY_PLURAL[perDay.indexOf(top)], label: 'Every week' };
    },
    // 6. Running since: real founded_year, else first night > 1 year ago.
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
    // 8. One main venue (7, teaching line-up, is deliberately not here).
    () => {
      const names = new Set(
        (input.venueNames ?? []).map((v) => (v ?? '').trim()).filter((v) => v.length > 0),
      );
      if (names.size !== 1) return null;
      return { key: 'venues', value: [...names][0], label: 'Venue' };
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
