import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { cloneElement, isValidElement, type ReactNode } from 'react';
import { STRIPE, home, org, series, type Shape } from './fixtures';
import { stripeStateOf, type Order, type TypeSales } from '../../../tickets/ticketModel';
import { parseOrderRow } from '../../../tickets/ticketsApi';

/**
 * Fix round 1 (review 1520-r1 F1): the read a non-owner really makes. ORDER_SELECT_COUNTS carries no
 * pence column and no buyer_name, so the row the screen gets is parseOrderRow of a count-shaped row: every pence field 0.
 */
export const countsOnlyOrder = (o: Order): Order =>
  parseOrderRow({ id: o.id, ticket_type_id: o.typeId, quantity: o.quantity, status: o.status, paid_at: o.paidAt });
/** The summary a non-owner's parse keeps (F3): every `*Pence` field 0, counts untouched. */
export const countsOnlySales = (t: TypeSales): TypeSales =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, /Pence$/.test(k) ? 0 : v])) as unknown as TypeSales;

/** Query results as the screens read them. */
export const ok = <T,>(data: T) => ({ isPending: false, isError: false, isSuccess: true, data, error: null, fetchStatus: 'idle', refetch: vi.fn() });
export const pending = () => ({ isPending: true, isError: false, isSuccess: false, data: undefined, error: null, fetchStatus: 'fetching', refetch: vi.fn() });
export const failed = () => ({ isPending: false, isError: true, isSuccess: false, data: undefined, error: new Error('x'), fetchStatus: 'idle', refetch: vi.fn() });

export interface Q {
  home: unknown;
  types: unknown;
  orders: unknown;
  summary: unknown;
  stripe: unknown;
  onboard: { go: () => Promise<void>; busy: boolean; note: string | null; switchedOff: boolean };
  /** Slice 2: get_my_series_going_v1 nights (null = not read yet) and the event's own ticket link. */
  going: { is_cancelled: boolean; going_count: number }[] | null;
  ticketLink: string | null;
  /** The money flag the screen passed to useSeriesOrders on its last render. */
  ordersMoney: boolean | null;
  moneyOrdersFired: boolean;
  /** The money flag the screen passed to useSummary on its last render (undefined = not passed). */
  summaryMoney: boolean | null | undefined;
}

export const q: Q = { home: null, types: null, orders: null, summary: null, stripe: null, onboard: { go: async () => {}, busy: false, note: null, switchedOff: false }, going: null, ticketLink: null, ordersMoney: null, moneyOrdersFired: false, summaryMoney: null };

export function load(s: Shape) {
  const o = org({ role: s.role as 'owner' }, series({ lifecycle_status: s.lifecycle }));
  q.home = ok(home(o));
  q.types = ok(s.types);
  q.orders = ok(s.orders);
  q.summary = ok(s.sales === 'refused' ? { ok: false, reason: 'not_authorised', types: [], moneyVisible: null } : { ok: true, reason: null, moneyVisible: true, types: s.sales });
  q.stripe = { query: ok(STRIPE[s.stripe]), state: stripeStateOf(STRIPE[s.stripe]) };
  q.onboard = { go: vi.fn(async () => {}), busy: false, note: null, switchedOff: false };
  q.going = null;
  q.ticketLink = null;
  q.ordersMoney = null;
  q.moneyOrdersFired = false;
  q.summaryMoney = null;
}

type Res<T> = { isSuccess?: boolean; data?: T };

export const dataMock = async (orig: () => Promise<typeof import('../data')>) => ({
  ...(await orig()),
  useP3Home: () => q.home,
  useSeriesTypes: () => q.types,
  useSeriesOrders: (_o: unknown, _s: unknown, _ids: unknown, on: unknown, money?: boolean) => {
    q.ordersMoney = money ?? true;
    if (money === true && on) q.moneyOrdersFired = true;
    // Review 1520-r1 F1: a counts read returns what the server would, never the owner's payload.
    const r = q.orders as Res<Order[]>;
    if (money === false && r?.isSuccess && Array.isArray(r.data)) return { ...r, data: r.data.map(countsOnlyOrder) };
    return q.orders;
  },
  useSeriesGoing: () => q.going,
  useSeriesTicketLink: () => q.ticketLink,
  useSummary: (_o: unknown, ...rest: unknown[]) => {
    const money = rest[0] as boolean | undefined;
    q.summaryMoney = money;
    const r = q.summary as Res<{ ok: boolean; types: TypeSales[] }>;
    if (money === false && r?.isSuccess && r.data?.ok) return { ...r, data: { ...r.data, types: r.data.types.map(countsOnlySales) } };
    return q.summary;
  },
  useStripe: () => q.stripe,
  useStartOnboarding: () => q.onboard,
});

export function show(node: ReactNode, path = '/account/p3/events/ser-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <div className="p3-theme">{isValidElement(node) ? cloneElement(node) : node}</div>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const r = render(tree());
  /** Render the same tree again (a parent re-render, or a query result landing). */
  return { ...r, again: () => r.rerender(tree()) };
}
