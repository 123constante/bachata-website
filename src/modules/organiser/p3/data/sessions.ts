import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  addSession, allItems, parseTree, profileTypeOf, programCommand, removeSession, updateItem, validateTree,
  type PItem, type PTree,
} from '../../events/programmeSeriesModel';
import {
  buildPayload, isDirty, isEditableRole, LEVEL_TYPES, newSession, sessionLevels, toDraft, validateProgramme,
  type DraftPerson, type DraftSession, type PeopleRole, type Programme, type SessionType,
} from '../../shared/programmeModel';
import { fetchOccurrenceProgramme, occurrenceProgrammeQueryKey, saveOccurrenceProgramme } from '../../shared/selfServeApi';
import { commandErrorMessage, isNetworkFailure, isOnboardingRefusal, programmeErrorCopy } from '../../shared/selfServeErrors';
import { eventWorkspaceQueryKey, useSendOnce } from '../../shared/runCommands';
import { invalidatePublicViews } from '../../shared/publicViewKeys';
import { newIdempotencyKey, type OwnerCommand } from '../../shared/seriesCommands';
import { AW1_APPLIED } from '../../shared/parityGate';
import type { EventWorkspace } from '../../events/eventModel';
import { dateStateOf, type ProgrammeFacts, type Scope } from '../model/programme';
import { kindOfWorkspace } from './eventPage';
import type { IsoDate } from '../model';

/**
 * W2d data: the session and line-up sheets' reads and the two writes.
 *  - Every date: series.set_program {days} with the WHOLE programme
 *    (programmeSeriesModel.buildDays: every stored id and untouched field echoed),
 *    against the series version (expected_version), one idempotency key per
 *    command kept until it lands (a retry is the same write).
 *  - Just this date: organiser_set_occurrence_programme_v1 with the COMPLETE
 *    programme of the date (programmeModel.buildPayload; people_add / people_remove),
 *    against the date programme's version; read with organiser_get_occurrence_programme_v1.
 * An untouched save builds nothing (null), so nothing is sent.
 */

/** What the session sheet edits, in either scope. */
export interface SessForm {
  type: string | null;
  title: string;
  /** 'HH:MM' or ''. */
  start: string;
  end: string;
  levels: string[];
  /** venue_rooms id; null = no room. Every date only. */
  roomId: string | null;
}

export interface Room { id: string; name: string }

/** The section a new session of this type lives in (the admin's kinds; a performance sits in `showcase`). */
const SECTION_FOR: Record<string, string> = { class: 'classes', masterclass: 'masterclass', party: 'party', performance: 'showcase' };

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const emptyForm = (type: SessionType = 'class'): SessForm => ({ type, title: '', start: '', end: '', levels: [], roomId: null });

export const formOfItem = (it: PItem): SessForm => ({
  type: it.type, title: it.title, start: it.start, end: it.end, levels: it.levels, roomId: str(it.raw.venue_room_id),
});

export const formOfDraft = (d: DraftSession): SessForm => ({
  type: d.type, title: d.title, start: d.start, end: d.end, levels: d.levels, roomId: d.original ? str(d.original.venue_room_id) : null,
});

/** A form with only the levels its type takes (a party carries none). */
const clean = (f: SessForm): SessForm => ({ ...f, levels: sessionLevels({ type: f.type, levels: f.levels }) });

export const sameForm = (a: SessForm, b: SessForm) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

/** The facts the rule set reads, for a workspace and a scope. */
export function factsOf(ws: EventWorkspace, scope: Scope, date: ProgrammeFacts['date'], item: ProgrammeFacts['item']): ProgrammeFacts {
  return { kind: kindOfWorkspace(ws), lifecycle: ws.series.lifecycle_status, gate: AW1_APPLIED, scope, date, item };
}

/** A workspace date as the rules read it, plus the reader's verdict once loaded. */
export function dateFactsFor(d: { occurrence_date: IsoDate; lifecycle_status: string }, today: IsoDate, prog?: Programme | null): NonNullable<ProgrammeFacts['date']> {
  return {
    state: dateStateOf(d.occurrence_date, d.lifecycle_status === 'cancelled', today),
    editable: prog ? prog.editable : undefined,
    notEditableReason: prog ? prog.notEditableReason : null,
  };
}

// ---- every date (series.set_program) --------------------------------------------------

export const seriesTree = (ws: EventWorkspace): PTree => parseTree(ws.program);

export const itemOf = (tree: PTree, key: string): PItem | null => allItems(tree).find((i) => i.key === key) ?? null;

/** The stored id behind a P3 session id ('i:<uuid>'), or null for a new one. */
export const itemIdOf = (key: string): string | null => (key.startsWith('i:') ? key.slice(2) : null);

export interface Built { command: OwnerCommand | null; problem: string | null }

