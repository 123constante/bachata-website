// What the event editor's Date card says and lets the organiser change, for
// EVERY real series shape (F4, from the prod survey): weekly rules with any end,
// monthly and custom rules, recurring series with no rule (dates added one by
// one), one-offs, courses, festivals, ended and archived events. Pure.

import { weekdayOfKey } from '@/lib/londonDate';
import { eventLock, ownerWeeklyRule, TEAM } from '@/modules/organiser/shared/eventState';
import type { WorkspaceDate, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';

/**
 * weekly: 'Starts on', 'Repeats' and 'Listed until' all work (the owner's rule).
 * single: a one-date event: 'Starts on' works; it cannot be made to repeat here.
 * fixed:  shown as it is, with the reason it cannot be changed here.
 */
export type ScheduleMode = 'weekly' | 'single' | 'fixed';

export interface ScheduleView {
  mode: ScheduleMode;
  /** The true pattern in plain words: 'Every Saturday', 'The first Friday of each month'. */
  pattern: string;
  /** Why Starts on / Repeats / Listed until cannot be changed (null in weekly mode). */
  reason: string | null;
  /** Why 'Repeats' cannot be switched (single mode); null when it can. */
  repeatsReason: string | null;
  /** Why 'One date' cannot be chosen for a weekly event; null when it can. */
  stopReason: string | null;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NTH: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last', [-1]: 'last' };

const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${tail}`;
};
const list = (words: string[]) => (words.length <= 1 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** The rule as stored, in words; null when there is no rule this can read. */
export function rulePattern(rule: unknown): string | null {
  const r = rule as {
    mode?: unknown; interval?: unknown; weekdays?: unknown; dates?: unknown;
    monthly?: { kind?: unknown; nth?: unknown; weekday?: unknown; day?: unknown };
  } | null;
  if (!r || typeof r !== 'object') return null;
  const every = Number(r.interval ?? 1) || 1;
  if (r.mode === 'weekly' && Array.isArray(r.weekdays) && r.weekdays.length) {
    const days = list(r.weekdays.map(Number).filter((n) => n >= 0 && n <= 6).map((n) => WEEKDAY[n]));
    return every === 1 ? `Every ${days}` : `Every ${every} weeks on ${days}`;
  }
  if (r.mode === 'monthly' && r.monthly) {
    const months = every === 1 ? 'each month' : `every ${every} months`;
    if (r.monthly.kind === 'nth_weekday' && NTH[Number(r.monthly.nth)] && WEEKDAY[Number(r.monthly.weekday)]) {
      return `The ${NTH[Number(r.monthly.nth)]} ${WEEKDAY[Number(r.monthly.weekday)]} of ${months}`;
    }
    if (r.monthly.kind === 'day_of_month' && Number(r.monthly.day) >= 1) return `The ${ordinal(Number(r.monthly.day))} of ${months}`;
    return every === 1 ? 'Monthly' : `Every ${every} months`;
  }
  if (r.mode === 'custom') return 'On chosen dates';
  return null;
}

/** A recurring series with no rule: its dates' own pattern ('Every Saturday') when they keep one. */
export function datesPattern(dates: WorkspaceDate[]): string | null {
  const keys = [...new Set(dates.map((d) => d.occurrence_date))].sort();
  if (keys.length < 2) return null;
  const weekday = weekdayOfKey(keys[0]);
  return keys.every((k) => weekdayOfKey(k) === weekday) ? `Every ${WEEKDAY[weekday]}` : null;
}

export function scheduleView(series: Pick<WorkspaceSeries, 'format' | 'lifecycle_status' | 'recurrence_rule'>, dates: WorkspaceDate[]): ScheduleView {
  const lock = eventLock(series.lifecycle_status);
  const fromRule = rulePattern(series.recurrence_rule);
  const fromDates = datesPattern(dates);
  const pattern =
    series.format === 'one_off' ? 'One date'
      : series.format === 'festival' ? (dates.length > 1 ? `Festival, ${dates.length} days` : 'Festival')
        : fromRule ?? fromDates ?? (dates.length > 1 ? 'Dates set one by one' : 'One date');
  const view = (mode: ScheduleMode, reason: string | null, repeatsReason: string | null = reason, stopReason: string | null = null): ScheduleView =>
    ({ mode, pattern, reason, repeatsReason, stopReason });

  if (lock) return view('fixed', lock);
  if (ownerWeeklyRule(series)) {
    // A live or paused repeating series must keep a rule (event_series_p5_format_recurrence_chk).
    const stop = ['live', 'paused'].includes(series.lifecycle_status)
      ? `A live repeating event can't become one date here. To stop it, ask ${TEAM}.`
      : null;
    return view('weekly', null, null, stop);
  }
  if (series.format === 'one_off') return view('single', null, `A one-date event can't be made to repeat here. Ask ${TEAM}.`);
  if (series.format === 'course') return view('fixed', `Course dates are set by ${TEAM}. Open a date below to change that date.`);
  if (series.format === 'festival') return view('fixed', `Festival days are set by ${TEAM}. Open a day below to change that day.`);
  if (!series.recurrence_rule) {
    return view('fixed', `This event's dates are listed one by one. Open a date below to change it; to add dates, ask ${TEAM}.`);
  }
  return view('fixed', `This pattern was set by ${TEAM}, so it can't be changed here. Open a date below to change that date.`);
}
