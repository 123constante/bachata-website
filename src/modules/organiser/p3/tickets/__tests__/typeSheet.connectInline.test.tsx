// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { CONNECT_LABEL, CONNECT_LINE, CONNECT_RESUME_LABEL, NOT_MANAGER, PAYMENTS_WHERE, PAYOUTS_ASK_OWNER, stripeStateOf } from '../../../tickets/ticketModel';
import { P3_TICKET_PATHS } from '../paths';
import { SHAPES, STRIPE, home, org, series, type } from './fixtures';
import { dataMock, load, ok, pending, q, show } from './harness';

/*
 * Connect payments inline: {paid, free} x Stripe {connected, started, none, loading, not_configured} x role x arrival.
 * ONE mapping per fact (EXPECT): where the block shows, its one button, when Put on sale is enabled.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
const calls = vi.hoisted(() => ({ onboard: [] as unknown[][] }));
vi.mock('../data', async (orig) => ({
  ...(await dataMock(orig as never)),
  useStartOnboarding: (...a: unknown[]) => {
    calls.onboard.push(a);
    return q.onboard;
  },
}));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn(), startOnboarding: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  calls.onboard.length = 0;
});
afterEach(cleanup);

type StripeKey = 'connected' | 'started' | 'none' | 'loading' | 'not_configured';
type Role = 'owner' | 'manager' | 'contributor';
const STRIPES: StripeKey[] = ['connected', 'started', 'none', 'loading', 'not_configured'];
const ROLES: Role[] = ['owner', 'manager', 'contributor'];
const PRICES = [['paid', 1200], ['free', 0]] as const;

/** The ONE mapping for every fact under test. */
const EXPECT = (pence: number, stripe: StripeKey, role: Role) => {
  const manager = role !== 'contributor';
  const owner = role === 'owner';
  const block = pence > 0 && owner && (stripe === 'none' || stripe === 'started');
  return {
    block,
    label: stripe === 'started' ? CONNECT_RESUME_LABEL : CONNECT_LABEL,
    /** Put on sale / the Selling switch enabled: free works straight away, paid needs connected. */
    canSell: manager && (pence === 0 || stripe === 'connected'),
    /** The reason copy that must survive when there is no block. */
    reason: !manager ? NOT_MANAGER : pence > 0 && stripe === 'loading' ? 'Checking your payment set-up. Try again in a moment.' : pence > 0 && stripe === 'not_configured' ? (owner ? PAYMENTS_WHERE : PAYOUTS_ASK_OWNER) : pence > 0 && !owner && stripe !== 'connected' ? PAYOUTS_ASK_OWNER : null,
  };
};

function setStripe(k: StripeKey) {
  if (k === 'loading') q.stripe = { query: pending(), state: null };
  else if (k === 'not_configured') {
    q.stripe = { query: ok(STRIPE.none), state: stripeStateOf(STRIPE.none) };
    q.onboard.switchedOff = true;
  } else q.stripe = { query: ok(STRIPE[k]), state: stripeStateOf(STRIPE[k]) };
}
function setup(pence: number, stripe: StripeKey, role: Role, withDraft: boolean) {
  load(SHAPES.bare);
  const d = type('t-d', { status: 'draft', pricePence: pence, name: 'Door' });
  q.home = ok(home(org({ role: role as never }, series())));
  q.types = ok(withDraft ? [d] : []);
  setStripe(stripe);
}
const input = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
const openList = () => fireEvent.click(screen.getByTestId('tix-row'));

describe.each(PRICES)('%s ticket', (_k, pence) => {
  describe.each(STRIPES)('stripe %s', (stripe) => {
    describe.each(ROLES)('%s', (role) => {
      const want = EXPECT(pence, stripe, role);

      it("a draft's list row: the block, its one button, and when the switch can be pressed", () => {
        setup(pence, stripe, role, true);
        show(<TicketsEntry seriesId="ser-1" />);
        openList();
        const row = screen.getByTestId('tix-type-t-d');
        expect(screen.queryAllByTestId('tix-connect-btn').length).toBe(want.block ? 1 : 0);
        if (want.block) {
          expect(screen.getByTestId('tix-connect-line').textContent).toBe(CONNECT_LINE);
          expect(screen.getByTestId('tix-connect-btn').textContent).toBe(want.label);
          expect((screen.getByTestId('tix-connect-btn') as HTMLElement).getAttribute('style')).toContain('44px');
          // the old "go to another screen" reason is gone
          expect(row.textContent).not.toContain(PAYMENTS_WHERE);
        }
        expect((screen.getByTestId('tix-switch') as HTMLButtonElement).disabled).toBe(!want.canSell);
        if (want.reason && role !== 'contributor') expect(screen.getByTestId('tix-switch-reason').textContent).toBe(want.reason);
        if (role === 'contributor') expect(screen.getByTestId('tix-readonly').textContent).toBe(NOT_MANAGER);
        if (pence === 0) expect(screen.queryByTestId('tix-connect')).toBeNull();
      });

      if (role === 'contributor') return;
      it('the Add a ticket flow, step 3: block + ONE button, or the Put on sale it had; it stays a draft until connected', async () => {
        setup(pence, stripe, role, false);
        api.upsertTicketType.mockResolvedValue({ ok: true, id: 'new-1' });
        show(<TicketsEntry seriesId="ser-1" />);
        openList();
        fireEvent.click(screen.getByTestId('tix-add'));
        input('tix-form-name', 'Door');
        if (pence > 0) input('tix-form-price', '12.00');
        fireEvent.click(screen.getByTestId('tix-next'));
        input('tix-form-capacity', '40');
        fireEvent.click(screen.getByTestId('tix-next'));
        expect(screen.queryAllByTestId('tix-connect').length).toBe(want.block ? 1 : 0);
        expect(screen.queryByTestId('tix-sell') === null).toBe(want.block);
        if (want.block) {
          expect(screen.getByTestId('tix-connect-line').textContent).toBe(CONNECT_LINE);
          expect(screen.getByTestId('tix-connect').textContent).toBe(want.label);
          expect(screen.queryByTestId('tix-sell-reason')).toBeNull();
          fireEvent.click(screen.getByTestId('tix-connect'));
          await waitFor(() => expect(q.onboard.go).toHaveBeenCalledTimes(1));
          expect(api.upsertTicketType).toHaveBeenCalledTimes(1);
          expect(api.setTicketStatus).not.toHaveBeenCalled(); // a draft until connected
        } else {
          expect((screen.getByTestId('tix-sell') as HTMLButtonElement).disabled).toBe(!want.canSell);
          if (want.reason) expect(screen.getByTestId('tix-sell-reason').textContent).toBe(want.reason);
        }
      });
    });
  });
});

