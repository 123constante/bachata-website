import { commandErrorMessage, isNetworkFailure } from '../../shared/selfServeErrors';
import type { OwnerCommand } from '../../shared/seriesCommands';
import { fullDate, WEEKDAY_NAMES } from '../../shared/dateWords';
import { kindOf } from './kind';
import type { IsoDate } from './types';

/**
 * P3 W3c-1: the Repeat sheet's model (C3 Repeat screen, admin A2 R1, migration 20270306160000).
 * Pure: no React. ONE mapping says whether a series' rule can be edited here and why not
 * (repeatAccess); ONE builder turns the sheet's draft into the series.set_recurrence payload
 * the live owner rule (_owner_rule_problem_p5, read on prod 2026-10-28) accepts:
 *   weekly   1..7 different weekdays 0..6, interval 1..4
 *   monthly  day_of_month {day 1..31} | nth_weekday {nth, weekday} | multi_nth_weekday {nths, weekday}
 *   end      none | after_count 1..500 | until_date today..today + 24 months
 * The same payload with dry_run:true is the live preview (the handler rolls its writes back, the
 * dispatcher bumps no version). An untouched draft sends nothing.
 */

export type RepeatFreq = 'weekly' | 'monthly';
export type RepeatEnd = 'none' | 'after_count' | 'until_date';
export type MonthBy = 'day' | 'nth';

export interface RepeatDraft {
  freq: RepeatFreq;
  /** weekly: 0 = Sunday .. 6 = Saturday, sorted. */
  weekdays: number[];
  /** Every 1..4 weeks (weekly) or months (monthly). */
  interval: number;
  monthBy: MonthBy;
  /** monthly by day: 1..31. */
  day: number;
  /** monthly by weekday: 1..4 and -1 (last), sorted with last at the end. */
  nths: number[];
  /** monthly by weekday: 0..6. */
  weekday: number;
  end: RepeatEnd;
  /** after_count: 1..500 (NaN while the box is empty). */
  count: number;
  /** until_date: YYYY-MM-DD ('' until picked). */
  until: string;
}

export const REPEAT_MAX = { interval: 4, count: 500, months: 24 } as const;

/** One sentence per server failure code, each saying what to do (C3 Save errors, A3 R1). */
export const REPEAT_FAIL = {
  count_over_cap: `That makes more than ${REPEAT_MAX.count} dates. Pick a smaller number of times, or an earlier last date.`,
  interval_out_of_range: `It can repeat every 1 to ${REPEAT_MAX.interval} weeks or months. Pick a smaller gap under More options.`,
  until_too_far: 'The last date can be at most 2 years from today. Pick an earlier date, or choose Keeps going.',
  mode_not_allowed: 'That pattern can only be set by the Bachata Calendar team. Pick Every week or Every month, or ask us to set it.',
  course_needs_count: 'A course needs a set number of classes, so it cannot repeat without an end. Change its dates directly, or ask the Bachata Calendar team.',
  until_before_start: 'Pick a last date on or after the first date.',
  start_too_old: 'This event started more than a year ago, so a last date can\u2019t be set here. Choose Stops after a number of times, or ask the Bachata Calendar team.',
} as const;
export type RepeatFailCode = keyof typeof REPEAT_FAIL;

/**
 * The two end.date refusals apply_aggregate_write_p5 raises for series.set_recurrence (read on
 * prod 2026-10-28; dry runs too). Matched BEFORE the shared copy, whose set_recurrence line is
 * the R1 one-weekday screen's and points at a "first date" control this sheet has not got.
 */
const END_DATE_FAIL: Array<[RegExp, RepeatFailCode]> = [
  [/end\.date must not be before the start date/, 'until_before_start'],
  [/end\.date needs a start date no earlier than 12 months ago/, 'start_too_old'],
];

/** The sentence for a failed preview or save: the rule codes first, then the shared copy (version conflict, not permitted, offline). */
export function repeatFailure(error: unknown): string {
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : null;
  if (typeof message === 'string') {
    const hit = message.match(/invalid_recurrence_payload: (count_over_cap|interval_out_of_range|until_too_far|mode_not_allowed)/)
      ?? message.match(/invalid_transition: (course_needs_count)/);
    if (hit) return REPEAT_FAIL[hit[1] as RepeatFailCode];
    const end = END_DATE_FAIL.find(([re]) => re.test(message));
    if (end) return REPEAT_FAIL[end[1]];
  }
  return commandErrorMessage(error);
}

