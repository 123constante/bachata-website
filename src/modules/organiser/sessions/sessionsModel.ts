// Session editor model (ER-C4). Pure: no React, no network. The rules (kinds,
// quick lengths, level, wrap past midnight) come from shared/eventRules.ts; this
// file only shapes a draft session and the lists a picker offers.

import rules from '../shared/event-rules.json';
import {
  endFromSessions,
  isUntimedSession,
  maxSessionMinutes,
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
  /** Loaded with no stored title: the kind's name fills the field, and it goes back as null unless edited. */
  titleWasNull?: boolean;
}

export interface TimeOption { value: string; label: string; nextDay: boolean }
export interface QuickLength { minutes: number; label: string }
/** `level` is no longer produced (level is optional, plan rule 11); kept so importers still compile. */
export interface SessionIssue { code: 'name' | 'start' | 'end' | 'long' | 'level'; reason: string }

/** One stored session row (event_series_program_item_p5 / the reader): times HH:MM:SS or null, room nullable. */
export interface StoredSessionRow {
  id: string;
  type: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  level_keys: string[] | null;
}

const STEP = 15;
const DAY = rules.time.minutesPerDay;
/** A new non-lesson session (party, showcase, competition) runs this long. */
const OTHER_DEFAULT_MINUTES = 120;
/** The ONE session-length cap: eventRules `maxSessionMinutes` (the writer's LIMITS, 12 h). */
export const MAX_SESSION_MINUTES: number = maxSessionMinutes;
/** Card reasons: the rules JSON wording for bad times; the JSON `name` is the EVENT's name, so a session's is here. */
export const SESSION_REASONS = {
  name: 'Name needed',
  start: 'Pick a start time',
  end: rules.blockers.sessionTimes,
  long: `Over ${MAX_SESSION_MINUTES / 60} hours`,
} as const;
export const PICK_START = 'Pick a start';
/** Start option for a session with no set time (owner decision 3: untimed is valid). */
export const NO_SET_TIME = 'No set time';
/** End placeholder when a start is set but no end is stored yet. */
export const PICK_END = 'Pick an end';
/** Why "Add another session" is disabled at the cap. */
export const capReason = (max: number): string => `${max} is the most`;
/** Why the only session's Remove is disabled. */
export const LAST_SESSION_REASON = 'One session needed';
/** The most sessions one list holds (a live festival has up to 14). */
export const MAX_SESSIONS = 14;
export const RECENT_MAX = 3;
export const NEXT_DAY = 'next day';

/** A legacy stored kind off the list (prod: one `show`) reads as a word: "show" -> "Show". Display only. */
const legacyLabel = (kind: string): string => {
  const words = kind.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : kind;
};
export const kindLabel = (kind: SessionKind): string => sessionKindRules(kind)?.label ?? legacyLabel(kind);
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

/** Start and end as a pair, ignoring the length cap (a stored over-cap length is still a pair). */
const pair = (start: string, end: string) => validSessionPair(start, end, DAY);

/** Minutes from start to end, wrapping past midnight; null when the pair is not valid. */
export function sessionLength(start: string, end: string): number | null {
  const { valid, nextDay } = pair(start, end);
  if (!valid) return null;
  return mins(end) - mins(start) + (nextDay ? DAY : 0);
}

export const endAfter = (start: string, minutes: number): string => toHHMM(mins(start) + minutes);

/** "20:00" -> option; a stored time off the 15-minute grid is kept so it still shows. */
const timeOption = (value: string, startedAt?: string): TimeOption => {
  const nextDay = startedAt !== undefined && pair(startedAt, value).nextDay;
  return { value, label: nextDay ? `${value} (${NEXT_DAY})` : value, nextDay };
};

