// @vitest-environment jsdom
/**
 * Review findings on PR #1063 (docs/review/ticketing-checkout-1063.md on the reviewer
 * branch), one block per finding. Each was run against the unfixed code first and failed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc: vi.fn() },
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => {
  const real = await orig<typeof import('../ticketCheckoutApi')>();
  return { ...real, fetchPublicTicketTypes: api.fetchPublicTicketTypes, postTicketCheckout: api.postTicketCheckout, realPost: real.postTicketCheckout };
});

import * as wire from '../ticketCheckoutApi';
import { TicketsBlock } from '../TicketsBlock';
import TicketThanksPage from '../TicketThanksPage';
import { parseCheckoutReply, reasonCopy, thanksCopy, type PublicTicketType } from '../ticketCheckoutModel';

const realPost = (wire as unknown as { realPost: typeof wire.postTicketCheckout }).realPost;
const NOW = new Date('2026-10-27T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const ORDER = '3f2a9c10-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});

function renderBlock(types: PublicTicketType[], opts: { origin?: string; path?: string } = {}) {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[opts.path ?? '/event/e1']}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId="n1" organiserId="org1" now={NOW} origin={opts.origin ?? PROD} />} />
          <Route path="/tickets/thanks" element={<TicketThanksPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fill() {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

const thanks = (path: string) => render(<MemoryRouter initialEntries={[path]}><TicketThanksPage /></MemoryRouter>);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.sessionStorage.clear();
});

describe('finding 2: no "Payment received" without an order id', () => {
  it('model', () => {
    expect(thanksCopy(false, false).title).toBe('Thanks for your order');
    expect(thanksCopy(false, false).body).toMatch(/^If you completed payment/);
  });
  it('page with no id and nothing stored', () => {
    thanks('/tickets/thanks');
    const page = screen.getByTestId('tickets-thanks').textContent ?? '';
    expect(page).toMatch(/Thanks for your order/);
    expect(page).not.toMatch(/Payment received/);
  });
});

describe('finding 3: the checkout POST times out after 20s and lands as network', () => {
  it('passes a 20s timeout signal on the send and on the guest retry', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, order_id: ORDER, free: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await realPost({ ticket_type_id: 't', quantity: 1, buyer_email: 'a@b.co', success_url: '', cancel_url: '' });
    expect(timeout).toHaveBeenCalledWith(20_000);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    timeout.mockRestore();
  });
  it('a TimeoutError is reason network', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    expect(await realPost({ ticket_type_id: 't', quantity: 1, buyer_email: 'a@b.co', success_url: '', cancel_url: '' }))
      .toEqual({ kind: 'error', reason: 'network', message: null });
  });
});

describe('finding 4: the origin reason shows before any field is filled', () => {
  it('preview origin, untouched form', async () => {
    renderBlock([mk('a')], { origin: 'https://bachata-website-git-x.vercel.app' });
    await screen.findByRole('button', { name: 'Buy tickets' });
    expect(screen.getByText(/only works on bachatacalendar\.co\.uk/)).toBeTruthy();
    expect(screen.queryByText(/Enter your email/)).toBeNull();
  });
});

describe('finding 5: a real form, so Return submits', () => {
  it('Buy is a submit button inside a form; submitting the form buys', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'sold_out', message: null });
    renderBlock([mk('a')]);
    const buy = await screen.findByRole('button', { name: 'Buy tickets' });
    expect(buy.getAttribute('type')).toBe('submit');
    const form = buy.closest('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.noValidate).toBe(true);
    expect(form.contains(screen.getByLabelText(/Email/))).toBe(true);
    fireEvent.submit(form);
    expect(api.postTicketCheckout).not.toHaveBeenCalled();
    fill();
    fireEvent.submit(form);
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
  });
});

describe('finding 6: rate_limited explains held tickets', () => {
  it.each([[null], ['Too many ticket requests. Please wait a while and try again.']])('message %s', (message) => {
    expect(reasonCopy('rate_limited', message).text).toMatch(/If you cancelled a checkout just now, those tickets are held for about 30 minutes\.$/);
  });
});

describe('finding 7 + 11: ?o= must be a UUID; free=1 counts only with one', () => {
  it.each(['hello', 'abcdef12-0000', '<script>'])('?o=%s is no order', (o) => {
    thanks(`/tickets/thanks?o=${encodeURIComponent(o)}`);
    const page = screen.getByTestId('tickets-thanks').textContent ?? '';
    expect(page).not.toMatch(/Order reference/);
    expect(page).toMatch(/If you completed payment/);
  });
  it('a UUID is an order', () => {
    thanks(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('tickets-thanks').textContent).toMatch(/Order reference: 3f2a9c10/);
  });
  it('an empty ?o= falls back to the stored id on first paint', () => {
    window.sessionStorage.setItem('bc.ticketOrderId', ORDER);
    thanks('/tickets/thanks?o=');
    expect(screen.getByTestId('tickets-thanks').textContent).toMatch(/3f2a9c10/);
  });
  it('a garbled ?o= falls back to the stored id', () => {
    window.sessionStorage.setItem('bc.ticketOrderId', ORDER);
    thanks('/tickets/thanks?o=hello');
    expect(screen.getByTestId('tickets-thanks').textContent).toMatch(/3f2a9c10/);
  });
  it('free=1 without a valid order id is not the free copy', () => {
    thanks('/tickets/thanks?free=1');
    expect(screen.getByTestId('tickets-thanks').textContent).not.toMatch(/free tickets/);
    cleanup();
    thanks(`/tickets/thanks?o=${ORDER}&free=1`);
    expect(screen.getByTestId('tickets-thanks').textContent).toMatch(/free tickets are on their way/);
  });
});

describe('finding 8: invalid_quantity and invalid_email are fix_form', () => {
  it.each(['invalid_quantity', 'invalid_email'])('%s', (r) => {
    expect(reasonCopy(r).way).toBe('fix_form');
  });
});

describe('nit 9: a cancel return forgets the unpaid order id', () => {
  it('clears sessionStorage', async () => {
    window.sessionStorage.setItem('bc.ticketOrderId', ORDER);
    renderBlock([mk('a')], { path: '/event/e1?tickets=cancelled' });
    await screen.findByText(/Checkout cancelled/);
    expect(window.sessionStorage.getItem('bc.ticketOrderId')).toBeNull();
  });
});

describe('nit 10: only a Stripe checkout URL redirects', () => {
  it('rejects another https host', () => {
    expect(parseCheckoutReply({ ok: true, order_id: ORDER, checkout_url: 'https://evil.example/x' }, 200).kind).toBe('error');
    expect(parseCheckoutReply({ ok: true, order_id: ORDER, checkout_url: 'https://checkout.stripe.com.evil.example/x' }, 200).kind).toBe('error');
    expect(parseCheckoutReply({ ok: true, order_id: ORDER, checkout_url: 'https://checkout.stripe.com/c/pay/x' }, 200).kind).toBe('redirect');
  });
});

describe('nit 12: the privacy policy is a link', () => {
  it('links to /privacy', async () => {
    renderBlock([mk('a')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Read the terms of sale' }));
    expect(screen.getByRole('link', { name: 'privacy policy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('terms-text').textContent).not.toMatch(/at \/privacy/);
  });
});

describe('nit 17: a second submit while the first is in flight sends nothing', () => {
  it('two submits in one batch post once', async () => {
    let settle: (v: unknown) => void = () => {};
    api.postTicketCheckout.mockReturnValue(new Promise((r) => { settle = r; }));
    renderBlock([mk('a')]);
    const buy = await screen.findByRole('button', { name: 'Buy tickets' });
    fill();
    // Inside one act() React does not re-render between the two events, so only a ref guard holds.
    act(() => {
      buy.click();
      buy.click();
    });
    expect(api.postTicketCheckout).toHaveBeenCalledTimes(1);
    await act(async () => settle({ kind: 'error', reason: 'sold_out', message: null }));
  });
});
