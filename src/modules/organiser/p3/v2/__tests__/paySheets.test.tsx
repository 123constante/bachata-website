// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  series: vi.fn(), status: vi.fn(),
  types: { data: [] as unknown[] }, summary: { data: { ok: true, types: [] as unknown[] } as unknown },
  ws: null as unknown,
}));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (c: unknown, v: number | null, k: string) => h.series(c, v, k),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(),
}));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: 'connected' }),
  useSeriesTypes: () => h.types,
  useSummary: () => h.summary,
  useManagedTypes: () => ({ data: { types: [] } }),
  useStartOnboarding: () => ({ go: vi.fn(), busy: false, note: null, switchedOff: false }),
}));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: unknown) => React.ReactNode }) => <>{children(h.ws)}</> }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...((await orig()) as object), setTicketStatus: (id: string, s: string) => h.status(id, s) }));
import { TicketsV2 } from '../TicketsV2';
import { NightCard } from '../NightCard';

const UUID = '11111111-1111-4111-8111-111111111111';
const mk = (format: string, series: Record<string, unknown> = {}) => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', default_ticket_url: null, passes: null, ...series },
  organiserIds: ['o1'], dates: [{ id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1 }],
}) as unknown as EventWorkspace;
const ty = (id: string, status: string) => ({ id, name: id, status, pricePence: 1000, capacity: 10, occurrenceId: null });
const mount = (ws: EventWorkspace) => {
  h.ws = ws;
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><TicketsV2 /></MemoryRouter></QueryClientProvider>);
};
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));
const sent = () => h.series.mock.calls.map((c) => (c[0] as { payload: Record<string, unknown> }).payload);
beforeEach(() => {
  h.series.mockReset().mockResolvedValue({ ok: true, new_version: 8 });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.types.data = []; h.summary.data = { ok: true, types: [] };
});
afterEach(cleanup);

describe('door price sheet (SH-DOOR)', () => {
  it('weekly: hint, replaces only the first price, toast "Saved for every Thursday", Undo restores', async () => {
    const passes = [{ id: UUID, name: 'Entry', price: 8, description: 'x' }, { id: '22222222-2222-4222-8222-222222222222', name: 'Late', price: 5 }];
    mount(mk('recurring', { passes }));
    tap('tk-doorUsual');
    expect(screen.getByText('Usual price at the door')).toBeTruthy();
    expect(screen.getByText('Price at the door (\u00a3)')).toBeTruthy();
    expect(screen.getByTestId('door-hint').textContent).toBe('This is the price for every Thursday. Nights you changed keep their own price.');
    fireEvent.change(screen.getByLabelText('Price at the door (\u00a3)'), { target: { value: '10' } });
    tap('door-done');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Saved for every Thursday'));
    expect(sent()[0]).toEqual({ name: 'Thursdays', default_passes: [{ ...passes[0], price: 10 }, passes[1]] });
    tap('v2-toast-undo');
    await waitFor(() => expect(h.series).toHaveBeenCalledTimes(2));
    expect(sent()[1]).toEqual({ name: 'Thursdays', default_passes: passes });
  });
  it('unchanged or empty closes without a save; empty list creates one Entry; one-off has no hint and says Saved', async () => {
    mount(mk('one_off', { passes: [{ id: UUID, name: 'Entry', price: 8 }] }));
    tap('tk-doorUsual');
    tap('door-done');
    expect(h.series).not.toHaveBeenCalled();
    expect(screen.queryByTestId('door-done')).toBeNull();
    cleanup(); h.series.mockClear();
    mount(mk('one_off'));
    tap('tk-doorUsual');
    expect(screen.queryByTestId('door-hint')).toBeNull();
    fireEvent.change(screen.getByLabelText('Price at the door (\u00a3)'), { target: { value: '7.5' } });
    tap('door-done');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Saved'));
    const p = sent()[0].default_passes as { name: string; price: number }[];
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: 'Entry', price: 7.5 });
  });
});

describe('link sheet (SH-PAY-04)', () => {
  it('empty shows "Add a link" and writes nothing; a link saves with toast + Undo', async () => {
    mount(mk('recurring'));
    tap('tk-howPay'); // door mode
    tap('how-link');
    expect(screen.queryByTestId('link-err')).toBeNull();
    tap('link-done');
    expect(screen.getByTestId('link-err').textContent).toBe('Add a link');
    expect(h.series).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Where dancers buy'), { target: { value: 'https://t.test/x' } });
    tap('link-done');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Dancers buy at your link'));
    expect(sent()[0]).toEqual({ name: 'Thursdays', default_ticket_url: 'https://t.test/x' });
    tap('v2-toast-undo');
    await waitFor(() => expect(sent()[1]).toEqual({ name: 'Thursdays', default_ticket_url: null }));
  });
});

