// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { sanitizeReturnTo } from '@/lib/authRouting';
import { NOT_SWITCHED_ON, stripeStateOf } from '../../../tickets/ticketModel';
import { P3_TICKET_PATHS, getPaidSignInLink, getPaidStartPath } from '../paths';
import { SHAPES, STRIPE, home, org, series, type Shape } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';

/*
 * The single Get paid screen: role x Stripe state x arrival x `o`. One mapping (startView)
 * answers every row, so the table asserts the mapping once and the screen draws it.
 */

vi.mock('../data', (orig) => dataMock(orig as never));

import { GetPaidStart, POLL_FOR_MS, askOwner, startView } from '../GetPaid';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const shape = (over: Partial<Shape>): Shape => ({ ...SHAPES.bare, ...over });
const GP = (qs = '?o=org-1') => `/account/p3/get-paid${qs}`;
const setStripe = (k: 'none' | 'started' | 'connected', refetch = vi.fn()) => {
  q.stripe = { query: { ...ok(STRIPE[k]), refetch }, state: stripeStateOf(STRIPE[k]) };
  return refetch;
};
const primaries = () => [...document.querySelectorAll('button.p3-btn, a.p3-btn')].filter((e) => !e.classList.contains('p3-btn-line'));

describe('link builders', () => {
  it('the start path and sign-in link are exact, encoded and on-site', () => {
    expect(getPaidStartPath('x y')).toBe('/account/p3/get-paid?o=x%20y');
    const link = getPaidSignInLink('https://example.test', 'a&b=c');
    expect(link).toBe(`https://example.test/auth?mode=signin&returnTo=${encodeURIComponent('/account/p3/get-paid?o=a%26b%3Dc')}`);
    const returnTo = new URL(link).searchParams.get('returnTo');
    expect(sanitizeReturnTo(returnTo)).toBe('/account/p3/get-paid?o=a%26b%3Dc');
    expect(sanitizeReturnTo(getPaidStartPath('//evil.test'))?.startsWith('/')).toBe(true);
  });
  it('Stripe returns to the start path only when asked; the You path is unchanged', () => {
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'o1', 'return')).toBe('https://x.test/account/p3/you/get-paid?o=o1&stripe=return');
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'o1', 'refresh', 'start')).toBe('https://x.test/account/p3/get-paid?o=o1&stripe=refresh');
  });
});

describe('startView: the one mapping', () => {
  const o = org();
  const base = { manager: true, arrival: 'fresh', phase: null, switchedOff: false, org: o } as const;
  it.each([
    ['none', 'fresh', 'Connect Stripe'],
    ['started', 'fresh', 'Carry on with Stripe'],
    ['none', 'refresh', 'Connect Stripe'],
    ['started', 'refresh', 'Carry on with Stripe'],
    ['connected', 'fresh', 'Add a ticket'],
    ['connected', 'return', 'Add a ticket'],
  ] as const)('manager, %s, %s -> %s', (state, arrival, label) => {
    expect(startView({ ...base, state, arrival }).primary?.label).toBe(label);
  });
  it('"Add a ticket" only when connected', () => {
    for (const state of ['none', 'started'] as const) {
      for (const arrival of ['fresh', 'return', 'refresh'] as const) {
        for (const phase of [null, 'checking', 'timeout'] as const) {
          expect(startView({ ...base, state, arrival, phase }).primary?.kind).not.toBe('add');
        }
      }
    }
  });
  it('owner name or the page owner', () => {
    expect(askOwner(o)).toBe('Ask the page owner to connect payments');
    expect(askOwner({ ...o, team: [{ user_id: 'u1', member_role: 'owner', display_name: 'Rafa' }] })).toBe('Ask Rafa to connect payments');
  });
});

describe.each([
  ['owner', true], ['manager', true], ['contributor', false],
] as const)('screen: %s', (role, manager) => {
  describe.each([['none', 'Connect Stripe'], ['started', 'Carry on with Stripe']] as const)('stripe %s', (stripe, label) => {
    it('fresh: heading, what Stripe asks, ONE button (or none, with the reason)', () => {
      load(shape({ stripe, role }));
      show(<GetPaidStart />, GP());
      expect(screen.getByTestId('getpaid-start-title').textContent).toBe('Get paid for your tickets');
      expect(screen.getByTestId('getpaid-start-asks').textContent).toContain('What Stripe will ask you');
      expect(screen.getByTestId('getpaid-start-asks').querySelectorAll('li')).toHaveLength(3);
      expect(screen.queryByText('Add a ticket')).toBeNull();
      if (manager) {
        expect(primaries()).toHaveLength(1);
        const go = screen.getByTestId('getpaid-start-go') as HTMLButtonElement;
        expect(go.textContent).toBe(label);
        expect(go.style.minHeight).toBe('44px');
        fireEvent.click(go);
        expect(q.onboard.go).toHaveBeenCalledTimes(1);
      } else {
        expect(primaries()).toHaveLength(0);
        expect(screen.getByTestId('getpaid-start-note').textContent).toBe('Ask the page owner to connect payments');
      }
    });
    it('stripe=refresh says the link ran out and the button carries on', () => {
      load(shape({ stripe, role }));
      show(<GetPaidStart />, GP('?o=org-1&stripe=refresh'));
      if (manager) {
        expect(screen.getByTestId('getpaid-start-note').textContent).toMatch(/^That Stripe link ran out\./);
        expect(primaries()).toHaveLength(1);
      } else expect(primaries()).toHaveLength(0);
    });
  });
  it('connected: ready, the one Add a ticket button for managers (charges_enabled true)', () => {
    load(shape({ stripe: 'connected', role }));
    show(<GetPaidStart />, GP());
    expect(screen.getByTestId('getpaid-start-title').textContent).toBe('You’re ready to sell tickets');
    expect(screen.queryByTestId('getpaid-start-asks')).toBeNull();
    expect(screen.queryByTestId('getpaid-start-go')).toBeNull();
    if (manager) {
      expect(primaries()).toHaveLength(1);
      expect(screen.getByTestId('getpaid-start-add').getAttribute('href')).toBe('/account/p3/events/ser-1?tickets=1');
    } else expect(primaries()).toHaveLength(0);
  });
});

