// @vitest-environment jsdom
/**
 * Block-level guard (follow-up to #1372): TicketsBlock must render the line under the promo
 * field through promoNoteText. The helper is unit-tested elsewhere; this mounts the block
 * with a refusing ticket_promo_preview_v1 and reads the text the buyer sees, so a revert to
 * the old inline join of note + applyBlocked (a repeated sentence) fails here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
import type { PublicTicketType } from '../ticketCheckoutModel';
import { PROMO_REASON_COPY } from '../promo';

const NOW = new Date('2026-11-04T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const TYPE: PublicTicketType = {
  id: 'a', occurrenceId: null, name: 'Type a', pricePence: 1250, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null,
};
const NO = (reason: string) => ({ data: { ok: false, reason, unit_price: 1250, discount: 0, total: 1250 }, error: null });

function renderBlock() {
  api.fetchPublicTicketTypes.mockResolvedValue([TYPE]);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/e1']}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={null} organiserId="org1" now={NOW} origin={PROD} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const field = () => screen.getByLabelText('Promo code (optional)') as HTMLInputElement;
const applyBtn = () => screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement;
const noteText = () => screen.getByTestId('promo-note').textContent ?? '';
const occurrences = (s: string, sub: string) => s.split(sub).length - 1;

afterEach(() => {
  cleanup();
  rpc.mockReset();
  api.postTicketCheckout.mockReset();
  api.fetchPublicTicketTypes.mockReset();
});

const NON_RETRYABLE = [
  'unknown_code', 'inactive', 'expired', 'used_up', 'not_for_this_event', 'no_discount', 'below_minimum', 'not_found', 'invalid_quantity',
];
const RETRYABLE = ['rate_limited', 'network', 'timeout', 'internal_error'];
const SECOND_SENTENCE = 'Change the code to try again.';

describe('TicketsBlock renders the promo note through promoNoteText', () => {
  it.each([...NON_RETRYABLE, ...RETRYABLE])('refused %s: the note appears exactly once, Apply state matches', async (reason) => {
    rpc.mockResolvedValue(NO(reason));
    renderBlock();
    await screen.findByLabelText('Promo code (optional)');
    fireEvent.change(field(), { target: { value: 'wrong' } });
    fireEvent.click(applyBtn());
    const want = PROMO_REASON_COPY[reason] ?? 'That code could not be checked. Try again, or remove it to pay the full price.';
    await waitFor(() => expect(noteText()).toBe(want));
    expect(occurrences(noteText(), want)).toBe(1);
    expect(noteText()).not.toContain(SECOND_SENTENCE);
    expect(applyBtn().disabled).toBe(NON_RETRYABLE.includes(reason));
  });

  it('empty field, Apply tapped: the empty-code note once, Apply still tappable', async () => {
    renderBlock();
    await screen.findByLabelText('Promo code (optional)');
    fireEvent.click(applyBtn());
    await waitFor(() => expect(noteText()).toBe(PROMO_REASON_COPY.empty));
    expect(noteText()).not.toContain(SECOND_SENTENCE);
    expect(applyBtn().disabled).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
