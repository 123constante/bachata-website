import { describe, expect, it } from 'vitest';
import { parseManage, type ManagedType } from '../../../tickets/priceSteps';
import { earlyBirdOf } from '../earlyBird';

const base: ManagedType = { id: 't1', basePricePence: 1500, effectivePricePence: 1500, hasOrders: false, hasPriceSteps: false, steps: [] };
const tier = (over: Partial<ManagedType>): ManagedType => ({ ...base, earlyPricePence: 800, earlyLeft: 4, earlyOpen: true, regularPricePence: 1500, ...over });

describe('earlyBirdOf (flag ticketEarlyBird)', () => {
  const rows: [string, ManagedType | undefined, boolean, ReturnType<typeof earlyBirdOf>][] = [
    ['flag off', tier({}), false, null],
    ['no tier (fields absent)', base, true, null],
    ['not loaded', undefined, true, null],
    ['open', tier({}), true, { pill: 'Early bird 4 left', price: '£8.00 now, £15.00 after' }],
    ['sold out', tier({ earlyLeft: 0 }), true, null],
    ['closed', tier({ earlyOpen: false }), true, null],
  ];
  it.each(rows)('%s', (_n, m, flag, want) => {
    expect(earlyBirdOf(m, flag)).toEqual(want);
  });

  it('parses the new fields, and leaves them null when the RPC has none', () => {
    const r = parseManage({ ok: true, ticket_types: [{ id: 'a', early_price_pence: 800, early_left: 4, early_open: true, regular_price_pence: 1500 }, { id: 'b' }] });
    expect(r.types[0]).toMatchObject({ earlyPricePence: 800, earlyLeft: 4, earlyOpen: true, regularPricePence: 1500 });
    expect(r.types[1]).toMatchObject({ earlyPricePence: null, earlyLeft: null, earlyOpen: null, regularPricePence: null });
  });
});
