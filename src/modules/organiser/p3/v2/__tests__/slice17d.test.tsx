// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ upsert: vi.fn(), status: vi.fn(), setStep: vi.fn(), delStep: vi.fn(), manage: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setPriceStep: (c: unknown) => h.setStep(c),
  removePriceStep: (id: string) => h.delStep(id),
  fetchManagedTypes: () => h.manage(),
}));
import { TicketSheetV2, writeTicket } from '../TicketSheetV2';
import { PriceSheet } from '../PriceSheet';

const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1200, status: 'on_sale' as const };
const base = { organiserId: 'o1', seriesId: 's1', basePence: 1200 };
const sheet = (o: Record<string, unknown> = {}) => {
  const onDone = vi.fn(); const onFail = vi.fn(); const onClose = vi.fn();
  render(<TicketSheetV2 organiserId="o1" seriesId="s1" type={type} basePence={1200} steps={[]} oneOff={false} soldMax={0} soldAll={0} pence={0} onClose={onClose} onDone={onDone} onFail={onFail} {...o} />);
  return { onDone, onFail, onClose };
};
const set = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 'new1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.manage.mockReset().mockResolvedValue({ ok: true, types: [{ id: 't1', basePricePence: 1200, steps: [] }] });
});
afterEach(cleanup);

describe('1 undo of a name-only / places-only edit', () => {
  it('Undo of a name edit writes the old name back', async () => {
    const { onDone } = sheet();
    set('t-name', 'Renamed'); fireEvent.click(screen.getByTestId('t-done'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(h.upsert).toHaveBeenCalledTimes(1);
    await (onDone.mock.calls[0][1] as () => Promise<void>)();
    expect(h.upsert).toHaveBeenCalledTimes(2);
    expect(h.upsert.mock.calls[1][0]).toMatchObject({ id: 't1', name: 'Class', capacity: 40 });
  });
  it('Undo of a places edit writes the old places back', async () => {
    const { onDone } = sheet();
    set('t-qty', '60'); fireEvent.click(screen.getByTestId('t-done'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    await (onDone.mock.calls[0][1] as () => Promise<void>)();
    expect(h.upsert.mock.calls[1][0]).toMatchObject({ capacity: 40 });
  });
  it('a failed step write rolls a name edit back', async () => {
    h.setStep.mockResolvedValue({ ok: false, reason: 'x' });
    sheet({ steps: [{ id: 'st1', effectiveFrom: '2026-12-02T00:00:00Z', pricePence: 1500, isLive: false }] });
    set('t-name', 'Renamed'); set('t-price', '20');
    fireEvent.click(screen.getByTestId('t-done'));
    await waitFor(() => expect(h.upsert.mock.calls.length).toBe(2));
    expect(h.upsert.mock.calls[1][0]).toMatchObject({ name: 'Class' });
  });
});

describe('2 failed new-ticket save', () => {
  it('closes the half-made row so a retry cannot duplicate', async () => {
    h.status.mockResolvedValueOnce({ ok: false, reason: 'x' });
    const { onFail } = sheet({ type: null });
    set('t-name', 'New'); set('t-price', '10');
    fireEvent.click(screen.getByTestId('t-done'));
    await waitFor(() => expect(onFail).toHaveBeenCalled());
    expect(h.status).toHaveBeenCalledWith('new1', 'closed');
  });
});

describe('4 a stored step at another time of day', () => {
  const step = { id: 'st1', effectiveFrom: '2026-12-02T10:00:00Z', pricePence: 1500, isLive: false };
  it('an unrelated edit sends no step write', async () => {
    const r = await writeTicket({ ...base, type, steps: [step], form: { name: 'Other', free: false, price: '15', qty: 40, birds: [{ price: '12', until: '2026-12-01' }] } });
    expect(r.ok).toBe(true);
    expect(h.setStep).not.toHaveBeenCalled();
  });
  it('a live non-midnight step does not block a rename', async () => {
    const r = await writeTicket({ ...base, type, steps: [{ ...step, isLive: true }], form: { name: 'Other', free: false, price: '15', qty: 40, birds: [{ price: '12', until: '2026-12-01' }] } });
    expect(r.ok).toBe(true);
  });
});

describe('5 sold guards while the summary is not known', () => {
  it('Remove is disabled and Done refuses', async () => {
    const { onDone } = sheet({ soldKnown: false });
    expect((screen.getByTestId('t-remove') as HTMLButtonElement).disabled).toBe(true);
    set('t-name', 'Renamed'); fireEvent.click(screen.getByTestId('t-done'));
    await waitFor(() => expect(screen.getByTestId('t-err')).toBeTruthy());
    expect(h.upsert).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

const price = (o: Record<string, unknown> = {}) => render(
  <PriceSheet state="tickets" weekly long="Thu" day="Thursday" doorPrice={null} link={null} tickets={[{ id: 't1', name: 'Early', pence: 1200 }]} changed
    onSaveDoor={async () => ({ ok: true, error: null })} onBack={async () => ({ ok: true })} onGoTickets={vi.fn()} onLink={vi.fn()} onClose={vi.fn()} {...o} />);

describe('6 / 7 price sheet', () => {
  it('tickets state inputs are read-only', () => {
    price();
    expect((screen.getByLabelText(/Early/) as HTMLInputElement).readOnly).toBe(true);
  });
  it('Back to the usual price stays open and shows a failure', async () => {
    const onClose = vi.fn();
    price({ onClose, onBack: async () => ({ ok: false, error: 'Not saved' }) });
    fireEvent.click(screen.getByTestId('price-back'));
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe('Not saved'));
    expect(onClose).not.toHaveBeenCalled();
  });
  it('closes after success', async () => {
    const onClose = vi.fn();
    price({ onClose });
    fireEvent.click(screen.getByTestId('price-back'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
