// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { NOT_MANAGER_STRIPE, NOT_SWITCHED_ON, STRIPE_COPY } from '../../../tickets/ticketModel';
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
] as const)('Get paid: stripe %s, %s', (stripe, role, tag, title, canGo) => {
  it('tag, title, the button and why it is greyed', () => {
    load(shape({ stripe, role }));
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-getpaid-tag').textContent).toBe(tag);
    expect(screen.getByTestId('tix-getpaid-title').textContent).toBe(title);
    const go = screen.queryByTestId('tix-getpaid-go') as HTMLButtonElement | null;
    if (stripe === 'connected') expect(go).toBeNull();
    else {
      expect(go?.textContent).toBe(STRIPE_COPY[stripe].action);
      expect(go?.disabled).toBe(!canGo);
      if (!canGo) expect(screen.getByTestId('tix-getpaid-why').textContent).toBe(NOT_MANAGER_STRIPE);
    }
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
  it('a contributor reading a refused summary sees the refusal, not a 0', () => {
    load(SHAPES.contributor);
    show(<GetPaidScreen />, GP());
    expect(screen.getByTestId('tix-money-refused').textContent).toBe('Only an owner or manager of this page can change tickets.');
    expect(screen.queryByTestId('tix-money')).toBeNull();
  });
});

describe('Home: the ONE Get paid prompt', () => {
  it.each([
    ['owner, none, live', shape({ stripe: 'none' }), 'Get paid for tickets'],
    ['manager, started, live', shape({ stripe: 'started', role: 'manager' }), 'Finish connecting payments'],
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
