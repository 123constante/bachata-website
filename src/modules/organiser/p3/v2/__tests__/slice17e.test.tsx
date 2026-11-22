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
import { TicketsV2 } from '../TicketsV2';
import { NightPriceSheet, clearNightPriceToast } from '../PriceSheet';
import { parseSummary, parseNightPrices } from '../../../tickets/ticketsApi';

const date = { id: 'n1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [] as string[], session_overrides_count: 0, added_sessions_count: 0, version: 3 };
const ws = (dates: unknown[] = [date]) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', default_ticket_url: null, passes: null },
  organiserIds: ['o1'], dates,
}) as unknown as EventWorkspace;
const ty = (id: string, o: Record<string, unknown> = {}) => ({ id, name: id, status: 'on_sale', pricePence: 1000, capacity: 10, occurrenceId: null, ...o });
const nt = (id: string, o: Record<string, unknown> = {}) => ({ ticket_type_id: id, name: id, currency: 'gbp', status: 'on_sale', usual_price_pence: 1000, night_price_pence: null, price_pence: 1000, can_change: true, ...o });
const readOk = (tickets: unknown[]) => ({ ok: true, night_open: true, tickets });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const sheet = (o: { onClose?: () => void; changed?: boolean } = {}) => {
  const onClose = o.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={client()}><MemoryRouter>
      <NightPriceSheet ws={ws()} date={date as never} detail={undefined} weekly long="Thursday 26 November" day="Thursday" dateWords="Thu 26 Nov"
        oneOff={false} changed={o.changed ?? false} onSave={vi.fn()} onBack={vi.fn()} onGoTickets={vi.fn()} onLink={vi.fn()} onClose={onClose} />
    </MemoryRouter></QueryClientProvider>);
  return { onClose };
};
const field = (name: string) => screen.getByLabelText(new RegExp(name)) as HTMLInputElement;
const type = (name: string, v: string) => fireEvent.change(field(name), { target: { value: v } });
const done = () => fireEvent.click(screen.getByTestId('price-done'));
const toast = () => screen.queryByTestId('v2-toast')?.textContent ?? '';
const sentCalls = () => h.set.mock.calls.map((c) => [...c]);

beforeEach(() => {
  h.read.mockReset().mockResolvedValue(readOk([nt('t1')]));
  h.set.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.refetch.mockReset().mockResolvedValue({ data: null });
  h.stripeState = 'connected'; h.types.data = [ty('t1')]; h.summary.data = { ok: true, types: [] };
});
afterEach(() => { clearNightPriceToast(); cleanup(); vi.useRealTimers(); });

describe('1b read', () => {
  it('shows night price (12) over usual (10), editable', async () => {
    h.read.mockResolvedValue(readOk([nt('t1', { usual_price_pence: 1000, night_price_pence: 1200 })]));
    sheet();
    await waitFor(() => expect(field('t1').value).toBe('12'));
    expect(field('t1').readOnly).toBe(false);
  });
  it('loading or ok:false: read-only, Done closes, no write', async () => {
    h.read.mockResolvedValue({ ok: false, reason: 'not_allowed' });
    const { onClose } = sheet();
    await screen.findByTestId('price-sheet');
    await waitFor(() => expect(h.read).toHaveBeenCalled());
    expect(field('t1').readOnly).toBe(true);
    done();
    expect(onClose).toHaveBeenCalled();
    expect(h.set).not.toHaveBeenCalled();
  });
  it('can_change false: read-only, Done writes nothing', async () => {
    h.read.mockResolvedValue(readOk([nt('t1', { can_change: false })]));
    const { onClose } = sheet();
    await waitFor(() => expect(h.read).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(field('t1').readOnly).toBe(true);
    done();
    expect(onClose).toHaveBeenCalled();
    expect(h.set).not.toHaveBeenCalled();
  });
});

describe('1c Done', () => {
  it('10 -> 12 writes once (id, night, 1200), closes, toast with Undo', async () => {
    const { onClose } = sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); done();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentCalls()).toEqual([['t1', 'n1', 1200]]);
    await waitFor(() => expect(toast()).toContain('Saved for Thu 26 Nov only'));
    expect(screen.getByTestId('v2-toast-undo')).toBeTruthy();
  });
  it('empty or unchanged: no write, closes', async () => {
    const { onClose } = sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', ''); done();
    expect(onClose).toHaveBeenCalledTimes(1);
    type('t1', '10'); done();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(h.set).not.toHaveBeenCalled();
  });
  it.each(['0', '-5'])('entered %s: bad-price line, no write, stays open', async (v) => {
    const { onClose } = sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', v); done();
    expect(screen.getByTestId('price-err').textContent).toBe('Enter a price like 8 or 8.50.');
    expect(h.set).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('double tap on Done: one write', async () => {
    h.set.mockImplementation(() => new Promise((r) => { setTimeout(() => r({ ok: true, reason: null }), 20); }));
    sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); done(); done();
    await waitFor(() => expect(toast()).toContain('Saved'));
    expect(h.set).toHaveBeenCalledTimes(1);
  });
});

