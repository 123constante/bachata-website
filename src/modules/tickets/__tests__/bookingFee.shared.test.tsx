// @vitest-environment jsdom
/**
 * Item 8 of the S4 review fixes: the booking fee is ONE shared constant. Mocking it to
 * 75p must move every client line that names the fee (block total, fee line, terms of
 * sale, organiser preview); a second hard-coded 50p anywhere keeps this red.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/lib/ticketBookingFee', () => ({ BOOKING_FEE_PENCE: 75 }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketsBlock } from '../TicketsBlock';
import { totals, type PublicTicketType } from '../ticketCheckoutModel';
import { TERMS_OF_SALE } from '../legalCopy';
import { buyerRulesLine, buyerTotal } from '@/modules/organiser/tickets/ticketModel';

const mk = (p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id: 'a', occurrenceId: null, name: 'Type a', pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});

afterEach(cleanup);

describe('one booking-fee constant', () => {
  it.each([[1, 75], [2, 150], [20, 1500]])('paid x%s -> fee %s', (q, fee) => {
    expect(totals(mk(), q)).toEqual({ free: false, subtotalPence: 1200 * q, feePence: fee, totalPence: 1200 * q + fee });
  });
  it('free has no fee whatever the constant', () => {
    expect(totals(mk({ pricePence: 0 }), 5).feePence).toBe(0);
  });
  it('terms of sale name the shared fee', () => {
    expect(TERMS_OF_SALE.join(' ')).toMatch(/a booking fee of 75p per ticket\./);
    expect(TERMS_OF_SALE.join(' ')).not.toMatch(/50p/);
  });
  it('organiser preview uses the same fee', () => {
    expect(buyerTotal(1000)).toMatchObject({ feePence: 75, totalPence: 1075, line: '£10.00 ticket + 75p booking fee' });
  });
  it('organiser rules line names the same fee', () => {
    expect(buyerRulesLine()).toBe('Buyers pay a 75p booking fee per paid ticket, up to 20 tickets an order.');
  });
  it('the block fee line and total', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue([mk()]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/event/e1']}>
          <Routes>
            <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={null} organiserId={null} now={new Date('2026-10-27T12:00:00Z')} origin="https://bachatacalendar.co.uk" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('button', { name: 'Buy tickets' });
    fireEvent.click(screen.getByRole('button', { name: 'Read the terms of sale' }));
    expect(screen.getByTestId('ticket-totals').textContent).toBe('1 × Type a£12+ 75p booking fee per ticket£0.75Total£12.75');
    expect(screen.getByTestId('terms-text').textContent).toMatch(/75p per ticket/);
  });
});
