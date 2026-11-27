// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ upsert: vi.fn(), status: vi.fn(), setStep: vi.fn(), delStep: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setPriceStep: (c: unknown) => h.setStep(c),
  removePriceStep: (id: string) => h.delStep(id),
}));
import { formOfType, priceNow, writeTicket } from '../TicketSheetV2';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1000 };
const common = { organiserId: 'o1', seriesId: 's1', seriesLive: true, type, basePence: 1000, sold: 3 };
// the B3 sold-price step: 1000 -> 1200, already started
const live = { id: 'st1', effectiveFrom: '2020-01-02T12:34:00Z', pricePence: 1200, isLive: true };
const coming = { id: 'st2', effectiveFrom: '2099-01-02T00:00:00Z', pricePence: 1500, isLive: false };
/** what the sheet opens with for this ticket (same call as TicketSheetV2) */
const formOf = (steps: (typeof live)[], sold: number) => formOfType(type, steps, 1000, sold > 0);

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 't1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
});

describe('priceNow', () => {
  it('base when no step has started', () => {
    expect(priceNow(1000, [])).toBe(1000);
    expect(priceNow(1000, [coming])).toBe(1000);
  });
  it('the latest started step wins', () => {
    const later = { ...live, id: 'st3', effectiveFrom: '2021-01-01T00:00:00Z', pricePence: 1400 };
    expect(priceNow(1000, [live, later, coming])).toBe(1400);
  });
});

describe('the sheet form of a sold ticket', () => {
  it('shows the price counting now and no started step as an early bird', () => {
    const f = formOf([live], 3);
    expect(f.price).toBe('12.00');
    expect(f.birds).toEqual([]);
  });
  it('an unsold ticket keeps every step as an early bird row (live bird rule unchanged)', () => {
    const f = formOf([live], 0);
    expect(f.price).toBe('12.00');
    expect(f.birds).toHaveLength(1);
  });
});

describe('sold ticket price changes count from now', () => {
  const step = () => h.setStep.mock.calls[0][0] as { p_step_id: string | null; p_price_pence: number; p_effective_from: string };
  it('live step 1200, old price 10 typed back: one new step at 1000 from about now + 60s', async () => {
    const before = Date.now();
    const r = await writeTicket({ ...common, steps: [live], form: { ...formOf([live], 3), price: '10' } });
    expect(r.ok).toBe(true);
    expect(h.setStep).toHaveBeenCalledTimes(1);
    expect(step().p_step_id).toBeNull();
    expect(step().p_price_pence).toBe(1000);
    expect(Date.parse(step().p_effective_from)).toBeGreaterThanOrEqual(before + 59_000);
    expect(Date.parse(step().p_effective_from)).toBeLessThanOrEqual(Date.now() + 61_000);
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.delStep).not.toHaveBeenCalled();
  });
  it('live step 1200, price left at 12: no price step, nothing changed', async () => {
    const r = await writeTicket({ ...common, steps: [live], form: formOf([live], 3) });
    expect(r).toEqual({ ok: true, id: 't1', changed: false });
    expect(h.setStep).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });
  it('live step 1200, rename only: the upsert keeps the stored base, no price step', async () => {
    const r = await writeTicket({ ...common, steps: [live], form: { ...formOf([live], 3), name: 'Evening class' } });
    expect(r.ok).toBe(true);
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Evening class', pricePence: 1000 }));
    expect(h.setStep).not.toHaveBeenCalled();
  });
  it('no steps, new price: one step at 1200 (B3 behaviour kept)', async () => {
    const r = await writeTicket({ ...common, steps: [], form: { ...formOf([], 3), price: '12' } });
    expect(r.ok).toBe(true);
    expect(h.setStep).toHaveBeenCalledTimes(1);
    expect(step().p_price_pence).toBe(1200);
  });
  it('no steps, same price: nothing written', async () => {
    const r = await writeTicket({ ...common, steps: [], form: formOf([], 3) });
    expect(r).toEqual({ ok: true, id: 't1', changed: false });
    expect(h.setStep).not.toHaveBeenCalled();
  });
  it('unsold type: base upsert, no step', async () => {
    const r = await writeTicket({ ...common, sold: 0, steps: [], form: { ...formOf([], 0), price: '12' } });
    expect(r.ok).toBe(true);
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ pricePence: 1200 }));
    expect(h.setStep).not.toHaveBeenCalled();
  });
});
