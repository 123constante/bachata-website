// Time to be confirmed (owner decision 2026-10-09, option B; admin migration 20261109920000).
//
// A date with NO timed session carries the SERIES default as its start/end (the organiser-create
// 20:00 plus a default duration). That is not a real time, so every public surface shows the date
// only, with the words below, and never the clock time.
//
// The readers (get_calendar_events_v2, get_public_events_list_v2, event_view_p5) return a per-date
// `has_timed_session` boolean. It may be MISSING (a payload served before the migration, a cached
// page): a missing or null flag renders exactly as before. Only an explicit `false` is "to be
// confirmed". This module is the ONE mapping from that flag to copy; no surface spells the words.

import { addDaysToKey } from '@/lib/londonDate';
import { wallClockDateKey, type WallClock } from '@/lib/time/wallClock';

/** The words shown instead of a clock time. */
export const TIME_TBC_LABEL = 'Time to be confirmed';

/** What the person can do about it (for surfaces with room for a second line). */
export const TIME_TBC_HINT = 'The organiser has not set a time yet. Check back closer to the date.';

/** true only when the reader said, explicitly, that the date has no timed session. */
export const isTimeToBeConfirmed = (hasTimedSession: unknown): boolean => hasTimedSession === false;

/** The time text a surface prints: its own label when the date is timed, else the TBC words. */
export const timeLabelOrTbc = (hasTimedSession: unknown, timeLabel: string | null): string | null =>
  isTimeToBeConfirmed(hasTimedSession) ? TIME_TBC_LABEL : timeLabel;

/**
 * An all-day calendar entry for a date with no time: DATE values (RFC 5545 VALUE=DATE; Google
 * Calendar `dates=` takes the same form). The end is exclusive, so it is the next day.
 * null when the stored wall clock has no readable date.
 */
export const allDayDateRange = (
  wc: WallClock | null | undefined,
): { start: string; end: string } | null => {
  const key = wallClockDateKey(wc);
  if (!key) return null;
  const compact = (k: string) => k.replace(/-/g, '');
  return { start: compact(key), end: compact(addDaysToKey(key, 1)) };
};

/**
 * The DTSTART/DTEND lines of one VEVENT. A to-be-confirmed date is published as an ALL-DAY event
 * (VALUE=DATE), never at the series default time; a timed date keeps its instants exactly as before
 * (`toCompactUtc` is the caller's own wall-clock -> compact UTC conversion).
 */
export const icsDateLines = (
  allDay: boolean,
  start: WallClock | null,
  end: WallClock | null,
  toCompactUtc: (wc: WallClock | null) => string | null,
): string[] => {
  if (allDay) {
    const range = allDayDateRange(start);
    return range ? [`DTSTART;VALUE=DATE:${range.start}`, `DTEND;VALUE=DATE:${range.end}`] : [];
  }
  const s = toCompactUtc(start);
  const e = toCompactUtc(end ?? start);
  return [s ? `DTSTART:${s}` : null, e ? `DTEND:${e}` : null].filter((x): x is string => x !== null);
};
