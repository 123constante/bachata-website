// The site's wall-clock / instant TYPE boundary.
//
// Two opaque brands make the site-wide "local-as-UTC" timezone bug class
// UNREPRESENTABLE at compile time. See CLAUDE.md (time convention) and
// src/lib/londonDate.ts (the runtime calendar authority) for background.
//
// WHY A BRAND (not just a shared formatter + lint guard): event/session times
// are stored "local-as-UTC" -- a naive London wall clock stamped with a +00
// offset. "2026-07-15T20:30:00+00" MEANS London 20:30, not a real UTC instant.
// Typed as bare `string`, any code can do `new Date(stamp).toLocaleTimeString()`
// and be +1h wrong all BST season, or `.getDate()` and show the wrong day near
// midnight. Branding the value so it is NOT assignable to `string` turns every
// `new Date(wc)` into a compile error: the misuse becomes unrepresentable, not
// merely discouraged. The lint guard drops to a backstop for the un-migrated
// tail.
//
// TWO BRANDS, deliberately distinct:
//   WallClock -- event/session times (local-as-UTC; render AS STORED, never
//                Intl-convert). occurrence starts_at/ends_at, program times.
//   Instant   -- true UTC instants (created_at, cutoff_at, drawn_at, updated_at).
//                These ARE real moments; `new Date(instant)` is correct for them.
// Do NOT mis-brand: a cutoff_at is an Instant, an event start is a WallClock.
//
// PRODUCERS: only asWallClock / asInstant, called inside the boundary codecs
// (parseEventPageSnapshot, parseFestivalDetail, CalendarEventRow, MapEvent).
// CONSUMERS: only the sanctioned helpers below. The single `unwrap` back to
// string is confined to this file -- nothing else may cast a brand to string.

import { format } from 'date-fns';
import { parseUtcIso, zonedFormatterFactory } from '@/lib/londonDate';

declare const _wallClockBrand: unique symbol;
declare const _instantBrand: unique symbol;

/** A London wall-clock time stored "local-as-UTC" (naive HH:MM tagged +00).
 *  NOT a real instant: render as stored, never pass through `new Date`. */
export type WallClock = { readonly [_wallClockBrand]: 'LondonLocalAsUtc' };

/** A true UTC instant (created_at / cutoff_at / drawn_at). `new Date(...)` is
 *  correct for these -- they are real moments, not wall-clock strings. */
export type Instant = { readonly [_instantBrand]: 'TrueUtcInstant' };

// --- Constructors: the ONLY producers of a brand ----------------------------

/** Brand a raw stored wall-clock string. Call ONLY in a boundary codec. */
export const asWallClock = (raw: string): WallClock => raw as unknown as WallClock;

/** Brand a raw true-UTC timestamp string. Call ONLY in a boundary codec. */
export const asInstant = (raw: string): Instant => raw as unknown as Instant;

/**
 * Brand a nullable stored wall clock, mapping BOTH null/undefined AND the
 * COALESCE(...,'') empty-string sentinel that the calendar RPC emits for an
 * absent session time to `null`. Call ONLY in a boundary codec. (There are
 * older local copies of this helper in useEventPageQuery / useFestivalDetailQuery
 * with subtly different '' handling; new codecs should use this shared one.)
 */
export const asWallClockOrNull = (raw: unknown): WallClock | null =>
  typeof raw === 'string' && raw !== '' ? asWallClock(raw) : null;

// --- Internal unwrap: confined to this file ---------------------------------
// The sole sanctioned cast back to string. Every reader below goes through this
// so the raw string never escapes the boundary.
const unwrap = (v: WallClock | Instant): string => v as unknown as string;

