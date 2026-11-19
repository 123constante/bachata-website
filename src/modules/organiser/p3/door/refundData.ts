import { supabase } from '@/integrations/supabase/client';
import { classifyEdge, refundOrder, type EdgeOutcome } from '../../tickets/ticketsApi';

/*
 * R4 cancel refund reads and writes (admin 20261119160159_ticket_night_cancel_refund_v1 + edge fn
 * ticket-refund-night, slice A). Who may see or move money is the server's call: the summary answers
 * not_allowed to anyone who is not the organiser's owner seat or a platform admin, and the screen then
 * draws nothing. Unknown fields (slice B's no_stripe_record / orders_without_stripe) are ignored.
 */

type Resp = PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
const db = () => supabase as unknown as { rpc(fn: string, args: Record<string, unknown>): Resp };

export interface RefundOrderRow { orderId: string; firstName: string | null; tickets: number | null; remainingPence: number; refunded: boolean; mixedNights: boolean }
export type NightRefundSummary =
  | { kind: 'not_allowed' }
  | { kind: 'wrong_night' }
  | { kind: 'ok'; nightCancelled: boolean; ordersToRefund: number; penceToRefund: number; freeOrdersToEnd: number; orders: RefundOrderRow[] };

export class RefundSummaryShapeError extends Error {
  constructor() { super('refund_summary_shape'); this.name = 'RefundSummaryShapeError'; }
}

const int = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function parseRefundSummary(d: unknown): NightRefundSummary {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new RefundSummaryShapeError();
  const r = d as Record<string, unknown>;
  if (r.ok === false && r.reason === 'not_allowed') return { kind: 'not_allowed' };
  if (r.ok === false && r.reason === 'wrong_night') return { kind: 'wrong_night' };
  const n = int(r.orders_to_refund);
  const p = int(r.pence_to_refund);
  if (r.ok !== true || n === null || p === null || !Array.isArray(r.orders)) throw new RefundSummaryShapeError();
  const orders = (r.orders as Record<string, unknown>[])
    .filter((o) => o && typeof o.order_id === 'string')
    .map((o) => ({
      orderId: o.order_id as string,
      firstName: str(o.first_name),
      tickets: int(o.tickets),
      remainingPence: int(o.remaining_pence) ?? 0,
      refunded: o.refunded === true,
      mixedNights: o.mixed_nights === true,
    }));
  return { kind: 'ok', nightCancelled: r.night_cancelled === true, ordersToRefund: n, penceToRefund: p, freeOrdersToEnd: int(r.free_orders_to_end) ?? 0, orders };
}

export async function fetchNightRefundSummary(seriesId: string, occurrenceId: string): Promise<NightRefundSummary> {
  const { data, error } = await db().rpc('organiser_night_refund_summary_v1', { p_event_series_id: seriesId, p_occurrence_id: occurrenceId });
  if (error) throw error;
  return parseRefundSummary(data);
}

export const refundKeys = { night: (uid: string | undefined, seriesId: string, occurrenceId: string) => ['r4-night-refund', uid ?? null, seriesId, occurrenceId] as const };

export interface NightRefundDone { refunded: number; failed: string[]; freeFailed: boolean }
export type NightRefundOutcome = EdgeOutcome<NightRefundDone> | { kind: 'changed' };

/** One press of Refund all. 409 changed = the totals moved since the sheet was drawn: nothing was sent. */
export async function refundNight(seriesId: string, occurrenceId: string, expected: { pence: number; orders: number }): Promise<NightRefundOutcome> {
  let out: EdgeOutcome<unknown>;
  try {
    const { data, error } = await supabase.functions.invoke('ticket-refund-night', {
      body: { series: seriesId, occurrence: occurrenceId, expected_pence: expected.pence, expected_orders: expected.orders },
    });
    if (!error) out = classifyEdge(200, data, true);
    else {
      const ctx = (error as { context?: unknown }).context;
      out = ctx instanceof Response ? classifyEdge(ctx.status, await ctx.json().catch(() => null), true) : { kind: 'failed', reason: null };
    }
  } catch {
    out = { kind: 'failed', reason: null };
  }
  if (out.kind === 'failed' && out.reason === 'changed') return { kind: 'changed' };
  if (out.kind !== 'ok') return out;
  return nightDoneOf(out.value);
}

export function nightDoneOf(v: unknown): NightRefundOutcome {
  const b = (v ?? {}) as { ok?: unknown; reason?: unknown; results?: unknown; free_failed?: unknown };
  if (b.ok !== true) return b.reason === 'changed' ? { kind: 'changed' } : { kind: 'failed', reason: typeof b.reason === 'string' ? b.reason : null };
  const results = Array.isArray(b.results) ? (b.results as { order_id?: unknown; ok?: unknown }[]) : [];
  return {
    kind: 'ok',
    value: {
      refunded: results.filter((x) => x.ok === true).length,
      failed: results.filter((x) => x.ok !== true && typeof x.order_id === 'string').map((x) => x.order_id as string),
      freeFailed: b.free_failed === true,
    },
  };
}

/** One order, whole: the existing ticket-refund edge function (owner seat or admin; it checks again). */
export const refundOneOrder = (orderId: string) => refundOrder(orderId);
