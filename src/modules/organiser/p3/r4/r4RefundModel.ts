import type { WorkspaceDate } from '../../shared/seriesModel';
import type { NightRefundDone, NightRefundSummary, RefundOrderRow } from '../door/refundData';
import { gbp } from './r4MoneyModel';

/*
 * Board R4 cancel refund (DESIGN-REGISTRY rows 52-55, option B). Under the numbers of a CANCELLED night: what is
 * left to refund, Refund all, and a Refund per order. Owner seat and admin only: the summary read answers
 * not_allowed to everyone else and this model then draws nothing. Free orders are never listed (the server leaves
 * them out). The fee goes back to buyers; nothing here promises buyers anything.
 */

/** How far back a cancelled night keeps its refund block (a night cancelled late, or not refunded before it passed). */
export const REFUND_LOOKBACK_DAYS = 28;
/** At most this many cancelled nights get a block (each is one summary read). */
export const REFUND_MAX_NIGHTS = 3;

const minusDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

/**
 * The cancelled nights that may still have money to give back: cancelled dates from REFUND_LOOKBACK_DAYS ago on,
 * nearest to today first. A night with nothing listed draws nothing (refundBlockOf), so most cost one quiet read.
 */
export function cancelledNightsOf(dates: readonly WorkspaceDate[], today: string): { occurrenceId: string; date: string }[] {
  const from = minusDays(today, REFUND_LOOKBACK_DAYS);
  const dist = (d: string) => Math.abs(Date.parse(d) - Date.parse(today));
  return dates
    .filter((d) => d.lifecycle_status === 'cancelled' && d.occurrence_date >= from)
    .sort((a, b) => dist(a.occurrence_date) - dist(b.occurrence_date) || a.occurrence_date.localeCompare(b.occurrence_date))
    .slice(0, REFUND_MAX_NIGHTS)
    .map((d) => ({ occurrenceId: d.id, date: d.occurrence_date }));
}

/** The screen's gate: flag off (organiserTicketing && organiserCancelRefund) = no nights, no read, page as before. */
export const refundNightsOf = (on: boolean, dates: readonly WorkspaceDate[], today: string) => (on ? cancelledNightsOf(dates, today) : []);

const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;
export const nameOf = (o: Pick<RefundOrderRow, 'firstName'>) => o.firstName ?? 'No name';

export const REFUND_COPY = {
  title: 'Refunds',
  /** Which night: the page's dates and tiles are the next night that is on, so the block names its own. */
  night: (day: string) => `Refunds, cancelled ${day}`,
  line: (n: number, pence: number) => `${orders(n)} to refund, ${gbp(pence)}`,
  none: 'Nothing left to refund.',
  noPaid: 'No paid tickets to refund.',
  doneUnclear: 'Done. Refresh to check the list.',
  all: 'Refund all',
  one: 'Refund',
  refunded: 'Refunded',
  mixed: 'Also on other nights. Refund it on its own.',
  askAll: (n: number, pence: number) => `Refund ${orders(n)}, ${gbp(pence)}?`,
  askOne: (o: RefundOrderRow) => (o.remainingPence === null ? `Refund ${nameOf(o)}?` : `Refund ${nameOf(o)}, ${gbp(o.remainingPence)}?`),
  askOneMixed: 'This order has other nights too. The whole order is refunded.',
  go: 'Refund',
  keep: 'Keep',
  loading: 'Loading refunds\u2026',
  error: 'Refunds didn\u2019t load.',
  retry: 'Try again',
  changed: 'The amount changed since you looked. Check it, then refund again.',
  failed: 'The refund didn\u2019t go through. Nothing changed. Try again.',
  unsure: 'We couldn\u2019t confirm the refund. Check the list before you try again.',
  freeFailed: 'Free tickets for this night were not closed yet. Tap Refund all again later, or ask us.',
  notConfigured: 'Refunds are not switched on yet.',
  partial: (done: number, names: string[]) => `${orders(done)} refunded. Not refunded yet: ${names.join(', ')}. Tap Refund all to try those again.`,
  done: (n: number) => `${orders(n)} refunded.`,
  doneOne: (name: string) => `${name} refunded.`,
} as const;

export interface RefundRowView { order: RefundOrderRow; name: string; tickets: string; amount: string; canRefund: boolean; note: string | null }
export interface RefundBlock { line: string; allOn: boolean; rows: RefundRowView[] }

/** null = draw nothing (not owner/admin, wrong night, night not cancelled, no paid order on it). */
export function refundBlockOf(s: NightRefundSummary | undefined): RefundBlock | null {
  if (!s || s.kind !== 'ok' || !s.nightCancelled || s.orders.length === 0) return null;
  return {
    line: s.ordersToRefund > 0 ? REFUND_COPY.line(s.ordersToRefund, s.penceToRefund) : s.orders.every((o) => o.refunded) ? REFUND_COPY.none : REFUND_COPY.noPaid,
    allOn: s.ordersToRefund > 0,
    rows: s.orders.map((o) => ({
      order: o,
      name: nameOf(o),
      tickets: o.tickets === null ? '' : `${o.tickets} ${o.tickets === 1 ? 'ticket' : 'tickets'}`,
      amount: o.remainingPence === null ? '' : gbp(o.remainingPence),
      // an unknown amount is not a refunded order: only the server's own refunded flag (or nothing left) says Refunded
      canRefund: !o.refunded && o.remainingPence !== 0,
      note: !o.refunded && o.mixedNights ? REFUND_COPY.mixed : null,
    })),
  };
}

/** What a Refund all press says, given the orders it was about (for names of the ones that failed). */
export function nightDoneText(d: NightRefundDone, list: readonly RefundOrderRow[]): { text: string; ok: boolean } {
  const free = d.freeFailed ? ` ${REFUND_COPY.freeFailed}` : '';
  if (d.failed.length === 0 && d.refunded === 0) return { text: REFUND_COPY.doneUnclear + free, ok: !d.freeFailed };
  if (d.failed.length === 0) return { text: REFUND_COPY.done(d.refunded) + free, ok: !d.freeFailed };
  const byId = new Map(list.map((o) => [o.orderId, nameOf(o)]));
  return { text: REFUND_COPY.partial(d.refunded, d.failed.map((id) => byId.get(id) ?? nameOf({ firstName: null }))) + free, ok: false };
}
