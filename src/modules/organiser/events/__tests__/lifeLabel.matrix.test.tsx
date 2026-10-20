// @vitest-environment jsdom
/**
 * W3 consistency matrix (owner decisions d31, d39): a series' life reads ONE word on
 * every organiser screen that states it -- the Events list row's tag, the section it
 * sits in (current or the collapsed Past), the row's line, and the editor's tag --
 * for every shape: the F4 fixtures, the prod "live but only past dates" shapes
 * (read-only survey 2026-10-14, counts only) and a series over the 100-date API cap.
 * Expected words are spelled out here, never imported from lifeLabel.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LIFECYCLE_WORD, SHAPES, VENUES, dateViewOf, homeOf, pastOf, programmeOf, run, shape, upcomingOf, weekly, workspaceOf, type SeriesShape, type ShapeDate,
} from '../../__tests__/shapes/shapes';
import { seriesLife } from '@/modules/organiser/shared/lifeLabel';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventsPage from '../index';
import OneEvent from '../OneEvent';
import DatePage from '../../dates';

/** The prod rows of live series with no date from today on (2026-10-14): format x rule x past x past cancelled. */
const PROD_PAST: SeriesShape[] = [
  ...Array.from({ length: 7 }, (_, i) => shape({ key: `prod-oneoff-${i}`, about: 'live / one_off / 1 past', lifecycle: 'live', format: 'one_off', dates: run(`prod-oneoff-${i}`, '2026-09-12', 1) })),
  shape({ key: 'prod-course-4', about: 'live / course / rule / 4 past', lifecycle: 'live', format: 'course', rule: weekly(2, { kind: 'after_count', count: 4 }), dates: run('prod-course-4', '2026-09-08', 4) }),
  shape({ key: 'prod-course-5', about: 'live / course / rule / 5 past', lifecycle: 'live', format: 'course', rule: weekly(2, { kind: 'after_count', count: 5 }), dates: run('prod-course-5', '2026-09-01', 5) }),
  shape({ key: 'prod-festival-1', about: 'live / festival / 1 past day', lifecycle: 'live', format: 'festival', dates: run('prod-festival-1', '2026-08-29', 1) }),
  shape({ key: 'prod-rec-2', about: 'live / recurring / no rule / 2 past', lifecycle: 'live', format: 'recurring', dates: run('prod-rec-2', '2026-09-26', 2) }),
  shape({ key: 'prod-rec-3', about: 'live / recurring / no rule / 3 past', lifecycle: 'live', format: 'recurring', dates: run('prod-rec-3', '2026-09-19', 3) }),
  shape({ key: 'prod-rec-6', about: 'live / recurring / no rule / 6 past, 1 cancelled', lifecycle: 'live', format: 'recurring', dates: run('prod-rec-6', '2026-08-29', 6, 7, (i) => i === 0) }),
  shape({ key: 'prod-rec-rule-8', about: 'live / recurring / weekly rule, until / 8 past, 1 cancelled', lifecycle: 'live', format: 'recurring', rule: weekly(6, { kind: 'until_date', date: '2026-10-03' }), dates: run('prod-rec-rule-8', '2026-08-15', 8, 7, (i) => i === 3) }),
  shape({ key: 'prod-rec-17', about: 'live / recurring / no rule / 17 past, 8 cancelled', lifecycle: 'live', format: 'recurring', dates: run('prod-rec-17', '2026-06-06', 17, 7, (i) => i % 2 === 0) }),
];
/** Over the 100-date cap with every date past: the workspace's newest 100 are all past too. */
const OVER100_PAST = shape({ key: 'over100-past', about: 'live / recurring / weekly / 130 past / 0 upcoming', lifecycle: 'live', format: 'recurring', rule: weekly(4), dates: run('over100-past', '2024-04-11', 130) });
const ALL = [...SHAPES, ...PROD_PAST, OVER100_PAST];
/** R3-4: an archived series is never a list row, so it is not in the list matrices. */
const LISTED = ALL.filter((s) => s.lifecycle !== 'archived');

