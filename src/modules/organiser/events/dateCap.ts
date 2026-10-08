// The 30-upcoming-dates cap for a weekly event (ARC.md DOMAIN). THE SERVER'S RULE
// (prod, read 2026-10-08): an organiser (any non-admin) cannot create a new
// upcoming date while the series holds 30 or more upcoming SCHEDULED dates
// (cancelled and past dates do not count). series.add_date refuses
// ('date_cap'); a weekly rule (series.set_recurrence, the nightly top-up) is
// accepted but materialises only up to 30 (_materialise_series_occurrences_p5_v1
// holds the rest back). Nothing is deleted: a series already above 30 keeps
// every date. A rule end is at most 12 months ahead (_owner_weekly_rule_problem_p5).
// The UI mirrors that here: end choices stay within MAX_UPCOMING, Extend adds the
// next batch only while the server would add it, and listingView is the ONE
// mapping for the 'Listed until' row's date, Extend and sentence. Pure: London
// calendar keys (YYYY-MM-DD) only, never the browser's clock.

import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';
import { calendarDate } from '@/modules/organiser/shared/homeModel';

export const MAX_UPCOMING = 30;
/** Extend adds up to this many weeks at a time (Home nudges under ~8 weeks of runway). */
export const EXTEND_BATCH = 8;
/** The end choices offered, as numbers of weekly dates. */
export const END_CHOICE_COUNTS = [4, 8, 12, 16, 26] as const;
export const CAP_NOTE = 'Up to 30 upcoming dates';

