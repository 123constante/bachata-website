// The programme of the WHOLE SERIES, as an organiser edits it (parity wave 1, SW1).
// Pure: no React, no client. The read is admin_event_workspace_p5 series.program
// (days > sections > items > people, from _snapshot_series_p5); the write is
// series.set_program (_cmd_series_set_program_p5), which takes the COMPLETE tree.
// Every stored day / section / item goes back with its own `id` (AW1 upserts by id and
// deletes only the ids that left the tree, so the per-date session changes keyed by an
// item id survive a Save -- REVIEW-SW1 B1); a new row sends no id. Every field the
// editor does not touch (room, style, theme, track...) is echoed from the stored row,
// and an untouched tree builds the same payload as the one read (dirty = the two
// payloads differ; an untouched Save sends nothing).

import {
  LEVEL_KEYS, LEVEL_LABEL, LEVEL_SHORT, LIMITS, PEOPLE_ROLE_LABEL, SESSION_TYPES, TYPE_LABEL,
  endsNextDay, isEditableRole, levelsApplyTo, sessionLevels, sessionMinutes, timesProblem, titleProblem,
  type LevelKey, type PeopleRole,
} from '@/modules/organiser/shared/programmeModel';
import { eventLock } from '@/modules/organiser/shared/eventState';
import { AW1_APPLIED, PARITY_GATE_REASON } from '@/modules/organiser/shared/parityGate';
import { setProgramCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { WorkspaceDate } from '@/modules/organiser/shared/seriesModel';

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : '');

// ---- words (ONE mapping: the chips, the rows and the cast read these) -----------------

export { LEVEL_SHORT };
export const levelShort = (key: string) => LEVEL_SHORT[key as LevelKey] ?? key;
export const levelWord = (key: string) => LEVEL_LABEL[key as LevelKey] ?? key;
export const roleWord = (role: string | null) => PEOPLE_ROLE_LABEL[role ?? ''] ?? 'Guest';

export const SECTION_LABEL: Record<string, string> = {
  classes: 'Classes', party: 'Party', masterclass: 'Masterclasses', showcase: 'Showcase', competition: 'Competition', social: 'Party',
};
/** The section kinds an organiser starts from (the admin editor's Classes and Party). */
export const START_SECTIONS = ['classes', 'party'] as const;

export const FESTIVAL_REASON = 'Festival days are edited with the platform team for now.';
export const NEEDS_UPDATE = PARITY_GATE_REASON;

// ---- the tree --------------------------------------------------------------------------

export interface PPerson {
  profileId: string;
  name: string;
  profileType: string;
  role: string | null;
  level: string | null;
}
export interface PItem {
  key: string;
  raw: Raw;
  type: string | null;
  title: string;
  start: string;
  end: string;
  levels: string[];
  people: PPerson[];
  /** Added on this screen, not saved yet. */
  added: boolean;
}
export interface PSection {
  key: string; raw: Raw; kind: string; items: PItem[];
  /** Stored with no sessions: sent back as stored (only a section THIS screen emptied is dropped). */
  storedEmpty: boolean;
}
export interface PDay { key: string; raw: Raw; sections: PSection[] }
export interface PTree { days: PDay[] }

let counter = 0;
const nextKey = (p: string) => `${p}:${(counter += 1)}`;

export function parseTree(program: unknown): PTree {
  return {
    days: arr(program).map((d, di) => {
      const day = obj(obj(d).day);
      return {
        key: `d:${str(day.id) ?? di}`,
        raw: day,
        sections: arr(obj(d).sections).map((s, si) => {
          const section = obj(obj(s).section);
          return {
            key: `s:${str(section.id) ?? `${di}.${si}`}`,
            raw: section,
            kind: str(section.kind) ?? 'party',
            storedEmpty: arr(obj(s).items).length === 0,
            items: arr(obj(s).items).map((e, ii) => {
              const item = obj(obj(e).item);
              return {
                key: `i:${str(item.id) ?? `${di}.${si}.${ii}`}`,
                raw: item,
                type: str(item.type),
                title: str(item.title) ?? '',
                start: hhmm(item.start_time),
                end: hhmm(item.end_time),
                levels: sessionLevels({ type: str(item.type), levels: arr(item.level_keys).filter((l): l is string => typeof l === 'string') }),
                added: false,
                people: arr(obj(e).people).map(obj).filter((p) => typeof p.profile_id === 'string').map((p) => ({
                  profileId: p.profile_id as string,
                  name: str(p.display_name)?.trim() || 'Unnamed',
                  profileType: str(p.profile_type) ?? 'teacher',
                  role: str(p.role),
                  level: str(p.level),
                })),
              };
            }),
          };
        }),
      };
    }),
  };
}

