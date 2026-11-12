// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { PAYOUTS_ASK_OWNER, NOT_SWITCHED_ON, STRIPE_COPY } from '../../../tickets/ticketModel';
import { P3_TICKET_PATHS } from '../paths';
import { SHAPES, type Shape, home, org, series } from './fixtures';
import { dataMock, failed, load, ok, pending, q, show } from './harness';

/*
 * W-T Get paid: You > Get paid x Stripe state x role x back-from-Stripe, Home's ONE prompt,
 * the tickets-sold tile and You's Get paid row. Flag wiring is checked from source.
 */

vi.mock('../data', (orig) => dataMock(orig as never));

import { GetPaidPrompt, GetPaidRow, GetPaidScreen, TicketsSoldTile } from '../GetPaid';

afterEach(cleanup);

const shape = (over: Partial<Shape>): Shape => ({ ...SHAPES.bare, ...over });
const GP = (qs = '') => `/account/p3/you/get-paid${qs}`;

describe.each([
  ['none', 'owner', 'Not connected', 'Connect payments', true],
  ['started', 'owner', 'Not finished', 'Finish connecting payments', true],
  ['connected', 'owner', 'Paid out via Stripe', 'Payments connected', false],
  ['none', 'contributor', 'Not connected', 'Connect payments', false],
  // Slice 2 (ORG-6.4-r03-P4, PQ1): PAY none and PAY half-set for a manager: ask the owner, no button.
  ['none', 'manager', 'Not connected', 'Connect payments', false],
  ['started', 'manager', 'Not finished', 'Finish connecting payments', false],
] as const)('Get paid: stripe %s, %s', (stripe, role, tag, title, canGo) => {
  it('tag, title, the button and why it is greyed', () => {
    load(shape({ stripe, role }));
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-getpaid-tag').textContent).toBe(tag);
    expect(screen.getByTestId('tix-getpaid-title').textContent).toBe(title);
    const go = screen.queryByTestId('tix-getpaid-go') as HTMLButtonElement | null;
    if (stripe === 'connected') expect(go).toBeNull();
    // Slice 2 (PQ1): anyone but the owner gets no payouts button, only the ask-the-owner line.
    else if (role !== 'owner') {
      expect(go).toBeNull();
      expect(screen.getByTestId('tix-getpaid-why').textContent).toBe(PAYOUTS_ASK_OWNER);
    } else {
      expect(go?.textContent).toBe(STRIPE_COPY[stripe].action);
      expect(go?.disabled).toBe(!canGo);
      if (!canGo) expect(screen.getByTestId('tix-getpaid-why').textContent).toBe(PAYOUTS_ASK_OWNER);
    }
  });
});

// Review 1520-r1 F2: a summary that carries sales, so each block WOULD render for the owner.
describe('Get paid: money blocks are the owner\u2019s alone (PQ1, review 1520-r1 F2)', () => {
  const POUND = /\u00A3/;
  const selling = (role: string, stripe: Shape['stripe']) => shape({ role, stripe, sales: SHAPES.selling.sales });
  it('owner control: the same summary draws Money so far and the setup steps', () => {
    load(selling('owner', 'none'));
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-money')).toBeTruthy();
    expect(screen.getByTestId('tix-setup')).toBeTruthy();
  });
  describe.each(['manager', 'contributor'])('%s', (role) => {
    it.each(['none', 'started', 'connected'] as const)('stripe %s: no Money so far, no setup steps, no amount', (stripe) => {
      load(selling(role, stripe));
      const { container } = show(<GetPaidScreen />, GP());
      expect(screen.queryByTestId('tix-money')).toBeNull();
      expect(screen.queryByTestId('tix-setup')).toBeNull();
      expect(screen.queryByTestId('tix-money-error')).toBeNull();
      expect(screen.queryByTestId('tix-money-refused')).toBeNull();
      expect(container.textContent).not.toMatch(POUND);
    });
    it('a failed or refused summary says nothing about money', () => {
      load(selling(role, 'none'));
      q.summary = failed();
      show(<GetPaidScreen />, GP());
      expect(screen.queryByTestId('tix-money-error')).toBeNull();
      cleanup();
      q.summary = ok({ ok: false, reason: 'not_authorised', types: [] });
      show(<GetPaidScreen />, GP());
      expect(screen.queryByTestId('tix-money-refused')).toBeNull();
    });
    it('asks the summary read for no money (F3)', () => {
      load(selling(role, 'none'));
      show(<GetPaidScreen />, GP());
      expect(q.summaryMoney).toBe(false);
    });
  });
});

