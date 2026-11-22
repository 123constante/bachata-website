// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkspaceDate } from '../../../shared/seriesModel';

const prog = vi.hoisted(() => ({ data: undefined as unknown, isPending: false }));
vi.mock('../../data/sessions', async (orig) => ({
  ...(await orig<typeof import('../../data/sessions')>()),
  useDateProgramme: (id: string | null) => ({ data: id ? prog.data : undefined, isPending: false }),
}));
import { ProgSheet, WhenSheet, rowLine } from '../WhenSheet';
import { V2 } from '../copy';
import { toDraft } from '../../../shared/programmeModel';

const wire = (id: string, over: Record<string, unknown> = {}) => ({ id, type: 'class', title: '', start_time: '19:30:00', end_time: '20:15:00', level_keys: ['beginner'], ...over });
const setProg = (sessions: unknown[], over: Record<string, unknown> = {}) => {
  prog.data = { occurrenceId: 'o1', seriesId: 's1', occurrenceDate: '2026-11-26', version: 5, editable: true, notEditableReason: null, sessions, sessionPeople: [], ...over };
};
const date = (over: Partial<WorkspaceDate> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...over }) as WorkspaceDate;

const mount = (over: { oneOff?: boolean; d?: WorkspaceDate } = {}) => {
  const onSave = vi.fn(async () => ({ ok: true, error: null }));
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WhenSheet date={over.d ?? date()} oneOff={!!over.oneOff} today="2026-11-22" onSave={onSave} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onSave, onClose };
};
beforeEach(() => { setProg([wire('b', { title: 'Party', type: 'party', start_time: '21:00:00', end_time: '23:00:00', level_keys: [] }), wire('a', { title: 'Salsa' }), wire('c', { removed: true, title: 'Gone' })]); });
afterEach(cleanup);

describe('WhenSheet rows', () => {
  it('sorted by start, removed hidden, value and second line formatted', () => {
    mount();
    const rows = screen.getAllByTestId('when-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Salsa');
    expect(rows[0].textContent).toContain('19:30 to 20:15');
    expect(rows[1].textContent).toContain('Party');
    expect(screen.queryByText('Gone')).toBeNull();
  });
  it('rowLine joins names with & and levels with commas, omitting empty parts', () => {
    const [d0] = toDraft([wire('a', { level_keys: ['beginner', 'advanced'] })]);
    const r = { ...d0, people: ['Carlos', 'Ana'].map((name, i) => ({ id: `p${i}`, name, role: 'teaching', origin: 'stored' as const, removed: false })) };
    expect(rowLine(r)).toBe('Class · Carlos & Ana · Beginner, Advanced');
    expect(rowLine({ ...r, people: [], levels: [] })).toBe('Class');
  });
  it('weekly shows the long date, no field; one-off shows the field', () => {
    mount();
    expect(screen.getByTestId('when-long').textContent).toBe('Thursday 26 November');
    expect(document.getElementById('w-date')).toBeNull();
    cleanup();
    mount({ oneOff: true });
    expect((document.getElementById('w-date') as HTMLInputElement).value).toBe('2026-11-26');
  });
  it('shows the labels and the hint', () => {
    mount();
    expect(screen.getByText('Tap a class or the party to change its time')).toBeTruthy();
    expect(screen.getByText('The night starts with the first one and ends with the last one.')).toBeTruthy();
  });
  it('no Back to the usual times link (needs an admin reset writer; see handover)', () => {
    mount({ d: date({ session_overrides_count: 1 }) });
    expect(screen.queryByText('Back to the usual times')).toBeNull();
  });
});

