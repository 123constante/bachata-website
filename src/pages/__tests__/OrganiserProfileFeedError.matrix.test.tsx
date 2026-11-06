// @vitest-environment jsdom
/**
 * S1 (E4): a feed that FAILS must never show as a feed that is EMPTY.
 *
 * {upcoming, past, team} x {ok with data, ok empty, error}, all 27 combinations.
 * Before S1 every fetcher swallowed its error to `[]`, so a transient RPC
 * failure for an organiser with 200 events rendered "No nights listed yet"
 * (prod verify doc E4). Asserted per case:
 *  - a failed feed shows the quiet one-line error state with a retry button,
 *    never any empty-state copy ("No nights listed yet", "No upcoming nights",
 *    "Just getting started") and never the org-public-empty box;
 *  - past and upcoming fail independently: one failing never hides the other;
 *  - all-ok cases render the organiserEmptyState answer (P1: 'none' and
 *    'past-only' are now one quiet "No dates announced yet" line);
 *  - retry refetches the failed feed and the content then appears.
 *
 * Organiser page fix round 1: stats are per feed (a failed feed's stat is a
 * marked dash, the other feed's stats still show), and a TEAM-only failure no
 * longer hides the events' empty state. The clock is pinned to the mocked
 * London today: organiserStats reads `now`, and since #1398 a night before
 * today is past whatever the feed says.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Mode = 'data' | 'empty' | 'error';

const s = vi.hoisted(() => ({
  upcoming: 'data' as 'data' | 'empty' | 'error',
  past: 'data' as 'data' | 'empty' | 'error',
  team: 'data' as 'data' | 'empty' | 'error',
  eventsError: false,
  calls: { events: 0, future: 0, past: 0, team: 0 },
}));

const EVENT = { id: 'ev-1', name: 'Friday Social', date: null, start_time: null, is_active: true, poster_url: null, location: 'Soho', city: 'London' };
const occ = (date: string, past = false) => ({
  event_id: 'ev-1', name: 'Friday Social', occurrence_id: `occ-${date}`, instance_date: date, start_time: `${date}T21:00:00`,
  photo_url: null, cover_image_url: null, location: 'Soho', is_cancelled: false, is_past: past,
});

vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'org-1', slug: 'org', arrivedViaUuid: false }),
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/lib/publicDancerNames', () => ({
  withPublicNames: async <T extends { first_name?: string | null }>(rows: T[]) => rows.map((r) => ({ ...r, public_name: r.first_name })),
}));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<typeof import('@/modules/profile/organiserPublicProfile')>()),
  fetchOrganiserEntity: async () => ({ id: 'org-1', name: 'Bachata Connect', avatar_url: null, bio: null, socials: null, city_id: null, instagram: null, website: null, cities: null }),
  // The events feed is the join source for BOTH lists: it only fails in its own cases.
  fetchOrganiserEvents: async () => {
    s.calls.events++;
    if (s.eventsError) throw new Error('events boom');
    return s.upcoming === 'empty' && s.past === 'empty' ? [] : [EVENT];
  },
  fetchOrganiserFutureOccEvents: async () => {
    s.calls.future++;
    if (s.upcoming === 'error') throw new Error('future boom');
    return s.upcoming === 'data' ? [occ('2026-10-16')] : [];
  },
  fetchOrganiserPastOccEvents: async () => {
    s.calls.past++;
    if (s.past === 'error') throw new Error('past boom');
    return s.past === 'data' ? [occ('2026-09-01', true)] : [];
  },
}));
vi.mock('@/integrations/supabase/client', () => {
  const chainFor = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'not', 'maybeSingle']) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => void) => {
      if (table === 'dancer_profiles') return res({ data: [{ id: 'd1', first_name: 'Ana', avatar_url: null, nationality: null }], error: null });
      return res({ data: [], error: null });
    };
    return chain;
  };
  return { supabase: { from: chainFor, rpc: async (fn: string) => {
    // P2: the public Team is organiser_public_team_v1.
    if (fn === 'organiser_public_team_v1') {
      s.calls.team++;
      if (s.team === 'error') return { data: null, error: { message: 'team boom' } };
      if (s.team === 'data') return { data: [{ person_id: 'd1', slug: null, public_name: 'Ana', avatar_url: null, sort_key: 1 }], error: null };
      return { data: [], error: null };
    }
    if (fn === 'organiser_ownership_v1') return { data: { is_managed: false, i_own_it: false, my_role: null }, error: null };
    if (fn === 'get_organiser_public_contact_v1') return { data: { contact_email: null, contact_phone: null }, error: null };
    return { data: null, error: null };
  } } };
});
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: null, session: null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OrganiserProfile from '../OrganiserProfile';

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T12:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const EMPTY_COPY = [/No dates announced yet/, /No nights listed yet/, /No upcoming nights/, /Just getting started/];
const MODES: Mode[] = ['data', 'empty', 'error'];
const CASES = MODES.flatMap((upcoming) => MODES.flatMap((past) => MODES.map((team) => ({ upcoming, past, team }))));

afterEach(() => {
  cleanup();
  s.eventsError = false;
  s.calls = { events: 0, future: 0, past: 0, team: 0 };
});

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/organisers/org']}>
        <Routes><Route path="/organisers/:id" element={<OrganiserProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: /Bachata Connect/ });
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

const errLine = (feed: 'upcoming' | 'past' | 'team') => screen.queryByTestId(`org-feed-error-${feed}`);
const bodyText = () => document.body.textContent ?? '';
// Stats strip (organiserStats via OrganiserStatsStrip): the keys it shows.
const statKeys = () => Array.from(document.querySelectorAll('[data-stat]')).map((e) => e.getAttribute('data-stat'));
const hasTeam = () => !!screen.queryByTestId('org-team');

describe('public organiser page: a failed feed is an error state, never an empty state', () => {
  it.each(CASES)('upcoming=$upcoming past=$past team=$team', async (c) => {
    s.upcoming = c.upcoming; s.past = c.past; s.team = c.team;
    await renderPage();

    // Upcoming list vs its error line.
    if (c.upcoming === 'error') {
      expect(errLine('upcoming'), 'upcoming error line').not.toBeNull();
      expect(document.getElementById('upcoming')).toBeNull();
    } else {
      expect(errLine('upcoming')).toBeNull();
      expect(!!document.getElementById('upcoming')).toBe(c.upcoming === 'data');
    }
    // Past list vs its error line -- independent of upcoming.
    if (c.past === 'error') {
      expect(errLine('past'), 'past error line').not.toBeNull();
      expect(document.getElementById('past')).toBeNull();
    } else {
      expect(errLine('past')).toBeNull();
      expect(!!document.getElementById('past')).toBe(c.past === 'data');
    }
    // Team section vs its error line.
    if (c.team === 'error') expect(errLine('team'), 'team error line').not.toBeNull();
    else expect(errLine('team')).toBeNull();
    expect(hasTeam()).toBe(c.team === 'data');

    // F1 / S5: no stat is ever derived from a failed feed: its own stat is a
    // marked dash, and the working feed's stats still show (fix round 1, MED-3).
    const anyFeedError = c.upcoming === 'error' || c.past === 'error';
    const dashes = Array.from(document.querySelectorAll('[data-stat][data-stat-failed]')).map((e) => e.getAttribute('data-stat'));
    expect(dashes, 'a failed feed is a dash').toEqual([c.upcoming === 'error' && 'next_night', c.past === 'error' && 'nights_hosted'].filter(Boolean));
    const real = statKeys().filter((k) => !dashes.includes(k));
    expect(statKeys(), 'Last night no longer exists').not.toContain('last_night');
    if (c.upcoming === 'data') expect(statKeys()[0]).toBe('next_night');
    else if (c.upcoming === 'empty' && c.past === 'data') expect(statKeys(), 'nothing upcoming: no Next night, no Last night').not.toContain('next_night');
    else if (!anyFeedError) expect(statKeys()).toEqual([]);

    const empty = screen.queryByTestId('org-public-empty');
    if (anyFeedError) {
      expect(empty, 'no empty-state box while a nights feed has failed').toBeNull();
      for (const re of EMPTY_COPY) expect(bodyText()).not.toMatch(re);
      // Each error line is a single quiet line with a 44px retry button.
      for (const f of ['upcoming', 'past', 'team'] as const) {
        const line = errLine(f);
        if (!line) continue;
        const btn = line.querySelector('button');
        expect(btn?.textContent).toMatch(/Try again/);
        expect(btn?.style.minHeight).toBe('44px');
      }
    } else {
      // All ok: today's boxes, unchanged.
      const want = c.upcoming === 'data' ? null : c.past === 'data' ? 'past-only' : 'none';
      expect(empty?.getAttribute('data-kind') ?? null).toBe(want);
    }
  });

  it('events feed (the join source) failing: both lists show the error line, no empty copy', async () => {
    s.upcoming = 'data'; s.past = 'data'; s.team = 'empty'; s.eventsError = true;
    await renderPage();
    expect(errLine('upcoming')).not.toBeNull();
    expect(errLine('past')).not.toBeNull();
    expect(screen.queryByTestId('org-public-empty')).toBeNull();
    for (const re of EMPTY_COPY) expect(bodyText()).not.toMatch(re);
    // F1: every events-derived stat is hidden -- no strip at all here.
    // Fix round 1: both lists failed, so both headline stats are marked dashes (no number).
    expect(Array.from(document.querySelectorAll('[data-stat][data-stat-failed]')).map((e) => e.getAttribute('data-stat'))).toEqual(['next_night', 'nights_hosted']);
    expect(statKeys()).toEqual(['next_night', 'nights_hosted']);
  });

  it('events feed failing with a healthy team: the Team list still shows, no stat but the dashes', async () => {
    s.upcoming = 'data'; s.past = 'data'; s.team = 'data'; s.eventsError = true;
    await renderPage();
    // Fix round 1: both lists failed, so both headline stats are marked dashes (no number).
    expect(Array.from(document.querySelectorAll('[data-stat][data-stat-failed]')).map((e) => e.getAttribute('data-stat'))).toEqual(['next_night', 'nights_hosted']);
    expect(statKeys()).toEqual(['next_night', 'nights_hosted']);
    expect(hasTeam()).toBe(true);
  });

  it('healthy zero (all feeds ok, nothing listed): no strip -- never a 0', async () => {
    s.upcoming = 'empty'; s.past = 'empty'; s.team = 'empty';
    await renderPage();
    expect(screen.queryByTestId('org-stats')).toBeNull();
    expect(bodyText()).toContain('No dates announced yet');
  });

  it.each(['upcoming', 'past', 'team'] as const)('retry on the %s error line refetches and shows the content', async (feed) => {
    s.upcoming = 'data'; s.past = 'data'; s.team = 'data';
    s[feed] = 'error';
    await renderPage();
    const line = errLine(feed);
    expect(line).not.toBeNull();
    const key = feed === 'upcoming' ? 'future' : feed;
    const before = s.calls[key];
    s[feed] = 'data';
    fireEvent.click(line!.querySelector('button')!);
    await waitFor(() => expect(errLine(feed)).toBeNull());
    expect(s.calls[key]).toBeGreaterThan(before);
    if (feed === 'team') expect(hasTeam()).toBe(true);
    else expect(document.getElementById(feed)).not.toBeNull();
  });
});
