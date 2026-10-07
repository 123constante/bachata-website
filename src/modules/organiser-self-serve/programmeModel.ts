// The programme of ONE date, as an organiser edits it (classes, times and levels
// per session). Pure rules, no React and no client, so they are unit-tested
// directly. The server contract is admin migration 20261109560000
// (organiser_get_occurrence_programme_v1 / organiser_set_occurrence_programme_v1):
// the reader returns every session of the date in EXACTLY the write shape, and the
// writer takes the COMPLETE list back. An omitted session is refused, never
// deleted; a removal is only ever removed: true. A value equal to the stored one
// is a no-op and is not re-validated, so an untouched session is echoed as the
// reader returned it.

import type { ConfirmCopy } from './editorGuards';

export const SESSION_TYPES = ['class', 'masterclass', 'party', 'performance'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const LEVEL_KEYS = ['beginner', 'improver', 'intermediate', 'advanced', 'open_level'] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

export const TYPE_LABEL: Record<string, string> = {
  class: 'Class',
  masterclass: 'Masterclass',
  party: 'Party',
  performance: 'Performance',
};

export const LEVEL_LABEL: Record<LevelKey, string> = {
  beginner: 'Beginner',
  improver: 'Improver',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  open_level: 'Open level',
};

/** The server's limits (the writer's constants), mirrored so a bad save is caught before the call. */
export const LIMITS = {
  titleMax: 120,
  sessionMinMinutes: 5,
  sessionMaxMinutes: 12 * 60,
  spanMaxMinutes: 20 * 60,
  visibleMax: 40,
  dateOnlyMax: 20,
} as const;

export type NotEditableReason = 'series_closed' | 'multi_day' | 'date_cancelled' | 'past_date';

/** Plain words for each reason the reader gives for a read-only programme. */
export const NOT_EDITABLE_COPY: Record<NotEditableReason, string> = {
  series_closed: 'This event has ended or is archived, so its programme cannot be changed here. Ask the Bachata Calendar team if something needs fixing.',
  multi_day: 'This event runs over more than one day, so its programme cannot be changed here. Ask the Bachata Calendar team to change it for you.',
  date_cancelled: 'This date is cancelled, so its programme cannot be changed. Un-cancel the date first if it is back on.',
  past_date: 'This date has already happened, so its programme can no longer be changed.',
};

export const notEditableCopy = (reason: string | null) =>
  (reason && NOT_EDITABLE_COPY[reason as NotEditableReason]) ||
  'This programme cannot be changed here. Ask the Bachata Calendar team.';

/** One session exactly as the reader returns it (and as the writer takes it back). */
export type WireSession = Record<string, unknown>;

export interface Programme {
  occurrenceId: string;
  seriesId: string | null;
  occurrenceDate: string | null;
  version: number;
  editable: boolean;
  notEditableReason: string | null;
  sessions: WireSession[];
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function parseProgramme(data: unknown): Programme {
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (typeof row.occurrence_id !== 'string' || typeof row.version !== 'number' || !Array.isArray(row.sessions)) {
    throw new Error('programme_unreadable');
  }
  return {
    occurrenceId: row.occurrence_id,
    seriesId: str(row.series_id),
    occurrenceDate: str(row.occurrence_date),
    version: row.version,
    editable: row.editable === true,
    notEditableReason: str(row.not_editable_reason),
    sessions: (row.sessions as unknown[]).filter((s): s is WireSession => !!s && typeof s === 'object' && !Array.isArray(s)),
  };
}

export interface SaveResult {
  changed: boolean;
  version: number;
  sessions: WireSession[];
}

export function parseSaveResult(data: unknown): SaveResult {
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (row.ok !== true || typeof row.version !== 'number') throw new Error('save_unreadable');
  return {
    changed: row.changed === true,
    version: row.version,
    sessions: Array.isArray(row.sessions) ? (row.sessions as WireSession[]) : [],
  };
}

// ---- the draft the screen edits ---------------------------------------------

export interface DraftSession {
  /** Stable local key for React and for focus; never sent. */
  key: string;
  /** The reader's object, untouched; null for a session added on this screen. */
  original: WireSession | null;
  type: string | null;
  title: string;
  /** 'HH:MM' or '' for none. */
  start: string;
  end: string;
  levels: string[];
  removed: boolean;
}

const levelsOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : []);
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : '');

/** The id key an existing session carries (series_item_id or added_session_id). */
export function sessionIdOf(s: WireSession): string | null {
  return str(s.series_item_id) ?? str(s.added_session_id);
}

