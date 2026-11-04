// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  GATE_PROMO,
  STILL_SAVING,
  switchedText,
  LOCKED_WHY,
  NETWORK,
  REASON_COPY,
  STATE_NEXT,
  STATE_TAG,
  discountWords,
  expiryLine,
  formOf,
  patchOf,
  stateOf,
  usesLine,
  validate,
  type PromoCode,
  type PromoState,
} from '../promo/promoModel';
import { parseList } from '../promo/promoApi';

/*
 * Promo codes x every state (brief ticket-promo-codes-organiser, state table). ONE mapping
 * (promoModel.ts) feeds every line asserted here. Every state names what the person can do;
 * every disabled control says why; an untouched save sends no command.
 */

const api = vi.hoisted(() => ({ list: null as unknown, createPromo: vi.fn(), updatePromo: vi.fn() }));
vi.mock('../promo/promoApi', async (orig) => ({
  ...(await orig<typeof import('../promo/promoApi')>()),
  usePromoCodes: () => api.list,
  createPromo: api.createPromo,
  updatePromo: api.updatePromo,
}));

import PromoSection from '../promo/PromoSection';

const DAY = 86_400_000;
const NOW = new Date();
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const ok = <T,>(data: T) => ({ isPending: false, isError: false, isSuccess: true, data, refetch: vi.fn() });

const code = (id: string, over: Partial<PromoCode> = {}): PromoCode => ({
  id,
  code: `CODE${id.toUpperCase()}`,
  kind: 'percent',
  value: 10,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  active: true,
  createdAt: '2026-11-01T10:00:00Z',
  paidOrders: 0,
  ...over,
});
const rows = (r: PromoCode[]) => ok({ ok: true, reason: null, rows: r });

const say = vi.fn();
const alertFn = vi.fn();
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PromoSection organiserId="org-1" seriesId="ser-1" onSay={say} onAlert={alertFn} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.createPromo.mockReset();
  api.updatePromo.mockReset();
  say.mockReset();
  alertFn.mockReset();
});
afterEach(cleanup);

// ---- the shared mapping ------------------------------------------------------------------

describe('one mapping: state x shape', () => {
  const SHAPES: Array<[string, PromoCode, PromoState, string, string]> = [
    ['percent, unlimited, no expiry', code('a'), 'on', '10% off each ticket \u00B7 Used on 0 orders, no limit', 'No end date'],
    ['fixed, limited', code('b', { kind: 'fixed', value: 250, maxUses: 10, usedCount: 3, paidOrders: 2 }), 'on', '\u00A32.50 off each ticket \u00B7 Used on 3 of 10 orders', '2 paid orders'],
    ['future expiry', code('c', { expiresAt: iso(3 * DAY) }), 'on', '10% off each ticket', 'Ends '],
    ['past expiry', code('d', { expiresAt: iso(-DAY) }), 'expired', '10% off each ticket', 'Ended '],
    ['used up', code('e', { maxUses: 2, usedCount: 2, paidOrders: 2 }), 'used_up', 'Used on 2 of 2 orders', '2 paid orders'],
    ['turned off', code('f', { active: false }), 'off', '10% off each ticket', 'No end date'],
    ['turned off beats ended', code('g', { active: false, expiresAt: iso(-DAY) }), 'off', '10% off', 'Ended '],
  ];
  it.each(SHAPES)('%s', (_n, c, state, line, line2) => {
    expect(stateOf(c, NOW)).toBe(state);
    api.list = rows([c]);
    mount();
    const row = screen.getByTestId(`promo-row-${c.id}`);
    expect(row.getAttribute('data-state')).toBe(state);
    expect(within(row).getByTestId('promo-state').textContent).toBe(STATE_TAG[state].label);
    expect(within(row).getByTestId('promo-line').textContent).toContain(line);
    expect(within(row).getByTestId('promo-line2').textContent).toContain(line2);
    // every state that stops a buyer says what the organiser can do
    if (STATE_NEXT[state]) expect(within(row).getByTestId('promo-next').textContent).toBe(STATE_NEXT[state]);
    else expect(within(row).queryByTestId('promo-next')).toBeNull();
    expect(within(row).getByTestId('promo-switch').getAttribute('aria-checked')).toBe(String(c.active));
  });

  it('words: percent / fixed, limits, full weekday names', () => {
    expect(discountWords('percent', 100)).toBe('100% off each ticket');
    expect(discountWords('fixed', 1)).toBe('\u00A30.01 off each ticket');
    expect(usesLine({ usedCount: 1, maxUses: null })).toBe('Used on 1 order, no limit');
    expect(usesLine({ usedCount: 0, maxUses: 1 })).toBe('Used on 0 of 1 order');
    expect(expiryLine({ expiresAt: '2026-11-13T23:59:00Z' }, new Date('2026-11-01T00:00:00Z'))).toBe('Ends Friday 13 November, 23:59');
    expect(expiryLine({ expiresAt: '2026-07-01T12:00:00Z' }, new Date('2026-11-01T00:00:00Z'))).toBe('Ended Wednesday 1 July, 13:00');
  });

  it('parseList: a refusal and a server row', () => {
    expect(parseList({ ok: false, reason: 'not_authorised' })).toEqual({ ok: false, reason: 'not_authorised', rows: [] });
    const p = parseList({ ok: true, rows: [{ id: 'x', code: 'A1B', kind: 'fixed', value: 100, max_uses: null, used_count: 2, expires_at: null, active: true, paid_orders: 1 }] });
    expect(p.rows[0]).toMatchObject({ code: 'A1B', kind: 'fixed', value: 100, maxUses: null, usedCount: 2, paidOrders: 1 });
  });
});