export const sectionWord = (s: PSection) => str(s.raw.label_override)?.trim() || SECTION_LABEL[s.kind] || 'Programme';

export const sessionCount = (t: PTree) => t.days.reduce((n, d) => n + d.sections.reduce((m, s) => m + s.items.length, 0), 0);
export const allItems = (t: PTree): PItem[] => t.days.flatMap((d) => d.sections.flatMap((s) => s.items));

// ---- what the screen can do ------------------------------------------------------------

export type ProgrammeMode =
  | { kind: 'editable' }
  | { kind: 'off'; reason: string };

/**
 * Why the programme cannot be changed here, or null. Order: a festival (its programme
 * is a DAY tree the platform team edits), a closed event, a viewer who may not write,
 * then the platform gate (AW1). A course edits like a recurring series.
 */
export function programmeOff(input: { format: string | null; lifecycle: string; canEdit: boolean; gate?: boolean }): string | null {
  if (input.format === 'festival') return FESTIVAL_REASON;
  const lock = eventLock(input.lifecycle);
  if (lock) return lock;
  if (!input.canEdit) return 'Only the people who run this event can change its programme.';
  if (!(input.gate ?? AW1_APPLIED)) return NEEDS_UPDATE;
  return null;
}

// ---- the cast (from the same tree, so a name reads the same on every screen) -----------

export interface CastEntry { profileId: string; name: string; roles: string[]; sessions: number }

export function castOf(tree: PTree): CastEntry[] {
  const out = new Map<string, CastEntry>();
  for (const item of allItems(tree)) {
    for (const p of item.people) {
      const hit = out.get(p.profileId) ?? { profileId: p.profileId, name: p.name, roles: [], sessions: 0 };
      if (p.role && !hit.roles.includes(p.role)) hit.roles.push(p.role);
      hit.sessions += 1;
      out.set(p.profileId, hit);
    }
  }
  return [...out.values()];
}

export const CAST_MAX = 6;

/** "Ana (Teacher), Ben (DJ)" for the Details cast row: the first CAST_MAX names, then "and N more". */
export function castLine(cast: CastEntry[]): string {
  const line = cast.slice(0, CAST_MAX).map((c) => `${c.name}${c.roles.length ? ` (${c.roles.map(roleWord).join(', ')})` : ''}`).join(', ');
  return cast.length > CAST_MAX ? `${line} and ${cast.length - CAST_MAX} more` : line;
}

export const CAST_EMPTY = 'Add a teacher to a class to show them here.';
/** The cast row with nobody on it: the call to action only when the programme can be edited, else why not. */
export const castEmptyLine = (off: string | null): string => off ?? CAST_EMPTY;

// ---- the dates that differ ---------------------------------------------------------------

/** Coming dates with their own session changes (a session time, an added session). */
export const differingDates = (dates: WorkspaceDate[], today: string): WorkspaceDate[] =>
  dates
    .filter((d) => d.occurrence_date >= today && d.lifecycle_status !== 'cancelled' && (d.session_overrides_count > 0 || d.added_sessions_count > 0))
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));

export const differsLabel = (n: number) => (n === 1 ? 'Differs on 1 date' : `Differs on ${n} dates`);

// ---- editing (immutable) ------------------------------------------------------------------

const mapItems = (t: PTree, fn: (it: PItem) => PItem): PTree => ({
  days: t.days.map((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, items: s.items.map(fn) })) })),
});

export const updateItem = (t: PTree, key: string, patch: Partial<PItem>): PTree => mapItems(t, (it) => (it.key === key ? { ...it, ...patch } : it));

export function addSession(t: PTree, kind: string, type: string): { tree: PTree; key: string } {
  const key = nextKey('new');
  const item: PItem = { key, raw: {}, type, title: '', start: '', end: '', levels: [], people: [], added: true };
  const days = t.days.length ? t.days : [{ key: nextKey('d'), raw: { day_index: 0, date_offset_days: 0 }, sections: [] }];
  const first = days[0];
  const at = first.sections.findIndex((s) => s.kind === kind);
  const sections = at >= 0
    ? first.sections.map((s, i) => (i === at ? { ...s, items: [...s.items, item] } : s))
    : [...first.sections, { key: nextKey('s'), raw: {}, kind, items: [item], storedEmpty: false }];
  return { tree: { days: [{ ...first, sections }, ...days.slice(1)] }, key };
}

export const removeSession = (t: PTree, key: string): PTree => ({
  days: t.days.map((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, items: s.items.filter((it) => it.key !== key) })) })),
});

export function moveSession(t: PTree, key: string, dir: -1 | 1): PTree {
  return {
    days: t.days.map((d) => ({
      ...d,
      sections: d.sections.map((s) => {
        const i = s.items.findIndex((it) => it.key === key);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.items.length) return s;
        const items = [...s.items];
        [items[i], items[j]] = [items[j], items[i]];
        return { ...s, items };
      }),
    })),
  };
}