describe('WhenSheet writes', () => {
  it('row tap opens the session sheet; Done saves one programme step with the night label', async () => {
    const { onSave } = mount();
    fireEvent.click(screen.getAllByTestId('when-row')[0]);
    const dlg = screen.getByRole('dialog', { name: 'Salsa' });
    fireEvent.change(within(dlg).getByLabelText('Starts'), { target: { value: '19:45' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before, label] = onSave.mock.calls[0] as unknown as [{ target: string; id: string; version: number; part: string; order: number; payload: Record<string, unknown>[] }[], { payload: unknown[] }[], string];
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ target: 'programme', id: 'o1', version: 5, order: 2, part: V2.nightSessions });
    expect(JSON.stringify(steps[0].payload)).toContain('19:45');
    expect(Array.isArray(before[0].payload)).toBe(true);
    expect(label).toBe('Saved for Thursday 26 November only');
  });
  it('Add opens an empty session sheet and appends', async () => {
    const { onSave } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add a class or party' }));
    const dlg = screen.getByRole('dialog', { name: 'Add a class or party' });
    fireEvent.change(within(dlg).getByLabelText('Starts'), { target: { value: '18:00' } });
    fireEvent.change(within(dlg).getByLabelText('Ends'), { target: { value: '19:00' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0] as unknown as [{ payload: unknown[] }[]])[0][0].payload.length).toBe(4);
  });
  it('Remove sends removed: true', async () => {
    const { onSave } = mount();
    fireEvent.click(screen.getAllByTestId('when-row')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove this one' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(JSON.stringify((onSave.mock.calls[0] as unknown as [{ payload: unknown[] }[]])[0][0].payload)).toContain('"removed":true');
  });
  it('a night that cannot change shows the reason instead of the body', () => {
    mount({ d: date({ lifecycle_status: 'cancelled' }) });
    expect(screen.getByTestId('when-why').textContent).toBe(V2.nightSessionsOff.cancelled);
    expect(screen.queryByTestId('when-rows')).toBeNull();
    cleanup();
    mount({ d: date({ occurrence_date: '2026-11-01' }) });
    expect(screen.getByTestId('when-why').textContent).toBe(V2.nightSessionsOff.past);
  });
});

describe('WhenSheet one-off date', () => {
  it('empty date shows the error and saves nothing', () => {
    const { onSave } = mount({ oneOff: true });
    fireEvent.change(document.getElementById('w-date')!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the date' }));
    expect(screen.getByText('Add a date.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('same date just closes', () => {
    const { onSave, onClose } = mount({ oneOff: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save the date' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
  it('a new date saves a move_date step, label Saved, no Undo', async () => {
    const { onSave, onClose } = mount({ oneOff: true });
    fireEvent.change(document.getElementById('w-date')!, { target: { value: '2026-12-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the date' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const c = onSave.mock.calls[0] as unknown as [{ target: string; id: string; version: number; command: unknown }[], unknown, string, { noUndo: boolean }];
    expect(c[0][0]).toMatchObject({ target: 'occurrence', id: 'o1', version: 3, command: { kind: 'occurrence.move_date', payload: { to_date: '2026-12-03' } } });
    expect(c[2]).toBe('Saved');
    expect(c[3]).toEqual({ noUndo: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('ProgSheet', () => {
  const draft = () => toDraft([wire('a', { title: 'Salsa' })]);
  const open = (oneOff: boolean) => {
    const onOpenSession = vi.fn(); const onClose = vi.fn();
    render(<ProgSheet rows={draft()} oneOff={oneOff} onOpenSession={onOpenSession} onClose={onClose} />);
    return { onOpenSession, onClose };
  };
  it('hint differs weekly vs one-off', () => {
    open(false);
    expect(screen.getByText('The usual night. Teachers and DJs are set inside each one.')).toBeTruthy();
    cleanup();
    open(true);
    expect(screen.getByText('Times come from here.')).toBeTruthy();
  });
  it('row and Add hand the row (or null) to the parent; Done closes', () => {
    const { onOpenSession, onClose } = open(false);
    fireEvent.click(screen.getByTestId('when-row'));
    expect(onOpenSession).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Salsa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a class or party' }));
    expect(onOpenSession).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
