// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  series: vi.fn(), status: vi.fn(), go: vi.fn(), refetch: vi.fn(), fresh: vi.fn(), undoNull: false,
  stripeState: 'connected' as string,
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
vi.mock('../saveNow', async (orig) => {
  const m = (await orig()) as { undoPlan: (...a: unknown[]) => unknown };
  return { ...m, undoPlan: (...a: unknown[]) => (h.undoNull ? null : m.undoPlan(...a)) };
});
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripeState === 'none' ? 'none' : h.stripeState, query: { refetch: h.refetch } }),
  useSeriesTypes: () => h.types,
  useSummary: () => ({ ...h.summary, refetch: () => h.fresh() }),
  useManagedTypes: () => ({ data: { types: [] } }),
  useStartOnboarding: () => ({ go: h.go, busy: false, note: null, switchedOff: false }),
}));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: unknown) => React.ReactNode }) => <>{children(h.ws)}</> }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...((await orig()) as object), setTicketStatus: (id: string, s: string) => h.status(id, s) }));
import { TicketsV2 } from '../TicketsV2';

const Where = () => <i data-testid="where">{useLocation().search}</i>;
const mk = (series: Record<string, unknown> = {}, organiserIds = ['o1']) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', default_ticket_url: null, passes: null, ...series },
  organiserIds, dates: [{ id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1 }],
}) as unknown as EventWorkspace;
const ty = (id: string, status: string) => ({ id, name: id, status, pricePence: 1000, capacity: 10, occurrenceId: null });
const tree = (url: string) => <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><TicketsV2 /><Where /></MemoryRouter></QueryClientProvider>;
const mount = (ws: EventWorkspace, url = '/') => { h.ws = ws; return render(tree(url)); };
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));
const soldOf = (n: number) => ({ data: { ok: true, types: [{ id: 't1', ticketsSold: n, grossPence: n * 1000 }] } });
const toast = () => screen.queryByTestId('v2-toast')?.textContent ?? '';

beforeEach(() => {
  h.series.mockReset().mockResolvedValue({ ok: true, new_version: 8 });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.go.mockReset(); h.refetch.mockReset().mockResolvedValue({ data: null });
  h.undoNull = false; h.stripeState = 'connected';
  h.types.data = []; h.summary.data = { ok: true, types: [] };
  h.fresh.mockReset().mockImplementation(async () => ({ data: h.summary.data }));
  sessionStorage.clear();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); });

describe('1-2 Stripe return', () => {
  it('a late webhook: polls, warns only after the polling ends, and clears the moment connected turns true', async () => {
    vi.useFakeTimers();
    h.stripeState = 'none';
    const view = mount(mk(), '/?stripe=return');
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(h.refetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByTestId('tk-warn')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(21_000); });
    expect(screen.getByTestId('tk-warn')).toBeTruthy();
    h.stripeState = 'connected';
    view.rerender(tree('/?stripe=return'));
    expect(screen.queryByTestId('tk-warn')).toBeNull();
    expect(toast()).toContain('Stripe connected');
  });
  it('refresh (expired link) restarts onboarding, never warns; waits for the organiser, then drops the param', async () => {
    h.stripeState = 'none';
    const view = mount(mk({}, []), '/?stripe=refresh');
    await new Promise((r) => { setTimeout(r, 20); });
    expect(h.go).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('?stripe=refresh');
    h.ws = mk();
    view.rerender(tree('/?stripe=refresh'));
    await waitFor(() => expect(h.go).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('where').textContent).toBe('');
    expect(screen.queryByTestId('tk-warn')).toBeNull();
  });
});

describe('3 write order and rollback', () => {
  const setup = () => { h.types.data = [ty('t1', 'on_sale'), ty('t2', 'on_sale')]; };
  it('the series write is last; if it fails the paused types are put back', async () => {
    setup();
    h.series.mockRejectedValue(new Error('boom'));
    mount(mk({ default_ticket_url: 'https://x.test/a' }));
    tap('tk-payDoor');
    await waitFor(() => expect(toast()).toContain('Not saved'));
    expect(h.status.mock.calls).toEqual([['t1', 'paused'], ['t2', 'paused'], ['t2', 'on_sale'], ['t1', 'on_sale']]);
  });
  it('a type that fails mid-way: finished ones roll back and the series is never written', async () => {
    setup();
    h.status.mockImplementation(async (id: string, s: string) => (id === 't2' && s === 'paused' ? { ok: false, reason: 'no' } : { ok: true, reason: null }));
    mount(mk({ default_ticket_url: 'https://x.test/a' }));
    tap('tk-payDoor');
    await waitFor(() => expect(toast()).toContain('Not saved'));
    expect(h.status.mock.calls).toEqual([['t1', 'paused'], ['t2', 'paused'], ['t1', 'on_sale']]);
    expect(h.series).not.toHaveBeenCalled();
  });
});

