import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { londonTodayKey } from '@/lib/londonDate';
import {
  formatWallClockDate,
  formatWallClockTime,
  wallClockDateKey,
  wallClockDurationMinutes,
} from '@/lib/time/wallClock';

// Shared occurrence date/time formatting helpers, used by the flat DatesBlock
// and the course Weeks Ladder.
//
// TIME CONVENTION: occurrence starts_at/ends_at/local_date are stored
// "local-as-UTC" -- a naive wall clock tagged +00 ("13:00:00+00" means 1 o'clock
// LOCAL, not a real UTC instant). They are now typed as WallClock
// (src/lib/time/wallClock.ts), so the compiler forbids reading them with
// `new Date(...)` / Intl-timezone-conversion -- the "+1h in BST" bug is
// unrepresentable, not merely discouraged. These helpers delegate to the
// sanctioned wall-clock readers, which slice the value AS STORED and are
// byte-identical to the hand-rolled readers this module used before.

export function formatDateLabel(occ: EventPageSnapshotOccurrence): string {
  return formatWallClockDate(occ.localDate ?? occ.startsAt) ?? '--';
}

export function formatTime(wc: EventPageSnapshotOccurrence['startsAt']): string | null {
  return formatWallClockTime(wc);
}

export function formatDuration(
  start: EventPageSnapshotOccurrence['startsAt'],
  end: EventPageSnapshotOccurrence['endsAt'],
): string | null {
  const mins = wallClockDurationMinutes(start, end);
  if (mins === null || mins <= 0) return null;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hrs = mins / 60;
  return hrs % 1 === 0 ? `${Math.round(hrs)} hr` : `${hrs.toFixed(1)} hr`;
}

export function isOccurrenceToday(occ: EventPageSnapshotOccurrence): boolean {
  // "Today" must be the LONDON calendar day (londonDate authority), matching the
  // stored wall-clock date -- browser-local getDate() was wrong for non-London
  // visitors AND a server-vs-client SSR hydration mismatch (a UTC server and a
  // London client disagreed on "today", structurally mismatching today-gated
  // elements -> React #418).
  const ymd = wallClockDateKey(occ.localDate ?? occ.startsAt);
  return ymd !== null && ymd === londonTodayKey();
}