/** The sentence for a failed dry run: it saved nothing, so offline never reads like the save-offline line. */
export function previewFailure(error: unknown): string {
  return isNetworkFailure(error) ? REPEAT_COPY.previewOffline : repeatFailure(error);
}

// ---- what can be changed here, and why not --------------------------------------------

/**
 * edit: the editor works. disabled: the editor shows, greyed, with why (a course).
 * readonly: the current pattern shows with why (a pattern only the team sets, a closed event).
 * none: the event does not repeat (a one-off, a festival); why says what to do instead.
 */
export type RepeatAccess = { mode: 'edit'; why: null } | { mode: 'disabled' | 'readonly' | 'none'; why: string };

export const REPEAT_WHY = {
  ended: 'This has finished, so how it repeats can\u2019t change. To run it again, ask the Bachata Calendar team.',
  archived: 'This event was removed, so how it repeats can\u2019t change. Ask the Bachata Calendar team if it should come back.',
  review: 'The Bachata Calendar team is checking this event, so how it repeats can\u2019t change yet. Ask us if it is urgent.',
  course: 'A course runs a set number of classes, so its pattern can\u2019t change here. Change its dates directly instead: tap a date under Coming up to move or cancel it, or add a date.',
  custom: 'These are dates you pick, so there is no pattern to change. Tap a date under Coming up to change it, or add a date.',
  adminOnly: 'Only the Bachata Calendar team can change this pattern. Ask us to change it; you can still change single dates under Coming up.',
  oneoff: 'A one-off happens once, so it doesn\u2019t repeat, and it can\u2019t be turned into a repeating event here. For another night, add an event.',
  festival: 'A festival has its own days, so it doesn\u2019t repeat. Ask the Bachata Calendar team to change its days.',
} as const;

export interface RepeatFacts {
  format: string | null;
  lifecycle: string;
  rule: unknown;
}

const OPEN = new Set(['live', 'paused', 'draft']);

export function repeatAccess(f: RepeatFacts): RepeatAccess {
  const kind = kindOf(f.format, ruleModeOf(f.rule));
  if (f.lifecycle === 'ended') return { mode: 'readonly', why: REPEAT_WHY.ended };
  if (f.lifecycle === 'archived') return { mode: 'readonly', why: REPEAT_WHY.archived };
  if (!OPEN.has(f.lifecycle)) return { mode: 'readonly', why: REPEAT_WHY.review };
  if (kind === 'festival') return { mode: 'none', why: REPEAT_WHY.festival };
  if (kind === 'oneoff') return { mode: 'none', why: REPEAT_WHY.oneoff };
  if (kind === 'course') return { mode: 'disabled', why: REPEAT_WHY.course };
  if (kind === 'custom') return { mode: 'readonly', why: REPEAT_WHY.custom };
  if (f.rule != null && !draftOfRule(f.rule)) return { mode: 'readonly', why: REPEAT_WHY.adminOnly };
  return { mode: 'edit', why: null };
}

// ---- the stored rule <-> the draft ----------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const NTHS = [1, 2, 3, 4, -1];
const nthOrder = (a: number, b: number) => NTHS.indexOf(a) - NTHS.indexOf(b);

export const ruleModeOf = (rule: unknown): string | null => (isObj(rule) && typeof rule.mode === 'string' ? rule.mode : null);

/** A blank weekly draft (no rule stored yet): no day picked, so Save waits for one. */
export const blankDraft = (weekday: number): RepeatDraft => ({
  freq: 'weekly', weekdays: [], interval: 1, monthBy: 'nth', day: 1, nths: [1], weekday, end: 'none', count: 8, until: '',
});

