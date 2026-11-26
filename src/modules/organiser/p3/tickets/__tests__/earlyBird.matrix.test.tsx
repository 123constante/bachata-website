// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SHAPES } from './fixtures';
import { dataMock, load, show } from './harness';
import {
  EARLY_STEPS_NOTE,
  earlyCommand,
  earlyFormOf,
  earlyNote,
  earlyReasonMessage,
  type ManagedType,
} from '../../../tickets/priceSteps';
import { formatPence } from '../../../tickets/ticketModel';

/*
 * Early bird on the Edit ticket sheet (flag ticketEarlyBird): flag off unchanged, stepped ticket has no
 * switch, on / off / edit send the right command, untouched sends nothing, every refusal reason has words,
 * and the Buyer pays "now, after" line. Prod has no early tiers yet: shapes are fixtures.
 */

const flagState = vi.hoisted(() => ({ early: true, steps: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return {
    ...m,
    flags: new Proxy(m.flags, {
      get: (t, k) => (k === 'ticketEarlyBird' ? flagState.early : k === 'ticketPriceStepsEditor' ? flagState.steps : Reflect.get(t, k)),
    }),
  };
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
  setEarlyBird: vi.fn(),
}));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

const row = (over: Partial<ManagedType> = {}): ManagedType => ({
  id: 't-sell',
  basePricePence: 1200,
  effectivePricePence: 1200,
  hasOrders: true,
  hasPriceSteps: false,
  steps: [],
  earlyPricePence: null,
  earlyCapacity: null,
  earlyTaken: 0,
  earlyOpen: false,
  regularPricePence: 1200,
  ...over,
});
const EARLY = row({ earlyPricePence: 900, earlyCapacity: 20, earlyTaken: 3, earlyOpen: true });

let managed: ManagedType[] = [];
beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  flagState.early = true;
  flagState.steps = true;
  load(SHAPES.selling);
  api.fetchManagedTypes.mockImplementation(async () => ({ ok: true, reason: null, types: managed }));
  api.setEarlyBird.mockResolvedValue({ ok: true, reason: null });
});
afterEach(cleanup);

async function editor() {
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  fireEvent.click(screen.getAllByTestId('tix-edit')[0]);
  await screen.findByTestId('tix-sheet');
}
const type = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
const save = () => fireEvent.click(screen.getByTestId('tix-save'));

describe('what the sheet shows', () => {
  it('flag off: no switch, no manage read for it (sheet as today)', async () => {
    flagState.early = false;
    flagState.steps = false;
    managed = [row()];
    await editor();
    expect(screen.queryByTestId('tix-early-switch')).toBeNull();
    expect(api.fetchManagedTypes).not.toHaveBeenCalled();
  });

  it('a stepped ticket: the switch is not shown at all', async () => {
    managed = [row({ hasPriceSteps: true })];
    await editor();
    await screen.findByTestId('tix-steps');
    expect(screen.queryByTestId('tix-early-switch')).toBeNull();
  });

  it('a plain paid ticket: switch off shows no fields; on shows both fields and the live note', async () => {
    managed = [row()];
    await editor();
    const sw = (await screen.findByTestId('tix-early-switch')) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    expect(screen.queryByTestId('tix-early-price')).toBeNull();
    fireEvent.click(sw);
    type('tix-early-price', '9');
    type('tix-early-count', '20');
    expect(screen.getByTestId('tix-early-note').textContent).toBe(`When these 20 sell, the price goes to ${formatPence(1200)} by itself.`);
  });

  it('Buyer pays: "now, after" with an early price; as today without', async () => {
    managed = [row()];
    await editor();
    const total = () => screen.getByTestId('tix-buyer-total').textContent;
    expect(total()).toBe(formatPence(1200));
    fireEvent.click(await screen.findByTestId('tix-early-switch'));
    type('tix-early-price', '9');
    expect(total()).toBe(`${formatPence(900)} now, ${formatPence(1200)} after`);
  });

  it('early bird on: Price changes add button is replaced by the note', async () => {
    managed = [EARLY];
    await editor();
    await screen.findByTestId('tix-early-switch');
    expect(screen.getByTestId('tix-steps-early-note').textContent).toBe(EARLY_STEPS_NOTE);
    expect(screen.queryByTestId('tix-step-add')).toBeNull();
  });
});

