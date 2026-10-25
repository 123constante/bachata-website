import { fullDate } from '../../shared/dateWords';
import { L, sessionKindLabel } from './labels';
import { byStart, endsNextDay, mins, timeWord } from './time';
import type { DaySession, ForwardChange, IsoDate, P3Date, P3Event, P3Person, P3Session, SessionFields } from './types';

/** Dates today or later, oldest first (C3 `upcoming`; the input order is not trusted). */
export function upcoming(e: Pick<P3Event, 'dates'>, today: IsoDate): P3Date[] {
  return e.dates.filter((x) => x.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Upcoming dates that will run: not cancelled, not a break. */
export function liveDates(e: Pick<P3Event, 'dates'>, today: IsoDate): P3Date[] {
  return upcoming(e, today).filter((x) => x.status !== 'cancelled' && x.status !== 'skip');
}

/** A session's forward changes, oldest `from` first, so the latest wins per field (CONTRACT A1). */
function forwardOf(s: P3Session): ForwardChange[] {
  return [...(s.forward ?? [])].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

function applyPatch(into: SessionFields, patch: Partial<SessionFields>) {
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) (into as unknown as Record<string, unknown>)[k] = v;
}

function fieldsOf(s: P3Session): SessionFields {
  return { kind: s.kind, title: s.title, start: s.start, end: s.end, endsNextDay: s.endsNextDay, room: s.room, levels: s.levels, people: s.people };
}

/**
 * ONE place that works out a date's programme (C3 `dsess`): each series session,
 * then its forward changes that started on or before this date (never on a one-off),
 * then this date's own change; "not running" is kept (struck), extra sessions are
 * added; by start. No date = the base sessions.
 */
export function daySessions(e: P3Event, x?: P3Date | null): DaySession[] {
  const out: DaySession[] = e.sessions.map((s) => {
    const m = fieldsOf(s);
    if (x && e.kind !== 'oneoff') for (const g of forwardOf(s)) if (g.from <= x.date) applyPatch(m, g.patch);
    const o = (x && x.changes && x.changes[s.id]) || null;
    if (o) {
      const { notRunning: _nr, ...patch } = o;
      applyPatch(m, patch);
    }
    return { ...m, id: s.id, base: s, notRunning: !!o?.notRunning, changed: !!o && !o.notRunning, extra: false };
  });
  for (const s of x?.extra ?? []) out.push({ ...fieldsOf(s), id: s.id, base: s, notRunning: false, changed: false, extra: true });
  return out.sort(byStart);
}

type Timed = Pick<SessionFields, 'start' | 'end' | 'endsNextDay'> & { notRunning?: boolean };

/**
 * First start, last end and whether it ends the next day, over the TIMED sessions that run.
 * null when none has a start; `end` null when none has an end.
 */
export function span(list: ReadonlyArray<Timed>): { start: string; end: string | null; nextDay: boolean } | null {
  const on = list.filter((s) => !s.notRunning && s.start);
  if (!on.length) return null;
  const start = [...on].sort(byStart)[0].start as string;
  let end: string | null = null;
  let best = -1;
  for (const s of on) {
    if (!s.end) continue;
    const v = endsNextDay(s) && mins(s.end) <= 24 * 60 ? mins(s.end) + 1440 : mins(s.end);
    if (v > best) { best = v; end = s.end; }
  }
  return { start, end, nextDay: on.some(endsNextDay) };
}

/** '8pm to 1am (ends the next day)', 'From 9pm', 'No time yet' or 'No sessions yet'. */
export function spanText(list: ReadonlyArray<Timed>): string {
  const p = span(list);
  if (!p) return list.some((s) => !s.notRunning) ? L.noTime : L.noSessions;
  if (!p.end) return L.fromTime(timeWord(p.start));
  return `${timeWord(p.start)} to ${timeWord(p.end)}${p.nextDay ? ` (${L.endsNextDay})` : ''}`;
}

type Phrased = Pick<SessionFields, 'kind' | 'start'> & { notRunning?: boolean };

export interface StartPhraseOptions {
  /** Shown when no session runs (default L.noSessions) or none has a time (default L.noTime). */
  fallback?: string;
  /** Long form names the party and the first session when they differ. */
  long?: boolean;
  /** With `today`, the sessions are read as they apply to the event's NEXT live date (daySessions). */
  event?: P3Event;
  today?: IsoDate;
}

/** Later forward time changes after `next`, as " (8:30pm from Friday 20 November)", each compared with the time before it. */
function laterTimes(e: P3Event, next: P3Date, today: IsoDate): string {
  if (e.kind === 'oneoff') return '';
  const byDay = new Map<IsoDate, string[]>();
  for (const s of e.sessions) {
    let cur = s.start;
    for (const g of forwardOf(s)) {
      if (!g.patch.start) continue;
      if (g.from > next.date && g.patch.start !== cur) byDay.set(g.from, [...(byDay.get(g.from) ?? []), timeWord(g.patch.start)]);
      cur = g.patch.start;
    }
  }
  return [...byDay.keys()].sort().map((d) => ` (${[...new Set(byDay.get(d))].join(', ')} from ${fullDate(d, today)})`).join('');
}

/**
 * ONE start-time phrase, derived from the sessions (never a stored string; C3 M1/W1).
 * short: the earliest start ("8:30pm"). long: "Party 9pm, class from 8pm", and a later
 * forward time change is named: "Party 9pm, class from 8pm (8:30pm from Friday 20 November)".
 * With `event` + `today`, `list` is ignored and the next live date's sessions are read.
 */
export function startPhrase(list: ReadonlyArray<Phrased>, opts: StartPhraseOptions = {}): string {
  const { fallback, long = false, event, today } = opts;
  let later = '';
  let read: ReadonlyArray<Phrased> = list;
  if (event && today) {
    const nd = liveDates(event, today)[0];
    if (nd) {
      read = daySessions(event, nd);
      if (long) later = laterTimes(event, nd, today);
    }
  }
  const running = read.filter((m) => !m.notRunning);
  if (!running.length) return fallback ?? L.noSessions;
  const srt = running.filter((m) => m.start).sort(byStart) as Array<Phrased & { start: string }>;
  if (!srt.length) return fallback ?? L.noTime;
  const first = srt[0];
  const main = srt.find((m) => m.kind === 'party');
  if (!long || !main || main.start === first.start) return timeWord(first.start) + later;
  return `${sessionKindLabel(main.kind)} ${timeWord(main.start)}, ${sessionKindLabel(first.kind).toLowerCase()} from ${timeWord(first.start)}${later}`;
}

/**
 * Everyone on the event: every-date sessions, plus people set on dates still to come
 * (C3 `cast`). One entry per person AND role, so a teacher who also DJs keeps both.
 */
export function cast(e: P3Event, today: IsoDate): P3Person[] {
  const seen = new Set<string>();
  const out: P3Person[] = [];
  const add = (p: P3Person) => { const k = `${p.role}|${p.name}`; if (!seen.has(k)) { seen.add(k); out.push(p); } };
  for (const s of e.sessions) s.people.forEach(add);
  for (const x of upcoming(e, today)) {
    if (x.status === 'cancelled' || x.status === 'skip') continue;
    for (const m of daySessions(e, x)) if (!m.notRunning) m.people.forEach(add);
  }
  return out;
}

/** ONE class count: cancelled dates and breaks are not classes. Never read course_total_sessions. */
export function classCount(e: Pick<P3Event, 'dates'>): number {
  return e.dates.filter((x) => x.status !== 'cancelled' && x.status !== 'skip').length;
}

/** A session's name, or "No name yet" for a blank one (239 prod items have no title). */
export function sessionTitle(s: Pick<SessionFields, 'title'>): string {
  return s.title?.trim() || L.noName;
}