/** The draft a stored rule opens as; null = a rule the owner path cannot write (custom, weekday_except_last, unknown). */
export function draftOfRule(rule: unknown, weekday = 5): RepeatDraft | null {
  if (!isObj(rule)) return null;
  const d = blankDraft(weekday);
  const interval = rule.interval === undefined ? 1 : int(rule.interval);
  if (interval === null) return null;
  d.interval = interval;
  const end = isObj(rule.end) ? rule.end : null;
  if (end?.kind === 'none') d.end = 'none';
  else if (end?.kind === 'after_count' && int(end.count) !== null) { d.end = 'after_count'; d.count = end.count as number; }
  else if (end?.kind === 'until_date' && typeof end.date === 'string') { d.end = 'until_date'; d.until = end.date; }
  else return null;
  if (rule.mode === 'weekly') {
    if (!Array.isArray(rule.weekdays) || !rule.weekdays.length || rule.weekdays.some((w) => int(w) === null || (w as number) < 0 || (w as number) > 6)) return null;
    d.weekdays = [...new Set(rule.weekdays as number[])].sort((a, b) => a - b);
    return d;
  }
  if (rule.mode !== 'monthly' || !isObj(rule.monthly)) return null;
  const m = rule.monthly;
  d.freq = 'monthly';
  if (m.kind === 'day_of_month' && int(m.day) !== null) { d.monthBy = 'day'; d.day = m.day as number; return d; }
  const wd = int(m.weekday);
  if (wd === null || wd < 0 || wd > 6) return null;
  d.weekday = wd;
  if (m.kind === 'nth_weekday' && int(m.nth) !== null) { d.monthBy = 'nth'; d.nths = [m.nth as number]; return d; }
  if (m.kind === 'multi_nth_weekday' && Array.isArray(m.nths) && m.nths.length && m.nths.every((n) => int(n) !== null)) {
    d.monthBy = 'nth';
    d.nths = [...new Set(m.nths as number[])].sort(nthOrder);
    return d;
  }
  return null;
}

/** What the draft means, field by field that matters (what "untouched" is measured on). */
export function draftSig(d: RepeatDraft): string {
  const what = d.freq === 'weekly'
    ? { f: 'w', w: [...d.weekdays].sort((a, b) => a - b) }
    : d.monthBy === 'day' ? { f: 'md', day: d.day } : { f: 'mn', n: [...d.nths].sort(nthOrder), wd: d.weekday };
  const end = d.end === 'after_count' ? { e: 'c', c: d.count } : d.end === 'until_date' ? { e: 'u', u: d.until } : { e: 'n' };
  return JSON.stringify({ ...what, i: d.interval, ...end });
}

/** The series.set_recurrence payload (the rule only; dry_run is added by previewCommand). */
export function rulePayload(d: RepeatDraft): Obj {
  const end = d.end === 'after_count' ? { kind: 'after_count', count: d.count }
    : d.end === 'until_date' ? { kind: 'until_date', date: d.until } : { kind: 'none' };
  if (d.freq === 'weekly') return { mode: 'weekly', interval: d.interval, weekdays: [...d.weekdays].sort((a, b) => a - b), end };
  const monthly = d.monthBy === 'day' ? { kind: 'day_of_month', day: d.day }
    : d.nths.length === 1 ? { kind: 'nth_weekday', nth: d.nths[0], weekday: d.weekday }
      : { kind: 'multi_nth_weekday', nths: [...d.nths].sort(nthOrder), weekday: d.weekday };
  return { mode: 'monthly', interval: d.interval, monthly, end };
}

export const previewCommand = (d: RepeatDraft): OwnerCommand => ({ kind: 'series.set_recurrence', payload: { ...rulePayload(d), dry_run: true } });