/**
 * #25: a session with a name and no time (or nobody on it) is still a session: it
 * saves and renders ("No time yet"), never dropped as "empty". So a blank PAIR of
 * times passes here (223 prod items are like that); a half-filled time is still
 * stopped before the send. A stored untitled item (239 on prod) passes because
 * validateTree checks a name only when it changes; a NEW session needs a name, the
 * same rule as Just this date (review r1 #2: the server would store a nameless one).
 */
function problemsOf(draft: PTree, tree: PTree) {
  const byKey = new Map(allItems(draft).map((i) => [i.key, i]));
  return validateTree(draft, tree).filter((p) => {
    const it = byKey.get(p.key);
    if (!it) return true;
    if (p.field === 'times') return !!(it.start || it.end);
    return true;
  });
}

function built(draft: PTree, tree: PTree): Built {
  const p = problemsOf(draft, tree)[0];
  return { command: p ? null : programCommand(draft, tree), problem: p?.message ?? null };
}

function withForm(it: PItem, f: SessForm, rooms: Room[]): Partial<PItem> {
  const c = clean(f);
  const patch: Partial<PItem> = { type: c.type, title: c.title, start: c.start, end: c.end, levels: c.levels };
  const was = str(it.raw.venue_room_id);
  if (c.roomId !== was) {
    const room = rooms.find((r) => r.id === c.roomId) ?? null;
    patch.raw = { ...it.raw, venue_room_id: room?.id ?? null, room: room?.name ?? null };
  }
  return patch;
}

/** Save a session's fields for every date. command null + problem null = nothing changed. */
export function everyEdit(tree: PTree, key: string, f: SessForm, rooms: Room[] = []): Built {
  const it = itemOf(tree, key);
  if (!it) return { command: null, problem: null };
  return built(updateItem(tree, key, withForm(it, f, rooms)), tree);
}

/** Add a session to every date. */
export function everyAdd(tree: PTree, f: SessForm, rooms: Room[] = []): Built {
  const type = f.type ?? 'class';
  const { tree: next, key } = addSession(tree, SECTION_FOR[type] ?? 'party', type);
  const it = itemOf(next, key)!;
  return built(updateItem(next, key, withForm(it, f, rooms)), tree);
}

/** Remove a session from every date (the server refuses one with per-date changes: COMMAND_COPY names it). */
export const everyRemove = (tree: PTree, key: string): Built => built(removeSession(tree, key), tree);

/** A stored item's line-up as the line-up sheet edits it. */
export const peopleOfItem = (it: PItem): DraftPerson[] =>
  it.people.map((p) => ({ id: p.profileId, name: p.name, role: p.role, origin: 'stored', removed: false }));

/** Save a line-up for every date: kept stored people as they were (type, level), the added ones after. */
export function everyLineup(tree: PTree, key: string, people: DraftPerson[]): Built {
  const it = itemOf(tree, key);
  if (!it) return { command: null, problem: null };
  const kept = it.people.filter((p) => !people.some((q) => q.id === p.profileId && q.origin === 'stored' && q.removed));
  const added = people
    .filter((p) => p.origin === 'added' && !p.removed && isEditableRole(p.role))
    .map((p) => ({ profileId: p.id, name: p.name, profileType: profileTypeOf(p.role as PeopleRole), role: p.role, level: null }));
  return built(updateItem(tree, key, { people: [...kept, ...added] }), tree);
}

// ---- just this date (organiser_set_occurrence_programme_v1) ----------------------------

export interface DateBuilt { payload: Record<string, unknown>[] | null; problem: string | null }

function dateBuilt(next: DraftSession[], was: DraftSession[]): DateBuilt {
  const p = validateProgramme(next).rows[0];
  if (p) return { payload: null, problem: p.message };
  return { payload: isDirty(next, was.length) ? buildPayload(next) : null, problem: null };
}

/** The per-date draft for a series session ('i:<id>' -> 's:<id>'), or an added one by its own key. */
export const draftFor = (drafts: DraftSession[], key: string): DraftSession | null =>
  drafts.find((d) => d.key === key || (itemIdOf(key) !== null && d.key === `s:${itemIdOf(key)}`)) ?? null;

/** True for a session added to this date only (added_session_id). */
export const isExtra = (d: DraftSession) => !!d.original && typeof d.original.added_session_id === 'string';

const patchDraft = (drafts: DraftSession[], key: string, fn: (d: DraftSession) => DraftSession) =>
  drafts.map((d) => (d.key === key ? fn(d) : d));

/** Save a session's name, times and levels for this date only (its kind and room stay: the writer refuses them). */
export function dateEdit(drafts: DraftSession[], key: string, f: SessForm): DateBuilt {
  const c = clean(f);
  return dateBuilt(patchDraft(drafts, key, (d) => ({ ...d, title: c.title, start: c.start, end: c.end, levels: c.levels })), drafts);
}