describe('4 reopen scope and Undo', () => {
  it('Sell tickets here reopens only the types the switch paused, not one paused by hand', async () => {
    h.types.data = [ty('t1', 'paused'), ty('t2', 'paused')];
    sessionStorage.setItem('v2-paused-by-switch:s1', '["t1"]');
    mount(mk());
    tap('tk-sellHere');
    await waitFor(() => expect(toast()).toContain('Selling tickets here'));
    expect(h.status.mock.calls).toEqual([['t1', 'on_sale']]);
  });
  it('Undo puts back each type’s own prior status and skips one that changed since', async () => {
    h.types.data = [ty('t1', 'on_sale'), ty('t2', 'on_sale')];
    const view = mount(mk());
    tap('tk-payDoor');
    await waitFor(() => expect(toast()).toContain('Dancers pay at the door'));
    h.types.data = [ty('t1', 'paused'), ty('t2', 'closed')];
    view.rerender(tree('/'));
    tap('v2-toast-undo');
    await waitFor(() => expect(toast()).toContain('Undone'));
    expect(h.status.mock.calls).toEqual([['t1', 'paused'], ['t2', 'paused'], ['t1', 'on_sale']]);
  });
});

describe('5 sold guard', () => {
  beforeEach(() => { h.types.data = [ty('t1', 'on_sale')]; });
  it('a stale summary (0 sold) is refetched: fresh sales open the Switch sheet and write nothing', async () => {
    h.summary.data = soldOf(0).data;
    h.fresh.mockResolvedValue(soldOf(3));
    mount(mk());
    tap('tk-payDoor');
    expect((await screen.findByTestId('switch-text')).textContent).toContain('3 tickets already sold');
    expect(h.status).not.toHaveBeenCalled();
  });
  it('a fresh summary that is not ok: nothing acts, it says so, the buttons stay enabled for a retry', async () => {
    h.fresh.mockResolvedValue({ data: { ok: false } });
    mount(mk());
    tap('tk-payDoor');
    await waitFor(() => expect(toast()).toContain('Not saved'));
    expect(h.status).not.toHaveBeenCalled();
    expect(h.series).not.toHaveBeenCalled();
    expect(screen.queryByTestId('link-done')).toBeNull();
    expect((screen.getByTestId('tk-payDoor') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('tk-link') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('6 in-flight guard', () => {
  it('a double tap writes once; the sheet button is disabled and aria-busy while it runs', async () => {
    h.types.data = [ty('t1', 'on_sale')];
    let release: (v: unknown) => void = () => undefined;
    h.series.mockImplementation(() => new Promise((r) => { release = r; }));
    mount(mk());
    tap('tk-link');
    fireEvent.change(await screen.findByLabelText('Where dancers buy'), { target: { value: 'https://t.test/y' } });
    tap('link-done');
    await waitFor(() => expect((screen.getByTestId('link-done') as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByTestId('link-done').getAttribute('aria-busy')).toBe('true');
    tap('link-done');
    await act(async () => { release({ ok: true, new_version: 8 }); });
    await waitFor(() => expect(toast()).toContain('Dancers buy at your link'));
    expect(h.series).toHaveBeenCalledTimes(1);
    expect(h.status.mock.calls).toEqual([['t1', 'paused']]);
  });
});

describe('7 Undo only when it can work', () => {
  it('no inverse for the series write: the toast shows without Undo', async () => {
    h.types.data = [ty('t1', 'on_sale')];
    h.undoNull = true;
    mount(mk({ default_ticket_url: 'https://x.test/a' }));
    tap('tk-payDoor');
    await waitFor(() => expect(toast()).toContain('Dancers pay at the door'));
    expect(screen.queryByTestId('v2-toast-undo')).toBeNull();
  });
  it('nothing changed at all: the toast shows without an Undo that would do nothing', async () => {
    h.types.data = [ty('t1', 'paused')];
    mount(mk());
    tap('tk-sellHere');
    await waitFor(() => expect(toast()).toContain('Selling tickets here'));
    expect(h.status).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-toast-undo')).toBeNull();
  });
});