describe('list states', () => {
  it('empty: says what to do', () => {
    api.list = rows([]);
    mount();
    expect(screen.getByTestId('promo-empty').textContent).toContain('Tap Add a promo code');
    expect((screen.getByTestId('promo-add') as HTMLButtonElement).disabled).toBe(false);
  });
  it('one code, and many (20)', () => {
    api.list = rows([code('a')]);
    mount();
    expect(screen.getAllByTestId(/^promo-row-/)).toHaveLength(1);
    cleanup();
    api.list = rows(Array.from({ length: 20 }, (_, i) => code(`r${i}`)));
    mount();
    expect(screen.getAllByTestId(/^promo-row-/)).toHaveLength(20);
  });
  it('loading: Add waits', () => {
    api.list = { isPending: true, isError: false, data: undefined, refetch: vi.fn() };
    mount();
    expect(screen.getByTestId('promo-loading')).toBeTruthy();
    expect((screen.getByTestId('promo-add') as HTMLButtonElement).disabled).toBe(true);
  });
  it('could not load: Try again', () => {
    const refetch = vi.fn();
    api.list = { isPending: false, isError: true, data: undefined, refetch };
    mount();
    fireEvent.click(within(screen.getByTestId('promo-error')).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
  it('refused by the server: plain words, Add disabled with a reason', () => {
    api.list = ok({ ok: false, reason: 'not_authorised', rows: [] });
    mount();
    expect(screen.getByTestId('promo-refused').textContent).toBe(REASON_COPY.not_authorised);
    const add = screen.getByTestId('promo-add') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(document.getElementById(add.getAttribute('aria-describedby') as string)?.textContent).toBeTruthy();
  });
});

// ---- create ---------------------------------------------------------------------------------

const openCreate = () => {
  fireEvent.click(screen.getByTestId('promo-add'));
  return screen.getByTestId('promo-sheet');
};
const type = (k: string, v: string) => fireEvent.change(screen.getByTestId(`promo-form-${k}`), { target: { value: v } });
const save = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('promo-save'));
  });
};

