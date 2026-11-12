// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rowsOf } from '../../data/home';
import { SHAPES, TODAY, homeOf } from '../../screens/__tests__/fixtures';
import { buildEvents } from '../eventsModel';

const h = vi.hoisted(() => ({
  ws: {} as Record<string, unknown>,
  once: vi.fn(async () => ({ ok: true })),
  refetch: vi.fn(),
  bulk: vi.fn(),
  older: { isPending: false, isError: false, data: undefined, refetch: vi.fn() } as Record<string, unknown>,
}));
vi.mock('../../data/olderDates', async (orig) => ({ ...(await orig<object>()), useOlderDates: () => h.older }));
vi.mock('../../../flows/change/bulkApi', () => ({ runBulkCommand: (...a: unknown[]) => h.bulk(...a) }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({ ...(await orig<object>()), fetchCancellationReasons: async () => [{ key: 'rain', label: 'Rain' }] }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => h.ws,
  useSendOnce: () => h.once,
  useRunCommands: () => async () => 1,
  eventWorkspaceQueryKey: (id: string) => ['event-workspace', id],
}));
// The existing date sheets are tested on their own; here only what Events hands them.
vi.mock('../../screens/DateSheet', () => ({
  DateSheets: ({ open }: { open: unknown }) => <div data-testid="date-sheets">{JSON.stringify(open)}</div>,
}));

import { CancelEveryNight, CancelNight, DashEvents, DeleteDraft } from '../DashEvents';

afterEach(cleanup);
beforeEach(() => { h.bulk.mockReset(); h.bulk.mockResolvedValue({ ok: true, affectedIds: [] }); h.once.mockReset(); h.once.mockResolvedValue({ ok: true }); h.refetch.mockReset(); h.older = { isPending: false, isError: false, data: undefined, refetch: vi.fn() }; });

const nightOf = (shape: keyof typeof SHAPES, i = 0) =>
  buildEvents({ rows: rowsOf(homeOf([SHAPES[shape]] as never)), today: TODAY, seat: 'owner', query: '', filter: 'all', shown: 15, showPast: false }).nights[i];
const wsOf = (dates: Array<{ id: string; occurrence_date: string; lifecycle_status?: string }>) => ({
  isPending: false, isError: false, refetch: h.refetch, data: { series: { version: 4 }, dates: dates.map((d) => ({ lifecycle_status: 'scheduled', ...d })) },
});