describe('1d partial failure', () => {
  it('second of two fails: first is put back (null), line shown, sheet open', async () => {
    h.types.data = [ty('t1'), ty('t2')];
    h.read.mockResolvedValue(readOk([nt('t1'), nt('t2')]));
    h.set.mockImplementation(async (id: string, _o: string, p: number | null) => (id === 't2' && p === 1500 ? { ok: false, reason: 'x' } : { ok: true, reason: null }));
    const { onClose } = sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); type('t2', '15'); done();
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe('Not saved. Try again.'));
    expect(sentCalls()).toEqual([['t1', 'n1', 1200], ['t2', 'n1', 1500], ['t1', 'n1', null]]);
    expect(onClose).not.toHaveBeenCalled();
    expect(toast()).toBe('');
  });
});

describe('1e Undo', () => {
  it('writes the previous night price back (1100), null when there was none', async () => {
    h.types.data = [ty('t1'), ty('t2')];
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1100 }), nt('t2')]));
    sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); type('t2', '15'); done();
    await waitFor(() => expect(screen.getByTestId('v2-toast-undo')).toBeTruthy());
    h.set.mockClear();
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(toast()).toBe('Undone'));
    expect(sentCalls()).toEqual([['t1', 'n1', 1100], ['t2', 'n1', null]]);
  });
});

