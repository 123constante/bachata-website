import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrders } from '../ticketsApi';

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

  it('counts-only (managers) never calls the RPC', async () => {
    emptyTable();
    await fetchOrders(['t1'], { money: false, organiserId: 'org1' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