/** The word, spelled out: only a LIVE series with no date from today on changes word. */
function expected(s: SeriesShape): { word: string; past: boolean; note: string | null } {
  const none = upcomingOf(s).length === 0;
  if (s.lifecycle === 'ended' || s.lifecycle === 'archived') return { word: LIFECYCLE_WORD[s.lifecycle], past: true, note: null };
  if (s.lifecycle === 'live' && none) {
    return s.format === 'recurring' ? { word: 'Nothing coming up', past: true, note: 'Open it to see how to add dates.' } : { word: 'Finished', past: true, note: null };
  }
  return { word: LIFECYCLE_WORD[s.lifecycle], past: false, note: null };
}

let home: SeriesShape[] = [];
let current: SeriesShape;
let dateOpen: ShapeDate | null = null;
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    const s = current;
    const next = dateOpen ?? (s && (upcomingOf(s).find((d) => d.status !== 'cancelled') ?? upcomingOf(s)[0]));
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf(home),
      admin_event_workspace_p5: s ? workspaceOf(s) : null,
      organiser_get_occurrence_programme_v1: next ? programmeOf(s, next) : null,
      event_view_p5: dateOpen ? dateViewOf(s, dateOpen) : null,
      get_organiser_venue_options_v1: VENUES,
      event_publish_readiness_v1: { missing: [] },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(() => { cleanup(); dateOpen = null; });

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/events" element={<EventsPage />} />
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
          <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('the one mapping, spelled out: lifecycle x format x upcoming', () => {
  const STATUSES = ['draft', 'pending_review', 'rejected', 'live', 'paused', 'ended', 'archived'];
  const FORMATS = ['one_off', 'recurring', 'course', 'festival', null];
  it.each(STATUSES.flatMap((st) => FORMATS.flatMap((f) => [0, 1, 120].map((n) => [st, f, n] as const))))('%s / %s / %d upcoming', (st, f, n) => {
    const life = seriesLife({ lifecycle_status: st, format: f }, n);
    const closed = st === 'ended' || st === 'archived';
    const lapsed = st === 'live' && n === 0;
    expect(life.tag.label).toBe(lapsed ? (f === 'recurring' ? 'Nothing coming up' : 'Finished') : LIFECYCLE_WORD[st]);
    expect(life.section).toBe(closed || lapsed ? 'past' : 'current');
    expect(life.note).toBe(lapsed && f === 'recurring' ? 'Open it to see how to add dates.' : null);
    if (lapsed) expect(life.tag.tone).toBe('neutral');
  });
});

describe.each(LISTED.map((s) => [s.key, s] as const))('shape %s', (_key, s) => {
  const want = expected(s);
  it(`list row, its section and the editor tag all read "${want.word}"`, async () => {
    home = [s];
    current = s;
    mount('/account/o/events');
    await screen.findByTestId('org-event-list');
    const toggle = screen.queryByTestId('org-events-past-toggle');
    expect(!!toggle).toBe(want.past);
    if (want.past) {
      // Collapsed by default: the row is not on screen until Past is opened.
      expect(toggle!.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('org-event-row')).toBeNull();
      expect(text(screen.getByTestId('org-events-past-count'))).toBe('(1)');
      // Nothing current: the empty state says what the person can do, naming no control that is absent.
      expect(text(screen.getByTestId('org-events-none-current'))).toMatch(/Open one to see how to add dates, or use New event\./);
      expect(screen.getByTestId('org-events-new')).toBeTruthy();
      fireEvent.click(toggle!);
      expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    }
    const row = screen.getByTestId('org-event-row');
    expect(row.closest(want.past ? '[data-testid="org-events-past"]' : '[data-testid="org-events-current"]')).not.toBeNull();
    expect(text(within(row).getByTestId('org-event-chip'))).toBe(want.word);
    cleanup();
    mount(`/account/o/events/${s.id}`);
    await screen.findByTestId('org-page-event');
    await screen.findByTestId('org-event-title');
    expect(text(within(screen.getByTestId('org-event-title')).getByTestId('org-event-chip'))).toBe(want.word);
    // Nothing coming up on a live series: the page says how to add dates (a working Add a date link).
    if (want.note) expect(screen.getByTestId('org-coming-add')).toBeTruthy();
  });
});