/** today + n months, the day clamped to the month's last (Postgres `date + interval 'n months'`). */
export function addMonthsKey(key: IsoDate, n: number): IsoDate {
  const [y, m, d] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export const REPEAT_PROBLEM = {
  noDay: 'Pick at least one day.',
  noWeek: 'Pick at least one week of the month.',
  badDay: 'Pick a day of the month from 1 to 31.',
  count: `Enter how many times, from 1 to ${REPEAT_MAX.count}.`,
  noUntil: 'Pick the last date.',
  pastUntil: 'Pick a last date from today on.',
} as const;

/**
 * What stops this draft being sent, as one sentence saying what to do; null = it can be sent.
 * `start` is the series' first date, COALESCE(default_start_date, created_at), when the
 * workspace carries it: a last date before it is refused by the server (repeatFailure).
 */
export function repeatProblem(d: RepeatDraft, today: IsoDate, start: IsoDate | null = null): string | null {
  if (d.freq === 'weekly' && !d.weekdays.length) return REPEAT_PROBLEM.noDay;
  if (d.freq === 'monthly' && d.monthBy === 'day' && !(Number.isInteger(d.day) && d.day >= 1 && d.day <= 31)) return REPEAT_PROBLEM.badDay;
  if (d.freq === 'monthly' && d.monthBy === 'nth' && !d.nths.length) return REPEAT_PROBLEM.noWeek;
  if (!(Number.isInteger(d.interval) && d.interval >= 1 && d.interval <= REPEAT_MAX.interval)) return REPEAT_FAIL.interval_out_of_range;
  if (d.end === 'after_count') {
    if (!(Number.isInteger(d.count) && d.count >= 1)) return REPEAT_PROBLEM.count;
    if (d.count > REPEAT_MAX.count) return REPEAT_FAIL.count_over_cap;
  }
  if (d.end === 'until_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.until)) return REPEAT_PROBLEM.noUntil;
    if (d.until < today) return REPEAT_PROBLEM.pastUntil;
    if (start && d.until < start) return REPEAT_FAIL.until_before_start;
    if (d.until > addMonthsKey(today, REPEAT_MAX.months)) return REPEAT_FAIL.until_too_far;
  }
  return null;
}

/** The series' first date as the server reads it, COALESCE(default_start_date, created_at) (as isRuleDate). */
export const repeatStart = (s: { default_start_date: string | null; created_at: string | null }): IsoDate | null =>
  s.default_start_date ?? s.created_at?.slice(0, 10) ?? null;

/** What a save sends: nothing when the editor is not open here, nothing changed, or the draft has a problem. */
export function repeatPlan(access: RepeatAccess, base: RepeatDraft, draft: RepeatDraft, today: IsoDate, start: IsoDate | null = null): OwnerCommand[] {
  if (access.mode !== 'edit' || draftSig(base) === draftSig(draft) || repeatProblem(draft, today, start)) return [];
  return [{ kind: 'series.set_recurrence', payload: rulePayload(draft) }];
}

// ---- words ----------------------------------------------------------------------------

const NTH_WORD: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' };
export const NTH_CHOICES = NTHS.map((n) => ({ n, label: NTH_WORD[n][0].toUpperCase() + NTH_WORD[n].slice(1) }));
/** Monday first, as a week reads in the UK. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Every Friday", "Every 2 weeks on Monday and Wednesday", "Every month on the first and third Saturday". */
export function patternWords(d: RepeatDraft): string {
  const unit = d.freq === 'weekly' ? 'week' : 'month';
  const every = d.interval === 1 ? `Every ${unit}` : `Every ${d.interval} ${unit}s`;
  if (d.freq === 'weekly') {
    const days = list(WEEK_ORDER.filter((w) => d.weekdays.includes(w)).map((w) => WEEKDAY_NAMES[w]));
    if (!days) return 'No day picked yet';
    return d.interval === 1 ? `Every ${days}` : `${every} on ${days}`;
  }
  if (d.monthBy === 'day') return `${every} on the ${ordinal(d.day)}`;
  return `${every} on the ${list([...d.nths].sort(nthOrder).map((n) => NTH_WORD[n]))} ${WEEKDAY_NAMES[d.weekday]}`;
}

export function endWords(d: RepeatDraft, today: IsoDate): string {
  if (d.end === 'after_count') return `stops after ${plural(d.count, 'time', 'times')}`;
  if (d.end === 'until_date') return /^\d{4}-\d{2}-\d{2}$/.test(d.until) ? `last date ${fullDate(d.until, today)}` : 'last date not picked yet';
  return 'keeps going';
}

/** The one-sentence summary (C3): "Every Friday, keeps going." */
export const repeatSentence = (d: RepeatDraft, today: IsoDate): string => `${patternWords(d)}, ${endWords(d, today)}.`;

/** The stored rule in words, for a pattern the editor cannot open (read-only sheets and the Repeats row). */
export function storedRuleWords(rule: unknown, today: IsoDate): string {
  const d = draftOfRule(rule);
  if (d) return repeatSentence(d, today);
  if (!isObj(rule)) return 'Doesn\u2019t repeat';
  if (rule.mode === 'custom') return 'Dates you pick';
  const m = isObj(rule.monthly) ? rule.monthly : null;
  const wd = int(m?.weekday);
  if (rule.mode === 'monthly' && m?.kind === 'weekday_except_last' && wd !== null && wd >= 0 && wd <= 6) {
    return `Every ${WEEKDAY_NAMES[wd]} except the last one of the month.`;
  }
  return 'A pattern set by the Bachata Calendar team.';
}

// ---- how it repeats, for every screen (event page Repeats row, Repeat sheet, Skip) --------

/**
 * A weekly pattern read off the stored dates, for a recurring series with NO stored rule (prod
 * 2026-10-30: 9 live and 13 ended `recurring` series, every one a legacy import; the rule is only
 * written by series.set_recurrence). Read-only: nothing is saved. Clear means: 3+ dates on one
 * weekday, every gap a whole number of the smallest gap (1..4 weeks), and at least half the gaps
 * that small. A series whose dates are weeks apart at random says nothing.
 */
export interface DatesPattern { weekday: number; interval: number; first: IsoDate }

const dayNo = (k: IsoDate) => {
  const [y, m, d] = k.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};

export function patternOfDates(dates: ReadonlyArray<IsoDate>): DatesPattern | null {
  const ds = [...new Set(dates)].sort();
  if (ds.length < 3) return null;
  const ns = ds.map(dayNo);
  const gaps = ns.slice(1).map((n, i) => n - ns[i]);
  const step = Math.min(...gaps);
  if (step % 7 !== 0 || step > 7 * REPEAT_MAX.interval || gaps.some((g) => g % step !== 0)) return null;
  if (gaps.filter((g) => g === step).length * 2 < gaps.length) return null;
  return { weekday: defaultWeekday(ds[0]), interval: step / 7, first: ds[0] };
}

/** Whether a date falls on a dates pattern's cadence (Skip / Not usual day judge it as a rule date). */
export const onPatternCadence = (p: DatesPattern, date: IsoDate): boolean =>
  date >= p.first && (dayNo(date) - dayNo(p.first)) % (7 * p.interval) === 0;

/**
 * THE shape of how a series repeats. rule: a stored rule. dates: no rule, a weekly pattern read off
 * the dates. loose: no rule and the dates say nothing (never "doesn't repeat": it is a recurring
 * series). once: a one-off or a festival, which truly does not repeat.
 */
export type RepeatShape =
  | { from: 'rule'; rule: unknown }
  | { from: 'dates'; pattern: DatesPattern }
  | { from: 'loose' }
  | { from: 'once' };

/** `dates` = every stored date (cancelled too) and every break (removed_dates). */
export function repeatShape(f: { format: string | null; rule: unknown; dates: ReadonlyArray<IsoDate> }): RepeatShape {
  if (f.rule != null) return { from: 'rule', rule: f.rule };
  const kind = kindOf(f.format, null);
  if (kind === 'oneoff' || kind === 'festival') return { from: 'once' };
  const pattern = patternOfDates(f.dates);
  return pattern ? { from: 'dates', pattern } : { from: 'loose' };
}

const datesWords = (p: DatesPattern) =>
  patternWords({ ...blankDraft(p.weekday), weekdays: [p.weekday], interval: p.interval });

export const REPEAT_SHAPE_COPY = {
  once: 'Doesn\u2019t repeat',
  dates: (p: DatesPattern) => `${datesWords(p)}, going by its dates. No pattern is saved.`,
  loose: 'No pattern is saved, so each date is set on its own.',
  /** The Repeat sheet's note above the editor when nothing is saved yet. */
  noteDates: (p: DatesPattern) => `No pattern is saved; its dates run ${datesWords(p).replace(/^Every/, 'every')}. Pick the days to save it as a pattern.`,
  noteLoose: 'No pattern is saved, so each date is set on its own. Pick the days to save a pattern, or change single dates under Coming up.',
} as const;

/** How it repeats in words: the Repeats row and the read-only Repeat sheet alike. */
export function repeatWords(shape: RepeatShape, today: IsoDate): string {
  if (shape.from === 'rule') return storedRuleWords(shape.rule, today);
  if (shape.from === 'dates') return REPEAT_SHAPE_COPY.dates(shape.pattern);
  return shape.from === 'loose' ? REPEAT_SHAPE_COPY.loose : REPEAT_SHAPE_COPY.once;
}

/** The editable sheet's note when no rule is stored; null when a rule is. */
export function noRuleNote(shape: RepeatShape): string | null {
  if (shape.from === 'dates') return REPEAT_SHAPE_COPY.noteDates(shape.pattern);
  if (shape.from === 'loose') return REPEAT_SHAPE_COPY.noteLoose;
  return shape.from === 'once' ? REPEAT_COPY.noRule : null;
}

// ---- the dry-run preview ----------------------------------------------------------------

export interface RepeatPreview {
  next: IsoDate[];
  added: number;
  removed: number;
  cancelledBooked: number;
  keeps: number;
  /** The owner date cap (30 upcoming): how many dates the nightly top-up still owes; null when not capped. */
  heldBack: number | null;
  cap: number | null;
}

const dates = (v: unknown): IsoDate[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** series.set_recurrence's dry-run answer (CommandResponse.data); a missing key reads as none. */
export function parsePreview(raw: unknown): RepeatPreview {
  const r = isObj(raw) ? raw : {};
  const cap = isObj(r.date_cap) ? r.date_cap : null;
  return {
    next: dates(r.next_8).slice(0, 8),
    added: dates(r.will_add).length,
    removed: dates(r.will_remove).length,
    cancelledBooked: dates(r.will_cancel_booked).length,
    keeps: dates(r.keeps_own_changes).length,
    heldBack: cap && int(cap.held_back) !== null ? (cap.held_back as number) : null,
    cap: cap && int(cap.cap) !== null ? (cap.cap as number) : null,
  };
}

export interface PreviewLine {
  key: 'added' | 'removed' | 'booked' | 'keeps' | 'cap' | 'same';
  tone: 'note' | 'danger';
  text: string;
}

export function previewLines(p: RepeatPreview): PreviewLine[] {
  const out: PreviewLine[] = [];
  if (p.added) out.push({ key: 'added', tone: 'note', text: `${plural(p.added, 'date', 'dates')} added.` });
  if (p.removed) out.push({ key: 'removed', tone: 'danger', text: `This removes ${plural(p.removed, 'date', 'dates')} already on the calendar.` });
  if (p.cancelledBooked) {
    out.push({ key: 'booked', tone: 'danger', text: p.cancelledBooked === 1
      ? '1 date has bookings, so it is cancelled instead of removed.'
      : `${p.cancelledBooked} dates have bookings, so they are cancelled instead of removed.` });
  }
  if (p.keeps) out.push({ key: 'keeps', tone: 'note', text: p.keeps === 1 ? '1 date keeps its own changes.' : `${p.keeps} dates keep their own changes.` });
  if (p.heldBack && p.cap) out.push({ key: 'cap', tone: 'note', text: `Only the next ${p.cap} dates are listed now. The other ${p.heldBack} are added as those pass.` });
  if (!p.added && !p.removed && !p.cancelledBooked) out.push({ key: 'same', tone: 'note', text: 'No dates are added or removed.' });
  return out;
}

/** The sheet's own words (RepeatSheet.tsx). */
export const REPEAT_COPY = {
  title: 'Repeat',
  checking: 'Checking which dates change\u2026',
  save: 'Save the new pattern',
  nothing: 'Nothing changed yet',
  cantHere: 'Can\u2019t change here',
  previewNeeded: 'The dates could not be checked yet. Tap Check again, then save.',
  previewOffline: 'Your phone seems to be offline, so the dates could not be checked. Check your connection, then tap Check again.',
  saved: 'Saved. The dates follow the new pattern.',
  next: 'The next dates',
  undo: 'Undo my changes',
  retry: 'Check again',
  noRule: 'It doesn\u2019t repeat yet. Pick the days to make it repeat.',
} as const;

export const PREVIEW_EMPTY = 'No dates are coming up with this pattern. Pick other days, or a later last date.';

// ---- a course: class n of N and the last class (workspace meta.class_count / last_class_date) --------

export interface CourseFacts {
  classCount: number;
  lastClassDate: IsoDate | null;
  /** The next class from today: its number and date; null when none is coming. */
  next: { n: number; date: IsoDate } | null;
}

export function courseFacts(
  ws: { classCount: number | null; lastClassDate: string | null; dates: ReadonlyArray<{ occurrence_date: string; lifecycle_status: string }>; series: { removed_dates: string[] } },
  today: IsoDate,
): CourseFacts {
  const breaks = new Set(ws.series.removed_dates);
  const running = ws.dates.filter((x) => x.lifecycle_status !== 'cancelled' && !breaks.has(x.occurrence_date)).map((x) => x.occurrence_date).sort();
  const i = running.findIndex((x) => x >= today);
  return {
    classCount: ws.classCount ?? running.length,
    lastClassDate: ws.lastClassDate ?? running[running.length - 1] ?? null,
    next: i < 0 ? null : { n: i + 1, date: running[i] },
  };
}

export function courseLine(c: CourseFacts, today: IsoDate): string {
  const last = c.lastClassDate ? ` Last class ${fullDate(c.lastClassDate, today)}.` : '';
  if (!c.next) return `${plural(c.classCount, 'class', 'classes')}, none still to come.${last}`;
  return `Class ${c.next.n} of ${c.classCount} is next, ${fullDate(c.next.date, today)}.${last}`;
}

/** The weekday a blank draft offers: the next coming date's, else Friday. */
export function defaultWeekday(next: IsoDate | null): number {
  if (!next) return 5;
  const [y, m, d] = next.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
