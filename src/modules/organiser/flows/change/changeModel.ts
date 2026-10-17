// Change a date (S2, boards C2-C6): the pure facts the six steps show. Dates
// are London wall-clock keys throughout (dateList.ts); nothing is converted
// through a zone, so a date moved across 25 October keeps its time.

import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { comingDates, comingDays, dayLabel, moreDatesCount, type DateRow, type DayRow } from '@/modules/organiser/shared/dateList';
import { dateLock, eventLock } from '@/modules/organiser/shared/eventState';
import type { SeriesWorkspace, WorkspaceDate } from '@/modules/organiser/shared/seriesModel';

/** Every listed series of the login, across its pages (a series shared by two pages is listed once). */
function allSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const seen = new Set<string>();
  return (home?.organisers ?? []).flatMap((o) => o.series ?? []).filter((s) => {
    if (!isListedSeries(s) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** C2: the login's LIVE series with at least one coming scheduled date. */
export function changeableSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const today = home?.today ?? '';
  return allSeries(home).filter((s) => s.lifecycle_status === 'live' && comingDates(s, today, 1).length > 0);
}

export const findSeries = (home: OrganiserHome | undefined, seriesId: string): HomeSeriesFull | null =>
  allSeries(home).find((s) => s.id === seriesId) ?? null;

/**
 * The series with every date the workspace read holds (home_v1 lists only the
 * first three): the same comingDates / comingDays rules, over the full list.
 */
function withWorkspaceDates(series: HomeSeriesFull, ws: SeriesWorkspace | undefined): HomeSeriesFull {
  if (!ws) return series;
  return {
    ...series,
    next_dates: ws.dates.map((d) => ({
      occurrence_id: d.id,
      occurrence_date: d.occurrence_date,
      lifecycle_status: d.lifecycle_status,
      materialised_start_utc: d.materialised_start_utc,
      has_own_changes: d.has_override,
    })),
  };
}

/** C3: coming scheduled dates, soonest first. */
export const changeDates = (series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): DateRow[] =>
  comingDates(withWorkspaceDates(series, ws), today);

/**
 * C3 in full: the first 14 coming dates, every coming date (the workspace read
 * holds them all; 30 of 67 live series had more than 14 on 2026-10-16, max
 * 59), and how many the "N more" row stands for.
 */
export function changeDateList(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string) {
  const full = withWorkspaceDates(series, ws);
  const all = comingDates(full, today, Number.POSITIVE_INFINITY);
  const first = changeDates(series, ws, today);
  return { first, all, more: moreDatesCount({ ...full, upcoming_count: all.length }, first) };
}

/**
 * Why no date of this event can be changed here (an ended/archived event:
 * eventLock verbatim; a paused or not-yet-live one), null for a live event.
 */
export function seriesLock(status: string): string | null {
  if (status === 'live') return null;
  return eventLock(status) ?? `This event is ${status === 'paused' ? 'paused' : 'not live'}, so its dates can't be changed here.`;
}

/** C5c: the next 30 days minus every day that already holds a date of this series. */
export const moveDays = (series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): DayRow[] =>
  comingDays(series, today, 30, ws?.dates.map((d) => d.occurrence_date) ?? []);

export type DateGate =
  | { kind: 'ok'; date: WorkspaceDate }
  | { kind: 'refused'; text: string }
  | { kind: 'missing' };

/**
 * May this date be changed? A past date (or a closed event) is refused with
 * eventState.ts's dateLock text verbatim (the C34 stale-link refusal); a
 * cancelled date is put back from Cancel, not changed here.
 */
export function dateGate(ws: SeriesWorkspace, occurrenceId: string, today: string): DateGate {
  const date = ws.dates.find((d) => d.id === occurrenceId);
  if (!date) return { kind: 'missing' };
  const lock = dateLock(ws.series.lifecycle_status, date.occurrence_date, today);
  if (lock) return { kind: 'refused', text: lock };
  if (date.lifecycle_status === 'cancelled') return { kind: 'refused', text: 'Cancelled' };
  return { kind: 'ok', date };
}

// The D29 confirmation lines (Done, no Undo: D49).
export const timeDoneMessage = (time: string) => `Moved to ${time}`;
export const venueDoneMessage = (date: string) => `Different venue - ${dayLabel(date)}`;
export const dayDoneMessage = (date: string) => `Moved to ${dayLabel(date)}`;