/** The server's own bound on a rule end (_owner_weekly_rule_problem_p5): 12 months from today. */
export function maxRuleEnd(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const leap = (n: number) => (n % 4 === 0 && n % 100 !== 0) || n % 400 === 0;
  const day = m === 2 && d === 29 && !leap(y + 1) ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The first date on or after `from` that falls on `weekday` (0 = Sunday). */
export function firstOnWeekday(from: string, weekday: number): string {
  return addDaysToKey(from, (weekday - weekdayOfKey(from) + 7) % 7);
}

/** Weekly dates on `weekday` from `from` through `until` (inclusive). */
export function weeklyDates(from: string, until: string, weekday: number): string[] {
  const out: string[] = [];
  for (let d = firstOnWeekday(from, weekday); d <= until && out.length < 400; d = addDaysToKey(d, 7)) out.push(d);
  return out;
}

export interface CapInput {
  /** London today. */
  today: string;
  /** The series' first date ('Starts on'). */
  startDate: string;
  /** Upcoming dates the rule does not generate (added by hand); they count toward the cap too. */
  otherUpcoming?: number;
}

export interface EndChoice {
  /** How many upcoming weekly dates this end gives. */
  count: number;
  /** The rule's until_date. */
  until: string;
}

/** The first upcoming weekly date: the start date, or its weekday on or after today. */
export function firstUpcoming({ today, startDate }: CapInput): string {
  const weekday = weekdayOfKey(startDate);
  return startDate >= today ? startDate : firstOnWeekday(today, weekday);
}

/** Room left under the cap for weekly dates. */
export const roomFor = (input: CapInput) => Math.max(0, MAX_UPCOMING - (input.otherUpcoming ?? 0));

/** The end of a run of `count` weekly dates starting at the first upcoming one. */
export const untilForCount = (input: CapInput, count: number) => addDaysToKey(firstUpcoming(input), 7 * (count - 1));

/** How many upcoming weekly dates an end gives. */
export function upcomingCount(input: CapInput, until: string): number {
  return weeklyDates(firstUpcoming(input), until, weekdayOfKey(input.startDate)).length;
}

/**
 * The end choices to offer: the fixed counts that fit, plus the largest run
 * that fits ("up to 30"). Every choice stays within MAX_UPCOMING upcoming
 * dates (counting hand-added ones) and within the server's 12-month bound.
 */
export function allowedEndChoices(input: CapInput): EndChoice[] {
  const room = roomFor(input);
  const limit = maxRuleEnd(input.today);
  const counts = new Set<number>(END_CHOICE_COUNTS.filter((n) => n <= room));
  if (room > 0) counts.add(room);
  const out: EndChoice[] = [];
  [...counts].sort((a, b) => a - b).forEach((count) => {
    let n = count;
    while (n > 0 && untilForCount(input, n) > limit) n -= 1;
    if (n > 0 && !out.some((c) => c.count === n)) out.push({ count: n, until: untilForCount(input, n) });
  });
  return out;
}

/** True when an end keeps the series inside the cap (and the server's bound). */
export function endWithinCap(input: CapInput, until: string): boolean {
  return until >= input.today && until <= maxRuleEnd(input.today) && upcomingCount(input, until) <= roomFor(input);
}

export interface ExtendStep {
  /** Dates Extend adds. */
  add: number;
  /** The new until_date. */
  until: string;
}

/** What the server holds now: the dates it counts toward the cap, and the last upcoming one. */
export interface Stored {
  /** Upcoming scheduled (not cancelled) dates: the server's cap count. */
  listed: number;
  /** The last upcoming date stored, any status; null when none. */
  last: string | null;
}

/**
 * What Extend does now: the next batch (EXTEND_BATCH weeks) after the current
 * end, trimmed so the series stays within the cap and the 12-month bound.
 * Null when nothing more fits (already 30 upcoming, or at the bound). With
 * `stored`, room is the server's own count (cancelled dates free a place) plus
 * the weeks an unsaved end already adds after the last stored date.
 */
export function extendStep(input: CapInput, currentUntil: string | null, stored?: Stored): ExtendStep | null {
  const weekday = weekdayOfKey(input.startDate);
  const first = firstUpcoming(input);
  // The last weekly date already in the run (or the day before the run starts).
  const inRun = currentUntil && currentUntil >= first ? weeklyDates(first, currentUntil, weekday) : [];
  const last = inRun.length ? inRun[inRun.length - 1] : addDaysToKey(first, -7);
  const room = stored
    ? MAX_UPCOMING - stored.listed - inRun.filter((d) => !stored.last || d > stored.last).length
    : roomFor(input) - inRun.length;
  let add = Math.min(EXTEND_BATCH, room);
  const limit = maxRuleEnd(input.today);
  while (add > 0 && addDaysToKey(last, 7 * add) > limit) add -= 1;
  return add > 0 ? { add, until: addDaysToKey(last, 7 * add) } : null;
}

export interface Listing {
  /** 'Listed until Wed 6 Oct 2027' (year when not this year), or 'No upcoming dates'. */
  untilText: string;
  /** What Extend adds; null when it cannot add anything. */
  step: ExtendStep | null;
  /** The sentence under the row: the true count and, when Extend is off, why. */
  note: string;
  /** The sentence on the 'Listed until' sheet. */
  sheetNote: string;
}

/**
 * THE mapping for the 'Listed until' row (one place, so the date, the Extend
 * state and the sentence can never disagree). `until` is the run's end as the
 * screen holds it (an unsaved end included); `stored` is what the server holds.
 */
export function listingView(input: CapInput, until: string | null, stored: Stored): Listing {
  const { today } = input;
  const untilText = until && until >= today ? `Listed until ${calendarDate(until, today)}` : 'No upcoming dates';
  const step = extendStep(input, until, stored);
  const over = stored.listed >= MAX_UPCOMING;
  let note: string = CAP_NOTE;
  if (over) {
    note = stored.listed > MAX_UPCOMING
      ? `${stored.listed} upcoming dates are listed, more than the ${MAX_UPCOMING} you can list. Extend is off until fewer than ${MAX_UPCOMING} are left.`
      : `${stored.listed} upcoming dates are listed, the most you can list. Extend is off until fewer than ${MAX_UPCOMING} are left.`;
  } else if (!step) {
    // Not over the cap, so either the 12-month bound stops it, or an unsaved end already reaches 30.
    note = until && addDaysToKey(until, 7) > maxRuleEnd(today)
      ? 'Listed 12 months ahead, the most. Extend is off.'
      : `Once saved, ${MAX_UPCOMING} upcoming dates are listed, the most. Extend is off.`;
  }
  const sheetNote = over
    ? `${CAP_NOTE}. ${stored.listed} are listed now, so no new dates can be added until fewer than ${MAX_UPCOMING} are left.`
    : step ? `${CAP_NOTE}. Extend later to list more.` : `${CAP_NOTE}.`;
  return { untilText, step, note, sheetNote };
}
