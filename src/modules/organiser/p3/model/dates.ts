import { L } from './labels';
import type { CancelRule } from './cancel';
import type { IsoDate, P3Kind } from './types';

/**
 * THE rule set for one date's actions (C3 date sheet, W2b): which action an owner can
 * take on which kind x date state, and the reason when it is greyed. Pure. Mirrors the
 * prod handlers read 2026-10-27 (_cmd_occurrence_cancel/move_date/set_time/set_override,
 * _cmd_series_skip_date/unskip_date/add_date/remove_date and the dispatcher's owner
 * rules): a past date and an ended event are admin-only, a festival refuses set_time and
 * move_date (it takes occurrence.cancel like any date), and a break exists only on the weekly rule's own cadence. Remove is listed but
 * never sent: organisers never delete a date (owner answer 20, wave B0, pinned by
 * events/__tests__/moveNotRemove.matrix.test.ts), so it says to cancel instead.
 * Every action is listed; one that cannot work says why (never hidden).
 */

export type DateAction =
  | 'cancel' | 'cancelEvent' | 'bringBack' | 'move' | 'time' | 'resetTime'
  | 'details' | 'resetNormal' | 'skip' | 'unskip' | 'remove';

/** `skip` = a break (a tombstone in removed_dates, not a stored date). */
export type DateState = 'scheduled' | 'cancelled' | 'skip';

export interface DateFacts {
  date: IsoDate;
  state: DateState;
  /**
   * The series' own weekly rule makes this date (seriesModel.isRuleDate): only such a date can
   * be a break. With no stored rule, a weekly pattern read off the dates (repeatShape 'dates')
   * stands in. null = nothing weekly to measure against (monthly, dates I pick, or no rule and
   * dates that follow no pattern), so "off the usual day" does not apply.
   */
  ruleDate: boolean | null;
  /** The date starts at another time than the series (changeModel.hasOwnTime). */
  ownTime: boolean;
  /** The date has its own Where, About, Ticket link or photo. */
  ownDetails: boolean;
}

export interface SeriesFacts {
  kind: P3Kind;
  lifecycle: string;
  /** Scheduled dates from today on: the server's date cap counts these. */
  upcoming: number;
  /** canCancelOneOff for a one-off (null when the event is not live or hidden). */
  oneOff?: CancelRule | null;
  /**
   * false = no rule is stored (repeatShape 'dates' / 'loose'). The server's unskip then has no
   * cadence to guard (_cmd_series_unskip_date_p5 falls open on a NULL rule), so every break can
   * come back. Absent = a rule is stored.
   */
  ruleSaved?: boolean;
}

export interface DateRow {
  action: DateAction;
  title: string;
  sub: string;
  /** Why it cannot be done now; null = it can. */
  reason: string | null;
  danger?: boolean;
}

/** The server's date cap (_cmd_series_add_date_p5 and the restore arm of _cmd_occurrence_cancel_p5). */
export const DATE_CAP = 30;

export const DATE_WHY = {
  past: 'This date has already happened, so it can\u2019t be changed.',
  closed: 'This event has finished, so its dates can\u2019t change here. Ask the Bachata Calendar team.',
  cancelledFirst: 'This date is cancelled. Bring it back first.',
  festivalTime: 'Festival times are set for the whole festival, not one date. Ask the Bachata Calendar team.',
  festivalMove: 'Festival days are set by the Bachata Calendar team. Ask them to move a day.',
  festivalOne: 'A festival holds one date. Ask the Bachata Calendar team to change its days.',
  oneOffNoBreak: 'A one-off has one date, so it has no break weeks. Cancel the event instead.',
  noPattern: 'Only a weekly pattern has break weeks. Cancel this date instead, so dancers see why.',
  noDatesPattern: 'No pattern is saved and its dates don\u2019t follow a weekly one, so it has no break weeks. Cancel this date instead, so dancers see why.',
  offRule: 'This date was added or moved, so it is not part of the weekly pattern and can\u2019t be a break. Cancel it instead.',
  unskipOffRule: 'The weekly pattern changed since this break, so it can\u2019t come back as a break. Add it as a date instead.',
  oneOffRemove: 'A one-off keeps its one date. Move it to another day, or cancel the event.',
  noDelete: 'Dates are never deleted here, so dancers who saved one can see what happened. Cancel it instead.',
  oneOffAdd: 'A one-off has one date. Move it, or make a new event for another night.',
  cap: `No date can be added or brought back while ${DATE_CAP} or more dates are coming up. Cancel or remove one first.`,
  notLive: 'It isn\u2019t on the calendar yet, so there is nothing to cancel.',
} as const;

const CLOSED = new Set(['ended', 'archived']);

