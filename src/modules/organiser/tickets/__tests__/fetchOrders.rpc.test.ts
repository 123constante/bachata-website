import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrders, ORDER_SELECT_COUNTS } from '../ticketsApi';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

const row = (id: string, typeId: string) => ({ id, ticket_type_id: typeId, buyer_name: 'A', quantity: 1, total_pence: 1000, status: 'paid' });

/** Table chain that answers one empty page so the fallback read terminates. */
const emptyTable = () => {
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'in', 'order']) chain[k] = () => chain;
  chain.range = () => Promise.resolve({ data: [], error: null });
  from.mockReturnValue(chain);
};

describe('fetchOrders money path (admin #1384 deploy order)', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('reads the owner RPC and keeps only this series ticket types', async () => {
    rpc.mockResolvedValue({ data: { ok: true, orders: [row('o1', 't1'), row('o2', 'other')] }, error: null });
    const out = await fetchOrders(['t1'], { money: true, organiserId: 'org1' });
    expect(rpc).toHaveBeenCalledWith('ticket_orders_for_organiser_v1', { p_organiser_id: 'org1' });
    expect(out.map((o) => o.id)).toEqual(['o1']);
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to the table read while the function is not applied (PGRST202 / 42883)', async () => {
    for (const code of ['PGRST202', '42883']) {
      rpc.mockResolvedValue({ data: null, error: { code } });
      emptyTable();
      expect(await fetchOrders(['t1'], { money: true, organiserId: 'org1' })).toEqual([]);
      expect(from).toHaveBeenCalledWith('ticket_orders');
      from.mockReset();
    }
  });

  it('a refusal or any other error throws and never falls back', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'not_allowed' }, error: null });
    await expect(fetchOrders(['t1'], { money: true, organiserId: 'org1' })).rejects.toThrow('not_allowed');
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(fetchOrders(['t1'], { money: true, organiserId: 'org1' })).rejects.toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it('money: true never asks the counts reader', async () => {
    rpc.mockResolvedValue({ data: { ok: true, orders: [] }, error: null });
    await fetchOrders(['t1'], { money: true, organiserId: 'org1' });
    expect(rpc).not.toHaveBeenCalledWith('ticket_order_statuses_for_organiser_v1', expect.anything());
  });
});

/** A counts-reader row: the server sends no money keys; a refunded order reads 'paid' to a non-money seat. */
const countsRow = (id: string, typeId: string, status = 'paid') => ({
  id, ticket_type_id: typeId, occurrence_id: null, quantity: 2, line_count: 1, status, email_status: 'sent',
  dispute_status: null, created_at: '2026-11-01T10:00:00Z', paid_at: '2026-11-01T10:01:00Z',
});

describe('fetchOrders counts path (managers / contributors, admin #1384)', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); });

  it('reads ticket_order_statuses_for_organiser_v1 when organiserId is given, filtered to these types', async () => {
    rpc.mockResolvedValue({ data: { ok: true, orders: [countsRow('o1', 't1'), countsRow('o2', 'other')] }, error: null });
    const out = await fetchOrders(['t1'], { money: false, organiserId: 'org1' });
    expect(rpc).toHaveBeenCalledWith('ticket_order_statuses_for_organiser_v1', { p_organiser_id: 'org1' });
    expect(rpc).not.toHaveBeenCalledWith('ticket_orders_for_organiser_v1', expect.anything());
    expect(out.map((o) => o.id)).toEqual(['o1']);
    expect(from).not.toHaveBeenCalled();
  });

  it('a refunded-as-paid row parses as paid, and every pence field is 0 with no buyer name', async () => {
    rpc.mockResolvedValue({ data: { ok: true, orders: [countsRow('o1', 't1', 'paid')] }, error: null });
    const [o] = await fetchOrders(['t1'], { money: false, organiserId: 'org1' });
    expect(o).toMatchObject({ status: 'paid', quantity: 2, subtotalPence: 0, bookingFeePence: 0, totalPence: 0, refundedPence: 0, buyerName: null });
  });

  it('falls back to the counts table select (no pence columns) on PGRST202 and on 42883', async () => {
    for (const code of ['PGRST202', '42883']) {
      rpc.mockResolvedValue({ data: null, error: { code } });
      const select = vi.fn();
      const chain: Record<string, unknown> = {};
      for (const k of ['in', 'order']) chain[k] = () => chain;
      chain.select = (cols: string) => { select(cols); return chain; };
      chain.range = () => Promise.resolve({ data: [], error: null });
      from.mockReturnValue(chain);
      expect(await fetchOrders(['t1'], { money: false, organiserId: 'org1' })).toEqual([]);
      expect(from).toHaveBeenCalledWith('ticket_orders');
      expect(select).toHaveBeenCalledWith(ORDER_SELECT_COUNTS);
      expect(String(select.mock.calls[0][0])).not.toMatch(/pence|buyer/);
      from.mockReset();
    }
  });

  it('a refusal or any other error throws and never falls back', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'not_authorised' }, error: null });
    await expect(fetchOrders(['t1'], { money: false, organiserId: 'org1' })).rejects.toThrow('not_authorised');
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(fetchOrders(['t1'], { money: false, organiserId: 'org1' })).rejects.toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it('without an organiserId it keeps the table read and never calls an RPC', async () => {
    emptyTable();
    await fetchOrders(['t1'], { money: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});
