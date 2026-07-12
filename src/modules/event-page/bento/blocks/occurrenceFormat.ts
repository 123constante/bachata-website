import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { londonTodayKey } from '@/lib/londonDate';

// Shared occurrence date/time formatting helpers, used by the flat DatesBlock
// and the course Weeks Ladder.
//
// TIME CONVENTION (important): calendar_occurrences.instance_start and
// event_program_items.start_time are stored "local-as-UTC" -- a naive wall
// clock stamped with a +00 offset. "13:00:00+00" means 1 o'clock LOCAL, not a
// real UTC instant. This is the canonical convention, CI-enforced by
// check_occurrence_instance_time_canonical_v1 (occurrence start is derived from
// the program item start with NO timezone shift), and it is how ScheduleBlock's
// own parser (EventScheduleGrid.toMins) reads these stamps.
//
// Therefore we must read the wall clock AS STORED and never apply a timezone
// conversion. Passing these stamps through Intl.DateTimeFormat({ timeZone })
// treats the naive value as a real UTC instant and adds the BST offset, showing
// every summer event an hour late -- the bug this module previously had.

// Parse the literal HH:MM from an ISO-like string without any timezone shift.
function naiveHourMinute(iso: string): { hh: number; mm: number } | null {
  const tIdx = iso.indexOf('T');
  if (tIdx === -1) return null;
  const hh = Number(iso.slice(tIdx + 1, tIdx + 3));
  const mm = Number(iso.slice(tIdx + 4, tIdx + 6));
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return null;
  return { hh, mm: Number.isFinite(mm) ? mm : 0 };
}

export function formatDateLabel(occ: EventPageSnapshotOccurrence): string {
  const src = occ.localDate ?? occ.startsAt;
  if (!src) return '--';
  const ymd = src.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '--';
  // Anchor the naive date at UTC noon and format in UTC so the weekday/day/month
  // are read straight off the stored date, machine-timezone-independent.
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '--';
  const fmt = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opt }).format(date);
  return `${fmt({ weekday: 'short' })} ${fmt({ day: 'numeric' })} ${fmt({ month: 'short' })}`;
}

export function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const hm = naiveHourMinute(iso);
  if (!hm) return null;
  const h12 = hm.hh % 12 === 0 ? 12 : hm.hh % 12;
  const ampm = hm.hh < 12 ? 'AM' : 'PM';
  return hm.mm === 0
    ? `${h12} ${ampm}`
    : `${h12}:${String(hm.mm).padStart(2, '0')} ${ampm}`;
}

export function formatDuration(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  // Both stamps share the same (+00) offset, so the difference is correct
  // regardless of the local-as-UTC convention -- no timezone handling needed.
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  if (mins <= 0) return null;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hrs = mins / 60;
  return hrs % 1 === 0 ? `${Math.round(hrs)} hr` : `${hrs.toFixed(1)} hr`;
}

export function isOccurrenceToday(occ: EventPageSnapshotOccurrence): boolean {
  const src = occ.localDate ?? occ.startsAt;
  if (!src) return false;
  const ymd = src.slice(0, 10);
  // "Today" must be the LONDON calendar day, not the browser-local one: the
  // occurrence date key (ymd) is a London wall-clock date, and the app's clock
  // authority is Europe/London (londonDate.ts). Browser-local getDate() was both
  // wrong for non-London visitors AND a server-vs-client SSR hydration mismatch
  // (a UTC server and a London client disagreed on "today", so DatesBlock /
  // WeeksLadderBlock's today-gated elements structurally mismatched -> React #418).
  return ymd === londonTodayKey();
}
