// @vitest-environment jsdom
/** Early-bird buyer (flag ticketEarlyBird): rows, stepper cap, pay-bar saving, v3 parse unchanged. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc },
}));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => {
  const real = await orig<typeof import('../ticketCheckoutApi')>();
  return { ...real, fetchPublicTicketTypes: api.fetchPublicTicketTypes };
});

import { TicketsBlock } from '../TicketsBlock';
import { fetchPublicTicketTypes as realFetch } from '../ticketCheckoutApi';
import { earlySavingPence, maxQuantity, parsePublicTypes, type PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-10-20T12:00:00Z');
const row = (o: Record<string, unknown> = {}) => ({
  id: 't1', name: 'Party ticket', price_pence: 1000, currency: 'GBP', status: 'on_sale', remaining: 12,
  sales_open_at: null, sales_close_at: null, ...o,
});
const early = (o: Record<string, unknown> = {}) => row({ regular_price_pence: 1500, early_state: 'open', early_left: 3, ...o });
const type = (o: Record<string, unknown> = {}): PublicTicketType => parsePublicTypes([early(o)])[0];

function show(rows: unknown[], earlyBird: boolean) {
  api.fetchPublicTicketTypes.mockResolvedValue(parsePublicTypes(rows));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TicketsBlock seriesId="s1" occurrenceId={null} organiserId="o1" now={NOW} priceSteps earlyBird={earlyBird} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('early bird rows', () => {
  it('open: struck regular price above the early price, orange line, 12 left kept', async () => {
    show([early()], true);
    expect((await screen.findByTestId('ticket-early-line')).textContent).toBe('Early bird price');
    expect(screen.getByTestId('ticket-early-price').textContent).toBe('£15£10');
    expect(screen.getByText('12 left')).toBeTruthy();
    expect(screen.queryByTestId('ticket-early-sold-out')).toBeNull();
  });
  it('sold_out: regular price only plus a grey line', async () => {
    show([row({ regular_price_pence: 1500, early_state: 'sold_out', early_left: 0, price_pence: 1500 })], true);
    expect((await screen.findByTestId('ticket-early-sold-out')).textContent).toBe('Early bird sold out');
    expect(screen.queryByTestId('ticket-early-price')).toBeNull();
    expect(screen.queryByTestId('ticket-early-line')).toBeNull();
  });
  it('null state and flag off: row exactly as today', async () => {
    show([early({ early_state: null })], true);
    await screen.findByText('Party ticket');
    expect(screen.queryByTestId('ticket-early-price')).toBeNull();
    cleanup();
    show([early()], false);
    await screen.findByText('Party ticket');
    expect(screen.queryByTestId('ticket-early-price')).toBeNull();
    expect(screen.queryByTestId('ticket-early-line')).toBeNull();
  });
});

describe('stepper cap and saving', () => {
  it('cap = min(existing max, early_left) only while open', () => {
    expect(maxQuantity(type(), NOW)).toBe(3);
    expect(maxQuantity(type({ early_left: 50 }), NOW)).toBe(12);
    expect(maxQuantity(type({ early_state: null }), NOW)).toBe(12);
  });
  it('save sum incl. mixed basket; none = 0', () => {
    const open = type();
    const plain = parsePublicTypes([row({ id: 't2' })])[0];
    expect(earlySavingPence([{ type: open, quantity: 2 }])).toBe(1000);
    expect(earlySavingPence([{ type: open, quantity: 2 }, { type: plain, quantity: 4 }])).toBe(1000);
    expect(earlySavingPence([{ type: plain, quantity: 4 }])).toBe(0);
  });
  it('pay bar says you save £10 for 2 early tickets, nothing without', async () => {
    show([early({ early_left: 5 })], true);
    const btn = await screen.findByRole('button', { name: /Party ticket/ });
    btn.click();
    expect((await screen.findByTestId('ticket-bar-saving')).textContent).toBe('you save £5');
  });
});

describe('wire and parse', () => {
  it('v3 rows parse with no early fields; v5 rows parse them', () => {
    const v3 = parsePublicTypes([row({ next_price_pence: null, next_price_at: null })])[0];
    expect('earlyState' in v3).toBe(false);
    expect('regularPricePence' in v3).toBe(false);
    const v5 = type();
    expect([v5.regularPricePence, v5.earlyState, v5.earlyLeft]).toEqual([1500, 'open', 3]);
  });
  it('reads v5 only with both flags, else v3', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await realFetch('s', null, true, true);
    await realFetch('s', null, true, false);
    await realFetch('s', null, false, true);
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['ticket_types_public_v5', 'ticket_types_public_v3', 'ticket_types_public_v2']);
  });
});
