// @vitest-environment jsdom
/**
 * Owner order 2026-10-29: no booking fee before go-live. With the REAL shared constant (no
 * mock), every buyer shape pays the ticket price only: no fee line, no "50p", no fee words in
 * the totals or the terms, and Total == subtotal. bookingFee.shared.test.tsx keeps proving a
 * non-zero fee still renders (mocked to 75p).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketsBlock } from '../TicketsBlock';
import { BOOKING_FEE_PENCE, formatPence, totals, type PublicTicketType } from '../ticketCheckoutModel';
import { TERMS_OF_SALE } from '../legalCopy';

const NOW = new Date('2026-10-27T12:00:00Z');
const FEE_WORDS = /50p|booking fee|fee per ticket|includes a fee|\bfee\b/i;
const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});

function renderBlock(types: PublicTicketType[]) {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/e1']}>
        <TicketsBlock seriesId="e1" occurrenceId="n1" organiserId="org1" now={NOW} origin="https://www.bachatacalendar.co.uk" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the shared fee is zero', () => {
  it('BOOKING_FEE_PENCE is 0', () => expect(BOOKING_FEE_PENCE).toBe(0));
});

describe('totals x every price shape: total == subtotal, fee 0', () => {
  const prices = [0, 1, 99, 1000, 1250, 202250];
  const quantities = [1, 2, 5, 20];
  for (const p of prices) for (const q of quantities) {
    it(`${p}p x ${q}`, () => {
      const s = totals(mk('a', { pricePence: p }), q);
      expect(s.feePence).toBe(0);
      expect(s.totalPence).toBe(s.subtotalPence);
      expect(s.totalPence).toBe(p * q);
    });
  }
});

describe('buyer checkout x shape: no fee line, Total is the ticket price', () => {
  const shapes: [string, PublicTicketType[], number, number][] = [
    // [name, types, price of the picked type, quantity]
    ['paid, quantity 1', [mk('a', { pricePence: 1250 })], 1250, 1],
    ['paid, quantity 2', [mk('a', { pricePence: 1250 })], 1250, 2],
    ['paid, many (20)', [mk('a', { pricePence: 1000 })], 1000, 20],
    ['paid, only 3 left (stepper capped)', [mk('a', { pricePence: 1500, remaining: 3 })], 1500, 3],
    ['free', [mk('a', { pricePence: 0 })], 0, 2],
    ['mixed: free sold out + paid on sale', [mk('f', { pricePence: 0, status: 'sold_out', remaining: 0 }), mk('a', { pricePence: 800 })], 800, 2],
  ];
  for (const [name, types, price, qty] of shapes) {
    it(name, async () => {
      renderBlock(types);
      await screen.findByRole('button', { name: price ? 'Buy tickets' : 'Get free ticket' });
      for (let i = 1; i < qty; i++) fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
      await waitFor(() => expect(screen.getByTestId('ticket-qty').textContent).toBe(String(qty)));
      const box = screen.getByTestId('ticket-totals');
      const text = box.textContent ?? '';
      expect(text).not.toMatch(FEE_WORDS);
      // Exactly two lines: the tickets and the Total.
      expect(box.querySelectorAll('dt')).toHaveLength(2);
      const want = price === 0 ? 'Free' : formatPence(price * qty);
      expect(text).toBe(`${qty} \u00d7 ${types.find((t) => t.pricePence === price)!.name}${want}Total${want}`);
      // Nothing else on the block names a fee either.
      expect(screen.getByTestId('tickets-block').textContent ?? '').not.toMatch(FEE_WORDS);
    });
  }
  it('sold out only: no totals, no fee words', async () => {
    renderBlock([mk('a', { status: 'sold_out', remaining: 0 })]);
    await screen.findByText(/No tickets can be bought right now/);
    expect(screen.queryByTestId('ticket-totals')).toBeNull();
    expect(screen.getByTestId('tickets-block').textContent ?? '').not.toMatch(FEE_WORDS);
  });
});

describe('terms of sale at a zero fee', () => {
  it('no fee sentence and the refund sentence names no fee', () => {
    const all = TERMS_OF_SALE.join(' ');
    expect(all).not.toMatch(FEE_WORDS);
    expect(all).toMatch(/Refunds are up to the organiser\./);
  });
  it('the opened terms on the block say no fee', async () => {
    renderBlock([mk('a')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Read the terms of sale' }));
    expect(screen.getByTestId('terms-text').textContent ?? '').not.toMatch(FEE_WORDS);
  });
});
