import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The promo WIRE (fix-1366-r1 #1). The matrix test mocks promoApi wholesale, so the RPC names and
 * argument names were asserted nowhere. This one mocks the Supabase client's rpc and pins the exact call.
 */
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { createPromo, fetchPromoCodes, updatePromo } from '../promo/promoApi';
import { patchOf, formOf, type PromoCode } from '../promo/promoModel';

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, rows: [] }, error: null });
});

describe('promo wire', () => {
  it('list -> ticket_promo_list_v1 { p_event_series_id }', async () => {
    await fetchPromoCodes('ser-9');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('ticket_promo_list_v1', { p_event_series_id: 'ser-9' });
  });

  it('create -> ticket_promo_create_v1 with exactly the seven p_ arguments', async () => {
    await createPromo('org-1', 'ser-9', { code: 'EARLY', kind: 'fixed', value: 250, maxUses: 25, expiresAt: '2030-01-02T03:04:00.000Z' });
    expect(rpc).toHaveBeenCalledWith('ticket_promo_create_v1', {
      p_event_series_id: 'ser-9',
      p_organiser_id: 'org-1',
      p_code: 'EARLY',
      p_kind: 'fixed',
      p_value: 250,
      p_max_uses: 25,
      p_expires_at: '2030-01-02T03:04:00.000Z',
    });
    expect(Object.keys(rpc.mock.calls[0][1]).sort()).toEqual(
      ['p_code', 'p_event_series_id', 'p_expires_at', 'p_kind', 'p_max_uses', 'p_organiser_id', 'p_value'],
    );
  });

  it('create with no limit and no end date sends nulls (not missing keys)', async () => {
    await createPromo('org-1', 'ser-9', { code: 'ABC', kind: 'percent', value: 10, maxUses: null, expiresAt: null });
    const a = rpc.mock.calls[0][1];
    expect(a.p_max_uses).toBeNull();
    expect(a.p_expires_at).toBeNull();
    expect('p_max_uses' in a && 'p_expires_at' in a).toBe(true);
  });

  it('update -> ticket_promo_update_v1 { p_id, p_patch }', async () => {
    await updatePromo('promo-1', { max_uses: 5 });
    expect(rpc).toHaveBeenCalledWith('ticket_promo_update_v1', { p_id: 'promo-1', p_patch: { max_uses: 5 } });
    expect(Object.keys(rpc.mock.calls[0][1]).sort()).toEqual(['p_id', 'p_patch']);
  });

  it('deactivate sends exactly { active: false }', async () => {
    await updatePromo('promo-1', { active: false });
    expect(rpc.mock.calls[0][1].p_patch).toEqual({ active: false });
  });

  it('a patch only ever has keys from active, expires_at, max_uses, kind, value', () => {
    const c: PromoCode = { id: 'a', code: 'A1B', kind: 'percent', value: 10, maxUses: null, usedCount: 0, expiresAt: null, active: true, createdAt: null, paidOrders: 0 };
    const p = patchOf(c, { ...formOf(c), kind: 'fixed', amount: '2.00', maxUses: '4', endsAt: '2099-01-01T10:00' });
    const allowed = new Set(['active', 'expires_at', 'max_uses', 'kind', 'value']);
    expect(Object.keys(p).length).toBeGreaterThan(0);
    for (const k of Object.keys(p)) expect(allowed.has(k)).toBe(true);
    expect(p).toMatchObject({ kind: 'fixed', value: 200, max_uses: 4 });
  });

  it('an rpc error is thrown (the screens map it), never swallowed', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: '42501' } });
    await expect(fetchPromoCodes('s')).rejects.toMatchObject({ code: '42501' });
    await expect(createPromo('o', 's', { code: 'ABC', kind: 'percent', value: 1, maxUses: null, expiresAt: null })).rejects.toBeTruthy();
    await expect(updatePromo('p', { active: false })).rejects.toBeTruthy();
  });
});
