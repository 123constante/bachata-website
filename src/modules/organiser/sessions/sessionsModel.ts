// Session editor model (ER-C4). Pure: no React, no network. The rules (kinds,
// quick lengths, level, wrap past midnight) come from shared/eventRules.ts; this
// file only shapes a draft session and the lists a picker offers.

import rules from '../shared/event-rules.json';
import {
  endFromSessions,
  sessionKindRules,
  sessionKinds,
  startFromSessions,
  toHHMM,
  toMinutes,
  validSessionPair,
  type RuleSession,
  type SessionKind,
} from '../shared/eventRules';
import { LEVEL_KEYS, type LevelKey } from '../shared/programmeModel';

export { LEVEL_KEYS, type LevelKey };

export interface SessionPerson { id: string; name: string }

export interface SessionDraft {
  id: string;
  kind: SessionKind;
  name: string;
  /** HH:MM */
  start: string;
  /** HH:MM; earlier than start means the next day. */
  end: string;
  /** The lesson "Other" button was pressed: show the bare end list. */
  otherLength: boolean;
  levels: LevelKey[];
  room: string;
  /** "+ Add a room" was pressed on this session. */
  showRoom: boolean;
  people: SessionPerson[];
}

export interface TimeOption { value: string; label: string; nextDay: boolean }
export interface QuickLength { minutes: number; label: string }
export interface SessionIssue { code: 'name' | 'end' | 'level'; reason: string }

const STEP = 15;
const DAY = rules.time.minutesPerDay;
/** How far past its start a session may end in the picker (matches the prototype). */
export const MAX_SESSION_MINUTES = 600;
/** The most sessions one list holds (a live festival has up to 14). */
export const MAX_SESSIONS = 14;
export const RECENT_MAX = 3;
export const NEXT_DAY = 'next day';

export const kindLabel = (kind: SessionKind): string => sessionKindRules(kind)?.label ?? kind;
/** Rule 25: a new session of a kind is named after the kind. */
export const defaultName = kindLabel;
export const levelAllowed = (kind: SessionKind): boolean => sessionKindRules(kind)?.levelAllowed ?? false;
export const lineupLabel = (kind: SessionKind): string => sessionKindRules(kind)?.lineupLabel ?? 'Person';
export const quickLengthsFor = (kind: SessionKind): readonly number[] | null => sessionKindRules(kind)?.quickLengths ?? null;
export const isLessonKind = (kind: SessionKind): boolean => quickLengthsFor(kind) !== null;

export const kindOptions = (): { kind: SessionKind; label: string }[] => sessionKinds.map((kind) => ({ kind, label: kindLabel(kind) }));

/** 45 -> "45 min", 60 -> "1 h", 90 -> "1 h 30", 120 -> "2 h". */
export function lengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export const quickLengthOptions = (kind: SessionKind): QuickLength[] =>
  (quickLengthsFor(kind) ?? []).map((minutes) => ({ minutes, label: lengthLabel(minutes) }));

const mins = (t: string): number => toMinutes(t) ?? 0;

/** Minutes from start to end, wrapping past midnight; null when the pair is not valid. */
export function sessionLength(start: string, end: string): number | null {
  const { valid, nextDay } = validSessionPair(start, end);
  if (!valid) return null;
  return mins(end) - mins(start) + (nextDay ? DAY : 0);
}

export const endAfter = (start: string, minutes: number): string => toHHMM(mins(start) + minutes);

/** "20:00" -> option; a stored time off the 15-minute grid is kept so it still shows. */
const timeOption = (value: string, startedAt?: string): TimeOption => {
  const nextDay = startedAt !== undefined && validSessionPair(startedAt, value).nextDay;
  return { value, label: nextDay ? `${value} (${NEXT_DAY})` : value, nextDay };
};

/** Every quarter hour, from the rollover hour round the clock; keeps `keep` when it is off the grid. */
export function startOptions(keep?: string): TimeOption[] {
  const from = mins(rules.time.rolloverBefore);
  const out: string[] = [];
  for (let m = from; m < from + DAY; m += STEP) out.push(toHHMM(m));
  if (keep && toMinutes(keep) !== null && !out.includes(keep)) {
    out.push(keep);
    out.sort((a, b) => ((mins(a) - from + DAY) % DAY) - ((mins(b) - from + DAY) % DAY));
  }
  return out.map((v) => timeOption(v));
}

