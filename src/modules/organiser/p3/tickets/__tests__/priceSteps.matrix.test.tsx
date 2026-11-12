// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SHAPES, sales, type as typeOf } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';
import {
  FREE_WITH_STEPS,
  RESERVE_NOT_READY_TEXT,
  STEPS_EMPTY,
  STEPS_FREE,
  STEPS_FULL,
  STEPS_ORDERS_NOTE,
  STEP_LIVE_NOTE,
  TIME_DOES_NOT_EXIST,
  appliesLine,
  type ManagedType,
  type PriceStep,
} from '../../../tickets/priceSteps';

/*
 * T3 price steps, screen matrix (docs/briefs/ticket-t3-price-steps-editor.md "Tests"): 0/1/3 steps, a 4th
 * refused, rise/drop, with/without orders, free, non-manager, reserve_not_ready, DST spring/autumn, an
 * untouched save sends nothing, and the editor seeded from the BASE read, never a summary row (R3-7).
 * Every write asserts the exact RPC arguments. Prod has 0 steps (survey 2026-11-12): stepped rows are fixtures.
 */

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'ticketPriceStepsEditor' ? flagState.on : Reflect.get(t, k)) }) };
});
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-12' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({
  setTicketStatus: vi.fn(),
  upsertTicketType: vi.fn(),
  refundOrder: vi.fn(),
  fetchManagedTypes: vi.fn(),
  setPriceStep: vi.fn(),
  removePriceStep: vi.fn(),
}));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

const step = (id: string, at: string, pence: number, isLive = false): PriceStep => ({ id, effectiveFrom: at, pricePence: pence, isLive });
const row = (id: string, base: number, steps: PriceStep[], hasOrders = false): ManagedType => ({
  id,
  basePricePence: base,
  effectivePricePence: base,
  hasOrders,
  hasPriceSteps: steps.length > 0,
  steps,
});
const S1 = step('s1', '2027-01-10T19:00:00.000Z', 1500);
const S2 = step('s2', '2027-02-10T19:00:00.000Z', 1000);
const S3 = step('s3', '2027-06-01T18:00:00.000Z', 1800);

let managed: ManagedType[] = [];
beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  flagState.on = true;
  api.fetchManagedTypes.mockImplementation(async () => ({ ok: true, reason: null, types: managed }));
});
afterEach(cleanup);

/** Open the editor of one type on the Tickets sheet. */
async function editor(typeId: string) {
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  fireEvent.click(within(screen.getByTestId(`tix-type-${typeId}`)).getByTestId('tix-edit'));
  return screen.getByTestId('tix-sheet');
}
const steps = async () => {
  const s = await screen.findByTestId('tix-steps');
  await waitFor(() => expect(within(s).queryByText(/Checking price changes/)).toBeNull());
  return s;
};
const fill = (at: string, price: string) => {
  fireEvent.change(screen.getByTestId('tix-step-at'), { target: { value: at } });
  fireEvent.change(screen.getByTestId('tix-step-price'), { target: { value: price } });
};

