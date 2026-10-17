// Coming dates and coming DAYS for the R1 flows (plan 4.3 #5). Pure and
// London wall-clock: dates are YYYY-MM-DD keys, times are the HH:MM digits of
// a local-as-Z stamp (localAsZTime); nothing is converted through a zone, so
// the night the clocks go back (25 October) moves no row.

import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';
import { isListedSeries, localAsZTime, type HomeSeriesFull } from './homeModel';
import { fullDate } from './dateWords';

export interface DateRow {
  occurrenceId: string;
  date: string;
  /** HH:MM, London wall clock, or null when the date has no time. */
  time: string | null;
  /** "Friday 23 October" (full names, 4.9). */
  label: string;
}

export interface DayRow {
  date: string;
  label: string;
  /** 0 = Sunday .. 6 = Saturday. */
  weekday: number;
}

/** "Friday 23 October" for a London date key (the shared formatter, shared/dateWords.ts; no year). */
export const dayLabel = (date: string): string => fullDate(date);

/**
 * The series' coming SCHEDULED dates from today, soonest first, at most
 * `limit`. organiser_home_v1 lists only the first few (`next_dates`); the
 * rest are "N more" (moreDatesCount), read from admin_event_workspace_p5
 * (useEventWorkspace) by the screen that shows them.
 */
export function comingDates(series: HomeSeriesFull, today: string, limit = 14): DateRow[] {
  if (!isListedSeries(series)) return [];
  return series.next_dates
    .filter((d) => d.lifecycle_status === 'scheduled' && d.occurrence_date >= today)
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
    .slice(0, limit)
    .map((d) => ({
      occurrenceId: d.occurrence_id,
      date: d.occurrence_date,
      time: localAsZTime(d.materialised_start_utc),
      label: dayLabel(d.occurrence_date),
    }));
}

/** Scheduled coming dates the list does not show ("N more"); never negative. */
export const moreDatesCount = (series: HomeSeriesFull, shown: readonly DateRow[]): number =>
  Math.max(0, series.upcoming_count - shown.length);

/**
 * The next `days` calendar days from today minus every day that already holds
 * a date of this series (scheduled OR cancelled: a cancelled date is put back,
 * not added again). Feeds Add a date and Move to another day.
 *
 * `next_dates` carries only the first three dates, so a weekly series holds
 * more days inside 30 than it lists: pass every date the workspace read
 * (admin_event_workspace_p5) as `heldDates`, or the list offers a taken day.
 */
export function comingDays(series: HomeSeriesFull, today: string, days = 30, heldDates: readonly string[] = []): DayRow[] {
  const taken = new Set([...series.next_dates.map((d) => d.occurrence_date), ...heldDates]);
  const rows: DayRow[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDaysToKey(today, i);
    if (!taken.has(date)) rows.push({ date, label: dayLabel(date), weekday: weekdayOfKey(date) });
  }
  return rows;
}
