import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { cloneElement, isValidElement, type ReactNode } from 'react';
import { STRIPE, home, org, series, type Shape } from './fixtures';
import { stripeStateOf } from '../../../tickets/ticketModel';

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
}

export const q: Q = { home: null, types: null, orders: null, summary: null, stripe: null, onboard: { go: async () => {}, busy: false, note: null, switchedOff: false }, going: null, ticketLink: null, ordersMoney: null };

export function load(s: Shape) {
  const o = org({ role: s.role as 'owner' }, series({ lifecycle_status: s.lifecycle }));
  q.home = ok(home(o));
  q.types = ok(s.types);
  q.orders = ok(s.orders);
  q.summary = ok(s.sales === 'refused' ? { ok: false, reason: 'not_authorised', types: [] } : { ok: true, reason: null, types: s.sales });
  q.stripe = { query: ok(STRIPE[s.stripe]), state: stripeStateOf(STRIPE[s.stripe]) };
  q.onboard = { go: vi.fn(async () => {}), busy: false, note: null, switchedOff: false };
  q.going = null;
  q.ticketLink = null;
  q.ordersMoney = null;
}

export const dataMock = async (orig: () => Promise<typeof import('../data')>) => ({
  ...(await orig()),
  useP3Home: () => q.home,
  useSeriesTypes: () => q.types,
  useSeriesOrders: (_o: unknown, _s: unknown, _ids: unknown, _on: unknown, money?: boolean) => {
    q.ordersMoney = money ?? true;
    return q.orders;
  },
  useSeriesGoing: () => q.going,
  useSeriesTicketLink: () => q.ticketLink,
  useSummary: () => q.summary,
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
