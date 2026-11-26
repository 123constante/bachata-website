// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: null as null | { email: string } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn(), getSession: async () => ({ data: { session: null } }) }, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: auth.user ? 'signed_in' : 'signed_out' }) }));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn(), previewPromo: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketPickerB1 } from '../TicketPickerB1';
import type { PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-11-04T12:00:00Z');
const mk = (id: string, name: string, pricePence: number, extra: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name, pricePence, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...extra,
});
const OPEN = mk('a', 'Early Pass', 800, { regularPricePence: 1000, earlyState: 'open', earlyLeft: 2 });
const SOLD = mk('b', 'Full Pass', 1500, { regularPricePence: 1500, earlyState: 'sold_out', earlyLeft: 0 });
const PLAIN = mk('c', 'Plain Pass', 500);
const TYPES = [OPEN, SOLD, PLAIN];

function mount(earlyBird: boolean, types: PublicTicketType[] = TYPES) {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/e1']}>
        <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco" dateLine="Wed 18 Nov, 9pm" onClose={() => {}} now={NOW} earlyBird={earlyBird} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const add = (n: string) => fireEvent.click(screen.getByRole('button', { name: `Add one ${n}` }));
const row = (name: string) => screen.getByText(name).closest('[data-testid="picker-row"]') as HTMLElement;

beforeEach(() => { sessionStorage.clear(); auth.user = null; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Object.values(api).forEach((f) => f.mockReset()); });

describe('picker early bird rows', () => {
  it.each([
    ['flag off: open row is as today', false, 'Early Pass', { strike: false, early: false, sold: false }],
    ['flag off: sold_out row is as today', false, 'Full Pass', { strike: false, early: false, sold: false }],
    ['flag on: open row', true, 'Early Pass', { strike: true, early: true, sold: false }],
    ['flag on: sold_out row', true, 'Full Pass', { strike: false, early: false, sold: true }],
    ['flag on: null row', true, 'Plain Pass', { strike: false, early: false, sold: false }],
  ])('%s', async (_n, on, name, want) => {
    mount(on as boolean);
    await screen.findByText(name as string);
    const r = within(row(name as string));
    expect(!!r.queryByTestId('picker-regular-price')).toBe(want.strike);
    expect(!!r.queryByTestId('picker-early-line')).toBe(want.early);
    expect(!!r.queryByTestId('picker-early-soldout')).toBe(want.sold);
  });
  it('open row: regular struck, early price orange, line text', async () => {
    mount(true);
    await screen.findByText('Early Pass');
    const r = within(row('Early Pass'));
    expect(r.getByTestId('picker-regular-price').textContent).toBe('£10');
    expect(r.getByTestId('picker-early-line').textContent).toBe('Early bird price');
    expect(r.getByText('£8').getAttribute('style')).toMatch(/#c2410c|194, 65, 12/);
  });
  it('flag off: no save line even with early data', async () => {
    mount(false);
    await screen.findByText('Early Pass');
    add('Early Pass');
    expect(screen.queryByTestId('picker-early-save')).toBeNull();
  });
});

describe('picker early bird stepper and save line', () => {
  it('stepper stops at earlyLeft', async () => {
    mount(true);
    await screen.findByText('Early Pass');
    add('Early Pass'); add('Early Pass');
    expect((screen.getByRole('button', { name: 'Add one Early Pass' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('Early Pass count').textContent).toBe('2');
  });
  it('save line: none at 0, sums early lines only in a mixed basket', async () => {
    mount(true);
    await screen.findByText('Early Pass');
    expect(screen.queryByTestId('picker-early-save')).toBeNull();
    add('Plain Pass');
    expect(screen.queryByTestId('picker-early-save')).toBeNull();
    add('Early Pass'); add('Early Pass');
    expect(screen.getByTestId('picker-early-save').textContent).toBe('You save £4.00');
  });
  it('save line still shows with a promo applied', async () => {
    auth.user = { email: 'me@x.co' };
    api.previewPromo.mockResolvedValue({ ok: true, discountPence: 100, totalPence: 700, reason: '' });
    mount(true);
    await screen.findByText('Early Pass');
    add('Early Pass');
    fireEvent.change(screen.getByLabelText('Promo code'), { target: { value: 'save' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await screen.findByTestId('picker-promo-stub');
    expect(screen.getByTestId('picker-early-save').textContent).toBe('You save £2.00');
  });
});

describe('picker early_bird_limit reply', () => {
  const RAN_OUT = 'Early bird tickets just ran out. Check the new price and tap Continue again.';
  const go = async (on: boolean) => {
    auth.user = { email: 'me@x.co' };
    vi.stubGlobal('location', { ...window.location, assign: vi.fn(), origin: 'https://bachatacalendar.co.uk' });
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'early_bird_limit', message: null });
    mount(on);
    await screen.findByText('Early Pass');
    add('Early Pass');
    api.fetchPublicTicketTypes.mockClear();
    fireEvent.click(screen.getByTestId('picker-continue'));
  };
  it('flag on: refusal copy and a re-read', async () => {
    await go(true);
    expect((await screen.findByTestId('picker-refusal')).textContent).toBe(RAN_OUT);
    await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalled());
  });
  it('flag off: today\'s copy', async () => {
    await go(false);
    expect((await screen.findByTestId('picker-refusal')).textContent).toBe('Your tickets could not be booked. You have not been charged. Try again.');
  });
});