/** "No set time" first (untimed is valid, and the way back to it), then every quarter hour from the rollover hour round the clock; keeps `keep` when it is off the grid. */
export function startOptions(keep?: string): TimeOption[] {
  const placeholder: TimeOption[] = [{ value: '', label: NO_SET_TIME, nextDay: false }];
  const from = mins(rules.time.rolloverBefore);
  const out: string[] = [];
  for (let m = from; m < from + DAY; m += STEP) out.push(toHHMM(m));
  if (keep && toMinutes(keep) !== null && !out.includes(keep)) {
    out.push(keep);
    out.sort((a, b) => ((mins(a) - from + DAY) % DAY) - ((mins(b) - from + DAY) % DAY));
  }
  return [...placeholder, ...out.map((v) => timeOption(v))];
}

/** Only times AFTER the start (up to the cap); past midnight is marked "next day". The start itself is never offered. A stored end past the cap stays listed (rule 28: no silent change). A start with no end (`keep` '') opens on "Pick an end". */
export function endOptions(start: string, keep?: string): TimeOption[] {
  if (toMinutes(start) === null) return [];
  const placeholder: TimeOption[] = keep === '' ? [{ value: '', label: PICK_END, nextDay: false }] : [];
  const out: string[] = [];
  for (let m = STEP; m <= MAX_SESSION_MINUTES; m += STEP) out.push(endAfter(start, m));
  if (keep && pair(start, keep).valid && !out.includes(keep)) {
    out.push(keep);
    out.sort((a, b) => (sessionLength(start, a) ?? 0) - (sessionLength(start, b) ?? 0));
  }
  return [...placeholder, ...out.map((v) => timeOption(v, start))];
}

export const isValidEnd = (start: string, end: string): boolean => {
  const len = sessionLength(start, end);
  return len !== null && len <= MAX_SESSION_MINUTES;
};

let counter = 0;
export const newSessionId = (): string => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

const defaultLength = (kind: SessionKind): number => (isLessonKind(kind) ? rules.lessonLengths.default : OTHER_DEFAULT_MINUTES);

export function newSession(kind: SessionKind, start: string, id: string = newSessionId()): SessionDraft {
  const length = defaultLength(kind);
  const timed = toMinutes(start) !== null;
  return { id, kind, name: defaultName(kind), start: timed ? start : '', end: timed ? endAfter(start, length) : '', otherLength: false, levels: [], room: '', showRoom: false, people: [] };
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
    end: nowLesson && !isLessonKind(s.kind) && toMinutes(s.start) !== null ? endAfter(s.start, rules.lessonLengths.default) : s.end,
    otherLength: nowLesson ? (isLessonKind(s.kind) ? s.otherLength || !lengthOk : false) : false,
  };
}

/** Changing the start keeps the length, so the end can never fall before it. "No set time" ('') clears start and end. */
export function setStart(s: SessionDraft, start: string): SessionDraft {
  if (start === '') return { ...s, start: '', end: '' };
  if (toMinutes(start) === null) return s;
  const length = sessionLength(s.start, s.end) ?? defaultLength(s.kind);
  return { ...s, start, end: endAfter(start, Math.min(length, MAX_SESSION_MINUTES)) };
}

/** An impossible end (not after the start, or too far on) is ignored. */
export function setEnd(s: SessionDraft, end: string): SessionDraft {
  return isValidEnd(s.start, end) ? { ...s, end } : s;
}

/** A quick length needs a start to count from; without one it waits. */
export function setLength(s: SessionDraft, minutes: number): SessionDraft {
  if (toMinutes(s.start) === null) return s;
  return { ...s, end: endAfter(s.start, minutes), otherLength: false };
}

export const chooseOtherLength = (s: SessionDraft): SessionDraft => (isLessonKind(s.kind) ? { ...s, otherLength: true } : s);

/** True when the quick length `minutes` is the current one (and Other is not chosen). */
export const quickLengthSelected = (s: SessionDraft, minutes: number): boolean => !s.otherLength && sessionLength(s.start, s.end) === minutes;

/** Lesson kinds show quick lengths + a read-only end time until Other (or a length off the list); every other kind shows the end list. */
export const showQuickLengths = (s: SessionDraft): boolean => isLessonKind(s.kind) && !otherLengthSelected(s);
export const otherLengthSelected = (s: SessionDraft): boolean =>
  isLessonKind(s.kind) && (s.otherLength || !(quickLengthsFor(s.kind) ?? []).includes(sessionLength(s.start, s.end) ?? -1));

