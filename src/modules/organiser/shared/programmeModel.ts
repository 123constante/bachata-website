// The programme of ONE date, as an organiser edits it (classes, times and levels
// per session). Pure rules, no React and no client, so they are unit-tested
// directly. The server contract is admin migration 20261109560000
// (organiser_get_occurrence_programme_v1 / organiser_set_occurrence_programme_v1):
// the reader returns every session of the date in EXACTLY the write shape, and the
// writer takes the COMPLETE list back. An omitted session is refused, never
// deleted; a removal is only ever removed: true. A value equal to the stored one
// is a no-op and is not re-validated, so an untouched session is echoed as the
// reader returned it.
//
// The line-up (teachers and DJs per session, admin 20261109700000 / 20261109750000)
// rides beside the sessions: the reader adds session_people (one entry per session,
// same order and identity key, each with its live people and their stored role),
// and the writer takes per-session people_add / people_remove deltas. A session
// whose line-up is untouched carries neither key, so a save that changes nobody is
// byte-identical to one made before the line-up existed.

import type { ConfirmCopy } from './editorGuards';

export const SESSION_TYPES = ['class', 'masterclass', 'party', 'performance'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const LEVEL_KEYS = ['beginner', 'improver', 'intermediate', 'advanced', 'open_level'] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

/**
 * LEVELS BY TYPE (owner rule 2026-10-08, ARC DOMAIN): only a class or a
 * masterclass takes levels. A party, a performance or any older type never
 * shows them, and a session of such a type always saves level_keys [].
 * The ONE mapping the sheet, the row summary, validation and the payload read.
 */
export const LEVEL_TYPES = ['class', 'masterclass'] as const;

export const levelsApplyTo = (type: string | null): boolean => (LEVEL_TYPES as readonly string[]).includes(type ?? '');

/** The levels a session shows and saves: its own for a class or masterclass, none for any other type. */
export const sessionLevels = (row: { type: string | null; levels: string[] }): string[] =>
  (levelsApplyTo(row.type) ? [...new Set(row.levels)] : []);

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
  /** people_add and people_remove each hold at most this many; a session holds at most this many live people. */
  peopleMax: 12,
} as const;

/** The two roles an organiser may add (the writer's c_people_roles). Any other stored role is the team's: read-only here. */
export const PEOPLE_ROLES = ['teaching', 'djing'] as const;
export type PeopleRole = (typeof PEOPLE_ROLES)[number];

export const PEOPLE_ROLE_LABEL: Record<string, string> = {
  teaching: 'Teacher',
  djing: 'DJ',
  mc: 'MC',
  performing: 'Performer',
};

export type NotEditableReason = 'series_closed' | 'multi_day' | 'date_cancelled' | 'past_date';

/** Plain words for each reason the reader gives for a read-only programme. */
export const NOT_EDITABLE_COPY: Record<NotEditableReason, string> = {
  series_closed: 'This event has ended or is archived, so its schedule cannot be changed here. Ask the Bachata Calendar team if something needs fixing.',
  multi_day: 'This event runs over more than one day, so its schedule cannot be changed here. Ask the Bachata Calendar team to change it for you.',
  date_cancelled: 'This date is cancelled, so its schedule cannot be changed. Put the date back on first if it is happening.',
  past_date: 'This date has already happened, so its schedule can no longer be changed.',
};

export const notEditableCopy = (reason: string | null) =>
  (reason && NOT_EDITABLE_COPY[reason as NotEditableReason]) ||
  'This schedule cannot be changed here. Ask the Bachata Calendar team.';

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
  /** The reader's session_people: one entry per session with its identity key and its people. */
  sessionPeople: WireSession[];
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const objects = (v: unknown): WireSession[] =>
  (Array.isArray(v) ? v : []).filter((s): s is WireSession => !!s && typeof s === 'object' && !Array.isArray(s));

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
    sessions: objects(row.sessions),
    sessionPeople: objects(row.session_people),
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

