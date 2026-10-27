import { supabase } from '@/integrations/supabase/client';
import {
  asStatus,
  num,
  strOrNull,
  type Order,
  type StripeRow,
  type TicketType,
  type TypeSales,
  type UpsertDraft,
} from './ticketModel';

/**
 * The ticketing wire (S3). Reads: ticket_sales_summary_v1, and the member-readable
 * rows of ticket_types / ticket_orders / organiser_stripe_accounts (RLS: owner,
 * manager, contributor). Writes: ticket_type_upsert_v1, ticket_type_set_status_v1,
 * and the stripe-connect-onboard / ticket-refund edge functions. This file is the
 * one place in the area that names the server's organiser key (lint-runtime-
 * architecture allowlist); everything past it is camelCase.
 *
 * The ticketing RPCs and tables are not in the generated types.ts yet, so they go
 * through the area's UntypedRpc boundary (as profileProgress.ts / teamRpcApi.ts do).
 */
type Resp = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type UntypedQuery = {
  select(cols: string): UntypedQuery;
  eq(col: string, v: unknown): UntypedQuery;
  in(col: string, v: readonly unknown[]): UntypedQuery;
  order(col: string, o?: { ascending?: boolean }): UntypedQuery;
  range(from: number, to: number): Resp;
  maybeSingle(): Resp;
} & Resp;
type Untyped = { rpc(fn: string, args?: Record<string, unknown>): Resp; from(table: string): UntypedQuery };
const db = () => supabase as unknown as Untyped;

/** PostgREST answers at most 100 rows a request on this project: page until a short page. */
const PAGE = 100;

export const ticketKeys = {
  all: ['org-tickets'] as const,
  stripe: (organiserId: string | undefined) => ['org-tickets', 'stripe', organiserId] as const,
  summary: (organiserId: string | undefined) => ['org-tickets', 'summary', organiserId] as const,
  types: (organiserId: string | undefined, seriesId: string | undefined) => ['org-tickets', 'types', organiserId, seriesId] as const,
  orders: (organiserId: string | undefined, seriesId: string | undefined) => ['org-tickets', 'orders', organiserId, seriesId] as const,
};

export async function fetchStripeAccount(organiserId: string): Promise<StripeRow | null> {
  const { data, error } = await db()
    .from('organiser_stripe_accounts')
    .select('charges_enabled, payouts_enabled, details_submitted')
    .eq('organiser_id', organiserId)
    .maybeSingle();
  if (error) throw error;
  return (data as StripeRow | null) ?? null;
}

/** ok=false carries the server's refusal word (not_authorised) and no rows. */
export interface SummaryResult {
  ok: boolean;
  reason: string | null;
  types: TypeSales[];
}

export const parseSummary = (data: unknown): SummaryResult => {
  const d = (data ?? {}) as { ok?: unknown; reason?: unknown; ticket_types?: unknown };
  if (d.ok !== true) return { ok: false, reason: typeof d.reason === 'string' ? d.reason : 'unknown', types: [] };
  const rows = Array.isArray(d.ticket_types) ? (d.ticket_types as Record<string, unknown>[]) : [];
  return {
    ok: true,
    reason: null,
    types: rows.map((r) => ({
      id: String(r.id),
      seriesId: String(r.event_series_id),
      name: String(r.name ?? ''),
      status: asStatus(r.status),
      pricePence: num(r.price_pence),
      capacity: num(r.capacity),
      reserved: num(r.reserved_count),
      ticketsSold: num(r.tickets_sold),
      ordersPaid: num(r.orders_paid),
      ordersPending: num(r.orders_pending),
      ordersRefunded: num(r.orders_refunded),
      ordersDisputed: num(r.orders_disputed),
      grossPence: num(r.gross_pence),
      bookingFeesPence: num(r.booking_fees_pence),
      refundedPence: num(r.refunded_pence),
    })),
  };
};

export async function fetchSalesSummary(organiserId: string): Promise<SummaryResult> {
  const { data, error } = await db().rpc('ticket_sales_summary_v1', { p_organiser_id: organiserId });
  if (error) throw error;
  return parseSummary(data);
}

export const parseTypeRow = (r: Record<string, unknown>): TicketType => ({
  id: String(r.id),
  seriesId: String(r.event_series_id),
  occurrenceId: strOrNull(r.occurrence_id),
  name: String(r.name ?? ''),
  pricePence: num(r.price_pence),
  capacity: num(r.capacity),
  reserved: num(r.reserved_count),
  salesOpenAt: strOrNull(r.sales_open_at),
  salesCloseAt: strOrNull(r.sales_close_at),
  status: asStatus(r.status),
  manualSoldOut: r.manual_sold_out === true,
});

const TYPE_COLS =
  'id, event_series_id, occurrence_id, name, price_pence, capacity, reserved_count, sales_open_at, sales_close_at, status, manual_sold_out, created_at';

