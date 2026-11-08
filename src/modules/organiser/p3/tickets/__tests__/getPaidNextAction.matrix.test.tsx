// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { stripeStateOf } from '../../../tickets/ticketModel';
import { STRIPE, home, org, series, SHAPES, type Shape } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';

/*
 * S4 (G5 + G6): every Connect entry point x every return kind x every Stripe state x events.
 * One return handler (refetch on arrival, 3 s poll for 30 s), no "reload the page", and a real
 * next action once connected: Add a ticket opens the Tickets sheet (?tickets=1).
 */

vi.mock('../data', (orig) => dataMock(orig as never));

import { GetPaidScreen, GetPaidStart } from '../GetPaid';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const STATES = ['none', 'started', 'waiting', 'connected'] as const;
type St = (typeof STATES)[number];
const EVENTS = {
  one: [series({ id: 'ser-1' })],
  many: [series({ id: 'ser-1' }), series({ id: 'ser-2', name: 'Friday Class' })],
  none: [],
  noneLive: [series({ id: 'ser-d', lifecycle_status: 'draft' })],
} as const;
type Ev = keyof typeof EVENTS;

const setup = (stripe: St, ev: Ev, role = 'owner') => {
  load({ ...SHAPES.bare, stripe, role } as Shape);
  q.home = ok(home(org({ role: role as 'owner', series: [...EVENTS[ev]] })));
  const refetch = vi.fn();
  q.stripe = { query: { ...ok(STRIPE[stripe]), refetch }, state: stripeStateOf(STRIPE[stripe]) };
  return refetch;
};

const ENTRIES = [
  ['You > Get paid', <GetPaidScreen key="a" />, '/account/p3/you/get-paid', 'tix-getpaid-add'],
  ['start screen', <GetPaidStart key="b" />, '/account/p3/get-paid', 'getpaid-start-add'],
] as const;
const href = (id: string) => (screen.getByTestId(id) as HTMLAnchorElement).getAttribute('href');

describe.each(ENTRIES)('%s', (_n, node, path, addId) => {
  describe.each(['return', 'refresh', 'none'] as const)('arrival %s', (kind) => {
    const url = `${path}?o=org-1${kind === 'none' ? '' : `&stripe=${kind}`}`;
    describe.each(['none', 'started', 'waiting'] as const)('stripe %s', (stripe) => {
      it('never says reload; polls only after a return, 3 s for 30 s', () => {
        const refetch = setup(stripe, 'one');
        show(node, url);
        expect(document.body.textContent).not.toMatch(/reload/i);
        const first = refetch.mock.calls.length;
        act(() => { vi.advanceTimersByTime(30_000); });
        const polled = refetch.mock.calls.length - first;
        if (kind === 'return') {
          expect(polled).toBeGreaterThanOrEqual(8);
          expect(polled).toBeLessThanOrEqual(10);
        } else expect(polled).toBe(0);
        const after = refetch.mock.calls.length;
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(refetch.mock.calls.length).toBe(after);
        expect(screen.queryByTestId(addId)).toBeNull();
      });
      it('always leaves a next action on screen', () => {
        setup(stripe, 'one');
        show(node, url);
        expect(document.querySelectorAll('button:not([disabled]), a[href]').length).toBeGreaterThan(0);
      });
    });
    it('a return while connected stops polling at once', () => {
      const refetch = setup('connected', 'one');
      show(node, url);
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(refetch.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe.each(['return', 'none'] as const)('connected, arrival %s: Add a ticket', (kind) => {
    const url = `${path}?o=org-1${kind === 'none' ? '' : `&stripe=${kind}`}`;
    it('one live event: opens that event’s Tickets sheet', () => {
      setup('connected', 'one');
      show(node, url);
      expect(href(addId)).toBe('/account/p3/events/ser-1?tickets=1');
    });
    it('several events: goes to the events list and says why', () => {
      setup('connected', 'many');
      show(node, url);
      expect(href(addId)).toBe('/account/p3/events');
      expect(screen.getByTestId(`${addId}-why`).textContent).toMatch(/more than one event/i);
    });
    it('no events at all: says an event comes first, with a link to create one', () => {
      setup('connected', 'none');
      show(node, url);
      expect(screen.getByTestId(`${addId}-why`).textContent).toMatch(/need an event first/i);
      expect(href(addId)).toMatch(/\/account\/p3\/create/);
    });
    it('events but none live: the events list, with the reason', () => {
      setup('connected', 'noneLive');
      show(node, url);
      expect(href(addId)).toBe('/account/p3/events');
      expect(screen.getByTestId(`${addId}-why`).textContent).toMatch(/none of your events is live/i);
    });
    it('a contributor gets no Add a ticket', () => {
      setup('connected', 'one', 'contributor');
      show(node, url);
      expect(screen.queryByTestId(addId)).toBeNull();
    });
  });
});
