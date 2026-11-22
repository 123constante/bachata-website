// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  series: vi.fn(), status: vi.fn(), go: vi.fn(), refetch: vi.fn(), onboardArgs: [] as unknown[],
  onboard: { busy: false, note: null as string | null, switchedOff: false },
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
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripeState === 'none' ? 'none' : h.stripeState, query: { refetch: h.refetch } }),
  useSeriesTypes: () => h.types,
  useSummary: () => ({ ...h.summary, refetch: async () => ({ data: h.summary.data }) }),
  useManagedTypes: () => ({ data: { types: [] } }),
  useStartOnboarding: (...a: unknown[]) => { h.onboardArgs = a; return { go: h.go, ...h.onboard }; },
}));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: unknown) => React.ReactNode }) => <>{children(h.ws)}</> }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...((await orig()) as object), setTicketStatus: (id: string, s: string) => h.status(id, s) }));
import { TicketsV2 } from '../TicketsV2';
import { P3_PATHS } from '../../shell/paths';

const Where = () => <i data-testid="where">{useLocation().search}</i>;
const mk = (format = 'recurring', series: Record<string, unknown> = {}) => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', default_ticket_url: null, passes: null, ...series },
  organiserIds: ['o1'], dates: [{ id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1 }],
}) as unknown as EventWorkspace;
const ty = (id: string, status: string) => ({ id, name: id, status, pricePence: 1000, capacity: 10, occurrenceId: null });
const mount = (ws: EventWorkspace, url = '/') => {
  h.ws = ws;
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><TicketsV2 /><Where /></MemoryRouter></QueryClientProvider>);
};
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));
const sold = (n: number) => { h.summary.data = { ok: true, types: [{ id: 't1', ticketsSold: n, grossPence: n * 1000 }] }; };
const sent = () => h.series.mock.calls.map((c) => (c[0] as { payload: Record<string, unknown> }).payload);
beforeEach(() => {
  h.series.mockReset().mockResolvedValue({ ok: true, new_version: 8 });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.go.mockReset(); h.refetch.mockReset().mockImplementation(async () => ({ data: h.stripeState === 'connected' ? { charges_enabled: true } : null }));
  h.onboard = { busy: false, note: null, switchedOff: false };
  h.stripeState = 'connected';
  h.types.data = []; h.summary.data = { ok: true, types: [] };
});
afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('real Stripe sign-up (SH-STRIPE-01)', () => {
  beforeEach(() => { h.stripeState = 'none'; });
  it('Sell tickets here starts onboarding, returning to this v2 Tickets screen', () => {
    mount(mk());
    expect(h.onboardArgs).toEqual(['o1', undefined, `${P3_PATHS.event('s1')}/tickets`]);
    tap('tk-stripe');
    expect(h.go).toHaveBeenCalledTimes(1);
  });
  it('busy disables the button; an error note and the switched-off line show', () => {
    h.onboard = { busy: true, note: 'Could not reach Stripe.', switchedOff: true };
    mount(mk());
    expect((screen.getByTestId('tk-stripe') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('tk-stripe-note').textContent).toBe('Could not reach Stripe.');
    expect(screen.getByTestId('tk-stripe-off').textContent).toContain('not switched on yet');
  });
});

describe('return from Stripe (SH-STRIPE-02 / 03)', () => {
  it('connected: toast "Stripe connected", query param cleared', async () => {
    mount(mk(), '/?stripe=return');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Stripe connected'));
    expect(screen.getByTestId('where').textContent).toBe('');
    expect(screen.queryByTestId('tk-warn')).toBeNull();
  });
  it('not connected after polling ends: the T-06 warning box, param cleared, no toast', async () => {
    vi.useFakeTimers();
    try {
      h.stripeState = 'none';
      mount(mk(), '/?stripe=return');
      await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
      expect(screen.getByTestId('tk-warn').textContent).toContain('Dancers can’t buy yet');
      expect(screen.queryByTestId('v2-toast')).toBeNull();
      expect(screen.getByTestId('where').textContent).toBe('');
    } finally { vi.useRealTimers(); }
  });
  it('no stripe param: no refetch, no toast', () => {
    mount(mk());
    expect(h.refetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-toast')).toBeNull();
  });
});

describe('Switch how dancers pay (SH-PAY-02 / 03)', () => {
  it.each([[1, '1 ticket already sold here.'], [3, '3 tickets already sold here.']])('%i sold: text, for the door and the link target', async (n, lead) => {
    h.types.data = [ty('t1', 'on_sale')]; sold(n);
    mount(mk());
    tap('tk-payDoor');
    expect((await screen.findByTestId('switch-text')).textContent).toBe(`${lead} Buyers keep their tickets. New buyers will not be able to buy here.`);
    expect(screen.getByText('Switch how dancers pay?')).toBeTruthy();
    tap('switch-keep');
    expect(screen.queryByTestId('switch-text')).toBeNull();
    tap('tk-link');
    await waitFor(() => expect(screen.getByTestId('switch-text').textContent).toContain(lead));
  });
  it('Keep selling closes and writes nothing', async () => {
    h.types.data = [ty('t1', 'on_sale')]; sold(2);
    mount(mk());
    tap('tk-payDoor'); await screen.findByTestId('switch-keep'); tap('switch-keep');
    await new Promise((r) => { setTimeout(r, 20); });
    expect(h.series).not.toHaveBeenCalled();
    expect(h.status).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-toast')).toBeNull();
  });
  it('Switch (door): pauses on-sale types, clears the link, toast + Undo re-opens and restores it', async () => {
    h.types.data = [ty('t1', 'on_sale')]; sold(2);
    mount(mk('recurring', { default_ticket_url: 'https://t.test/x' }));
    tap('tk-payDoor'); await screen.findByTestId('switch-do'); tap('switch-do');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Dancers pay at the door'));
    expect(h.status.mock.calls).toEqual([['t1', 'paused']]);
    expect(sent()[0]).toEqual({ name: 'Thursdays', default_ticket_url: null });
    tap('v2-toast-undo');
    await waitFor(() => expect(h.status.mock.calls).toContainEqual(['t1', 'on_sale']));
    expect(sent()[1]).toEqual({ name: 'Thursdays', default_ticket_url: 'https://t.test/x' });
  });
  it('Switch (link): opens the Link sheet; saving pauses the on-sale types; nothing written before', async () => {
    h.types.data = [ty('t1', 'on_sale')]; sold(2);
    mount(mk());
    tap('tk-link'); await screen.findByTestId('switch-do'); tap('switch-do');
    expect(h.series).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Where dancers buy'), { target: { value: 'https://t.test/y' } });
    tap('link-done');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Dancers buy at your link'));
    expect(h.status.mock.calls).toEqual([['t1', 'paused']]);
    expect(sent()[0]).toEqual({ name: 'Thursdays', default_ticket_url: 'https://t.test/y' });
  });
  it('nothing sold: no Switch sheet (12c direct path)', async () => {
    h.types.data = [ty('t1', 'on_sale')]; sold(0);
    mount(mk());
    tap('tk-payDoor');
    expect(screen.queryByTestId('switch-text')).toBeNull();
    await waitFor(() => expect(h.status.mock.calls).toEqual([['t1', 'paused']]));
  });
  it('sales read not loaded: still a no-op, never switch blind', async () => {
    h.types.data = [ty('t1', 'on_sale')]; h.summary.data = { ok: false };
    mount(mk());
    tap('tk-payDoor'); tap('tk-link');
    await new Promise((r) => { setTimeout(r, 20); });
    expect(screen.queryByTestId('switch-text')).toBeNull();
    expect(screen.queryByTestId('link-done')).toBeNull();
    expect(h.series).not.toHaveBeenCalled();
    expect(h.status).not.toHaveBeenCalled();
  });
});
