// @vitest-environment jsdom
/**
 * The date page (W3): schedule with people per session, people by type, the
 * search as a VIEW of the one sheet, removal with Collapse and Undo, the save
 * (payload byte-identical for untouched sessions) followed by a fresh read
 * that re-seeds the editor, refusal copy, cancel and break.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const A2 = '44444444-4444-4444-8444-444444444444';
const P = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const DATE = '2026-10-15'; // a Thursday, never "Tonight" in this suite

const sessions = () => [
  { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
  { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: false },
  { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
];
const people = () => [
  { series_item_id: S1, people: [{ profile_id: P(1), display_name: 'Ana Ruiz', role: 'teaching' }] },
  { series_item_id: S2, people: [{ profile_id: P(2), display_name: 'DJ Ben', role: 'djing' }, { profile_id: P(3), display_name: 'Cleo Park', role: 'mc' }] },
  { added_session_id: A1, people: [{ profile_id: P(4), display_name: 'Dee Lo', role: 'teaching' }] },
];

let reads: Array<Record<string, unknown>>;
let setResult: () => { data: unknown; error: unknown };
let commandResult: () => { data: unknown; error: unknown };

const calls = (fn: string) => rpc.mock.calls.filter(([f]) => f === fn);
const setCalls = () => calls('organiser_set_occurrence_programme_v1');

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/events/s1/dates/o1']}>
        <Routes>
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
          <Route path="/account/o/events/:seriesId" element={<p data-testid="event-page">event</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows = () => screen.getAllByTestId('session-row');
const rowNamed = (name: string) => rows().find((r) => within(r).getByTestId('session-row-name').textContent === name)!;
async function ready() {
  mount();
  await screen.findAllByTestId('session-row');
}
const openSession = (name: string) => fireEvent.click(within(rowNamed(name)).getByTestId('session-row-open'));
const save = () => fireEvent.click(screen.getByTestId('date-preview-bar-action'));

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [{ key: 'illness', label: 'Illness' }, { key: 'venue', label: 'Venue problem' }], error: null }) }) }) });
  const first = { occurrence_id: 'o1', series_id: 's1', occurrence_date: DATE, version: 7, editable: true, not_editable_reason: null, sessions: sessions(), session_people: people() };
  reads = [first];
  setResult = () => ({ data: { ok: true, changed: true, version: 8, sessions: sessions() }, error: null });
  commandResult = () => ({ data: { ok: true, new_version: 2 }, error: null });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_get_occurrence_programme_v1') {
      // Each read after a queued newer version moves on to it.
      if (reads.length > 1) reads.shift();
      return { data: reads[0], error: null };
    }
    if (fn === 'organiser_set_occurrence_programme_v1') return setResult();
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: DATE, version: 1, lifecycle_status: 'scheduled' }, event: { venue_id: 'v1' }, schedule: {} }, error: null };
    if (fn === 'admin_event_workspace_p5') {
      return { data: { series: { series: { id: 's1', name: 'Thursday Social', lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [4] } }, program: [] }, occurrences: [] }, error: null };
    }
    if (fn === 'get_organiser_venue_options_v1') return { data: [{ id: 'v1', name: 'Salsa Club', city_name: 'Leeds' }, { id: 'v2', name: 'Studio 2', city_name: 'York' }], error: null };
    if (fn === 'organiser_search_people_v1') return { data: [{ id: P(5), display_name: 'Eva Sol', city_name: 'Leeds' }, { id: P(1), display_name: 'Ana Ruiz' }], error: null };
    if (fn === 'occurrence_command_p5' || fn === 'series_command_p5') return commandResult();
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('schedule', () => {
  it('shows one row per session in time order with its type, times, levels and people; the date time follows the sessions', async () => {
    await ready();
    expect(rows().map((r) => within(r).getByTestId('session-row-name').textContent)).toEqual(['Bootcamp', 'Bachata Basics', 'Party']);
    expect(within(rowNamed('Party')).getByTestId('session-row-people').textContent).toBe('DJ Ben, Cleo Park');
    expect(within(rowNamed('Bachata Basics')).getByTestId('session-row-meta').textContent).toBe('19:00\u201320:00 \u00b7 Beginner');
    expect(screen.getByTestId('date-span').textContent).toContain('18:00\u201302:00');
    await waitFor(() => expect(screen.getByTestId('date-venue-value').textContent).toBe('Salsa Club'));
    // One primary button on the page, disabled until something changes.
    expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('people by type', () => {
  it('a class offers teachers, a party DJs; the MC is read-only (added by the team)', async () => {
    await ready();
    openSession('Bachata Basics');
    expect((await screen.findByTestId('session-add-person')).textContent).toContain('Add a teacher');
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    await waitFor(() => expect(screen.queryByTestId('date-sheet')).toBeNull());
    openSession('Party');
    expect((await screen.findByTestId('session-add-person')).textContent).toContain('Add a DJ');
    const mc = screen.getAllByTestId('session-person').find((r) => within(r).queryByText('Cleo Park'))!;
    expect(within(mc).getByText('Added by the team')).toBeTruthy();
    expect(within(mc).queryByTestId('session-person-remove')).toBeNull();
  });

  it('a performance has no add control', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('date-add-session'));
    fireEvent.click(await screen.findByTestId('session-type-performance'));
    expect(screen.queryByTestId('session-add-person')).toBeNull();
    expect(screen.getByTestId('session-people-team')).toBeTruthy();
  });
});

describe('search is a view inside the same sheet', () => {
  it('swaps to the search, focuses it, offers only the right role and adds the pick', async () => {
    await ready();
    openSession('Bachata Basics');
    fireEvent.click(await screen.findByTestId('session-add-person'));
    const input = await screen.findByTestId('people-search');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('date-sheet').getAttribute('data-view')).toMatch(/^search:/);
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: 'ev' } });
    const result = await screen.findByText('Eva Sol');
    expect(calls('organiser_search_people_v1')[0][1]).toMatchObject({ p_query: 'ev', p_role: 'teaching' });
    // Ana is already on the session: not offered again.
    expect(screen.queryAllByTestId('people-result')).toHaveLength(1);
    fireEvent.click(result);
    expect(screen.getByTestId('date-sheet').getAttribute('data-view')).toMatch(/^session:/);
    expect(screen.getAllByTestId('session-person').map((r) => within(r).getAllByText(/./)[1].textContent)).toEqual(['Ana Ruiz', 'Eva Sol']);
  });
});

describe('remove, undo and Collapse', () => {
  it('a stored person greys with Undo; an added one collapses away', async () => {
    await ready();
    openSession('Bachata Basics');
    const ana = (await screen.findAllByTestId('session-person'))[0];
    fireEvent.click(within(ana).getByTestId('session-person-remove'));
    expect(ana.getAttribute('data-removed')).toBe('true');
    fireEvent.click(within(ana).getByTestId('session-person-undo'));
    expect(ana.getAttribute('data-removed')).toBeNull();

    fireEvent.click(screen.getByTestId('session-add-person'));
    fireEvent.change(await screen.findByTestId('people-search'), { target: { value: 'ev' } });
    fireEvent.click(await screen.findByText('Eva Sol'));
    const eva = screen.getAllByTestId('session-person')[1];
    fireEvent.click(within(eva).getByTestId('session-person-remove'));
    await waitFor(() => expect(screen.queryByText('Eva Sol')).toBeNull(), { timeout: 2000 });
    expect(screen.getAllByTestId('session-person')).toHaveLength(1);
  });

  it('a stored session stays greyed with Undo and saves as removed; a new one collapses out', async () => {
    await ready();
    openSession('Bootcamp');
    fireEvent.click(await screen.findByTestId('session-remove'));
    const boot = rowNamed('Bootcamp');
    expect(boot.getAttribute('data-removed')).toBe('true');
    fireEvent.click(within(boot).getByTestId('session-row-undo'));
    expect(rowNamed('Bootcamp').getAttribute('data-removed')).toBeNull();

    fireEvent.click(screen.getByTestId('date-add-session'));
    fireEvent.click(await screen.findByTestId('session-remove'));
    await waitFor(() => expect(rows()).toHaveLength(3), { timeout: 2000 });
    expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('save', () => {
  it('sends untouched sessions byte-identically, then re-reads and re-seeds (a re-created session keeps its people)', async () => {
    await ready();
    openSession('Bootcamp');
    fireEvent.change(await screen.findByTestId('session-name'), { target: { value: 'Bootcamp XL' } });
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    // The writer re-creates the date-only session under a NEW id; the fresh read keys Dee to it.
    const resaved = sessions().map((s) => (s.added_session_id === A1 ? { ...s, added_session_id: A2, title: 'Bootcamp XL' } : s));
    reads.push({ ...reads[0], version: 8, sessions: resaved, session_people: [...people().slice(0, 2), { added_session_id: A2, people: [{ profile_id: P(4), display_name: 'Dee Lo', role: 'teaching' }] }] });
    save();
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    const [, args] = setCalls()[0];
    expect(args.p_expected_version ?? args.p_version).toBe(7);
    const sent = (args.p_sessions ?? args.p_programme) as Record<string, unknown>[];
    expect(JSON.stringify(sent.slice(0, 2))).toBe(JSON.stringify(sessions().slice(0, 2)));
    expect(sent[2]).toMatchObject({ added_session_id: A1, title: 'Bootcamp XL' });
    await waitFor(() => expect(calls('organiser_get_occurrence_programme_v1').length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(within(rowNamed('Bootcamp XL')).getByTestId('session-row-people').textContent).toBe('Dee Lo'));
    expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
    // Removing Dee now names nothing stale: the draft is keyed to the NEW id.
    openSession('Bootcamp XL');
    fireEvent.click(within((await screen.findAllByTestId('session-person'))[0]).getByTestId('session-person-remove'));
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    save();
    await waitFor(() => expect(setCalls()).toHaveLength(2));
    const second = (setCalls()[1][1].p_sessions ?? setCalls()[1][1].p_programme) as Record<string, unknown>[];
    expect(second[2]).toEqual({ ...resaved[2], people_remove: [P(4)] });
  });

  it('a refusal shows the plain copy, shakes, and a stale screen reloads', async () => {
    await ready();
    openSession('Bachata Basics');
    fireEvent.click(within((await screen.findAllByTestId('session-person'))[0]).getByTestId('session-person-remove'));
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    setResult = () => ({ data: null, error: { code: 'P0001', message: 'version_conflict: expected 7, found 9' } });
    save();
    const msg = await screen.findByTestId('date-save-error');
    expect(msg.textContent).toContain('This date was changed somewhere else');
    await waitFor(() => expect(calls('organiser_get_occurrence_programme_v1').length).toBeGreaterThanOrEqual(2));
  });
});

describe('cancel and break', () => {
  it('cancel needs a reason and the tick, then sends occurrence.cancel', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('date-cancel'));
    const confirm = await screen.findByTestId('date-cancel-confirm');
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click((await screen.findAllByTestId('cancel-reason'))[0]);
    fireEvent.click(screen.getByTestId('cancel-ack'));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(calls('occurrence_command_p5')).toHaveLength(1));
    const env = calls('occurrence_command_p5')[0][1].p_envelope;
    expect(env).toMatchObject({ target_id: 'o1', command: { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Illness' } } });
  });

  it('a daily-cap refusal shows the plain copy', async () => {
    commandResult = () => ({ data: null, error: { code: 'P0001', message: 'daily_edit_cap' } });
    await ready();
    fireEvent.click(screen.getByTestId('date-break'));
    fireEvent.click(await screen.findByTestId('date-break-confirm'));
    expect((await screen.findByTestId('date-command-error')).textContent).toContain("today's limit");
  });

  it('break sends series.skip_date and goes back to the event', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('date-break'));
    await act(async () => { fireEvent.click(await screen.findByTestId('date-break-confirm')); });
    await waitFor(() => expect(calls('series_command_p5')).toHaveLength(1));
    expect(calls('series_command_p5')[0][1].p_envelope).toMatchObject({ target_id: 's1', expected_version: 3, command: { kind: 'series.skip_date', payload: { occurrence_id: 'o1' } } });
    expect(await screen.findByTestId('event-page')).toBeTruthy();
  });

  it('break and cancel wait while there are unsaved changes', async () => {
    await ready();
    openSession('Bachata Basics');
    fireEvent.click(within((await screen.findAllByTestId('session-person'))[0]).getByTestId('session-person-remove'));
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    expect((screen.getByTestId('date-break') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('date-cancel') as HTMLButtonElement).disabled).toBe(true);
  });
});
