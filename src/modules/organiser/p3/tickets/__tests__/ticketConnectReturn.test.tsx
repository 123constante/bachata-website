// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import {
  CONNECT_RETURN_CHECKING,
  CONNECT_RETURN_NEEDS,
  PAYOUTS_ASK_OWNER,
  CONNECT_RETURN_NONE,
  connectReturnBanner,
  stripeStateOf,
} from '../../../tickets/ticketModel';
import { STRIPE, home, org, series, type } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';
import { SHAPES } from './fixtures';

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn(), startOnboarding: vi.fn() }));
vi.mock('../data', async (orig) => ({ ...(await dataMock(orig as never)) }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';
import { CONNECT_RETURN_EVERY_MS, CONNECT_RETURN_FOR_MS } from '../TicketsEntry';

type StripeKey = 'none' | 'started' | 'connected';
type Role = 'owner' | 'manager' | 'contributor';
type Drafts = 'zero' | 'one_paid' | 'two_paid' | 'free_only';
const STRIPES: StripeKey[] = ['none', 'started', 'connected'];
const ROLES: Role[] = ['owner', 'manager', 'contributor'];
const DRAFTS: Drafts[] = ['zero', 'one_paid', 'two_paid', 'free_only'];

const draftsOf = (d: Drafts) =>
  d === 'zero'
    ? []
    : d === 'one_paid'
      ? [type('a', { status: 'draft', pricePence: 1200, name: 'Door' })]
      : d === 'two_paid'
        ? [type('a', { status: 'draft', pricePence: 1200, name: 'Door' }), type('b', { status: 'draft', pricePence: 800, name: 'Early' })]
        : [type('f', { status: 'draft', pricePence: 0, name: 'Free' })];

/** The expected banner, written out per cell (not computed from the code under test). */
const WANT = (stripe: StripeKey, d: Drafts, role: Role, arrived: boolean, polling: boolean) => {
  if (!arrived || role === 'contributor' || d === 'free_only') return null;
  if (stripe === 'connected') {
    if (d === 'zero') return { kind: 'ready_none', line: CONNECT_RETURN_NONE, buttons: [] };
    if (d === 'one_paid') return { kind: 'ready_drafts', line: 'Payments connected. Put Door on sale.', buttons: ['Put on sale'] };
    return { kind: 'ready_drafts', line: 'Payments connected. Put Door, Early on sale.', buttons: ['Put all on sale'] };
  }
  if (polling) return { kind: 'checking', line: CONNECT_RETURN_CHECKING, buttons: [] };
  if (role === 'manager') return { kind: 'needs_more', line: PAYOUTS_ASK_OWNER, buttons: [] };
  return { kind: 'needs_more', line: CONNECT_RETURN_NEEDS, buttons: ['Carry on with Stripe'] };
};

describe('connectReturnBanner: stripe x drafts x role x arrived x polling', () => {
  for (const stripe of STRIPES) for (const d of DRAFTS) for (const role of ROLES) for (const arrived of [true, false]) for (const polling of [true, false]) {
    it(`${stripe} / ${d} / ${role} / arrived=${arrived} / polling=${polling}`, () => {
      const got = connectReturnBanner({ arrivedFromStripe: arrived, stripe, role, drafts: draftsOf(d), polling });
      const want = WANT(stripe, d, role, arrived, polling);
      if (!want) return expect(got).toBeNull();
      expect(got?.kind).toBe(want.kind);
      expect(got?.line).toBe(want.line);
      expect(got?.actions.map((a) => a.label)).toEqual(want.buttons);
    });
  }
  it('an unknown Stripe state reads as checking, never as needing more', () => {
    expect(connectReturnBanner({ arrivedFromStripe: true, stripe: null, role: 'owner', drafts: draftsOf('one_paid') })?.kind).toBe('checking');
  });
  it('a paid ticket already on sale is not a draft: no banner', () => {
    const t = [type('s', { status: 'on_sale', pricePence: 1200, name: 'Door' })];
    expect(connectReturnBanner({ arrivedFromStripe: true, stripe: 'connected', role: 'owner', drafts: t })).toBeNull();
  });
});

function setup(stripe: StripeKey, d: Drafts, role: Role) {
  load(SHAPES.bare);
  q.home = ok(home(org({ role: role as never }, series())));
  q.types = ok(draftsOf(d));
  q.stripe = { query: ok(STRIPE[stripe]), state: stripeStateOf(STRIPE[stripe]) };
}
const RETURN = '/account/p3/events/ser-1?tickets=1&stripe=return';
const refetchOf = () => (q.stripe as { query: { refetch: ReturnType<typeof vi.fn> } }).query.refetch;

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the sheet', () => {
  it('shows the banner on arrival with stripe=return', () => {
    setup('connected', 'one_paid', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    expect(screen.getByTestId('tix-return-banner').getAttribute('data-kind')).toBe('ready_drafts');
  });

  it.each([
    ['a plain visit', '/account/p3/events/ser-1'],
    ['tickets=1 without a return', '/account/p3/events/ser-1?tickets=1'],
    ['stripe=refresh', '/account/p3/events/ser-1?tickets=1&stripe=refresh'],
  ])('no banner on %s', (_n, path) => {
    setup('connected', 'one_paid', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, path);
    if (path.includes('tickets=1') === false) fireEvent.click(screen.getByTestId('tix-row'));
    expect(screen.queryByTestId('tix-return-banner')).toBeNull();
  });

  it('after the params are dropped, a fresh mount (reload) has no banner', () => {
    setup('connected', 'one_paid', 'owner');
    const first = show(<TicketsEntry seriesId="ser-1" />, RETURN);
    first.unmount();
    show(<TicketsEntry seriesId="ser-1" />, '/account/p3/events/ser-1');
    fireEvent.click(screen.getByTestId('tix-row'));
    expect(screen.queryByTestId('tix-return-banner')).toBeNull();
  });

  it('a contributor and a free-only list get no banner', () => {
    setup('connected', 'one_paid', 'contributor');
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    expect(screen.queryByTestId('tix-return-banner')).toBeNull();
    cleanup();
    setup('connected', 'free_only', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    expect(screen.queryByTestId('tix-return-banner')).toBeNull();
  });

  it('Put on sale uses the existing move, and no banner shows once the draft is on sale', async () => {
    setup('connected', 'one_paid', 'owner');
    api.setTicketStatus.mockResolvedValue({ ok: true });
    const view = show(<TicketsEntry seriesId="ser-1" />, RETURN);
    await act(async () => {
      fireEvent.click(screen.getByTestId('tix-return-put_on_sale'));
    });
    expect(api.setTicketStatus).toHaveBeenCalledTimes(1);
    expect(api.setTicketStatus).toHaveBeenCalledWith('a', 'on_sale');
    q.types = ok([type('a', { status: 'on_sale', pricePence: 1200, name: 'Door' })]);
    view.again();
    expect(screen.queryByTestId('tix-return-banner')).toBeNull();
  });

  it('Put all on sale moves every paid draft, and only those', async () => {
    setup('connected', 'two_paid', 'owner');
    api.setTicketStatus.mockResolvedValue({ ok: true });
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    await act(async () => {
      fireEvent.click(screen.getByTestId('tix-return-put_all_on_sale'));
    });
    expect(api.setTicketStatus.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b']);
  });

  it('an untouched sheet sends nothing', () => {
    setup('connected', 'two_paid', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    expect(api.setTicketStatus).not.toHaveBeenCalled();
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });

  it('Carry on with Stripe is the existing onboarding start', () => {
    setup('started', 'one_paid', 'owner');
    const go = vi.fn(async () => {});
    q.onboard = { go, busy: false, note: null, switchedOff: false };
    vi.useFakeTimers();
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS + 1));
    fireEvent.click(screen.getByTestId('tix-return-carry_on'));
    expect(go).toHaveBeenCalledTimes(1);
  });
});

describe('connectReturnPoll', () => {
  it('refetches every 3 s, stops at 30 s, and the banner then says more is needed', () => {
    vi.useFakeTimers();
    setup('started', 'one_paid', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, RETURN);
    expect(screen.getByTestId('tix-return-banner').getAttribute('data-kind')).toBe('checking');
    const refetch = refetchOf();
    const base = refetch.mock.calls.length; // the one on arrival
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_EVERY_MS * 3));
    expect(refetch.mock.calls.length - base).toBe(3);
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS));
    const after = refetch.mock.calls.length;
    expect(after - base).toBeLessThanOrEqual(CONNECT_RETURN_FOR_MS / CONNECT_RETURN_EVERY_MS);
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS));
    expect(refetch.mock.calls.length).toBe(after);
    expect(screen.getByTestId('tix-return-banner').getAttribute('data-kind')).toBe('needs_more');
  });

  it('stops as soon as Stripe reads connected', () => {
    vi.useFakeTimers();
    setup('started', 'one_paid', 'owner');
    const view = show(<TicketsEntry seriesId="ser-1" />, RETURN);
    const refetch = refetchOf();
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_EVERY_MS));
    q.stripe = { query: { ...(q.stripe as { query: object }).query, refetch }, state: 'connected' };
    view.again();
    const n = refetch.mock.calls.length;
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS));
    expect(refetch.mock.calls.length).toBe(n);
    expect(screen.getByTestId('tix-return-banner').getAttribute('data-kind')).toBe('ready_drafts');
  });

  it('stops on unmount', () => {
    vi.useFakeTimers();
    setup('started', 'one_paid', 'owner');
    const view = show(<TicketsEntry seriesId="ser-1" />, RETURN);
    const refetch = refetchOf();
    view.unmount();
    const n = refetch.mock.calls.length;
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS));
    expect(refetch.mock.calls.length).toBe(n);
  });

  it('never polls on a plain visit', () => {
    vi.useFakeTimers();
    setup('started', 'one_paid', 'owner');
    show(<TicketsEntry seriesId="ser-1" />, '/account/p3/events/ser-1?tickets=1');
    const refetch = refetchOf();
    act(() => void vi.advanceTimersByTime(CONNECT_RETURN_FOR_MS));
    expect(refetch).not.toHaveBeenCalled();
  });
});
