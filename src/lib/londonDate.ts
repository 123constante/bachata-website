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

/** Exported for the zone-TAKING helpers here, which need the caller to name a
 *  calendar explicitly -- a loader bounding an edge TTL with
 *  secondsUntilKeyRollsOver, say -- so those call sites share one string
 *  instead of each spelling their own literal.
 *
 *  DELIBERATELY NOT A SITE-WIDE SWEEP, so read the export narrowly. Seven or so
 *  other modules still write 'Europe/London' inline (venueOpenStatus's own
 *  fallback, wallClock's default parameter, buildEventListJsonLd's private
 *  LONDON const, useLondonToday, BentoPage's `?? `), and adopting this there is
 *  a separate refactor that would pull half the tree into an import from this
 *  module for a string that cannot drift in value. One of them must NOT be
 *  converted piecemeal at all: app/routes/festival.tsx's `?? "Europe/London"`
 *  is documented as mirroring FestivalDetail.tsx's eventTz default EXACTLY, and
 *  changing one side alone makes the pair harder to eyeball for the typo that
 *  would split server and client onto different calendars. Convert both or
 *  neither. */
export const LONDON_TZ = 'Europe/London';

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
 * ONE cached, fail-soft formatter factory for every zone-taking path here and
 * in wallClock.ts: build per zone, cache per zone, degrade an invalid zone to
 * London rather than throw.
 *
 * It exists because that idiom had been written THREE times -- dateKeyInTz,
 * wallClockMsInTz below, and wallClock.ts's zonedFormatter -- and the copies had
 * already drifted: two cached the London fallback under the bad key, the third
 * rebuilt it on every call. The correctness of a pinned day key rests on all of
 * them degrading to the SAME calendar from the same bad `events.timezone`, and
 * that agreement should not be three separate coincidences.
 *
 * Construction is the expensive part of the Intl API and useTodayKey reaches
 * this on every 60s/focus check, hence the cache.
 */
export const zonedFormatterFactory = (
  build: (timeZone: string) => Intl.DateTimeFormat,
): ((timeZone: string) => Intl.DateTimeFormat) => {
  const cache = new Map<string, Intl.DateTimeFormat>();
  return (timeZone: string): Intl.DateTimeFormat => {
    // An `undefined` zone must be normalised HERE, because the try/catch below
    // cannot catch it: `new Intl.DateTimeFormat('en-CA', { timeZone: undefined })`
    // does NOT throw, it resolves to the RUNTIME's zone. So the failure mode is
    // silent and reads as correct on a London machine, while a Sydney visitor
    // would get today on their own browser calendar -- precisely the bug class
    // this module exists to prevent. (`null` and `''` DO throw RangeError, like
    // any invalid zone, and are handled by the catch; only `undefined` slips past.)
    //
    // DEFENSE IN DEPTH, not a fix for a live defect: no current call site can
    // deliver `undefined`. The two useTodayKey callers pass the literal
    // 'Europe/London' and FestivalDetail's `eventTz`, itself `?? "Europe/London"`.
    // The guard stays because `strict: false` in tsconfig.app.json means a
    // `timeZone: string` signature does not actually enforce it, so a future
    // caller can reintroduce it without a type error.
    const tz = timeZone || LONDON_TZ;
    let fmt = cache.get(tz);
    if (!fmt) {
      try {
        fmt = build(tz);
      } catch {
        // An INVALID zone ('Not/AZone') does throw, and this is its fallback.
        // Cached under the BAD key, so a hot path pays the RangeError once.
        //
        // Yes, this line can itself throw, and no, it is not worth defending.
        // `build(LONDON_TZ)` escaping the try needs a runtime where building
        // the London formatter fails -- and on such a runtime `build(tz)` above
        // has already failed for every zone including the valid ones, so there
        // is no input that reaches a WORKING primary and a BROKEN fallback. The
        // guard was never load-bearing in that world; the whole factory is
        // unusable and the RangeError is the honest signal. Nor is there a safe
        // last resort to degrade to: any formatter built with different options
        // returns a differently-shaped string, and a silently wrong day key is
        // strictly worse than a throw for every consumer here.
        fmt = build(LONDON_TZ);
      }
      cache.set(tz, fmt);
    }
    return fmt;
  };
};

/**
 * YYYY-MM-DD for the given instant in an arbitrary IANA timezone (DST-safe).
 * Falls back to the London calendar if `timeZone` is missing or invalid, so a
 * bad value can never throw at a call site.
 */
const dateKeyFormatter = zonedFormatterFactory((timeZone) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }),
);

export const dateKeyInTz = (d: Date, timeZone: string): string =>
  dateKeyFormatter(timeZone).format(d);

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