export function toDraft(sessions: WireSession[]): DraftSession[] {
  return sessions.map((s, i) => ({
    key: `s:${sessionIdOf(s) ?? i}`,
    original: s,
    type: str(s.type),
    title: str(s.title) ?? '',
    start: hhmm(s.start_time),
    end: hhmm(s.end_time),
    levels: levelsOf(s.level_keys),
    removed: s.removed === true,
  }));
}

let newCounter = 0;
export function newSession(type: SessionType = 'class'): DraftSession {
  newCounter += 1;
  return { key: `new:${newCounter}`, original: null, type, title: '', start: '', end: '', levels: [], removed: false };
}

/** True when the end is at or before the start: the session finishes after midnight. */
export const endsNextDay = (start: string | null, end: string | null) => !!start && !!end && end <= start;

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Minutes a session lasts, an end at or before the start counting as the next day. */
export function sessionMinutes(start: string, end: string): number {
  const d = toMinutes(end) - toMinutes(start);
  return d <= 0 ? d + 1440 : d;
}

const sameLevels = (a: string[], b: string[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** Which fields of a session differ from what the reader returned. A new session differs in all of them. */
export function changesOf(row: DraftSession) {
  const o = row.original;
  if (!o) return { title: true, times: true, levels: true, removed: false, any: true };
  const title = row.title.trim() !== (str(o.title) ?? '').trim();
  const times = (row.start || null) !== (str(o.start_time) ? hhmm(o.start_time) : null)
    || (row.end || null) !== (str(o.end_time) ? hhmm(o.end_time) : null);
  const levels = !sameLevels(row.levels, levelsOf(o.level_keys));
  const removed = row.removed !== (o.removed === true);
  // A session removed now (and removed before) sends its stored values: edits under a removal do not count.
  if (row.removed) return { title: false, times: false, levels: false, removed, any: removed };
  return { title, times, levels, removed, any: title || times || levels || removed };
}

export const isDirty = (rows: DraftSession[], originalCount: number) =>
  rows.length !== originalCount || rows.some((r) => changesOf(r).any);

/** Sessions that were on the date and are now marked removed: the save needs a hard confirm. */
export const newlyRemoved = (rows: DraftSession[]) => rows.filter((r) => r.original && r.removed && r.original.removed !== true);

/**
 * The COMPLETE programme for organiser_set_occurrence_programme_v1: every session
 * the reader returned, exactly once and in its order, then the new ones. An
 * untouched session is the reader's object as it came; an edited one sends the
 * stored value for every field it did not change (so a grandfathered title or a
 * null time is never re-validated), and ends_next_day is always derived from the
 * times it sends.
 */
export function buildPayload(rows: DraftSession[]): WireSession[] {
  const out: WireSession[] = [];
  for (const row of rows) {
    const o = row.original;
    if (o) {
      const c = changesOf(row);
      if (!c.any) {
        out.push(o);
        continue;
      }
      if (row.removed) {
        out.push({ ...o, removed: true });
        continue;
      }
      const start = c.times ? row.start || null : (o.start_time as string | null) ?? null;
      const end = c.times ? row.end || null : (o.end_time as string | null) ?? null;
      const idKey = typeof o.series_item_id === 'string' ? 'series_item_id' : 'added_session_id';
      out.push({
        [idKey]: o[idKey],
        type: o.type ?? null,
        removed: false,
        // A stored title that is not a string cannot be echoed (the writer wants a string): send what was typed.
        title: c.title || typeof o.title !== 'string' ? row.title.trim() : o.title,
        start_time: start,
        end_time: end,
        ends_next_day: c.times ? endsNextDay(start, end) : o.ends_next_day === true,
        level_keys: c.levels ? [...new Set(row.levels)] : levelsOf(o.level_keys),
      });
      continue;
    }
    if (row.removed) continue; // added here and taken out again: never sent
    const start = row.start || null;
    const end = row.end || null;
    out.push({
      new: true,
      type: row.type,
      title: row.title.trim(),
      start_time: start,
      end_time: end,
      ends_next_day: endsNextDay(start, end),
      level_keys: [...new Set(row.levels)],
    });
  }
  return out;
}

// ---- validation, mirroring the writer --------------------------------------

export interface RowProblem {
  key: string;
  field: 'title' | 'times' | 'levels' | 'type';
  message: string;
}

export interface Validation {
  rows: RowProblem[];
  /** Problems with the date as a whole (too many sessions, too long a span). */
  programme: string[];
  ok: boolean;
}

export function titleProblem(title: string): string | null {
  const t = title.trim();
  if (!t) return 'Give this session a name.';
  if (t.length > LIMITS.titleMax) return `Keep the name to ${LIMITS.titleMax} characters or fewer.`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(t)) return 'Keep the name on one line.';
  if (/[<>]/.test(t)) return 'The name cannot contain < or >.';
  return null;
}

export function timesProblem(start: string, end: string): string | null {
  if (!start || !end) return 'Enter a start time and an end time.';
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return 'Enter the time as hours and minutes, like 19:30.';
  if (start === end) return 'The end time must be different from the start time.';
  const m = sessionMinutes(start, end);
  if (m < LIMITS.sessionMinMinutes || m > LIMITS.sessionMaxMinutes) return 'A session must last between 5 minutes and 12 hours.';
  return null;
}

/**
 * The server checks a field only when it changes (an untouched stored value
 * always round-trips), the caps only when a session is added, and the span only
 * when a time moved. The same here, so the screen never blocks a save the server
 * would accept.
 */
export function validateProgramme(rows: DraftSession[]): Validation {
  const problems: RowProblem[] = [];
  const programme: string[] = [];
  let anyNew = false;
  let anyTime = false;
  for (const row of rows) {
    if (row.removed) continue;
    const c = changesOf(row);
    if (!row.original) {
      anyNew = true;
      if (!row.type || !(SESSION_TYPES as readonly string[]).includes(row.type)) {
        problems.push({ key: row.key, field: 'type', message: 'Choose what kind of session this is.' });
      }
    }
    if (c.title || (c.any && row.original && typeof row.original.title !== 'string')) {
      const p = titleProblem(row.title);
      if (p) problems.push({ key: row.key, field: 'title', message: p });
    }
    if (c.times) {
      anyTime = true;
      const p = timesProblem(row.start, row.end);
      if (p) problems.push({ key: row.key, field: 'times', message: p });
    }
    if (c.levels) {
      const bad = row.levels.some((l) => !(LEVEL_KEYS as readonly string[]).includes(l)) || new Set(row.levels).size !== row.levels.length;
      if (bad || row.levels.length > LEVEL_KEYS.length) problems.push({ key: row.key, field: 'levels', message: 'Choose levels from the list.' });
    }
  }
  const kept = rows.filter((r) => !r.removed);
  if (anyNew) {
    if (kept.length > LIMITS.visibleMax) programme.push(`A date can hold up to ${LIMITS.visibleMax} sessions.`);
    const dateOnly = kept.filter((r) => !r.original || typeof r.original.added_session_id === 'string').length;
    if (dateOnly > LIMITS.dateOnlyMax) programme.push(`A date can hold up to ${LIMITS.dateOnlyMax} sessions added just for that date.`);
  }
  if (anyTime) {
    const timed = kept.filter((r) => TIME_RE.test(r.start) && TIME_RE.test(r.end) && r.start !== r.end);
    if (timed.length) {
      const first = Math.min(...timed.map((r) => toMinutes(r.start)));
      const last = Math.max(...timed.map((r) => toMinutes(r.start) + sessionMinutes(r.start, r.end)));
      if (last - first > LIMITS.spanMaxMinutes) programme.push('The programme of this date would run for more than 20 hours. Check the times.');
    }
  }
  return { rows: problems, programme, ok: problems.length === 0 && programme.length === 0 };
}

/** The hard confirm before a save that takes sessions off the date. */
export function removeSessionsConfirmCopy(names: string[], dateLabel: string): ConfirmCopy {
  const list = names.map((n) => (n.trim() ? `"${n.trim()}"` : 'a session without a name')).join(', ');
  const one = names.length === 1;
  return {
    title: one ? `Remove ${list} from ${dateLabel}?` : `Remove ${names.length} sessions from ${dateLabel}?`,
    consequence: `${one ? 'It' : list} will disappear from the programme dancers see for ${dateLabel} as soon as you save. Other dates are not affected.`,
    undo: 'To bring a session back later, open this date and put it back, or add it again.',
    confirmLabel: one ? 'Yes, remove it and save' : 'Yes, remove them and save',
    keepLabel: 'No, go back',
    requireAck: true,
    ackLabel: one ? 'I understand dancers will no longer see this session.' : 'I understand dancers will no longer see these sessions.',
  };
}