describe('what the block shows, per shape', () => {
  const ROWS: [string, ManagedType[], (s: HTMLElement) => void][] = [
    ['0 steps: says what to do, Add enabled', [row('t-sell', 1200, [])], (s) => {
      expect(within(s).getByTestId('tix-steps-empty').textContent).toBe(STEPS_EMPTY);
      expect((within(s).getByTestId('tix-step-add') as HTMLButtonElement).disabled).toBe(false);
    }],
    ['1 step (rise): the exact applies line', [row('t-sell', 1200, [S1])], (s) => {
      const r = within(s).getAllByTestId('tix-step-row');
      expect(r).toHaveLength(1);
      expect(r[0].textContent).toContain('Rises to £15.00');
      expect(within(r[0]).getByTestId('tix-step-applies').textContent).toBe(appliesLine(S1.effectiveFrom));
      expect(within(r[0]).getByTestId('tix-step-applies').textContent).toBe('This new price applies to every night of this ticket from Sun, 10 Jan 2027, 19:00 GMT.');
    }],
    ['3 steps: rise, drop, rise; Add disabled with its reason', [row('t-sell', 1200, [S1, S2, S3])], (s) => {
      const r = within(s).getAllByTestId('tix-step-row').map((x) => x.textContent ?? '');
      expect(r[0]).toContain('Rises to £15.00');
      expect(r[1]).toContain('Drops to £10.00');
      expect(r[2]).toContain('Rises to £18.00');
      expect(r[2]).toContain('Tue, 1 Jun 2027, 19:00 BST');
      const add = within(s).getByTestId('tix-step-add') as HTMLButtonElement;
      expect(add.disabled).toBe(true);
      expect(within(s).getByTestId('tix-step-add-why').textContent).toBe(STEPS_FULL);
      expect(add.getAttribute('aria-describedby')).toBe(within(s).getByTestId('tix-step-add-why').id);
    }],
    ['a live step: frozen, no Change / Remove', [row('t-sell', 1200, [step('sl', '2026-11-01T10:00:00.000Z', 1500, true)])], (s) => {
      expect(within(s).getByTestId('tix-step-live').textContent).toBe(STEP_LIVE_NOTE);
      expect(within(s).queryByTestId('tix-step-move')).toBeNull();
      expect(within(s).queryByTestId('tix-step-remove')).toBeNull();
    }],
    ['a free type: no steps offered, says why', [row('t-sell', 0, [])], (s) => {
      expect(within(s).getByTestId('tix-steps-free').textContent).toBe(STEPS_FREE);
      expect(within(s).queryByTestId('tix-step-add')).toBeNull();
    }],
  ];
  it.each(ROWS)('%s', async (_n, rows, check) => {
    load(SHAPES.selling);
    managed = rows;
    await editor('t-sell');
    check(await steps());
    expect(api.fetchManagedTypes).toHaveBeenCalledWith('ser-1');
  });

  it.each([
    ['with orders (selling)', 'selling', 't-sell', true],
    ['without orders (draft, manager)', 'started', 't-d', false],
  ] as const)('orders note: %s', async (_n, shape, id, shown) => {
    load(SHAPES[shape]);
    managed = [row(id, 1200, [])];
    await editor(id);
    const s = await steps();
    expect(within(s).queryByTestId('tix-steps-orders')?.textContent ?? null).toBe(shown ? STEPS_ORDERS_NOTE : null);
    // adding a step is still allowed with orders
    expect((within(s).getByTestId('tix-step-add') as HTMLButtonElement).disabled).toBe(false);
  });

  it('non-manager: no block, no read', async () => {
    load(SHAPES.contributor);
    managed = [row('t-sell', 1200, [S1])];
    await editor('t-sell');
    expect(screen.queryByTestId('tix-steps')).toBeNull();
    expect(api.fetchManagedTypes).not.toHaveBeenCalled();
  });

  it('flag off: no block, no read', async () => {
    flagState.on = false;
    load(SHAPES.selling);
    managed = [row('t-sell', 1200, [S1])];
    await editor('t-sell');
    expect(screen.queryByTestId('tix-steps')).toBeNull();
    expect(api.fetchManagedTypes).not.toHaveBeenCalled();
  });
});