describe('CancelNight', () => {
  const draw = (night = nightOf('tonight'), onDone = vi.fn()) => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CancelNight night={night} today={TODAY} onDone={onDone} onClose={vi.fn()} /></MemoryRouter></QueryClientProvider>);
    return onDone;
  };

  it('loading: says so, sends nothing', () => {
    h.ws = { isPending: true, isError: false };
    draw();
    expect(screen.getByText(/Loading the night/)).toBeTruthy();
    expect(h.once).not.toHaveBeenCalled();
  });

  it('error: says nothing changed and Try again re-reads', () => {
    h.ws = { isPending: false, isError: true, refetch: h.refetch };
    draw();
    expect(document.body.textContent).toMatch(/Nothing has changed/);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it('not found: the date is not in the event, so it says so and offers no cancel', () => {
    h.ws = wsOf([{ id: 'x', occurrence_date: '2030-01-01' }]);
    draw();
    expect(document.body.textContent).toMatch(/not on the list/);
    expect(screen.queryByTestId('date-sheets')).toBeNull();
  });

  it('several coming nights: scope ask first; "This night only" opens the reason picker', () => {
    const n = nightOf('tonight');
    h.ws = wsOf([{ id: 'a', occurrence_date: n.date as string }, { id: 'b', occurrence_date: '2099-01-01' }]);
    draw(n);
    expect((screen.getByTestId('ev-scope-all') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('date-sheets')).toBeNull();
    fireEvent.click(screen.getByTestId('ev-scope-one'));
    expect(JSON.parse(screen.getByTestId('date-sheets').textContent as string)).toEqual({ kind: 'date', id: 'a', start: 'cancel' });
  });

  const everyNight = () => {
    const n = nightOf('tonight');
    h.ws = wsOf([{ id: 'a', occurrence_date: n.date as string }, { id: 'b', occurrence_date: '2099-01-01' }, { id: 'c', occurrence_date: '2000-01-01' }, { id: 'd', occurrence_date: '2099-02-01', lifecycle_status: 'cancelled' }]);
    const onDone = draw(n);
    fireEvent.click(screen.getByTestId('ev-scope-all'));
    return onDone;
  };

  it('every night: names the count of coming nights (not past or cancelled), sends bulk_cancel with the picked reason', async () => {
    h.bulk.mockResolvedValueOnce({ ok: true, affectedIds: ['a', 'b'] });
    const onDone = everyNight();
    expect(screen.getByTestId('ev-every-body').textContent).toMatch(/cancels 2 nights/);
    expect(h.bulk).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Rain' }));
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(h.bulk.mock.calls[0].slice(0, 3)).toEqual(['tonight', 4, { kind: 'occurrence.bulk_cancel', payload: { occurrence_ids: ['a', 'b'], reason: 'Rain' } }]);
    expect(onDone.mock.calls[0][0].text).toBe('2 nights cancelled.');
  });

  it('every night, error: shown, sheet stays, button back', async () => {
    h.bulk.mockRejectedValueOnce(new Error('boom'));
    const onDone = everyNight();
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(screen.getByTestId('ev-every-error')).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByTestId('ev-every-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('every night, zero coming nights: says so and offers no send', () => {
    render(<QueryClientProvider client={new QueryClient()}><CancelEveryNight seriesId="s" version={1} ids={[]} onDone={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
    expect(screen.getByTestId('ev-every-none')).toBeTruthy();
    expect(screen.queryByTestId('ev-every-confirm')).toBeNull();
  });

  it('over 100 dates: every older page is read, so "every night" counts all coming nights, not the first 100', () => {
    const n = nightOf('tonight');
    const ws = wsOf([{ id: 'a', occurrence_date: n.date as string }]);
    (ws.data as Record<string, unknown>).hasMore = true;
    h.ws = ws;
    h.older = { isPending: false, isError: false, refetch: vi.fn(), data: { complete: true, dates: [{ id: 'o1', occurrence_date: '2099-03-01', lifecycle_status: 'scheduled' }, { id: 'o2', occurrence_date: '2099-04-01', lifecycle_status: 'scheduled' }] } };
    draw(n);
    fireEvent.click(screen.getByTestId('ev-scope-all'));
    expect(screen.getByTestId('ev-every-body').textContent).toMatch(/cancels 3 nights/);
  });

  it('over 100 dates, older read fails: says nothing changed, offers Try again, cancels nothing', () => {
    const ws = wsOf([{ id: 'a', occurrence_date: '2099-01-01' }]);
    (ws.data as Record<string, unknown>).hasMore = true;
    h.ws = ws;
    const refetch = vi.fn();
    h.older = { isPending: false, isError: true, refetch, data: undefined };
    draw();
    expect(screen.getByTestId('ev-older-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ev-scope')).toBeNull();
  });

  it('every night, version conflict: Reload refetches the event and returns to the confirm with the new version', async () => {
    h.bulk.mockRejectedValueOnce(new Error('version_conflict'));
    everyNight();
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(screen.getByTestId('ev-every-conflict')).toBeTruthy());
    expect(screen.queryByTestId('ev-every-confirm')).toBeNull();
    fireEvent.click(screen.getByTestId('ev-every-conflict-reload'));
    await waitFor(() => expect(screen.getByTestId('ev-every-confirm')).toBeTruthy());
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it('every night, after conflict -> Reload -> Confirm: the second send has a NEW key and the refetched version', async () => {
    h.bulk.mockRejectedValueOnce(new Error('version_conflict'));
    const client = new QueryClient();
    const ui = (version: number, onReload?: () => Promise<void>) => (
      <QueryClientProvider client={client}><MemoryRouter><CancelEveryNight seriesId="s1" version={version} ids={['a']} onDone={vi.fn()} onClose={vi.fn()} onReload={onReload} /></MemoryRouter></QueryClientProvider>
    );
    let rerenderTo: (n: number) => void = () => {};
    const onReload = async () => { rerenderTo(9); };
    const view = render(ui(4, onReload));
    rerenderTo = (n) => view.rerender(ui(n, onReload));
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(screen.getByTestId('ev-every-conflict')).toBeTruthy());
    fireEvent.click(screen.getByTestId('ev-every-conflict-reload'));
    await waitFor(() => expect(screen.getByTestId('ev-every-confirm')).toBeTruthy());
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(h.bulk).toHaveBeenCalledTimes(2));
    const [first, second] = h.bulk.mock.calls;
    expect(first[1]).toBe(4);
    expect(second[1]).toBe(9);
    expect(second[3]).not.toBe(first[3]);
  });

  it('every night: after the send the same lists the Change dates screen refreshes are invalidated', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    render(<QueryClientProvider client={client}><CancelEveryNight seriesId="s1" version={2} ids={['a']} onDone={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
    fireEvent.click(screen.getByTestId('ev-every-confirm'));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThanOrEqual(5));
    const keys = spy.mock.calls.map((c) => String((c[0] as { queryKey: unknown[] }).queryKey[0]));
    expect(keys).toEqual(expect.arrayContaining(['series-workspace', 'event-workspace', 'date-detail', 'occurrence-programme']));
  });

  it('one coming night: straight to the cancel step, no list, no scope ask', () => {
    const n = nightOf('tonight');
    h.ws = wsOf([{ id: 'a', occurrence_date: n.date as string }]);
    draw(n);
    expect(screen.queryByTestId('ev-scope')).toBeNull();
    expect(JSON.parse(screen.getByTestId('date-sheets').textContent as string)).toMatchObject({ id: 'a', start: 'cancel' });
  });
});

describe('DeleteDraft', () => {
  const draw = (onDone = vi.fn()) => {
    render(<MemoryRouter><DeleteDraft night={nightOf('draft')} onDone={onDone} onClose={vi.fn()} /></MemoryRouter>);
    return onDone;
  };

  it('while the draft loads: the button is off and says Working', () => {
    h.ws = { isPending: true, isError: false, data: undefined };
    draw();
    const b = screen.getByTestId('ev-delete-confirm') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.textContent).toBe('Working\u2026');
  });

  it('load error: says nothing changed, nothing can be sent', () => {
    h.ws = { isPending: false, isError: true, data: undefined };
    draw();
    expect(document.body.textContent).toMatch(/couldn.t load the draft/);
    const b = screen.getByTestId('ev-delete-confirm') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-describedby')).toBe(screen.getByTestId('ev-delete-load-error').id);
  });

  it('send error: the error is shown, the sheet stays, Done is not called, and the button is back', async () => {
    h.ws = wsOf([]);
    h.once.mockRejectedValueOnce(new Error('boom'));
    const onDone = draw();
    fireEvent.click(screen.getByTestId('ev-delete-confirm'));
    await waitFor(() => expect(screen.getByTestId('ev-delete-error')).toBeTruthy());
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByTestId('ev-delete-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('success: archived, and the words say it can be restored', async () => {
    h.ws = wsOf([]);
    const onDone = draw();
    fireEvent.click(screen.getByTestId('ev-delete-confirm'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0].text).toBe('Draft archived. Your team can restore it.');
  });
});

describe('DashEvents seat', () => {
  it.each([['owner', false], ['manager', false], ['contributor', true], ['viewer', true], ['', true], [undefined, true]])('role %s: view-only is %s', (role, viewOnly) => {
    const page = { id: 'org', role } as never;
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><DashEvents rows={rowsOf(homeOf([SHAPES.tonight] as never))} today={TODAY} page={page} /></MemoryRouter></QueryClientProvider>);
    expect(/page owner or a manager/i.test(document.body.textContent ?? '')).toBe(viewOnly);
  });
});
