// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ upsert: vi.fn(), status: vi.fn(), setStep: vi.fn(), delStep: vi.fn(), flag: { on: true } }));
vi.mock('@/modules/organiser/tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setPriceStep: (c: unknown) => h.setStep(c),
  removePriceStep: (id: string) => h.delStep(id),
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = (await orig()) as { flags: Record<string, unknown> };
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'waysInV2' ? h.flag.on : t[k as string]) }) };
});
import { TicketSheetV2, writeTicket } from '@/modules/organiser/p3/v2/TicketSheetV2';
import { WaysInView } from '@/modules/organiser/p3/v2/WaysIn';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1200, status: 'on_sale' as const };
const form = (price: string, name = 'Class') => ({ name, free: false, price, qty: 40, birds: [] });
const base = { organiserId: 'o1', seriesId: 's1', basePence: 1200, steps: [], type };

beforeEach(() => {
  h.flag.on = true;
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 't1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
});
afterEach(cleanup);

describe('sold ticket new price', () => {
  it('sold + new price + name changed: upsert keeps OLD base, then one step from ~60 s', async () => {
    const t0 = Date.now();
    const r = await writeTicket({ ...base, form: form('15', 'Class 2'), sold: 3 });
    expect(r.ok).toBe(true);
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ pricePence: 1200, name: 'Class 2' });
    expect(h.setStep).toHaveBeenCalledTimes(1);
    const c = h.setStep.mock.calls[0][0];
    expect(c).toMatchObject({ p_ticket_type_id: 't1', p_step_id: null, p_price_pence: 1500 });
    const lead = new Date(c.p_effective_from).getTime() - t0;
    expect(lead).toBeGreaterThan(55_000);
    expect(lead).toBeLessThan(65_000);
  });
  it('sold + new price, name and places unchanged: upsert skipped, step only', async () => {
    const r = await writeTicket({ ...base, form: form('15'), sold: 3 });
    expect(r).toMatchObject({ ok: true, changed: true });
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.setStep).toHaveBeenCalledTimes(1);
  });
  it('unsold + new price: upsert carries the new price, no step', async () => {
    await writeTicket({ ...base, form: form('15'), sold: 0 });
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ pricePence: 1500 });
    expect(h.setStep).not.toHaveBeenCalled();
  });
  it('sold + price unchanged + name changed: upsert only, no step', async () => {
    await writeTicket({ ...base, form: form('12', 'Renamed'), sold: 3 });
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ pricePence: 1200, name: 'Renamed' });
    expect(h.setStep).not.toHaveBeenCalled();
  });
});

describe('price hint', () => {
  const sheet = (soldAll: number) => render(<TicketSheetV2 organiserId="o1" seriesId="s1" type={type} basePence={1200} steps={[]} oneOff={false} soldMax={0} soldAll={soldAll} pence={0} onClose={vi.fn()} onDone={vi.fn()} onFail={vi.fn()} />);
  it('shows only with flag on and sold > 0', () => {
    sheet(2);
    expect(screen.getByTestId('t-price-from-now').textContent).toBe('New price counts from now on.');
    cleanup(); sheet(0);
    expect(screen.queryByTestId('t-price-from-now')).toBeNull();
    cleanup(); h.flag.on = false; sheet(2);
    expect(screen.queryByTestId('t-price-from-now')).toBeNull();
  });
});

describe('Stripe nudge', () => {
  const view = (o: Record<string, unknown> = {}, stripe = vi.fn()) => {
    render(<MemoryRouter><WaysInView name="E" oneOff day="Friday" backTo="/x" stripe={false} stripeReady tickets={[]} dates={[]} door free={false} link={null} festival={false} on={{ stripe }} {...o} /></MemoryRouter>);
    return stripe;
  };
  it('shows for door + no online ticket + Stripe not connected; tap runs the Stripe setup', () => {
    const stripe = view();
    fireEvent.click(screen.getByTestId('wi-stripe-nudge'));
    expect(stripe).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['door off', { door: false }],
    ['has an online ticket', { tickets: [{ id: 'a' }] }],
    ['Stripe connected', { stripe: true }],
    ['Stripe still loading', { stripeReady: false }],
  ])('hidden: %s', (_n, o) => {
    view(o);
    expect(screen.queryByTestId('wi-stripe-nudge')).toBeNull();
  });
});
