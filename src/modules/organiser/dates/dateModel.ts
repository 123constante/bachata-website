// Pure rules for the date editor (W3). The programme itself (draft, payload,
// validation, line-up deltas) is the OLD programmeModel.ts, imported unchanged:
// the payload this page sends is buildPayload's, byte for byte. This file only
// adds what the new screen needs on top: people by session type, the date's
// time span, and the session-row summary.

import {
  LEVEL_LABEL,
  TYPE_LABEL,
  addPerson,
  isEditableRole,
  lineupSummary,
  sessionMinutes,
  undoRemovePerson,
  type DraftSession,
  type LevelKey,
  type PeopleRole,
} from '@/modules/organiser-self-serve/programmeModel';

/**
 * PEOPLE BY TYPE (ARC DOMAIN): class and masterclass take teachers, a party
 * takes DJs, a performance takes nobody from here (performers and the MC are
 * added by the team). null = no add control.
 */
export const ADD_ROLE: Record<string, PeopleRole | null> = {
  class: 'teaching',
  masterclass: 'teaching',
  party: 'djing',
  performance: null,
};

export const addRoleFor = (type: string | null): PeopleRole | null => (type ? ADD_ROLE[type] ?? null : null);

export const ROLE_NOUN: Record<PeopleRole, string> = { teaching: 'teacher', djing: 'DJ' };

/**
 * Change a NEW session's type. People picked on this screen whose role no
 * longer fits the type go (they were never saved); stored people are never
 * touched. A stored session's type is the writer's, so it is left as is.
 */
export function setSessionType(row: DraftSession, type: string): DraftSession {
  if (row.original) return row;
  const role = addRoleFor(type);
  const people = (row.people ?? []).filter((p) => p.origin !== 'added' || p.role === role);
  return { ...row, type, people };
}

/**
 * Put someone picked in the search on the session. Someone taken off before the
 * save comes back (Undo); someone already on it is left as is; a role that does
 * not fit the type is refused.
 */
export function pickPerson(row: DraftSession, person: { id: string; name: string }): DraftSession {
  const role = addRoleFor(row.type);
  if (!role) return row;
  const people = row.people ?? [];
  const at = people.findIndex((p) => p.id === person.id);
  if (at >= 0) return people[at].removed ? undoRemovePerson(row, at) : row;
  return addPerson(row, { ...person, role });
}

/** Ids the search must not offer again (already on the session and not taken off). */
export const onSessionIds = (row: DraftSession) => new Set((row.people ?? []).filter((p) => !p.removed).map((p) => p.id));

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Day rollover (src/lib/programDayRollover.ts): a start before 08:00 belongs to the night before. */
const ROLLOVER = 8 * 60;
const fmt = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/**
 * A date's time FOLLOWS its sessions: first start to last end over the sessions
 * still on the date. null when no session has both times.
 */
export function dateSpan(rows: DraftSession[]): { start: string; end: string } | null {
  const timed = rows.filter((r) => !r.removed && TIME_RE.test(r.start) && TIME_RE.test(r.end) && r.start !== r.end);
  if (timed.length === 0) return null;
  const startOf = (r: DraftSession) => toMinutes(r.start) + (toMinutes(r.start) < ROLLOVER ? 1440 : 0);
  const first = Math.min(...timed.map(startOf));
  const last = Math.max(...timed.map((r) => startOf(r) + sessionMinutes(r.start, r.end)));
  return { start: fmt(first), end: fmt(last) };
}

export const spanLabel = (span: { start: string; end: string } | null) => (span ? `${span.start}\u2013${span.end}` : null);

export const typeLabel = (type: string | null) => (type && TYPE_LABEL[type]) || 'Session';

/** The row's name: the typed title, else the type. */
export const sessionName = (row: DraftSession) => row.title.trim() || typeLabel(row.type);

export const levelsLabel = (levels: string[]) => levels.map((l) => LEVEL_LABEL[l as LevelKey] ?? l).join(', ');

/** "19:00-20:00" or null. */
export const timesLabel = (row: DraftSession) => (row.start && row.end ? `${row.start}\u2013${row.end}` : row.start || null);

/** Everyone still on the session, by name ("Ana Ruiz, Cleo Park +1"). */
export const peopleLabel = (row: DraftSession) => lineupSummary(row.people, 3);

/** The sessions in time order for display (draft order is kept for the payload). */
export function byTime(rows: DraftSession[]): DraftSession[] {
  const key = (r: DraftSession) => (TIME_RE.test(r.start) ? toMinutes(r.start) + (toMinutes(r.start) < ROLLOVER ? 1440 : 0) : 99999);
  return [...rows].sort((a, b) => key(a) - key(b));
}

export const isTeamPerson = (role: string | null) => !isEditableRole(role);

/** StatusTag tone for a session type. */
export const typeTone = (type: string | null): 'party' | 'neutral' => (type === 'party' ? 'party' : 'neutral');