describe('writes: exact arguments', () => {
  beforeEach(() => load(SHAPES.selling));

  it.each([
    ['winter (GMT)', '2027-01-10T19:00', '15', '2027-01-10T19:00:00.000Z', 1500],
    ['summer (BST)', '2027-06-01T19:00', '9.50', '2027-06-01T18:00:00.000Z', 950],
    ['autumn ambiguous 01:30 -> the later instant (GMT)', '2026-10-25T01:30', '14', '2026-10-25T01:30:00.000Z', 1400],
  ])('add, %s', async (_n, at, price, iso, pence) => {
    managed = [row('t-sell', 1200, [])];
    api.setPriceStep.mockResolvedValue({ ok: true, reason: null });
    await editor('t-sell');
    fireEvent.click(within(await steps()).getByTestId('tix-step-add'));
    fill(at, price);
    if (at === '2026-10-25T01:30') expect(screen.getByTestId('tix-step-at-help').textContent).toBe('01:30 GMT (after the clocks go back)');
    fireEvent.click(screen.getByTestId('tix-step-save'));
    await waitFor(() => expect(api.setPriceStep).toHaveBeenCalledTimes(1));
    expect(api.setPriceStep).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_step_id: null, p_effective_from: iso, p_price_pence: pence });
    expect((await screen.findByTestId('tix-step-note')).textContent).toBe('Price change added.');
  });

  it('spring forward: a time that does not exist is refused on the phone, nothing sent', async () => {
    managed = [row('t-sell', 1200, [])];
    await editor('t-sell');
    fireEvent.click(within(await steps()).getByTestId('tix-step-add'));
    fill('2027-03-28T01:30', '15');
    fireEvent.click(screen.getByTestId('tix-step-save'));
    expect(screen.getByTestId('tix-step-at-err').textContent).toBe(TIME_DOES_NOT_EXIST);
    expect(api.setPriceStep).not.toHaveBeenCalled();
  });

  it('move: the step id, the new instant and price', async () => {
    managed = [row('t-sell', 1200, [S1])];
    api.setPriceStep.mockResolvedValue({ ok: true, reason: null });
    await editor('t-sell');
    fireEvent.click(within(await steps()).getByTestId('tix-step-move'));
    expect((screen.getByTestId('tix-step-at') as HTMLInputElement).value).toBe('2027-01-10T19:00');
    expect((screen.getByTestId('tix-step-price') as HTMLInputElement).value).toBe('15.00');
    fill('2027-01-17T19:00', '16');
    fireEvent.click(screen.getByTestId('tix-step-save'));
    await waitFor(() => expect(api.setPriceStep).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_step_id: 's1', p_effective_from: '2027-01-17T19:00:00.000Z', p_price_pence: 1600 }));
  });

  it('untouched move sends nothing', async () => {
    managed = [row('t-sell', 1200, [S1])];
    await editor('t-sell');
    fireEvent.click(within(await steps()).getByTestId('tix-step-move'));
    fireEvent.click(screen.getByTestId('tix-step-save'));
    expect(screen.getByTestId('tix-step-note').textContent).toBe('Nothing changed, so nothing was saved.');
    expect(api.setPriceStep).not.toHaveBeenCalled();
  });

  it('remove asks first, then sends the step id', async () => {
    managed = [row('t-sell', 1200, [S1, S2])];
    api.removePriceStep.mockResolvedValue({ ok: true, reason: null });
    await editor('t-sell');
    const s = await steps();
    fireEvent.click(within(within(s).getAllByTestId('tix-step-row')[1]).getByTestId('tix-step-remove'));
    expect(api.removePriceStep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('tix-step-remove-yes'));
    await waitFor(() => expect(api.removePriceStep).toHaveBeenCalledWith('s2'));
  });

  it.each([
    ['reserve_not_ready', RESERVE_NOT_READY_TEXT],
    ['too_many_steps (a 4th, e.g. another manager added one)', STEPS_FULL],
  ])('refused %s: the words, and the draft is kept', async (reason, words) => {
    managed = [row('t-sell', 1200, [S1, S2])];
    api.setPriceStep.mockResolvedValue({ ok: false, reason: reason.split(' ')[0] });
    await editor('t-sell');
    fireEvent.click(within(await steps()).getByTestId('tix-step-add'));
    fill('2027-03-01T20:00', '17');
    fireEvent.click(screen.getByTestId('tix-step-save'));
    expect((await screen.findByTestId('tix-step-error')).textContent).toBe(words);
    expect((screen.getByTestId('tix-step-at') as HTMLInputElement).value).toBe('2027-03-01T20:00');
    expect((screen.getByTestId('tix-step-price') as HTMLInputElement).value).toBe('17');
  });
});

describe('the ticket form beside the steps (R3-7, s.2b)', () => {
  it('seeded from the BASE read, never the summary: an untouched save sends nothing while the summary shows the step price', async () => {
    load(SHAPES.selling);
    const base = SHAPES.selling.types[0];
    // After a step is live the summary's price_pence is the CURRENT price (1500), the base is still 1200.
    q.summary = ok({ ok: true, reason: null, moneyVisible: true, types: [sales(base, { pricePence: 1500 }), sales(SHAPES.selling.types[1])] });
    managed = [row('t-sell', 1200, [step('sl', '2026-11-01T10:00:00.000Z', 1500, true)])];
    await editor('t-sell');
    await steps();
    expect((screen.getByTestId('tix-form-price') as HTMLInputElement).value).toBe('12.00');
    fireEvent.click(screen.getByTestId('tix-save'));
    expect((await screen.findByTestId('tix-toast')).textContent).toBe('Nothing changed, so nothing was saved.');
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });

  it('a type with steps cannot be made free: says why, sends nothing', async () => {
    const t = typeOf('t-d', { status: 'draft' });
    load({ ...SHAPES.started, types: [t], sales: [sales(t)] });
    managed = [row('t-d', 1200, [S1])];
    await editor('t-d');
    await steps();
    fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    expect((await screen.findByTestId('tix-err-price')).textContent).toBe(FREE_WITH_STEPS);
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });
});
