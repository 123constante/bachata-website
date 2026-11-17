import type { DoorList, DoorRow } from '../door/data';
import type { PastNight } from '../dash/dashModel';
import { P3_PATHS } from '../shell/paths';

/**
 * Slice 3: the two READ-ONLY sheets (Who is in on the night, Who came / did not come the day after),
 * built from ONE ticket_door_list_v3 answer by pure functions so every shape is table-testable.
 * Nothing here changes anything: no check-in, refund, message or export. There is no money on
 * either sheet, so a contributor sees exactly what an owner sees. A ticket with no buyer name is "Guest".
 */
export const GUEST = 'Guest';
export const NO_NAMES = 'Names are not available yet.';
export const ROW_CAP_NOTE = 'Showing the first 500 tickets. The number at the top is the full count.';

export type SheetFrom = 'home' | 'compare' | 'event';
const FROMS: readonly SheetFrom[] = ['home', 'compare', 'event'];

export interface SheetPerson { key: string; name: string; type: string | null }
export interface SheetList { title: string; testId: string; people: SheetPerson[]; empty: string | null }
export interface SheetModel {
  state: 'ok' | 'not_allowed' | 'no_night';
  /** The headline count; null = no read (never drawn as 0). */
  big: number | null;
  bigWord: string;
  /** "12 expected \u00b7 4 still to arrive" / "16 tickets for this night". */
  under: string | null;
  lists: SheetList[];
  /** One sentence instead of names (not allowed, no night, names missing, capped list). */
  note: string | null;
}

const n = (x: number) => x.toLocaleString('en-GB');
const personOf = (r: DoorRow): SheetPerson => ({ key: r.ticketId, name: r.firstName ?? GUEST, type: r.typeName });

function refused(d: DoorList, noNight: string): SheetModel | null {
  if (d.result === 'not_allowed') return { state: 'not_allowed', big: null, bigWord: '', under: null, lists: [], note: 'Only people on this event\u2019s team can see this list.' };
  if (d.result === 'wrong_night') return { state: 'no_night', big: null, bigWord: '', under: null, lists: [], note: noNight };
  return null;
}

/** Notes shared by both sheets: names the server did not send, and the 500-row cap. */
function notesOf(d: DoorList, shown: number, counted: number): string | null {
  if (d.truncated) return ROW_CAP_NOTE;
  return counted > 0 && shown === 0 ? NO_NAMES : null;
}

/** Who is in: checked-in names, the count as headline, expected / still to arrive underneath. */
export function whoIsInOf(d: DoorList, opts: { doorOnScreen: boolean }): SheetModel {
  const r = refused(d, 'This event has no night on right now.');
  if (r) return r;
  const people = d.rows.filter((x) => x.checkedInAt).map(personOf);
  const big = d.inCount ?? people.length;
  const total = d.totalCount;
  const under = total !== null && total > 0 ? `${n(total)} expected \u00b7 ${n(Math.max(0, total - big))} still to arrive` : null;
  const empty = big === 0
    ? (total === 0 ? 'Nobody has a ticket for this night yet.' : `Nobody has checked in yet.${opts.doorOnScreen ? ' Open Door to scan tickets.' : ''}`)
    : null;
  return { state: 'ok', big, bigWord: big === 1 ? 'person in' : 'people in', under,
    lists: [{ title: 'Checked in', testId: 'sheet-in-list', people, empty }], note: notesOf(d, people.length, big) };
}

/** Who came / did not come: two lists for one past night, Came first, the count as headline. */
export function whoCameOf(d: DoorList): SheetModel {
  const r = refused(d, 'We couldn\u2019t find this night.');
  if (r) return r;
  const came = d.rows.filter((x) => x.checkedInAt).map(personOf);
  const missed = d.rows.filter((x) => !x.checkedInAt).map(personOf);
  const big = d.inCount ?? came.length;
  const total = d.totalCount ?? d.rows.length;
  if (total === 0) {
    return { state: 'ok', big: 0, bigWord: 'people came', under: null, lists: [], note: 'Nobody had a ticket for this night, so there is no list.' };
  }
  const notCame = Math.max(0, total - big);
  return {
    state: 'ok', big, bigWord: big === 1 ? 'person came' : 'people came', under: `${n(total)} ${total === 1 ? 'ticket' : 'tickets'} for this night`,
    lists: [
      { title: `Came (${n(big)})`, testId: 'sheet-came-list', people: came, empty: big === 0 ? 'Nobody was checked in at the door that night.' : null },
      { title: `Did not come (${n(notCame)})`, testId: 'sheet-missed-list', people: missed, empty: notCame === 0 ? 'Everyone with a ticket came.' : null },
    ],
    note: notesOf(d, came.length + missed.length, total),
  };
}

export const fromOf = (v: string | null): SheetFrom | null => (v && (FROMS as readonly string[]).includes(v) ? (v as SheetFrom) : null);

/** Where the sheet's back goes: where it was opened from, else the event's page. */
export function sheetBackOf(from: SheetFrom | null, seriesId: string, homeWord: { to: string; label: string }): { to: string; label: string } {
  if (from === 'home') return homeWord;
  if (from === 'compare') return { to: P3_PATHS.compare, label: 'Compare nights' };
  return { to: P3_PATHS.event(seriesId), label: 'Event' };
}

/** Who came link for a past night, or null (cancelled, or no occurrence read): never a link to an empty sheet. */
export function whoCameLinkOf(p: PastNight, from: SheetFrom): string | null {
  return p.cancelled || !p.occurrenceId ? null : P3_PATHS.whoCame(p.seriesId, p.occurrenceId, from);
}

/** Who is in link for a night, or null for a draft or cancelled night (no door, no sheet). */
const NO_DOOR_LIFECYCLES = new Set(['draft', 'ended', 'cancelled', 'archived']);

/** The event page's Who is in row: the same rule as Home's, from the event's lifecycle and whether a night is still to come. */
export function eventWhoIsInLinkOf(seriesId: string, lifecycle: string, hasComingNight: boolean): string | null {
  return whoIsInLinkOf({ seriesId, draft: lifecycle === 'draft', cancelled: !hasComingNight || NO_DOOR_LIFECYCLES.has(lifecycle) }, 'event');
}

export function whoIsInLinkOf(night: { seriesId?: string; draft?: boolean; cancelled: boolean } | null, from: SheetFrom): string | null {
  return night?.seriesId && !night.draft && !night.cancelled ? P3_PATHS.whoIsIn(night.seriesId, from) : null;
}
