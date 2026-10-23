// ONE rule set for admin and Website (plan: "How one rule set works"). The facts
// live in event-rules.json (byte-identical in the admin repo); this file is the
// thin typed reader plus the pure functions every organiser screen asks. No React.
//
// Times are HH:MM London wall-clock strings. An end before its start means
// "next day" (a party that runs past midnight), up to the programme editor's one
// session cap. Sessions starting before the admin rollover hour (08:00,
// lib/programDayRollover) belong to the night before, but only on a night: a day
// with a session starting from the evening hour. HH:MM carries no date, so this is
// the admin rule read on one night, not a second rule.

import rules from './event-rules.json';
import { LIMITS } from './programmeModel';

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
  /** lifecycle_status; null for a series not created yet (treated as a draft). */
  status: string | null;
  /** The cover / flyer image URL (server codes no_flyer, cover). */
  flyer: string | null;
  venueId: string | null;
  payment: readonly string[];
  /** The earliest date, or null when the series has none. */
  firstDate: RuleDate | null;
  /** Festival only: every programme day; each needs a timed session (server no_session_first_date). */
  programmeDays?: readonly RuleDate[];
  /** London today, YYYY-MM-DD. */
  today: string;
}
export interface Blocker { code: BlockerCode; reason: string }
export interface Readiness {
  ready: boolean;
  label: string;
  blockers: Blocker[];
  /** Facts only the server checks (description: plan rule 11 says optional, the server still requires it). Screens always show the server check too. */
  serverOnlyBlockers: readonly string[];
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

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

/** The ONE session length cap, the programme editor's (12 h). C4 reads it from here. */
export const maxSessionMinutes: number = LIMITS.sessionMaxMinutes;

/** Valid when both are real times, the end differs from the start and the length is within the cap; an earlier end is the next day. */
export function validSessionPair(
  start: string | null | undefined,
  end: string | null | undefined,
  cap: number = maxSessionMinutes,
): { valid: boolean; nextDay: boolean } {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return { valid: false, nextDay: false };
  const length = e > s ? e - s : e + DAY - s;
  if (length > cap) return { valid: false, nextDay: false };
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
  const evening = toMinutes(rules.time.eveningFrom) ?? DAY;
  const hasEvening = timed.some((x) => x.s >= evening);
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
    if (hasOwn(known, code) && !out.includes(code as PaymentCode)) out.push(code as PaymentCode);
  }
  return out;
}

/** Known codes only, no repeats (the server refuses both). */
export const formatPaymentMethods = (codes: readonly string[]): string =>
  parsePaymentMethods(codes.join(rules.payment.separator)).join(rules.payment.separator);

// ---- formats ---------------------------------------------------------------

/** Rule 14 AS BUILT: owner create accepts one_off and recurring only; `formats` still lists all four for readiness. */
export const ownerCanCreate = (format: string | null | undefined): boolean =>
  typeof format === 'string' && rules.ownerCreateFormats.includes(format);

// ---- readiness -------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rule 10 + rule 3: everything that stops Publish, each with its 2-4 word reason. */
export function blockers(series: RuleSeries): Blocker[] {
  const out: Blocker[] = [];
  const add = (code: BlockerCode) => out.push({ code, reason: rules.blockers[code] });
  if (!series.name?.trim()) add('name');
  if (!series.format || !(rules.formats as string[]).includes(series.format)) add('format');
  if (!series.venueId) add('venue');
  if (!series.flyer?.trim()) add('flyer');
  // Before go-live the rules are the full ones; a live series is never turned "Not ready" by a
  // client-only rule (rule 28): prod holds 7 live festival sessions over 12 h, which the server allows.
  const preLive = rules.preLiveStatuses.includes(series.status ?? 'draft');
  const cap = preLive ? maxSessionMinutes : DAY;
  const first = series.firstDate;
  if (!first || !ISO_DAY.test(first.date)) add('date');
  else {
    if (first.date < series.today && preLive) add('dateInPast');
    if (first.sessions.length === 0) add('session');
    else if (first.sessions.some((x) => !validSessionPair(x.start, x.end, cap).valid)) add('sessionTimes');
  }
  const timed = (d: RuleDate) => d.sessions.some((x) => validSessionPair(x.start, x.end, cap).valid);
  if (series.format === 'festival' && (series.programmeDays ?? []).some((d) => !timed(d))) add('festivalDay');
  const allowed = paymentCodes(series.format);
  const chosen = series.payment.filter((c) => hasOwn(rules.payment.codes, c));
  if (chosen.length < rules.payment.atLeast) add('payment');
  else if (!chosen.every((c) => (allowed as string[]).includes(c))) add('paymentNotAllowed');
  return out;
}

export function readiness(series: RuleSeries): Readiness {
  const list = blockers(series);
  return {
    ready: list.length === 0,
    label: list.length === 0 ? rules.readiness.ready : rules.readiness.blocked,
    blockers: list,
    serverOnlyBlockers: rules.serverOnlyBlockers,
  };
}

export const cancelReasons: readonly string[] = rules.cancelReasons;
export const festivalDefaultHours = { start: rules.festival.defaultStart, end: rules.festival.defaultEnd } as const;
export const lookupMessages = rules.seriesLookup;
