import { describe, expect, it } from 'vitest';
import { rowOf, type HomeSeriesRow } from '../../data/home';
import type { TicketType, TypeSales } from '../../../tickets/ticketModel';
import { r4TicketsOf } from '../r4TicketsModel';

const TODAY = '2026-11-18';

function rowFor(lifecycle: string, format: string, dates: readonly string[]) {
  return rowOf({
    id: 's1', name: 'Friday Social', lifecycle_status: lifecycle, format, category: null,
    default_venue_name: 'Soho Dance Studio', default_cover_image_url: null, default_local_start_time: '21:00:00', upcoming_count: dates.length,
    next_dates: dates.map((d) => ({ occurrence_date: d, lifecycle_status: 'scheduled', status: 'scheduled', starts_at: `${d}T21:00:00Z`, start_time: '21:00', venue_name: null })),
  } as unknown as HomeSeriesRow, TODAY);
}

const type = (id: string, status: TicketType['status'], capacity: number, reservedKnown = true): TicketType => ({
  id, seriesId: 's1', occurrenceId: null, name: id, pricePence: 1200, capacity, reserved: 0, reservedKnown,
  salesOpenAt: null, salesCloseAt: null, status, manualSoldOut: false,
});
const sale = (id: string, sold: number, paid: number, gross: number, refunded: number): TypeSales => ({
  id, seriesId: 's1', ticketsSold: sold, ordersPaid: paid, ordersPending: 0, ordersRefunded: 0, ordersDisputed: 0,
  grossPence: gross, discountsPence: 0, bookingFeesPence: 0, refundedPence: refunded,
} as unknown as TypeSales);

// Prod survey 2026-11-18 (read-only counts): 3 series have ticket types, none per night.
// A: 4 types cap 5, on sale + paused, 2 paid orders, 1 part refunded, 2 orders with no buyer name.
// B: 3 types cap 50, no paid orders. C: 12 types cap 10-200, no paid orders. Every other series: no types.
const A = [type('Early', 'on_sale', 5), type('Standard', 'on_sale', 5), type('Late', 'paused', 5), type('Door', 'on_sale', 5)];
const B = [type('One', 'on_sale', 50), type('Two', 'on_sale', 50), type('Three', 'on_sale', 50)];
const C = Array.from({ length: 12 }, (_, n) => type(`T${n}`, 'on_sale', n === 0 ? 200 : 10));

describe('R4 Tickets: every prod shape gets an honest screen', () => {
  it.each([
    // [case, lifecycle, format, dates, role, types, sales, door, money, expect: state, big, of, batch open, who, money]
    ['A one-off owner, paused batch, part refund', 'live', 'one_off', ['2026-11-20'], 'owner', A, [sale('Early', 3, 2, 3600, 600)], 3, true, 'ready', 3, 20, 'Late', '2 orders', true],
    ['A as manager: counts, no money', 'live', 'one_off', ['2026-11-20'], 'manager', A, [sale('Early', 3, 2, 0, 0)], 3, false, 'ready', 3, 20, 'Late', '2 orders', false],
    ['A as contributor: Open now off with why', 'live', 'one_off', ['2026-11-20'], 'contributor', A, [sale('Early', 3, 2, 0, 0)], 3, false, 'ready', 3, 20, 'Late', '2 orders', false],
    ['B weekly, nothing sold, door read 0', 'live', 'recurring', ['2026-11-20', '2026-11-27'], 'owner', B, [sale('One', 0, 0, 0, 0)], 0, true, 'ready', 0, null, null, '0 orders', true],
    ['C festival, no door read: series total not used', 'live', 'festival', ['2027-02-10'], 'owner', C, [sale('T0', 0, 0, 0, 0)], null, true, 'ready', null, null, null, '0 orders', true],
    ['one-off, summary not known, door gives sold', 'live', 'one_off', ['2026-11-20'], 'owner', B, null, 7, false, 'ready', 7, 150, null, null, false],
    ['one-off, reserved not known: no "of"', 'live', 'one_off', ['2026-11-20'], 'owner', [type('X', 'on_sale', 50, false)], [sale('X', 1, 1, 1200, 0)], null, true, 'ready', 1, null, null, '1 order', true],
    ['no types, live: empty, add on', 'live', 'recurring', ['2026-11-20'], 'owner', [], null, null, false, 'empty', null, null, null, null, false],
    ['no types, draft: empty, add off with why', 'draft', 'one_off', [], 'owner', [], null, null, false, 'empty', null, null, null, null, false],
    ['still loading', 'live', 'one_off', ['2026-11-20'], 'owner', null, null, null, false, 'loading', null, null, null, null, false],
  ] as const)('%s', (_c, life, format, dates, role, types, sales, doorSold, moneyVisible, state, big, of, open, who, money) => {
    const m = r4TicketsOf({ row: rowFor(life, format, dates), role, types: types as TicketType[] | null, sales: sales as TypeSales[] | null, moneyVisible, doorSold, error: false });
    expect(m.state).toBe(state);
    expect(m.title).toBe('Friday Social');
    expect(m.big?.sold ?? null).toBe(big);
    expect(m.big?.of ?? null).toBe(of);
    expect(m.batch?.open?.name ?? null).toBe(open);
    expect(m.who).toBe(who);
    expect(m.money !== null).toBe(money);
    // a bar is only drawn with a real "of"
    if (m.big && m.big.of === null) expect(m.big.pct).toBeNull();
    // a control that cannot work says why
    if (m.batch?.open && role === 'contributor') expect(m.batch.openWhy).toBeTruthy();
    if (state === 'empty' && life === 'draft') expect(m.addWhy).toBeTruthy();
    if (state === 'empty' && life === 'live') expect(m.addWhy).toBeNull();
  });

  it('a load failure is the error state, whatever else is known', () => {
    const m = r4TicketsOf({ row: rowFor('live', 'one_off', ['2026-11-20']), role: 'owner', types: A, sales: null, moneyVisible: true, doorSold: 3, error: true });
    expect(m.state).toBe('error');
    expect(m.big).toBeNull();
  });

  it('money is the takings less refunds, owner only', () => {
    const m = r4TicketsOf({ row: rowFor('live', 'one_off', ['2026-11-20']), role: 'owner', types: A, sales: [sale('Early', 3, 2, 3600, 600)], moneyVisible: true, doorSold: 3, error: false });
    expect(m.money).toMatch(/^£30 so far$/);
    expect(m.big?.label).toBe('3 of 20 tickets sold');
    expect(m.big?.pct).toBe(15);
  });
});
