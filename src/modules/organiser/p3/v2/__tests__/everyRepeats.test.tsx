// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({
  fetchOrganiserPages: async () => [],
  useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }),
}));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EveryBody } from '../EveryBody';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const date = (id: string, d: string, over: Record<string, unknown> = {}) => ({ id, occurrence_date: d, lifecycle_status: 'scheduled', version: 1, has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...over });
const ws = (dates: unknown[] = [], endedOn: string | null = null) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', recurrence_rule: RULE, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn, dates,
}) as unknown as EventWorkspace;
const NIGHTS = [
  date('a', '2026-11-26'),
  date('b', '2026-12-03', { lifecycle_status: 'cancelled' }),
  date('c', '2026-12-10', { has_override: true, override_keys: ['default_description'] }),
];
const mount = (w = ws(NIGHTS)) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={w} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  fireEvent.click(screen.getByTestId('row-repeats').querySelector('button')!);
  return saveNow;
};
const pick = (day: string) => fireEvent.change(screen.getByLabelText('Every'), { target: { value: String(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)) } });
const endField = () => screen.getByLabelText('Last date (leave empty for no end date)');
afterEach(cleanup);

describe('Repeats sheet', () => {
  it('opens with the seven days, current selected', () => {
    mount();
    expect(screen.getAllByText('Repeats').length).toBeGreaterThan(1);
    const sel = screen.getByLabelText('Every') as HTMLSelectElement;
    expect(sel.options.length).toBe(7);
    expect(sel.value).toBe('4');
  });
  it('no change: Done closes, nothing saved', () => {
    const save = mount();
    fireEvent.click(screen.getByTestId('repeat-done'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('day change with no own-change nights sends one set_recurrence, before = old rule', async () => {
    const save = mount(ws([date('a', '2026-11-26')]));
    pick('Friday');
    fireEvent.click(screen.getByTestId('repeat-done'));
    expect(save).toHaveBeenCalledTimes(1);
    const [steps, before, label] = save.mock.calls[0] as unknown as [{ command: { kind: string; payload: Record<string, unknown> } }[], unknown[], string];
    expect(steps).toHaveLength(1);
    expect(steps[0].command.kind).toBe('series.set_recurrence');
    expect(steps[0].command.payload).toMatchObject({ weekdays: [5], end: { kind: 'none' } });
    expect(before).toEqual([RULE]);
    expect(label).toBe('Saved');
  });
  it('day change with own-change nights asks first, saves only on Change repeat', () => {
    const save = mount();
    pick('Friday');
    fireEvent.click(screen.getByTestId('repeat-done'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getAllByText('Change repeat?').length).toBeGreaterThan(0);
    expect(screen.getByText('These dates have their own changes. They will be removed:')).toBeTruthy();
    const rows = screen.getAllByTestId('lost-row').map((r) => r.textContent);
    expect(rows).toEqual(['Thursday 3 DecemberCancelled', 'Thursday 10 DecemberChanged']);
    fireEvent.click(screen.getByTestId('repeat-change'));
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('Keep the current repeat closes, no save', () => {
    const save = mount();
    pick('Friday');
    fireEvent.click(screen.getByTestId('repeat-done'));
    fireEvent.click(screen.getByTestId('repeat-keep'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('a last date after the changes counts as lost; before them it does not', () => {
    const save = mount();
    fireEvent.change(endField(), { target: { value: '2026-12-03' } });
    fireEvent.click(screen.getByTestId('repeat-done'));
    expect(screen.getAllByTestId('lost-row').map((r) => r.textContent)).toEqual(['Thursday 10 DecemberChanged']);
    expect(save).not.toHaveBeenCalled();
  });
  it('last date on the wrong weekday blocks Done', () => {
    const save = mount();
    fireEvent.change(endField(), { target: { value: '2026-12-04' } });
    expect(screen.getByTestId('repeat-error').textContent).toBe('The last date must be a Thursday.');
    expect((screen.getByTestId('repeat-done') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('repeat-done'));
    expect(save).not.toHaveBeenCalled();
  });
  it('a date for the new weekday is accepted; emptying the end sends end none', () => {
    const save = mount(ws([date('a', '2026-11-26')], '2026-12-31'));
    expect((endField() as HTMLInputElement).value).toBe('2026-12-31');
    fireEvent.change(endField(), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('repeat-done'));
    const steps = (save.mock.calls[0] as unknown as [{ command: { payload: Record<string, unknown> } }[]])[0];
    expect(steps[0].command.payload.end).toEqual({ kind: 'none' });
    expect(steps[0].command.payload.weekdays).toEqual([4]);
  });
  it('a last date on the chosen weekday saves until_date', () => {
    const save = mount(ws([date('a', '2026-11-26')]));
    pick('Friday');
    fireEvent.change(endField(), { target: { value: '2026-12-04' } });
    fireEvent.click(screen.getByTestId('repeat-done'));
    const steps = (save.mock.calls[0] as unknown as [{ command: { payload: Record<string, unknown> } }[]])[0];
    expect(steps[0].command.payload).toMatchObject({ weekdays: [5], end: { kind: 'until_date', date: '2026-12-04' } });
  });
});
