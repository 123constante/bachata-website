// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';
import type { WorkspaceDate } from '../../../shared/seriesModel';

vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../data/sessions', async (orig) => ({
  ...(await orig<typeof import('../../data/sessions')>()),
  useDateProgramme: (id: string | null) => ({ data: id ? { occurrenceId: 'o1', seriesId: 's1', occurrenceDate: '2026-11-26', version: 5, editable: true, notEditableReason: null, sessions: [], sessionPeople: [] } : undefined, isPending: false }),
}));
import { EveryBody } from '../EveryBody';
import { WhenSheet } from '../WhenSheet';
import { undoPlan } from '../saveNow';
import { eventWorkspaceQueryKey } from '../../../shared/runCommands';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const PROGRAM = [{ day: { id: 'd1', day_index: 0 }, sections: [{ section: { id: 's1', kind: 'classes' }, items: [
  { item: { id: 'i1', type: 'class', title: 'Salsa', start_time: '19:30:00', end_time: '20:15:00', level_keys: ['beginner'] }, people: [] },
] }] }];
const ws = (life = 'live') => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: life, recurrence_rule: RULE, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30:00', default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, program: PROGRAM,
  dates: [{ id: 'a', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1, has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null }],
}) as unknown as EventWorkspace;

const mountEvery = () => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={ws()} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const open = () => { fireEvent.click(screen.getByTestId('fact-when').querySelector('button') ?? screen.getByTestId('fact-when')); };
afterEach(cleanup);

describe('Classes and party (rows 21, 40, 41, 42)', () => {
  it('row 21: the Every When fact opens Classes and party', () => {
    mountEvery(); open();
    expect(screen.getByRole('dialog', { name: 'Classes and party' })).toBeTruthy();
    expect(screen.getAllByTestId('when-row')).toHaveLength(1);
  });
  it('row 40: a session row opens that usual session', () => {
    mountEvery(); open();
    fireEvent.click(screen.getByTestId('when-row'));
    expect(screen.getByRole('dialog', { name: 'Salsa' })).toBeTruthy();
  });
  it('row 41: Add a class or party opens a new session sheet', () => {
    mountEvery(); open();
    fireEvent.click(screen.getByRole('button', { name: 'Add a class or party' }));
    expect(screen.getAllByRole('dialog').length).toBe(2);
  });
  it('editing a usual session writes series.set_program, not a night override', async () => {
    const save = mountEvery(); open();
    fireEvent.click(screen.getByTestId('when-row'));
    const dlg = screen.getByRole('dialog', { name: 'Salsa' });
    fireEvent.change(within(dlg).getByLabelText('Starts'), { target: { value: '19:45' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [steps, before] = save.mock.calls[0] as unknown as [{ target: string; command: { kind: string } }[], { days: unknown[] }[]];
    expect(steps[0]).toMatchObject({ target: 'series', command: { kind: 'series.set_program' } });
    expect(Array.isArray(before[0].days)).toBe(true);
  });
  it('row 42: Done closes with no save and no toast', () => {
    const save = mountEvery(); open();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Classes and party' })).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('Back to the usual times (row 39)', () => {
  const night = (over: Partial<WorkspaceDate> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...over }) as WorkspaceDate;
  const mountNight = (d: WorkspaceDate) => {
    const onSave = vi.fn(async () => ({ ok: true, error: null }));
    const onClose = vi.fn();
    const qc = new QueryClient();
    qc.setQueryData(eventWorkspaceQueryKey('s1'), ws());
    render(<QueryClientProvider client={qc}><WhenSheet date={d} oneOff={false} today="2026-11-22" onSave={onSave} onClose={onClose} /></QueryClientProvider>);
    return { onSave, onClose };
  };
  it('absent when the night runs at the usual time', () => {
    mountNight(night({ materialised_start_utc: '2026-11-26T19:30:00Z' }));
    expect(screen.queryByTestId('when-back-usual')).toBeNull();
  });
  it('present with its own time; tap resets, toasts Back to usual for <date>, Undo restores the start', async () => {
    const { onSave, onClose } = mountNight(night({ materialised_start_utc: '2026-11-26T21:00:00Z' }));
    fireEvent.click(screen.getByTestId('when-back-usual'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as [Parameters<typeof undoPlan>[0], Parameters<typeof undoPlan>[1], string];
    expect(steps[0].command).toEqual({ kind: 'occurrence.set_time', payload: { reset: true } });
    expect(label).toBe('Back to usual for Thursday 26 November');
    expect(undoPlan(steps, before)?.[0].command).toEqual({ kind: 'occurrence.set_time', payload: { new_local_start: '21:00', new_local_end: null } });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('End the event Undo (row 83)', () => {
  const night = { target: 'series' as const, id: 's1', version: 7, part: 'x', order: 1 };
  it('later last date (set_recurrence) has an inverse: Undo restores the rule', () => {
    const step = { ...night, command: { kind: 'series.set_recurrence', payload: { ...RULE, end: { kind: 'until_date', date: '2026-12-10' } } } };
    const plan = undoPlan([step as never], [{ ...RULE }]);
    expect(plan?.[0].command).toEqual({ kind: 'series.set_recurrence', payload: { ...RULE } });
  });
  const endStep = { ...night, command: { kind: 'series.end_run', payload: {} } };
  it('no date (series.end_run) on a weekly event: Undo is series.resume_run {}', () => {
    const plan = undoPlan([endStep as never], [{ to: 'live', resume: true }]);
    expect(plan?.[0].command).toEqual({ kind: 'series.resume_run', payload: {} });
  });
  it('no date (series.end_run) on a one-off: Undo sets the old lifecycle back', () => {
    expect(undoPlan([endStep as never], [{ to: 'live' }])?.[0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
    expect(undoPlan([endStep as never], [{ to: 'paused' }])?.[0].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
  });
  it('no date (series.end_run) with no usable before has no Undo', () => {
    expect(undoPlan([endStep as never], [null])).toBeNull();
    expect(undoPlan([endStep as never], [{}])).toBeNull();
  });
});
