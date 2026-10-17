// Add a date and Cancel a date (S3, boards C7-C14 without Undo): the pure facts
// the steps show. Dates are London wall-clock keys throughout (dateList.ts);
// nothing is converted through a zone, so a day across 25 October keeps its time.

import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { comingDates, comingDays, dayLabel, type DateRow } from '@/modules/organiser/shared/dateList';
import { dateLock, eventLock } from '@/modules/organiser/shared/eventState';
import { CAP_NOTE, MAX_UPCOMING } from '@/modules/organiser/events/dateCap';
import type { SeriesWorkspace } from '@/modules/organiser/shared/seriesModel';

/** Every listed series of the login, across its pages (a series shared by two pages is listed once). */
function allSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const seen = new Set<string>();
  return (home?.organisers ?? []).flatMap((o) => o.series ?? []).filter((s) => {
    if (!isListedSeries(s) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export const findSeries = (home: OrganiserHome | undefined, seriesId: string): HomeSeriesFull | null =>
  allSeries(home).find((s) => s.id === seriesId) ?? null;

/** A series a date can be added to: live or draft, the same rule as Home's Add row (homeJobs canAdd). */
export const canAddTo = (status: string) => status === 'live' || status === 'draft';

/** C7: the events a date can be added to. */
export const addableSeries = (home: OrganiserHome | undefined): HomeSeriesFull[] =>
  allSeries(home).filter((s) => canAddTo(s.lifecycle_status));

/** C11: live events with at least one coming scheduled date (Home's Cancel row rule). */
export function cancellableSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const today = home?.today ?? '';
  return allSeries(home).filter((s) => s.lifecycle_status === 'live' && comingDates(s, today, 1).length > 0);
}

/** Why no date of this event can be added or cancelled here; null when it can. */
export function seriesLock(status: string, job: 'add' | 'cancel'): string | null {
  if (job === 'add' ? canAddTo(status) : status === 'live') return null;
  const verb = job === 'add' ? 'added' : 'cancelled';
  return eventLock(status) ?? `This event is ${status === 'paused' ? 'paused' : 'not live'}, so dates can't be ${verb} here.`;
}

/** The series with every date the workspace read holds (home_v1 lists only the first three). */
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

/** Coming SCHEDULED dates, every one (C12). */
export const cancelDates = (series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): DateRow[] =>
  comingDates(withWorkspaceDates(series, ws), today, Number.POSITIVE_INFINITY);

/**
 * The server's 30-upcoming cap (dateCap.ts): series.add_date refuses while the
 * series holds MAX_UPCOMING or more coming scheduled dates, whichever day is picked.
 */
export function atCap(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): boolean {
  const scheduled = ws
    ? ws.dates.filter((d) => d.lifecycle_status === 'scheduled' && d.occurrence_date >= today).length
    : series.upcoming_count;
  return scheduled >= MAX_UPCOMING;
}

export interface AddDay {
  date: string;
  label: string;
  /** Why this day cannot take a date (aria-disabled + the visible sub-line), or null. */
  reason: string | null;
}

/** C8: the next 30 days minus every day holding a date (scheduled or cancelled); capped days carry the reason. */
export function addDays(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): AddDay[] {
  const capped = atCap(series, ws, today);
  return comingDays(series, today, 30, ws?.dates.map((d) => d.occurrence_date) ?? []).map((d) => ({
    date: d.date,
    label: d.label,
    reason: capped ? CAP_NOTE : null,
  }));
}

export type DayGate = { kind: 'ok' } | { kind: 'refused'; text: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** May a date be added on this day (a URL can name any day)? */
export function addDayGate(series: HomeSeriesFull, ws: SeriesWorkspace, date: string, today: string): DayGate {
  if (!ISO_DAY.test(date)) return { kind: 'refused', text: 'Not a day' };
  const lock = dateLock(series.lifecycle_status, date, today);
  if (lock) return { kind: 'refused', text: lock };
  if (ws.dates.some((d) => d.occurrence_date === date)) return { kind: 'refused', text: `${dayLabel(date)} already has a date.` };
  if (atCap(series, ws, today)) return { kind: 'refused', text: CAP_NOTE };
  return { kind: 'ok' };
}

/** HH:MM of the series' usual start, or '' when it has none. */
export function usualTime(series: HomeSeriesFull, ws: SeriesWorkspace | undefined): string {
  const raw = ws?.series.default_local_start_time ?? series.default_local_start_time ?? '';
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : '';
}

// The D29 confirmation lines (Done, no Undo: D49).
export const addDoneMessage = (date: string, time: string) => `Added - ${dayLabel(date)}${time ? `, ${time}` : ''}`;
export const cancelDoneMessage = (date: string) => `Cancelled - ${dayLabel(date)}`;
export const backOnMessage = (date: string) => `Back on - ${dayLabel(date)}`;

/** The reason sent when none is picked: the server needs a cancellation_reasons label (owner cancels). */
export const DEFAULT_REASON = 'Other';