describe('pay at the door and sell here', () => {
  it('nothing sold: clears the link, pauses on-sale types, toast + Undo re-opens them', async () => {
    h.types.data = [ty('t1', 'on_sale'), ty('t2', 'draft')];
    mount(mk('recurring', { default_ticket_url: 'https://t.test/x' }));
    tap('tk-payDoor');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Dancers pay at the door'));
    expect(sent()[0]).toEqual({ name: 'Thursdays', default_ticket_url: null });
    expect(h.status.mock.calls).toEqual([['t1', 'paused']]);
    tap('v2-toast-undo');
    await waitFor(() => expect(h.status.mock.calls).toContainEqual(['t1', 'on_sale']));
    expect(sent()[1]).toEqual({ name: 'Thursdays', default_ticket_url: 'https://t.test/x' });
  });
  it('something sold: pay at the door opens the Switch sheet and writes nothing', async () => {
    h.types.data = [ty('t1', 'on_sale')];
    h.summary.data = { ok: true, types: [{ id: 't1', ticketsSold: 2, grossPence: 2000 }] };
    mount(mk('recurring'));
    tap('tk-payDoor');
    expect(screen.getByTestId('switch-text').textContent).toContain('2 tickets already sold here');
    await new Promise((r) => { setTimeout(r, 20); });
    expect(h.series).not.toHaveBeenCalled();
    expect(h.status).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-toast')).toBeNull();
  });
  it('sell here: re-opens paused types, toast, Undo re-pauses', async () => {
    h.types.data = [ty('t1', 'paused')];
    mount(mk('recurring'));
    tap('tk-sellHere');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Selling tickets here'));
    expect(h.status.mock.calls).toEqual([['t1', 'on_sale']]);
    tap('v2-toast-undo');
    await waitFor(() => expect(h.status.mock.calls).toContainEqual(['t1', 'paused']));
  });
  it('sell here with no types shows the selling state; Undo clears it', async () => {
    mount(mk('recurring'));
    tap('tk-sellHere');
    await waitFor(() => expect(screen.getByTestId('tk-hint').textContent).toBe('No tickets yet. Add your first ticket.'));
    tap('v2-toast-undo');
    await waitFor(() => expect(screen.queryByTestId('tk-hint')).toBeNull());
  });
});

describe('How dancers pay (SH-PAY-05/06)', () => {
  it('door mode hides Pay at the door and offers Add a link', () => {
    mount(mk('recurring'));
    tap('tk-howPay');
    expect(screen.getByText('Or tap Sell tickets here to sell on Bachata Calendar again.')).toBeTruthy();
    expect(screen.queryByTestId('how-door')).toBeNull();
    expect(screen.getByTestId('how-link').textContent).toBe('Add a link');
  });
  it('link mode shows Pay at the door and Change the link', () => {
    mount(mk('recurring', { default_ticket_url: 'https://t.test/x' }));
    tap('tk-howPay');
    expect(screen.getByTestId('how-door').textContent).toBe('Pay at the door');
    expect(screen.getByTestId('how-link').textContent).toBe('Change the link');
  });
});

describe('one-off Tickets row (tap 27)', () => {
  it('shows only on a one-off night and calls onOpenTickets', () => {
    const f = vi.fn();
    const date = { id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, version: 1 };
    const w = (fmt: string) => ({ ...mk(fmt), gallery: [], musicStyles: [], endedOn: null, dates: [date] }) as unknown as EventWorkspace;
    const ui = (fmt: string) => <QueryClientProvider client={new QueryClient()}><MemoryRouter><NightCard ws={w(fmt)} date={date as never} onBack={vi.fn()} onOpenTickets={f} /></MemoryRouter></QueryClientProvider>;
    render(ui('one_off'));
    expect(screen.getByTestId('row-goTickets').textContent).toContain('Prices and how dancers pay');
    fireEvent.click(screen.getByTestId('row-goTickets').querySelector('button')!);
    expect(f).toHaveBeenCalledTimes(1);
    cleanup();
    render(ui('recurring'));
    expect(screen.queryByTestId('row-goTickets')).toBeNull();
  });
});
