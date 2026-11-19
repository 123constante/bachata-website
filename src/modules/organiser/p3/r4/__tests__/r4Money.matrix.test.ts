import { describe, expect, it } from 'vitest';
import type { RaffleNight } from '../../events/raffle/raffleModel';
import { R4_COMPARE_COPY, R4_COMPARE_MONEY_COPY, r4CompareMoneyOf } from '../r4CompareModel';
import { r4HomeOf, type R4NextNight } from '../r4Model';
import { gbp, moneyQuietOf, moneyTileOf, nightMoneyOf, parseNightMoney, type R4MoneyRead } from '../r4MoneyModel';

// Prod survey 2026-11-19 (ticket_orders x ticket_order_lines x event_occurrence_p5, counts only): 3 ticketed
// series; orders 2 paid (1 with a part refund), 1 refunded in full, 11 expired; 0 with a booking fee; 5 orders
// tied to no night (the no_night pool); 0 baskets spanning two nights; most nights on one series 133 (cap 400,
// so truncated is a fixture shape). The RPC answers {ok:false, reason:'not_authorised'} for a door-only seat and
// for an event with no ticket types.
const TODAY = '2026-11-19';
const raw = (o: Record<string, unknown> = {}) => ({
  gross_pence: 0, booking_fees_pence: 0, refunded_pence: 0, net_pence: 0, orders_paid: 0, orders_refunded: 0, orders_disputed: 0, tickets_sold: 0, ...o,
});
const rn = (date: string, o: Record<string, unknown> = {}) => ({ occurrence_id: `o-${date}`, occurrence_date: date, ...raw(o) });
const answer = (nights: unknown[], o: Record<string, unknown> = {}) => ({ ok: true, event_series_id: 's1', nights, truncated: false, no_night: raw(), ...o });

const SHAPES = {
  noSales: rn('2026-11-13'),
  paid: rn('2026-11-13', { gross_pence: 3000, net_pence: 3000, orders_paid: 2, tickets_sold: 2 }),
  partRefund: rn('2026-11-13', { gross_pence: 2400, refunded_pence: 1200, net_pence: 1200, orders_paid: 1, tickets_sold: 2 }),
  fullRefund: rn('2026-11-13', { orders_refunded: 1 }),
  disputedOnly: rn('2026-11-13', { orders_disputed: 1 }),
  withFees: rn('2026-11-13', { gross_pence: 1500, booking_fees_pence: 150, net_pence: 1500, orders_paid: 1, tickets_sold: 1 }),
} as const;

