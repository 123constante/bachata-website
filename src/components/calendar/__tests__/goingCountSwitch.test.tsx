// @vitest-environment jsdom
/**
 * The calendar's going count (Going P2) is behind GOING_CHECKIN_ENABLED (owner
 * decision 2026-10-18, the P0.5 rule): off = no count text and no going read.
 * On = ONE batched get_nights_going_v1 read (src/modules/going) keyed by each
 * row's occurrence id, and a count ONLY for a night the read answered for.
 *
 * Why the P5 cases: get_calendar_events_v2 returns COALESCE(legacy_occurrence_id,
 * p5 id) -- on prod 2026-10-23, 257 of 278 rows in the next 60 days carry a
 * legacy id -- and get_nights_going_v1 silently drops ids that are not P5
 * occurrence ids. Such a row must show NO count, never a made-up "0 going".
 * Table: switch on/off x P5 id present/absent x going 0/1/7/200.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarEventItem } from '../calendarUtils';

const h = vi.hoisted(() => ({ on: false, rows: [] as unknown[], p5: new Set<string>(), count: 0 }));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));

const rpc = vi.hoisted(() => vi.fn());
// `auth` too: getSupabase (rpcLoose, the going module's read) checks the client has it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {} } }));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({
  useCalendarEvents: () => ({ data: h.rows, isLoading: false }),
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london' }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-01' }));

import { CalendarListView } from '../CalendarListView';
import { EventCalendar } from '../../EventCalendar';
import { goingCountText } from '@/modules/going';

const ev = (over: Partial<CalendarEventItem> = {}): CalendarEventItem => ({
  id: 'e1', date: 14, month: 9, year: 2026,
  startDate: new Date(2026, 9, 14, 20), endDate: new Date(2026, 9, 14, 23),
  instanceDateIso: '2026-10-14', type: 'parties', isFestival: false, hasParty: true, hasClass: false,
  title: 'Friday Social', startTime: '20:00', endTime: '23:00', venueName: 'The Venue',
  eventLink: '/event/e1', coverImageUrl: null, isCancelled: false, cancellationReasonLabel: null,
  timeTbc: false, goingCount: 7, ...over,
});

const renderList = (events: CalendarEventItem[]) =>
  render(
    <MemoryRouter>
      <CalendarListView currentMonth={9} currentYear={2026} selectedCategory="all" events={events} onClearFilters={() => {}} />
    </MemoryRouter>,
  );

/** A get_calendar_events_v2-shaped row (only what transformCalendarEvents reads). */
const row = (occurrenceId: string, name: string, day: number) => ({
  event_id: `ev-${occurrenceId}`,
  occurrence_id: occurrenceId,
  name,
  instance_date: `2026-10-${String(day).padStart(2, '0')}`,
  start_time: `2026-10-${String(day).padStart(2, '0')}T20:00:00`,
  end_time: `2026-10-${String(day).padStart(2, '0')}T23:00:00`,
  occurrence_starts_at: `2026-10-${String(day).padStart(2, '0')}T20:00:00`,
  occurrence_ends_at: `2026-10-${String(day).padStart(2, '0')}T23:00:00`,
  type: 'party', format: 'social', category: 'party', has_party: true, has_class: false,
  meta_data: {}, key_times: {}, location: 'The Venue', photo_url: [], cover_image_url: null,
  is_cancelled: false, cancellation_reason_label: null, is_recurring: false, slug: null,
  class_start: null, class_end: null, party_start: null, party_end: null, city_slug: 'london',
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T12:00:00Z') });
  localStorage.setItem('bachata-calendar-view', 'list');
  h.rows = [];
  h.p5 = new Set();
  h.count = 0;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, a?: { p_occurrence_ids?: string[] }) => {
    if (fn === 'get_nights_going_v1') {
      // The database answers ONLY for P5 occurrence ids; any other id is dropped.
      return {
        data: (a?.p_occurrence_ids ?? []).filter((id) => h.p5.has(id)).map((id) => ({ occurrence_id: id, going_count: h.count, people: [] })),
        error: null,
      };
    }
    return { data: [], error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('CalendarListView going count', () => {
  it('renders no "going" text while the switch is off', () => {
    h.on = false;
    renderList([ev()]);
    expect(screen.getByText('Friday Social')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/going/i);
  });
  it.each([
    [1, true],
    [7, true],
    [200, true],
    [0, false],
    [undefined, false],
  ])('switch on, goingCount %s: shows the module count text = %s', (count, shows) => {
    h.on = true;
    renderList([ev({ goingCount: count })]);
    if (shows) expect(screen.getByText(goingCountText(count as number))).toBeTruthy();
    else expect(document.body.textContent).not.toMatch(/going/i);
  });
});

describe('CalendarListView: a cancelled night never shows a going count (owner, 2026-10-23)', () => {
  it.each([
    [false, 1, true],
    [false, 7, true],
    [true, 1, false],
    [true, 7, false],
    [true, 200, false],
  ])('cancelled %s, goingCount %s: count shown = %s', (isCancelled, count, shows) => {
    h.on = true;
    renderList([ev({ isCancelled, goingCount: count })]);
    if (shows) expect(screen.getByText(goingCountText(count))).toBeTruthy();
    else expect(document.body.textContent).not.toMatch(/\d+ going/);
  });
});

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <EventCalendar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const nightsCalls = () => rpc.mock.calls.filter((c) => c[0] === 'get_nights_going_v1');
const LEGACY = /attendance/;

const MATRIX = [true, false].flatMap((on) =>
  [true, false].flatMap((p5) => [0, 1, 7, 200].map((count) => ({ on, p5, count }))),
);

describe('EventCalendar going count: switch x P5 id x count', () => {
  it.each(MATRIX)('switch $on, P5 id $p5, going $count', async ({ on, p5, count }) => {
    h.on = on;
    h.count = count;
    h.rows = [row('occ-a', 'Alpha Social', 14)];
    if (p5) h.p5.add('occ-a');
    mount();
    await screen.findByText('Alpha Social');
    if (on) await waitFor(() => expect(nightsCalls()).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(rpc.mock.calls.filter((c) => LEGACY.test(String(c[0])))).toEqual([]);
    if (!on) {
      expect(nightsCalls()).toHaveLength(0);
      expect(document.body.textContent).not.toMatch(/\bgoing\b/i);
      return;
    }
    expect(nightsCalls()[0][1]).toEqual({ p_occurrence_ids: ['occ-a'], p_limit: 8 });
    if (p5 && count > 0) expect(screen.getByText(goingCountText(count))).toBeTruthy();
    // A legacy id (no reply) and a real 0 both show nothing -- never "0 going".
    else expect(document.body.textContent).not.toMatch(/\bgoing\b/i);
  });

  it('a month of rows is ONE request; only the P5 rows get a count', async () => {
    h.on = true;
    h.count = 3;
    h.rows = [row('occ-legacy-1', 'Legacy One', 14), row('occ-p5', 'Native Night', 15), row('occ-legacy-2', 'Legacy Two', 16)];
    h.p5.add('occ-p5');
    mount();
    await screen.findByText('Native Night');
    await waitFor(() => expect(screen.getByText('3 going')).toBeTruthy());
    expect(nightsCalls()).toHaveLength(1);
    expect(screen.getAllByText('3 going')).toHaveLength(1);
  });
});
