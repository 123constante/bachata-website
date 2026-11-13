// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NOT_MANAGER_REFUND, reasonMessage } from '../../../tickets/ticketModel';
import { SHAPES, order, type Shape } from './fixtures';
import { dataMock, load, show } from './harness';

/*
 * Partial refunds on the Refund sheet (brief ticket-partial-refund-ui; owner Q5). Order shapes x
 * controls; the untouched sheet sends today's whole refund (no amount); the amount field blocks
 * with the maximum named; one key per press, reused only for a retry of the same amount.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

// 25.00 paid; part: 17.00 already refunded (8.00 left).
const ORDERS = {
  paid: order('op', 't-sell'),
  part: order('opart', 't-sell', { refundedPence: 1700 }),
  refunded: order('oref', 't-sell', { status: 'refunded', refundedPence: 2500 }),
  disputed: order('odis', 't-sell', { status: 'disputed' }),
  free: order('ofree', 't-sell', { subtotalPence: 0, bookingFeePence: 0, totalPence: 0 }),
};
const withOrders = (role = 'owner'): Shape => ({ ...SHAPES.selling, orders: Object.values(ORDERS), role });
const open = () => fireEvent.click(screen.getByTestId('tix-row'));
const seeAll = () => {
  const all = screen.queryByTestId('tix-see-all');
  if (all) fireEvent.click(all);
};
const refundBtn = (id: string) => within(screen.getByTestId(`tix-order-${id}`)).queryByTestId('tix-refund') as HTMLButtonElement | null;
const openSheet = (id: string) => fireEvent.click(refundBtn(id)!);
const confirm = () => screen.getByTestId('tix-refund-confirm') as HTMLButtonElement;
const typeAmount = (v: string) => fireEvent.change(screen.getByTestId('tix-refund-amount'), { target: { value: v } });
const part = () => fireEvent.click(screen.getByTestId('tix-refund-part'));

describe('order shapes x the Refund control', () => {
  const ROWS: Array<[keyof typeof ORDERS, boolean]> = [
    ['paid', true],
    ['part', true], // money left: the button stays
    ['refunded', false],
    ['disputed', false],
    ['free', false],
  ];
  it.each(ROWS)('%s order: Refund button shown = %s (manager)', (k, shown) => {
    load(withOrders());
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    expect(!!refundBtn(ORDERS[k].id)).toBe(shown);
  });
  it('a non-manager sees no Refund button and the reason', () => {
    load(withOrders('contributor'));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    expect(screen.queryAllByTestId('tix-refund')).toHaveLength(0);
    expect(screen.getByTestId('tix-refund-reason').textContent).toBe(NOT_MANAGER_REFUND);
  });
});

describe('the Refund sheet', () => {
  beforeEach(() => load(withOrders()));
  const sheetFor = (id: keyof typeof ORDERS) => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet(ORDERS[id].id);
  };

  it('untouched: "Refund all remaining" is the default and sends exactly today\u2019s whole refund (no amount)', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'ok', value: null });
    sheetFor('paid');
    expect(screen.getByTestId('tix-refund-all').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('tix-refund-amount')).toBeNull();
    expect(confirm().textContent).toBe('Refund \u00A325');
    fireEvent.click(confirm());
    await waitFor(() => expect(api.refundOrder).toHaveBeenCalledTimes(1));
    expect(api.refundOrder.mock.calls[0]).toEqual(['op', undefined]);
    expect((await screen.findByTestId('tix-toast')).querySelector('span')?.textContent).toBe('Refund started.');
  });

  it('part: the field shows the maximum, confirm is disabled with the reason under the field until the amount is right', () => {
    sheetFor('paid');
    part();
    expect(screen.getByTestId('tix-refund-max').textContent).toBe('Up to \u00A325 left to refund');
    expect(screen.getByTestId('tix-refund-body').textContent).toMatch(/stay valid/);
    const field = screen.getByTestId('tix-refund-amount') as HTMLInputElement;
    expect([field.value, field.inputMode]).toEqual(['', 'decimal']);
    expect(confirm().disabled).toBe(true);
    expect(screen.getByTestId('tix-refund-amount-err').textContent).toBe('Enter how much to refund, up to \u00A325.');
    expect(confirm().getAttribute('aria-describedby')).toBe(screen.getByTestId('tix-refund-amount-err').id);
    typeAmount('abc');
    expect([confirm().disabled, screen.getByTestId('tix-refund-amount-err').textContent]).toEqual([true, 'Enter an amount in pounds, like 3.50, up to \u00A325.']);
    typeAmount('3.5');
    expect([confirm().disabled, confirm().textContent]).toEqual([false, 'Refund \u00A33.50']);
    expect(screen.queryByTestId('tix-refund-amount-err')).toBeNull();
  });

  it('an already part-refunded order: the maximum is what is left; more is blocked with the maximum named', () => {
    sheetFor('part');
    part();
    expect(screen.getByTestId('tix-refund-max').textContent).toBe('Up to \u00A38 left to refund');
    typeAmount('8.01');
    expect([confirm().disabled, screen.getByTestId('tix-refund-amount-err').textContent]).toEqual([true, 'That is more than is left. Enter up to \u00A38.']);
    typeAmount('8');
    expect(confirm().disabled).toBe(false); // exactly what is left goes as a partial with the amount
  });

  it('a valid partial sends the amount with a key, and the toast says what went back and what is left', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'ok', value: { amountPence: 300, remainingPence: 500, clearsBalance: false } });
    sheetFor('part');
    part();
    typeAmount('3');
    fireEvent.click(confirm());
    await waitFor(() => expect(api.refundOrder).toHaveBeenCalledTimes(1));
    const [oid, opts] = api.refundOrder.mock.calls[0];
    expect(oid).toBe('opart');
    expect(opts.amountPence).toBe(300);
    expect(opts.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect((await screen.findByTestId('tix-toast')).querySelector('span')?.textContent).toBe('Refunded \u00A33. \u00A35 is left to refund. Tickets stay valid.');
    expect(screen.queryByTestId('tix-refund-sheet')).toBeNull();
  });

  it('busy: the confirm reads Refunding..., the choice and the field wait, the row button is locked', async () => {
    let answer: (v: unknown) => void = () => {};
    api.refundOrder.mockReturnValue(new Promise((r) => { answer = r; }));
    sheetFor('paid');
    part();
    typeAmount('3');
    fireEvent.click(confirm());
    expect([confirm().disabled, confirm().textContent]).toEqual([true, 'Refunding\u2026']);
    expect((screen.getByTestId('tix-refund-amount') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('tix-refund-all') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm());
    expect(api.refundOrder).toHaveBeenCalledTimes(1);
    answer({ kind: 'failed', reason: null });
    expect(await screen.findByTestId('tix-refund-note')).toBeTruthy();
  });

  it('server refund_exceeds_balance shows its words in the sheet, which stays open', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: 'refund_exceeds_balance' });
    sheetFor('paid');
    part();
    typeAmount('3');
    fireEvent.click(confirm());
    expect((await screen.findByTestId('tix-refund-note')).textContent).toBe(reasonMessage('refund_exceeds_balance'));
    expect(screen.getByTestId('tix-refund-sheet')).toBeTruthy();
  });
});

describe('one key per press (request_id idempotency)', () => {
  beforeEach(() => load(withOrders()));
  const key = (n: number) => api.refundOrder.mock.calls[n][1].requestId as string;
  const pressAndWait = async (n: number) => {
    fireEvent.click(confirm());
    await waitFor(() => expect(api.refundOrder).toHaveBeenCalledTimes(n));
    await screen.findByTestId('tix-refund-note');
    await waitFor(() => expect(confirm().disabled).toBe(false));
  };
  it('an unclear failure (no reason) keeps the key per amount: retry, a changed amount and back, closing and reopening', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: null }); // a network failure leaves the sheet open
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(1);
    await pressAndWait(2);
    expect(key(1)).toBe(key(0)); // the same press, retried
    typeAmount('4');
    await pressAndWait(3);
    expect(key(2)).not.toBe(key(0)); // a different amount is a different refund
    typeAmount('3');
    await pressAndWait(4);
    expect(key(3)).toBe(key(0)); // 3.00 may already have gone through: still that press
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(5);
    expect(key(4)).toBe(key(0)); // reopening the sheet never mints a second refund of 3.00
  });
  it('once the webhook moves refunded_pence, kept keys no longer apply: the same amount is a new key', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: null });
    const r = show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(1);
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    // The lost 3.00 did land: the order row now says 3.00 refunded.
    load({ ...withOrders(), orders: [order('op', 't-sell', { refundedPence: 300 })] });
    r.again();
    openSheet('op');
    part();
    expect(screen.getByTestId('tix-refund-max').textContent).toBe('Up to \u00A322 left to refund');
    typeAmount('3');
    await pressAndWait(2);
    expect(key(1)).not.toBe(key(0)); // a second, deliberate 3.00 refund
  });
  it('a definite answer ends the press: a refusal with a reason, then a new press, uses a new key', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: 'refund_exceeds_balance' });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(1);
    await pressAndWait(2);
    expect(key(1)).not.toBe(key(0)); // "wait a minute, then try again" is a new press the server can say yes to
  });
  const DEFINITE = ['invalid_request', 'invalid_amount', 'request_id_required', 'request_id_reused', 'not_signed_in', 'not_authorised', 'not_found', 'not_refundable', 'refund_exceeds_balance', 'method_not_allowed', 'not_allowed'];
  const UNCLEAR = ['stripe_error', 'internal_error', 'something_new', 'FunctionsHttpError'];
  it.each(DEFINITE)('definite reason %s: the next press makes a new key', async (reason) => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(1);
    await pressAndWait(2);
    expect(key(1)).not.toBe(key(0));
    expect(screen.queryByTestId('tix-refund-maybe-sent')).toBeNull();
  });
  it.each(UNCLEAR)('unclear reason %s: the next press reuses the same key and the sheet says the last refund may have gone through', async (reason) => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(1);
    expect(screen.getByTestId('tix-refund-maybe-sent').textContent).toBe(
      'The last refund may have gone through. Tap Refund \u00A33 again to check, or reload the page before changing the amount.',
    );
    await pressAndWait(2);
    expect(key(1)).toBe(key(0));
  });
  it('the may-have-gone-through line is absent before any press', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    expect(screen.queryByTestId('tix-refund-maybe-sent')).toBeNull();
  });
  it('a \u00A33 partial of \u00A38 left: reopening shows up to \u00A35 and the whole refund says \u00A35 until refunded_pence moves', async () => {
    // order 'op' is \u00A325 total; make it \u00A38 so the brief\u2019s figures hold.
    load({ ...withOrders(), orders: [order('o8', 't-sell', { subtotalPence: 800, bookingFeePence: 0, totalPence: 800 })] });
    api.refundOrder.mockResolvedValueOnce({ kind: 'ok', value: { amountPence: 300, remainingPence: 500, clearsBalance: false } });
    const r = show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('o8');
    part();
    typeAmount('3');
    fireEvent.click(confirm());
    expect((await screen.findByTestId('tix-toast')).querySelector('span')?.textContent).toBe('Refunded \u00A33. \u00A35 is left to refund. Tickets stay valid.');
    openSheet('o8');
    expect(screen.getByTestId('tix-refund-body').textContent).toMatch(/\u00A35/);
    expect(confirm().textContent).toBe('Refund \u00A35');
    part();
    expect(screen.getByTestId('tix-refund-max').textContent).toBe('Up to \u00A35 left to refund');
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    // The webhook lands: the row says 3.00 refunded, and the pending figure is not counted twice.
    load({ ...withOrders(), orders: [order('o8', 't-sell', { subtotalPence: 800, bookingFeePence: 0, totalPence: 800, refundedPence: 300 })] });
    r.again();
    openSheet('o8');
    part();
    expect(screen.getByTestId('tix-refund-max').textContent).toBe('Up to \u00A35 left to refund');
  });
  it('a done partial ends the press: the next refund of the same amount on that order is a new key', async () => {
    api.refundOrder.mockResolvedValueOnce({ kind: 'ok', value: { amountPence: 300, remainingPence: 2200, clearsBalance: false } });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    fireEvent.click(confirm());
    await screen.findByTestId('tix-toast');
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: null });
    openSheet('op');
    part();
    typeAmount('3');
    await pressAndWait(2);
    expect(key(1)).not.toBe(key(0));
  });
  it('a whole refund never sends a key', async () => {
    api.refundOrder.mockResolvedValue({ kind: 'failed', reason: null });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    seeAll();
    openSheet('op');
    part();
    typeAmount('3');
    fireEvent.click(screen.getByTestId('tix-refund-all'));
    await pressAndWait(1);
    expect(api.refundOrder.mock.calls[0]).toEqual(['op', undefined]);
  });
});