it('the start error shows its message beside the one button', () => {
  setup(1200, 'none', 'owner', true);
  q.onboard.note = 'Stripe could not start. Try again.';
  show(<TicketsEntry seriesId="ser-1" />);
  openList();
  expect(screen.getByTestId('tix-connect-error').textContent).toBe('Stripe could not start. Try again.');
  expect(screen.getAllByTestId('tix-connect-btn').length).toBe(1);
});

describe('the Stripe return path', () => {
  it('is exactly the event page with tickets=1 plus the stripe param; every old caller is unchanged', () => {
    expect(P3_TICKET_PATHS.eventTickets('ser-1')).toBe('/account/p3/events/ser-1?tickets=1');
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'org-1', 'return', undefined, P3_TICKET_PATHS.eventTickets('ser-1'))).toBe(
      'https://x.test/account/p3/events/ser-1?tickets=1&stripe=return',
    );
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'org-1', 'refresh', undefined, P3_TICKET_PATHS.eventTickets('ser-1'))).toBe(
      'https://x.test/account/p3/events/ser-1?tickets=1&stripe=refresh',
    );
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'org-1', 'return')).toBe('https://x.test/account/p3/you/get-paid?o=org-1&stripe=return'.replace('/account/p3/you', P3_TICKET_PATHS.getPaid().replace(/\/get-paid$/, '')));
    expect(P3_TICKET_PATHS.stripeBack('https://x.test', 'org-1', 'refresh', 'start')).toBe('https://x.test/account/p3/get-paid?o=org-1&stripe=refresh');
  });

  it('the entry asks Stripe to come back to this event', () => {
    setup(1200, 'none', 'owner', true);
    show(<TicketsEntry seriesId="ser-1" />);
    expect(calls.onboard.at(-1)).toEqual(['org-1', undefined, '/account/p3/events/ser-1?tickets=1']);
  });
});

describe('arrival', () => {
  const Probe = () => <i data-testid="search">{useLocation().search}</i>;
  const Page = () => (
    <>
      <TicketsEntry seriesId="ser-1" />
      <Probe />
    </>
  );
  const arrive = (search: string) => show(<Page />, `/account/p3/events/ser-1${search}`);

  it('fresh: the sheet stays closed, nothing is refetched', () => {
    setup(1200, 'started', 'owner', true);
    arrive('');
    expect(screen.queryByTestId('tix-tall')).toBeNull();
    expect((q.stripe as { query: { refetch: () => void } }).query.refetch).not.toHaveBeenCalled();
  });

  it('cancel back with no param: the sheet is closed; the row is where it was', () => {
    setup(1200, 'started', 'owner', true);
    arrive('');
    openList();
    expect(screen.getByTestId('tix-connect-btn').textContent).toBe(CONNECT_RESUME_LABEL);
  });

  it('tickets=1 opens the Tickets sheet once and drops the param', async () => {
    setup(1200, 'none', 'owner', true);
    arrive('?tickets=1');
    expect(screen.getByTestId('tix-tall')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
  });

  it('stripe=return then connected: refetches, and the same draft gets Put on sale enabled', async () => {
    setup(1200, 'started', 'owner', true);
    const r = arrive('?tickets=1&stripe=return');
    expect((q.stripe as { query: { refetch: () => void } }).query.refetch).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId('tix-switch') as HTMLButtonElement).disabled).toBe(true);
    setStripe('connected');
    r.again();
    expect((screen.getByTestId('tix-switch') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('tix-connect-btn')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
  });

  it('stripe=return still pending: same sheet, same one button, switch still off', () => {
    setup(1200, 'started', 'owner', true);
    arrive('?tickets=1&stripe=return');
    expect(screen.getAllByTestId('tix-connect-btn').length).toBe(1);
    expect((screen.getByTestId('tix-switch') as HTMLButtonElement).disabled).toBe(true);
  });

  it('stripe=refresh: back on the same sheet with "Carry on with Stripe" when started; no refetch', () => {
    setup(1200, 'started', 'owner', true);
    arrive('?tickets=1&stripe=refresh');
    expect(screen.getByTestId('tix-connect-btn').textContent).toBe(CONNECT_RESUME_LABEL);
    expect((q.stripe as { query: { refetch: () => void } }).query.refetch).not.toHaveBeenCalled();
  });
});
