// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  read: vi.fn(), set: vi.fn(), refetch: vi.fn(), stripeState: 'connected' as string,
  types: { data: [] as unknown[] }, summary: { data: { ok: true, types: [] as unknown[] } as unknown },
  ws: null as unknown,
}));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => vi.fn(),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(),
}));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripeState, query: { refetch: h.refetch } }),
  useSeriesTypes: () => h.types,
  useSummary: () => h.summary,
  useManagedTypes: () => ({ data: { types: [] } }),
  useStartOnboarding: () => ({ go: vi.fn(), busy: false, note: null, switchedOff: false }),
}));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: unknown) => React.ReactNode }) => <>{children(h.ws)}</> }));
vi.mock('../../../tickets/ticketsApi', async (orig) => {
  const m = (await orig()) as { parseNightPrices: (d: unknown) => unknown };
  return {
  ...m,
  fetchNightPrices: async (id: string) => m.parseNightPrices(await h.read(id)),
  setNightPrice: (t: string, o: string, p: number | null) => h.set(t, o, p),
  };
});
import { NightPriceSheet, clearNightPriceToast } from '../PriceSheet';

const date = { id: 'n1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [] as string[], session_overrides_count: 0, added_sessions_count: 0, version: 3 };
const ws = () => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', default_ticket_url: null, passes: null },
  organiserIds: ['o1'], dates: [date],
}) as unknown as EventWorkspace;
const ty = (id: string) => ({ id, name: id, status: 'on_sale', pricePence: 1000, capacity: 10, occurrenceId: null });
const nt = (id: string, o: Record<string, unknown> = {}) => ({ ticket_type_id: id, name: id, currency: 'gbp', status: 'on_sale', usual_price_pence: 1000, night_price_pence: null, price_pence: 1000, can_change: true, ...o });
const readOk = (tickets: unknown[]) => ({ ok: true, night_open: true, tickets });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const sheet = (o: { changed?: boolean; onBack?: () => unknown } = {}) => {
  const onClose = vi.fn();
  const onBack = vi.fn(o.onBack ?? (() => ({ ok: true, error: null })));
  render(
    <QueryClientProvider client={client()}><MemoryRouter>
      <NightPriceSheet ws={ws()} date={date as never} detail={undefined} weekly long="Thursday 26 November" day="Thursday" dateWords="Thu 26 Nov"
        oneOff={false} changed={o.changed ?? false} onSave={vi.fn()} onBack={onBack as never} onGoTickets={vi.fn()} onLink={vi.fn()} onClose={onClose} />
    </MemoryRouter></QueryClientProvider>);
  return { onClose, onBack };
};
const field = (name: string) => screen.getByLabelText(new RegExp(name)) as HTMLInputElement;
const type = (name: string, v: string) => fireEvent.change(field(name), { target: { value: v } });
const toast = () => screen.queryByTestId('v2-toast')?.textContent ?? '';
const sentCalls = () => h.set.mock.calls.map((c) => [...c]);
const ok = { ok: true, reason: null };

beforeEach(() => {
  h.read.mockReset().mockResolvedValue(readOk([nt('t1')]));
  h.set.mockReset().mockResolvedValue(ok);
  h.refetch.mockReset().mockResolvedValue({ data: null });
  h.stripeState = 'connected'; h.types.data = [ty('t1')]; h.summary.data = { ok: true, types: [] };
});
afterEach(() => { clearNightPriceToast(); cleanup(); vi.useRealTimers(); });

const saveTwo = async () => {
  h.types.data = [ty('t1'), ty('t2')];
  h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1000 }), nt('t2', { night_price_pence: 800 })]));
  sheet();
  await waitFor(() => expect(field('t1').readOnly).toBe(false));
  type('t1', '12'); type('t2', '9'); fireEvent.click(screen.getByTestId('price-done'));
  await waitFor(() => expect(screen.getByTestId('v2-toast-undo')).toBeTruthy());
  h.set.mockClear();
};

describe('D1 undo rollback uses the price live just before the Undo', () => {
  it('D1a save then Undo, second restore fails: first goes back to 1200 not 1000', async () => {
    await saveTwo();
    h.set.mockImplementation(async (id: string, _o: string, p: number | null) => (id === 't2' && p === 800 ? { ok: false, reason: 'x' } : ok));
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(sentCalls()).toEqual([['t1', 'n1', 1000], ['t2', 'n1', 800], ['t1', 'n1', 1200]]));
  });
  it('D1b Back to usual Undo, second restore fails: first goes back to null', async () => {
    h.types.data = [ty('t1'), ty('t2')];
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1200 }), nt('t2', { night_price_pence: 900 })]));
    sheet();
    fireEvent.click(await screen.findByTestId('price-back'));
    await waitFor(() => expect(screen.getByTestId('v2-toast-undo')).toBeTruthy());
    h.set.mockReset().mockImplementation(async (id: string, _o: string, p: number | null) => (id === 't2' && p === 900 ? { ok: false, reason: 'x' } : ok));
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(sentCalls()).toEqual([['t1', 'n1', 1200], ['t2', 'n1', 900], ['t1', 'n1', null]]));
  });
  it('D1c Undo happy path writes the previous night prices (null when none)', async () => {
    h.types.data = [ty('t1'), ty('t2')];
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1100 }), nt('t2')]));
    sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); type('t2', '15'); fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(screen.getByTestId('v2-toast-undo')).toBeTruthy());
    h.set.mockClear();
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(toast()).toBe('Undone'));
    expect(sentCalls()).toEqual([['t1', 'n1', 1100], ['t2', 'n1', null]]);
  });
});

describe('D2 Back to usual when the night revert fails', () => {
  const setup = async (onBack: () => unknown) => {
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1200 })]));
    const r = sheet({ changed: true, onBack });
    await waitFor(() => expect(field('t1').value).toBe('12'));
    fireEvent.click(await screen.findByTestId('price-back'));
    return r;
  };
  it('D2a onBack ok:false: prices written back, sheet open, failure shown', async () => {
    const { onClose } = await setup(() => ({ ok: false, error: 'x' }));
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe('x'));
    expect(sentCalls()).toEqual([['t1', 'n1', null], ['t1', 'n1', 1200]]);
    expect(onClose).not.toHaveBeenCalled();
  });
  it('D2b onBack throws: prices written back, Not saved shown', async () => {
    const { onClose } = await setup(() => { throw new Error('boom'); });
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe('Not saved. Try again.'));
    expect(sentCalls()).toEqual([['t1', 'n1', null], ['t1', 'n1', 1200]]);
    expect(onClose).not.toHaveBeenCalled();
  });
  it('D2c onBack ok: stays cleared, closes', async () => {
    const { onClose } = await setup(() => ({ ok: true, error: null }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentCalls()).toEqual([['t1', 'n1', null]]);
  });
  it('D2d changed false: no onBack, toast with Undo', async () => {
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1200 })]));
    const { onClose, onBack } = sheet();
    fireEvent.click(await screen.findByTestId('price-back'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onBack).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('v2-toast-undo')).toBeTruthy());
  });
});
