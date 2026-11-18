// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Buyer onboarding slice A, item 5: 'Tickets go to {email}. Not you?' above Continue (flag ON only).
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ get BUYER_ONBOARDING_ENABLED() { return flag.on; } }));
const auth = vi.hoisted(() => ({ user: null as null | { email: string }, signOut: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) }, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, signOut: auth.signOut, authStatus: auth.user ? 'signed_in' : 'signed_out' }) }));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketPickerB1 } from '../TicketPickerB1';
import type { PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-11-04T12:00:00Z');
const TYPE: PublicTicketType = { id: 'a', occurrenceId: null, name: 'Party', pricePence: 1000, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null };

function mount() {
  api.fetchPublicTicketTypes.mockResolvedValue([TYPE]);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/e1']}>
        <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco Loco" dateLine="Wed 18 Nov, 9pm" onClose={() => {}} now={NOW} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); auth.user = null; flag.on = true; auth.signOut.mockResolvedValue('signed-out'); });
afterEach(() => { cleanup(); auth.signOut.mockReset(); api.fetchPublicTicketTypes.mockReset(); });

describe('picker B1 "Not you?" line', () => {
  it.each([
    ['signed in, flag on', true, true, true],
    ['signed in, flag off', true, false, false],
    ['signed out, flag on', false, true, false],
  ])('%s', async (_n, signedIn, on, shown) => {
    auth.user = signedIn ? { email: 'ana@example.com' } : null;
    flag.on = on;
    mount();
    await screen.findByTestId('picker-continue');
    expect(Boolean(screen.queryByTestId('picker-not-you'))).toBe(shown);
    if (shown) expect(screen.getByTestId('picker-not-you').textContent).toBe('Tickets go to ana@example.com.Not you?');
  });

  it('Not you? signs out and opens the email + code card', async () => {
    auth.user = { email: 'ana@example.com' };
    mount();
    fireEvent.click(await screen.findByTestId('picker-not-you-btn'));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText('Email address')).toHaveProperty('value', '');
  });

  it('Not you? keeps the basket (N3)', async () => {
    auth.user = { email: 'ana@example.com' };
    mount();
    fireEvent.click(await screen.findByLabelText('Add one Party'));
    fireEvent.click(screen.getByLabelText('Add one Party'));
    expect(screen.getByLabelText('Party count').textContent).toBe('2');
    fireEvent.click(screen.getByTestId('picker-not-you-btn'));
    await screen.findByLabelText('Email address');
    expect(screen.getByLabelText('Party count').textContent).toBe('2');
    fireEvent.click(screen.getByText('Back to tickets'));
    expect(screen.getByLabelText('Party count').textContent).toBe('2');
  });

  it("sign-out 'failed': plain line, no email card, still the old address (H3)", async () => {
    auth.user = { email: 'ana@example.com' };
    auth.signOut.mockResolvedValue('failed');
    mount();
    fireEvent.click(await screen.findByTestId('picker-not-you-btn'));
    expect((await screen.findByTestId('picker-not-you-error')).textContent).toBe('We could not sign you out. Try again.');
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(screen.getByTestId('picker-not-you').textContent).toBe('Tickets go to ana@example.com.Not you?');
  });

  it('sign-out throws: same plain line (H3)', async () => {
    auth.user = { email: 'ana@example.com' };
    auth.signOut.mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByTestId('picker-not-you-btn'));
    expect((await screen.findByTestId('picker-not-you-error')).textContent).toBe('We could not sign you out. Try again.');
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });

  it('button is disabled while signing out; a second tap starts no second sign-out (H3)', async () => {
    auth.user = { email: 'ana@example.com' };
    let finish: (v: string) => void = () => {};
    auth.signOut.mockReturnValue(new Promise((res) => { finish = res; }));
    mount();
    const btn = await screen.findByTestId('picker-not-you-btn');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveProperty('disabled', true));
    fireEvent.click(btn);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    finish('signed-out');
    expect(await screen.findByLabelText('Email address')).toHaveProperty('value', '');
  });

  it('R2-N3: a failed-sign-out error does not outlive the address it was about', async () => {
    auth.user = { email: 'ana@example.com' };
    auth.signOut.mockResolvedValue('failed');
    const view = mount();
    fireEvent.click(await screen.findByTestId('picker-not-you-btn'));
    await screen.findByTestId('picker-not-you-error');
    // signed out elsewhere / switched account: the stale line must go
    auth.user = null;
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/event/e1']}>
          <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco Loco" dateLine="Wed 18 Nov, 9pm" onClose={() => {}} now={NOW} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByTestId('picker-not-you-error')).toBeNull());
    auth.user = { email: 'bo@example.com' };
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/event/e1']}>
          <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco Loco" dateLine="Wed 18 Nov, 9pm" onClose={() => {}} now={NOW} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('picker-not-you');
    expect(screen.queryByTestId('picker-not-you-error')).toBeNull();
  });

  it('R2-N3: a retry after a failure clears the line before the next attempt', async () => {
    auth.user = { email: 'ana@example.com' };
    auth.signOut.mockResolvedValueOnce('failed').mockResolvedValueOnce('signed-out');
    mount();
    fireEvent.click(await screen.findByTestId('picker-not-you-btn'));
    await screen.findByTestId('picker-not-you-error');
    fireEvent.click(screen.getByTestId('picker-not-you-btn'));
    await screen.findByLabelText('Email address');
    expect(screen.queryByTestId('picker-not-you-error')).toBeNull();
  });
});
