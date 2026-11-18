/**
 * Organiser Round 4 (flag organiserR4): what Home shows through the day. Pure, so every
 * shape is a table-driven test. A stat with no real read is left out: never a zero claim.
 */
import type { HomeClock, PastNight } from '../dash/dashModel';

export const R4_TABS = ['home', 'events', 'tickets', 'team'] as const;
export type R4Tab = (typeof R4_TABS)[number];
export const R4_TAB_WORD: Record<R4Tab, string> = { home: 'Home', events: 'Events', tickets: 'Tickets', team: 'Team' };

export interface R4NextNight {
  seriesId: string;
  name: string;
  /** 'Tonight, 8pm' / 'Friday 20 November, 9pm'. */
  when: string;
  place: string | null;
  draft: boolean;
  link: string | null;
}

/** The door read for the next night (ticket_door_list_v3); null = no read (not ticketed, signed out, failed). */
export interface R4Door { sold: number | null; cameIn: number | null }

export interface R4Tile { key: 'sold' | 'in' | 'came' | 'raffle'; label: string; value: string; of: string | null }
export type R4Tone = 'ok' | 'live' | 'grey';
export interface R4HomeModel {
  face: HomeClock | 'empty';
  title: string;
  sub: string | null;
  pill: { word: string; tone: R4Tone } | null;
  tiles: R4Tile[];
  /** The ONE orange button. */
  primary: { kind: 'share' | 'door' | 'new'; label: string; disabled: boolean; reason: string | null };
  /** "How it went" lines after a night (raffle words); empty = none. */
  lines: string[];
}

const n = (v: number) => v.toLocaleString('en-GB');

function pillOf(face: HomeClock, when: string, draft: boolean): R4HomeModel['pill'] {
  if (draft) return { word: 'Draft', tone: 'grey' };
  if (face === 'night') return { word: 'Tonight', tone: 'live' };
  if (face === 'after') return { word: 'Done', tone: 'grey' };
  const day = when.split(',')[0];
  return { word: day, tone: 'ok' };
}

export function r4HomeOf(i: { clock: HomeClock; next: R4NextNight | null; door: R4Door | null; last: PastNight | null }): R4HomeModel {
  const { clock, next, door, last } = i;
  if (clock === 'after' && last) {
    const tiles: R4Tile[] = [];
    if (last.cameIn != null) tiles.push({ key: 'came', label: 'Came', value: n(last.cameIn), of: null });
    if (last.ticketsSold != null && last.ticketsSold > 0) tiles.push({ key: 'sold', label: 'Tickets sold', value: n(last.ticketsSold), of: null });
    return {
      face: 'after', title: last.name, sub: last.when, pill: pillOf('after', last.when, false), tiles,
      primary: next ? shareOf(next) : { kind: 'new', label: 'Add your next night', disabled: false, reason: null },
      lines: last.raffle ? [last.raffle] : [],
    };
  }
  if (!next) {
    return { face: 'empty', title: 'No nights coming up', sub: 'Add a night and it shows here, with who is going and tickets sold.', pill: null, tiles: [],
      primary: { kind: 'new', label: 'Add a night', disabled: false, reason: null }, lines: [] };
  }
  const face: HomeClock = clock === 'night' ? 'night' : 'before';
  const tiles: R4Tile[] = [];
  if (door?.sold != null && door.sold > 0) tiles.push({ key: 'sold', label: 'Tickets sold', value: n(door.sold), of: null });
  if (face === 'night' && door?.cameIn != null && door.sold != null && door.sold > 0) tiles.push({ key: 'in', label: 'Checked in', value: n(door.cameIn), of: `of ${n(door.sold)}` });
  return {
    face, title: next.name, sub: next.place ? `${next.when} at ${next.place}` : next.when, pill: pillOf(face, next.when, next.draft), tiles,
    primary: face === 'night' ? { kind: 'door', label: 'Open door mode', disabled: false, reason: null } : shareOf(next),
    lines: [],
  };
}