export function toggleLevel(s: SessionDraft, level: LevelKey): SessionDraft {
  if (!levelAllowed(s.kind)) return s;
  if (s.levels.includes(level)) return { ...s, levels: s.levels.filter((l) => l !== level) };
  // A stored key off the list is kept as is (D1: stored values untouched).
  const known = (l: string) => (LEVEL_KEYS as readonly string[]).includes(l);
  return { ...s, levels: [...LEVEL_KEYS.filter((l) => l === level || s.levels.includes(l)), ...s.levels.filter((l) => !known(l))] };
}

// ---- room: hidden until needed, then shown on every session in the list --------------

export const roomVisible = (list: readonly SessionDraft[]): boolean => list.some((s) => s.showRoom || (s.room ?? '').trim() !== '');
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
const orderKey = (s: SessionDraft): number => {
  const m = toMinutes(s.start);
  if (m === null) return 2 * DAY; // untimed: last
  return m < rolloverCut ? m + DAY : m;
};

export const sortSessions = (list: readonly SessionDraft[]): SessionDraft[] =>
  list.map((s, i) => ({ s, i })).sort((a, b) => orderKey(a.s) - orderKey(b.s) || a.i - b.i).map((x) => x.s);

/** "Add another session" starts where the latest one ends; the same kind as it. */
export function addAnother(list: readonly SessionDraft[], max: number = MAX_SESSIONS, id?: string): SessionDraft[] {
  if (list.length >= max) return sortSessions(list);
  const sorted = sortSessions(list);
  const last = sorted.length ? sorted[sorted.length - 1] : null;
  // Start where the latest TIMED session ends; an untimed one has no end to follow.
  const lastTimed = [...sorted].reverse().find((s) => toMinutes(s.start) !== null && toMinutes(s.end) !== null);
  const next = newSession(last?.kind ?? 'class', lastTimed?.end ?? '19:00', id);
  const room = roomVisible(list);
  return sortSessions([...list, { ...next, showRoom: room }]);
}

export const canAddAnother = (list: readonly SessionDraft[], max: number = MAX_SESSIONS): boolean => list.length < max;

export function removeSession(list: readonly SessionDraft[], id: string): SessionDraft[] {
  return list.length <= 1 ? [...list] : list.filter((s) => s.id !== id);
}

export const canRemoveSession = (list: readonly SessionDraft[]): boolean => list.length > 1;

export const toRuleSession = (s: SessionDraft): RuleSession => ({ kind: s.kind, start: s.start, end: s.end });

/**
 * What is wrong with a session, each 2-4 words; empty when nothing is. Level is
 * optional detail (plan rule 11), so it is never an issue. A stored length past
 * the cap is reported but does not block Done (rule 28: no change without the owner).
 */
export function sessionIssues(s: SessionDraft): SessionIssue[] {
  const out: SessionIssue[] = [];
  if (!(s.name ?? '').trim()) out.push({ code: 'name', reason: SESSION_REASONS.name });
  // Owner decision 3: untimed (no start, no end) is valid; only a half-filled pair or a bad end is an issue.
  if (isUntimedSession(toRuleSession(s))) return out;
  if (toMinutes(s.start) === null) out.push({ code: 'start', reason: SESSION_REASONS.start });
  else if (!pair(s.start, s.end).valid) out.push({ code: 'end', reason: SESSION_REASONS.end });
  else if (!isValidEnd(s.start, s.end)) out.push({ code: 'long', reason: SESSION_REASONS.long });
  return out;
}

export const blocksDone = (i: SessionIssue): boolean => i.code !== 'long';

export const listIssues = (list: readonly SessionDraft[]): SessionIssue[] => list.flatMap(sessionIssues);

// ---- stored rows <-> drafts --------------------------------------------------------------

const hhmmOrEmpty = (t: string | null | undefined): string => (typeof t === 'string' && toMinutes(t.slice(0, 5)) !== null ? t.slice(0, 5) : '');