describe('parseNightMoney: every answer shape', () => {
  it('ok answer: nights keyed by occurrence and date, no_night kept', () => {
    const r = parseNightMoney(answer([SHAPES.paid], { no_night: raw({ net_pence: 500, orders_paid: 1 }) }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.nights[0]).toMatchObject({ occurrenceId: 'o-2026-11-13', date: '2026-11-13', netPence: 3000, ordersPaid: 2 });
    expect(r.noNight?.netPence).toBe(500);
    expect(r.truncated).toBe(false);
  });
  it('bigint pence as strings are read as numbers', () => {
    const r = parseNightMoney(answer([rn('2026-11-13', { net_pence: '1200', orders_paid: '1' })]));
    expect(r.kind === 'ok' && r.nights[0].netPence).toBe(1200);
  });
  it.each(['not_authorised', 'wrong_night'])('ok:false %s = no money view (drawn as nothing, not an error)', (reason) => {
    expect(parseNightMoney({ ok: false, reason })).toEqual({ kind: 'none' });
  });
  it.each([[null], ['x'], [{ ok: false, reason: 'boom' }], [{ ok: true }]])('unknown answer %j throws (read error, retry)', (v) => {
    expect(() => parseNightMoney(v)).toThrow();
  });
});

describe('One night tile + quiet line: every night shape', () => {
  it.each([
    ['no sales', SHAPES.noSales, null, null],
    ['paid', SHAPES.paid, '\u00a330', null],
    ['part refund', SHAPES.partRefund, '\u00a312', '\u00a312 refunded.'],
    ['refunded in full only', SHAPES.fullRefund, '\u00a30', '1 order refunded in full.'],
    ['disputed only', SHAPES.disputedOnly, '\u00a30', '1 order in dispute.'],
    ['booking fees kept apart (not in the number)', SHAPES.withFees, '\u00a315', '\u00a31.50 booking fees kept apart.'],
  ])('%s', (_l, night, value, quiet) => {
    const m = nightMoneyOf(parseNightMoney(answer([night])), { date: '2026-11-13' });
    expect(moneyTileOf(m)?.value ?? null).toBe(value);
    expect(moneyQuietOf(m)).toBe(quiet);
    if (value) expect(moneyTileOf(m)?.label).toBe('Money in');
  });
  it('no read (none / error / not loaded) draws no tile', () => {
    expect(nightMoneyOf({ kind: 'none' }, { date: '2026-11-13' })).toBeNull();
    expect(nightMoneyOf(undefined, { date: '2026-11-13' })).toBeNull();
    expect(moneyTileOf(null)).toBeNull();
  });
  it('occurrence id wins over the date', () => {
    const read = parseNightMoney(answer([rn('2026-11-13'), { ...rn('2026-11-13', { net_pence: 900, orders_paid: 1 }), occurrence_id: 'late' }]));
    expect(nightMoneyOf(read, { occurrenceId: 'late', date: '2026-11-13' })?.netPence).toBe(900);
    expect(nightMoneyOf(read, { date: '2026-11-13' })?.netPence).toBe(0);
  });
  it('\u00a30 is never written as "Free"', () => { expect(gbp(0)).toBe('\u00a30'); expect(gbp(1250)).toBe('\u00a312.50'); });
});

describe('Home: the money tile sits with the night in focus', () => {
  const next: R4NextNight = { seriesId: 's1', name: 'Friday Social', when: 'Friday 20 November, 9pm', place: 'Soho', draft: false, link: 'https://x' };
  const money = (n: Record<string, unknown>) => nightMoneyOf(parseNightMoney(answer([n])), { date: '2026-11-13' });
  it.each([
    ['before, paid', 'before', SHAPES.paid, ['money']],
    ['before, no sales', 'before', SHAPES.noSales, []],
    ['night, disputed only', 'night', SHAPES.disputedOnly, ['money']],
  ] as const)('%s', (_l, clock, n, keys) => {
    expect(r4HomeOf({ clock, next, door: null, last: null, money: money(n) }).tiles.map((t) => t.key)).toEqual(keys);
  });
  it('after: came, sold, then money', () => {
    const last = { key: 'k', seriesId: 's1', occurrenceId: 'o-2026-11-13', date: '2026-11-13', name: 'Friday Social', when: 'Last Friday', cancelled: false, cameIn: 40, ticketsSold: 2, raffle: null, going: null };
    expect(r4HomeOf({ clock: 'after', next, door: null, last, money: money(SHAPES.partRefund) }).tiles.map((t) => [t.key, t.value]))
      .toEqual([['came', '40'], ['sold', '2'], ['money', '\u00a312']]);
  });
  it('no money read keeps the old tiles', () => {
    expect(r4HomeOf({ clock: 'before', next, door: { sold: 3, cameIn: 0 }, last: null }).tiles.map((t) => t.key)).toEqual(['sold']);
  });
  it('empty face never draws money', () => {
    expect(r4HomeOf({ clock: 'before', next: null, door: null, last: null, money: money(SHAPES.paid) }).tiles).toEqual([]);
  });
});

const night = (date: string, o: Partial<RaffleNight> = {}): RaffleNight => ({
  occurrenceId: `o-${date}`, date, startLocal: null, chip: 'closed', raffleOn: false, entries: 0,
  locked: false, winner: null, canSet: true, refuseReason: null, ...o,
});
const NIGHTS = [night('2026-10-30'), night('2026-11-06'), night('2026-11-13'), night('2026-11-20')];

describe('Compare, Money switch: ranked by net per night', () => {
  const of = (read: R4MoneyRead) => r4CompareMoneyOf({ nights: NIGHTS, today: TODAY, money: read });
  it('ranks by net, not gross; refunds come off; the quiet line says so', () => {
    const m = of(parseNightMoney(answer([
      rn('2026-10-30', { gross_pence: 5000, refunded_pence: 4000, net_pence: 1000, orders_paid: 3, tickets_sold: 4 }),
      rn('2026-11-06', { gross_pence: 2000, net_pence: 2000, orders_paid: 2, tickets_sold: 2 }),
      rn('2026-11-13'),
      rn('2026-11-20', { gross_pence: 9900, net_pence: 9900, orders_paid: 9, tickets_sold: 9 }),
    ])));
    expect(m.rows.map((r) => [r.date, r.line])).toEqual([['2026-11-06', '\u00a320 in, 2 tickets'], ['2026-10-30', '\u00a310 in, 4 tickets']]);
    expect(m.rows[1].quiet).toBe('\u00a340 refunded.');
    expect(m.empty).toBeNull();
    expect(m.foot).toBe(R4_COMPARE_COPY.foot);
  });
  it('no sales on any past night: empty words', () => {
    expect(of(parseNightMoney(answer([rn('2026-11-13')]))).empty).toBe(R4_COMPARE_MONEY_COPY.empty);
  });
  it('disputed only still ranks, at \u00a30', () => {
    expect(of(parseNightMoney(answer([SHAPES.disputedOnly]))).rows.map((r) => [r.line, r.quiet])).toEqual([['\u00a30 in', '1 order in dispute.']]);
  });
  it('truncated read says so in the foot', () => {
    expect(of(parseNightMoney(answer([SHAPES.paid], { truncated: true }))).foot).toContain(R4_COMPARE_MONEY_COPY.truncated);
  });
  it('no_night pool: named in the foot, never added to a night', () => {
    const m = of(parseNightMoney(answer([SHAPES.paid], { no_night: raw({ gross_pence: 4500, net_pence: 4500, orders_paid: 3 }) })));
    expect(m.foot).toContain(R4_COMPARE_MONEY_COPY.pool('\u00a345'));
    expect(m.rows[0].line).toBe('\u00a330 in, 2 tickets');
  });
  it('cancelled night is left out', () => {
    const m = r4CompareMoneyOf({ nights: [night('2026-11-13', { chip: 'cancelled' })], today: TODAY, money: parseNightMoney(answer([SHAPES.paid])) });
    expect(m.rows).toEqual([]);
    expect(m.empty).toBe(R4_COMPARE_COPY.noPast);
  });
});