/** Only times AFTER the start (up to 10 h on); past midnight is marked "next day". The start itself is never offered. */
export function endOptions(start: string, keep?: string): TimeOption[] {
  if (toMinutes(start) === null) return [];
  const out: string[] = [];
  for (let m = STEP; m <= MAX_SESSION_MINUTES; m += STEP) out.push(endAfter(start, m));
  if (keep && validSessionPair(start, keep).valid && !out.includes(keep)) {
    const len = sessionLength(start, keep) ?? 0;
    if (len <= MAX_SESSION_MINUTES) {
      out.push(keep);
      out.sort((a, b) => (sessionLength(start, a) ?? 0) - (sessionLength(start, b) ?? 0));
    }
  }
  return out.map((v) => timeOption(v, start));
}

export const isValidEnd = (start: string, end: string): boolean => {
  const len = sessionLength(start, end);
  return len !== null && len <= MAX_SESSION_MINUTES;
};

let counter = 0;
export const newSessionId = (): string => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newSession(kind: SessionKind, start: string, id: string = newSessionId()): SessionDraft {
  const quick = quickLengthsFor(kind);
  const length = quick ? rules.lessonLengths.default : 120;
  return { id, kind, name: defaultName(kind), start, end: endAfter(start, length), otherLength: false, levels: [], room: '', showRoom: false, people: [] };
}

/** Switching kind: the name follows the kind only while it is still the old default; level drops off non-lesson kinds. */
export function setKind(s: SessionDraft, kind: SessionKind): SessionDraft {
  if (kind === s.kind) return s;
  const wasDefault = !s.name.trim() || s.name === defaultName(s.kind);
  const nowLesson = isLessonKind(kind);
  const lengthOk = quickLengthsFor(kind)?.includes(sessionLength(s.start, s.end) ?? -1) ?? false;
  return {
    ...s,
    kind,
    name: wasDefault ? defaultName(kind) : s.name,
    levels: levelAllowed(kind) ? s.levels : [],
    end: nowLesson && !isLessonKind(s.kind) ? endAfter(s.start, rules.lessonLengths.default) : s.end,
    otherLength: nowLesson ? (isLessonKind(s.kind) ? s.otherLength || !lengthOk : false) : false,
  };
}

/** Changing the start keeps the length, so the end can never fall before it. */
export function setStart(s: SessionDraft, start: string): SessionDraft {
  if (toMinutes(start) === null) return s;
  const length = sessionLength(s.start, s.end) ?? rules.lessonLengths.default;
  return { ...s, start, end: endAfter(start, Math.min(length, MAX_SESSION_MINUTES)) };
}

/** An impossible end (not after the start, or too far on) is ignored. */
export function setEnd(s: SessionDraft, end: string): SessionDraft {
  return isValidEnd(s.start, end) ? { ...s, end } : s;
}

export function setLength(s: SessionDraft, minutes: number): SessionDraft {
  return { ...s, end: endAfter(s.start, minutes), otherLength: false };
}

export const chooseOtherLength = (s: SessionDraft): SessionDraft => (isLessonKind(s.kind) ? { ...s, otherLength: true } : s);

/** True when the quick length `minutes` is the current one (and Other is not chosen). */
export const quickLengthSelected = (s: SessionDraft, minutes: number): boolean => !s.otherLength && sessionLength(s.start, s.end) === minutes;

/** Lesson kinds show quick lengths + a read-only end time until Other; every other kind shows the end list. */
export const showQuickLengths = (s: SessionDraft): boolean => isLessonKind(s.kind) && !s.otherLength;
export const otherLengthSelected = (s: SessionDraft): boolean =>
  isLessonKind(s.kind) && (s.otherLength || !(quickLengthsFor(s.kind) ?? []).includes(sessionLength(s.start, s.end) ?? -1));

export function toggleLevel(s: SessionDraft, level: LevelKey): SessionDraft {
  if (!levelAllowed(s.kind)) return s;
  return { ...s, levels: s.levels.includes(level) ? s.levels.filter((l) => l !== level) : LEVEL_KEYS.filter((l) => l === level || s.levels.includes(l)) };
}

// ---- room: hidden until needed, then shown on every session in the list --------------