/**
 * True only for a well-shaped, calendar-real YYYY-MM-DD key. The round-trip
 * through keyToUtcNoon is what does the calendar work: a 13th month degrades
 * to safeKeyParts' fallback and an impossible day like 2027-02-30 rolls into
 * March under Date.UTC -- either way the read-back differs from the input.
 * Leap-day aware by construction. KEY_RE keeps shape knowledge in one place.
 */
export const isRealDateKey = (key: string): boolean =>
  KEY_RE.test(key) && new Date(keyToUtcNoon(key)).toISOString().slice(0, 10) === key;

/**
 * Collapse a reversed or unreal end key to the start day, so a bad range
 * renders as a single day instead of a reversed or garbage span.
 * Precondition: startKey is itself a real key (isRealDateKey) -- both range
 * consumers validate it first. A malformed startKey is returned as-is, which
 * downstream falls into keyToUtcNoon's degrade path.
 */
export const clampRangeEndKey = (startKey: string, endKey: string | null | undefined): string =>
  endKey && isRealDateKey(endKey) && endKey >= startKey ? endKey : startKey;

/**
 * One date-range label for a pair of calendar keys, so every surface showing
 * the same range agrees. 'long' spells out weekday + day + month + year
 * ("Fri 26 to Mon 29 March 2027" with an en-dash separator; months and years
 * appear on BOTH sides whenever the span crosses them); 'short' is the
 * compact share form ("26 Mar to 29 Mar 2027"). The separator is written as
 * an escape per the raw-Unicode source rule. Returns null for a missing or
 * unreal start key; the end key is clamped via clampRangeEndKey. UTC-locked
 * formatting off the UTC-noon anchor keeps SSR and every client timezone in
 * agreement.
 */
const keyLabelFormatters = new Map<string, Intl.DateTimeFormat>();
const fmtKeyPart = (d: Date, opts: Intl.DateTimeFormatOptions): string => {
  // Cached per option shape (three exist: short weekday, long month, short
  // month) -- construction is the expensive part of the Intl API, and a list
  // surface adopting formatKeyRange would otherwise pay it per card.
  const cacheKey = JSON.stringify(opts);
  let fmt = keyLabelFormatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts });
    keyLabelFormatters.set(cacheKey, fmt);
  }
  return fmt.format(d);
};

export const formatKeyRange = (
  startKey: string | null | undefined,
  endKey: string | null | undefined,
  style: 'long' | 'short',
): string | null => {
  if (!startKey || !isRealDateKey(startKey)) return null;
  const safeEndKey = clampRangeEndKey(startKey, endKey);
  const start = new Date(keyToUtcNoon(startKey));
  const end = new Date(keyToUtcNoon(safeEndKey));
  const day = (d: Date) =>
    style === 'long' ? `${fmtKeyPart(d, { weekday: 'short' })} ${d.getUTCDate()}` : String(d.getUTCDate());
  const month = (d: Date) => fmtKeyPart(d, { month: style === 'long' ? 'long' : 'short' });
  const tail = (d: Date) => `${day(d)} ${month(d)} ${d.getUTCFullYear()}`;
  if (safeEndKey === startKey) return tail(start);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startPart = [
    day(start),
    style === 'short' || !sameMonth ? month(start) : null,
    sameYear ? null : String(start.getUTCFullYear()),
  ]
    .filter(Boolean)
    .join(' ');
  return `${startPart} \u2013 ${tail(end)}`;
};

const buildWallClockFormatter = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

// The invalid-zone degrade is the factory's, not this function's: every
// zone-taking path in this module reaches the Intl constructor through it, so
// zonedMidnightUtc and everything built on it are covered -- including a caller
// handed a DB-sourced `events.timezone` of 'Europe/Lonond', which would
// otherwise surface as a RangeError inside a loader and a 500 on a live page.
const wallClockFormatter = zonedFormatterFactory(buildWallClockFormatter);

