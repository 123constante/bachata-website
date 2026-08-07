// The site's calendar-time authority. Every "today / tonight / tomorrow /
// weekday / day range" derivation in src/ MUST come from here — never from
// browser-local Date math. The architecture guard
// (scripts/lint-runtime-architecture.mjs) bans `setHours(0,0,0,0)`,
// `new Date().getDay()` and `new Date().toISOString().slice(0,10)` outside
// this file, because each of those computes on the *browser's* calendar:
// events live on the LONDON calendar, so a visitor west of UTC saw "in -1
// days" and a visitor east of UTC saw yesterday's events as "tonight".
//
// Semantics reminders:
// - DB date-only values (next_event_date, instance_date) are London calendar
//   dates. Compare them with londonDaysFromTodayForKey / weekdayOfKey —
//   `new Date('YYYY-MM-DD')` parses as UTC midnight and shifts a day in
//   western timezones.
// - The public venue RPC (get_public_venues_list_v3) returns `next_event_iso`
//   as `(first_start AT TIME ZONE 'UTC')::text` — a timezone-LESS UTC
//   wall-clock string like "2026-05-22 19:00:00". Parse it with parseUtcIso.
// - RPC range params must be built with londonDayRangeUtc, not local midnight.
// - For a reactive "today" that survives long-lived tabs crossing midnight,
//   use the useLondonToday() hook (src/hooks/useLondonToday.ts).

const LONDON_TZ = 'Europe/London';

const londonKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LONDON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Parse a timestamp string from the public venue RPCs into a Date.
 * A bare "YYYY-MM-DD HH:mm:ss" (no zone) is treated as UTC, since that is what
 * the RPC emits; strings already carrying Z or a ±hh:mm offset pass through.
 * Returns null for empty/invalid input.
 */
/**
 * Normalise PostgREST timestamp text to a Date.parse-safe ISO form: swap the
 * date/time space for 'T' and pad a 2-digit zone offset ('+00') to '+00:00'
 * (Date.parse rejects both; iOS Safari is strictest). Shared by parseUtcIso
 * here and parseInstant in home-map/mapTypes — keep ONE normaliser.
 */
export const normalisePostgrestTimestamp = (iso: string): string =>
  iso.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');

export const parseUtcIso = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const hasZone = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(trimmed);
  const normalised = normalisePostgrestTimestamp(trimmed + (hasZone ? '' : 'Z'));
  const d = new Date(normalised);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * YYYY-MM-DD for the given instant in an arbitrary IANA timezone (DST-safe).
 * Falls back to the London calendar if `timeZone` is missing or invalid, so a
 * bad value can never throw at a call site.
 */
export const dateKeyInTz = (d: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return londonKeyFormatter.format(d);
  }
};

/** YYYY-MM-DD for the given instant, in London (DST-safe). */
export const londonDateKey = (d: Date): string => londonKeyFormatter.format(d);

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The single input boundary for every YYYY-MM-DD-key derivation below. Keys
 * are meant to come from londonDateKey (always well-formed), but a runtime with
 * incomplete Intl/Europe-London ICU data (old webviews, some crawlers) can
 * yield a malformed value — which used to propagate as NaN → `new Date(NaN)` →
 * `RangeError: Invalid time value` thrown during render (Sentry BACHATA-WEBSITE-2W).
 * Reject anything that isn't a real calendar key and degrade to London-today,
 * so a bad environment renders stale-but-valid instead of crashing.
 */
const safeKeyParts = (key: string): [number, number, number] => {
  const source = KEY_RE.test(key) ? key : londonKeyFormatter.format(new Date());
  const [y, m, d] = source.split('-').map(Number);
  if (
    !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) ||
    m < 1 || m > 12 || d < 1 || d > 31
  ) {
    // Belt-and-braces: even the formatter fallback is unparsable. Use epoch's
    // London date — impossible to reach in practice, never throws.
    const [fy, fm, fd] = londonKeyFormatter.format(new Date(0)).split('-').map(Number);
    return [fy, fm, fd];
  }
  return [y, m, d];
};