describe('Add a ticket target', () => {
  it('two live listed series -> Events', () => {
    const o = org();
    o.series = [series(), series({ id: 'ser-2' })];
    load(shape({ stripe: 'connected' }));
    q.home = ok(home(o));
    show(<GetPaidStart />, GP());
    expect(screen.getByTestId('getpaid-start-add').getAttribute('href')).toBe('/account/p3/events');
  });
});

describe('arriving from Stripe', () => {
  it('pending, then connected: polls every 3 s, stops on connected', () => {
    load(shape({ stripe: 'started' }));
    const refetch = setStripe('started');
    const view = show(<GetPaidStart />, GP('?o=org-1&stripe=return'));
    expect(screen.getByTestId('getpaid-start-status').textContent).toBe('Checking with Stripe…');
    expect(primaries()).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(9000); });
    expect(refetch).toHaveBeenCalledTimes(4); // on arrival, then every 3 s
    setStripe('connected', refetch);
    act(() => { view.again(); });
    expect(screen.getByTestId('getpaid-start-title').textContent).toBe('You’re ready to sell tickets');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(refetch).toHaveBeenCalledTimes(4);
  });
  it('times out at 30 s with a message and Check again, which polls again', () => {
    load(shape({ stripe: 'none' }));
    const refetch = setStripe('none');
    show(<GetPaidStart />, GP('?o=org-1&stripe=return'));
    act(() => { vi.advanceTimersByTime(POLL_FOR_MS); });
    expect(screen.getByTestId('getpaid-start-status').textContent).toBe('Stripe is still finishing. This can take a minute.');
    expect(primaries()).toHaveLength(1);
    const calls = refetch.mock.calls.length;
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(refetch.mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByTestId('getpaid-start-check'));
    expect(screen.getByTestId('getpaid-start-status').textContent).toBe('Checking with Stripe…');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(refetch.mock.calls.length).toBeGreaterThan(calls + 1);
  });
  it('unmount stops the polling', () => {
    load(shape({ stripe: 'none' }));
    const refetch = setStripe('none');
    const view = show(<GetPaidStart />, GP('?o=org-1&stripe=return'));
    act(() => { vi.advanceTimersByTime(3000); });
    view.unmount();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});

describe('errors and switched off', () => {
  it('a start error shows its reason beside the button', () => {
    load(shape({ stripe: 'none' }));
    q.onboard = { ...q.onboard, note: 'Something went wrong. Try again.' };
    show(<GetPaidStart />, GP());
    expect(screen.getByTestId('getpaid-start-error-note').textContent).toBe('Something went wrong. Try again.');
    expect(primaries()).toHaveLength(1);
  });
  it('switched off: the reason, no button', () => {
    load(shape({ stripe: 'none' }));
    q.onboard = { ...q.onboard, switchedOff: true };
    show(<GetPaidStart />, GP());
    expect(screen.getByTestId('getpaid-start-note').textContent).toBe(NOT_SWITCHED_ON);
    expect(primaries()).toHaveLength(0);
  });
});

describe('the o parameter and no page', () => {
  it('missing o falls back to the first page', () => {
    load(shape({ stripe: 'none' }));
    show(<GetPaidStart />, GP(''));
    expect(screen.getByTestId('getpaid-start-go')).toBeTruthy();
  });
  it('an unknown o never shows another page', () => {
    load(shape({ stripe: 'none' }));
    show(<GetPaidStart />, GP('?o=someone-else'));
    expect(screen.getByTestId('getpaid-start-wrong').textContent).toContain('This link is for a page that is not on your account');
    expect(screen.getByTestId('getpaid-start-wrong-home').getAttribute('href')).toBe('/account/p3');
    expect(screen.queryByTestId('getpaid-start-go')).toBeNull();
    expect(primaries()).toHaveLength(0);
  });
  it('signed in with no page: the way to set up, no dead button', () => {
    load(shape({ stripe: 'none' }));
    q.home = ok(home(null));
    show(<GetPaidStart />, GP());
    expect(screen.getByTestId('getpaid-start-setup').getAttribute('href')).toBe('/account/p3/start');
    expect(primaries()).toHaveLength(0);
  });
});

describe('wiring from source', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  it('the route sits in the own frame behind the ticketing flag, ahead of the P3Shell group', () => {
    const src = read('../../shell/P3Routes.tsx');
    const at = src.indexOf('path="get-paid"');
    expect(at).toBeGreaterThan(0);
    expect(src.slice(src.lastIndexOf('\n', at), src.indexOf('\n', at))).toContain('flags.organiserTicketing');
    expect(at).toBeLessThan(src.indexOf('<Route element={<P3Shell />}>'));
    expect(src).toContain("'own', toHome");
  });
  it('the start screen starts onboarding with the start return path', () => {
    expect(read('../GetPaid.tsx')).toContain("useStartOnboarding(org.id, 'start')");
  });
});
