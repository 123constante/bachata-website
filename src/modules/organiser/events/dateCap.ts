// The 30-upcoming-dates cap for a weekly event (ARC.md DOMAIN). The server does
// NOT cap series.set_recurrence or unskip, so the UI enforces it here: it offers
// only end choices that keep the series within MAX_UPCOMING upcoming dates, and
// Extend adds the next batch within the same limit. Pure: London calendar keys
// (YYYY-MM-DD) only, never the browser's clock.

import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';

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

/**
 * What Extend does now: the next batch (EXTEND_BATCH weeks) after the current
 * end, trimmed so the series stays within the cap and the 12-month bound.
 * Null when nothing more fits (already 30 upcoming, or at the bound).
 */
export function extendStep(input: CapInput, currentUntil: string | null): ExtendStep | null {
  const weekday = weekdayOfKey(input.startDate);
  const first = firstUpcoming(input);
  // The last weekly date already in the run (or the day before the run starts).
  const inRun = currentUntil && currentUntil >= first ? weeklyDates(first, currentUntil, weekday) : [];
  const last = inRun.length ? inRun[inRun.length - 1] : addDaysToKey(first, -7);
  let add = Math.min(EXTEND_BATCH, roomFor(input) - inRun.length);
  const limit = maxRuleEnd(input.today);
  while (add > 0 && addDaysToKey(last, 7 * add) > limit) add -= 1;
  return add > 0 ? { add, until: addDaysToKey(last, 7 * add) } : null;
}
