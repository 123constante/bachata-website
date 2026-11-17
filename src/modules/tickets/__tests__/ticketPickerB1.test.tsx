// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: null as null | { email: string } }));
const sb = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { ...sb, getSession: async () => ({ data: { session: null } }) }, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: auth.user ? 'signed_in' : 'signed_out' }) }));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketPickerB1 } from '../TicketPickerB1';
import { basketTotals, buildPickerBody, cleanBasket, dateOnly, heldFrom, isEmail, perLine, sendCodeError, verifyCodeError } from '../pickerModel';
import type { PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-11-04T12:00:00Z');
const mk = (id: string, name: string, pricePence: number, extra: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name, pricePence, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...extra,
});
const TYPES = [mk('a', '1 Class + Latin Party', 1000), mk('b', 'Full Experience', 1500), mk('c', '5 Weeks Class', 6500, { remaining: 1 }), mk('d', 'Gone', 500, { status: 'sold_out' })];

function mount(search = '') {
  api.fetchPublicTicketTypes.mockResolvedValue(TYPES);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/event/e1${search}`]}>
        <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco Loco" dateLine="Wed 18 Nov, 9pm" onClose={() => {}} now={NOW} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const LIVE = 'https://bachatacalendar.co.uk';
const assign = vi.fn();
/** The live origin (the preview guard passes) and a spy for the Stripe hop. */
const live = (origin = LIVE) => vi.stubGlobal('location', { ...window.location, assign, origin });
const tick = () => fireEvent.click(screen.getByTestId('picker-terms'));
const add = (n: string) => fireEvent.click(screen.getByRole('button', { name: `Add one ${n}` }));
const typeCode = (code: string) => code.split('').forEach((d, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: d } }));

beforeEach(() => { sessionStorage.clear(); auth.user = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); assign.mockReset(); Object.values(sb).forEach((f) => f.mockReset()); Object.values(api).forEach((f) => f.mockReset()); });

describe('pickerModel', () => {
  it('totals, clamps and drops unbuyable', () => {
    expect(cleanBasket({ a: 2, c: 9, d: 3, zz: 1 }, TYPES, NOW)).toEqual({ a: 2, c: 1 });
    // The 20-ticket cap is for the whole order, not per type (server MAX_QUANTITY).
    expect(cleanBasket({ a: 15, b: 10 }, TYPES, NOW)).toEqual({ a: 15, b: 5 });
    expect(basketTotals({ a: 2, b: 1 }, TYPES).subtotalPence).toBe(3500);
  });
  it('OTP copy: rate limit waits; wrong and expired read the same', () => {
    expect(sendCodeError({ status: 429, code: 'over_email_send_rate_limit' })).toMatch(/Wait a minute/);
    expect(sendCodeError({ status: 400, code: 'email_address_invalid' })).toMatch(/Check the address/);
    expect(verifyCodeError({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe('That code is wrong or expired.');
    expect(verifyCodeError({ status: 429, code: 'over_request_rate_limit' })).toMatch(/Wait a minute/);
  });
  it('price_changed folds into the basket; a stale hold is ignored by the body', () => {
    const held = heldFrom({ lines: [{ line: 1, ticketTypeId: 'b', newUnitPricePence: 1800 }], newTotalPence: 3800 }, { a: 2, b: 1 }, TYPES);
    expect(held.units).toEqual({ a: 1000, b: 1800 });
    const f = { types: TYPES, email: 'x@y.co', occurrenceId: null, origin: LIVE, pathname: '/event/e1', search: '', held };
    expect(buildPickerBody({ ...f, basket: { a: 2, b: 1 } }).expected_total_pence).toBe(3800);
    expect(buildPickerBody({ ...f, basket: { a: 2, b: 1 } }).lines[1].expected_unit_price_pence).toBe(1800);
    expect(buildPickerBody({ ...f, basket: { a: 1, b: 1 } }).expected_total_pence).toBe(2500);
  });
  it('date only, email, per class', () => {
    expect(dateOnly('Saturday 14 November, 9pm')).toBe('Saturday 14 November');
    expect(dateOnly('Sat 14 Nov at 9:30pm')).toBe('Sat 14 Nov');
    expect(dateOnly(null)).toBeNull();
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(perLine(mk('x', '5 Classes', 6500))).toBe('£13 a class');
    expect(perLine(mk('x', 'Party', 1000))).toBeNull();
  });
  it('builds the multi-line basket body', () => {
    const b = buildPickerBody({ basket: { a: 1, b: 2 }, types: TYPES, email: ' x@y.co ', occurrenceId: 'o1', origin: 'https://s', pathname: '/event/e1', search: '' });
    expect(b.lines).toEqual([
      { ticket_type_id: 'a', quantity: 1, expected_unit_price_pence: 1000 },
      { ticket_type_id: 'b', quantity: 2, expected_unit_price_pence: 1500 },
    ]);
    expect(b.buyer_email).toBe('x@y.co');
    expect(b.cancel_url).toContain('tickets=cancelled');
    expect(b.cancel_url).toContain('occurrenceId=o1');
  });
});

describe('TicketPickerB1', () => {
  it('shows date only, disables Continue until something is picked, totals', async () => {
    mount();
    await screen.findByText('Full Experience');
    expect(screen.queryByText(/9pm/)).toBeNull();
    expect((screen.getByTestId('picker-continue') as HTMLButtonElement).disabled).toBe(true);
    add('Full Experience'); add('Full Experience');
    expect(screen.getByTestId('picker-total').textContent).toBe('£30');
    expect(screen.getByTestId('picker-count').textContent).toBe('2 tickets');
    expect(screen.getByText('Secure payment by Stripe.')).toBeTruthy();
  });
  it('promo is a stub: empty and any code are refused with a reason', async () => {
    mount();
    await screen.findByText('Full Experience');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByTestId('picker-promo-msg').textContent).toBe('Enter a code first.');
    fireEvent.change(screen.getByLabelText('Promo code'), { target: { value: 'spring10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getByTestId('picker-promo-msg').textContent).toMatch(/not available yet/));
  });
  it('signed out: email, code, then Stripe; account via OTP create', async () => {
    sb.signInWithOtp.mockResolvedValue({ error: null });
    sb.verifyOtp.mockResolvedValue({ error: null });
    api.postTicketCheckout.mockResolvedValue({ kind: 'redirect', url: 'https://checkout.stripe.com/x', orderId: '11111111-1111-4111-8111-111111111111' });
    live();
    mount();
    await screen.findByText('Full Experience');
    add('Full Experience'); add('1 Class + Latin Party'); add('1 Class + Latin Party');
    expect(screen.getByTestId('picker-total').textContent).toBe('£35');
    expect((screen.getByTestId('picker-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('picker-blocked').textContent).toBe('Tick the box to accept the terms of sale.');
    tick();
    fireEvent.click(screen.getByTestId('picker-continue'));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'bad' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' }).pop()!);
    expect(await screen.findByText('Enter a valid email, like you@example.com.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'me@x.co' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' }).pop()!);
    await screen.findByText('Enter the 6-digit code');
    expect(sb.signInWithOtp).toHaveBeenCalledWith({ email: 'me@x.co', options: { shouldCreateUser: true } });
    expect(screen.getByText('Send a new code in 60s')).toBeTruthy();
    sb.verifyOtp.mockResolvedValueOnce({ error: { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' } });
    typeCode('000000');
    await waitFor(() => expect(screen.getByTestId('code-error').textContent).toBe('That code is wrong or expired.'));
    typeCode('418027');
    await waitFor(() => expect(sb.verifyOtp).toHaveBeenLastCalledWith({ email: 'me@x.co', token: '418027', type: 'email' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/x'));
    expect(screen.getByTestId('picker-opening').textContent).toMatch(/Opening secure payment/);
    // The FULL wire body: the basket on screen, its expected prices and total, and no promo_code.
    expect(api.postTicketCheckout).toHaveBeenCalledTimes(1);
    expect(api.postTicketCheckout.mock.calls[0][0]).toEqual({
      buyer_email: 'me@x.co',
      success_url: `${LIVE}/tickets/thanks`,
      cancel_url: `${LIVE}/event/e1?tickets=cancelled`,
      lines: [
        { ticket_type_id: 'a', quantity: 2, expected_unit_price_pence: 1000 },
        { ticket_type_id: 'b', quantity: 1, expected_unit_price_pence: 1500 },
      ],
      expected_total_pence: 3500,
    });
    expect(Object.keys(api.postTicketCheckout.mock.calls[0][0])).not.toContain('promo_code');
  });
  it('code send rate limit shows the wait message', async () => {
    sb.signInWithOtp.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate' } });
    live();
    mount();
    await screen.findByText('Full Experience');
    add('Full Experience'); tick();
    fireEvent.click(screen.getByTestId('picker-continue'));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'me@x.co' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' }).pop()!);
    expect(await screen.findByText('Too many codes were asked for. Wait a minute, then try again.')).toBeTruthy();
  });
  it('price_changed: re-reads prices, shows the new total, the confirm tap sends it', async () => {
    auth.user = { email: 'in@x.co' };
    live();
    api.postTicketCheckout
      .mockResolvedValueOnce({ kind: 'error', reason: 'price_changed', message: null, raw: { reason: 'price_changed', new_total_pence: 3200, lines: [{ line: 0, ticket_type_id: 'b', new_unit_price_pence: 1600 }] } })
      .mockResolvedValueOnce({ kind: 'redirect', url: 'https://checkout.stripe.com/y', orderId: '11111111-1111-4111-8111-111111111111' });
    mount();
    await screen.findByText('Full Experience');
    add('Full Experience'); add('Full Experience'); tick();
    fireEvent.click(screen.getByTestId('picker-continue'));
    expect((await screen.findByTestId('picker-refusal')).textContent).toMatch(/New total: £32/);
    expect(screen.getByTestId('picker-total').textContent).toBe('£32');
    expect(screen.getByTestId('picker-continue').textContent).toBe('Price changed, confirm');
    await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('picker-continue'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/y'));
    const second = api.postTicketCheckout.mock.calls[1][0];
    expect(second.lines).toEqual([{ ticket_type_id: 'b', quantity: 2, expected_unit_price_pence: 1600 }]);
    expect(second.expected_total_pence).toBe(3200);
  });
  it('whole-order cap: + stops at 20 tickets with a calm note', async () => {
    live();
    mount();
    await screen.findByText('Full Experience');
    for (let i = 0; i < 15; i++) add('1 Class + Latin Party');
    for (let i = 0; i < 9; i++) add('Full Experience');
    expect(screen.getByTestId('picker-count').textContent).toBe('20 tickets');
    expect((screen.getByRole('button', { name: 'Add one Full Experience' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Add one 1 Class + Latin Party' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('picker-cap').textContent).toBe('20 tickets is the most for one order.');
  });
  it('a preview origin refuses before any email is asked', async () => {
    live('https://bachata-website-git-x.vercel.app');
    mount();
    await screen.findByText('Full Experience');
    add('Full Experience'); tick();
    expect((screen.getByTestId('picker-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('picker-blocked').textContent).toMatch(/not on this preview/);
    fireEvent.click(screen.getByTestId('picker-continue'));
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });
  it('signed in: no code step', async () => {
    auth.user = { email: 'in@x.co' };
    live();
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'sold_out', message: null });
    mount();
    await screen.findByText('Full Experience');
    add('1 Class + Latin Party'); tick();
    fireEvent.click(screen.getByTestId('picker-continue'));
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalled());
    expect(api.postTicketCheckout.mock.calls[0][0].buyer_email).toBe('in@x.co');
    expect(sb.signInWithOtp).not.toHaveBeenCalled();
    await screen.findByTestId('picker-refusal');
    // A stock refusal means the list is stale: it is read again.
    await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalledTimes(2));
  });
  it('cancel return keeps the basket and shows the note', async () => {
    sessionStorage.setItem('bc.pickerBasket.e1.', JSON.stringify({ b: 2 }));
    mount('?tickets=cancelled');
    await screen.findByText('Full Experience');
    expect(screen.getByTestId('picker-cancelled').textContent).toBe('Payment cancelled. You weren\u2019t charged.');
    expect(screen.getByTestId('picker-count').textContent).toBe('2 tickets');
  });
});