export const roomVisible = (list: readonly SessionDraft[]): boolean => list.some((s) => s.showRoom || s.room.trim() !== '');
export const addRoom = (list: readonly SessionDraft[]): SessionDraft[] => list.map((s) => ({ ...s, showRoom: true }));
/** Remove clears the room from every session and hides the box again. */
export const removeRoom = (list: readonly SessionDraft[]): SessionDraft[] => list.map((s) => ({ ...s, room: '', showRoom: false }));
export const setRoom = (s: SessionDraft, room: string): SessionDraft => ({ ...s, room });

// ---- line-up --------------------------------------------------------------------------

export const addPerson = (s: SessionDraft, p: SessionPerson): SessionDraft =>
  s.people.some((x) => x.id === p.id) ? s : { ...s, people: [...s.people, p] };
export const removePerson = (s: SessionDraft, id: string): SessionDraft => ({ ...s, people: s.people.filter((p) => p.id !== id) });
/** Last RECENT_MAX people used, newest first, no repeats. */
export const pushRecent = (recent: readonly SessionPerson[], p: SessionPerson): SessionPerson[] =>
  [p, ...recent.filter((x) => x.id !== p.id)].slice(0, RECENT_MAX);
/** The Recent chips for one session: people not already on it. */
export const recentFor = (recent: readonly SessionPerson[], s: SessionDraft): SessionPerson[] =>
  recent.filter((p) => !s.people.some((x) => x.id === p.id));
/** Search hits minus people already on the session. */
export const hitsFor = (hits: readonly SessionPerson[], s: SessionDraft): SessionPerson[] =>
  hits.filter((p) => !s.people.some((x) => x.id === p.id));

// ---- the list ---------------------------------------------------------------------------

const rolloverCut = mins(rules.time.rolloverBefore);
/** Sort key: a start before the rollover hour belongs to the night before, so sorts last. */
const orderKey = (s: SessionDraft): number => (mins(s.start) < rolloverCut ? mins(s.start) + DAY : mins(s.start));

export const sortSessions = (list: readonly SessionDraft[]): SessionDraft[] =>
  list.map((s, i) => ({ s, i })).sort((a, b) => orderKey(a.s) - orderKey(b.s) || a.i - b.i).map((x) => x.s);

/** "Add another session" starts where the latest one ends; the same kind as it. */
export function addAnother(list: readonly SessionDraft[], max: number = MAX_SESSIONS, id?: string): SessionDraft[] {
  if (list.length >= max) return sortSessions(list);
  const last = list.length ? sortSessions(list)[list.length - 1] : null;
  const next = newSession(last?.kind ?? 'class', last?.end ?? '19:00', id);
  const room = roomVisible(list);
  return sortSessions([...list, { ...next, showRoom: room }]);
}

export const canAddAnother = (list: readonly SessionDraft[], max: number = MAX_SESSIONS): boolean => list.length < max;

export function removeSession(list: readonly SessionDraft[], id: string): SessionDraft[] {
  return list.length <= 1 ? [...list] : list.filter((s) => s.id !== id);
}

export const canRemoveSession = (list: readonly SessionDraft[]): boolean => list.length > 1;

export const toRuleSession = (s: SessionDraft): RuleSession => ({ kind: s.kind, start: s.start, end: s.end });

/** Why a session cannot be saved yet, each 2-4 words; empty when it can. */
export function sessionIssues(s: SessionDraft): SessionIssue[] {
  const out: SessionIssue[] = [];
  if (!s.name.trim()) out.push({ code: 'name', reason: 'Name needed' });
  if (!isValidEnd(s.start, s.end)) out.push({ code: 'end', reason: 'End after start' });
  if (levelAllowed(s.kind) && s.levels.length === 0) out.push({ code: 'level', reason: 'Pick a level' });
  return out;
}

export const listIssues = (list: readonly SessionDraft[]): SessionIssue[] => list.flatMap(sessionIssues);

/** "20:00 to 02:00 (next day)" across the list (rule 1), or null when no session has valid times. */
export function nightSpan(list: readonly SessionDraft[]): string | null {
  const rs = list.map(toRuleSession);
  const start = startFromSessions(rs);
  const end = endFromSessions(rs);
  if (!start || !end) return null;
  const wraps = mins(end) <= mins(start) || list.some((s) => validSessionPair(s.start, s.end).nextDay);
  return `${start} to ${end}${wraps ? ` (${NEXT_DAY})` : ''}`;
}

/** The people role the line-up search asks for. Only teaching and djing exist server-side; performer and judge use teaching. */
export const searchRole = (kind: SessionKind): 'teaching' | 'djing' => (kind === 'party' ? 'djing' : 'teaching');
