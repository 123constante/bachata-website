// @vitest-environment jsdom
/**
 * Where a ticket really is. Signed-out checkout says "email only"; the paid thank-you block
 * says "in your email" (empty) or "email, try My tickets" (error); no screen names My tickets
 * without a link to it. Guest orders are never linked to an account, so My tickets is never
 * promised for them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { getSession: vi.fn() } } }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null, authStatus: 'ready' as string }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: auth.authStatus, retryAuth: () => {} }) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketsBlock } from '../TicketsBlock';
import OrderQrBlock from '../OrderQrBlock';

const NOTE = 'You are not signed in, so your tickets come by email only. Sign in first to keep them in My tickets.';
const type = { id: 't1', occurrenceId: null, name: 'GA', pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null };

async function checkout(path = '/event/e1') {
  api.fetchPublicTicketTypes.mockResolvedValue([type]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <TicketsBlock seriesId="e1" occurrenceId="n1" organiserId="org1" now={new Date('2026-10-27T12:00:00Z')} origin="https://x.test" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByLabelText(/Email/);
}

afterEach(() => { cleanup(); auth.user = null; auth.authStatus = 'ready'; });

describe('checkout note x auth state', () => {
  it.each([
    ['signed out', null, 'ready', true],
    ['auth resolving', null, 'resolving', false],
    ['signed in', { id: 'u1' }, 'ready', false],
  ] as const)('%s: note shown=%s', async (_l, user, status, shown) => {
    auth.user = user as { id: string } | null;
    auth.authStatus = status;
    await checkout();
    if (shown) {
      expect(screen.getByTestId('tickets-guest-note').textContent).toContain(NOTE);
      expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    } else {
      expect(screen.queryByTestId('tickets-guest-note')).toBeNull();
      expect(screen.queryByText(/come by email only/)).toBeNull();
    }
  });
  it('Sign in returns to the same path and query (promo code survives)', async () => {
    await checkout('/event/e1?code=SUMMER');
    const href = screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')!;
    expect(href).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent('/event/e1?code=SUMMER')}`);
  });
});

const ORDER = '3f2a9c10-1111-4222-8333-444455556666';
const tok = (i: number) => i.toString(16).padStart(2, '0').repeat(32);
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

describe('order QR block x exact words', () => {
  beforeEach(() => { vi.useFakeTimers(); rpc.mockReset(); });
  afterEach(() => vi.useRealTimers());
  const rows: Array<[string, unknown, string | null]> = [
    ['loading', new Promise(() => {}), 'Getting your door codes…'],
    ['cards', { data: { tickets: [{ ticket_id: 'a', ticket_type_name: 'GA', qr_token: tok(1), checked_in: false }] }, error: null }, null],
    ['empty', { data: { tickets: [] }, error: null }, 'Your tickets are in your email.'],
    ['error', { data: null, error: { code: 'XX', message: 'x' } }, "We couldn't load your door codes just now. Your tickets are in your email. You can also try My tickets in a minute."],
  ];
  it.each(rows)('%s', async (label, reply, text) => {
    rpc.mockReturnValue(reply instanceof Promise ? reply : Promise.resolve(reply));
    const { container } = render(<MemoryRouter><OrderQrBlock orderId={ORDER} /></MemoryRouter>);
    await flush();
    if (text) expect(container.textContent).toBe(text);
    else expect(screen.getByTestId('order-qr-block')).toBeTruthy();
    // No screen names My tickets without a link to it.
    const names = /my tickets/i.test(container.textContent ?? '');
    const linked = screen.queryAllByRole('link').some((a) => a.getAttribute('href') === '/account/my-tickets');
    if (label === 'empty') expect(names).toBe(false);
    if (names) expect(linked).toBe(true);
  });
});
