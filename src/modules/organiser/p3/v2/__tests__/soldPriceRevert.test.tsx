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
import { priceNow, writeTicket } from '../TicketSheetV2';
import { formOfStored } from '../EarlyBirds';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1000 };
const common = { organiserId: 'o1', seriesId: 's1', type, basePence: 1000, sold: 3 };
const live = { id: 'st1', effectiveFrom: '2020-01-02T00:00:00Z', pricePence: 1200, isLive: true };
const plain = { name: 'Class', free: false, qty: 40 };

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 't1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
});

describe('priceNow', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');
  it('base when no step has started', () => {
    expect(priceNow(1000, [], now)).toBe(1000);
    expect(priceNow(1000, [{ effectiveFrom: '2027-01-01T00:00:00Z', pricePence: 1500 }], now)).toBe(1000);
  });
  it('the latest started step wins', () => {
    const steps = [
      { effectiveFrom: '2026-01-01T00:00:00Z', pricePence: 1200 },
      { effectiveFrom: '2026-03-01T00:00:00Z', pricePence: 1400 },
      { effectiveFrom: '2027-01-01T00:00:00Z', pricePence: 1800 },
    ];
    expect(priceNow(1000, steps, now)).toBe(1400);
  });
});

describe('sold ticket price comparison', () => {
  it('wanted equals the live step price: no price step, nothing changed', async () => {
    const f = formOfStored(1000, [live]);
    const r = await writeTicket({ ...common, steps: [live], form: { ...plain, ...f } });
    expect(r).toEqual({ ok: true, id: 't1', changed: false });
    expect(h.setStep).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });
  it('no steps, new price: one step from about now + 60s (kept behaviour)', async () => {
    const before = Date.now();
    const r = await writeTicket({ ...common, steps: [], form: { ...plain, price: '12', birds: [] } });
    expect(r.ok).toBe(true);
    expect(h.setStep).toHaveBeenCalledTimes(1);
    const c = h.setStep.mock.calls[0][0] as { p_price_pence: number; p_effective_from: string };
    expect(c.p_price_pence).toBe(1200);
    expect(Date.parse(c.p_effective_from)).toBeGreaterThanOrEqual(before + 59_000);
    expect(Date.parse(c.p_effective_from)).toBeLessThanOrEqual(Date.now() + 61_000);
  });
  it('no steps, same price: nothing written', async () => {
    const r = await writeTicket({ ...common, steps: [], form: { ...plain, price: '10', birds: [] } });
    expect(r).toEqual({ ok: true, id: 't1', changed: false });
    expect(h.setStep).not.toHaveBeenCalled();
  });
  it('unsold type: base upsert, no step', async () => {
    const r = await writeTicket({ ...common, sold: 0, steps: [], form: { ...plain, price: '12', birds: [] } });
    expect(r.ok).toBe(true);
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ pricePence: 1200 }));
    expect(h.setStep).not.toHaveBeenCalled();
  });
});
