import type { P3Row } from '../data/home';
import { r4EventRowOf } from './r4EventsModel';
import type { R4Door, R4Tile, R4Tone } from './r4Model';

/** Board R4Night: one night in focus. Every number is a real read; a stat with no read is not drawn. */
export interface R4NightModel {
  title: string;
  /** "Friday 20 November, 21:00, Soho Dance Studio"; null when there is no date and no place. */
  when: string | null;
  /** "Every Friday" style words, plus "N dates coming up" when the series repeats. */
  repeat: string | null;
  pill: { word: string; tone: R4Tone } | null;
  tiles: R4Tile[];
  /** The next night's date (the one Going, Tickets and Raffle are about), or null. */
  nightDate: string | null;
  /** Cancel this night: on only when the server-side plan has a date to cancel. */
  cancel: { on: boolean; why: string | null };
  /** Door / Who is in reads only make sense for a night that is on the calendar. */
  doorRead: boolean;
}

export interface R4NightInput {
  row: P3Row | null;
  /** The workspace's own name (the row may be missing while home_v1 reloads). */
  name: string;
  place: string | null;
  /** repeatWords(...) for a repeating series, else null. */
  repeatWords: string | null;
  door: R4Door | null;
  /** cancelPlan(ws, today) found a date to cancel. */
  cancellable: boolean;
}

export const NO_NAME = 'No name yet';

export function r4NightOf(i: R4NightInput): R4NightModel {
  const er = i.row ? r4EventRowOf(i.row) : null;
  const when = er?.when ?? i.place ?? null;
  const repeatParts = [i.repeatWords?.trim().replace(/\.$/, '') || null, er?.extra && er.extra !== 'Needs a place' ? er.extra : null].filter(Boolean);
  const draft = i.row?.lifecycle === 'draft';
  const nightDate = i.row?.next && i.row.next.status !== 'cancelled' ? i.row.next.date : null;
  const tiles: R4Tile[] = [];
  if (i.door && i.door.sold !== null) tiles.push({ key: 'sold', label: 'Tickets sold', value: String(i.door.sold), of: null });
  if (i.door && i.door.cameIn !== null && i.door.cameIn > 0) tiles.push({ key: 'in', label: 'Checked in', value: String(i.door.cameIn), of: null });
  let cancel: R4NightModel['cancel'];
  if (i.cancellable) cancel = { on: true, why: null };
  else if (i.row?.status.past || i.row?.status.key === 'finished') cancel = { on: false, why: 'This event has finished. There is no night to cancel.' };
  else cancel = { on: false, why: 'There is no date coming up to cancel.' };
  return {
    title: i.name.trim() || NO_NAME,
    when,
    repeat: repeatParts.length ? repeatParts.join(', ') : null,
    pill: er?.pill ?? null,
    tiles,
    nightDate,
    cancel,
    doorRead: !!nightDate && !draft,
  };
}

/** Board R4Cancel copy. The "N going will be told, N refunded" line has no backing (nothing tells or refunds on cancel), so it is not here. */
export const CANCEL_R4_COPY = {
  title: (name: string) => `Cancel ${name.trim() || NO_NAME}?`,
  day: (day: string) => `${day}. Dancers will see \u2018Cancelled\u2019. You can bring it back any time.`,
  noReasons: 'The reasons didn\u2019t load. Check your connection, then try again.',
} as const;