/**
 * UTC-noon epoch-ms anchor of a YYYY-MM-DD key: the standard way to read a
 * stored calendar day back out machine-timezone-independently (noon survives
 * DST and westward client zones where midnight shifts a day). Routed through
 * safeKeyParts, so a malformed key degrades instead of producing NaN.
 */
export const keyToUtcNoon = (key: string): number => {
  const [y, m, d] = safeKeyParts(key);
  return Date.UTC(y, m - 1, d, 12);
};

/**
 * Whole-day offset of `d` from `now`, both on the London calendar.
 * 0 = today (tonight), 1 = tomorrow, negative = in the past.
 */
export const londonDaysFromToday = (d: Date, now: Date = new Date()): number => {
  const from = keyToUtcNoon(londonDateKey(now));
  const to = keyToUtcNoon(londonDateKey(d));
  return Math.round((to - from) / 86_400_000);
};

/** "Today" as a YYYY-MM-DD key on the London calendar. */
export const londonTodayKey = (now: Date = new Date()): string => londonDateKey(now);

/**
 * Whole-day offset of a YYYY-MM-DD London-calendar key from London-today.
 * For date-only values from the DB (e.g. next_event_date, instance_date),
 * which are London calendar dates — never parse those with `new Date(str)`,
 * which reads them as UTC midnight and shifts a day in western timezones.
 * 0 = today (tonight), 1 = tomorrow, negative = in the past.
 */
export const londonDaysFromTodayForKey = (key: string, now: Date = new Date()): number =>
  londonDaysBetweenKeys(londonDateKey(now), key);

/**
 * Whole-day offset from one YYYY-MM-DD key to another. Use with
 * useLondonToday() as `fromKey` so memoised labels recompute on day rollover.
 */
export const londonDaysBetweenKeys = (fromKey: string, toKey: string): number =>
  Math.round((keyToUtcNoon(toKey) - keyToUtcNoon(fromKey)) / 86_400_000);

/** Weekday (0=Sun … 6=Sat) of a YYYY-MM-DD calendar key, timezone-independent. */
export const weekdayOfKey = (key: string): number => new Date(keyToUtcNoon(key)).getUTCDay();

/** The YYYY-MM-DD key `days` calendar days after `key`. */
export const addDaysToKey = (key: string, days: number): string =>
  new Date(keyToUtcNoon(key) + days * 86_400_000).toISOString().slice(0, 10);

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();
const wallClockMsInTz = (d: Date, timeZone: string): number => {
  let fmt = wallClockFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    wallClockFormatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
};

/**
 * The true-UTC instant of local midnight of `key` in `timeZone` (DST-safe:
 * two fixed-point passes absorb the offset, including across a DST jump).
 */
const zonedMidnightUtc = (key: string, timeZone: string): Date => {
  const [y, m, d] = safeKeyParts(key);
  const target = Date.UTC(y, m - 1, d, 0, 0, 0);
  let ts = target;
  for (let i = 0; i < 2; i++) {
    ts += target - wallClockMsInTz(new Date(ts), timeZone);
  }
  return new Date(ts);
};

/**
 * Half-open true-UTC instant range [start, end) covering `days` London
 * calendar days from `key`. This — not browser-local `setHours(0,0,0,0)` —
 * is what RPC range params (get_calendar_events_v2 etc.) must be built from,
 * so a visitor in any timezone queries the same London day.
 */
export const londonDayRangeUtc = (key: string, days = 1): { start: Date; end: Date } => ({
  start: zonedMidnightUtc(key, LONDON_TZ),
  end: zonedMidnightUtc(addDaysToKey(key, days), LONDON_TZ),
});

/** Minutes since midnight on the London wall clock (0–1439). Pairs with the
 *  wall-clock HH:MM stored in occurrence/program times — browser-local
 *  getHours()/getMinutes() runs an hour off for non-London visitors. */