describe('create', () => {
  beforeEach(() => {
    api.list = rows([]);
  });

  it('sends the code upper-cased and a fixed amount in pence, then says so', async () => {
    api.createPromo.mockResolvedValue({ ok: true, reason: null });
    mount();
    openCreate();
    type('code', 'early-bird');
    fireEvent.click(screen.getByTestId('promo-kind-fixed'));
    type('amount', '2.50');
    type('maxUses', '25');
    await save();
    expect(api.createPromo).toHaveBeenCalledWith('org-1', 'ser-1', { code: 'EARLY-BIRD', kind: 'fixed', value: 250, maxUses: 25, expiresAt: null });
    expect(say).toHaveBeenCalledWith('EARLY-BIRD is ready. Buyers can type it when they buy.');
    expect(screen.queryByTestId('promo-sheet')).toBeNull();
  });

  it.each([
    ['ab', '10', 'code'],
    ['BAD CODE', '10', 'code'],
    ['GOOD', '0', 'amount'],
    ['GOOD', '101', 'amount'],
    ['GOOD', '7.5', 'amount'],
  ])('client check %s / %s: no command, the field says why', async (c, amount, field) => {
    mount();
    openCreate();
    type('code', c);
    type('amount', amount);
    await save();
    expect(api.createPromo).not.toHaveBeenCalled();
    expect(screen.getByTestId(`promo-err-${field}`).textContent).toBeTruthy();
  });

  it('a past end date is refused before the tap', async () => {
    mount();
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    type('endsAt', '2020-01-01T10:00');
    await save();
    expect(api.createPromo).not.toHaveBeenCalled();
    expect(screen.getByTestId('promo-err-endsAt').textContent).toContain('future');
  });

  it.each(['code_taken', 'invalid_code', 'invalid_value', 'invalid_max_uses', 'invalid_expiry', 'not_authorised', 'series_not_organisers'])(
    'server refuses %s: the sheet stays with plain words',
    async (reason) => {
      api.createPromo.mockResolvedValue({ ok: false, reason });
      mount();
      openCreate();
      type('code', 'GOOD');
      type('amount', '10');
      await save();
      expect(screen.getByTestId('promo-form-error').textContent).toBe(REASON_COPY[reason]);
      expect(screen.getByTestId('promo-sheet')).toBeTruthy();
      expect(say).not.toHaveBeenCalled();
    },
  );

  it('network error: says to check the connection; Save works again', async () => {
    api.createPromo.mockRejectedValue(new Error('Failed to fetch'));
    mount();
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    await save();
    expect(screen.getByTestId('promo-form-error').textContent).toBe(NETWORK);
    expect((screen.getByTestId('promo-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('slow double-tap sends one command', async () => {
    let finish: (v: unknown) => void = () => {};
    api.createPromo.mockReturnValue(new Promise((r) => (finish = r)));
    mount();
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    const btn = screen.getByTestId('promo-save');
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(btn.textContent).toBe('Saving\u2026');
    await act(async () => finish({ ok: true, reason: null }));
    expect(api.createPromo).toHaveBeenCalledTimes(1);
  });
});

// ---- edit / switch --------------------------------------------------------------------------

const openEdit = (id: string) => fireEvent.click(within(screen.getByTestId(`promo-row-${id}`)).getByTestId('promo-edit'));

describe('edit and switch', () => {
  it('an untouched save sends nothing', async () => {
    api.list = rows([code('a', { expiresAt: '2099-01-01T10:00:30.123Z', maxUses: 5 })]);
    mount();
    openEdit('a');
    await save();
    expect(api.updatePromo).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith('Nothing changed, so nothing was saved.');
  });

  it('an ended, used-up code saves its other change (unchanged fields are not errors)', async () => {
    const c = code('a', { expiresAt: iso(-DAY), maxUses: 2, usedCount: 3, paidOrders: 3 });
    expect(validate(formOf(c), c, NOW)).toEqual({});
    api.updatePromo.mockResolvedValue({ ok: true, reason: null });
    api.list = rows([c]);
    mount();
    openEdit('a');
    fireEvent.click(screen.getByTestId('promo-clear-end'));
    await save();
    expect(api.updatePromo).toHaveBeenCalledWith('a', { expires_at: null });
  });

  it('locked after use: discount controls disabled, the reason in words, never sent', async () => {
    const c = code('a', { usedCount: 1, paidOrders: 1 });
    api.updatePromo.mockResolvedValue({ ok: true, reason: null });
    api.list = rows([c]);
    mount();
    openEdit('a');
    expect((screen.getByTestId('promo-form-amount') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('promo-kind-fixed') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('promo-locked').textContent).toBe(LOCKED_WHY);
    type('maxUses', '50');
    await save();
    expect(api.updatePromo).toHaveBeenCalledWith('a', { max_uses: 50 });
    expect(patchOf(c, { ...formOf(c), kind: 'fixed', amount: '1.00' })).toEqual({});
  });

  it('a limit below the orders already made is refused before the tap', async () => {
    api.list = rows([code('a', { usedCount: 4, maxUses: 10 })]);
    mount();
    openEdit('a');
    type('maxUses', '3');
    await save();
    expect(api.updatePromo).not.toHaveBeenCalled();
    expect(screen.getByTestId('promo-err-maxUses').textContent).toContain('4 or more');
  });

  it('unused: discount change sends kind and value only', async () => {
    api.updatePromo.mockResolvedValue({ ok: true, reason: null });
    api.list = rows([code('a')]);
    mount();
    openEdit('a');
    fireEvent.click(screen.getByTestId('promo-kind-fixed'));
    type('amount', '1.00');
    await save();
    expect(api.updatePromo).toHaveBeenCalledWith('a', { kind: 'fixed', value: 100 });
  });

  it.each(['locked_after_use', 'invalid_request', 'not_authorised', 'invalid_max_uses', 'invalid_expiry', 'code_taken'])(
    'update refused %s: plain words in the sheet',
    async (reason) => {
      api.updatePromo.mockResolvedValue({ ok: false, reason });
      api.list = rows([code('a')]);
      mount();
      openEdit('a');
      type('amount', '20');
      await save();
      expect(screen.getByTestId('promo-form-error').textContent).toBe(REASON_COPY[reason]);
    },
  );

  it('switch off sends active:false only, says so; double-tap sends one', async () => {
    let finish: (v: unknown) => void = () => {};
    api.updatePromo.mockReturnValue(new Promise((r) => (finish = r)));
    api.list = rows([code('a')]);
    mount();
    const sw = screen.getByTestId('promo-switch');
    await act(async () => {
      fireEvent.click(sw);
      fireEvent.click(sw);
    });
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish({ ok: true, reason: null }));
    expect(api.updatePromo).toHaveBeenCalledTimes(1);
    expect(api.updatePromo).toHaveBeenCalledWith('a', { active: false });
    expect(say).toHaveBeenCalledWith('CODEA turned off. Buyers cannot use it now.');
  });

  it.each([
    ['code_taken', REASON_COPY.code_taken],
    ['not_authorised', REASON_COPY.not_authorised],
    [null, NETWORK],
  ])('switch on refused (%s): the row says why', async (reason, text) => {
    api.updatePromo.mockResolvedValue({ ok: false, reason });
    api.list = rows([code('a', { active: false })]);
    mount();
    await act(async () => {
      fireEvent.click(screen.getByTestId('promo-switch'));
    });
    expect(api.updatePromo).toHaveBeenCalledWith('a', { active: true });
    expect(screen.getByTestId('promo-row-error').textContent).toBe(text);
  });

  it('switch, network error: the row says to check the connection', async () => {
    api.updatePromo.mockRejectedValue(new Error('Failed to fetch'));
    api.list = rows([code('a')]);
    mount();
    await act(async () => {
      fireEvent.click(screen.getByTestId('promo-switch'));
    });
    expect(screen.getByTestId('promo-row-error').textContent).toBe(NETWORK);
  });
});

describe('review r1 fixes', () => {
  it.each([
    ['off', code('a'), 'CODEA turned off. Buyers cannot use it now.'],
    ['on again', code('a', { active: false }), 'CODEA is on again.'],
    ['on but ended', code('a', { active: false, expiresAt: iso(-DAY) }), `CODEA is on, but buyers still cannot use it. ${STATE_NEXT.expired}`],
    ['on but used up', code('a', { active: false, maxUses: 1, usedCount: 1 }), `CODEA is on, but buyers still cannot use it. ${STATE_NEXT.used_up}`],
  ])('switch toast: %s', (_n, c, text) => expect(switchedText(c, NOW)).toBe(text));

  it('closed mid-save, then the gate refuses: an alert that stays, never silence', async () => {
    let fail: (e: unknown) => void = () => {};
    api.createPromo.mockReturnValue(new Promise((_r, j) => (fail = j)));
    api.list = rows([]);
    mount();
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    await save();
    fireEvent.click(within(screen.getByTestId('promo-sheet')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('promo-sheet')).toBeNull();
    await act(async () => fail({ message: 'onboarding_incomplete: finish onboarding' }));
    expect(alertFn).toHaveBeenCalledWith(`GOOD: not saved. ${GATE_PROMO}`);
  });

  it('closed mid-save and opened again: a second create waits for the first', async () => {
    let finish: (v: unknown) => void = () => {};
    api.createPromo.mockReturnValue(new Promise((r) => (finish = r)));
    api.list = rows([]);
    mount();
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    await save();
    fireEvent.click(within(screen.getByTestId('promo-sheet')).getByRole('button', { name: 'Close' }));
    openCreate();
    type('code', 'GOOD');
    type('amount', '10');
    await save();
    expect(api.createPromo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('promo-form-error').textContent).toBe(STILL_SAVING);
    await act(async () => finish({ ok: true, reason: null }));
    expect(say).toHaveBeenCalledWith('GOOD is ready. Buyers can type it when they buy.');
  });
});
