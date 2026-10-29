// @vitest-environment jsdom
/**
 * S3b (mockup B): every screen x every shape. Screens: Home, One event, the add sheet
 * (3 steps), the refund sheet. Shapes: no payments, payments pending, connected, no
 * tickets, selling, paused, sold out, free ticket, contributor read-only, API error.
 * Prod has 0 ticketing rows today (docs/organiser-ticketing-journey.md), so the rows are
 * built from the live RPC bodies; the expected value of every fact comes from the ONE
 * model function the screens use (ticketModel), never a second copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: null }) }));
vi.mock('@/components/account/profiles/ProfileSwitcher', () => ({ default: () => <span data-testid="profile-switcher" /> }));

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
import {
  EVENT_SALE,
  NOT_MANAGER,
  SWITCH_LABEL,
  buyerNameOf,
  canManage,
  eventSaleOf,
  formatCount,
  moveBlock,
  nextStep,
  paymentsLink,
  refundQuestion,
  refundable,
  setupSteps,
  switchMove,
  type Order,
  type StripeState,
  type TicketStatus,
  type TicketType,
  type TypeSales,
} from '../ticketModel';

const series = (id: string, lifecycle_status = 'live', over: Record<string, unknown> = {}) => ({
  id, name: `Event ${id}`, lifecycle_status, upcoming_count: 3, next_dates: [{ occurrence_id: `${id}-o`, occurrence_date: '2026-11-06', materialised_start_utc: '2026-11-06T20:00:00Z' }], ...over,
});
const page = (role: string, list = [series('s1')]) => ({
  home: { isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  selected: { id: 'org1', name: 'Ritmo', role, series: list },
  organisers: [],
});
const type = (status: TicketStatus, over: Partial<TicketType> = {}): TicketType => ({
  id: 't1', seriesId: 's1', occurrenceId: null, name: 'Early bird', pricePence: 1000, capacity: 20, reserved: 0,
  salesOpenAt: null, salesCloseAt: null, status, manualSoldOut: status === 'sold_out', ...over,
});
const order = (id: string, status: string, over: Partial<Order> = {}): Order => ({
  id, typeId: 't1', buyerName: `Buyer ${id}`, quantity: 2, subtotalPence: 2000, bookingFeePence: 100, totalPence: 2100, refundedPence: 0, status, paidAt: '2026-10-01T20:00:00Z', ...over,
});
const stripeRow = (s: StripeState) => (s === 'none' ? null : { charges_enabled: s === 'connected', details_submitted: true });
const salesOf = (types: TicketType[], orders: Order[]): TypeSales[] =>
  types.map((t) => {
    const own = orders.filter((o) => o.typeId === t.id);
    const paid = own.filter((o) => o.status === 'paid');
    return {
      id: t.id, seriesId: t.seriesId, name: t.name, status: t.status, pricePence: t.pricePence, capacity: t.capacity, reserved: t.reserved,
      ticketsSold: paid.reduce((n, o) => n + o.quantity, 0), ordersPaid: paid.length, ordersPending: 0,
      ordersRefunded: own.filter((o) => o.status === 'refunded').length, ordersDisputed: 0,
      grossPence: paid.reduce((n, o) => n + o.subtotalPence, 0), bookingFeesPence: paid.reduce((n, o) => n + o.bookingFeePence, 0),
      refundedPence: own.filter((o) => o.status === 'refunded').reduce((n, o) => n + o.totalPence, 0),
    };
  });

interface Shape {
  name: string;
  role: string;
  stripe: StripeState;
  types: TicketType[];
  orders: Order[];
  apiError?: boolean;
}
const SHAPES: Shape[] = [
  { name: 'no payments', role: 'owner', stripe: 'none', types: [], orders: [] },
  { name: 'payments pending', role: 'owner', stripe: 'started', types: [], orders: [] },
  { name: 'connected, no tickets', role: 'manager', stripe: 'connected', types: [], orders: [] },
  { name: 'no tickets, draft only', role: 'owner', stripe: 'connected', types: [type('draft')], orders: [] },
  { name: 'selling', role: 'owner', stripe: 'connected', types: [type('on_sale', { reserved: 12 })], orders: [order('p', 'paid'), order('r', 'refunded', { paidAt: '2026-09-30T20:00:00Z' })] },
  { name: 'paused', role: 'manager', stripe: 'connected', types: [type('paused', { reserved: 2 })], orders: [order('p', 'paid')] },
  { name: 'sold out', role: 'owner', stripe: 'connected', types: [type('sold_out', { reserved: 20 })], orders: [order('p', 'paid')] },
  { name: 'free ticket, no payments', role: 'owner', stripe: 'none', types: [type('on_sale', { pricePence: 0, reserved: 3 })], orders: [order('f', 'paid', { subtotalPence: 0, bookingFeePence: 0, totalPence: 0 })] },
  { name: 'paid draft, payments pending', role: 'owner', stripe: 'started', types: [type('draft')], orders: [] },
  { name: 'contributor read-only', role: 'contributor', stripe: 'connected', types: [type('on_sale', { reserved: 2 })], orders: [order('p', 'paid')] },
  { name: 'closed ticket', role: 'owner', stripe: 'connected', types: [type('closed', { reserved: 2 })], orders: [order('p', 'paid')] },
  { name: 'API error', role: 'owner', stripe: 'none', types: [], orders: [], apiError: true },
];

function arrange(s: Shape, list = [series('s1')]) {
  choice.value = page(s.role, list);
  if (s.apiError) {
    api.fetchStripeAccount.mockRejectedValue(new Error('down'));
    api.fetchSalesSummary.mockRejectedValue(new Error('down'));
    api.fetchSeriesTypes.mockRejectedValue(new Error('down'));
    return;
  }
  api.fetchStripeAccount.mockResolvedValue(stripeRow(s.stripe));
  api.fetchSalesSummary.mockResolvedValue({ ok: true, reason: null, types: salesOf(s.types, s.orders) });
  api.fetchSeriesTypes.mockResolvedValue(s.types);
  api.fetchOrders.mockResolvedValue(s.orders);
}

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

describe('Home x every shape', () => {
  for (const s of SHAPES) {
    it(s.name, async () => {
      arrange(s);
      mount('/account/tickets');
      if (s.apiError) {
        expect((await screen.findByText('We could not read your payment set-up.')).textContent).toBeTruthy();
        expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
        return;
      }
      await screen.findByTestId('tix-event-chip');
      const sales = salesOf(s.types, s.orders);
      const step = nextStep(s.role, s.stripe, [series('s1')], sales);
      // ONE Next step card, only while something is left to do, about the step the model names.
      await waitFor(() => expect(screen.queryByTestId('tix-next')?.getAttribute('data-kind') ?? null).toBe(step?.kind ?? null));
      expect(screen.queryAllByTestId('tix-next')).toHaveLength(step ? 1 : 0);
      if (step?.kind === 'connect') {
        expect(screen.getByTestId('tix-next-title').textContent).toBe(s.stripe === 'none' ? 'Connect payments to sell Event s1' : 'Finish connecting payments');
        expect(screen.getByTestId('tix-getpaid-go').textContent).toBe(s.stripe === 'none' ? 'Connect payments' : 'Finish connecting');
      }
      // Header chip only once payments are connected.
      expect(!!screen.queryByTestId('tix-paidout')).toBe(s.stripe === 'connected');
      // Setup bar while setup is unfinished (managers only).
      const steps = setupSteps(s.stripe, sales);
      const showSetup = canManage(s.role) && steps.some((x) => !x.done);
      expect(!!screen.queryByTestId('tix-setup')).toBe(showSetup);
      if (showSetup) expect(screen.getByTestId('tix-setup-line').textContent).toBe(`${steps.filter((x) => x.done).length} of 3 done`);
      // Sold / Sales once any ticket exists.
      expect(!!screen.queryByTestId('tix-sales-sold')).toBe(s.types.length > 0);
      // The event's chip is the shared mapping.
      expect(screen.getByTestId('tix-event-chip').textContent).toBe(EVENT_SALE[eventSaleOf(sales)].label);
      // Contributors: told why, never a Connect button or an Add tickets.
      if (!canManage(s.role)) {
        expect(screen.getByTestId('tix-readonly').textContent).toContain(NOT_MANAGER);
        expect(screen.queryByTestId('tix-getpaid-go')).toBeNull();
        expect(screen.queryByTestId('tix-event-add')).toBeNull();
      }
      // At most one Add tickets per event (Next step card or the event card, never both).
      const adds = screen.queryAllByText('Add tickets', { selector: 'a' });
      expect(adds.length).toBeLessThanOrEqual(1);
    });
  }
});

describe('One event x every shape', () => {
  for (const s of SHAPES) {
    it(s.name, async () => {
      arrange(s);
      mount('/account/tickets/events/s1');
      if (s.apiError) {
        expect(await screen.findByRole('button', { name: /try again/i })).toBeTruthy();
        return;
      }
      if (s.types.length === 0) {
        expect((await screen.findByTestId('tix-types-empty')).textContent).toMatch(/Tap Add a ticket below/);
        expect((screen.getByTestId('tix-add') as HTMLButtonElement).disabled).toBe(false);
        return;
      }
      await waitFor(() => expect(api.fetchStripeAccount).toHaveBeenCalled());
      const sales = salesOf(s.types, s.orders);
      for (const t of s.types) {
        const row = within(await screen.findByTestId(`tix-type-${t.id}`));
        const sold = sales.find((x) => x.id === t.id)?.ticketsSold ?? 0;
        await waitFor(() => expect(row.getByTestId('tix-type-line').textContent).toContain(`${formatCount(sold)} sold \u00B7 ${formatCount(Math.max(0, t.capacity - t.reserved))} left`));
        const to = switchMove(t.status);
        if (!to) {
          expect(row.queryByRole('switch')).toBeNull();
          expect(row.getByTestId('tix-type-closed').textContent).toBe('Closed');
          continue;
        }
        const sw = row.getByRole('switch') as HTMLButtonElement;
        expect(sw.getAttribute('aria-checked')).toBe(String(t.status === 'on_sale'));
        expect(row.getByTestId('tix-switch-label').textContent).toBe(SWITCH_LABEL[t.status]);
        const why = moveBlock(t, to, { role: s.role, stripe: s.stripe, seriesLive: true });
        await waitFor(() => expect(sw.disabled).toBe(why !== null));
        const reason = row.queryByTestId('tix-switch-reason');
        expect(reason?.textContent ?? null).toBe(why && why !== NOT_MANAGER ? why : null);
      }
      // Orders by buyer name, newest first; Refund for owners / managers on refundable orders only.
      const shown = s.orders.filter((o) => ['paid', 'refunded', 'disputed'].includes(o.status));
      for (const o of shown) {
        const row = within(await screen.findByTestId(`tix-order-${o.id}`));
        expect(row.getByTestId('tix-order-buyer').textContent).toBe(buyerNameOf(o));
        expect(row.getByTestId('tix-order-line').textContent).toMatch(/^2 \u00D7 (\u00A310\.50|Free) \u00B7 (1|30) (October|September)$/);
        expect(!!row.queryByTestId('tix-refund')).toBe(canManage(s.role) && refundable(o));
      }
      if (!canManage(s.role)) {
        expect(screen.getByTestId('tix-readonly').textContent).toBe(NOT_MANAGER);
        expect((screen.getByTestId('tix-add') as HTMLButtonElement).disabled).toBe(true);
        if (shown.some(refundable)) expect(screen.getByTestId('tix-refund-reason').textContent).toMatch(/owner or manager/);
      }
    });
  }
});

describe('Add sheet x every shape (three steps, live buyer total, review)', () => {
  for (const s of SHAPES.filter((x) => !x.apiError && canManage(x.role))) {
    for (const price of ['10', '0'] as const) {
      it(`${s.name} | price ${price}`, async () => {
        arrange(s);
        mount('/account/tickets/events/s1');
        await waitFor(() => expect(api.fetchStripeAccount).toHaveBeenCalled());
        fireEvent.click(await screen.findByTestId('tix-add'));
        expect((await screen.findByTestId('tix-step')).textContent).toBe('1 / 3');
        fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Early bird' } });
        fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: price } });
        expect(screen.getByTestId('tix-buyer-total').textContent).toBe(price === '10' ? '\u00A310.00' : 'Free');
        expect(screen.getByTestId('tix-buyer-line').textContent).toBe(price === '10' ? 'The ticket price, nothing added' : 'Free');
        fireEvent.click(screen.getByTestId('tix-next'));
        expect(screen.getByTestId('tix-step').textContent).toBe('2 / 3');
        // Continue checks only this step's fields.
        fireEvent.click(screen.getByTestId('tix-next'));
        expect(screen.getByTestId('tix-step').textContent).toBe('2 / 3');
        fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '20' } });
        fireEvent.click(screen.getByTestId('tix-next'));
        expect(screen.getByTestId('tix-step').textContent).toBe('3 / 3');
        expect(screen.getByTestId('tix-review-price').textContent).toContain(price === '10' ? '\u00A310.00' : 'Free');
        expect(screen.getByTestId('tix-review-places').textContent).toContain('20');
        expect(screen.getByTestId('tix-review-opens').textContent).toContain('Now');
        expect(screen.getByTestId('tix-review-closes').textContent).toContain('When you stop selling');
        expect(screen.getByTestId('tix-review-buyer').textContent).toContain(price === '10' ? '\u00A310.00' : 'Free');
        const why = moveBlock({ pricePence: price === '10' ? 1000 : 0, reserved: 0, capacity: 20 }, 'on_sale', { role: s.role, stripe: s.stripe, seriesLive: true });
        expect((screen.getByTestId('tix-sell') as HTMLButtonElement).disabled).toBe(why !== null);
        expect(screen.queryByTestId('tix-sell-reason')?.textContent ?? null).toBe(why);
        expect((screen.getByTestId('tix-save') as HTMLButtonElement).disabled).toBe(false);
        // Back keeps every value.
        fireEvent.click(screen.getByTestId('tix-sheet-back'));
        fireEvent.click(screen.getByTestId('tix-sheet-back'));
        expect((screen.getByTestId('tix-form-name') as HTMLInputElement).value).toBe('Early bird');
        expect((screen.getByTestId('tix-form-price') as HTMLInputElement).value).toBe(price);
      });
    }
  }
});

describe('Refund sheet x every shape with a refundable order', () => {
  for (const s of SHAPES.filter((x) => !x.apiError && canManage(x.role) && x.orders.some(refundable))) {
    it(s.name, async () => {
      arrange(s);
      api.refundOrder.mockResolvedValue({ kind: 'ok', value: null });
      mount('/account/tickets/events/s1');
      const o = s.orders.find(refundable) as Order;
      fireEvent.click(within(await screen.findByTestId(`tix-order-${o.id}`)).getByTestId('tix-refund'));
      const q = refundQuestion(o);
      expect((await screen.findByTestId('tix-refund-sheet-title')).textContent).toBe(`Refund ${buyerNameOf(o)}?`);
      expect(screen.getByTestId('tix-refund-body').textContent).toBe(q.body);
      expect(screen.getByTestId('tix-refund-confirm').textContent).toBe('Refund \u00A321.00');
      expect(screen.getByTestId('tix-refund-cancel').textContent).toBe('Keep the order');
      fireEvent.click(screen.getByTestId('tix-refund-confirm'));
      await waitFor(() => expect(api.refundOrder).toHaveBeenCalledWith(o.id));
    });
  }
});

describe('flows and edge states', () => {
  it('Put on sale saves the ticket, then moves the new id on sale', async () => {
    arrange(SHAPES[2]);
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 'new1' });
    api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
    mount('/account/tickets/events/s1');
    await waitFor(() => expect(api.fetchStripeAccount).toHaveBeenCalled());
    fireEvent.click(await screen.findByTestId('tix-add'));
    fireEvent.change(await screen.findByTestId('tix-form-name'), { target: { value: 'Door' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '40' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    await waitFor(() => expect((screen.getByTestId('tix-sell') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('tix-sell'));
    await waitFor(() => expect(api.setTicketStatus).toHaveBeenCalledWith('new1', 'on_sale'));
    expect(api.upsertTicketType.mock.calls[0][0]).toMatchObject({ id: null, name: 'Door', pricePence: 0, capacity: 40, seriesId: 's1', organiserId: 'org1' });
  });
  it('Save as draft sends one upsert and no status move', async () => {
    arrange(SHAPES[0]);
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 'new1' });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-add'));
    fireEvent.change(await screen.findByTestId('tix-form-name'), { target: { value: 'Early bird' } });
    fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    expect(api.upsertTicketType.mock.calls[0][0]).toMatchObject({ pricePence: 1250 });
    expect(api.setTicketStatus).not.toHaveBeenCalled();
  });
  it('saving an untouched ticket sends no command', async () => {
    arrange(SHAPES[4]);
    api.fetchSeriesTypes.mockResolvedValue([type('on_sale', { salesOpenAt: '2026-07-01T18:00:00+00:00' })]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    fireEvent.click(await screen.findByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(screen.queryByTestId('tix-sheet')).toBeNull());
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });
  it('a ticket with orders locks the price and says why', async () => {
    arrange(SHAPES[4]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    expect((await screen.findByTestId('tix-form-price') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('tix-sheet').textContent).toMatch(/cannot change once someone has bought/);
  });
  it('a contributor sees the ticket read-only with the reason', async () => {
    arrange(SHAPES[9]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    expect((await screen.findByTestId('tix-form-locked-top')).textContent).toBe(NOT_MANAGER);
    expect((screen.getByTestId('tix-form-name') as HTMLInputElement).disabled).toBe(true);
  });
  it('the Selling switch pauses with one tap and says so', async () => {
    arrange(SHAPES[4]);
    api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
    mount('/account/tickets/events/s1');
    const sw = (await screen.findByRole('switch')) as HTMLButtonElement;
    await waitFor(() => expect(sw.disabled).toBe(false));
    fireEvent.click(sw);
    await waitFor(() => expect(api.setTicketStatus).toHaveBeenCalledWith('t1', 'paused'));
  });
  it('a server refusal on the switch shows its words', async () => {
    arrange(SHAPES[5]);
    api.setTicketStatus.mockResolvedValue({ ok: false, reason: 'series_not_live' });
    mount('/account/tickets/events/s1');
    const sw = (await screen.findByRole('switch')) as HTMLButtonElement;
    await waitFor(() => expect(sw.disabled).toBe(false));
    fireEvent.click(sw);
    expect((await screen.findByTestId('tix-move-error')).textContent).toMatch(/Put the event live/);
  });
  it('a series that is not live disables Add and the switch with the reason', async () => {
    arrange(SHAPES[5], [series('s1', 'ended')]);
    mount('/account/tickets/events/s1');
    expect((await screen.findByTestId('tix-add-reason')).textContent).toMatch(/Put this event live/);
    expect((await screen.findByTestId('tix-switch-reason')).textContent).toMatch(/Put this event live/);
  });
  it('a series not on this page says so and links back', async () => {
    arrange(SHAPES[0]);
    mount('/account/tickets/events/zzz');
    expect((await screen.findByTestId('tix-event-missing')).textContent).toMatch(/Back to tickets/);
  });
  it('Home Add tickets (?add=1) opens the add sheet on arrival', async () => {
    arrange(SHAPES[2]);
    mount('/account/tickets/events/s1?o=org1&add=1');
    expect((await screen.findByTestId('tix-step')).textContent).toBe('1 / 3');
  });
  it('a one-off defaults Sales close to Event start', async () => {
    arrange(SHAPES[2], [series('s1', 'live', { upcoming_count: 1 })]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-add'));
    fireEvent.change(await screen.findByTestId('tix-form-name'), { target: { value: 'Door' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-close-event').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '20' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-review-closes').textContent).toContain('Event start');
  });
  it('an unreadable sales summary shows places left, never a made-up 0 sold', async () => {
    arrange(SHAPES[4]);
    api.fetchSalesSummary.mockRejectedValue(new Error('down'));
    mount('/account/tickets/events/s1');
    await waitFor(() => expect(screen.getByTestId('tix-type-line').textContent).toBe('\u00A310.00 \u00B7 8 left'));
  });
  it('Connect payments before the function is deployed says so, with no dead button', async () => {
    arrange(SHAPES[0]);
    api.startOnboarding.mockResolvedValue({ kind: 'not_configured' });
    mount('/account/tickets');
    fireEvent.click(await screen.findByTestId('tix-getpaid-go'));
    expect((await screen.findByTestId('tix-next-off')).textContent).toMatch(/not switched on yet/);
    expect(screen.queryByTestId('tix-getpaid-go')).toBeNull();
    expect(screen.getByTestId('tix-next-free').textContent).toBe('Add a free ticket instead');
    const [, ret, refresh] = api.startOnboarding.mock.calls[0];
    expect(ret).toMatch(/\/account\/tickets\?o=org1&stripe=return$/);
    expect(refresh).toMatch(/\/account\/tickets\?o=org1&stripe=refresh$/);
  });
  it('a refund before the function is deployed says payments are not switched on', async () => {
    arrange(SHAPES[4]);
    api.refundOrder.mockResolvedValue({ kind: 'not_configured' });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-refund'));
    fireEvent.click(await screen.findByTestId('tix-refund-confirm'));
    expect((await screen.findByTestId('tix-refund-note')).textContent).toMatch(/not switched on yet/);
  });
  it('Home: no organiser page and no live events each say what to do', async () => {
    choice.value = { ...page('owner'), selected: null };
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-no-page')).textContent).toMatch(/Set up your organiser page first/);
    cleanup();
    choice.value = page('owner', [series('s1', 'draft')]);
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-no-live')).textContent).toMatch(/Put an event live first/);
    expect(screen.queryByTestId('tix-next')).toBeNull();
  });
  it('Home: big numbers carry thousands separators (Sold, Sales, places left)', async () => {
    arrange(SHAPES[4]);
    const [row] = salesOf([type('on_sale', { capacity: 3000, reserved: 2022 })], []);
    api.fetchSalesSummary.mockResolvedValue({ ok: true, reason: null, types: [{ ...row, ticketsSold: 2022, grossPence: 24017000, refundedPence: 123506 }] });
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-sales-sold')).textContent).toBe('Sold2,022');
    expect(screen.getByTestId('tix-sales-gross').textContent).toBe('Sales\u00A3240,170.00');
    expect(screen.getByTestId('tix-sales-note').textContent).toContain('\u00A31,235.06 refunded');
    expect(screen.getByTestId('tix-event-line').textContent).toBe('978 left of 3,000 \u00B7 Next: Friday 6 November');
  });
  it('One event + edit sheet: the same counts carry the same separators (row, review, capacity error)', async () => {
    arrange(SHAPES[4]);
    const t = type('on_sale', { capacity: 3000, reserved: 2022 });
    const [row] = salesOf([t], []);
    api.fetchSeriesTypes.mockResolvedValue([t]);
    api.fetchSalesSummary.mockResolvedValue({ ok: true, reason: null, types: [{ ...row, ticketsSold: 2022 }] });
    mount('/account/tickets/events/s1');
    const line = within(await screen.findByTestId('tix-type-t1'));
    await waitFor(() => expect(line.getByTestId('tix-type-line').textContent).toContain('2,022 sold \u00B7 978 left'));
    fireEvent.click(screen.getByTestId('tix-edit'));
    fireEvent.click(await screen.findByTestId('tix-next'));
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-step').textContent).toBe('2 / 3');
    expect(document.body.textContent).toContain('2,022 tickets are already taken, so it cannot go lower than that.');
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '3000' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-step').textContent).toBe('3 / 3');
    expect(screen.getByTestId('tix-review-places').textContent).toBe('Places3,000');
  });
  it('Home: Sold and Sales sum every ticket type', async () => {
    arrange(SHAPES[4]);
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-sales-sold')).textContent).toContain('2');
    expect(screen.getByTestId('tix-sales-gross').textContent).toContain('\u00A320.00');
    expect(screen.getByTestId('tix-event-line').textContent).toBe('8 left of 20 \u00B7 Next: Friday 6 November');
  });
});

describe('critique fixes (docs/review/ticketing-organiser-ui-1060.md)', () => {
  it.each(['none', 'started', 'connected'] as StripeState[])('Home keeps the profile switcher (stripe %s); the paid-out chip sits on the page-name line', async (stripe) => {
    arrange({ ...SHAPES[4], stripe });
    mount('/account/tickets');
    await screen.findByTestId('tix-event-chip');
    expect(await screen.findByTestId('profile-switcher')).toBeTruthy();
    const chip = screen.queryByTestId('tix-paidout');
    expect(!!chip).toBe(stripe === 'connected');
    if (chip) expect(screen.getByTestId('tix-page-line').contains(chip)).toBe(true);
    expect(screen.getByTestId('tix-page-name').textContent).toBe('Ritmo');
  });

  describe('the payments link under the number cards: every stripe state x ticket mix', () => {
    const MIXES: Record<string, TicketType[]> = {
      'all free': [type('on_sale', { pricePence: 0 })],
      mixed: [type('on_sale', { pricePence: 0 }), type('draft', { id: 't2' })],
      none: [],
    };
    for (const role of ['owner', 'contributor']) {
      for (const stripe of ['none', 'started', 'connected'] as StripeState[]) {
        for (const [mix, types] of Object.entries(MIXES)) {
          it(`${role} | ${stripe} | ${mix}`, async () => {
            arrange({ name: mix, role, stripe, types, orders: [] });
            mount('/account/tickets');
            await screen.findByTestId('tix-event-chip');
            const step = nextStep(role, stripe, [series('s1')], salesOf(types, []));
            await waitFor(() => expect(screen.queryByTestId('tix-next')?.getAttribute('data-kind') ?? null).toBe(step?.kind ?? null));
            const want = paymentsLink(role, stripe, step);
            const link = screen.queryByTestId('tix-pay-link');
            expect(!!link).toBe(!!want);
            // One Connect / Finish connecting on the page at most (the card's button or this link).
            expect(screen.queryAllByTestId('tix-getpaid-go').length + (link ? 1 : 0)).toBeLessThanOrEqual(1);
            if (want && link) expect(link.textContent).toBe([want.lead, want.action].filter(Boolean).join(' '));
          });
        }
      }
    }
    it('the link starts Stripe onboarding with the return and refresh addresses', async () => {
      arrange({ name: 'free, pending', role: 'owner', stripe: 'started', types: MIXES['all free'], orders: [] });
      api.startOnboarding.mockResolvedValue({ kind: 'error', reason: 'stripe_error' });
      mount('/account/tickets');
      fireEvent.click(await screen.findByTestId('tix-pay-go'));
      await waitFor(() => expect(api.startOnboarding).toHaveBeenCalledTimes(1));
      const [org, ret, refresh] = api.startOnboarding.mock.calls[0];
      expect(org).toBe('org1');
      expect(ret).toMatch(/\/account\/tickets\?o=org1&stripe=return$/);
      expect(refresh).toMatch(/\/account\/tickets\?o=org1&stripe=refresh$/);
      expect((await screen.findByTestId('tix-pay-note')).textContent).toBeTruthy();
    });
    it('the link says payments are not switched on when the function is not deployed', async () => {
      arrange({ name: 'free, none', role: 'owner', stripe: 'none', types: MIXES['all free'], orders: [] });
      api.startOnboarding.mockResolvedValue({ kind: 'not_configured' });
      mount('/account/tickets');
      fireEvent.click(await screen.findByTestId('tix-pay-go'));
      expect((await screen.findByTestId('tix-pay-off')).textContent).toMatch(/not switched on yet/);
      expect(screen.queryByTestId('tix-pay-go')).toBeNull();
    });
  });

  it.each([
    ['return', /Back from Stripe/],
    ['refresh', /That Stripe link ran out/],
  ])('back from Stripe (?stripe=%s) says where things stand', async (param, words) => {
    arrange(SHAPES[1]);
    mount(`/account/tickets?o=org1&stripe=${param}`);
    expect((await screen.findByTestId('tix-getpaid-back')).textContent).toMatch(words);
  });

  it.each([
    ['selling', SHAPES[4], /They show here, by buyer name/],
    ['nothing selling', SHAPES[3], /Switch a ticket to Selling above/],
  ] as const)('orders empty state (%s) says what happens next', async (_n, shape, words) => {
    arrange({ ...shape, orders: [] });
    mount('/account/tickets/events/s1');
    expect((await screen.findByTestId('tix-orders-empty')).textContent).toMatch(words);
  });

  it('Close sales for good asks first; Keep selling backs out, Close sales closes', async () => {
    arrange(SHAPES[4]);
    api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    fireEvent.click(await screen.findByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-close'));
    expect(screen.getByTestId('tix-close-area').textContent).toMatch(/Close sales for good\? Nobody can buy this ticket again\. Cannot be undone\./);
    fireEvent.click(screen.getByTestId('tix-close-keep'));
    expect(screen.queryByTestId('tix-close-confirm')).toBeNull();
    expect(api.setTicketStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tix-close'));
    fireEvent.click(screen.getByTestId('tix-close-confirm'));
    await waitFor(() => expect(api.setTicketStatus).toHaveBeenCalledWith('t1', 'closed'));
  });

  it.each([1, 2])('an edit can Save changes from step %i (no walk to the review)', async (at) => {
    arrange(SHAPES[5]);
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 't1' });
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    await screen.findByTestId('tix-step');
    if (at === 2) fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-step').textContent).toBe(`${at} / 3`);
    if (at === 2) fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '30' } });
    else fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Early bird plus' } });
    expect(screen.getByTestId('tix-save').textContent).toBe('Save changes');
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    expect(api.upsertTicketType.mock.calls[0][0]).toMatchObject(at === 2 ? { capacity: 30 } : { name: 'Early bird plus' });
  });

  it('Save changes from step 1 with a step-2 error jumps to step 2 and shows the error there', async () => {
    arrange(SHAPES[5]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-edit'));
    fireEvent.click(await screen.findByTestId('tix-next'));
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('tix-step').textContent).toBe('1 / 3');
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Early bird plus' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    expect(screen.getByTestId('tix-step').textContent).toBe('2 / 3');
    expect(screen.getByTestId('tix-form-capacity').getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('Enter how many tickets, from 1 to 100,000.');
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });

  it('a double tap on the payments link starts Stripe onboarding once', async () => {
    arrange({ name: 'free, none', role: 'owner', stripe: 'none', types: [type('on_sale', { pricePence: 0 })], orders: [] });
    let finish: (v: unknown) => void = () => {};
    api.startOnboarding.mockReturnValue(new Promise((r) => { finish = r; }));
    mount('/account/tickets');
    const go = await screen.findByTestId('tix-pay-go');
    fireEvent.click(go);
    fireEvent.click(go);
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(true));
    expect(api.startOnboarding).toHaveBeenCalledTimes(1);
    finish({ kind: 'error', reason: 'stripe_error' });
    expect(await screen.findByTestId('tix-pay-note')).toBeTruthy();
    expect(api.startOnboarding).toHaveBeenCalledTimes(1);
  });

  it('a new ticket keeps Continue only on steps 1 and 2 (no Save before the review)', async () => {
    arrange(SHAPES[2]);
    mount('/account/tickets/events/s1');
    fireEvent.click(await screen.findByTestId('tix-add'));
    await screen.findByTestId('tix-step');
    expect(screen.queryByTestId('tix-save')).toBeNull();
  });

  it.each([
    ['contributor (role reason, said once at the top)', SHAPES[9], [series('s1')]],
    ['series not live (reason under the row)', SHAPES[5], [series('s1', 'ended')]],
  ] as const)('the switch names only a reason that is on screen: %s', async (_n, shape, list) => {
    arrange(shape, [...list]);
    mount('/account/tickets/events/s1');
    const sw = (await screen.findByRole('switch')) as HTMLButtonElement;
    await waitFor(() => expect(sw.disabled).toBe(true));
    const ref = sw.getAttribute('aria-describedby');
    for (const id of (ref ?? '').split(' ').filter(Boolean)) expect(document.getElementById(id)).not.toBeNull();
    if (shape.role !== 'contributor') expect(ref).toBeTruthy();
  });
});

describe('fee zero (owner order 2026-10-29): organiser preview and lists say no fee', () => {
  const FEE_WORDS = /50p|booking fee|includes a fee|\bfee\b/i;
  it('event rules line names no fee', async () => {
    arrange(SHAPES.find((x) => x.name === 'selling')!);
    mount('/account/tickets/events/s1');
    expect((await screen.findByTestId('tix-event-rules')).textContent ?? '').not.toMatch(FEE_WORDS);
  });
  for (const [price, total] of [['10', '\u00A310.00'], ['12.50', '\u00A312.50'], ['0', 'Free']] as const) {
    it(`add sheet preview, price ${price}: buyer pays the ticket price, no fee words`, async () => {
      arrange(SHAPES.find((x) => x.name === 'connected, no tickets')!);
      mount('/account/tickets/events/s1');
      await waitFor(() => expect(api.fetchStripeAccount).toHaveBeenCalled());
      fireEvent.click(await screen.findByTestId('tix-add'));
      fireEvent.change(await screen.findByTestId('tix-form-name'), { target: { value: 'Early bird' } });
      fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: price } });
      expect(screen.getByTestId('tix-buyer-total').textContent).toBe(total);
      expect(screen.getByTestId('tix-buyer-line').textContent ?? '').not.toMatch(FEE_WORDS);
      fireEvent.click(screen.getByTestId('tix-next'));
      fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '20' } });
      fireEvent.click(screen.getByTestId('tix-next'));
      const review = screen.getByTestId('tix-review-buyer').textContent ?? '';
      expect(review).toContain(total);
      expect(review).not.toMatch(FEE_WORDS);
    });
  }
  it.each([
    ['paid order, no fee taken', order('p', 'paid', { subtotalPence: 2000, bookingFeePence: 0, totalPence: 2000 }), /^\u00A320\.00 goes back\. /],
    ['one ticket, no fee taken', order('q', 'paid', { quantity: 1, subtotalPence: 1000, bookingFeePence: 0, totalPence: 1000 }), /^\u00A310\.00 goes back\. /],
  ])('refund question: %s names no fee', (_n, o, re) => {
    const q = refundQuestion(o);
    expect(q.body).toMatch(re);
    expect(q.body).not.toMatch(FEE_WORDS);
  });
  it('refund question still says the fee goes back when the order carried one', () => {
    expect(refundQuestion(order('p', 'paid')).body).toMatch(/booking fee included/);
  });
});
