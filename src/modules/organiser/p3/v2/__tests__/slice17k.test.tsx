// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ series: vi.fn() }));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (command: unknown, version: number | null, key: string) => net.series(command, version, key),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(),
  saveOccurrenceProgramme: vi.fn(),
}));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EveryBody } from '../EveryBody';
import { OneOffBody } from '../OneOffBody';
import { undoPlan, useSaveNow } from '../saveNow';
import type { WriteStep } from '../editorModel';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const date = (id: string, d: string) => ({ id, occurrence_date: d, lifecycle_status: 'scheduled', version: 1, has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null });
const ws = (life: string, format = 'recurring') => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: life, recurrence_rule: format === 'recurring' ? RULE : null, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [date('a', '2026-11-26'), date('b', '2026-12-03')],
}) as unknown as EventWorkspace;
type Call = [WriteStep[], unknown[], string];
const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);
const mountEvery = (w: EventWorkspace) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={w} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const mountOne = (w: EventWorkspace) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><OneOffBody ws={w} saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const tapEnd = () => fireEvent.click(screen.getByTestId('end-end').querySelector('button')!);
afterEach(cleanup);

describe('slice 17k: End the event Undo wiring', () => {
  it('Every, no date: end_run with before {to, resume:true}; Undo plan is series.resume_run', () => {
    const save = mountEvery(ws('live'));
    tapEnd();
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, before] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command).toEqual({ kind: 'series.end_run', payload: {} });
    expect(before).toEqual([{ to: 'live', resume: true }]);
    expect(undoPlan(steps, before as never)![0].command).toEqual({ kind: 'series.resume_run', payload: {} });
  });
  it('Every, paused event ended: resume still set, to keeps the old state', () => {
    const save = mountEvery(ws('paused'));
    tapEnd();
    fireEvent.click(screen.getByTestId('status-do'));
    expect((save.mock.calls[0] as unknown as Call)[1]).toEqual([{ to: 'paused', resume: true }]);
  });
  it('the Event ended toast carries an Undo button that sends resume_run', async () => {
    net.series.mockReset().mockResolvedValue({ new_version: 9 });
    const h = renderHook(() => useSaveNow('s1', 7), { wrapper: wrap });
    const step: WriteStep = { part: 'Event ended', target: 'series', id: 's1', version: null, command: { kind: 'series.end_run', payload: {} } as never, order: 1 };
    await act(async () => { await h.result.current.saveNow([step], [{ to: 'live', resume: true }], 'Event ended'); });
    expect(h.result.current.toast?.text).toBe('Event ended');
    expect(h.result.current.toast?.onUndo).toBeTypeOf('function');
    net.series.mockClear();
    await act(async () => { h.result.current.toast!.onUndo!(); await Promise.resolve(); await Promise.resolve(); });
    expect(net.series).toHaveBeenCalledWith(expect.objectContaining({ kind: 'series.resume_run', payload: {} }), expect.anything(), expect.anything());
  });
  it('Every, later last date: still set_recurrence, Undo restores the rule', () => {
    const save = mountEvery(ws('live'));
    tapEnd();
    fireEvent.change(screen.getByLabelText('Last night (leave empty to end it today)'), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, before] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command.kind).toBe('series.set_recurrence');
    expect(before).toEqual([RULE]);
    expect(undoPlan(steps, before as never)![0].command.kind).toBe('series.set_recurrence');
  });
  it.each([['live'], ['paused']])('one-off %s, End: before {to}, Undo is set_lifecycle back', (life) => {
    const save = mountOne(ws(life, 'one_off'));
    tapEnd();
    fireEvent.click(screen.getByTestId('status-do'));
    const [steps, before] = save.mock.calls[0] as unknown as Call;
    expect(steps[0].command.kind).toBe('series.end_run');
    expect(before).toEqual([{ to: life }]);
    expect(undoPlan(steps, before as never)![0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: life } });
  });
});