describe('every shape on one list', () => {
  it('current rows first, then Past with its count, collapsed; opening it shows every past row', async () => {
    home = ALL;
    current = ALL[0];
    mount('/account/o/events');
    await screen.findByTestId('org-event-list');
    const pastWant = LISTED.filter((s) => expected(s).past);
    const currentWant = LISTED.filter((s) => !expected(s).past);
    const cur = screen.getByTestId('org-events-current');
    const ids = (rows: HTMLElement[]) => rows.map((r) => r.getAttribute('data-series-id')).sort();
    expect(ids(within(cur).getAllByTestId('org-event-row'))).toEqual(currentWant.map((s) => s.id).sort());
    expect(text(screen.getByTestId('org-events-past-count'))).toBe(`(${pastWant.length})`);
    const past = screen.getByTestId('org-events-past');
    expect(within(past).queryAllByTestId('org-event-row')).toHaveLength(0);
    // Past sits after the current card in the page.
    expect(cur.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-events-past-toggle'));
    const rows = within(past).getAllByTestId('org-event-row');
    expect(ids(rows)).toEqual(pastWant.map((s) => s.id).sort());
    for (const r of rows) {
      const s = ALL.find((x) => x.id === r.getAttribute('data-series-id'))!;
      expect(text(within(r).getByTestId('org-event-chip'))).toBe(expected(s).word);
    }
    // Live but only past dates, as the prod survey found them: none reads "Live".
    for (const s of PROD_PAST) expect(expected(s).word).not.toBe('Live');
    expect(screen.queryByTestId('org-events-none-current')).toBeNull();
  });

  it.each([
    ['active event under Past', true, 1, false],
    ['active event under Past', true, 2, true],
    ['active event not under Past', false, 1, true],
    ['active event not under Past', false, 2, false],
  ])('Past toggle, %s (in Past: %s), taps %s: aria-expanded and the rows agree', async (_n, inPast, taps, nowOpen) => {
    const s = PROD_PAST[0];
    const other = shapeOf('live-weekly-until');
    home = [other, s];
    const act = inPast ? s : other;
    current = act;
    mount(`/account/o/events/${act.id}`);
    await screen.findByTestId('org-page-event');
    const toggle = await screen.findByTestId('org-events-past-toggle');
    // Open once for an event under Past, so a tap really folds it.
    await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe(String(inPast)));
    for (let i = 0; i < taps; i++) fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe(String(nowOpen));
    const past = screen.getByTestId('org-events-past');
    expect(within(past).queryAllByTestId('org-event-row')).toHaveLength(nowOpen ? 1 : 0);
  });

  it('a past event that is open in the editor beside the list is never folded away', async () => {
    const s = PROD_PAST[0];
    home = [shapeOf('live-weekly-until'), s];
    current = s;
    mount(`/account/o/events/${s.id}`);
    await screen.findByTestId('org-page-event');
    const past = await screen.findByTestId('org-events-past');
    expect(screen.getByTestId('org-events-past-toggle').getAttribute('aria-expanded')).toBe('true');
    const row = within(past).getByTestId('org-event-row');
    expect(row.getAttribute('data-series-id')).toBe(s.id);
  });
});

function shapeOf(key: string) {
  return SHAPES.find((x) => x.key === key)!;
}

describe('the date page reads the same word as the list row and the editor tag (d31)', () => {
  // A PAST date of a series: the lapsed live series reads its list word; a live series
  // with later dates keeps "Live"; closed series keep their own word.
  const ROWS: [string, SeriesShape][] = [
    ...PROD_PAST.map((p) => [p.key, p] as [string, SeriesShape]),
    [OVER100_PAST.key, OVER100_PAST],
    ['live-weekly-until', shapeOf('live-weekly-until')],
    ['ended-picnic', shapeOf('ended-picnic')],
    ['archived-norule-past', shapeOf('archived-norule-past')],
  ];
  it.each(ROWS)('past date of %s', async (_k, s) => {
    const d = pastOf(s).find((x) => x.status !== 'cancelled')!;
    home = [s];
    current = s;
    dateOpen = d;
    mount(`/account/o/events/${s.id}/dates/${d.id}`);
    await screen.findByTestId('date-header');
    await waitFor(() => expect(text(screen.getByTestId('date-span'))).toContain(s.name));
    expect(text(screen.getByTestId('date-status'))).toBe(expected(s).word);
  });
});