describe('writes: exact arguments', () => {
  it('turn on sends price + count', async () => {
    managed = [row()];
    await editor();
    fireEvent.click(await screen.findByTestId('tix-early-switch'));
    type('tix-early-price', '9.50');
    type('tix-early-count', '25');
    save();
    await waitFor(() => expect(api.setEarlyBird).toHaveBeenCalledTimes(1));
    expect(api.setEarlyBird).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_price_pence: 950, p_capacity: 25 });
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });

  it('edit sends the new values', async () => {
    managed = [EARLY];
    await editor();
    await screen.findByTestId('tix-early-switch');
    type('tix-early-count', '30');
    save();
    await waitFor(() => expect(api.setEarlyBird).toHaveBeenCalledTimes(1));
    expect(api.setEarlyBird).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_price_pence: 900, p_capacity: 30 });
  });

  it('turn off on a saved tier sends nulls', async () => {
    managed = [EARLY];
    await editor();
    fireEvent.click(await screen.findByTestId('tix-early-switch'));
    save();
    await waitFor(() => expect(api.setEarlyBird).toHaveBeenCalledTimes(1));
    expect(api.setEarlyBird).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_price_pence: null, p_capacity: null });
  });

  it.each([['no early tier', row()], ['a saved early tier', EARLY]])('untouched sheet sends nothing: %s', async (_n, r) => {
    managed = [r];
    await editor();
    await screen.findByTestId('tix-early-switch');
    save();
    await waitFor(() => expect(screen.queryByTestId('tix-sheet')).toBeNull());
    expect(api.setEarlyBird).not.toHaveBeenCalled();
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });

  it('a bad count is refused before sending, next to the fields', async () => {
    managed = [row()];
    await editor();
    fireEvent.click(await screen.findByTestId('tix-early-switch'));
    type('tix-early-price', '9');
    type('tix-early-count', '0');
    save();
    expect((await screen.findByTestId('tix-early-error')).textContent).toBe(earlyReasonMessage('invalid_count'));
    expect(api.setEarlyBird).not.toHaveBeenCalled();
  });

  it('a server refusal shows its words next to the fields', async () => {
    managed = [row()];
    api.setEarlyBird.mockResolvedValue({ ok: false, reason: 'has_night_prices' });
    await editor();
    fireEvent.click(await screen.findByTestId('tix-early-switch'));
    type('tix-early-price', '9');
    type('tix-early-count', '5');
    save();
    expect((await screen.findByTestId('tix-early-error')).textContent).toBe(earlyReasonMessage('has_night_prices'));
  });
});

describe('model', () => {
  it.each([
    'invalid_payload', 'not_paid_ticket', 'has_price_steps', 'has_night_prices', 'invalid_price',
    'invalid_count', 'count_below_taken', 'not_owner_or_admin', 'not_found',
  ])('refusal %s has its own plain words', (reason) => {
    const m = earlyReasonMessage(reason);
    expect(m).not.toBe(earlyReasonMessage('something_else'));
    expect(m.length).toBeGreaterThan(20);
  });

  it('unknown reason falls back to try again', () => {
    expect(earlyReasonMessage(null)).toBe('That did not work. Try again in a moment.');
  });

  it('earlyNote is live from the inputs', () => {
    expect(earlyNote('', null)).toBe('When these … sell, the price goes to … by itself.');
    expect(earlyNote('12', 1500)).toBe('When these 12 sell, the price goes to £15 by itself.');
  });

  it('earlyCommand: untouched = null, off with no tier = null', () => {
    expect(earlyCommand(earlyFormOf(EARLY), EARLY)).toBeNull();
    expect(earlyCommand({ on: false, price: '', count: '' }, row())).toBeNull();
  });
});
