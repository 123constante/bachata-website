// @vitest-environment jsdom
/**
 * T4 buyer (flag ticketPriceSteps): screen x shape matrix asserting the EXACT checkout body,
 * the "Price rises on <date>" card line (Europe/London across a clock change) and the
 * price_changed confirm state. The booking fee is mocked to 50p so the zero-net rule bites.
 * Prod shape 2026-11-12 (read-only): 19 paid types, 0 steps -> "no step" is the real shape;
 * every stepped row is a fixture.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/ticketBookingFee', () => ({ BOOKING_FEE_PENCE: 50 }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc },
}));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => {
  const real = await orig<typeof import('../ticketCheckoutApi')>();
  return { ...real, fetchPublicTicketTypes: api.fetchPublicTicketTypes, postTicketCheckout: api.postTicketCheckout };
});

import { TicketsBlock } from '../TicketsBlock';
import { formatPence, parseCheckoutReply, parsePublicTypes, type PublicTicketType } from '../ticketCheckoutModel';
import { checkoutFee, expectedTotal, parsePriceChanged, stepLine } from '../priceSteps';

const NOW = new Date('2026-10-20T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const T = (over: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id: 'a', occurrenceId: null, name: 'Social', pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null,
  nextPricePence: null, nextPriceAt: null, ...over,
});
const BUYER = {
  buyer_email: 'a@b.co',
  success_url: `${PROD}/tickets/thanks`,
  cancel_url: `${PROD}/event/e1?tickets=cancelled`,
};
const basket = (unit: number, qty: number, total: number, extra: Record<string, unknown> = {}, id = 'a') => ({
  ...BUYER, ...extra, lines: [{ ticket_type_id: id, quantity: qty, expected_unit_price_pence: unit }], expected_total_pence: total,
});

function mount(types: PublicTicketType[], priceSteps = true, search = '') {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/event/e1${search}`]}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={null} organiserId="org1" now={NOW} origin={PROD} priceSteps={priceSteps} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function fill(qty = 1) {
  await screen.findByTestId('ticket-bar');
  for (let i = 1; i < qty; i++) fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('checkbox'));
}
async function applyCode(code: string, discount: number, total: number) {
  rpc.mockResolvedValueOnce({ data: { ok: true, unit_price: 0, discount, total }, error: null });
  fireEvent.change(screen.getByLabelText('Promo code (optional)'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await screen.findByTestId('promo-saving');
}
const submit = () => fireEvent.submit(screen.getByTestId('ticket-bar').closest('form') as HTMLFormElement);
const bodyOf = (n = 0) => api.postTicketCheckout.mock.calls[n][0];
const barTotal = () => screen.getByTestId('ticket-bar-total').textContent;

afterEach(() => {
  cleanup();
  rpc.mockReset();
  api.postTicketCheckout.mockReset();
  api.fetchPublicTicketTypes.mockReset();
});

describe('fee rule and expected total (pure)', () => {
  it.each([
    // unit, qty, discount, total
    [1200, 2, null, 2500],
    [1200, 2, 240, 2260], // 10%: built on the post-discount amount, not the pre-discount sum (mutant: 2500)
    [1200, 2, 2400, 0], // 100%: no fee on net 0 (mutant: 100)
    [500, 1, 800, 0], // fixed code larger than the unit clamps to 0
    [0, 3, null, 0], // free
  ])('unit %i x %i, discount %s -> %i', (unit, qty, disc, total) => {
    expect(expectedTotal(unit, qty, disc)).toBe(total);
  });
  it('fee is 0 on a zero net, per ticket otherwise', () => {
    expect(checkoutFee(0, 4)).toBe(0);
    expect(checkoutFee(1, 4)).toBe(200);
  });
});

describe('ticket_types_public_v3 parse', () => {
  it('v3 row carries the step; v2 row keeps its old shape (no step keys)', () => {
    const v3 = parsePublicTypes([{ id: 'a', status: 'on_sale', price_pence: 1200, next_price_pence: 1500, next_price_at: '2026-10-25T00:30:00Z' }]);
    expect(v3[0]).toMatchObject({ nextPricePence: 1500, nextPriceAt: '2026-10-25T00:30:00Z' });
    const v2 = parsePublicTypes([{ id: 'a', status: 'on_sale', price_pence: 1200 }]);
    expect('nextPricePence' in v2[0]).toBe(false);
    const nulls = parsePublicTypes([{ id: 'a', status: 'on_sale', price_pence: 1200, next_price_pence: null, next_price_at: null }]);
    expect(nulls[0]).toMatchObject({ nextPricePence: null, nextPriceAt: null });
  });
  it('keeps the RPC order (no client re-sort)', () => {
    const rows = parsePublicTypes([
      { id: 'b', status: 'on_sale', price_pence: 900 },
      { id: 'a', status: 'on_sale', price_pence: 1500 },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('step line: en-GB, Europe/London, DST-correct', () => {
  it.each([
    // BST: 23:30Z on 24 Oct is 00:30 on Sun 25 Oct UK time (the night clocks go back)
    ['2026-10-24T23:30:00Z', 1500, 'Price rises on Sun 25 Oct, 00:30'],
    // GMT after the change: 25 Oct 01:30Z is 01:30 UK
    ['2026-10-25T01:30:00Z', 1500, 'Price rises on Sun 25 Oct, 01:30'],
    // spring forward 2027: 29 Mar 2027... 28 Mar 01:30Z = 02:30 BST
    ['2027-03-28T01:30:00Z', 1500, 'Price rises on Sun 28 Mar, 02:30'],
    ['2026-11-01T19:00:00Z', 900, 'Price changes on Sun 1 Nov, 19:00'],
  ])('%s -> %s', (at, next, text) => {
    expect(stepLine(T({ nextPriceAt: at, nextPricePence: next }), NOW)).toBe(text);
  });
  it('no step, a step in the past, or the same price: no line', () => {
    expect(stepLine(T(), NOW)).toBeNull();
    expect(stepLine(T({ nextPriceAt: '2026-10-01T00:00:00Z', nextPricePence: 1500 }), NOW)).toBeNull();
    expect(stepLine(T({ nextPriceAt: '2026-11-01T00:00:00Z', nextPricePence: 1200 }), NOW)).toBeNull();
  });
});

describe('price_changed reply parse', () => {
  it('unit checkpoint lists stale lines; total checkpoint has empty lines', () => {
    const a = { ok: false, reason: 'price_changed', lines: [{ line: 0, ticket_type_id: 'a', new_unit_price_pence: 1500 }], new_total_pence: 1550 };
    const r = parseCheckoutReply(a, 409);
    expect(r).toMatchObject({ kind: 'error', reason: 'price_changed' });
    expect(parsePriceChanged(r.kind === 'error' ? r.raw : null)).toEqual({ lines: [{ line: 0, ticketTypeId: 'a', newUnitPricePence: 1500 }], newTotalPence: 1550 });
    expect(parsePriceChanged({ reason: 'price_changed', lines: [], new_total_pence: 1300 })).toEqual({ lines: [], newTotalPence: 1300 });
    expect(parsePriceChanged({ reason: 'price_changed', lines: [], new_total_pence: '1300' })).toBeNull();
  });
  it('other refusals carry no raw (old shape)', () => {
    expect(parseCheckoutReply({ ok: false, reason: 'sold_out' }, 409)).toEqual({ kind: 'error', reason: 'sold_out', message: null });
  });
});

describe('screen x shape: the exact checkout body', () => {
  const COURSE = T({ id: 'c', name: 'Whole course', kind: 'course', validFrom: '2026-11-02', validTo: '2026-11-30', pricePence: 6000 });
  it.each([
    ['no step (prod shape)', [T()], 2, basket(1200, 2, 2500)],
    ['future step up', [T({ nextPricePence: 1500, nextPriceAt: '2026-10-24T23:30:00Z' })], 1, basket(1200, 1, 1250)],
    ['future step down', [T({ nextPricePence: 900, nextPriceAt: '2026-11-01T19:00:00Z' })], 1, basket(1200, 1, 1250)],
    ['free', [T({ pricePence: 0 })], 3, basket(0, 3, 0)],
    ['course fixture', [COURSE], 1, basket(6000, 1, 6050, {}, 'c')],
  ])('%s', async (_n, types, qty, body) => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'internal_error', message: null });
    mount(types);
    await fill(qty);
    submit();
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toEqual(body);
    expect(Number.isInteger(bodyOf().expected_total_pence)).toBe(true);
  });

  it.each([
    ['promo 10%', 240, 2160, basket(1200, 2, 2260, { promo_code: 'TEN' }), 'TEN'],
    ['promo 100% with a fee: total 0', 2400, 0, basket(1200, 2, 0, { promo_code: 'ALL' }), 'ALL'],
    ['fixed promo larger than the unit', 3000, 0, basket(1200, 2, 0, { promo_code: 'BIG' }), 'BIG'],
  ])('%s', async (_n, discount, total, body, code) => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'internal_error', message: null });
    mount([T()]);
    await fill(2);
    await applyCode(code, discount, total);
    submit();
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toEqual(body);
    // the pay button shows exactly what is sent
    expect(barTotal()).toBe(formatPence(body.expected_total_pence));
  });

  it('flag OFF: the old single body and the v2 read', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'internal_error', message: null });
    mount([T({ nextPricePence: 1500, nextPriceAt: '2026-10-24T23:30:00Z' })], false);
    await fill(2);
    expect(screen.queryByTestId('ticket-step-line')).toBeNull();
    submit();
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
    expect(bodyOf()).toEqual({ ticket_type_id: 'a', quantity: 2, ...BUYER });
    expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', null);
  });

  it('flag ON reads v3', async () => {
    mount([T()]);
    await screen.findByTestId('ticket-bar');
    expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', null, true);
  });
});

describe('card line', () => {
  it('shows "Price rises on" for a step up and "Price changes on" for a step down', async () => {
    mount([
      T({ id: 'a', nextPricePence: 1500, nextPriceAt: '2026-10-24T23:30:00Z' }),
      T({ id: 'b', name: 'Late', pricePence: 1500, nextPricePence: 900, nextPriceAt: '2026-11-01T19:00:00Z' }),
    ]);
    const lines = await screen.findAllByTestId('ticket-step-line');
    expect(lines.map((l) => l.textContent)).toEqual(['Price rises on Sun 25 Oct, 00:30', 'Price changes on Sun 1 Nov, 19:00']);
  });
});

describe('stale page: price_changed then confirm', () => {
  const CHANGED_UNIT = { kind: 'error', reason: 'price_changed', message: null, raw: { ok: false, reason: 'price_changed', lines: [{ line: 0, ticket_type_id: 'a', new_unit_price_pence: 1500 }], new_total_pence: 3100 } };
  const CHANGED_TOTAL = { kind: 'error', reason: 'price_changed', message: null, raw: { ok: false, reason: 'price_changed', lines: [], new_total_pence: 2600 } };

  it.each([
    ['at the unit', CHANGED_UNIT, basket(1500, 2, 3100), '\u00a331'],
    ['at the total (fee drift)', CHANGED_TOTAL, basket(1200, 2, 2600), '\u00a326'],
  ])('%s: nothing charged until the tap; confirm resends the NEW values', async (_n, reply, second, shown) => {
    api.postTicketCheckout.mockResolvedValueOnce(reply).mockResolvedValueOnce({ kind: 'error', reason: 'internal_error', message: null });
    mount([T()]);
    await fill(2);
    submit();
    const alert = await screen.findByText(/The price changed while this page was open/);
    expect(alert.textContent).toBe(`The price changed while this page was open. New total: ${shown}. Check and pay again.`);
    expect(api.postTicketCheckout).toHaveBeenCalledTimes(1);
    expect(barTotal()).toBe(shown);
    const confirm = screen.getByTestId('price-confirm');
    expect(confirm.textContent).toBe('Price changed, confirm');
    fireEvent.click(confirm);
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(2));
    expect(bodyOf(0)).toEqual(basket(1200, 2, 2500));
    expect(bodyOf(1)).toEqual(second);
  });

  it('a refusal after confirm (below_minimum on the code) shows its normal copy', async () => {
    api.postTicketCheckout
      .mockResolvedValueOnce({ kind: 'error', reason: 'price_changed', message: null, raw: { ok: false, reason: 'price_changed', lines: [{ line: 0, ticket_type_id: 'a', new_unit_price_pence: 500 }], new_total_pence: 0 } })
      .mockResolvedValueOnce({ kind: 'error', reason: 'below_minimum', message: null });
    mount([T()]);
    await fill(2);
    await applyCode('BIG', 1000, 1400);
    submit();
    await screen.findByText(/New total: Free/);
    fireEvent.click(screen.getByTestId('price-confirm'));
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(2));
    expect(bodyOf(1)).toEqual(basket(500, 2, 0, { promo_code: 'BIG' }));
    await screen.findByText(/under 30p/);
    expect(screen.queryByTestId('price-confirm')).toBeNull();
  });

  it('changing the count drops the confirm state (no stale confirm)', async () => {
    api.postTicketCheckout.mockResolvedValueOnce(CHANGED_UNIT);
    mount([T()]);
    await fill(2);
    submit();
    await screen.findByTestId('price-confirm');
    fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
    expect(screen.queryByTestId('price-confirm')).toBeNull();
    expect(screen.queryByText(/The price changed/)).toBeNull();
  });
});

describe('old tab after T2b', () => {
  it('expected_price_required: reload copy with a Reload page control', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'expected_price_required', message: null });
    mount([T()]);
    await fill(1);
    submit();
    await screen.findByText('Please reload the page and try again.');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  });
});

describe('review fixes', () => {
  it('an unreadable price_changed is never silent: generic retry copy, list re-read', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'price_changed', message: null, raw: { ok: false, reason: 'price_changed' } });
    mount([T()]);
    await fill(1);
    submit();
    await screen.findByText(/could not be booked/);
    expect(screen.queryByTestId('price-confirm')).toBeNull();
    await waitFor(() => expect(api.fetchPublicTicketTypes.mock.calls.length).toBeGreaterThan(1));
  });
  it('changing the count and back does not revive the old confirm', async () => {
    api.postTicketCheckout.mockResolvedValueOnce({ kind: 'error', reason: 'price_changed', message: null, raw: { ok: false, reason: 'price_changed', lines: [], new_total_pence: 2600 } });
    mount([T()]);
    await fill(2);
    submit();
    await screen.findByTestId('price-confirm');
    fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'One fewer ticket' }));
    expect(screen.queryByTestId('price-confirm')).toBeNull();
    expect(barTotal()).toBe(formatPence(2500));
  });
});