describe('Get paid states', () => {
  it('back from Stripe and the link that ran out each say what happened', () => {
    load(shape({ stripe: 'started' }));
    show(<GetPaidScreen />, GP('?o=org-1&stripe=return'));
    expect(screen.getByTestId('tix-getpaid-back').textContent).toMatch(/^Back from Stripe\./);
    cleanup();
    show(<GetPaidScreen />, GP('?o=org-1&stripe=refresh'));
    expect(screen.getByTestId('tix-getpaid-back').textContent).toMatch(/^That Stripe link ran out\./);
  });
  it('payments not switched on: the button goes, the reason stays', () => {
    load(shape({ stripe: 'none' }));
    q.onboard = { ...q.onboard, switchedOff: true };
    show(<GetPaidScreen />, GP());
    expect(screen.queryByTestId('tix-getpaid-go')).toBeNull();
    expect(screen.getByTestId('tix-getpaid-off').textContent).toBe(NOT_SWITCHED_ON);
  });
  it('a failed Connect tap shows its reason', () => {
    load(shape({ stripe: 'none' }));
    q.onboard = { ...q.onboard, note: 'That did not work. Try again in a moment.' };
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-getpaid-note').getAttribute('role')).toBe('alert');
  });
  it('loading and a failed account read', () => {
    load(shape({}));
    q.stripe = { query: pending(), state: null };
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-getpaid-stripe-loading')).toBeTruthy();
    cleanup();
    const retry = failed();
    q.stripe = { query: retry, state: null };
    show(<GetPaidScreen />, GP());
    fireEvent.click(screen.getByText('Try again'));
    expect(retry.refetch).toHaveBeenCalled();
  });
  it('no organiser page: says what to do', () => {
    load(shape({}));
    q.home = ok(home(null));
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-getpaid-nopage').textContent).toContain('Set up your organiser page first');
  });
  it('setup steps for a manager with a live event; money so far once anything sold', () => {
    load(SHAPES.survey);
    show(<GetPaidScreen />, GP());
    // survey: connected, 2 types, 2 sold, none on sale now -> 2 of 3 (On sale counts a sale)
    expect(screen.queryByTestId('tix-setup')).toBeNull();
    expect(screen.getByTestId('tix-money-sold').textContent).toBe('Sold2');
    expect(screen.getByTestId('tix-money-note').textContent).toBe('Ticket money before Stripe\u2019s fees. \u00A310.50 refunded.');
    cleanup();
    load(SHAPES.bare);
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-setup-line').textContent).toBe('Setup 0 of 3 done');
    expect(screen.queryByTestId('tix-money')).toBeNull();
  });
  it('a contributor (legacy row, A1) sees no money line at all: no refusal, no 0 (slice 2, PQ1)', () => {
    load(SHAPES.contributor);
    show(<GetPaidScreen />, GP());
    expect(screen.queryByTestId('tix-money-refused')).toBeNull();
    expect(screen.queryByTestId('tix-money')).toBeNull();
  });
});

