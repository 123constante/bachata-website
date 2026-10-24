// ONE rule set for admin and Website (plan: "How one rule set works"). The facts
// live in event-rules.json (byte-identical in the admin repo); this file is the
// thin typed reader plus the pure functions every organiser screen asks. No React.
//
// Times are HH:MM London wall-clock strings. An end at or before its start means
// "next day" (a party that runs past midnight); sessions starting before the
// rollover hour on a day that also has later sessions belong to the night before
// (the same idea as lib/programDayRollover).

import rules from './event-rules.json';

export const EVENT_RULES = rules;

export type SessionKind = keyof typeof rules.sessionKinds;
export type PaymentCode = keyof typeof rules.payment.codes;
export type BlockerCode = keyof typeof rules.blockers;

export interface RuleSession {
  kind?: string | null;
  start: string | null;
  end: string | null;
}
export interface RuleDate {
  /** YYYY-MM-DD */
  date: string;
  sessions: RuleSession[];
}
/** What the rules need to know about a series; screens map their own model onto this. */
export interface RuleSeries {
  name: string | null;
  format: string | null;
  venueId: string | null;
  payment: readonly string[];
  /** The earliest date, or null when the series has none. */
  firstDate: RuleDate | null;
  /** London today, YYYY-MM-DD. */
  today: string;
}
export interface Blocker { code: BlockerCode; reason: string }
export interface Readiness { ready: boolean; label: string; blockers: Blocker[] }

// ---- times ---------------------------------------------------------------

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = rules.time.minutesPerDay;

/** Minutes since midnight, or null when not a valid HH:MM. */
export function toMinutes(t: string | null | undefined): number | null {
  const m = typeof t === 'string' ? HHMM.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function toHHMM(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Valid when both are real times and the end differs from the start; an earlier end is the next day. */
export function validSessionPair(start: string | null | undefined, end: string | null | undefined): { valid: boolean; nextDay: boolean } {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return { valid: false, nextDay: false };
  return { valid: true, nextDay: e < s };
}

interface Span { start: number; end: number }

/** Each timed session as an absolute span within the night; after-midnight starts roll to the night before. */
function spans(sessions: readonly RuleSession[]): Span[] {
  const timed = sessions.flatMap((x) => {
    const s = toMinutes(x.start);
    const e = toMinutes(x.end);
    return s === null || e === null || s === e ? [] : [{ s, e }];
  });
  const cut = toMinutes(rules.time.rolloverBefore) ?? 0;
  const hasEvening = timed.some((x) => x.s >= cut);
  return timed.map(({ s, e }) => {
    const offset = hasEvening && s < cut ? DAY : 0;
    return { start: s + offset, end: e + offset + (e < s ? DAY : 0) };
  });
}

/** Rule 1: the start of an event is its earliest session start; null when there is none. */
export function startFromSessions(sessions: readonly RuleSession[]): string | null {
  const all = spans(sessions);
  return all.length ? toHHMM(Math.min(...all.map((x) => x.start))) : null;
}

/** Rule 1: the end is the latest session end; null when there is none. */
export function endFromSessions(sessions: readonly RuleSession[]): string | null {
  const all = spans(sessions);
  return all.length ? toHHMM(Math.max(...all.map((x) => x.end))) : null;
}

// ---- session kinds ---------------------------------------------------------

export interface SessionKindRules {
  kind: SessionKind;
  label: string;
  storedType: string;
  section: string;
  /** Level is asked only on Class + Masterclass (admin rule). */
  levelAllowed: boolean;
  /** Quick lengths (45 min, 1 h ...) instead of a bare end list. */
  quickLengths: readonly number[] | null;
  lineupLabel: string;
}

export const sessionKinds = Object.keys(rules.sessionKinds) as SessionKind[];

export function sessionKindRules(kind: string): SessionKindRules | null {
  const k = (rules.sessionKinds as Record<string, (typeof rules.sessionKinds)['class']>)[kind];
  if (!k) return null;
  return {
    kind: kind as SessionKind,
    label: k.label,
    storedType: k.storedType,
    section: k.section,
    levelAllowed: k.level,
    quickLengths: k.lessonLengths ? rules.lessonLengths.minutes : null,
    lineupLabel: k.lineupLabel,
  };
}

// ---- payment ---------------------------------------------------------------

/** The payment choices a format offers; a festival takes the ticket link only. */
export function paymentCodes(format?: string | null): PaymentCode[] {
  const all = Object.keys(rules.payment.codes) as PaymentCode[];
  return format === 'festival' ? (rules.festival.payment as PaymentCode[]) : all;
}

/** payment_methods (comma list of codes) -> known codes, in the stored order, no repeats. */
export function parsePaymentMethods(stored: string | null | undefined): PaymentCode[] {
  const known = rules.payment.codes as Record<string, string>;
  const out: PaymentCode[] = [];
  for (const raw of (stored ?? '').split(rules.payment.separator)) {
    const code = raw.trim();
    if (code in known && !out.includes(code as PaymentCode)) out.push(code as PaymentCode);
  }
  return out;
}

export const formatPaymentMethods = (codes: readonly string[]): string => codes.join(rules.payment.separator);

// ---- readiness -------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rule 10 + rule 3: everything that stops Publish, each with its 2-4 word reason. */
export function blockers(series: RuleSeries): Blocker[] {
  const out: Blocker[] = [];
  const add = (code: BlockerCode) => out.push({ code, reason: rules.blockers[code] });
  if (!series.name?.trim()) add('name');
  if (!series.format || !(rules.formats as string[]).includes(series.format)) add('format');
  if (!series.venueId) add('venue');
  const first = series.firstDate;
  if (!first || !ISO_DAY.test(first.date)) add('date');
  else {
    if (first.date < series.today) add('dateInPast');
    if (first.sessions.length === 0) add('session');
    else if (first.sessions.some((x) => !validSessionPair(x.start, x.end).valid)) add('sessionTimes');
  }
  const allowed = paymentCodes(series.format);
  const chosen = series.payment.filter((c) => c in rules.payment.codes);
  if (chosen.length < rules.payment.atLeast) add('payment');
  else if (!chosen.every((c) => (allowed as string[]).includes(c))) add('paymentNotAllowed');
  return out;
}

export function readiness(series: RuleSeries): Readiness {
  const list = blockers(series);
  return { ready: list.length === 0, label: list.length === 0 ? rules.readiness.ready : rules.readiness.blocked, blockers: list };
}

export const cancelReasons: readonly string[] = rules.cancelReasons;
export const festivalDefaultHours = { start: rules.festival.defaultStart, end: rules.festival.defaultEnd } as const;
export const lookupMessages = rules.seriesLookup;
