// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkspaceDate } from '../../../shared/seriesModel';
import { parseProgramme, toDraft } from '../../../shared/programmeModel';

const fetchProg = vi.hoisted(() => vi.fn());
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchOccurrenceProgramme: fetchProg,
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserTeachersForward' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
const prog = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('../../data/sessions', async (orig) => ({
  ...(await orig<typeof import('../../data/sessions')>()),
  useDateProgramme: (id: string | null) => ({ data: id ? prog.data : undefined, isPending: false }),
}));
import { WhenSheet } from '../WhenSheet';
import { FWD, buildForward, laterNights, matchClass, teachersChanged, teachersOf, withTeachers } from '../forwardTeachers';

const wire = (over: Record<string, unknown> = {}) => ({ series_item_id: 'i1', type: 'class', title: '', start_time: '19:30:00', end_time: '20:15:00', level_keys: ['beginner'], ...over });
const person = (id: string, role = 'teaching') => ({ profile_id: id, display_name: id, role });
const progOf = (sessions: unknown[], people: unknown[][], over: Record<string, unknown> = {}) =>
  parseProgramme({ occurrence_id: 'x', version: 2, editable: true, sessions, session_people: people.map((p, i) => ({ series_item_id: (sessions[i] as { series_item_id: string }).series_item_id, people: p })), ...over });
const drafts = (sessions: unknown[], people: unknown[][]) => toDraft(progOf(sessions, people).sessions, progOf(sessions, people).sessionPeople);
const d = (id: string, date: string, over: Partial<WorkspaceDate> = {}) => ({ id, occurrence_date: date, version: 1, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...over }) as WorkspaceDate;

afterEach(() => { cleanup(); fetchProg.mockReset(); flag.on = true; });

describe('forwardTeachers helpers', () => {
  it('teachersOf ignores removed and DJs; teachersChanged compares the set', () => {
    const [a] = drafts([wire()], [[person('t1'), person('t2'), person('j1', 'djing')]]);
    expect(teachersOf(a)).toEqual(['t1', 't2']);
    const b = { ...a, people: a.people!.map((p) => (p.id === 't2' ? { ...p, removed: true } : p)) };
    expect(teachersChanged(a, b)).toBe(true);
    expect(teachersChanged(a, { ...a, people: [...a.people!].reverse() })).toBe(false);
  });
  it('laterNights skips earlier, cancelled and past nights and sorts', () => {
    const from = d('a', '2026-12-03');
    const out = laterNights([d('e', '2026-12-17'), d('b', '2026-12-10'), d('c', '2026-12-24', { lifecycle_status: 'cancelled' }), from, d('z', '2026-11-01')], from, '2026-11-26');
    expect(out.map((x) => x.id)).toEqual(['b', 'e']);
  });
  it('matchClass: series by key, one-night class by type and start', () => {
    const [edited] = drafts([wire()], [[person('t1')]]);
    const other = drafts([wire({ series_item_id: 'i2', start_time: '21:00:00' }), wire()], [[], []]);
    expect(matchClass(other, edited)?.key).toBe(edited.key);
    expect(matchClass(other.slice(0, 1), edited)).toBeNull();
    const added = { ...edited, key: 'a:1', original: { added_session_id: 'n1' } };
    const night = drafts([wire({ series_item_id: 'i9', start_time: '19:30:00' })], [[]]);
    expect(matchClass(night, added)?.key).toBe(night[0].key);
    expect(matchClass(night, { ...added, start: '20:00' })).toBeNull();
  });
  it('withTeachers swaps teachers and leaves DJs alone', () => {
    const [edited] = drafts([wire()], [[person('t1'), person('t3')]]);
    const [row] = drafts([wire()], [[person('t1'), person('t2'), person('j1', 'djing')]]);
    const next = withTeachers(row, edited);
    const live = next.people!.filter((p) => !p.removed).map((p) => p.id).sort();
    expect(live).toEqual(['j1', 't1', 't3']);
    expect(next.people!.find((p) => p.id === 't2')?.removed).toBe(true);
  });
});

describe('buildForward', () => {
  it('one step per matching editable night, counts the rest as skipped', async () => {
    const [edited] = drafts([wire()], [[person('t9')]]);
    fetchProg.mockImplementation(async (id: string) => {
      if (id === 'n1') return progOf([wire()], [[person('t1')]], { version: 7 });
      if (id === 'n2') return progOf([wire({ series_item_id: 'other' })], [[]]);
      return progOf([wire()], [[]], { editable: false });
    });
    const r = await buildForward(edited, [d('n1', '2026-12-03'), d('n2', '2026-12-10'), d('n3', '2026-12-17')]);
    expect(r.changed).toBe(1);
    expect(r.skipped).toBe(2);
    expect(r.steps).toHaveLength(1);
    expect(r.before).toHaveLength(1);
    expect(r.steps[0]).toMatchObject({ target: 'programme', id: 'n1', version: 7, order: 2 });
    expect(JSON.stringify(r.steps[0].payload)).toContain('t9');
  });
});

const mount = (later: WorkspaceDate[], oneOff = false) => {
  prog.data = progOf([wire({ title: 'Salsa' })], [[person('t1')]], { version: 5 });
  const onSave = vi.fn(async () => ({ ok: true, error: null }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WhenSheet date={d('o1', '2026-11-26')} laterDates={later} oneOff={oneOff} today="2026-11-22" onSave={onSave} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return onSave;
};

describe('WhenSheet teachers question', () => {
  it('no question when only the time changes; saves as before', async () => {
    const onSave = mount([d('n1', '2026-12-03')]);
    fireEvent.click(screen.getAllByTestId('when-row')[0]);
    const dlg = screen.getByRole('dialog', { name: 'Salsa' });
    fireEvent.change(within(dlg).getByLabelText('Starts'), { target: { value: '19:45' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(FWD.title)).toBeNull();
  });
  it('flag off: no question component is reachable and the keep-list renders', () => {
    flag.on = false;
    mount([d('n1', '2026-12-03')]);
    expect(screen.getAllByTestId('when-row')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add a class or party' })).toBeTruthy();
  });
});
