// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../screens/CancelEventSheet', () => ({ useCancelReasons: () => ({ data: [{ key: 'v', label: 'Venue not available' }] }) }));
vi.mock('../../tickets/data', () => ({
  useSeriesTypes: () => ({ data: [], isSuccess: true, isError: false, refetch: () => {} }),
  useSummary: () => ({ data: { ok: true, types: [] }, isSuccess: true, isError: false, refetch: () => {} }),
}));
import { EveryBody } from '../EveryBody';
import { CancelEventSheetV2 } from '../StatusSheets';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const date = (id: string, d: string) => ({ id, occurrence_date: d, lifecycle_status: 'scheduled', version: 1, has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null });
const ws = (life: string, over: Record<string, unknown> = {}, dates: unknown[] = [date('a', '2026-11-26'), date('b', '2026-12-03')]) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: life, recurrence_rule: RULE, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: ['org1'], endedOn: null, dates, ...over,
}) as unknown as EventWorkspace;
const mount = (w: EventWorkspace) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={w} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const tap = (id: string) => fireEvent.click(screen.getByTestId(`end-${id}`).querySelector('button')!);
type Call = [{ command: { kind: string; payload: Record<string, unknown> } }[], unknown[], string];
afterEach(cleanup);

describe('status card rows', () => {
  it.each([
    ['live', ['end-pause', 'end-end', 'end-cancel'], ['Pause the event', 'End the event', 'Cancel the event']],
    ['paused', ['end-live', 'end-end', 'end-cancel'], ['Make it live again', 'End the event', 'Cancel the event']],
    ['ended', ['end-live', 'end-cancel'], ['Make it live again', 'Cancel the event']],
    ['cancelled', ['end-live', 'end-cancelled'], ['Make it live again', 'Event cancelled']],
  ])('%s', (life, ids, titles) => {
    mount(ws(life));
    expect(screen.getByText('Pause, end or cancel')).toBeTruthy();
    const rows = Array.from(screen.getByTestId('every-end').querySelectorAll('[data-testid^="end-"]')).map((e) => e.getAttribute('data-testid'));
    expect(rows).toEqual(ids);
    titles.forEach((t) => expect(screen.getByText(t)).toBeTruthy());
  });
  it('second lines', () => {
    mount(ws('paused'));
    expect(screen.getByText('Paused now. Dancers see it as paused.')).toBeTruthy();
    expect(screen.getByText('No new nights after a date you pick. Past nights stay.')).toBeTruthy();
    cleanup();
    mount(ws('live', { endedOn: '2026-12-10' }));
    expect(screen.getByText('Ends after Thursday 10 December. Tap to change the date.')).toBeTruthy();
    expect(screen.getByText('Dancers see every night as cancelled, with your reason.')).toBeTruthy();
  });
  it('cancelled row is static, no chevron', () => {
    mount(ws('cancelled'));
    expect(screen.getByTestId('end-cancelled').querySelector('button')).toBeNull();
    expect(screen.getByTestId('end-cancelled').textContent).not.toContain('›');
  });
  it('Cancel the event row opens the sheet', () => {
    mount(ws('live'));
    tap('cancel');
    expect(screen.getByTestId('cancele-go')).toBeTruthy();
  });
});