export async function fetchSeriesTypes(organiserId: string, seriesId: string): Promise<TicketType[]> {
  const out: TicketType[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('ticket_types')
      .select(TYPE_COLS)
      .eq('organiser_id', organiserId)
      .eq('event_series_id', seriesId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    out.push(...rows.map(parseTypeRow));
    if (rows.length < PAGE) return out;
  }
}

export const parseOrderRow = (r: Record<string, unknown>): Order => ({
  id: String(r.id),
  typeId: String(r.ticket_type_id),
  buyerName: strOrNull(r.buyer_name),
  quantity: num(r.quantity),
  subtotalPence: num(r.subtotal_pence),
  bookingFeePence: num(r.booking_fee_pence),
  totalPence: num(r.total_pence),
  refundedPence: num(r.refunded_pence),
  status: String(r.status ?? ''),
  paidAt: strOrNull(r.paid_at),
});

/** Paid, refunded and disputed orders of these ticket types (pending / expired are not orders yet). No email, no Stripe ids. */
export async function fetchOrders(typeIds: readonly string[]): Promise<Order[]> {
  if (typeIds.length === 0) return [];
  const out: Order[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('ticket_orders')
      .select('id, ticket_type_id, buyer_name, quantity, subtotal_pence, booking_fee_pence, total_pence, refunded_pence, status, paid_at')
      .in('ticket_type_id', typeIds)
      .in('status', ['paid', 'refunded', 'disputed'])
      .order('paid_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    out.push(...rows.map(parseOrderRow));
    if (rows.length < PAGE) return out;
  }
}

export interface WriteResult {
  ok: boolean;
  reason: string | null;
}
const writeResult = (data: unknown): WriteResult => {
  const d = (data ?? {}) as { ok?: unknown; reason?: unknown };
  return d.ok === true ? { ok: true, reason: null } : { ok: false, reason: typeof d.reason === 'string' ? d.reason : 'unknown' };
};

/** ticket_type_upsert_v1's payload: every field, since the server overwrites them all on an edit. */
export const upsertPayload = (d: UpsertDraft): Record<string, unknown> => ({
  ...(d.id ? { id: d.id } : {}),
  organiser_id: d.organiserId,
  event_series_id: d.seriesId,
  occurrence_id: d.occurrenceId,
  name: d.name,
  price_pence: d.pricePence,
  capacity: d.capacity,
  sales_open_at: d.salesOpenAt,
  sales_close_at: d.salesCloseAt,
});

export async function upsertTicketType(d: UpsertDraft): Promise<WriteResult> {
  const { data, error } = await db().rpc('ticket_type_upsert_v1', { p_payload: upsertPayload(d) });
  if (error) throw error;
  return writeResult(data);
}

export async function setTicketStatus(id: string, status: string): Promise<WriteResult> {
  const { data, error } = await db().rpc('ticket_type_set_status_v1', { p_id: id, p_status: status });
  if (error) throw error;
  return writeResult(data);
}

// ---- Edge functions (S2, not deployed yet) ------------------------------------------

export type EdgeOutcome<T> = { kind: 'ok'; value: T } | { kind: 'not_configured' } | { kind: 'failed'; reason: string | null };

/**
 * One reading of an edge-function answer: 404 (not deployed) and 503 / not_configured
 * (deployed without Stripe keys) both mean "payments not switched on yet", never a crash.
 */
export const classifyEdge = (status: number | null, body: unknown): EdgeOutcome<unknown> => {
  const b = (body ?? {}) as { error?: unknown; reason?: unknown; code?: unknown };
  const word = [b.error, b.reason, b.code].find((v) => typeof v === 'string') as string | undefined;
  if (status === 404 || status === 503 || word === 'not_configured') return { kind: 'not_configured' };
  if (status === null || (status >= 200 && status < 300)) return { kind: 'ok', value: body };
  return { kind: 'failed', reason: word ?? null };
};

async function invokeEdge(name: string, body: Record<string, unknown>): Promise<EdgeOutcome<unknown>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return classifyEdge(200, data);
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const parsed = await ctx.json().catch(() => null);
      return classifyEdge(ctx.status, parsed);
    }
    // FunctionsRelayError / FunctionsFetchError: the function is not reachable at all.
    return { kind: 'not_configured' };
  } catch {
    return { kind: 'failed', reason: null };
  }
}

/**
 * Stripe Connect onboarding for one organiser page. Stripe sends the person back to
 * returnUrl when they finish, or to refreshUrl when the link expired (we start again).
 */
export async function startOnboarding(organiserId: string, returnUrl: string, refreshUrl: string): Promise<EdgeOutcome<string>> {
  const out = await invokeEdge('stripe-connect-onboard', { organiser_id: organiserId, return_url: returnUrl, refresh_url: refreshUrl });
  if (out.kind !== 'ok') return out;
  const url = (out.value as { url?: unknown } | null)?.url;
  return typeof url === 'string' && /^https:\/\//.test(url) ? { kind: 'ok', value: url } : { kind: 'failed', reason: null };
}

/** Refund one whole order (ticket price + booking fee). Owner / manager only; the function checks again. */
export async function refundOrder(orderId: string): Promise<EdgeOutcome<null>> {
  const out = await invokeEdge('ticket-refund', { order_id: orderId });
  if (out.kind !== 'ok') return out;
  const ok = (out.value as { ok?: unknown } | null)?.ok;
  return ok === false ? { kind: 'failed', reason: (out.value as { reason?: string }).reason ?? null } : { kind: 'ok', value: null };
}
