import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOT_OWNER_REFUND, reasonMessage } from '../ticketModel';
import { ORDER_SELECT_COUNTS, classifyEdge, fetchOrders, parseSummary, refundOrder } from '../ticketsApi';

const invoke = vi.hoisted(() => vi.fn());
const selects = vi.hoisted(() => [] as string[]);
vi.mock('@/integrations/supabase/client', () => {
  const q: Record<string, unknown> = {};
  q.select = (c: string) => (selects.push(c), q);
  q.in = () => q;
  q.order = () => q;
  q.range = () => Promise.resolve({ data: [], error: null });
  return { supabase: { functions: { invoke }, from: () => q } };
});

const ROW = { id: 't1', event_series_id: 's1', name: 'Early', status: 'on_sale', price_pence: 1000, capacity: 50, reserved_count: 4, tickets_sold: 3, orders_paid: 2, orders_pending: 0, orders_refunded: 1, orders_disputed: 0, gross_pence: 3000, discounts_pence: 100, booking_fees_pence: 150, refunded_pence: 500 };
const ZERO = { ...ROW, id: 't2', tickets_sold: 0, orders_paid: 0, orders_refunded: 0, gross_pence: 0, refunded_pence: 0 };
const pence = (v: unknown): number[] => JSON.stringify(v).match(/"\w*[Pp]ence\w*":-?\d+/g)?.map((m) => Number(m.split(':')[1])) ?? [];

// shape x caller option -> expected moneyVisible, expected: some pence field is non-zero after parse
const SHAPES: Array<[string, Record<string, unknown>, { money?: boolean }, boolean | null, boolean]> = [
  ['owner, money_visible true', { ok: true, money_visible: true, ticket_types: [ROW] }, { money: true }, true, true],
  ['admin, money_visible true', { ok: true, money_visible: true, ticket_types: [ROW] }, {}, true, true],
  ['manager, money_visible false', { ok: true, money_visible: false, ticket_types: [ROW] }, { money: true }, false, false],
  ['manager, false, pence absent', { ok: true, money_visible: false, ticket_types: [{ ...ROW, gross_pence: undefined }] }, { money: true }, false, false],
  ['old server, field missing, owner (fail closed: no pence)', { ok: true, ticket_types: [ROW] }, { money: true }, null, false],
  ['old server, field missing, manager', { ok: true, ticket_types: [ROW] }, { money: false }, null, false],
  ['server true but caller says counts', { ok: true, money_visible: true, ticket_types: [ROW] }, { money: false }, true, false],
  ['empty types, owner', { ok: true, money_visible: true, ticket_types: [] }, { money: true }, true, false],
  ['empty types, manager', { ok: true, money_visible: false, ticket_types: [] }, { money: true }, false, false],
  ['type with zero sold', { ok: true, money_visible: false, ticket_types: [ZERO] }, { money: true }, false, false],
  ['refunded orders, manager', { ok: true, money_visible: false, ticket_types: [ROW] }, { money: true }, false, false],
];

describe('parseSummary x money_visible', () => {
  it.each(SHAPES)('%s', (_n, body, opts, visible, expectNonZeroPence) => {
    const s = parseSummary(body, opts);
    expect(s.moneyVisible).toBe(visible);
    expect(pence(s).some((n) => n > 0)).toBe(expectNonZeroPence);
    if (visible === false) expect(pence(s).every((n) => n === 0)).toBe(true);
  });
  it('counts survive when money is hidden', () => {
    expect(parseSummary({ ok: true, money_visible: false, ticket_types: [ROW] }, { money: true }).types[0]).toMatchObject({ ticketsSold: 3, ordersPaid: 2, ordersRefunded: 1, capacity: 50 });
  });
  it('a refusal says nothing about money', () => {
    expect(parseSummary({ ok: false, reason: 'not_authorised' })).toEqual({ ok: false, reason: 'not_authorised', types: [], moneyVisible: null });
  });
});

describe('manager order reads never ask for pence (brief 4)', () => {
  beforeEach(() => { selects.length = 0; });
  it('money:false selects the counts columns only', async () => {
    await fetchOrders(['t1'], { money: false });
    expect(selects).toEqual([ORDER_SELECT_COUNTS]);
  });
  it('the counts select has neither a pence column nor buyer_name (managers read no name, no money)', () => {
    expect(ORDER_SELECT_COUNTS).not.toMatch(/pence/);
    expect(ORDER_SELECT_COUNTS).not.toMatch(/buyer_name/);
    expect(ORDER_SELECT_COUNTS.split(', ')).toEqual(['id', 'ticket_type_id', 'quantity', 'status', 'paid_at']);
  });
});

describe('ticket-refund 403 not_allowed, end to end', () => {
  const asResponse = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });
  it('classifyEdge: 403 not_allowed is a failure with that reason (strict)', () => {
    expect(classifyEdge(403, { ok: false, reason: 'not_allowed' }, true)).toEqual({ kind: 'failed', reason: 'not_allowed' });
  });
  it('invoke 403 -> refundOrder failed not_allowed -> the ask-the-owner copy', async () => {
    invoke.mockReset().mockResolvedValue(asResponse(403, { ok: false, reason: 'not_allowed' }));
    const out = await refundOrder('o1');
    expect(out).toEqual({ kind: 'failed', reason: 'not_allowed' });
    expect(reasonMessage(out.kind === 'failed' ? out.reason : null)).toBe(NOT_OWNER_REFUND);
  });
  it('no access is a 404 not_found, not "payments off"', async () => {
    invoke.mockReset().mockResolvedValue(asResponse(404, { ok: false, reason: 'not_found' }));
    expect(await refundOrder('o1')).toEqual({ kind: 'failed', reason: 'not_found' });
  });
});