/** One person on a session's line-up, as the sheet edits it. */
export interface DraftPerson {
  /** The profile id people_add / people_remove name. */
  id: string;
  name: string;
  /** The stored role; teaching or djing for anyone added here. */
  role: string | null;
  /** 'stored': the reader returned them; 'added': picked on this screen, not saved yet. */
  origin: 'stored' | 'added';
  /** A stored person marked for removal (greyed with Undo until the save). Never true for an added one. */
  removed: boolean;
}

/** Only teachers and DJs are the organiser's to change; an MC or performer (set by the team) is read-only. */
export const isEditableRole = (role: string | null): role is PeopleRole => (PEOPLE_ROLES as readonly string[]).includes(role ?? '');

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
  /** The line-up. Optional so a draft built before the line-up existed still reads as "nobody changed". */
  people?: DraftPerson[];
}

const levelsOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : []);
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : '');

/** The id key an existing session carries (series_item_id or added_session_id). */
export function sessionIdOf(s: WireSession): string | null {
  return str(s.series_item_id) ?? str(s.added_session_id);
}

function peopleOf(entry: WireSession | undefined): DraftPerson[] {
  const list = entry && Array.isArray(entry.people) ? entry.people : [];
  return list
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).profile_id === 'string')
    .map((p) => ({
      id: p.profile_id as string,
      name: str(p.display_name)?.trim() || 'Unnamed',
      role: str(p.role),
      origin: 'stored' as const,
      removed: false,
    }));
}

/** The reader's session_people entry for a session: by its identity key, else by position. */
function peopleEntryFor(s: WireSession, i: number, sessionPeople: WireSession[]): WireSession | undefined {
  const id = sessionIdOf(s);
  if (id) {
    const hit = sessionPeople.find((e) => sessionIdOf(e) === id);
    if (hit) return hit;
  }
  const at = sessionPeople[i];
  return at && sessionIdOf(at) === null ? at : undefined;
}

export function toDraft(sessions: WireSession[], sessionPeople: WireSession[] = []): DraftSession[] {
  return sessions.map((s, i) => ({
    key: `s:${sessionIdOf(s) ?? i}`,
    original: s,
    type: str(s.type),
    title: str(s.title) ?? '',
    start: hhmm(s.start_time),
    end: hhmm(s.end_time),
    // A party or performance carrying stray stored levels shows none (sessionLevels).
    levels: sessionLevels({ type: str(s.type), levels: levelsOf(s.level_keys) }),
    removed: s.removed === true,
    people: peopleOf(peopleEntryFor(s, i, sessionPeople)),
  }));
}

let newCounter = 0;
export function newSession(type: SessionType = 'class'): DraftSession {
  newCounter += 1;
  return { key: `new:${newCounter}`, original: null, type, title: '', start: '', end: '', levels: [], removed: false, people: [] };
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
  const stored = levelsOf(o.level_keys);
  // A type without levels that still stores some (stray prod rows) drops them when the
  // session is saved for another change; on its own that is not an edit, so an
  // untouched session still echoes as read and the page never opens dirty.
  const levels = levelsApplyTo(row.type)
    ? !sameLevels(row.levels, stored)
    : stored.length > 0 && (title || times || peopleChanged(row));
  const removed = row.removed !== (o.removed === true);
  // A session removed now (and removed before) sends its stored values: edits under a removal do not count.
  if (row.removed) return { title: false, times: false, levels: false, removed, any: removed };
  return { title, times, levels, removed, any: title || times || levels || removed };
}

// ---- the line-up ------------------------------------------------------------

/** The line-up deltas of one session, exactly as the writer takes them. */
export function peopleChangesOf(row: DraftSession): { add: { profile_id: string; role: PeopleRole }[]; remove: string[] } {
  const people = row.people ?? [];
  return {
    add: people
      .filter((p) => p.origin === 'added' && !p.removed && isEditableRole(p.role))
      .map((p) => ({ profile_id: p.id, role: p.role as PeopleRole })),
    remove: [...new Set(people.filter((p) => p.origin === 'stored' && p.removed).map((p) => p.id))],
  };
}