// Parse the naive Y-M-D[ H:M[:S]] digits out of a wall-clock string. Tolerant of
// a 'T' or space separator and an optional time; ignores whatever offset the
// stamp carries (it is always +00 by convention). Shared by the readers below.
const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const naiveParts = (
  wc: WallClock,
): { y: number; mo: number; d: number; h: number; mi: number; s: number } | null => {
  const m = unwrap(wc).match(NAIVE_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return {
    y: Number(y), mo: Number(mo), d: Number(d),
    h: Number(h ?? '0'), mi: Number(mi ?? '0'), s: Number(s ?? '0'),
  };
};

// --- Wall-clock readers (render AS STORED, no timezone shift) ----------------

// Parse the literal HH:MM from an ISO-like string without any timezone shift.
// The time slice logic is lifted from
// event-page/bento/blocks/occurrenceFormat.naiveHourMinute, so formatWallClockTime
// stays byte-identical to the old formatTime for full "YYYY-MM-DDThh:mm" stamps.
// The separator may be 'T' (jsonb-serialised RPCs, e.g. event_view_p5) OR a space
// (::text-cast RPCs -- get_calendar_events_v2 emits "2026-07-17 20:00:00+00"), so
// the same reader serves both boundaries. A bare "HH:MM[:SS]" (no date) is also
// accepted -- the legacy meta_data->program schedule passthrough can store one, and
// the old FestivalProgramSection.formatTime handled it; a date-only "YYYY-MM-DD"
// (no time) still returns null.
const naiveHourMinute = (iso: string): { hh: number; mm: number } | null => {
  // Match the H:MM either right after a "YYYY-MM-DD" date + [T ] separator, or
  // at the very start (a bare "H:MM[:SS]" program time). The hour is \d{1,2} so
  // an UNPADDED bare time ("9:05") parses too -- the old string-slicing fmtTime
  // returned "9:05" for it, whereas requiring \d{2} would drop it to null and
  // render the calendar/session time BLANK. A date-only "YYYY-MM-DD" (no time)
  // matches neither branch and still returns null.
  const m = iso.match(/(?:^\d{4}-\d{2}-\d{2}[T ]|^)(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return null;
  return { hh, mm: Number.isFinite(mm) ? mm : 0 };
};

/**
 * "7 PM" / "7:30 PM" from a stored wall clock, read as-stored. With
 * { hour12: false } emits 24h "HH:MM". Byte-identical to the old
 * occurrenceFormat.formatTime for the default (12h) case.
 */
export const formatWallClockTime = (
  wc: WallClock | null | undefined,
  opts?: { hour12?: boolean },
): string | null => {
  if (!wc) return null;
  const hm = naiveHourMinute(unwrap(wc));
  if (!hm) return null;
  if (opts?.hour12 === false) {
    return `${String(hm.hh).padStart(2, '0')}:${String(hm.mm).padStart(2, '0')}`;
  }
  const h12 = hm.hh % 12 === 0 ? 12 : hm.hh % 12;
  const ampm = hm.hh < 12 ? 'AM' : 'PM';
  return hm.mm === 0
    ? `${h12} ${ampm}`
    : `${h12}:${String(hm.mm).padStart(2, '0')} ${ampm}`;
};

/**
 * The stored wall-clock HOUR (0-23), read as-stored with no timezone shift.
 * For bucketing festival sessions into hour rows. Returns null if unparseable.
 * Reuses the same naive HH:MM slice as formatWallClockTime so the two agree.
 */
export const wallClockHour = (wc: WallClock | null | undefined): number | null => {
  if (!wc) return null;
  const hm = naiveHourMinute(unwrap(wc));
  return hm ? hm.hh : null;
};

/**
 * The naive "HH:MM" time key of a stored wall clock, zero-padded, read as-stored
 * with no timezone shift. Tolerates full space/T stamps AND a bare "HH:MM[:SS]"
 * (the meta_data->program passthrough); returns null for a date-only or
 * unparseable value. Matches the old string-slicing `fmtTime`/`formatHHmm` for the
 * zero-padded stamps the RPC actually emits; for a rare UNPADDED bare time it
 * emits the zero-padded form ("9:05" -> "09:05") rather than the old raw slice --
 * a value, not a blank, which is what matters for the calendar/session render.
 */
export const wallClockTimeKey = (wc: WallClock | null | undefined): string | null => {
  if (!wc) return null;
  const hm = naiveHourMinute(unwrap(wc));
  return hm ? `${String(hm.hh).padStart(2, '0')}:${String(hm.mm).padStart(2, '0')}` : null;
};

/**
 * "Wed 15 Jul" from a stored wall clock: the YYYY-MM-DD prefix anchored at UTC
 * noon and formatted in UTC, so weekday/day/month are read straight off the
 * stored date, machine-timezone-independent. Byte-identical to the old
 * occurrenceFormat.formatDateLabel (minus its occurrence '--' fallback, which
 * stays at the call site).
 */
export const formatWallClockDate = (wc: WallClock | null | undefined): string | null => {
  if (!wc) return null;
  const ymd = unwrap(wc).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const fmt = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opt }).format(date);
  return `${fmt({ weekday: 'short' })} ${fmt({ day: 'numeric' })} ${fmt({ month: 'short' })}`;
};

/** "Wed 15 Jul, 7:30 PM" -- date + time composed from the two readers above. */
export const formatWallClockDateTime = (
  wc: WallClock | null | undefined,
  opts?: { hour12?: boolean },
): string | null => {
  if (!wc) return null;
  const date = formatWallClockDate(wc);
  const time = formatWallClockTime(wc, opts);
  if (!date && !time) return null;
  if (!time) return date;
  if (!date) return time;
  return `${date}, ${time}`;
};

/** The YYYY-MM-DD London-calendar key of a stored wall clock, for londonDate
 *  comparisons (londonDaysFromTodayForKey, weekdayOfKey, etc.). Reads the date
 *  PREFIX, so a full "YYYY-MM-DDThh:mm" stamp yields its date. */
export const wallClockDateKey = (wc: WallClock | null | undefined): string | null => {
  if (!wc) return null;
  const ymd = unwrap(wc).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
};

/** The date key ONLY when the whole stored value is a bare date with no time
 *  part (anchored full-string 'YYYY-MM-DD'); null for a stamp that carries a
 *  time. Use where a time-suffixed value must NOT be treated as a plain day --
 *  e.g. sniffIsFestival counting distinct schedule days for festival routing. */
export const wallClockExactDateKey = (wc: WallClock | null | undefined): string | null => {
  if (!wc) return null;
  const s = unwrap(wc);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/**
 * Boundary reader for a stored EVENT TIMEZONE. Treats 'UTC' as UNSPECIFIED
 * (null) rather than as a real zone, so the caller's `?? 'Europe/London'`
 * default applies -- the same safe path a NULL timezone already takes.
 *
 * WHY 'UTC' IS NOT A ZONE HERE: no city and no venue in this DB carries 'UTC'
 * (audited 2026-07-14: cities are Europe/London x70, Europe/Madrid x45, ...,
 * zero UTC). It only ever appears on events/series as a save-or-import DEFAULT
 * artifact, and every row carrying it is really a London event.
 *
 * Taken LITERALLY it is actively harmful, because times are stored local-as-UTC:
 *   - wallClockToInstant(wc, 'UTC') is the IDENTITY (the offset probe measures a
 *     zero delta), which silently disables the BST correction -- shipping a
 *     JSON-LD startDate / ICS DTSTART an hour late for the whole summer.
 *   - dateKeyInTz(d, 'UTC') reads the wrong calendar day near London midnight.
 * Both fail SILENTLY and the brand cannot catch them: this is bad data, not a
 * bad type. Normalising once at the boundary fixes every consumer at once.
 */
export const asEventTimeZone = (raw: unknown): string | null => {
  const tz = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  return tz === 'UTC' ? null : tz;
};

// Build a zoned formatter, falling back to Europe/London if `tz` is not a valid
// IANA zone. new Intl.DateTimeFormat({ timeZone }) throws a RangeError on a
// malformed zone; wallClockToInstant runs in render/effect paths (JSON-LD,
// isPast), so a bad DB timezone must degrade to London rather than crash the
// page. (The pre-brand formatShortDateLabel wrapped this same call in try/catch.)
const ZONED_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
};
// Shares londonDate's factory so this fallback and dateKeyInTz's cannot drift
// into two different calendars for the same bad zone -- and so this one caches,
// which the hand-rolled version did not.
const zonedFormatter = zonedFormatterFactory((tz) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, ...ZONED_OPTS }),
);

