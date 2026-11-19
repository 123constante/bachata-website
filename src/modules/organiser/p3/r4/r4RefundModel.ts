import type { WorkspaceDate } from '../../shared/seriesModel';
import type { NightRefundDone, NightRefundSummary, RefundOrderRow } from '../door/refundData';
import { gbp } from './r4MoneyModel';

/*
 * Board R4 cancel refund (DESIGN-REGISTRY rows 52-55, option B). Under the numbers of a CANCELLED night: what is
 * left to refund, Refund all, and a Refund per order. Owner seat and admin only: the summary read answers
 * not_allowed to everyone else and this model then draws nothing. Free orders are never listed (the server leaves
 * them out). The fee goes back to buyers; nothing here promises buyers anything.
 */

/** The night in focus is the earliest date from today on; it is a cancelled night when that date is cancelled. */
export function cancelledFocusOf(dates: readonly WorkspaceDate[], today: string): { occurrenceId: string; date: string } | null {
  const first = [...dates].filter((d) => d.occurrence_date >= today).sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))[0];
  return first && first.lifecycle_status === 'cancelled' ? { occurrenceId: first.id, date: first.occurrence_date } : null;
}

/** The screen's gate: flag off (organiserTicketing && organiserCancelRefund) = no cancelled night, so no block and the door list as before. */
export const refundNightOf = (on: boolean, dates: readonly WorkspaceDate[], today: string) => (on ? cancelledFocusOf(dates, today) : null);

const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;
const nameOf = (o: RefundOrderRow) => o.firstName ?? 'No name';

export const REFUND_COPY = {
  title: 'Refunds',
  /** Which night: the page's dates and tiles are the next night that is on, so the block names its own. */
  night: (day: string) => `Refunds, cancelled ${day}`,
  line: (n: number, pence: number) => `${orders(n)} to refund, ${gbp(pence)}`,
  none: 'Nothing left to refund.',
  all: 'Refund all',
  one: 'Refund',
  refunded: 'Refunded',
  mixed: 'Also on other nights. Refund it on its own.',
  askAll: (n: number, pence: number) => `Refund ${orders(n)}, ${gbp(pence)}?`,
  askOne: (o: RefundOrderRow) => `Refund ${nameOf(o)}, ${gbp(o.remainingPence)}?`,
  askOneMixed: 'This order has other nights too. The whole order is refunded.',
  go: 'Refund',
  keep: 'Keep',
  loading: 'Loading refunds\u2026',
  error: 'Refunds didn\u2019t load.',
  retry: 'Try again',
  changed: 'The amount changed since you looked. Check it, then refund again.',
  failed: 'The refund didn\u2019t go through. Nothing changed. Try again.',
  notConfigured: 'Refunds are not switched on yet.',
  partial: (done: number, names: string[]) => `${orders(done)} refunded. Not refunded yet: ${names.join(', ')}. Tap Refund all to try those again.`,
  done: (n: number) => `${orders(n)} refunded.`,
  doneOne: (name: string) => `${name} refunded.`,
} as const;

export interface RefundRowView { order: RefundOrderRow; name: string; tickets: string; amount: string; canRefund: boolean; note: string | null }
export interface RefundBlock { line: string; allOn: boolean; rows: RefundRowView[] }

/** null = draw nothing (not owner/admin, wrong night, night not cancelled). */
export function refundBlockOf(s: NightRefundSummary | undefined): RefundBlock | null {
  if (!s || s.kind !== 'ok' || !s.nightCancelled) return null;
  return {
    line: s.ordersToRefund > 0 ? REFUND_COPY.line(s.ordersToRefund, s.penceToRefund) : REFUND_COPY.none,
    allOn: s.ordersToRefund > 0,
    rows: s.orders.map((o) => ({
      order: o,
      name: nameOf(o),
      tickets: o.tickets === null ? '' : `${o.tickets} ${o.tickets === 1 ? 'ticket' : 'tickets'}`,
      amount: gbp(o.remainingPence),
      canRefund: !o.refunded && o.remainingPence > 0,
      note: !o.refunded && o.mixedNights ? REFUND_COPY.mixed : null,
    })),
  };
}

/** What a Refund all press says, given the orders it was about (for names of the ones that failed). */
export function nightDoneText(d: NightRefundDone, list: readonly RefundOrderRow[]): { text: string; ok: boolean } {
  if (d.failed.length === 0) return { text: REFUND_COPY.done(d.refunded), ok: true };
  const byId = new Map(list.map((o) => [o.orderId, nameOf(o)]));
  return { text: REFUND_COPY.partial(d.refunded, d.failed.map((id) => byId.get(id) ?? 'No name')), ok: false };
}
