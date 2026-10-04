// Pure, client-free view model for the create screen (Lever 2 W3, mockup
// 02-A: one screen with the public page previewed beside it). A party is a
// one-off series with one date; a weekly class is a recurring series with the
// owner's one weekly rule (D-5). Everything here is London wall-clock: dates
// are YYYY-MM-DD digits and times HH:MM digits, never converted through Date.

import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';
import { dateLabel } from './homeModel';
import { LEVEL_OPTIONS, formToDraft, minutesBetween } from './seriesModel';
import {
  addDateCommand,
  submitForReviewCommand,
  weeklyRuleCommand,
  type CreateDraft,
  type OwnerCategory,
  type OwnerCommand,
  type OwnerFormat,
} from './seriesCommands';

export type EventKind = 'party' | 'weekly_class';

export const EVENT_KINDS: Array<{ kind: EventKind; label: string; hint: string }> = [
  { kind: 'weekly_class', label: 'Weekly class', hint: 'Same day each week. One page, every date listed.' },
  { kind: 'party', label: 'Party', hint: 'One night. You can add more dates later.' },
];

/**
 * The owner categories (admin D7) the two kinds map to. `workshop` is an owner
 * value too, but neither the plan (section 4) nor mockup 02 offers it, so this
 * screen does not: a workshop stays with the team until a slice asks for it.
 */
export const KIND_CATEGORY: Record<EventKind, OwnerCategory> = { party: 'party', weekly_class: 'class' };
export const KIND_FORMAT: Record<EventKind, OwnerFormat> = { party: 'one_off', weekly_class: 'recurring' };

export interface CreateForm {
  kind: EventKind;
  name: string;
  venueId: string | null;
  /** The party's date, or the weekly class's first date. */
  date: string;
  startTime: string;
  endTime: string;
  level: string;
  ticketUrl: string;
  coverImageUrl: string;
  description: string;
}

export const emptyCreateForm = (): CreateForm => ({
  kind: 'weekly_class',
  name: '',
  venueId: null,
  date: '',
  startTime: '',
  endTime: '',
  level: '',
  ticketUrl: '',
  coverImageUrl: '',
  description: '',
});

// ---- weekdays -------------------------------------------------------------------

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Monday first for the picker; the value is the server's 0 = Sunday .. 6 = Saturday. */
export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
  value,
  label: WEEKDAY_LONG[value],
}));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

/** 0 = Sunday .. 6 = Saturday of a YYYY-MM-DD date; NaN for anything else. */
export function weekdayOf(date: string): number {
  return ISO_DATE.test(date) ? weekdayOfKey(date) : NaN;
}

/** The first date on or after `from` that falls on `weekday`. */
export function nextDateOnWeekday(from: string, weekday: number): string {
  return addDaysToKey(from, (weekday - weekdayOfKey(from) + 7) % 7);
}

/**
 * The first date the Day picker sets: `weekday` in the same Monday-first week
 * as the date already chosen, never before today. Anchoring on that week (not
 * on the chosen date itself) keeps a change of mind from pushing the first
 * date a week later each time.
 */
