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
import {
  EVENT_SALE,
  NOT_MANAGER,
  SWITCH_LABEL,
  buyerNameOf,
  canManage,
  eventSaleOf,
  moveBlock,
  nextStep,
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
        await waitFor(() => expect(row.getByTestId('tix-type-line').textContent).toContain(`${sold} sold \u00B7 ${Math.max(0, t.capacity - t.reserved)} left`));
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
        expect(screen.getByTestId('tix-buyer-total').textContent).toBe(price === '10' ? '\u00A310.50' : 'Free');
        expect(screen.getByTestId('tix-buyer-line').textContent).toBe(price === '10' ? '\u00A310.00 ticket + 50p booking fee' : 'Free, no fee');
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
        expect(screen.getByTestId('tix-review-buyer').textContent).toContain(price === '10' ? '\u00A310.50' : 'Free, no fee');
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
  it('Home: Sold and Sales sum every ticket type', async () => {
    arrange(SHAPES[4]);
    mount('/account/tickets');
    expect((await screen.findByTestId('tix-sales-sold')).textContent).toContain('2');
    expect(screen.getByTestId('tix-sales-gross').textContent).toContain('\u00A320.00');
    expect(screen.getByTestId('tix-event-line').textContent).toBe('8 left of 20 \u00B7 Next: Friday 6 November');
  });
});
