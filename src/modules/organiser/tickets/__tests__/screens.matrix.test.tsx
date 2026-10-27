// @vitest-environment jsdom
/**
 * Every screen x every ticket-type status x orders present/absent x Stripe connected/not
 * x role (owner / contributor). Prod has 0 ticketing rows today (shape survey in
 * docs/organiser-ticketing-journey.md), so the shapes are built from the live RPC bodies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: null }) }));
vi.mock('@/components/account/profiles/ProfileSwitcher', () => ({ default: () => null }));

const choice = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/modules/organiser/switch/useOrganiserChoice', () => ({ useOrganiserChoice: () => choice.value }));

const api = vi.hoisted(() => ({
  fetchStripeAccount: vi.fn(),
  fetchSalesSummary: vi.fn(),
  fetchSeriesTypes: vi.fn(),
  fetchOrders: vi.fn(),
  upsertTicketType: vi.fn(),
  setTicketStatus: vi.fn(),
  startOnboarding: vi.fn(),
  refundOrder: vi.fn(),
}));
vi.mock('../ticketsApi', async (orig) => ({ ...(await orig<typeof import('../ticketsApi')>()), ...api }));

import TicketsHome from '../TicketsHome';
import SeriesTickets from '../SeriesTickets';
import { MOVE_LABEL, NEXT_STATUS, STATUS_LABEL, TICKET_STATUSES, moveBlock, type Order, type StripeState, type TicketStatus, type TicketType } from '../ticketModel';

const series = (id: string, lifecycle_status = 'live') => ({ id, name: `Event ${id}`, lifecycle_status });
const page = (role: string, list = [series('s1')]) => ({
  home: { isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  selected: { id: 'org1', name: 'Ritmo', role, series: list },
  organisers: [],
});
const type = (status: TicketStatus, over: Partial<TicketType> = {}): TicketType => ({
  id: 't1', seriesId: 's1', occurrenceId: null, name: 'Early bird', pricePence: 1200, capacity: 100, reserved: 0,
  salesOpenAt: null, salesCloseAt: null, status, manualSoldOut: status === 'sold_out', ...over,
});
const order = (id: string, status: string): Order => ({
  id, typeId: 't1', buyerName: `Buyer ${id}`, quantity: 2, subtotalPence: 2400, bookingFeePence: 100, totalPence: 2500, refundedPence: 0, status, paidAt: '2026-10-01T20:00:00Z',
});
const stripeRow = (s: StripeState) => (s === 'none' ? null : { charges_enabled: s === 'connected', details_submitted: true });
const summary = (types: TicketType[], withOrders: boolean) => ({
  ok: true,
  reason: null,
  types: types.map((t) => ({
    id: t.id, seriesId: t.seriesId, name: t.name, status: t.status, pricePence: t.pricePence, capacity: t.capacity, reserved: t.reserved,
    ticketsSold: withOrders ? 2 : 0, ordersPaid: withOrders ? 1 : 0, ordersPending: 0, ordersRefunded: withOrders ? 1 : 0, ordersDisputed: 0,
    grossPence: withOrders ? 2400 : 0, bookingFeesPence: withOrders ? 100 : 0, refundedPence: withOrders ? 2500 : 0,
  })),
});

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/tickets" element={<TicketsHome />} />
          <Route path="/account/tickets/events/:seriesId" element={<SeriesTickets />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  api.fetchStripeAccount.mockResolvedValue(null);
  api.fetchSalesSummary.mockResolvedValue({ ok: true, reason: null, types: [] });
  api.fetchSeriesTypes.mockResolvedValue([]);
  api.fetchOrders.mockResolvedValue([]);
});
afterEach(cleanup);

describe('event tickets: status x orders x Stripe x role', () => {
  for (const status of TICKET_STATUSES)
    for (const withOrders of [false, true])
      for (const stripe of ['none', 'connected'] as StripeState[])
        for (const role of ['owner', 'contributor']) {
          it(`${status} | orders ${withOrders ? 'present' : 'absent'} | ${stripe} | ${role}`, async () => {
            const t = type(status, { reserved: withOrders ? 2 : 0 });
            choice.value = page(role);
            api.fetchStripeAccount.mockResolvedValue(stripeRow(stripe));
            api.fetchSeriesTypes.mockResolvedValue([t]);
            api.fetchSalesSummary.mockResolvedValue(summary([t], withOrders));
            api.fetchOrders.mockResolvedValue(withOrders ? [order('p', 'paid'), order('r', 'refunded')] : []);
            mount('/account/tickets/events/s1');
            const card = await screen.findByTestId('tix-type-t1');
            // Wait for the Stripe read, so the move rule sees the real state.
            await waitFor(() => expect(api.fetchStripeAccount).toHaveBeenCalled());
            const c = within(card);
            expect(c.getByTestId('tix-type-status').textContent).toBe(STATUS_LABEL[status]);
            expect(c.getByTestId('tix-type-line').textContent).toContain(withOrders ? '2 of 100 sold' : '0 of 100 sold');
            // Only the moves the server accepts, each disabled exactly when the shared rule says, with its reason.
            for (const to of TICKET_STATUSES) {
              const btn = c.queryByTestId(`tix-move-${to}`);
              if (!NEXT_STATUS[status].includes(to)) {
                expect(btn).toBeNull();
                continue;
              }
              const why = moveBlock(t, to, { role, stripe });
              await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(why !== null));
              expect(btn?.textContent).toContain(MOVE_LABEL[to]);
              if (why) expect(c.getByTestId(`tix-move-${to}-reason`).textContent).toBe(why);
            }
            // Edit: closed types and contributors get a reason.
            const edit = c.getByTestId('tix-edit') as HTMLButtonElement;
            expect(edit.disabled).toBe(role === 'contributor' || status === 'closed');
            if (edit.disabled) expect(c.getByTestId('tix-edit-reason').textContent).toBeTruthy();
            // Orders: a paid order has Refund (owner/manager only), a refunded one its tag; none = what will happen.
            if (withOrders) {
              const paid = await c.findByTestId('tix-order-p');
              const refund = within(paid).getByTestId('tix-refund') as HTMLButtonElement;
              expect(refund.disabled).toBe(role === 'contributor');
              if (role === 'contributor') expect(c.getByTestId('tix-refund-reason').textContent).toMatch(/owner or manager/);
              expect(within(c.getByTestId('tix-order-r')).getByTestId('tix-order-tag').textContent).toBe('Refunded');
            } else {
              expect((await c.findByTestId('tix-orders-empty')).textContent).toMatch(/Orders show here once someone buys/);
            }
            // Add: contributors see why.
            const add = screen.getByTestId('tix-add') as HTMLButtonElement;
            expect(add.disabled).toBe(role === 'contributor');
          });
        }
});

describe('event tickets: empty and edge states', () => {
  it('no ticket types says what to do', async () => {
    choice.value = page('owner');
    mount('/account/tickets/events/s1');
    expect((await screen.findByTestId('tix-types-empty')).textContent).toMatch(/Add a ticket type to start selling/);
  });
  it('a series not on this page says so and links back', async () => {
    choice.value = page('owner');
    mount('/account/tickets/events/zzz');
    expect((await screen.findByTestId('tix-event-missing')).textContent).toMatch(/Back to tickets/);
  });
  it('a series that is not live disables Add with the reason', async () => {
    choice.value = page('owner', [series('s1', 'draft')]);
    mount('/account/tickets/events/s1');
    expect((await screen.findByTestId('tix-add-reason')).textContent).toMatch(/Put this event live/);
  });
  it('a server refusal on a move shows its words, never a crash', async () => {
    choice.value = page('owner');
    api.fetchSeriesTypes.mockResolvedValue([type('draft', { pricePence: 0 })]);
    api.setTicketStatus.mockResolvedValue({ ok: false, reason: 'series_not_live' });
    mount('/account/tickets/events/s1');
    const btn = await screen.findByTestId('tix-move-on_sale');
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(btn);
    expect((await screen.findByTestId('tix-move-error')).textContent).toMatch(/Put the event live/);
  });
});

describe('editor sheet', () => {
  it('saving an untouched ticket sends no command', async () => {
    choice.value = page('owner');
    api.fetchSeriesTypes.mockResolvedValue([type('on_sale', { salesOpenAt: '2026-07-01T18:00:00+00:00' })]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    fireEvent.click(await screen.findByTestId('tix-save'));
    await waitFor(() => expect(screen.queryByTestId('tix-sheet')).toBeNull());
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });
  it('a ticket with orders locks the price with the reason', async () => {
    choice.value = page('owner');
    const t = type('on_sale', { reserved: 2 });
    api.fetchSeriesTypes.mockResolvedValue([t]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    expect((await screen.findByTestId('tix-form-pricelock')).textContent).toMatch(/cannot change once someone has bought/);
    expect((screen.getByTestId('tix-form-price') as HTMLInputElement).disabled).toBe(true);
  });
  it('a new free ticket sends one upsert with 0p', async () => {
    choice.value = page('owner');
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-add'));
    fireEvent.change(await screen.findByTestId('tix-form-name'), { target: { value: 'Door' } });
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '40' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    expect(api.upsertTicketType.mock.calls[0][0]).toMatchObject({ id: null, name: 'Door', pricePence: 0, capacity: 40, seriesId: 's1', organiserId: 'org1' });
  });
});

describe('refund sheet', () => {
  it('explains the 50p fee and treats an undeployed function as not switched on', async () => {
    choice.value = page('owner');
    api.fetchSeriesTypes.mockResolvedValue([type('on_sale', { reserved: 2 })]);
    api.fetchOrders.mockResolvedValue([order('p', 'paid')]);
    api.refundOrder.mockResolvedValue({ kind: 'not_configured' });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-refund'));
    expect((await screen.findByTestId('tix-refund-body')).textContent).toMatch(/50p booking fee per ticket/);
    fireEvent.click(screen.getByTestId('tix-refund-confirm'));
    expect((await screen.findByTestId('tix-refund-note')).textContent).toMatch(/not switched on yet/);
    expect(api.refundOrder).toHaveBeenCalledWith('p');
  });
});

describe('tickets home', () => {
  it('no organiser page says what to do', async () => {
    choice.value = { ...page('owner'), selected: null };
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-no-page')).textContent).toMatch(/Set up your organiser page first/);
  });
  it('no live events says what to do', async () => {
    choice.value = page('owner', [series('s1', 'draft')]);
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-no-live')).textContent).toMatch(/Put an event live first/);
    expect((await screen.findByTestId('tix-sales-empty')).textContent).toMatch(/add a ticket type to start selling/);
  });
  it.each([
    ['none', 'Not set up', 'Set up payments'],
    ['started', 'Not finished', 'Finish setting up'],
    ['connected', 'Connected', null],
  ] as const)('Get paid %s', async (s, tag, action) => {
    choice.value = page('owner');
    api.fetchStripeAccount.mockResolvedValue(s === 'none' ? null : { charges_enabled: s === 'connected' });
    mount('/account/tickets');
    await waitFor(() => expect(screen.getByTestId('tix-getpaid-tag').textContent).toBe(tag));
    const go = screen.queryByTestId('tix-getpaid-go');
    if (action) expect(go?.textContent).toContain(action);
    else expect(go).toBeNull();
  });
  it('onboarding before the function is deployed says payments are not switched on yet', async () => {
    choice.value = page('owner');
    api.startOnboarding.mockResolvedValue({ kind: 'not_configured' });
    mount('/account/tickets');
    fireEvent.click(await screen.findByTestId('tix-getpaid-go'));
    expect((await screen.findByTestId('tix-getpaid-note')).textContent).toMatch(/not switched on yet/);
    const [, ret, refresh] = api.startOnboarding.mock.calls[0];
    expect(ret).toMatch(/\/account\/tickets\?o=org1&stripe=return$/);
    expect(refresh).toMatch(/\/account\/tickets\?o=org1&stripe=refresh$/);
  });
  it('a contributor cannot start onboarding and is told why', async () => {
    choice.value = page('contributor');
    mount('/account/tickets');
    const go = (await screen.findByTestId('tix-getpaid-go')) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(screen.getByTestId('tix-getpaid-reason').textContent).toMatch(/owner or manager/);
  });
  it('sales show counts and sums, and each live event its ticket count', async () => {
    choice.value = page('owner');
    api.fetchSalesSummary.mockResolvedValue(summary([type('on_sale')], true));
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-sales-sold')).textContent).toContain('2');
    expect(screen.getByTestId('tix-sales-gross').textContent).toContain('£24.00');
    expect(screen.getByTestId('tix-sales-fees').textContent).toContain('£1.00');
    expect(screen.getByTestId('tix-event-s1').textContent).toContain('1 ticket type');
  });
});