const wallClockMsInTz = (d: Date, timeZone: string): number => {
  const parts = wallClockFormatter(timeZone).formatToParts(d);
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

/**
 * Seconds from `now` until `dayKey` stops being "today" on `timeZone`'s
 * calendar. Zero once it already has.
 *
 * THIS IS THE SHELF LIFE OF A "TODAY" ANSWER. Anything derived from a pinned
 * day key -- a days-away label, a "today" badge, a day-scoped query key --
 * stops being true the moment that calendar rolls past the key. Where such a
 * value is baked into a CACHED artefact, this is the longest that artefact may
 * still be served (see app/detailLoader.cacheHeaders).
 *
 * TAKES THE KEY, NOT JUST THE ZONE, on purpose. A loader derives the key early
 * and emits the response later, after further awaits. Re-deriving "today" at
 * emission time would hand back a fresh 24 hours for a key pinned to the
 * PREVIOUS day if those awaits crossed midnight -- the exact staleness the
 * bound exists to prevent, reintroduced by the measurement. Measured against
 * the key, that case correctly returns 0.
 *
 * DST-AWARE, AND THE RESIDUAL ERROR IS ONE-DIRECTIONAL. It reuses the
 * zoned-midnight fixed point behind londonDayRangeUtc, so an ordinary DST day
 * comes out right: London's spring-forward day is 23h and its autumn one 25h.
 * This is the first caller to hand that fixed point a NON-London zone, and two
 * passes do not fully converge for the handful of zones whose DST jump lands ON
 * midnight -- America/Havana 2026-03-08 and America/Santiago 2026-09-06, where
 * local 00:00 does not exist -- for which it lands an hour early.
 *
 * Swept over 15 zones x 730 days (10950 cases): exact 10946 times, an hour
 * SHORT 4 times, and never once long. Short is the SAFE direction -- it can
 * only under-grant a cache, never buy an extra hour of a stale claim -- so the
 * bound stays sound and the exotic case is documented rather than chased.
 *
 * Be precise about what short COSTS, though, because "an hour short" undersells
 * it: this returns 0 for the whole of that hour, and edgeCacheControl turns a
 * zero bound into no edge caching at all. So it is not one extra miss, it is
 * every request for a festival in such a zone origin-rendering for an hour, at
 * most twice a year. Cheap enough to accept, expensive enough that a future
 * caller sizing this trade-off should not read "an extra cache miss" and plan
 * around the wrong order of magnitude. If a caller ever needs the true instant
 * in such a zone, this is the note to read first: fix the fixed point, do not
 * paper over it here.
 *
 * Never negative; never throws on a missing/invalid zone or a malformed key --
 * and the two degrade in DIFFERENT directions, which is easy to conflate.
 * A malformed KEY degrades to today on `timeZone` (via `dateKeyInTz`), NOT
 * London -- unlike `safeKeyParts`, which has no timeZone argument to degrade
 * on and falls back to London specifically. For a zone that disagrees with
 * London on the calendar date at call time, those are different days.
 * An invalid/missing ZONE, by contrast, degrades to London: `dateKeyInTz`
 * and `zonedMidnightUtc` both route through `zonedFormatterFactory`, whose
 * catch on a bad IANA identifier builds the formatter on `LONDON_TZ`. So a
 * malformed key is measured on the zone the caller asked for; a malformed
 * zone is measured on London regardless of what the caller asked for.
 */
export const secondsUntilKeyRollsOver = (
  dayKey: string,
  timeZone: string,
  now: Date = new Date(),
): number => {
  const key = isRealDateKey(dayKey) ? dayKey : dateKeyInTz(now, timeZone);
  const rollsOverAt = zonedMidnightUtc(addDaysToKey(key, 1), timeZone);
  // FLOOR, not ceil. A caller sizing a cache TTL from this must never be handed
  // a value that reaches past the rollover, and rounding up a fractional second
  // does exactly that -- in the same direction as every other error here, which
  // is the direction the "never once long" invariant above forbids.
  return Math.max(0, Math.floor((rollsOverAt.getTime() - now.getTime()) / 1000));
};

/**
 * Pin "today" on `timeZone`'s calendar AND size how long that pin stays true,
 * as one answer.
 *
 * WHY THE PAIR IS ONE FUNCTION. A loader that derives the key and then sizes the
 * bound makes TWO clock reads. That order is deliberate -- measuring the bound
 * second can only ever under-grant, which is the safe direction, where sharing
 * one `now` would over-grant by however long the work between them takes. The
 * cost is a gap, and a pair straddling midnight leaves a stale key in an emitted
 * document: the defect the bound exists to prevent, reintroduced by the
 * measurement. A zero bound is exactly that signal, so re-derive once and
 * measure again. Bounded at one retry -- a second straddle would need a whole
 * day between two adjacent statements, and would still emit 0, which is
 * uncacheable rather than wrong.
 *
 * A zero that is NOT a straddle -- the DST case documented above, where this
 * returns 0 for an hour -- yields the same key and the same zero, one cheap
 * call later.
 *
 * `now` is injectable so that the straddle can actually be tested: it is the gap
 * between two adjacent statements, which a frozen clock cannot reproduce.
 */
export const pinDayAndBound = (
  timeZone: string,
  now: () => Date = () => new Date(),
): { dayKey: string; boundSeconds: number } => {
  let dayKey = dateKeyInTz(now(), timeZone);
  let boundSeconds = secondsUntilKeyRollsOver(dayKey, timeZone, now());
  if (boundSeconds === 0) {
    dayKey = dateKeyInTz(now(), timeZone);
    boundSeconds = secondsUntilKeyRollsOver(dayKey, timeZone, now());
  }
  return { dayKey, boundSeconds };
};

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