/** Stored type -> kind: the kind whose storedType it is (performance -> showcase), else kept as is. */
export function kindFromStored(type: string | null): SessionKind {
  const t = type ?? '';
  return sessionKinds.find((k) => sessionKindRules(k)?.storedType === t) ?? (t as SessionKind);
}

/** One stored row as a draft: HH:MM:SS -> HH:MM, null times -> '' (untimed), null room -> '', a missing title -> the kind's name (rule 25), Other pressed when the length is off the quick list. */
export function fromStored(row: StoredSessionRow, people: SessionPerson[] = []): SessionDraft {
  const kind = kindFromStored(row.type);
  const start = hhmmOrEmpty(row.start_time);
  const end = hhmmOrEmpty(row.end_time);
  const base: SessionDraft = {
    id: row.id,
    kind,
    name: (row.title ?? '').trim() ? (row.title as string) : defaultName(kind),
    start,
    end,
    otherLength: false,
    levels: (Array.isArray(row.level_keys) ? row.level_keys : []) as LevelKey[],
    room: row.room ?? '',
    showRoom: false,
    people,
    ...((row.title ?? '').trim() ? {} : { titleWasNull: true }),
  };
  // An untimed lesson starts on the quick lengths (nothing to call "Other" yet).
  return { ...base, otherLength: start !== '' && end !== '' && otherLengthSelected(base) };
}

/** A draft as the stored row shape: HH:MM or null, a blank room is null, levels as they are. */
export function toStored(s: SessionDraft): StoredSessionRow {
  return {
    id: s.id,
    type: sessionKindRules(s.kind)?.storedType ?? (s.kind || null),
    title: s.titleWasNull && s.name === defaultName(s.kind) ? null : s.name,
    start_time: toMinutes(s.start) === null ? null : s.start,
    end_time: toMinutes(s.end) === null ? null : s.end,
    room: (s.room ?? '').trim() === '' ? null : s.room,
    level_keys: [...s.levels],
  };
}

const savedShape = (s: SessionDraft): string => JSON.stringify({ ...toStored(s), people: s.people.map((p) => p.id) });

/** What a list saves, as one comparable string (compute the initial one once). */
export const savedSnapshot = (list: readonly SessionDraft[]): string => JSON.stringify(sortSessions(list).map(savedShape));

/** True when nothing that is saved changed (Other pressed or the room box opened is not a change). */
export const isUntouched = (initial: readonly SessionDraft[], current: readonly SessionDraft[]): boolean =>
  savedSnapshot(initial) === savedSnapshot(current);

/**
 * The issues that block Done: only on sessions that are new or were changed. A
 * stored problem on a session nobody touched (untimed, no name) never traps the
 * list, and the writer re-checks only what changed.
 */
export function blockingIssues(initial: readonly SessionDraft[], current: readonly SessionDraft[]): SessionIssue[] {
  // Like the writer: a field is checked only when THAT field changed (or the session is new).
  const before = new Map(initial.map((s) => [s.id, s]));
  return current.flatMap((s) => {
    const was = before.get(s.id);
    const nameChanged = !was || was.name !== s.name;
    const timesChanged = !was || was.start !== s.start || was.end !== s.end;
    return sessionIssues(s).filter((i) => blocksDone(i) && (i.code === 'name' ? nameChanged : timesChanged));
  });
}

/** "20:00 to 02:00 (next day)" across the list (rule 1), or null when no session has valid times. */
export function nightSpan(list: readonly SessionDraft[]): string | null {
  const rs = list.map(toRuleSession);
  const start = startFromSessions(rs);
  const end = endFromSessions(rs);
  if (!start || !end) return null;
  const wraps = mins(end) <= mins(start) || list.some((s) => pair(s.start, s.end).nextDay);
  return `${start} to ${end}${wraps ? ` (${NEXT_DAY})` : ''}`;
}

/** The people role the line-up search asks for. Only teaching and djing exist server-side; performer and judge use teaching. */
export const searchRole = (kind: SessionKind): 'teaching' | 'djing' => (kind === 'party' ? 'djing' : 'teaching');