function row(action: DateAction, reason: string | null): DateRow {
  const words = L.dateAct[action];
  return { action, title: words[0], sub: words[1], reason, ...(action === 'cancel' || action === 'cancelEvent' || action === 'remove' ? { danger: true } : {}) };
}

/** The date's actions in C3 order. A break offers only "Put this week back". */
export function dateActions(s: SeriesFacts, d: DateFacts, today: IsoDate): DateRow[] {
  const closed = CLOSED.has(s.lifecycle) ? DATE_WHY.closed : null;
  const past = d.date < today ? DATE_WHY.past : null;
  const base = closed ?? past;
  const fest = s.kind === 'festival';
  const oneoff = s.kind === 'oneoff';

  // unskip delegates to _cmd_series_add_date_p5, so the date cap refuses it like Add.
  // A break off a STORED rule's cadence is refused by the server; null = cannot judge here, so the server's guard decides.
  const offRule = s.ruleSaved !== false && d.ruleDate === false;
  if (d.state === 'skip') return [row('unskip', base ?? (offRule ? DATE_WHY.unskipOffRule : s.upcoming >= DATE_CAP ? DATE_WHY.cap : null))];

  const cancelled = d.state === 'cancelled';
  const onFirst = cancelled ? DATE_WHY.cancelledFirst : null;
  const out: DateRow[] = [];

  if (cancelled) out.push(row('bringBack', base ?? (s.upcoming >= DATE_CAP ? DATE_WHY.cap : null)));
  else if (oneoff) out.push(row('cancelEvent', base ?? (s.oneOff === undefined || s.oneOff === null ? DATE_WHY.notLive : s.oneOff.reason)));
  else out.push(row('cancel', base));

  out.push(row('move', base ?? (fest ? DATE_WHY.festivalMove : onFirst)));
  // No programme time is no grey: D8 makes the date its own time session. A date whose own
  // session set is empty is refused by the server (no_sessions_for_time_override, with copy).
  out.push(row('time', base ?? (fest ? DATE_WHY.festivalTime : onFirst)));
  if (d.ownTime) out.push(row('resetTime', base ?? (fest ? DATE_WHY.festivalTime : onFirst)));
  out.push(row('details', base ?? onFirst));
  if (d.ownDetails || d.ownTime) out.push(row('resetNormal', base));

  const skipWhy = oneoff ? DATE_WHY.oneOffNoBreak
    : fest ? DATE_WHY.festivalOne
    : s.kind === 'monthly' || s.kind === 'custom' ? DATE_WHY.noPattern
    : d.ruleDate === null ? (s.ruleSaved === false ? DATE_WHY.noDatesPattern : DATE_WHY.noPattern)
    : base ?? onFirst ?? (d.ruleDate ? null : DATE_WHY.offRule);
  out.push(row('skip', skipWhy));

  out.push(row('remove', oneoff ? DATE_WHY.oneOffRemove : DATE_WHY.noDelete));
  return out;
}

/** "Add a date" (series.add_date): null = it can be added now. */
export function addDateWhy(s: SeriesFacts): string | null {
  if (CLOSED.has(s.lifecycle)) return DATE_WHY.closed;
  if (s.kind === 'festival') return DATE_WHY.festivalOne;
  if (s.kind === 'oneoff') return DATE_WHY.oneOffAdd;
  if (s.upcoming >= DATE_CAP) return DATE_WHY.cap;
  return null;
}

/** What a picked day for "Move" or "Add" is wrong with; null = it can be sent. */
export function pickDayProblem(day: string, today: IsoDate, taken: ReadonlySet<string>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return L.datePick.choose;
  if (day < today) return L.datePick.past;
  if (taken.has(day)) return L.datePick.taken;
  return null;
}

/**
 * THE tags a date shows, on the event page's Coming rows and on All dates alike (one
 * mapping). `own` = any own change: Where / About / Ticket / photo, sessions, or time.
 */
export function dateMarks(kind: P3Kind, d: DateFacts, extra: { today: IsoDate; hasOverride: boolean; sessionChanges: boolean }): { tags: string[]; own: boolean } {
  const tags: string[] = [];
  if (d.date < extra.today) tags.push(L.done);
  if (d.state === 'skip') return { tags: [...tags, L.skipped], own: false };
  if (d.state === 'cancelled') return { tags: [...tags, L.cancelled], own: false };
  const own = extra.hasOverride || extra.sessionChanges || d.ownTime;
  if (d.ownTime) tags.push(L.ownTime);
  else if (own) tags.push(L.ownChanges);
  if ((kind === 'weekly' || kind === 'course') && d.ruleDate === false) tags.push(L.notUsualDay);
  return { tags, own };
}