describe('status actions', () => {
  it('make it live again: no sheet, one set_lifecycle live, before = old state', () => {
    const save = mount(ws('paused'));
    tap('live');
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
    expect(before).toEqual([{ to: 'paused' }]);
    expect(label).toBe('Event is live again');
  });
  it('pause sheet text, buttons, save', async () => {
    const save = mount(ws('live'));
    tap('pause');
    expect(screen.getByText('Pause the event?')).toBeTruthy();
    expect(screen.getByText('Dancers see it as paused. You can start it again any time.')).toBeTruthy();
    expect(screen.getByText('Keep it live')).toBeTruthy();
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
    expect(before).toEqual([{ to: 'live' }]);
    expect(label).toBe('Event paused');
    await waitFor(() => expect(screen.queryByTestId('v2-sheet')).toBeNull());
  });
  it('keep paths send nothing', () => {
    const save = mount(ws('paused'));
    tap('end');
    expect(screen.getByText('Keep it paused')).toBeTruthy();
    fireEvent.click(screen.getByTestId('status-keep'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('end with no date: series.end_run', () => {
    const save = mount(ws('live'));
    tap('end');
    expect(screen.getByText('End the event?')).toBeTruthy();
    expect(screen.getByText('No new nights after the date you pick. Past nights stay.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, , label] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command).toEqual({ kind: 'series.end_run', payload: {} });
    expect(label).toBe('Event ended');
  });
  it('end with a later last night keeps status: set_recurrence until_date', () => {
    const save = mount(ws('live'));
    tap('end');
    fireEvent.change(screen.getByLabelText('Last night (leave empty to end it today)'), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command.kind).toBe('series.set_recurrence');
    expect(steps[0].command.payload).toMatchObject({ weekdays: [4], end: { kind: 'until_date', date: '2026-12-10' } });
    expect(before).toEqual([RULE]);
    expect(label).toBe('Ends after Thursday 10 December');
  });
  it('wrong weekday is refused with a line', () => {
    const save = mount(ws('live'));
    tap('end');
    fireEvent.change(screen.getByLabelText('Last night (leave empty to end it today)'), { target: { value: '2026-12-11' } });
    fireEvent.click(screen.getByTestId('status-do'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('status-error').textContent).toBe('The last date must be a Thursday.');
  });
  it('a date today needs the tonight answer', () => {
    const save = mount(ws('live', {}, [date('t', '2026-11-22')]));
    tap('end');
    expect((screen.getByTestId('status-do') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('No'));
    fireEvent.click(screen.getByTestId('status-do'));
    expect((save.mock.calls[0] as unknown as Call)[0][0].command).toEqual({ kind: 'series.end_run', payload: { today_session: 'not_running' } });
  });
});

describe('Cancel the event sheet (built, not mounted)', () => {
  it('text, sold warning, reason, buttons', () => {
    const onCancel = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><CancelEventSheetV2 soldCount={3} onCancel={onCancel} onClose={() => {}} /></QueryClientProvider>);
    expect(screen.getByText('Every upcoming date shows Cancelled and your reason to dancers.')).toBeTruthy();
    expect(screen.getByText('3 tickets sold. We will email buyers. Refunds are sorted separately.')).toBeTruthy();
    expect(screen.getByText('Keep the event')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cancele-go'));
    expect(onCancel).toHaveBeenCalledWith('Venue not available');
  });
});

const nd = (id: string, d: string, life = 'scheduled') => ({ ...date(id, d), lifecycle_status: life });
const mixed = () => ws('live', {}, [nd('p', '2026-11-12'), nd('a', '2026-11-26'), nd('b', '2026-12-03', 'cancelled'), nd('c', '2026-12-10')]);

describe('cancel the whole event', () => {
  it('one occurrence.cancel per coming not-cancelled night, one save, no undo', async () => {
    const save = mount(mixed());
    tap('cancel');
    fireEvent.click(screen.getByTestId('cancele-go'));
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(save.mock.calls.length).toBe(1);
    expect(steps.map((s) => s.command)).toEqual([
      { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue not available' } },
      { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Venue not available' } },
    ]);
    expect((steps as unknown as { id: string }[]).map((s) => s.id)).toEqual(['a', 'c']);
    expect(before).toEqual([]);
    expect(label).toBe('Event cancelled');
    expect((save.mock.calls[0] as unknown[])[3]).toEqual({ noUndo: true });
    await waitFor(() => expect(screen.queryByTestId('v2-sheet')).toBeNull());
  });
  it('No reason sends an empty reason', () => {
    const save = mount(mixed());
    tap('cancel');
    fireEvent.click(screen.getByLabelText('No reason'));
    fireEvent.click(screen.getByTestId('cancele-go'));
    expect((save.mock.calls[0] as unknown as Call)[0][0].command.payload).toEqual({ cancelled: true, reason: '' });
  });
  it('Keep the event sends nothing', () => {
    const save = mount(mixed());
    tap('cancel');
    fireEvent.click(screen.getByTestId('cancele-keep'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('failure shows the error and the sheet stays open', async () => {
    const save = vi.fn(async () => ({ ok: false, error: 'Nope' }));
    render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={mixed()} day="Thursday" saveNow={save} /></QueryClientProvider>);
    tap('cancel');
    fireEvent.click(screen.getByTestId('cancele-go'));
    await waitFor(() => expect(screen.getByText('Nope')).toBeTruthy());
    expect(screen.getByTestId('cancele-go')).toBeTruthy();
  });
  it('every coming night cancelled: static row + pill, live again uncancels each', () => {
    const save = mount(ws('live', {}, [nd('p', '2026-11-12'), nd('a', '2026-11-26', 'cancelled'), nd('b', '2026-12-03', 'cancelled')]));
    expect(screen.getByTestId('end-cancelled').querySelector('button')).toBeNull();
    expect(screen.getByTestId('every-card').textContent).toContain('Cancelled');
    tap('live');
    const [steps, , label] = save.mock.calls[0] as unknown as Call;
    expect(steps.map((s) => s.command)).toEqual([{ kind: 'occurrence.cancel', payload: { cancelled: false } }, { kind: 'occurrence.cancel', payload: { cancelled: false } }]);
    expect(label).toBe('Event is live again');
  });
});
