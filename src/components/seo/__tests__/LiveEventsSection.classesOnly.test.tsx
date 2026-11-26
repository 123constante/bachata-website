// @vitest-environment jsdom
// Site structure S1b (2026-11-26): the /learn-bachata-london "Beginner classes"
// list (classesOnly) listed "East London Bachata Monthly Party" because the
// filter was has_class alone. Class-only now means a class and NO party.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/lib/seoLandingEvents', () => ({
  SEO_LANDING_WINDOWS: { guide: 7, learn: 28, weekday: 28 },
  useSeoLandingEvents: () => ({ data: rows.value }),
}));
vi.mock('@/lib/listImpressions', () => ({ useListImpressions: () => () => () => {} }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-26' }));

import LiveEventsSection from '../LiveEventsSection';

const ev = (id: string, name: string, has_class: boolean, has_party: boolean) => ({
  event_id: id, occurrence_id: id, name, has_class, has_party, is_cancelled: false,
  instance_date: '2026-11-27', start_time: null, location: 'V', slug: null,
});

afterEach(cleanup);

describe('LiveEventsSection classesOnly', () => {
  it.each([
    { label: 'pure class', row: ev('c', 'Pure Class', true, false), shown: true, mode: 'classesOnly' },
    { label: 'party with class slot', row: ev('p', 'Monthly Party', true, true), shown: false, mode: 'classesOnly' },
    { label: 'party only', row: ev('q', 'Party Only', false, true), shown: false, mode: 'classesOnly' },
    { label: 'no filter keeps party with class', row: ev('p', 'Monthly Party', true, true), shown: true, mode: 'all' },
  ])('$label -> shown $shown', ({ row, shown, mode }) => {
    rows.value = [row];
    render(
      <MemoryRouter>
        <LiveEventsSection heading="H" serverTodayKey="2026-11-26" classesOnly={mode === 'classesOnly'} emptyText="none" />
      </MemoryRouter>,
    );
    expect(screen.queryByText(row.name) !== null).toBe(shown);
  });
});