export const londonMinutesOfDay = (d: Date = new Date()): number =>
  Math.floor((wallClockMsInTz(d, LONDON_TZ) % 86_400_000) / 60_000);

/** London wall-clock "now" as 'YYYY-MM-DDTHH:mm:ss' text — the value to
 *  compare against local-as-Z occurrence columns (instance_start/_end) in
 *  PostgREST filters. Bare new Date().toISOString() is true-UTC and runs an
 *  hour behind the stored wall clock all BST season. */
export const londonWallClockNowIso = (now: Date = new Date()): string =>
  new Date(wallClockMsInTz(now, LONDON_TZ)).toISOString().slice(0, 19);

/**
 * Parse a London wall-clock timestamp stored as-if-UTC (the occurrence/program
 * convention: 'YYYY-MM-DD HH:mm:ss+00' whose digits are London local time)
 * into the TRUE instant — the moment London's clock actually shows that wall
 * time. `new Date(str)` alone reads it as UTC, which runs one hour late for
 * the whole BST season (countdowns, "On now" badges).
 */
export const londonWallClockToInstant = (iso: string | null | undefined): Date | null => {
  const asUtc = parseUtcIso(iso);
  if (!asUtc) return null;
  const wallMs = asUtc.getTime();
  let ts = wallMs;
  for (let i = 0; i < 2; i++) {
    ts += wallMs - wallClockMsInTz(new Date(ts), LONDON_TZ);
  }
  return new Date(ts);
};

/**
 * The INVERSE of londonWallClockToInstant: a true instant -> the naive
 * "local-as-UTC" stamp this codebase stores and displays as-is
 * ('YYYY-MM-DD HH:mm:ss+00' whose digits are London wall clock).
 *
 * Needed at the boundary where a genuine instant enters a pipeline that
 * assumes the naive convention. get_public_festivals_list_v1.starts_at is such
 * a value: it resolves the series' local start THROUGH the series timezone, so
 * a London festival starting 11:00 arrives as '...T10:00:00+00' all BST season
 * (live-verified: London Latin Fest 11:00 -> 10:00+00, BachaZouk 12:00 ->
 * 11:00+00). Reading HH:MM straight off that string -- which is what every
 * display and sort helper here does -- renders it an hour early.
 *
 * CAVEAT: this lands the reader's London clock, which is exactly the intended
 * local time for a Europe/London series (the majority) but NOT for a foreign
 * one -- a Madrid festival's own 11:00 becomes its London equivalent. Showing
 * true event-local time for foreign series needs the series timezone in the
 * RPC payload, which it does not currently carry; that is an admin-repo change.
 */
export const instantToLondonWallClockStamp = (
  iso: string | null | undefined,
): string | null => {
  const instant = parseUtcIso(iso);
  if (!instant) return null;
  // Same trick as londonWallClockNowIso: re-stamp the London wall clock as if
  // it were UTC, which IS the stored convention.
  return `${new Date(wallClockMsInTz(instant, LONDON_TZ))
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')}+00`;
};

/**
 * London calendar dates (YYYY-MM-DD) of the coming Fri/Sat/Sun. If today is
 * Sat/Sun this returns next week's Fri/Sat/Sun, mirroring the directory's
 * existing weekend logic.
 */
export const getComingWeekendKeys = (
  now: Date = new Date(),
): { fri: string; sat: string; sun: string } => {
  const base = keyToUtcNoon(londonDateKey(now));
  const dow = new Date(base).getUTCDay(); // 0=Sun .. 6=Sat, for the London date
  const daysUntilFriday = dow <= 5 ? 5 - dow : 5 + (7 - dow);
  const keyAt = (offset: number) =>
    new Date(base + (daysUntilFriday + offset) * 86_400_000).toISOString().slice(0, 10);
  return { fri: keyAt(0), sat: keyAt(1), sun: keyAt(2) };
};