/** True when the session's line-up would be sent (a removed session never carries people). */
export function peopleChanged(row: DraftSession): boolean {
  if (row.removed) return false;
  const c = peopleChangesOf(row);
  return c.add.length > 0 || c.remove.length > 0;
}

/** Add someone picked in the search. Someone already on the session (in any state) is left as is. */
export function addPerson(row: DraftSession, person: { id: string; name: string; role: PeopleRole }): DraftSession {
  const people = row.people ?? [];
  if (people.some((p) => p.id === person.id)) return row;
  return { ...row, people: [...people, { id: person.id, name: person.name, role: person.role, origin: 'added', removed: false }] };
}

/**
 * Take someone off. A stored teacher or DJ stays, greyed, until the save (Undo puts
 * them back); someone added on this screen was never saved, so they just go. An MC
 * or performer is the team's and is never removed here.
 */
export function removePerson(row: DraftSession, index: number): DraftSession {
  const people = row.people ?? [];
  const p = people[index];
  if (!p || !isEditableRole(p.role)) return row;
  if (p.origin === 'added') return { ...row, people: people.filter((_, i) => i !== index) };
  return { ...row, people: people.map((q, i) => (i === index ? { ...q, removed: true } : q)) };
}

export function undoRemovePerson(row: DraftSession, index: number): DraftSession {
  const people = row.people ?? [];
  if (!people[index]?.removed) return row;
  return { ...row, people: people.map((q, i) => (i === index ? { ...q, removed: false } : q)) };
}

/** "Ana, Ben +2" for the session row; null when nobody is on it. */
export function lineupSummary(people: DraftPerson[] | undefined, shown = 2): string | null {
  const live = (people ?? []).filter((p) => !p.removed);
  if (live.length === 0) return null;
  const names = live.slice(0, shown).map((p) => p.name);
  return live.length > shown ? `${names.join(', ')} +${live.length - shown}` : names.join(', ');
}

/** Why "Add teacher" / "Add DJ" is off for this session, or null when another person may be added. */
export function addLimitReason(row: DraftSession): string | null {
  const people = row.people ?? [];
  if (peopleChangesOf(row).add.length >= LIMITS.peopleMax) return `You can add up to ${LIMITS.peopleMax} people per save.`;
  if (people.filter((p) => !p.removed).length >= LIMITS.peopleMax) return `A session can have up to ${LIMITS.peopleMax} teachers and DJs.`;
  return null;
}

/** Why the remove buttons are off for this session, or null. */
export function removeLimitReason(row: DraftSession): string | null {
  return peopleChangesOf(row).remove.length >= LIMITS.peopleMax ? `You can remove up to ${LIMITS.peopleMax} people per save.` : null;
}

export const isDirty = (rows: DraftSession[], originalCount: number) =>
  rows.length !== originalCount || rows.some((r) => changesOf(r).any || peopleChanged(r));

/** Sessions that were on the date and are now marked removed: the save needs a hard confirm. */
export const newlyRemoved = (rows: DraftSession[]) => rows.filter((r) => r.original && r.removed && r.original.removed !== true);

/**
 * The COMPLETE programme for organiser_set_occurrence_programme_v1: every session
 * the reader returned, exactly once and in its order, then the new ones. An
 * untouched session is the reader's object as it came; an edited one sends the
 * stored value for every field it did not change (so a grandfathered title or a
 * null time is never re-validated), and ends_next_day is always derived from the
 * times it sends. A session whose line-up changed adds people_add and/or
 * people_remove (only the non-empty ones); one whose line-up did not carries
 * neither key.
 */
