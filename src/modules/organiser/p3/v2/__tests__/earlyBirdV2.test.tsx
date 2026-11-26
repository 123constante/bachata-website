// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ upsert: vi.fn(), status: vi.fn(), early: vi.fn(), on: { v: true } }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'ticketEarlyBird' ? h.on.v : Reflect.get(t, k)) }) };
});
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setEarlyBird: (c: unknown) => h.early(c),
  fetchManagedTypes: async () => ({ ok: true, types: [] }),
}));
import { EARLY_OFF_FIRST, TicketSheetV2 } from '../TicketSheetV2';
import { earlyBirdOf } from '../../tickets/earlyBird';
import type { ManagedType } from '../../../tickets/priceSteps';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1500, status: 'on_sale' as const };
const row = (o: Partial<ManagedType> = {}): ManagedType => ({ id: 't1', basePricePence: 1500, effectivePricePence: 1500, hasOrders: false, hasPriceSteps: false, steps: [], ...o });
const earlyRow = row({ earlyPricePence: 800, earlyCapacity: 20, earlyTaken: 0, earlyLeft: 20, earlyOpen: true, regularPricePence: 1500 });
const bird = { id: 'st1', effectiveFrom: '2026-12-02T00:00:00Z', pricePence: 1000, isLive: false };
const sheet = (o: Record<string, unknown> = {}) => {
  const onDone = vi.fn(); const onFail = vi.fn(); const onClose = vi.fn();
  render(<TicketSheetV2 organiserId="o1" seriesId="s1" type={type} basePence={1500} steps={[]} managed={row()} oneOff={false} soldMax={0} soldAll={0} pence={0} onClose={onClose} onDone={onDone} onFail={onFail} {...o} />);
  return { onDone, onFail, onClose };
};
const set = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
const done = () => fireEvent.click(screen.getByTestId('t-done'));

beforeEach(() => {
  h.on.v = true;
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 'new1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.early.mockReset().mockResolvedValue({ ok: true, reason: null });
});
afterEach(cleanup);

describe('switch visibility', () => {
  it.each([
    ['flag off', () => { h.on.v = false; sheet(); }, false],
    ['free ticket', () => sheet({ type: { ...type, pricePence: 0 }, basePence: 0 }), false],
    ['date early birds present', () => sheet({ steps: [bird] }), false],
    ['paid, no birds', () => sheet(), true],
    ['new paid ticket', () => sheet({ type: null, managed: undefined, basePence: 0 }), true],
  ])('%s', (_n, go, shown) => {
    go();
    expect(!!screen.queryByTestId('t-early')).toBe(shown);
  });
  it('switch on hides the date section', () => {
    sheet();
    expect(screen.queryByTestId('t-early-price')).toBeNull();
    fireEvent.click(screen.getByTestId('t-early'));
    expect(screen.getByTestId('t-early-price')).toBeTruthy();
    expect(screen.getByTestId('t-early-note').textContent).toContain('£15');
  });
});

describe('saving', () => {
  it('saved early ticket made free: refused before any write', async () => {
    const { onFail } = sheet({ managed: earlyRow });
    fireEvent.click(screen.getByTestId('t-free'));
    done();
    await waitFor(() => expect(screen.getByTestId('t-err').textContent).toBe(EARLY_OFF_FIRST));
    expect(h.upsert).not.toHaveBeenCalled(); expect(h.early).not.toHaveBeenCalled(); expect(onFail).not.toHaveBeenCalled();
  });

  it('new ticket on: create, then setEarlyBird with the new id', async () => {
    const { onDone } = sheet({ type: null, managed: undefined, basePence: 0 });
    set('t-name', 'Class'); set('t-price', '15');
    fireEvent.click(screen.getByTestId('t-early'));
    set('t-early-price', '8'); set('t-early-count', '20');
    done();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(h.early).toHaveBeenCalledWith({ p_ticket_type_id: 'new1', p_price_pence: 800, p_capacity: 20 });
  });
  it('saved early ticket starts on and prefilled', () => {
    sheet({ managed: earlyRow });
    expect(screen.getByTestId('t-early').getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('t-early-price') as HTMLInputElement).value).toBe('8.00');
    expect((screen.getByTestId('t-early-count') as HTMLInputElement).value).toBe('20');
  });
  it('untouched sends no early command', async () => {
    const { onClose } = sheet({ managed: earlyRow });
    done();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.early).not.toHaveBeenCalled();
  });
  it('switch off on a saved tier sends nulls', async () => {
    const { onDone } = sheet({ managed: earlyRow });
    fireEvent.click(screen.getByTestId('t-early'));
    done();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(h.early).toHaveBeenCalledWith({ p_ticket_type_id: 't1', p_price_pence: null, p_capacity: null });
  });
  it('invalid form: error, nothing written', async () => {
    sheet();
    fireEvent.click(screen.getByTestId('t-early'));
    set('t-early-price', '8'); set('t-early-count', '0');
    done();
    await waitFor(() => expect(screen.getByTestId('t-err').textContent).toContain('whole number'));
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.early).not.toHaveBeenCalled();
  });
  it('refusal: reason copy in t-err, onFail, sheet stays open', async () => {
    h.early.mockResolvedValue({ ok: false, reason: 'count_below_taken' });
    const { onFail, onClose } = sheet();
    fireEvent.click(screen.getByTestId('t-early'));
    set('t-early-price', '8'); set('t-early-count', '5');
    done();
    await waitFor(() => expect(onFail).toHaveBeenCalled());
    expect(screen.getByTestId('t-err').textContent).toContain('already sold');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('list pill', () => {
  it.each([
    ['open', earlyRow, 'Early bird 20 left', '£8 now, £15 after'],
    ['sold out', { ...earlyRow, earlyLeft: 0 }, null, null],
    ['none', row(), null, null],
  ])('%s', (_n, m, pill, price) => {
    const v = earlyBirdOf(m as ManagedType, true);
    expect(v?.pill ?? null).toBe(pill);
    expect(v?.price ?? null).toBe(price);
  });
  it('flag off: no pill', () => expect(earlyBirdOf(earlyRow, false)).toBeNull());
});
