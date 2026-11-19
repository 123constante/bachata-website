import type { DoorList, DoorRow } from '../door/data';

/** Board R4Night guest list (option B): chips All / In / Not yet. The v3 door list carries no per-row refund state (refunded tickets are dropped server-side for money staff), so there is no Refunded chip. */
export type GuestChip = 'all' | 'in' | 'not_yet';
export const GUEST_CHIPS: ReadonlyArray<{ key: GuestChip; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'in', label: 'In' }, { key: 'not_yet', label: 'Not yet' },
];

export const GUEST_COPY = {
  title: 'Guest list',
  loading: 'Loading the guest list\u2026',
  empty: 'No tickets yet',
  emptyChip: (chip: GuestChip) => (chip === 'in' ? 'Nobody has checked in yet.' : 'Everyone is in.'),
  error: 'Could not load the guest list.',
  retry: 'Try again',
  noNight: 'There is no night on now, so there is no guest list.',
  noName: 'No name given',
  notYet: 'Not yet',
  truncated: (shown: number, total: number | null) => `Showing the first ${shown}${total !== null && total > shown ? ` of ${total}` : ''}.`,
} as const;

export type GuestListView =
  | { kind: 'hidden' }
  | { kind: 'no_night' }
  | { kind: 'empty' }
  | { kind: 'rows'; rows: DoorRow[]; truncated: string | null };

/** not_allowed hides the list entirely; wrong_night and an empty list say so. */
export function guestViewOf(d: DoorList): GuestListView {
  if (d.result === 'not_allowed') return { kind: 'hidden' };
  if (d.result === 'wrong_night') return { kind: 'no_night' };
  if (!d.rows.length) return { kind: 'empty' };
  return { kind: 'rows', rows: d.rows, truncated: d.truncated ? GUEST_COPY.truncated(d.rows.length, d.totalCount) : null };
}

export function filterGuests(rows: readonly DoorRow[], chip: GuestChip): DoorRow[] {
  if (chip === 'in') return rows.filter((r) => r.checkedInAt);
  if (chip === 'not_yet') return rows.filter((r) => !r.checkedInAt);
  return [...rows];
}

export function chipCounts(rows: readonly DoorRow[]): Record<GuestChip, number> {
  const inn = rows.filter((r) => r.checkedInAt).length;
  return { all: rows.length, in: inn, not_yet: rows.length - inn };
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });

export function guestRowOf(r: DoorRow) {
  const t = r.checkedInAt ? new Date(r.checkedInAt) : null;
  const time = t && !Number.isNaN(t.getTime()) ? TIME.format(t) : null;
  const n = r.quantity ?? 1;
  return {
    name: r.firstName ?? GUEST_COPY.noName,
    tickets: `${n} ${n === 1 ? 'ticket' : 'tickets'}`,
    type: r.typeName,
    isIn: !!r.checkedInAt,
    status: r.checkedInAt ? (time ? `In ${time}` : 'In') : GUEST_COPY.notYet,
  };
}