describe('Home: the ONE Get paid prompt', () => {
  it.each([
    ['owner, none, live', shape({ stripe: 'none' }), 'Get paid for tickets'],
    ['manager, started, live', shape({ stripe: 'started' }), 'Finish connecting payments'],
    ['manager, started, live: payouts are the owner\'s, no prompt', shape({ stripe: 'started', role: 'manager' }), null],
    ['owner, connected', shape({ stripe: 'connected' }), null],
    ['contributor, none', shape({ stripe: 'none', role: 'contributor' }), null],
    ['owner, none, nothing live', shape({ stripe: 'none', lifecycle: 'draft' }), null],
  ])('%s', (_, s, title) => {
    load(s);
    show(<GetPaidPrompt />, '/account/p3');
    expect(screen.queryByTestId('tix-prompt-title')?.textContent ?? null).toBe(title);
    if (title) expect(screen.getByTestId('tix-prompt-more').getAttribute('href')).toBe(P3_TICKET_PATHS.getPaid('org-1'));
  });
  it('the prompt waits for the account read (never a flicker)', () => {
    load(shape({ stripe: 'none' }));
    q.stripe = { query: pending(), state: null };
    show(<GetPaidPrompt />, '/account/p3');
    expect(screen.queryByTestId('tix-prompt')).toBeNull();
  });
  it('tickets-sold tile only once anything has sold', () => {
    load(SHAPES.selling);
    show(<TicketsSoldTile />, '/account/p3');
    expect(screen.getByTestId('tix-sold-tile').textContent).toBe('34Tickets sold \u00B7 \u00A3328.00');
    cleanup();
    // A manager's tile: the count, never an amount (and never a \u00A30.00 from a counts-only summary).
    load({ ...SHAPES.selling, role: 'manager' });
    show(<TicketsSoldTile />, '/account/p3');
    expect(screen.getByTestId('tix-sold-tile').textContent).toBe('34Tickets sold');
    cleanup();
    load(SHAPES.bare);
    show(<TicketsSoldTile />, '/account/p3');
    expect(screen.queryByTestId('tix-sold-tile')).toBeNull();
  });
});

describe("You's Get paid row", () => {
  it.each([['none', 'Not connected'], ['started', 'Not finished'], ['connected', 'Paid out via Stripe']] as const)('%s -> %s', (stripe, tag) => {
    load(shape({ stripe }));
    show(<GetPaidRow />, '/account/p3/you');
    expect(screen.getByTestId('tix-you-getpaid-tag').textContent).toBe(tag);
    expect(screen.getByTestId('tix-you-getpaid').getAttribute('href')).toBe(P3_TICKET_PATHS.getPaid('org-1'));
  });
  it('with two pages, the one with a live event', () => {
    load(shape({}));
    q.home = ok({ today: '2026-10-27', organisers: [org({ id: 'org-0' }, series({ lifecycle_status: 'draft' })), org()] });
    show(<GetPaidRow />, '/account/p3/you');
    expect(screen.getByTestId('tix-you-getpaid').getAttribute('href')).toBe(P3_TICKET_PATHS.getPaid('org-1'));
  });
});

describe('flag wiring (source)', () => {
  const src = (p: string) => readFileSync(`src/modules/organiser/p3/${p}`, 'utf8').replace(/\r\n/g, '\n');
  it('every W-T mount sits behind flags.organiserTicketing', () => {
    expect(src('screens/EventPage.tsx')).toContain('{flags.organiserTicketing && <TicketsEntry seriesId={ws.series.id} />}');
    expect(src('screens/HomeScreen.tsx')).toContain('{flags.organiserTicketing && <GetPaidPrompt />}');
    expect(src('screens/HomeScreen.tsx')).toContain('{flags.organiserTicketing && <TicketsSoldTile />}');
    expect(src('shell/youTickets.tsx')).toContain('{flags.organiserTicketing && <Route path="you/get-paid" element={<GetPaidScreen />} />}');
    expect(src('shell/youTickets.tsx')).toContain('{flags.organiserTicketing && <GetPaidRow />}');
  });
  it('Stripe sends the person back to You > Get paid', () => {
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'org 1', 'return')).toBe('https://x.test/account/p3/you/get-paid?o=org%201&stripe=return');
  });
});

describe('Get paid frame', () => {
  it.each(['bare', 'pending'] as const)('sits in the same pushed frame as the You screens (%s)', (k) => {
    load(shape({ stripe: 'connected', role: 'owner' }));
    if (k === 'pending') q.home = pending();
    show(<GetPaidScreen />, GP());
    const main = document.querySelector('main.p3-main.p3-main-pushed');
    expect(main).not.toBeNull();
    expect(main?.querySelector('[data-testid="tix-getpaid-card"], [data-testid="tix-getpaid-loading"]')).not.toBeNull();
    const back = document.querySelector('header.p3-top a.p3-back') as HTMLAnchorElement | null;
    expect(back?.getAttribute('href')).toBe('/account/p3/you');
    expect(document.querySelector('header.p3-top h1')?.textContent).toBe('Get paid');
  });
});
