import { canManage, canRefund, formatCount, formatPence, totalsOf, type TicketType, type TypeSales } from '../../tickets/ticketModel';
import { addWhy } from '../tickets/model';
import type { P3Row } from '../data/home';
import { r4EventRowOf } from './r4EventsModel';
import type { R4Tone } from './r4Model';

/**
 * Board R4Tickets (one night in focus), R4EmptyTickets (no tickets / could not load). Every number is a
 * real read; a stat with no read is not drawn. The board's "9 sold in the last 2 days", the sell-out guess
 * and the Reminders row have no read or no backend here, so they are never in this model.
 */
export type R4TicketsState = 'loading' | 'error' | 'empty' | 'ready';

export interface R4TicketsModel {
  state: R4TicketsState;
  title: string;
  /** "Friday 20 November, 9pm, Soho Dance Studio", or null. */
  when: string | null;
  pill: { word: string; tone: R4Tone } | null;
  /** The big number. null = no read (hidden). `of` only when the night's places are known (a one-off). */
  big: { sold: number; of: number | null; pct: number | null; label: string } | null;
  /** The next batch that is not on sale yet, and whether this person can open it now. */
  batch: { line: string; open: { id: string; name: string } | null; openWhy: string | null } | null;
  /** "N orders" on Who bought, or null while the summary is not known. */
  who: string | null;
  /** "pounds 402 so far" on Money and payouts: the owner only, and only when the server shows money. */
  money: string | null;
  /** Empty state: why "Add a ticket" is off, or null. */
  addWhy: string | null;
}

export interface R4TicketsInput {
  row: P3Row | null;
  role: string | null;
  /** The series' ticket types; null while loading. */
  types: readonly TicketType[] | null;
  /** Sales summary rows for this series; null while loading or not known. */
  sales: readonly TypeSales[] | null;
  /** The server says money may be shown (ticket_sales_summary_v1 moneyVisible). */
  moneyVisible: boolean;
  /** ticket_door_list_v3 tickets for the next night; null = no read. */
  doorSold: number | null;
  error: boolean;
}

export const NO_NAME = 'No name yet';

export function r4TicketsOf(i: R4TicketsInput): R4TicketsModel {
  const er = i.row ? r4EventRowOf(i.row) : null;
  const base = {
    title: i.row?.name.trim() || NO_NAME,
    when: er?.when ?? null,
    pill: er?.pill ?? null,
    addWhy: addWhy(i.role as Parameters<typeof addWhy>[0], i.row?.lifecycle === 'live'),
  };
  const none = { big: null, batch: null, who: null, money: null };
  if (i.error) return { state: 'error', ...base, ...none };
  if (i.types === null) return { state: 'loading', ...base, ...none };
  if (i.types.length === 0) return { state: 'empty', ...base, ...none };

  // Only a one-off's series-wide types are exactly one night's (festival passes and repeating nights are not).
  const oneOff = i.row?.kind === 'oneoff';
  const totals = i.sales ? totalsOf(i.sales) : null;
  // The night's own count first (door list); a one-off's series total is the same night.
  const sold = i.doorSold ?? (oneOff && totals ? totals.ticketsSold : null);
  // Places are per series: they are one night's places only on a one-off, and only once every reserved count is known.
  const known = i.types.every((t) => t.reservedKnown);
  const of = oneOff && known ? i.types.reduce((n, t) => n + Math.max(0, t.capacity), 0) : null;
  const big = sold === null ? null : {
    sold,
    of: of && of > 0 ? of : null,
    pct: of && of > 0 ? Math.min(100, Math.round((sold / of) * 10000) / 100) : null,
    label: of && of > 0 ? `${formatCount(sold)} of ${formatCount(of)} tickets sold` : `${formatCount(sold)} tickets sold`,
  };

  const next = i.types.find((t) => t.status === 'draft' || t.status === 'paused') ?? null;
  const manager = canManage(i.role as Parameters<typeof canManage>[0]);
  const batch = {
    line: next ? `${next.name} is not on sale yet.` : `${formatCount(i.types.length)} ${i.types.length === 1 ? 'ticket' : 'tickets'} to choose from.`,
    open: next ? { id: next.id, name: next.name } : null,
    openWhy: next && !manager ? 'Only the owner or a manager can open tickets.' : null,
  };
  const who = totals ? `${formatCount(totals.ordersPaid)} ${totals.ordersPaid === 1 ? 'order' : 'orders'}` : null;
  const money = totals && i.moneyVisible && canRefund(i.role as Parameters<typeof canRefund>[0])
    ? `${formatPence(totals.grossPence - totals.refundedPence)} so far`
    : null;
  return { state: 'ready', ...base, big, batch, who, money };
}