export function dateForWeekday(current: string, today: string, weekday: number): string {
  if (!ISO_DATE.test(current)) return nextDateOnWeekday(today, weekday);
  const monday = addDaysToKey(current, -((weekdayOfKey(current) + 6) % 7));
  return nextDateOnWeekday(monday > today ? monday : today, weekday);
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

// ---- readiness ------------------------------------------------------------------

/**
 * What the screen still needs before it can save, in the order the form asks
 * for it ("To continue, add a name and the first date."). Empty = ready. The
 * server checks the same things again (admin D3's payload arm); this list only
 * keeps the buttons honest.
 */
export function createProblems(form: CreateForm, today: string): string[] {
  const problems: string[] = [];
  if (!form.name.trim()) problems.push('a name');
  if (!ISO_DATE.test(form.date)) problems.push(form.kind === 'party' ? 'the date' : 'the first date');
  else if (form.date < today) problems.push('a date from today on');
  if (!HHMM.test(form.startTime)) problems.push('a start time');
  if (form.endTime && !HHMM.test(form.endTime)) problems.push('an end time as hours and minutes');
  else if (form.endTime && form.endTime === form.startTime) problems.push('an end time different from the start');
  // An end before the start crosses midnight, so a typo (start 22:00, end 21:00) reads as
  // 23 hours; the server refuses a duration over 20 hours (default_duration_minutes).
  else if (form.endTime && HHMM.test(form.startTime) && (minutesBetween(form.startTime, form.endTime) ?? 0) > 20 * 60) {
    problems.push('an end time within 20 hours of the start');
  }
  if (form.ticketUrl.trim() && !isHttpUrl(form.ticketUrl)) problems.push('a ticket link starting with https://');
  if (form.coverImageUrl.trim() && !isHttpUrl(form.coverImageUrl)) problems.push('a picture link starting with https://');
  if (form.description.length > 4000) problems.push('a description under 4,000 characters');
  return problems;
}

/** "To continue, add a name and the first date." */
export function problemsSentence(problems: string[]): string | null {
  if (problems.length === 0) return null;
  const list = problems.length === 1 ? problems[0] : `${problems.slice(0, -1).join(', ')} and ${problems[problems.length - 1]}`;
  return `To continue, add ${list}.`;
}

/**
 * Why this organiser cannot take a new event yet (the server's
 * 'series.upsert (create) needs a live organiser'), or null when it can.
 */
export function createBlock(organiser: { name: string; lifecycle_status: string }): string | null {
  switch (organiser.lifecycle_status) {
    case 'live':
      return null;
    case 'draft':
      return `${organiser.name} is not public yet. Once the Bachata Calendar team approves it you can add events.`;
    case 'pending_review':
      return `The Bachata Calendar team is still checking ${organiser.name}, usually within a day. You can add events once it is approved.`;
    case 'rejected':
      return `${organiser.name} needs changes before it can be listed. Sort those out on your account page first.`;
    default:
      return `${organiser.name} cannot take new events right now. Ask the Bachata Calendar team.`;
  }
}

// ---- what is sent ---------------------------------------------------------------

export function createDraft(form: CreateForm): CreateDraft {
  return {
    ...formToDraft(form),
    category: KIND_CATEGORY[form.kind],
    format: KIND_FORMAT[form.kind],
    startDate: form.date,
  };
}

/**
 * The commands after the create lands, in order: the schedule (the party's
 * one date, or the class's weekly rule on the first date's weekday), then the
 * submit when asked. Each needs the version the previous one returned.
 */
export function followUpCommands(form: CreateForm, submit: boolean): OwnerCommand[] {
  const schedule = form.kind === 'party' ? addDateCommand(form.date) : weeklyRuleCommand(weekdayOf(form.date));
  return submit ? [schedule, submitForReviewCommand()] : [schedule];
}

// ---- the preview ----------------------------------------------------------------

export interface PreviewModel {
  title: string;
  /** "Every Tuesday, 19:00-21:30, first Tue 6 Oct" or "Sat 17 Oct, 20:00-00:00" (middle-dot separated, en-dash range). */
  when: string;
  where: string | null;
  level: string | null;
  by: string;
  description: string | null;
  coverImageUrl: string | null;
}

const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVEL_OPTIONS.map((o) => [o.value, o.label]));

/** Public-page wording for the form as it stands; blanks read as the page would without them. */
export function previewModel(form: CreateForm, venueName: string | null, organiserName: string, today: string): PreviewModel {
  const hasDate = ISO_DATE.test(form.date);
  const start = HHMM.test(form.startTime) ? form.startTime : null;
  const time = start ? (HHMM.test(form.endTime) ? `${start}\u2013${form.endTime}` : start) : null;
  const parts: string[] = [];
  if (form.kind === 'weekly_class') {
    parts.push(hasDate ? `Every ${WEEKDAY_LONG[weekdayOf(form.date)]}` : 'Every week');
    if (time) parts.push(time);
    // dateLabel says "Tonight" for today, which cannot follow "first".
    if (hasDate) parts.push(form.date === today ? 'first class tonight' : `first ${dateLabel(form.date, today)}`);
  } else {
    parts.push(hasDate ? dateLabel(form.date, today) : 'Date to be confirmed');
    if (time) parts.push(time);
  }
  return {
    title: form.name.trim() || (form.kind === 'party' ? 'Your party' : 'Your weekly class'),
    when: parts.join(' \u00b7 '),
    where: venueName,
    level: form.level ? LEVEL_LABEL[form.level] ?? form.level : null,
    by: organiserName,
    description: form.description.trim() || null,
    coverImageUrl: isHttpUrl(form.coverImageUrl) ? form.coverImageUrl.trim() : null,
  };
}