/** Why a session cannot go up / down, or null. */
export function moveOff(t: PTree, key: string, dir: -1 | 1): string | null {
  for (const d of t.days) for (const s of d.sections) {
    const i = s.items.findIndex((it) => it.key === key);
    if (i >= 0) return i + dir < 0 ? 'Already first' : i + dir >= s.items.length ? 'Already last' : null;
  }
  return null;
}

export const setType = (it: PItem, type: string): PItem => ({ ...it, type, levels: sessionLevels({ type, levels: it.levels }) });
export const toggleLevel = (it: PItem, level: string): PItem =>
  levelsApplyTo(it.type) ? { ...it, levels: it.levels.includes(level) ? it.levels.filter((l) => l !== level) : [...it.levels, level] } : it;

/** The people-search role a session type adds (a party takes DJs, a class teachers); null for the rest. */
export const addRoleFor = (type: string | null): PeopleRole | null =>
  type === 'party' ? 'djing' : type === 'class' || type === 'masterclass' ? 'teaching' : null;
/** The profile type the people search returns for a role (a teacher search lists teacher profiles). */
export const profileTypeOf = (role: PeopleRole) => (role === 'djing' ? 'dj' : 'teacher');
/** The roles a profile of this type can hold: a teacher profile teaches, a DJ profile DJs (REVIEW-SW1 B2). */
export const rolesFor = (profileType: string): PeopleRole[] =>
  profileType === 'teacher' ? ['teaching'] : profileType === 'dj' ? ['djing'] : [];

/** Adds a person with the profile type of the profile picked (never derived from the role); a role that type cannot hold is refused. */
export function addPerson(it: PItem, p: { id: string; name: string; profileType: string; role: PeopleRole; level?: string | null }): PItem {
  if (it.people.some((q) => q.profileId === p.id) || !rolesFor(p.profileType).includes(p.role)) return it;
  return { ...it, people: [...it.people, { profileId: p.id, name: p.name, profileType: p.profileType, role: p.role, level: p.level ?? null }] };
}
export const removePerson = (it: PItem, id: string): PItem => {
  const p = it.people.find((q) => q.profileId === id);
  return p && isEditableRole(p.role) ? { ...it, people: it.people.filter((q) => q.profileId !== id) } : it;
};
export const setPersonRole = (it: PItem, id: string, role: PeopleRole): PItem => ({
  ...it,
  people: it.people.map((p) => (p.profileId === id && isEditableRole(p.role) && rolesFor(p.profileType).includes(role) ? { ...p, role } : p)),
});
export const setPersonLevel = (it: PItem, id: string, level: string | null): PItem => ({
  ...it,
  people: it.people.map((p) => (p.profileId === id ? { ...p, level: p.level === level ? null : level } : p)),
});
export const whyCannotAddPerson = (it: PItem): string | null =>
  it.people.length >= LIMITS.peopleMax ? `A session can have up to ${LIMITS.peopleMax} teachers and DJs.` : addRoleFor(it.type) === null ? 'Performers and the MC are added by the Bachata Calendar team.' : null;

/**
 * AW1 (admin #838): an owner or manager save that would delete a session with per-date changes is refused (an admin
 * may remove it). This sentence is for the Differs card only: it follows the list of dates it calls "those dates".
 */
export const CHANGED_SESSION_REMOVE = 'A session you changed on one of those dates can only be removed by the Bachata Calendar team.';

/**
 * The same refusal in the remove confirm (FIX-INT4 S-2). The confirm lists no dates, and the server refuses for a
 * change on ANY date, past or cancelled included (the Differs card lists upcoming ones only), so it says that.
 */
export const CHANGED_SESSION_REMOVE_CONFIRM = 'If this session was changed on any date, past ones included, only the Bachata Calendar team can remove it.';

/** The remove confirm: true about what happens, including the sessions changed on a date (refused, see above). */
export const removeConfirmCopy = (name: string) =>
  `Remove \u201c${name}\u201d from every date? It comes off when you save. ${CHANGED_SESSION_REMOVE_CONFIRM}`;

// ---- RECENT people (organiser_series_cast_v1.recent_people, pinned with AW1) ------------------

export interface RecentPerson { profileId: string; profileType: string; name: string; photoUrl: string | null; roles: string[] }

/** `{profile_id, profile_type, display_name, photo_url, roles[]}` rows; a row with no profile type is left out (never guessed). */
export function parseRecentPeople(data: unknown): RecentPerson[] {
  return arr(obj(data).recent_people).map(obj).flatMap((row): RecentPerson[] => {
    const id = str(row.profile_id);
    const type = str(row.profile_type);
    if (!id || !type) return [];
    return [{
      profileId: id,
      profileType: type,
      name: str(row.display_name)?.trim() || 'Unnamed',
      photoUrl: str(row.photo_url),
      roles: arr(row.roles).filter((r): r is string => typeof r === 'string'),
    }];
  });
}

