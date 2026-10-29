// @vitest-environment jsdom
/**
 * Calendar list empty states by city x filter (Bristol launch). Table: London
 * with events, London with a filter and zero results, Bristol with zero events,
 * Bristol with a filter on. "Clear filters" shows only when a filter is on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CalendarEventItem, Category } from '../calendarUtils';

vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-01' }));
vi.mock('@/components/listing/LazyEmptyCityNote', () => ({
  default: (p: { cityName: string; citySlug?: string | null }) => (
    <div data-testid="empty-city-note">Coming soon {p.cityName} {p.citySlug} Tell us</div>
  ),
}));

import { CalendarListView } from '../CalendarListView';

const ev = (over: Partial<CalendarEventItem> = {}): CalendarEventItem => ({
  id: 'e1', date: 14, month: 9, year: 2026,
  startDate: new Date(2026, 9, 14, 20), endDate: new Date(2026, 9, 14, 23),
  instanceDateIso: '2026-10-14', type: 'parties', isFestival: false, hasParty: true, hasClass: false,
  title: 'Friday Social', startTime: '20:00', endTime: '23:00', venueName: 'The Venue',
  eventLink: '/event/e1', coverImageUrl: null, isCancelled: false, cancellationReasonLabel: null,
  timeTbc: false, goingCount: null, ...over,
});

type Row = {
  name: string; city: string | null; events: CalendarEventItem[]; cat: Category;
  note: boolean; clear: boolean; empty: boolean;
};
const rows: Row[] = [
  { name: 'London with events', city: 'london', events: [ev()], cat: 'all', note: false, clear: false, empty: false },
  { name: 'London, filter on, zero results', city: 'london', events: [ev()], cat: 'classes', note: false, clear: true, empty: true },
  { name: 'London, no events, no filter', city: 'london', events: [], cat: 'all', note: false, clear: false, empty: true },
  { name: 'Bristol with zero events', city: 'bristol-gb', events: [], cat: 'all', note: true, clear: false, empty: false },
  { name: 'Bristol with a filter on', city: 'bristol-gb', events: [], cat: 'parties', note: false, clear: true, empty: true },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T12:00:00Z') });
});
afterEach(cleanup);

describe('CalendarListView empty states', () => {
  it.each(rows)('$name', (r) => {
    render(
      <MemoryRouter>
        <CalendarListView currentMonth={9} currentYear={2026} selectedCategory={r.cat}
          events={r.events} onClearFilters={() => {}} citySlug={r.city} />
      </MemoryRouter>,
    );
    expect(!!screen.queryByTestId('empty-city-note')).toBe(r.note);
    expect(!!screen.queryByText('Clear filters')).toBe(r.clear);
    expect(!!screen.queryByText(/No events found for/)).toBe(r.empty);
    if (r.note) expect(screen.getByTestId('empty-city-note').textContent).toContain('Coming soon Bristol');
  });
});
