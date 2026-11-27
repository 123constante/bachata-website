// @vitest-environment jsdom
// /classes "Two doors" keep-list (SEO arc, owner pick C 2026-11-27, spec
// docs/design/classes-rebuild/C.html + PLAN.md). Every line, badge and control
// on the live screen is pinned here: hero + intro (owner keeps), updated line,
// sticky switch, both panels in the DOM, Next class card, day drawers, row tags,
// first-class steps + beginner cards, FAQ + JSON-LD, by-day links, calendar,
// More in London, and the empty states.
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/lib/seoLandingEvents', () => ({
  SEO_LANDING_WINDOWS: { guide: 7, learn: 28, weekday: 28 },
  useSeoLandingEvents: () => ({ data: rows.value }),
}));
vi.mock('@/lib/listImpressions', () => ({ useListImpressions: () => () => () => {} }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-27' }));
vi.mock('@/lib/featureFlags', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/featureFlags')>();
  return { ...mod, flags: { ...mod.flags, classesTwoDoors: true } };
});
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

const ev = (
  id: string,
  name: string,
  start: string,
  o: { party?: string; classStart?: string; program?: { start: string; title: string }[] } = {},
) => ({
  event_id: id, occurrence_id: `${id}-${start}`, name, has_class: true, has_party: !!o.party,
  is_cancelled: false, instance_date: start.slice(0, 10), occurrence_starts_at: start,
  start_time: start, location: `Venue ${id}`, slug: null, cover_image_url: `https://img/${id}.jpg`,
  class_start: o.classStart ?? start, party_start: o.party ?? null, has_timed_session: true,
  primary_organiser_name: `Org ${id}`, meta_data: o.program ? { program: o.program } : null,
});

// RPC order is NOT date order. Today = Friday 27 November 2026.
const SHAPE = [
  ev('sun', 'Sunday Styling', '2026-11-29T17:00:00'),
  ev('fri', 'Friday Social Night', '2026-11-27T19:00:00', {
    party: '2026-11-27T21:00:00',
    program: [
      { start: '20:00', title: 'Improvers' },
      { start: '19:00', title: 'Beginners bachata' },
      { start: '21:00', title: 'Social' },
    ],
  }),
  ev('sat', 'Saturday Partnerwork', '2026-11-28T18:30:00'),
  ev('fri', 'Friday Social Night', '2026-12-04T19:00:00', { party: '2026-12-04T21:00:00' }), // repeat, collapsed
];

const mount = (path = '/classes', pattern = '/classes', serverTodayKey: string | undefined = '2026-11-27') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<Classes serverTodayKey={serverTodayKey} />} />
      </Routes>
    </MemoryRouter>,
  );