/**
 * Convert a stored wall clock into the TRUE UTC instant it denotes, using the
 * event timezone (default Europe/London). This is the one path that MUST do a
 * real conversion: ICS `Z`-suffixed DTSTART/DTEND and JSON-LD `startDate` are
 * interpreted as real instants by calendar clients and Google.
 *
 * Offset-probe technique lifted from
 * event-page/bento/utils/ics.naiveLocalToCompactUtc (which returns a compact
 * string; this returns the Date). For tz = 'Europe/London' the result equals
 * londonDate.londonWallClockToInstant -- asserted in
 * tests/wallClockFormat.test.ts so the two never diverge.
 */
export const wallClockToInstant = (
  wc: WallClock | null | undefined,
  tz: string = 'Europe/London',
): Date | null => {
  if (!wc) return null;
  const iso = unwrap(wc);
  // Separator is 'T' (jsonb RPCs) or a space (::text-cast RPCs like
  // get_calendar_events_v2, "2026-07-17 20:00:00+00"). A time is required --
  // a date-only value has no instant, so it still returns null.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const parts = zonedFormatter(tz).formatToParts(guess);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  const observed = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`,
  );
  if (Number.isNaN(observed.getTime())) return null;
  const delta = observed.getTime() - guess.getTime();
  return new Date(guess.getTime() - delta);
};

