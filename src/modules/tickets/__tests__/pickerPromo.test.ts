import { describe, expect, it, vi } from 'vitest';
import { discountedTotal, pickerPromoKey, previewBasketPromo, promoLines } from '../pickerPromo';
import { buildPickerBody } from '../pickerModel';
import type { PublicTicketType } from '../ticketCheckoutModel';

const mk = (id: string, pricePence: number): PublicTicketType => ({ id, occurrenceId: null, name: id, pricePence, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null });
const TYPES = [mk('a', 1000), mk('b', 1500), mk('f', 0)];
const ok = (d: number) => ({ ok: true, discountPence: d, totalPence: 0, reason: '' });

describe('pickerPromo', () => {
  it('lines: picked and paid only; key ties basket and night', () => {
    expect(promoLines({ a: 1, f: 2, b: 0 }, TYPES)).toEqual([{ typeId: 'a', quantity: 1 }]);
    expect(pickerPromoKey({ a: 1 }, 'o1')).not.toBe(pickerPromoKey({ a: 2 }, 'o1'));
    expect(pickerPromoKey({ a: 1 }, 'o1')).not.toBe(pickerPromoKey({ a: 1 }, null));
  });
  it('sums per-line discounts; first refusal wins; no lines = no call', async () => {
    const p = vi.fn(async (t: string, q: number) => ok((t === 'a' ? 100 : 150) * q));
    expect((await previewBasketPromo([{ typeId: 'a', quantity: 2 }, { typeId: 'b', quantity: 1 }], 'X', p)).discountPence).toBe(350);
    const bad = vi.fn(async (t: string) => (t === 'b' ? { ok: false, discountPence: 0, totalPence: 0, reason: 'expired' } : ok(1)));
    expect(await previewBasketPromo([{ typeId: 'a', quantity: 1 }, { typeId: 'b', quantity: 1 }], 'X', bad)).toMatchObject({ ok: false, reason: 'expired' });
    const none = vi.fn();
    expect((await previewBasketPromo([], 'X', none)).ok).toBe(false);
    expect(none).not.toHaveBeenCalled();
  });
  it('total: net never below 0, fee only on a net above 0 (reserve v5)', () => {
    const sum = { count: 2, subtotalPence: 3000, feePence: 0, totalPence: 3000 };
    expect(discountedTotal(sum, 600, 0)).toBe(2400);
    expect(discountedTotal(sum, 600, 50)).toBe(2500);
    expect(discountedTotal(sum, 5000, 50)).toBe(0);
  });
  it('body: promo code and its total; none without a code', () => {
    const f = { basket: { a: 1 }, types: TYPES, email: 'x@y.co', occurrenceId: null, origin: 'https://s', pathname: '/event/e1', search: '' };
    expect(buildPickerBody({ ...f, promo: { code: 'SAVE', totalPence: 900 } })).toMatchObject({ promo_code: 'SAVE', expected_total_pence: 900 });
    expect(buildPickerBody(f)).not.toHaveProperty('promo_code');
  });
});
