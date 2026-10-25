// @vitest-environment jsdom
/**
 * The Sessions sheet words a removal by whether it is SAVED: a session the
 * server already has as removed (occurrence override `cancelled: true`) reads
 * "Removed from this date"; one the organiser just removed on this screen reads
 * "Comes off this date when you save". Table-driven, saved vs draft.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const DATE = '2026-10-15';

const SAVED = 'Removed from this date';
const DRAFT = 'Comes off this date when you save';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) });
  const sessions = [
    { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: [], removed: true },
    { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '23:00', ends_next_day: false, level_keys: [], removed: false },
  ];
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: { occurrence_id: 'o1', series_id: 's1', occurrence_date: DATE, version: 7, editable: true, not_editable_reason: null, sessions, session_people: [] }, error: null };
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: DATE, version: 1, lifecycle_status: 'scheduled' }, event: { venue_id: 'v1' }, schedule: {} }, error: null };
    if (fn === 'admin_event_workspace_p5') return { data: { series: { series: { id: 's1', name: 'Thursday Party', lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [4] } }, program: [] }, occurrences: [] }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: [{ id: 'v1', name: 'Salsa Club', city_name: 'Leeds' }], error: null };
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rowNamed = (name: string) => screen.getAllByTestId('session-row').find((r) => within(r).getByTestId('session-row-name').textContent === name)!;

async function ready() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/o/events/s1/dates/o1']}>
        <Routes><Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findAllByTestId('session-row');
}

describe('removed-session copy', () => {
  it.each([
    { name: 'saved removal (stored cancelled: true)', session: 'Bachata Basics', act: false, shows: SAVED, hides: DRAFT },
    { name: 'draft removal (removed on this screen, not saved)', session: 'Party', act: true, shows: DRAFT, hides: SAVED },
  ])('$name', async ({ session, act, shows, hides }) => {
    await ready();
    if (act) {
      fireEvent.click(within(rowNamed(session)).getByTestId('session-row-open'));
      fireEvent.click(await screen.findByTestId('session-remove'));
    }
    await waitFor(() => expect(rowNamed(session).getAttribute('data-removed')).toBe('true'));
    const row = rowNamed(session);
    expect(row.textContent).toContain(shows);
    expect(row.textContent).not.toContain(hides);
    expect(within(row).getByTestId('session-row-undo')).toBeTruthy();
  });
});
