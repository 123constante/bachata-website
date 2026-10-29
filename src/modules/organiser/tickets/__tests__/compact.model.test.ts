import { describe, expect, it } from 'vitest';
import {
  EVENT_SALE,
  TICKET_STATUSES,
  buyerTotal,
  closesWords,
  countsLine,
  dayWord,
  eventLeftLine,
  eventSaleOf,
  formatCount,
  formatPence,
  nextStep,
  orderLine,
  paymentsLink,
  paidOf,
  setupSteps,
  stepErrors,
  switchMove,
  validateForm,
  type StripeState,
  type TicketStatus,
} from '../ticketModel';
import { writeResult } from '../ticketsApi';

/** S3b (mockup B) helpers: the one source of every fact the compact screens show. */

describe('buyerTotal: the one buyer sum', () => {
  it.each([
    [1000, false, 1000, 'The ticket price, nothing added'],
    [1, false, 1, 'The ticket price, nothing added'],
    [0, true, 0, 'Free'],
  ])('%ip', (pence, free, total, line) => {
    const b = buyerTotal(pence);
    expect(b.free).toBe(free);
    expect(b.totalPence).toBe(total);
    expect(b.line).toBe(line);
  });
  it.each([
    ['', false],
    ['0', false],
    ['0.00', false],
    ['10', true],
    ['abc', true],
  ])('price box %j is paid: %s', (text, paid) => expect(paidOf(text)).toBe(paid));
});

describe('the Selling switch', () => {
  const want: Record<TicketStatus, TicketStatus | null> = { draft: 'on_sale', on_sale: 'paused', paused: 'on_sale', sold_out: 'on_sale', closed: null };
  it.each(TICKET_STATUSES)('%s', (s) => expect(switchMove(s)).toBe(want[s]));
});

const sale = (status: TicketStatus, over: Record<string, unknown> = {}) => ({
  seriesId: 's1', status, pricePence: 1000, ticketsSold: 0, capacity: 20, reserved: 0, ...over,
});

describe('event state and places left', () => {
  it.each([
    [[], 'none', null],
    [[sale('closed')], 'none', null],
    // Places nobody can buy (a draft, a paused ticket) are not "left": the chip alone says it.
    [[sale('draft')], 'not_selling', null],
    [[sale('paused', { reserved: 5 })], 'not_selling', null],
    [[sale('on_sale', { reserved: 12 }), sale('draft')], 'selling', '8 left of 20'],
    [[sale('sold_out', { reserved: 20 })], 'sold_out', '0 left of 20'],
    // The critic's Friday Social: Early bird on sale (8 of 20), a paused 50 and a draft 100.
    [[sale('on_sale', { reserved: 12 }), sale('paused', { capacity: 50 }), sale('draft', { capacity: 100 })], 'selling', '8 left of 20'],
    [[sale('sold_out', { reserved: 20 }), sale('on_sale', { capacity: 30, reserved: 1 }), sale('paused', { capacity: 50 })], 'selling', '29 left of 50'],
    [[sale('on_sale', { capacity: 3000, reserved: 978 })], 'selling', '2,022 left of 3,000'],
  ] as const)('%j', (types, state, left) => {
    expect(eventSaleOf(types)).toBe(state);
    expect(EVENT_SALE[state].label).toBeTruthy();
    expect(eventLeftLine(types)).toBe(left);
  });
  it('counts line never invents a sold count', () => {
    expect(countsLine(12, 8)).toBe('12 sold \u00B7 8 left');
    expect(countsLine(null, 8)).toBe('8 left');
  });
});

describe('setup progress and the Next step: every role x Stripe x tickets', () => {
  const live = [{ id: 's1', name: 'Friday Social' }, { id: 's2', name: 'Sundays' }];
  const cases: [string, readonly ReturnType<typeof sale>[]][] = [
    ['no tickets', []],
    ['paid draft', [sale('draft')]],
    ['free draft', [sale('draft', { pricePence: 0 })]],
    ['paid on sale', [sale('on_sale')]],
    ['free on sale', [sale('on_sale', { pricePence: 0 })]],
  ];
  for (const role of ['owner', 'manager', 'contributor'])
    for (const stripe of ['none', 'started', 'connected'] as StripeState[])
      for (const [label, types] of cases) {
        it(`${role} | ${stripe} | ${label}`, () => {
          const steps = setupSteps(stripe, types);
          const step = nextStep(role, stripe, live, types);
          if (role === 'contributor') return expect(step).toBeNull();
          const firstOpen = steps.find((s) => !s.done);
          if (!firstOpen) return expect(step).toBeNull();
          expect(step?.kind).toBe({ payments: 'connect', ticket: 'add', on_sale: 'sell' }[firstOpen.key]);
          // The card names an event that has no tickets yet when it asks to connect or add.
          if (step?.kind !== 'sell') expect(step?.seriesId).toBe(types.length ? 's2' : 's1');
        });
      }
  it('no live event: no Next step', () => expect(nextStep('owner', 'none', [], [])).toBeNull());
});

