// @vitest-environment jsdom
// /classes as a news article (SEO arc step 3, owner picks 2026-11-27):
// heading "Bachata classes in London", two-line standfirst with two links,
// "Updated" line + this week's classes grouped by day in date order, THEN the
// full calendar. City pages change the heading only. This is the keep-list.
import type { ReactNode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/lib/seoLandingEvents', () => ({
  SEO_LANDING_WINDOWS: { guide: 7, learn: 28, weekday: 28 },
  useSeoLandingEvents: () => ({ data: rows.value }),
}));
vi.mock('@/lib/listImpressions', () => ({ useListImpressions: () => () => () => {} }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-27' }));
vi.mock('@/components/EventCalendar', () => ({ EventCalendar: () => <div data-testid="calendar" /> }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: () => {},
}));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, hero }: { children: ReactNode; hero: { emoji: string; titleWhite: string; titleOrange: string } }) => (
    <div>
      <h1 data-testid="hero">
        {hero.emoji} {hero.titleWhite} {hero.titleOrange}
      </h1>
      {children}
    </div>
  ),
}));

import Classes from '../Classes';

const ev = (id: string, name: string, start: string, opts: { party?: boolean } = {}) => ({
  event_id: id, occurrence_id: `${id}-${start}`, name, has_class: true, has_party: !!opts.party,
  is_cancelled: false, instance_date: start.slice(0, 10), occurrence_starts_at: start,
  start_time: start, location: `Venue ${id}`, slug: null,
});

// RPC order is NOT date order (live: Tuesday, Thursday, Sunday).
const LIVE_SHAPE = [
  ev('t', 'Tuesday Beginners', '2026-12-01T19:00:00'),
  ev('h1', 'Thursday Partnerwork', '2026-12-03T19:00:00'),
  ev('h2', 'Thursday Styling', '2026-12-03T18:30:00'),
  ev('s', 'Sunday Ladies', '2026-11-29T17:00:00'),
  ev('t', 'Tuesday Beginners', '2026-11-24T19:00:00'), // earlier occurrence of a repeat, out of order
  ev('p', 'Monthly Party With Class', '2026-11-28T21:00:00', { party: true }),
];

const mountAt = (path: string, pattern: string, serverTodayKey?: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<Classes serverTodayKey={serverTodayKey} />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('/classes article (London)', () => {
  it('keep-list: hero, standfirst + 2 links, updated line, day groups in date order, then calendar', () => {
    rows.value = LIVE_SHAPE;
    const { container } = mountAt('/classes', '/classes', '2026-11-27');

    expect(screen.getByTestId('hero').textContent).toBe('\u{1F393} Bachata classes in London');
    const text = container.textContent ?? '';
    expect(text).toContain('Every bachata class in London this week, for beginners to advanced dancers.');
    expect(text).toContain('Most classes rotate partners, so you can come on your own.');
    expect(screen.getByRole('link', { name: 'Start here' }).getAttribute('href')).toBe('/learn-bachata-london');
    expect(screen.getByRole('link', { name: 'find a teacher by style' }).getAttribute('href')).toBe('/teachers');
    // Old intro copy and its links are gone.
    expect(text).not.toContain('guide to learning bachata');
    expect(text).not.toContain('Learn');

    // 4 distinct classes (repeat collapsed, party-with-class excluded).
    expect(screen.getByTestId('updated-line').textContent).toBe('Updated Friday 27 November · 4 classes this week');

    const headings = [...container.querySelectorAll('h2, h3')].map((h) => h.textContent);
    expect(headings).toEqual([
      'This week',
      'Tuesday 24 November',
      'Sunday 29 November',
      'Thursday 3 December',
      'Full class calendar',
    ]);
    // Within a day, start time order; rows show venue and 24h time.
    const thu = screen.getByText('Thursday 3 December').parentElement!;
    const names = within(thu).getAllByRole('link').map((a) => a.querySelector('div')!.textContent);
    expect(names).toEqual(['Thursday Styling', 'Thursday Partnerwork']);
    expect(thu.textContent).toContain('Venue h2 · 18:30');
    expect(text).not.toContain('Monthly Party With Class');

    // List sits ABOVE the calendar.
    const list = container.querySelector('#this-week')!;
    const cal = screen.getByTestId('calendar');
    expect(list.compareDocumentPosition(cal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('one class -> singular count; no classes -> empty text points at the calendar below', () => {
    rows.value = [ev('s', 'Sunday Ladies', '2026-11-29T17:00:00')];
    mountAt('/classes', '/classes', '2026-11-27');
    expect(screen.getByTestId('updated-line').textContent).toBe('Updated Friday 27 November · 1 class this week');
    cleanup();
    rows.value = [];
    const { container } = mountAt('/classes', '/classes', '2026-11-27');
    expect(container.textContent).toContain('the calendar below shows every date');
  });

  it('more than 8 classes are all shown: no hidden cap behind the count', () => {
    rows.value = Array.from({ length: 12 }, (_, i) =>
      ev(`e${i}`, `Class ${i}`, `2026-11-${28 + (i % 3)}T19:${String(i).padStart(2, '0')}:00`),
    );
    mountAt('/classes', '/classes', '2026-11-27');
    expect(screen.getByTestId('updated-line').textContent).toContain('12 classes this week');
    expect(screen.getAllByText(/^Class \d+$/)).toHaveLength(12);
  });
});

describe('/city/:slug/classes', () => {
  it('heading names the city; no list, no London copy, calendar kept', () => {
    rows.value = LIVE_SHAPE;
    const { container } = mountAt('/city/bristol-gb/classes', '/city/:slug/classes');
    expect(screen.getByTestId('hero').textContent).toBe('\u{1F393} Bachata classes in Bristol');
    expect(container.querySelector('#this-week')).toBeNull();
    expect(container.textContent).not.toContain('London');
    expect(screen.getByTestId('calendar')).toBeTruthy();
  });
});
