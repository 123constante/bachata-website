// Add a date and Cancel a date (S3, boards C7-C14 without Undo): the pure facts
// the steps show. Dates are London wall-clock keys throughout (dateList.ts);
// nothing is converted through a zone, so a day across 25 October keeps its time.

import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { allSeries, findSeries } from '@/modules/organiser/shared/useOrganiserSeries';
import { comingDates, comingDays, dayLabel, type DateRow } from '@/modules/organiser/shared/dateList';
import { dateLock, eventLock } from '@/modules/organiser/shared/eventState';
import { CAP_NOTE, MAX_UPCOMING } from '@/modules/organiser/events/dateCap';
import type { SeriesWorkspace } from '@/modules/organiser/shared/seriesModel';

// The one lookup lives in shared/useOrganiserSeries (ER-S1); re-exported so importers keep their path.
export { findSeries };

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

/** Why a festival takes no new date (the server's festival_extra_date: a festival holds ONE date). */
export const FESTIVAL_NOTE = 'A festival has one date';

/**
 * True when this is a festival that already holds a date of any status, past
 * included (prod _cmd_series_add_date_p5 counts every row). Without the
 * workspace (C7) only Home's coming counts are known, so a festival whose one
 * date is past is caught on C8, not on its C7 row.
 */
export function festivalHeld(series: HomeSeriesFull, ws: SeriesWorkspace | undefined): boolean {
  if (series.format !== 'festival') return false;
  return ws ? ws.dates.length > 0 : series.upcoming_count + series.cancelled_upcoming_count > 0;
}

/** Why no day of this event can take a new date (festival, then cap), or null. One rule for C7, C8 and C9. */
export function addBlock(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): string | null {
  if (festivalHeld(series, ws)) return FESTIVAL_NOTE;
  return atCap(series, ws, today) ? CAP_NOTE : null;
}

export interface AddDay {
  date: string;
  label: string;
  /** Why this day cannot take a date (aria-disabled + the visible sub-line), or null. */
  reason: string | null;
}

/** C8: the next 30 days minus every day holding a date (scheduled or cancelled); blocked days carry the reason. */
export function addDays(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): AddDay[] {
  const block = addBlock(series, ws, today);
  return comingDays(series, today, 30, ws?.dates.map((d) => d.occurrence_date) ?? []).map((d) => ({
    date: d.date,
    label: d.label,
    reason: block,
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
  const block = addBlock(series, ws, today);
  if (block) return { kind: 'refused', text: block };
  return { kind: 'ok' };
}

/** HH:MM of the series' usual start, or '' when it has none. */
export function usualTime(series: HomeSeriesFull, ws: SeriesWorkspace | undefined): string {
  const raw = ws?.series.default_local_start_time ?? series.default_local_start_time ?? '';
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : '';
}

// The D29 confirmation lines (Done, no Undo: D49).
export const addDoneMessage = (date: string, time: string) => `Added - ${dayLabel(date)}${time ? `, ${time}` : ''}`;
/** S1: the date was added at the usual time, the typed one did not save; Home's "Change a date" row fixes it. */
export const timeNotSavedMessage = (date: string, usual: string, typed: string) =>
  `${addDoneMessage(date, usual)}. ${typed} was not saved: change it from Home, Change a date.`;
export const cancelDoneMessage = (date: string) => `Cancelled - ${dayLabel(date)}`;
export const backOnMessage = (date: string) => `Back on - ${dayLabel(date)}`;

/** The reason sent when none is picked: the server needs a cancellation_reasons label (owner cancels). */
export const DEFAULT_REASON = 'Other';
