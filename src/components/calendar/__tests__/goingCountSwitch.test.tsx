// @vitest-environment jsdom
/**
 * Every calendar surface that shows a "going" count is behind
 * GOING_CHECKIN_ENABLED (owner decision 2026-10-18). Off: no count text and no
 * attendance-count RPC. On: behaviour as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarEventItem } from '../calendarUtils';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return flag.on;
  },
}));

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({
  useCalendarEvents: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london' }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-01' }));

import { CalendarListView } from '../CalendarListView';
import { EventCalendar } from '../../EventCalendar';

const ev = (over: Partial<CalendarEventItem> = {}): CalendarEventItem => ({
  id: 'e1', date: 14, month: 9, year: 2026,
  startDate: new Date(2026, 9, 14, 20), endDate: new Date(2026, 9, 14, 23),
  instanceDateIso: '2026-10-14', type: 'parties', isFestival: false, hasParty: true, hasClass: false,
  title: 'Friday Social', startTime: '20:00', endTime: '23:00', venueName: 'The Venue',
  eventLink: '/event/e1', coverImageUrl: null, isCancelled: false, cancellationReasonLabel: null,
  timeTbc: false, goingCount: 7, ...over,
});

const renderList = () =>
  render(
    <MemoryRouter>
      <CalendarListView currentMonth={9} currentYear={2026} selectedCategory="all" events={[ev()]} onClearFilters={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

describe('CalendarListView going count', () => {
  it('renders no "going" text while the switch is off', () => {
    flag.on = false;
    renderList();
    expect(screen.getByText('Friday Social')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/going/i);
  });
  it('renders "7 going" when the switch is on', () => {
    flag.on = true;
    renderList();
    expect(screen.getByText('7 going')).toBeTruthy();
  });
});

describe('EventCalendar attendance-count fetch', () => {
  const mount = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <EventCalendar />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  it('does not call get_event_attendance_counts_by_range while off', async () => {
    flag.on = false;
    mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(rpc.mock.calls.filter((c) => c[0] === 'get_event_attendance_counts_by_range')).toHaveLength(0);
  });
  it('calls it while on', async () => {
    flag.on = true;
    mount();
    await waitFor(() =>
      expect(rpc.mock.calls.some((c) => c[0] === 'get_event_attendance_counts_by_range')).toBe(true),
    );
  });
});
