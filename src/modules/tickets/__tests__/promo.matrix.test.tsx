// @vitest-environment jsdom
/**
 * Ticket promo codes, buyer half (docs/briefs/ticket-promo-codes-web.md). One shared mapping
 * (promo.ts promoView + PROMO_REASON_COPY) read by the block; this file is the state table:
 * no code, valid percent, valid fixed, free result, every refusal reason, rate_limited,
 * offline, slow / double tap, `?code=` pre-fill, a checkout 409, and an untouched form.
 * The fakes model the edge's promo_code contract (prod may still run the older edge).
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
import { buildCheckoutBody, type PublicTicketType } from '../ticketCheckoutModel';
import { previewPromo } from '../ticketCheckoutApi';
import {
  CODE_REASONS,
  PROMO_REASON_COPY,
  codeFromSearch,
  isCodeReason,
  parsePromoPreview,
  promoKey,
  promoReasonCopy,
  promoView,
  type PromoState,
} from '../promo';

const NOW = new Date('2026-11-04T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const ORDER = '3f2a9c10-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1250, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});
const K = promoKey('a', 1);
const OK = (discount: number, total: number) => ({ data: { ok: true, unit_price: 1250, discount, total }, error: null });
const NO = (reason: string) => ({ data: { ok: false, reason, unit_price: 1250, discount: 0, total: 1250 }, error: null });

function renderBlock(types: PublicTicketType[], path = '/event/e1') {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={null} organiserId="org1" now={NOW} origin={PROD} />} />
          <Route path="/tickets/thanks" element={<p data-testid="thanks">thanks</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const field = () => screen.getByLabelText('Promo code (optional)') as HTMLInputElement;
const note = () => screen.queryByTestId('promo-note')?.textContent ?? '';
const total = () => screen.getByTestId('ticket-totals').textContent ?? '';
function fill() {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('checkbox'));
}
async function typeAndApply(code: string) {
  await screen.findByLabelText('Promo code (optional)');
  fireEvent.change(field(), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  rpc.mockReset();
  api.postTicketCheckout.mockReset();
});

describe('the shared mapping: every state names what the buyer can do next', () => {
  // [label, state, input, want note, Apply blocked?, Buy blocked?, code sent]
  const rows: [string, PromoState, string, RegExp | null, boolean, boolean, string | null][] = [
    ['no code', { status: 'idle' }, '', null, false, false, null],
    ['typed, not applied', { status: 'idle' }, 'save10', null, false, true, null],
    ['empty Apply tap', { status: 'refused', code: '', key: null, reason: 'empty' }, '', /Type a code first/, false, false, null],
    ['checking (slow)', { status: 'checking', code: 'SAVE10' }, 'SAVE10', /Checking the code/, true, true, null],
    ['valid percent', { status: 'applied', code: 'SAVE10', key: K, discountPence: 125, totalPence: 1125 }, 'save10', /applied\. You save \u00a31\.25/, true, false, 'SAVE10'],
    ['valid fixed, under a pound', { status: 'applied', code: 'TAKE50', key: K, discountPence: 50, totalPence: 1200 }, 'TAKE50', /You save 50p/, true, false, 'TAKE50'],
    ['free result', { status: 'applied', code: 'ALLFREE', key: K, discountPence: 1250, totalPence: 0 }, 'ALLFREE', /Your tickets are free/, true, false, 'ALLFREE'],
    ['applied, then the count changed', { status: 'applied', code: 'SAVE10', key: promoKey('a', 2), discountPence: 250, totalPence: 2250 }, 'SAVE10', /Tap Apply to update/, false, true, null],
    ['applied, then the field edited', { status: 'applied', code: 'SAVE10', key: K, discountPence: 125, totalPence: 1125 }, 'SAVE1', null, false, true, null],
    ...[...CODE_REASONS, 'rate_limited', 'network', 'timeout', 'not_found', 'invalid_quantity'].map(
      (reason): [string, PromoState, string, RegExp | null, boolean, boolean, string | null] => [
        `refused: ${reason}`,
        { status: 'refused', code: 'BAD', key: K, reason },
        'bad',
        new RegExp(PROMO_REASON_COPY[reason].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        !['rate_limited', 'network', 'timeout'].includes(reason),
        true,
        null,
      ],
    ),
  ];
  it.each(rows)('%s', (_l, state, input, wantNote, applyBlocked, buyBlocked, sent) => {
    const v = promoView(state, input, K);
    if (wantNote) expect(v.note).toMatch(wantNote);
    else expect(v.note).toBeNull();
    expect(v.applyBlocked !== null).toBe(applyBlocked);
    expect(v.buyBlocked !== null).toBe(buyBlocked);
    expect(v.sendCode).toBe(sent);
    // A blocked Buy always says why, and the way forward names a control that is on screen.
    if (v.buyBlocked) expect(v.buyBlocked).toMatch(/Apply|Remove the promo code|Wait/);
    if (v.applyBlocked) expect(v.applyBlocked.length).toBeGreaterThan(5);
  });
  it('a refusal for another ticket or count re-opens Apply', () => {
    const v = promoView({ status: 'refused', code: 'BAD', key: promoKey('b', 1), reason: 'expired' }, 'BAD', K);
    expect(v.applyBlocked).toBeNull();
    expect(v.note).toBeNull();
  });
  it('copy: the owner table word for word, British English, ASCII apostrophes only', () => {
    expect(PROMO_REASON_COPY.not_for_this_event).toBe("That code isn't valid for this event.");
    expect(PROMO_REASON_COPY.below_minimum).toMatch(/under 30p.*contact the organiser/);
    for (const t of Object.values(PROMO_REASON_COPY)) expect(t).not.toMatch(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u00c2\u00e2]/);
  });
  it.each(['', 'zzz', 'toString', '__proto__'])('unmapped %j -> the safe generic', (r) => {
    expect(promoReasonCopy(r)).toMatch(/could not be checked.*remove it to pay the full price/);
  });
  it('code reasons are exactly the seven code refusals (rate_limited stays the checkout copy)', () => {
    expect(CODE_REASONS.every(isCodeReason)).toBe(true);
    expect(isCodeReason('rate_limited')).toBe(false);
    expect(isCodeReason('sold_out')).toBe(false);
  });
});

describe('wire shapes', () => {
  it.each<[string, unknown, object]>([
    ['valid', { ok: true, unit_price: 1250, discount: 125, total: 1125 }, { ok: true, discountPence: 125, totalPence: 1125 }],
    ['free', { ok: true, unit_price: 1250, discount: 1250, total: 0 }, { ok: true, totalPence: 0 }],
    ['refusal', { ok: false, reason: 'expired', unit_price: 1250, discount: 0, total: 1250 }, { ok: false, reason: 'expired' }],
    ['rate limited, nulls', { ok: false, reason: 'rate_limited', unit_price: null, discount: 0, total: null }, { ok: false, reason: 'rate_limited' }],
    ['ok without numbers', { ok: true }, { ok: false, reason: 'internal_error' }],
    ['null', null, { ok: false, reason: 'internal_error' }],
  ])('%s', (_l, data, want) => expect(parsePromoPreview(data)).toMatchObject(want));
  it('previewPromo sends the documented args; an rpc error or a throw reads as offline', async () => {
    rpc.mockResolvedValueOnce(OK(125, 1125));
    expect(await previewPromo('e1', 'a', 2, 'SAVE10')).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith('ticket_promo_preview_v1', { p_series: 'e1', p_ticket_type: 'a', p_quantity: 2, p_code: 'SAVE10' });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    expect(await previewPromo('e1', 'a', 1, 'X')).toMatchObject({ ok: false, reason: 'network' });
    rpc.mockRejectedValueOnce(new TypeError('offline'));
    expect(await previewPromo('e1', 'a', 1, 'X')).toMatchObject({ ok: false, reason: 'network' });
  });
  it('checkout body: promo_code only when a code is sent (untouched sends nothing)', () => {
    const f = { typeId: 'a', quantity: 1, email: 'a@b.co', name: '' };
    expect(buildCheckoutBody(f, PROD, '/event/e1')).not.toHaveProperty('promo_code');
    expect(buildCheckoutBody({ ...f, promoCode: null }, PROD, '/event/e1')).not.toHaveProperty('promo_code');
    expect(buildCheckoutBody({ ...f, promoCode: 'SAVE10' }, PROD, '/event/e1').promo_code).toBe('SAVE10');
  });
  it.each<[string, string]>([
    ['?code=save10', 'SAVE10'], ['?occurrenceId=n1&code=%20vip-2026%20', 'VIP-2026'], ['', ''], ['?code=', ''], [`?code=${'A'.repeat(80)}`, 'A'.repeat(64)],
  ])('?code= %j pre-fills %j', (search, want) => expect(codeFromSearch(search)).toBe(want));
});

describe('the block, end to end with a faked preview and edge', () => {
  it('no code: no preview call, checkout body has no promo_code', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'stale', message: null });
    renderBlock([mk('a')]);
    await screen.findByLabelText('Promo code (optional)');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
    expect(api.postTicketCheckout.mock.calls[0][0]).not.toHaveProperty('promo_code');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('?code= pre-fills the field but never applies on its own; Buy says to tap Apply', async () => {
    renderBlock([mk('a')], '/event/e1?code=summer');
    await screen.findByLabelText('Promo code (optional)');
    expect(field().value).toBe('SUMMER');
    fill();
    expect(rpc).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Buy tickets' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Tap Apply to check your promo code, or clear it/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Clear the code and pay the full price/ })).toBeTruthy();
  });

  it('valid percent: saving line, new total, checkout sends the code', async () => {
    rpc.mockResolvedValue(OK(125, 1125));
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'stale', message: null });
    renderBlock([mk('a')]);
    await typeAndApply('save10');
    await screen.findByTestId('promo-saving');
    expect(total()).toContain('Total\u00a311.25');
    expect(note()).toMatch(/Code SAVE10 applied\. You save \u00a31\.25/);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalledTimes(1));
    expect(api.postTicketCheckout.mock.calls[0][0].promo_code).toBe('SAVE10');
  });

  it('free result: Get free tickets, the free order goes to the free thank-you end state', async () => {
    rpc.mockResolvedValue(OK(1250, 0));
    api.postTicketCheckout.mockResolvedValue({ kind: 'free', orderId: ORDER });
    renderBlock([mk('a')]);
    await typeAndApply('ALLFREE');
    await screen.findByRole('button', { name: 'Get free tickets' });
    expect(total()).toContain('TotalFree');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Get free tickets' }));
    await screen.findByTestId('thanks');
  });

  it.each([...CODE_REASONS, 'rate_limited'])('refused %s: the specific copy, Buy held with a reason, the code kept in the field', async (reason) => {
    rpc.mockResolvedValue(NO(reason));
    renderBlock([mk('a')]);
    await typeAndApply('wrong');
    await waitFor(() => expect(note()).toContain(PROMO_REASON_COPY[reason]));
    expect(field().value).toBe('WRONG');
    fill();
    expect((screen.getByRole('button', { name: 'Buy tickets' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Remove the promo code or try a different one.')).toBeTruthy();
    // The way forward: clear it and buy at full price.
    fireEvent.click(screen.getByRole('button', { name: /Clear the code/ }));
    expect((screen.getByRole('button', { name: 'Buy tickets' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('offline: check your connection, Apply can be tapped again', async () => {
    rpc.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(OK(125, 1125));
    renderBlock([mk('a')]);
    await typeAndApply('save10');
    await waitFor(() => expect(note()).toContain(PROMO_REASON_COPY.network));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await screen.findByTestId('promo-saving');
  });

  it('slow + double tap: one preview, Apply and Buy held while checking', async () => {
    let release: (v: unknown) => void = () => {};
    rpc.mockReturnValue(new Promise((r) => { release = r; }));
    renderBlock([mk('a')]);
    await typeAndApply('save10');
    const apply = await screen.findByRole('button', { name: /Checking/ });
    fireEvent.click(apply);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fill();
    expect(screen.getByText('Wait while the promo code is checked.')).toBeTruthy();
    release(OK(125, 1125));
    await screen.findByTestId('promo-saving');
  });

  it('Return in the code field applies the code and never submits the purchase', async () => {
    rpc.mockResolvedValue(OK(125, 1125));
    renderBlock([mk('a')]);
    await screen.findByLabelText('Promo code (optional)');
    fill();
    fireEvent.change(field(), { target: { value: 'save10' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    await screen.findByTestId('promo-saving');
    expect(api.postTicketCheckout).not.toHaveBeenCalled();
  });

  it('a new count re-prices an applied code with the new quantity', async () => {
    rpc.mockResolvedValueOnce(OK(125, 1125)).mockResolvedValueOnce(OK(250, 2250));
    renderBlock([mk('a')]);
    await typeAndApply('save10');
    await screen.findByTestId('promo-saving');
    fireEvent.click(screen.getByRole('button', { name: 'One more ticket' }));
    await waitFor(() => expect(total()).toContain('Total\u00a322.50'));
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_quantity: 2, p_code: 'SAVE10' });
  });

  it('checkout 409 with a code reason lands in the code field, not the general alert', async () => {
    rpc.mockResolvedValue(OK(125, 1125));
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'used_up', message: null });
    renderBlock([mk('a')]);
    await typeAndApply('save10');
    await screen.findByTestId('promo-saving');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(note()).toContain(PROMO_REASON_COPY.used_up));
    expect(screen.queryByTestId('promo-saving')).toBeNull();
    expect(screen.getByText('Remove the promo code or try a different one.')).toBeTruthy();
  });

  it('a free ticket shows no promo field (nothing to take off)', async () => {
    renderBlock([mk('a', { pricePence: 0 })]);
    await screen.findByRole('button', { name: 'Get free ticket' });
    expect(screen.queryByLabelText('Promo code (optional)')).toBeNull();
  });
});
