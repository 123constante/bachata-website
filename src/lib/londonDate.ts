// Date helpers for the public venue directory.
//
// The public venue RPC (get_public_venues_list_v3) returns `next_event_iso` as
// `(first_start AT TIME ZONE 'UTC')::text` — a timezone-LESS UTC wall-clock
// string like "2026-05-22 19:00:00" (space separator, no Z/offset). Parsing
// that with `new Date(str)` reads it in the browser's local zone, which is
// wrong. And "tonight" / "this weekend" must be measured on the city's calendar
// (London), matching the rest of the app (see src/pages/Tonight.tsx), not the
// browser's. These helpers fix both.

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
export const parseUtcIso = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const hasZone = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(trimmed);
  const normalised = trimmed.replace(' ', 'T') + (hasZone ? '' : 'Z');
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

const keyToUtcNoon = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
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
