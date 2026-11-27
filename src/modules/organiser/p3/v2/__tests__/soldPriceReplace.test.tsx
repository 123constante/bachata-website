import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ step: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', () => ({
  fetchManagedTypes: vi.fn(), removePriceStep: (id: string) => h.remove(id), setEarlyBird: vi.fn(), setTicketStatus: vi.fn(),
  setPriceStep: (a: unknown) => h.step(a), upsertTicketType: (a: unknown) => h.upsert(a),
}));
vi.mock('@/lib/featureFlags', () => ({ flags: {} }));
import { formOfType, writeTicket } from '../TicketSheetV2';
import { ticketLine } from '../TicketsV2';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1000 };
const form = { name: 'Class', free: false, price: '12', qty: 40, birds: [] };
const base = { organiserId: 'o', seriesId: 's', seriesLive: true, type, basePence: 1000, form, sold: 3 };
const live = { id: 'l1', effectiveFrom: '2026-01-01T00:00:00Z', pricePence: 1000, isLive: true };
beforeEach(() => { h.remove.mockReset().mockResolvedValue({ ok: true, reason: null }); h.step.mockReset().mockResolvedValue({ ok: true, reason: null }); h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 't1' }); });

describe('sold price change', () => {
  it('replaces a coming sold-price step', async () => {
    const coming = { id: 'c1', effectiveFrom: new Date(Date.now() + 40_000).toISOString(), pricePence: 1100, isLive: false };
    const r = await writeTicket({ ...base, steps: [live, coming] });
    expect(r.ok).toBe(true);
    expect(h.step).toHaveBeenCalledTimes(1);
    expect(h.step.mock.calls[0][0]).toMatchObject({ p_step_id: 'c1', p_price_pence: 1200 });
  });
  it('a different price replaces the pending change', async () => {
    const coming = { id: 'c1', effectiveFrom: new Date(Date.now() + 40_000).toISOString(), pricePence: 1100, isLive: false };
    await writeTicket({ ...base, form: { ...form, price: '13' }, steps: [live, coming] });
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.step.mock.calls[0][0]).toMatchObject({ p_step_id: 'c1', p_price_pence: 1300 });
  });
  it('back to the price before the pending change removes it (never refused as same price)', async () => {
    const coming = { id: 'c1', effectiveFrom: new Date(Date.now() + 40_000).toISOString(), pricePence: 1200, isLive: false };
    const r = await writeTicket({ ...base, form: { ...form, price: '10' }, steps: [live, coming] });
    expect(r).toMatchObject({ ok: true, changed: true });
    expect(h.remove).toHaveBeenCalledWith('c1');
    expect(h.step).not.toHaveBeenCalled();
  });
  it('the pending price typed again sends nothing', async () => {
    const coming = { id: 'c1', effectiveFrom: new Date(Date.now() + 40_000).toISOString(), pricePence: 1200, isLive: false };
    const r = await writeTicket({ ...base, steps: [live, coming] });
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(h.step).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });
  it('the form shows the pending price and no early-bird row for it', () => {
    const coming = { id: 'c1', effectiveFrom: new Date(Date.now() + 40_000).toISOString(), pricePence: 1200, isLive: false };
    const f = formOfType(type, [live, coming], 1000, true);
    expect(f.price).toBe('12.00');
    expect(f.birds).toEqual([]);
  });
  it('adds a new step when only live steps exist', async () => {
    await writeTicket({ ...base, steps: [live] });
    expect(h.step.mock.calls[0][0]).toMatchObject({ p_step_id: null, p_price_pence: 1200 });
  });
});

describe('ticketLine', () => {
  const now = Date.parse('2026-11-27T10:00:00Z');
  it('a step 60 s away is the current price', () => {
    expect(ticketLine(1000, { steps: [{ id: 'c', effectiveFrom: new Date(now + 60_000).toISOString(), pricePence: 1200, isLive: false }] }, now)).toBe('£12');
  });
  it('a step 3 days away keeps the until line', () => {
    expect(ticketLine(1000, { steps: [{ id: 'c', effectiveFrom: new Date(now + 3 * 86_400_000).toISOString(), pricePence: 1200, isLive: false }] }, now)).toContain('£10 until');
  });
});