function shareOf(next: R4NextNight): R4HomeModel['primary'] {
  if (next.draft) return { kind: 'share', label: 'Share this night', disabled: true, reason: 'Publish this night first, then share it.' };
  if (!next.link) return { kind: 'share', label: 'Share this night', disabled: true, reason: 'This night has no public link yet.' };
  return { kind: 'share', label: 'Share this night', disabled: false, reason: null };
}

// ---- cont8: board R4EmptyHome and the "N things waiting for you" list (board R4HomeBefore) ----

/** Board R4EmptyHome: the page has no events at all (not just none coming up). */
export const R4_EMPTY_HOME = {
  title: 'No events yet',
  sub: 'Put your first night on and it shows here.',
  add: 'Add your first night',
  nextLabel: 'What happens next',
  steps: ['Add a night', 'Share the link so dancers can add themselves', 'On the night, tick people in at the door'] as const,
  aloneTitle: 'Only you so far',
  aloneLine: 'Add someone to help run your events or work the door.',
} as const;

/** "Only you so far" shows only when the team read is in and the caller is its one member. */
export function r4AloneOf(i: { teamReady: boolean; members: number; editor: boolean }): boolean {
  return i.teamReady && i.editor && i.members === 1;
}

/** The event facts the waiting list reads (a P3Row slice: the same row Events and the To do badge read). */
export interface R4WaitRow {
  id: string;
  name: string;
  lifecycle: string;
  place: string | null;
  cover: string | null;
  status: { key: string; past: boolean };
}
/** A join request (list_organiser_access_requests_v1). */
export interface R4WaitRequest { requestId: string; requesterEmail: string | null }

export type R4WaitGo = 'place' | 'event' | 'dates' | 'photo' | 'answer';
export interface R4WaitItem { key: string; title: string; detail: string; action: string; go: R4WaitGo; id: string }
export interface R4WaitModel { heading: string; items: R4WaitItem[]; more: number }

/** How many rows Home lists before "N more on Events" (prod 2026-11-18: one page has 11 to-dos). */
export const R4_WAIT_CAP = 5;

/**
 * One item per event, the first that applies, in this order: needs a place (draft, no place),
 * still a draft, live with no dates coming up, no photo. These are the To do badge's own three
 * facts (data/home needsOf: draft, status warn, no cover on a current event), counted per event
 * here. `todoIds` = the series the badge counts (strip todoSeriesIdsOf: cancelled left out).
 * Then join requests (owners and managers only). Refunds are not here: no refund-request read
 * exists (every refund is the owner's own move on an order).
 */
export function r4WaitingOf(i: { rows: readonly R4WaitRow[]; todoIds: ReadonlySet<string>; requests: readonly R4WaitRequest[] | null; editor: boolean }): R4WaitModel {
  const items: R4WaitItem[] = [];
  for (const r of i.rows) {
    if (!i.todoIds.has(r.id)) continue;
    const base = { key: `e-${r.id}`, title: r.name, id: r.id };
    if (r.lifecycle === 'draft' && !r.place) items.push({ ...base, detail: 'Needs a place before it can go live.', action: 'Add place', go: 'place' });
    else if (r.lifecycle === 'draft') items.push({ ...base, detail: 'Still a draft. Dancers cannot see it yet.', action: 'Open', go: 'event' });
    else if (r.status.key === 'warn') items.push({ ...base, detail: 'Live, but no dates coming up.', action: 'Add dates', go: 'dates' });
    else if (!r.cover && !r.status.past) items.push({ ...base, detail: 'No photo yet. It is the first thing dancers see.', action: 'Add photo', go: 'photo' });
  }
  if (i.editor) {
    for (const q of i.requests ?? []) {
      items.push({ key: `r-${q.requestId}`, title: `${q.requesterEmail?.trim() || 'Someone'} asked to join`, detail: 'Pick a role or say no.', action: 'Answer', go: 'answer', id: q.requestId });
    }
  }
  const n = items.length;
  return { heading: `${n} ${n === 1 ? 'thing' : 'things'} waiting for you`, items: items.slice(0, R4_WAIT_CAP), more: Math.max(0, n - R4_WAIT_CAP) };
}