describe('1f Back to the usual prices', () => {
  it('hidden with no night price', async () => {
    sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    expect(screen.queryByTestId('price-back')).toBeNull();
  });
  it('shown with one; writes null per overridden ticket; toast + Undo restores', async () => {
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1200 }), nt('t2')]));
    const { onClose } = sheet();
    fireEvent.click(await screen.findByTestId('price-back'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentCalls()).toEqual([['t1', 'n1', null]]);
    await waitFor(() => expect(toast()).toContain('Back to usual for Thu 26 Nov'));
    h.set.mockClear();
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(toast()).toBe('Undone'));
    expect(sentCalls()).toEqual([['t1', 'n1', 1200]]);
  });
  it('a failure keeps the sheet open with the line', async () => {
    h.read.mockResolvedValue(readOk([nt('t1', { night_price_pence: 1200 })]));
    h.set.mockResolvedValue({ ok: false, reason: 'x' });
    const { onClose } = sheet();
    fireEvent.click(await screen.findByTestId('price-back'));
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe('Not saved. Try again.'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('1g refusals', () => {
  it.each([
    ['night_past', 'This night has gone.'], ['night_cancelled', 'This night has gone.'],
    ['not_owner_or_admin', 'This price list can’t be changed here.'], ['invalid_price', 'Not saved. Try again.'],
  ])('%s', async (reason, line) => {
    h.set.mockResolvedValue({ ok: false, reason });
    sheet();
    await waitFor(() => expect(field('t1').readOnly).toBe(false));
    type('t1', '12'); done();
    await waitFor(() => expect(screen.getByTestId('price-err').textContent).toBe(line));
  });
});

describe('2a parseSummary / parseNightPrices', () => {
  const row = { id: 't1', event_series_id: 's1', name: 'A', status: 'on_sale', price_pence: 1000, tickets_sold: 8, gross_pence: 8000, nights: [{ occurrence_id: 'n1', tickets_sold: 3, gross_pence: 3000 }] };
  it('reads nights; money-hidden keeps counts and no pence keys', () => {
    const r = parseSummary({ ok: true, money_visible: false, ticket_types: [row] });
    expect(r.types[0].nights).toEqual([{ occurrenceId: 'n1', ticketsSold: 3 }]);
    expect(Object.keys(r.types[0]).some((k) => /pence/i.test(k) && (r.types[0] as never)[k] !== 0)).toBe(false);
    expect(r.types[0].grossPence).toBe(0);
  });
  it('a missing nights is []', () => {
    expect(parseSummary({ ok: true, money_visible: true, ticket_types: [{ ...row, nights: undefined }] }).types[0].nights).toEqual([]);
  });
  it('night prices fail closed', () => {
    expect(parseNightPrices({ ok: false, reason: 'not_allowed' }).tickets).toEqual([]);
    expect(parseNightPrices(readOk([nt('t1', { night_price_pence: 1200 })])).tickets[0]).toMatchObject({ usualPence: 1000, nightPence: 1200, canChange: true });
  });
});

describe('2b per-date sold on the Tickets screen', () => {
  const dates = [
    { id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1 },
    { id: 'd2', occurrence_date: '2026-12-03', lifecycle_status: 'scheduled', version: 1 },
  ];
  const mount = () => { h.ws = ws(dates); return render(<QueryClientProvider client={client()}><MemoryRouter><TicketsV2 /></MemoryRouter></QueryClientProvider>); };
  const lines = () => [...screen.getByTestId('tk-ticket-t1').querySelectorAll('.plist span span:nth-child(2)')].map((e) => e.textContent);
  it('series-wide ticket uses the summary nights (3 and 5); old code showed 0 0', () => {
    h.types.data = [ty('t1')];
    h.summary.data = { ok: true, types: [{ id: 't1', ticketsSold: 8, grossPence: 0, nights: [{ occurrenceId: 'd1', ticketsSold: 3 }, { occurrenceId: 'd2', ticketsSold: 5 }] }] };
    mount();
    expect(lines()).toEqual(['3 of 10', '5 of 10']);
  });
  it('night-bound ticket unchanged; failed summary shows 0', () => {
    h.types.data = [ty('t1', { occurrenceId: 'd2' })];
    h.summary.data = { ok: true, types: [{ id: 't1', ticketsSold: 4, grossPence: 0, nights: [{ occurrenceId: 'd1', ticketsSold: 9 }] }] };
    mount();
    expect(lines()).toEqual(['0 of 10', '4 of 10']);
    cleanup();
    h.types.data = [ty('t1')];
    h.summary.data = { ok: false, types: [] };
    mount();
    expect(lines()).toEqual(['0 of 10', '0 of 10']);
  });
});

describe('3a Check again', () => {
  const mount = (url: string) => { h.ws = ws(); return render(<QueryClientProvider client={client()}><MemoryRouter initialEntries={[url]}><TicketsV2 /></MemoryRouter></QueryClientProvider>); };
  it('timed out and not connected: button restarts the poll and hides the warn while checking', async () => {
    vi.useFakeTimers();
    h.stripeState = 'none';
    mount('/?stripe=return');
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(screen.getByTestId('tk-warn')).toBeTruthy();
    const before = h.refetch.mock.calls.length;
    fireEvent.click(screen.getByTestId('tk-check-again'));
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(h.refetch.mock.calls.length).toBeGreaterThan(before);
    expect(screen.queryByTestId('tk-warn')).toBeNull();
    expect(screen.queryByTestId('tk-check-again')).toBeNull();
  });
  it('still polling, or connected: no button', async () => {
    vi.useFakeTimers();
    h.stripeState = 'none';
    mount('/?stripe=return');
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.queryByTestId('tk-check-again')).toBeNull();
    cleanup();
    h.stripeState = 'connected';
    mount('/');
    expect(screen.queryByTestId('tk-check-again')).toBeNull();
  });
});
