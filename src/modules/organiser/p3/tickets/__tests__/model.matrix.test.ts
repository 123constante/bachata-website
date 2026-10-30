import { describe, expect, it } from 'vitest';
import {
  EVENT_SALE,
  NOT_MANAGER,
  ORDER_TAG,
  PAYMENTS_WHERE,
  STRIPE_COPY,
  moveBlock,
  reasonMessage,
} from '../../../tickets/ticketModel';
import {
  PREVIEW_ORDERS,
  TONE_CLASS,
  addWhy,
  draftFor,
  newDraft,
  seeAllLabel,
  shownOrders,
  showPrompt,
  ticketsRowOf,
} from '../model';
import { SHAPES, SHAPE_KEYS, type Shape, type ShapeKey, order, type } from './fixtures';

/* W-T pure layer: the P3 copy swap, the Tickets row, the order preview, the prompt rule, the held draft. */

describe('Ticketing copy: no line points at the retired Tickets home', () => {
  it('moveBlock and the server refusal both name You > Get paid', () => {
    const paid = { pricePence: 1000, reserved: 0, capacity: 10 };
    expect(PAYMENTS_WHERE).toBe('Connect payments in You \u203A Get paid before selling paid tickets.');
    expect(moveBlock(paid, 'on_sale', { role: 'owner', stripe: 'none', seriesLive: true })).toBe(PAYMENTS_WHERE);
    expect(moveBlock(paid, 'on_sale', { role: 'owner', stripe: 'started', seriesLive: true })).toBe(PAYMENTS_WHERE);
    expect(reasonMessage('organiser_not_onboarded')).toBe(PAYMENTS_WHERE);
  });
  it('no reason line names the Tickets home', () => {
    for (const r of ['organiser_not_onboarded', 'not_authorised', 'has_orders', 'at_capacity', null, 'whatever'])
      expect(reasonMessage(r)).not.toMatch(/Tickets home/i);
  });
});

describe('one tone map covers every tag ticketing shows', () => {
  it.each([
    ...Object.values(EVENT_SALE).map((s) => s.tone),
    ...Object.values(ORDER_TAG).map((s) => s.tone),
    ...Object.values(STRIPE_COPY).map((s) => s.tone),
  ])('%s', (tone) => expect(TONE_CLASS[tone]).toMatch(/^p3-tag p3-tag-/));
});

/** Each shape's Tickets row: [chip, detail]. */
const ROW: Record<ShapeKey, [string, string]> = {
  bare: ['No tickets', 'Add a ticket'],
  survey: ['Not selling', 'Paused \u00B7 2 sold'],
  selling: ['Selling', '34 sold \u00B7 26 left of 60'],
  started: ['Not selling', 'Not on sale yet \u00B7 0 sold'],
  closed: ['No tickets', '3 sold \u00B7 Add a ticket'],
  past: ['Not selling', 'Paused \u00B7 4 sold'],
  contributor: ['Selling', '26 left of 40'],
};

describe.each(SHAPE_KEYS)('Tickets row: %s', (k) => {
  const s: Shape = SHAPES[k];
  const sold = s.sales === 'refused' ? null : new Map<string, number>(s.sales.map((r) => [r.id, r.ticketsSold]));
  const view = ticketsRowOf(s.types, sold, addWhy(s.role, s.lifecycle === 'live'));
  it('chip and detail', () => expect([view.chip.label, view.detail]).toEqual(ROW[k]));
  it('the chip is the shipped EVENT_SALE word (one mapping)', () => expect(Object.values(EVENT_SALE).map((e) => e.label)).toContain(view.chip.label));
});

describe('Tickets row: no tickets and not allowed', () => {
  it('a past event says why nothing can be added', () => expect(ticketsRowOf([], null, addWhy('owner', false)).detail).toBe('Put this event live before adding tickets.'));
  it('a contributor is not told to add one', () => expect(ticketsRowOf([], null, addWhy('contributor', true)).detail).toBe('None yet'));
  it('addWhy: role first, then live', () => {
    expect(addWhy('contributor', false)).toBe(NOT_MANAGER);
    expect(addWhy('manager', true)).toBeNull();
  });
});

describe('orders preview', () => {
  it('shows paid / refunded / disputed newest first, never pending or expired', () => {
    const rows = shownOrders([
      order('a', 't', { paidAt: '2026-10-01T00:00:00Z' }),
      order('b', 't', { status: 'pending', paidAt: null }),
      order('c', 't', { status: 'expired', paidAt: null }),
      order('d', 't', { status: 'disputed', paidAt: '2026-10-03T00:00:00Z' }),
      order('e', 't', { status: 'refunded', paidAt: '2026-10-02T00:00:00Z' }),
    ]);
    expect(rows.map((o) => o.id)).toEqual(['d', 'e', 'a']);
  });
  it.each([[0, null], [1, null], [PREVIEW_ORDERS, null], [3, 'See all 3 orders'], [140, 'See all 140 orders']])('%i orders -> %s', (n, label) =>
    expect(seeAllLabel(n)).toBe(label));
});

describe('Home Get paid prompt', () => {
  it.each([
    ['owner', true, 'none', true],
    ['manager', true, 'started', true],
    ['owner', true, 'connected', false],
    ['owner', true, null, false],
    ['owner', false, 'none', false],
    ['contributor', true, 'none', false],
  ] as const)('%s, live=%s, stripe=%s -> %s', (role, live, stripe, shown) => expect(showPrompt(role, live, stripe)).toBe(shown));
});

describe('the add / edit draft is held by the parent', () => {
  it('a new ticket on a one-off closes at the event start by default', () => {
    const d = newDraft(null, '2026-11-01T19:00:00Z');
    expect([d.key, d.step, d.closeMode, d.form.closesAt]).toEqual(['new', 1, 'event', '2026-11-01T19:00']);
  });
  it('the same sheet keeps its draft (step and typed values); another sheet starts fresh', () => {
    const held = { ...newDraft(null, null), step: 3 as const, form: { ...newDraft(null, null).form, name: 'Early bird' } };
    expect(draftFor(held, null, null)).toBe(held);
    const t = type('t1', { name: 'Door' });
    expect(draftFor(held, t, null).form.name).toBe('Door');
    expect(draftFor(held, t, null).step).toBe(1);
  });
});