// INTERNAL: a Date whose LOCAL calendar fields equal the stored wall clock, for
// feeding local-timezone formatters (date-fns `format`, Intl). NOT exported --
// its epoch value is machine-timezone-dependent and MEANINGLESS, so it must
// never escape this module, be diffed, or be treated as an instant (use
// wallClockToInstant for that). Accepts a date-only "YYYY-MM-DD" (-> midnight)
// or a full ISO stamp. (Around the machine tz's own DST switch a nonexistent
// local hour may normalise; negligible in practice and CI runs in UTC.)
const toLocalDate = (wc: WallClock | null | undefined): Date | null => {
  if (!wc) return null;
  const p = naiveParts(wc);
  if (!p) return null;
  const date = new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Format a stored wall clock AS STORED with a date-fns pattern, machine-timezone
 * independent. Replaces the old exported wallClockToLocalDate: the raw
 * local-positioned Date never leaves this module, so it can't be mistaken for a
 * real instant or diffed.
 */
export const formatWallClockLocal = (
  wc: WallClock | null | undefined,
  pattern: string,
): string | null => {
  const d = toLocalDate(wc);
  return d ? format(d, pattern) : null;
};

/**
 * Format a stored wall clock AS STORED with Intl.DateTimeFormat (for the
 * weekday/day/month/year short-date chip). Same "raw Date stays internal" rule
 * as formatWallClockLocal.
 */
export const formatWallClockLocalIntl = (
  wc: WallClock | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale: string = 'en-GB',
): string | null => {
  const d = toLocalDate(wc);
  return d ? new Intl.DateTimeFormat(locale, options).format(d) : null;
};

/**
 * Whole minutes from `start` to `end`, both stored wall clocks. Since both carry
 * the same (+00) offset the naive difference IS the wall-clock difference -- no
 * timezone handling needed. Returns null if either is unparseable. Reads the
 * digits via regex (not Date.parse, which rejects a 2-digit '+00' offset on iOS
 * Safari), matching the pre-brand duration result for valid stamps.
 */
export const wallClockDurationMinutes = (
  start: WallClock | null | undefined,
  end: WallClock | null | undefined,
): number | null => {
  if (!start || !end) return null;
  const a = naiveParts(start);
  const b = naiveParts(end);
  if (!a || !b) return null;
  const aMs = Date.UTC(a.y, a.mo - 1, a.d, a.h, a.mi, a.s);
  const bMs = Date.UTC(b.y, b.mo - 1, b.d, b.h, b.mi, b.s);
  return (bMs - aMs) / 60000;
};

// --- Instant readers --------------------------------------------------------

/** Parse a true-UTC Instant into a Date. Correct BY DEFAULT for real instants
 *  (created_at / cutoff_at / drawn_at): unlike WallClock, these are moments. */
export const instantToDate = (i: Instant | null | undefined): Date | null => {
  if (!i) return null;
  return parseUtcIso(unwrap(i));
};
