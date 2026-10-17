// @vitest-environment jsdom
/**
 * F-INT fix pass, worker G3: B-S9 (a field error is tied to its input) and B-S11
 * (a removed session's type chip keeps AA contrast on the faded row). The mount and
 * RPC stubs are DatePage.test.tsx's. Red first on the unfixed tree (ev/G3.md).
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

// Freeze Date so DATE stays in the future (2026-10-01 is not 10-15, so never "Tonight").
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
});

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

function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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
      return { data: { series: { series: { id: 's1', name: 'Thursday Party', lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [4] } }, program: [] }, occurrences: [] }, error: null };
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

describe('B-S9: the session name error is tied to its input', () => {
  it('an empty name, after a save try: aria-invalid, and aria-describedby names the error line', async () => {
    await ready();
    openSession('Bachata Basics');
    fireEvent.change(await screen.findByTestId('session-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('date-sheet-done'));
    await waitFor(() => expect(screen.queryByTestId('date-sheet')).toBeNull());
    save();
    // The emptied session now reads by its type; rows are in time order (18:00, 19:00, 22:00).
    fireEvent.click(within(rows()[1]).getByTestId('session-row-open'));
    const input = await screen.findByTestId('session-name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const id = input.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const note = document.getElementById(id!);
    expect(note?.getAttribute('role')).toBe('alert');
    expect(note?.textContent).toMatch(/name/i);
  });
  it('a good name: no aria-invalid, no dangling describedby', async () => {
    await ready();
    openSession('Bachata Basics');
    const input = await screen.findByTestId('session-name');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('B-S11: a removed session keeps its type chip at AA', () => {
  it('the chip on a faded (removed) row is --fg, not --mut; a live row keeps the neutral tone', async () => {
    await ready();
    const before = within(rowNamed('Bachata Basics')).getByTestId('session-row-type');
    expect(before.className).not.toMatch(/text-\[var\(--fg\)\]/);
    openSession('Bachata Basics');
    fireEvent.click(await screen.findByTestId('session-remove'));
    const row = rowNamed('Bachata Basics');
    expect(row.getAttribute('data-removed')).toBe('true');
    const chip = within(row).getByTestId('session-row-type');
    expect(chip.className).toMatch(/text-\[var\(--fg\)\]/);
    expect(chip.className).not.toMatch(/text-\[var\(--mut\)\]/);
    expect(chip.className).toMatch(/text-\[12px\]/);
  });
});