export function buildPayload(rows: DraftSession[]): WireSession[] {
  return buildSessions(rows).map(({ row, el }) => {
    if (!peopleChanged(row)) return el;
    const c = peopleChangesOf(row);
    return {
      ...el,
      ...(c.add.length ? { people_add: c.add } : {}),
      ...(c.remove.length ? { people_remove: c.remove } : {}),
    };
  });
}

function buildSessions(rows: DraftSession[]): { row: DraftSession; el: WireSession }[] {
  const out: { row: DraftSession; el: WireSession }[] = [];
  for (const row of rows) {
    const o = row.original;
    if (o) {
      const c = changesOf(row);
      if (!c.any) {
        out.push({ row, el: o });
        continue;
      }
      if (row.removed) {
        out.push({ row, el: { ...o, removed: true } });
        continue;
      }
      const start = c.times ? row.start || null : (o.start_time as string | null) ?? null;
      const end = c.times ? row.end || null : (o.end_time as string | null) ?? null;
      const idKey = typeof o.series_item_id === 'string' ? 'series_item_id' : 'added_session_id';
      out.push({ row, el: {
        [idKey]: o[idKey],
        type: o.type ?? null,
        removed: false,
        // A stored title that is not a string cannot be echoed (the writer wants a string): send what was typed.
        title: c.title || typeof o.title !== 'string' ? row.title.trim() : o.title,
        start_time: start,
        end_time: end,
        ends_next_day: c.times ? endsNextDay(start, end) : o.ends_next_day === true,
        level_keys: c.levels ? sessionLevels(row) : levelsOf(o.level_keys),
      } });
      continue;
    }
    if (row.removed) continue; // added here and taken out again: never sent
    const start = row.start || null;
    const end = row.end || null;
    out.push({ row, el: {
      new: true,
      type: row.type,
      title: row.title.trim(),
      start_time: start,
      end_time: end,
      ends_next_day: endsNextDay(start, end),
      level_keys: sessionLevels(row),
    } });
  }
  return out;
}

// ---- validation, mirroring the writer --------------------------------------

export interface RowProblem {
  key: string;
  field: 'title' | 'times' | 'levels' | 'type' | 'people';
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

/** The writer's line-up rules for one session, checked only when its line-up changed. */
export function peopleProblem(row: DraftSession): string | null {
  const c = peopleChangesOf(row);
  if (c.add.length > LIMITS.peopleMax) return `You can add up to ${LIMITS.peopleMax} people to a session per save.`;
  if (c.remove.length > LIMITS.peopleMax) return `You can remove up to ${LIMITS.peopleMax} people from a session per save.`;
  const added = c.add.map((a) => a.profile_id);
  if (new Set(added).size !== added.length || added.some((id) => c.remove.includes(id))) {
    return 'Someone is listed twice in this line-up. Undo the change and try again.';
  }
  if ((row.people ?? []).filter((p) => !p.removed).length > LIMITS.peopleMax) {
    return `A session can have up to ${LIMITS.peopleMax} teachers and DJs.`;
  }
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
    if (peopleChanged(row)) {
      const p = peopleProblem(row);
      if (p) problems.push({ key: row.key, field: 'people', message: p });
    }
    // Only what is sent is checked: a type without levels always sends [].
    if (c.levels && levelsApplyTo(row.type)) {
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
      if (last - first > LIMITS.spanMaxMinutes) programme.push('The schedule of this date would run for more than 20 hours. Check the times.');
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
    consequence: `${one ? 'It' : list} will disappear from the schedule dancers see for ${dateLabel} as soon as you save. Other dates are not affected.`,
    undo: 'To bring a session back later, open this date and put it back, or add it again.',
    confirmLabel: one ? 'Yes, remove it and save' : 'Yes, remove them and save',
    keepLabel: 'No, go back',
    requireAck: true,
    ackLabel: one ? 'I understand dancers will no longer see this session.' : 'I understand dancers will no longer see these sessions.',
  };
}