// Fixture dates are fixed and the page reads Date.now, so pin the clock (Date only;
// React and testing-library timers keep running). Otherwise the Friday class turns
// "started" once real time passes 19:00 London and the Next class card moves on.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('/classes Two doors keep-list', () => {
  it('hero + intro kept, updated line, switch with This week selected, both panels in the DOM', () => {
    rows.value = SHAPE;
    const { container } = mount();
    expect(screen.getByTestId('hero').textContent).toBe('\u{1F393} Bachata classes in London');
    expect(screen.getByRole('link', { name: 'Start here' }).getAttribute('href')).toBe('/learn-bachata-london');
    expect(screen.getByRole('link', { name: 'find a teacher by style' }).getAttribute('href')).toBe('/teachers');
    expect(screen.getByTestId('updated-line').textContent).toBe('3 classes this week · updated Friday 27 November');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['This week3 classes by day', 'First classNew to bachata']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    const week = container.querySelector('#panel-week')!;
    const fresh = container.querySelector('#panel-new')!;
    expect(week.hasAttribute('hidden')).toBe(false);
    expect(fresh.hasAttribute('hidden')).toBe(true);
    // Hidden panel is still in the server HTML (SEO).
    expect(fresh.textContent).toContain('Your first bachata class in London');
  });

  it('headings in order: week panel, first-class panel, FAQ, by day, calendar, more', () => {
    rows.value = SHAPE;
    const { container } = mount();
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).toEqual([
      'This week’s bachata classes',
      'Your first bachata class in London',
      'Beginner bachata classes this week',
      'Bachata class questions',
      'Bachata classes by day',
      'Full class calendar',
      'More in London',
    ]);
    expect(container.querySelector('#calendar')!.textContent).toContain('Every date beyond this week.');
    expect(screen.getByTestId('calendar')).toBeTruthy();
  });

  it('Next class card, day drawers in date order, today + tomorrow open, row tags and BEGINNERS', () => {
    rows.value = SHAPE;
    const { container } = mount();
    const next = screen.getByTestId('next-class');
    expect(next.textContent).toContain('Friday Social Night');
    expect(next.textContent).toContain('Venue fri · Org fri');
    expect(next.textContent).toContain('See this class');
    // Run of the night: programme slots sorted by start.
    expect(next.textContent).toMatch(/19:00Beginners bachata.*20:00Improvers.*21:00Social/);

    const drawers = [...container.querySelectorAll('#panel-week details')];
    expect(drawers.map((d) => d.querySelector('h3')!.textContent)).toEqual([
      'Friday 27 NovemberToday',
      'Saturday 28 NovemberTomorrow',
      'Sunday 29 November',
    ]);
    expect(drawers.map((d) => d.hasAttribute('open'))).toEqual([true, true, false]);

    const fri = within(drawers[0] as HTMLElement);
    expect(fri.getByText('+ social 21:00')).toBeTruthy();
    expect(fri.getByText('BEGINNERS')).toBeTruthy();
    const sat = drawers[1].textContent ?? '';
    expect(sat).toContain('Venue sat · class only');
    expect(sat).toContain('18:30');
    expect(sat).not.toContain('BEGINNERS');
  });

  it('switch flips panels; flip buttons and guide links work', () => {
    rows.value = SHAPE;
    const { container } = mount();
    fireEvent.click(screen.getByRole('tab', { name: /First class/ }));
    expect(container.querySelector('#panel-week')!.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#panel-new')!.hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('tab', { name: /First class/ }).getAttribute('aria-selected')).toBe('true');

    const steps = [...container.querySelectorAll('#first-class li strong')].map((s) => s.textContent);
    expect(steps).toEqual(['Pick a beginners class', 'Come on your own', 'Wear what you can move in', 'Stay for the social']);
    expect(container.querySelector('#first-class')!.textContent).toContain('1 night this week runs one.');

    const cards = container.querySelectorAll('#beginners a');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Friday 27 November');
    expect(cards[0].textContent).toContain('See this class');
    expect(screen.getByRole('link', { name: /Read the full beginner/ }).getAttribute('href')).toBe('/learn-bachata-london');

    fireEvent.click(screen.getByRole('button', { name: 'See all 3 classes this week' }));
    expect(container.querySelector('#panel-week')!.hasAttribute('hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'New to bachata? See the first-class guide' }));
    expect(container.querySelector('#panel-new')!.hasAttribute('hidden')).toBe(false);
  });

  it('FAQ items + FAQPage JSON-LD, 7 by-day links, More in London links', () => {
    rows.value = SHAPE;
    const { container } = mount();
    const faqs = [...container.querySelectorAll('#questions summary')].map((s) => s.textContent?.replace(/[+−]/g, ''));
    expect(faqs).toEqual([
      'Do I need a partner?',
      'Which class should a complete beginner pick?',
      'What is a class  social night?',
      'What should I wear?',
    ]);
    const ld = JSON.parse(container.querySelector('#questions script[type="application/ld+json"]')!.textContent!);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(4);

    const byDay = [...container.querySelectorAll('#by-day a')].map((a) => a.getAttribute('href'));
    expect(byDay).toEqual([
      '/bachata-london-monday', '/bachata-london-tuesday', '/bachata-london-wednesday', '/bachata-london-thursday',
      '/bachata-london-friday', '/bachata-london-saturday', '/bachata-london-sunday',
    ]);
    for (const [name, href] of [['Tonight', '/tonight'], ['Parties', '/parties'], ['Teachers', '/teachers']]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
  });

  it('empty week: no Next card, calendar pointer, no beginners text + guide link', () => {
    rows.value = [];
    const { container } = mount();
    expect(screen.getByTestId('updated-line').textContent).toContain('0 classes this week');
    expect(screen.queryByTestId('next-class')).toBeNull();
    expect(container.textContent).toContain('No classes listed for the next seven days.');
    expect(screen.getByRole('link', { name: 'See the full calendar' }).getAttribute('href')).toBe('#calendar');
    expect(container.textContent).toContain('No beginners slot listed this week.');
    expect(container.textContent).toContain('None is listed this week.');
  });

  it('one class: singular copy', () => {
    rows.value = [ev('sun', 'Sunday Styling', '2026-11-29T17:00:00')];
    mount();
    expect(screen.getByTestId('updated-line').textContent).toBe('1 class this week · updated Friday 27 November');
  });

  it('city pages do not render Two doors', () => {
    rows.value = SHAPE;
    const { container } = mount('/city/bristol-gb/classes', '/city/:slug/classes', undefined);
    expect(screen.queryByTestId('classes-two-doors')).toBeNull();
    expect(container.textContent).not.toContain('London');
    expect(screen.getByTestId('calendar')).toBeTruthy();
  });
});
