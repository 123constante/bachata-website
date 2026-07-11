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

import { parseUtcIso } from '@/lib/londonDate';

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

// --- Internal unwrap: confined to this file ---------------------------------
// The sole sanctioned cast back to string. Every reader below goes through this
// so the raw string never escapes the boundary.
const unwrap = (v: WallClock | Instant): string => v as unknown as string;

// --- Wall-clock readers (render AS STORED, no timezone shift) ----------------

// Parse the literal HH:MM from an ISO-like string without any timezone shift.
// Lifted verbatim from event-page/bento/blocks/occurrenceFormat.naiveHourMinute
// so formatWallClockTime is byte-identical to the old formatTime.
const naiveHourMinute = (iso: string): { hh: number; mm: number } | null => {
  const tIdx = iso.indexOf('T');
  if (tIdx === -1) return null;
  const hh = Number(iso.slice(tIdx + 1, tIdx + 3));
  const mm = Number(iso.slice(tIdx + 4, tIdx + 6));
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
 *  comparisons (londonDaysFromTodayForKey, weekdayOfKey, etc.). */
export const wallClockDateKey = (wc: WallClock | null | undefined): string | null => {
  if (!wc) return null;
  const ymd = unwrap(wc).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
};

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
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(guess);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  const observed = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`,
  );
  if (Number.isNaN(observed.getTime())) return null;
  const delta = observed.getTime() - guess.getTime();
  return new Date(guess.getTime() - delta);
};

/**
 * A Date whose LOCAL calendar fields equal the stored wall clock. Use ONLY to
 * feed local-timezone formatters (date-fns `format`, `toLocale*`) so they render
 * the wall clock AS STORED, machine-timezone-independent. Its epoch value is
 * MEANINGLESS -- never diff it or treat it as an instant (use wallClockToInstant
 * for that). Accepts a date-only "YYYY-MM-DD" (-> midnight) or a full ISO stamp.
 * (Around the machine tz's own DST switch a nonexistent local hour may normalise;
 * negligible in practice and CI runs in UTC. This replaces the pre-brand
 * `new Date(stamp)` that formatters read in browser-local time -- the BST bug.)
 */
export const wallClockToLocalDate = (wc: WallClock | null | undefined): Date | null => {
  if (!wc) return null;
  const m = unwrap(wc).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y), Number(mo) - 1, Number(d),
    Number(h ?? '0'), Number(mi ?? '0'), Number(s ?? '0'), 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Whole minutes from `start` to `end`, both stored wall clocks. Since both carry
 * the same (+00) offset the naive difference IS the wall-clock difference -- no
 * timezone handling needed. Returns null if either is unparseable. Matches the
 * pre-brand `new Date(end) - new Date(start)` duration exactly.
 */
export const wallClockDurationMinutes = (
  start: WallClock | null | undefined,
  end: WallClock | null | undefined,
): number | null => {
  if (!start || !end) return null;
  const a = Date.parse(unwrap(start));
  const b = Date.parse(unwrap(end));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60000;
};

// --- Instant readers --------------------------------------------------------

/** Parse a true-UTC Instant into a Date. Correct BY DEFAULT for real instants
 *  (created_at / cutoff_at / drawn_at): unlike WallClock, these are moments. */
export const instantToDate = (i: Instant | null | undefined): Date | null => {
  if (!i) return null;
  return parseUtcIso(unwrap(i));
};