/** Not running on this date (a series session) or removed from it (an added one); `on` false brings it back. */
export const dateOff = (drafts: DraftSession[], key: string, off: boolean): DateBuilt =>
  dateBuilt(patchDraft(drafts, key, (d) => ({ ...d, removed: off })), drafts);

/** Add a session to this date only. */
export function dateAdd(drafts: DraftSession[], f: SessForm): DateBuilt {
  const c = clean(f);
  const s = { ...newSession((c.type ?? 'class') as SessionType), title: c.title, start: c.start, end: c.end, levels: c.levels };
  return dateBuilt([...drafts, s], drafts);
}

/** Save this date's line-up of one session (people_add / people_remove). */
export const dateLineup = (drafts: DraftSession[], key: string, people: DraftPerson[]): DateBuilt =>
  dateBuilt(patchDraft(drafts, key, (d) => ({ ...d, people })), drafts);

/** True when the line-up would send a change (people_add / people_remove, or a different set_program people list). */
export const lineupChanged = (people: DraftPerson[]) =>
  people.some((p) => (p.origin === 'added' && !p.removed) || (p.origin === 'stored' && p.removed));

export const datePeople = (d: DraftSession): DraftPerson[] => d.people ?? [];

// ---- reads ------------------------------------------------------------------------------

export function useDateProgramme(occurrenceId: string | null) {
  return useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrenceId ?? undefined),
    queryFn: () => fetchOccurrenceProgramme(occurrenceId as string),
    enabled: !!occurrenceId,
  });
}

export const draftsOf = (p: Programme): DraftSession[] => toDraft(p.sessions, p.sessionPeople);

export const venueRoomsKey = (venueId: string | null) => ['p3-venue-rooms', venueId] as const;

/** The venue's rooms (venue_rooms is publicly readable). Chips show only when it has 2 or more. */
export function useVenueRooms(venueId: string | null) {
  return useQuery({
    queryKey: venueRoomsKey(venueId),
    enabled: !!venueId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase.from('venue_rooms').select('id, name, sort_order').eq('venue_id', venueId as string).is('archived_at', null).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
    },
  });
}

export const levelsApply = (type: string | null) => (LEVEL_TYPES as readonly string[]).includes(type ?? '');

// ---- writes -----------------------------------------------------------------------------

/**
 * Every-date send: ONE series.set_program per tap under a key kept for that exact
 * envelope (command AND expected_version) until it lands, so a retry after a dropped
 * connection is the same write. The server (apply_aggregate_write_p5, read on prod
 * 2026-10-27) looks a key up by actor and key alone and replays the stored answer,
 * whatever the envelope; it stores one only on success. So a key never outlives its
 * version (a reload at a new version mints a fresh one), and a definitive refusal
 * drops it: only a network failure keeps it for the retry (review r1 #3).
 */
export function useEverySend(ws: EventWorkspace) {
  const once = useSendOnce(ws.series.id);
  const keys = useRef(new Map<string, string>());
  // `version` is the one the typing started on when the sheet has typing (PR #1082 r1 #1), else the stored one
  return async (command: OwnerCommand, version: number = ws.series.version): Promise<void> => {
    const id = `${version}|${JSON.stringify(command)}`;
    const key = keys.current.get(id) ?? newIdempotencyKey();
    keys.current.set(id, key);
    try {
      await once(command, version, key);
      keys.current.delete(id);
    } catch (e) {
      if (!isNetworkFailure(e)) keys.current.delete(id);
      throw e;
    }
  };
}

/** Every-date refusals in plain words (COMMAND_COPY; never raw server text). */
export const everyErrorCopy = (e: unknown) => commandErrorMessage(e);

/** A per-date refusal already in plain words (PROGRAMME_COPY). */
export class DateSaveError extends Error {}

/** The words for any write error from either scope. */
export const saveErrorCopy = (e: unknown) => (e instanceof DateSaveError ? e.message : everyErrorCopy(e));

/**
 * Just-this-date send against the programme version it was read at. A refusal that
 * means the screen is stale reloads the date's programme (the copy says so).
 */
export function useDateSend(ws: EventWorkspace, occurrenceId: string | null) {
  const qc = useQueryClient();
  const reload = () => {
    void qc.invalidateQueries({ queryKey: occurrenceProgrammeQueryKey(occurrenceId ?? undefined) });
    void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(ws.series.id) });
    invalidatePublicViews(qc, ws.series.id);
  };
  return async (version: number, payload: Record<string, unknown>[]): Promise<void> => {
    try {
      await saveOccurrenceProgramme(occurrenceId as string, version, payload);
      reload();
    } catch (e) {
      // the onboarding refusal goes up as itself, so the sheet's gatedCopy opens the A1 gate (P3-GATE)
      if (isOnboardingRefusal(e)) throw e;
      const c = programmeErrorCopy(e);
      if (c.reload) reload();
      throw new DateSaveError(c.message);
    }
  };
}