/** The RECENT people a session of this role can take: their own profile type must hold the role (no role / both roles do not matter). */
export const recentFor = (recent: RecentPerson[], role: PeopleRole) => recent.filter((r) => rolesFor(r.profileType).includes(role));

// ---- summary lines ---------------------------------------------------------------------------

export const typeWord = (type: string | null) => (type && TYPE_LABEL[type]) || 'Session';
export const itemName = (it: Pick<PItem, 'type' | 'title'>) => it.title.trim() || typeWord(it.type);

/** "19:00-20:00" (+ "next day" marker), the start alone, or "No time yet". */
export function timeLine(it: Pick<PItem, 'start' | 'end'>): string {
  if (!it.start) return 'No time yet';
  if (!it.end) return it.start;
  return `${it.start}\u2013${it.end}${endsNextDay(it.start, it.end) ? ' (next day)' : ''}`;
}
/** "1h 30m" for a session with both times; '' otherwise. */
export function lengthLine(it: Pick<PItem, 'start' | 'end'>): string {
  if (!it.start || !it.end || it.start === it.end) return '';
  const m = sessionMinutes(it.start, it.end);
  return `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h ` : ''}${m % 60 ? `${m % 60}m` : ''}`.trim();
}

// ---- validation (the writer's rules, checked before the call) -------------------------------

export interface ItemProblem { key: string; field: 'title' | 'times' | 'type'; message: string }

export function validateTree(draft: PTree, original: PTree): ItemProblem[] {
  const was = new Map(allItems(original).map((i) => [i.key, i]));
  const out: ItemProblem[] = [];
  for (const it of allItems(draft)) {
    const o = was.get(it.key);
    if (!it.type || (!o && !(SESSION_TYPES as readonly string[]).includes(it.type))) out.push({ key: it.key, field: 'type', message: 'Choose what kind of session this is.' });
    if (!o || it.title.trim() !== o.title.trim()) {
      const p = titleProblem(it.title);
      if (p) out.push({ key: it.key, field: 'title', message: p });
    }
    if (!o || it.start !== o.start || it.end !== o.end) {
      const p = timesProblem(it.start, it.end);
      if (p) out.push({ key: it.key, field: 'times', message: p });
    }
  }
  return out;
}

// ---- the write ----------------------------------------------------------------------------------

const timeOut = (now: string, raw: unknown): string | null => {
  if (!now) return null;
  return typeof raw === 'string' && hhmm(raw) === now ? raw : now;
};

/** A stored row's id (AW1 upserts by it); a new row has none and sends none. */
const idOf = (raw: Raw): { id?: string } => (typeof raw.id === 'string' ? { id: raw.id } : {});

/** The days array series.set_program takes: the complete tree, every untouched field echoed. */
export function buildDays(tree: PTree): unknown[] {
  return tree.days.map((d, di) => ({
    ...idOf(d.raw),
    day_index: d.raw.day_index ?? di,
    date_offset_days: d.raw.date_offset_days ?? 0,
    label: d.raw.label ?? null,
    sort_order: di,
    sections: d.sections.filter((s) => s.items.length > 0 || s.storedEmpty).map((s, si) => ({
      ...idOf(s.raw),
      kind: s.kind,
      sort_order: si,
      label_override: s.raw.label_override ?? null,
      items: s.items.map((it, ii) => ({
        ...idOf(it.raw),
        title: it.title.trim(),
        type: it.type,
        start_time: timeOut(it.start, it.raw.start_time),
        end_time: timeOut(it.end, it.raw.end_time),
        room: it.raw.room ?? null,
        venue_room_id: it.raw.venue_room_id ?? null,
        level_keys: sessionLevels(it),
        style: it.raw.style ?? null,
        theme: it.raw.theme ?? null,
        track_id: it.raw.track_id ?? null,
        parallel_group_id: it.raw.parallel_group_id ?? null,
        sort_order: ii,
        people: it.people.map((p, pi) => ({ profile_id: p.profileId, profile_type: p.profileType, role: p.role, level: p.level ?? null, sort: pi })),
      })),
    })),
  }));
}

export const treeKey = (t: PTree) => JSON.stringify(buildDays(t));
export const treeDirty = (draft: PTree, original: PTree) => treeKey(draft) !== treeKey(original);

/** ONE series.set_program with the complete tree; null when nothing changed (an untouched Save sends nothing). */
export function programCommand(draft: PTree, original: PTree): OwnerCommand | null {
  return treeDirty(draft, original) ? setProgramCommand(buildDays(draft)) : null;
}

export { LEVEL_KEYS };