describe('order line and days', () => {
  const today = '2026-10-27';
  it.each([
    ['2026-10-27T09:00:00Z', 'today'],
    ['2026-10-26T22:30:00Z', 'yesterday'],
    ['2026-10-27T00:30:00Z', 'today'], // GMT since 25 Oct: 00:30 London is still the 27th
    ['2026-07-31T23:30:00Z', '1 August'], // BST: London is already 1 August
    [null, ''],
  ])('%s -> %j', (iso, word) => {
    expect(dayWord(iso, today)).toBe(word);
  });
  it('shows what each ticket cost the buyer, fee in', () => {
    expect(orderLine({ quantity: 2, totalPence: 2100, paidAt: '2026-10-27T09:00:00Z' }, today)).toBe('2 \u00D7 \u00A310.50 \u00B7 today');
    expect(orderLine({ quantity: 1, totalPence: 0, paidAt: null }, today)).toBe('1 \u00D7 Free');
  });
});

describe('editor steps', () => {
  it('Continue checks only the fields of its step', () => {
    const e = validateForm({ name: '', paid: true, price: 'x', capacity: '', opensAt: '', closesAt: '' }, { hasOrders: false, reserved: 0 });
    expect(Object.keys(stepErrors(e, 1)).sort()).toEqual(['name', 'price']);
    expect(Object.keys(stepErrors(e, 2))).toEqual(['capacity']);
  });
  it('closes words', () => {
    expect(closesWords('', null)).toBe('When you stop selling');
    expect(closesWords('2026-11-06T20:00', '2026-11-06T20:00:00Z')).toBe('Event start');
    expect(closesWords('2026-11-06T19:00', '2026-11-06T20:00:00Z')).toBe('6 November, 19:00');
  });
});

describe('thousands separators: the one money helper and the one count helper', () => {
  it.each([
    [0, '\u00A30.00'],
    [1, '\u00A30.01'],
    [123506, '\u00A31,235.06'],
    [24017000, '\u00A3240,170.00'],
    [100_000_000, '\u00A31,000,000.00'],
  ])('formatPence(%i)', (pence, text) => expect(formatPence(pence)).toBe(text));
  it.each([
    [0, '0'],
    [999, '999'],
    [2022, '2,022'],
    [1_234_567, '1,234,567'],
  ])('formatCount(%i)', (n, text) => expect(formatCount(n)).toBe(text));
});

describe('the payments link under the number cards: every role x Stripe x ticket mix', () => {
  const free = sale('on_sale', { pricePence: 0 });
  const paid = sale('draft');
  const MIXES = { 'all free': [free], mixed: [free, paid], none: [] } as const;
  const live = [{ id: 's1', name: 'Friday Social' }];
  for (const role of ['owner', 'manager', 'contributor'] as const) {
    for (const stripe of ['none', 'started', 'connected'] as StripeState[]) {
      for (const [mix, types] of Object.entries(MIXES)) {
        it(`${role} | ${stripe} | ${mix}`, () => {
          const step = nextStep(role, stripe, live, types);
          const link = paymentsLink(role, stripe, step);
          // Exactly one way to Connect / Finish connecting for a manager who is not connected: the card or this link.
          const viaCard = step?.kind === 'connect';
          const canAct = role !== 'contributor' && stripe !== 'connected';
          expect(!!link).toBe(canAct && !viaCard);
          expect(viaCard && !!link).toBe(false);
          if (link) {
            expect(link.lead).toBe(stripe === 'none' ? 'Payments not connected.' : null);
            expect(link.action).toBe(stripe === 'none' ? 'Connect' : 'Finish connecting');
          }
        });
      }
    }
  }
});

describe('writeResult keeps the new ticket id', () => {
  it.each([
    [{ ok: true, created: true, ticket_type: { id: 'abc' } }, { ok: true, reason: null, id: 'abc' }],
    [{ ok: true }, { ok: true, reason: null, id: null }],
    [{ ok: false, reason: 'closed' }, { ok: false, reason: 'closed' }],
    [null, { ok: false, reason: 'unknown' }],
  ])('%j', (data, want) => expect(writeResult(data)).toEqual(want));
});

describe('fee zero: buyerTotal x price is the ticket price, no fee words', () => {
  it.each([[1000], [1], [1250], [202250], [0]])('%s', (p) => {
    const t = buyerTotal(p);
    expect(t.feePence).toBe(0);
    expect(t.totalPence).toBe(p);
    expect(t.line).not.toMatch(/50p|booking fee|\bfee\b/i);
  });
});
