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
