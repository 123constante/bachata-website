// @vitest-environment jsdom
/**
 * The 8 should-fix items of docs/review/ticketing-checkout-1063.md that #1063 left open or
 * only half closed (brief: docs/briefs/ticketing-checkout-fixes.md). Table-driven over the
 * shapes the block meets: free, paid, sold out, 0/1/many left, 2,022, error, cancel, timeout.
 * Each block was run against the unfixed code first and failed.
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
import { REASON_COPY, WAY_LABEL, formatPence, reasonCopy, thanksCopy, type PublicTicketType } from '../ticketCheckoutModel';

const realPost = (wire as unknown as { realPost: typeof wire.postTicketCheckout }).realPost;
const NOW = new Date('2026-10-27T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const ORDER = '3f2a9c10-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const RATE_MSG = 'Too many ticket requests. Please wait a while and try again.';
const HELD = 'If you cancelled a checkout just now, those tickets are held for about 30 minutes.';
const BODY = { ticket_type_id: 't', quantity: 1, buyer_email: 'a@b.co', success_url: '', cancel_url: '' };
const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});

function renderBlock(types: PublicTicketType[], path = '/event/e1') {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId="n1" organiserId="org1" now={NOW} origin={PROD} />} />
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
const thanksText = () => screen.getByTestId('tickets-thanks').textContent ?? '';

function stubWire() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon');
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // A red run leaves queued one-shot replies behind; never let them leak into the next case.
  api.postTicketCheckout.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.sessionStorage.clear();
});

describe('item 1: paid wording only on server confirmation', () => {
  it.each<[string, boolean, 'confirmed' | 'checking' | 'none', RegExp]>([
    ['free, server-issued', true, 'checking', /^Your free tickets are on their way$/],
    ['paid, server confirmed', false, 'confirmed', /^Payment received, your tickets are being emailed$/],
    ['paid, order id only', false, 'checking', /^Checking your order$/],
    ['paid, no order', false, 'none', /^Checking your order$/],
  ])('model: %s', (_l, free, state, title) => {
    const c = thanksCopy(free, state);
    expect(c.title).toMatch(title);
    if (state !== 'confirmed') expect(`${c.title} ${c.body}`).not.toMatch(/Payment received/);
    // Every unconfirmed state says what the person can do.
    if (state !== 'confirmed' && !free) expect(c.body).toMatch(/check your spam folder, then contact the organiser/);
  });
  it.each([
    ['a real order id in the URL', `/tickets/thanks?o=${ORDER}`, /Order reference:/],
    ['a stored order id after Stripe', '/tickets/thanks', /Order reference:/],
    ['nothing at all', '/tickets/thanks?o=', null],
    ['a garbled id', '/tickets/thanks?o=paid', null],
  ])('page: %s never claims a payment', (label, path, ref) => {
    if (label.startsWith('a stored')) window.sessionStorage.setItem('bc.ticketOrderId', ORDER);
    thanks(path);
    expect(screen.getByRole('heading').textContent).toBe('Checking your order');
    expect(thanksText()).not.toMatch(/Payment received/);
    if (ref) expect(thanksText()).toMatch(ref);
    else expect(thanksText()).not.toMatch(/Order reference/);
  });
});

describe('item 2: a timed-out POST is its own retry state, and a retry is one order', () => {
  it.each<[string, () => unknown, string]>([
    ['TimeoutError', () => new DOMException('timed out', 'TimeoutError'), 'timeout'],
    ['AbortError', () => new DOMException('aborted', 'AbortError'), 'timeout'],
    ['offline TypeError', () => new TypeError('Failed to fetch'), 'network'],
  ])('%s -> %s, sent once, never resent by the wire', async (_l, err, reason) => {
    stubWire();
    const f = vi.fn(async () => { throw err(); });
    vi.stubGlobal('fetch', f);
    expect(await realPost(BODY)).toEqual({ kind: 'error', reason, message: null });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('timeout copy: not charged, Try again', () => {
    expect(REASON_COPY.timeout).toEqual({ text: expect.stringMatching(/took too long.*You have not been charged\. Try again\./), way: 'retry' });
  });
  it('block: timeout alert, Try again, then exactly one new POST per submit', async () => {
    api.postTicketCheckout.mockResolvedValueOnce({ kind: 'error', reason: 'timeout', message: null });
    let release: (v: unknown) => void = () => {};
    api.postTicketCheckout.mockReturnValueOnce(new Promise((r) => { release = r; }));
    renderBlock([mk('a')]);
    const buy = await screen.findByRole('button', { name: 'Buy tickets' });
    fill();
    fireEvent.submit(buy.closest('form') as HTMLFormElement);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/took too long/);
    fireEvent.click(screen.getByRole('button', { name: WAY_LABEL.retry }));
    const form = screen.getByRole('button', { name: 'Buy tickets' }).closest('form') as HTMLFormElement;
    // Retry while the second request is in flight: Return and a double tap send nothing more.
    act(() => { fireEvent.submit(form); fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.postTicketCheckout).toHaveBeenCalledTimes(2);
    await act(async () => release({ kind: 'error', reason: 'sold_out', message: null }));
  });
});

describe('item 5: rate-limit copy after a cancel return', () => {
  it.each([[null], [RATE_MSG]])('server message %s', async (message) => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'rate_limited', message });
    renderBlock([mk('a')], '/event/e1?occurrenceId=n1&tickets=cancelled');
    const buy = await screen.findByRole('button', { name: 'Buy tickets' });
    expect(screen.getByRole('status').textContent).toMatch(/Checkout cancelled/);
    fill();
    fireEvent.click(buy);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(`${RATE_MSG} ${HELD}`);
    expect(alert.textContent?.split(HELD).length).toBe(2);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: WAY_LABEL.retry })).toBeTruthy();
  });
});

describe('item 7: every server reason has its own copy; anything else is the safe generic', () => {
  // Every `reason` the deployed ticket-checkout (v3) and its RPCs can send (review section 8).
  const server: [string, string][] = [
    ['invalid_request', 'fix_form'], ['invalid_quantity', 'fix_form'], ['invalid_email', 'fix_form'],
    ['invalid_fee', 'retry'], ['refused', 'retry'], ['rate_limited', 'retry'],
    ['not_found', 'pick_another'], ['not_on_sale', 'pick_another'], ['outside_sales_window', 'pick_another'],
    ['sold_out', 'pick_another'], ['organiser_not_onboarded', 'contact_organiser'], ['stripe_error', 'retry'],
    ['internal_error', 'retry'], ['free_issue_failed', 'retry'], ['not_free', 'retry'], ['not_pending', 'retry'],
    ['stale', 'retry'], ['method_not_allowed', 'retry'],
    // Client-side reasons.
    ['not_configured', 'contact_organiser'], ['unauthorised', 'retry'], ['network', 'retry'], ['timeout', 'retry'],
  ];
  it.each(server)('%s -> own entry, way %s', (reason, way) => {
    expect(Object.prototype.hasOwnProperty.call(REASON_COPY, reason)).toBe(true);
    const c = reasonCopy(reason);
    expect(c.way).toBe(way);
    expect(c.text.length).toBeGreaterThan(20);
    expect(c.text).not.toMatch(/[–—‘’“”…]/);
  });
  it('no entry is unreachable: the table above is the whole map', () => {
    expect(Object.keys(REASON_COPY).sort()).toEqual(server.map(([r]) => r).sort());
  });
  it.each(['', 'zzz', 'toString', '__proto__', 'constructor'])('unmapped %j -> generic, never charged, Try again', (reason) => {
    expect(reasonCopy(reason)).toEqual({ text: 'Your tickets could not be booked. You have not been charged. Try again.', way: 'retry' });
  });
  it('the block renders the shared copy, not its own', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'stale', message: null });
    renderBlock([mk('a')]);
    const buy = await screen.findByRole('button', { name: 'Buy tickets' });
    fill();
    fireEvent.click(buy);
    expect((await screen.findByRole('alert')).textContent).toContain(REASON_COPY.stale.text);
  });
});

describe('shapes: 0 / 1 / many left, and 2,022', () => {
  it.each([
    [1200, 'Free', '£12'], [1250, '', '£12.50'], [202200, '', '£2,022'], [202250, '', '£2,022.50'], [0, '', 'Free'],
  ])('formatPence(%s)', (p, _x, out) => expect(formatPence(p)).toBe(out));
  it.each<[string, Partial<PublicTicketType>, RegExp, RegExp | null]>([
    ['0 left', { remaining: 0 }, /Sold out/, null],
    ['1 left', { remaining: 1 }, /1 left/, /Only 1 left\./],
    ['2,022 left', { remaining: 2022 }, /On sale/, null],
  ])('%s', async (_l, patch, rowLabel, note) => {
    renderBlock([mk('a', patch)]);
    const row = await screen.findByRole('button', { name: /Type a/ });
    expect(row.textContent).toMatch(rowLabel);
    if (note) expect(screen.getByText(note)).toBeTruthy();
  });
  it('a 2,022 pound ticket x 20: thousands separators on every line', async () => {
    renderBlock([mk('a', { pricePence: 202200, remaining: 2022 })]);
    await screen.findByRole('button', { name: 'Buy tickets' });
    for (let i = 1; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
    const t = screen.getByTestId('ticket-totals').textContent ?? '';
    expect(t).toMatch(/20 × Type a£40,440/);
    expect(t).toMatch(/booking fee per ticket£10Total£40,450/);
    expect(screen.getByText('Up to 20 tickets per order.')).toBeTruthy();
  });
});
