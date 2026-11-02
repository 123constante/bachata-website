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
 *  - all-ok cases still render today's boxes unchanged (organiserEmptyState);
 *  - retry refetches the failed feed and the content then appears.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
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
      if (table === 'organiser_team_members') {
        s.calls.team++;
        if (s.team === 'error') return res({ data: null, error: { message: 'team boom' } });
        if (s.team === 'data') return res({ data: [{ id: 't1', role: 'DJ', is_head: true, is_leader: false, sort_order: 1, member_profile_id: 'd1', is_active: true }], error: null });
        return res({ data: [], error: null });
      }
      if (table === 'dancer_profiles') return res({ data: [{ id: 'd1', first_name: 'Ana', avatar_url: null, nationality: null }], error: null });
      return res({ data: [], error: null });
    };
    return chain;
  };
  return { supabase: { from: chainFor, rpc: async (fn: string) => {
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

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const EMPTY_COPY = [/No nights listed yet/, /No upcoming nights/, /Just getting started/];
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

describe('public organiser page: a failed feed is an error state, never an empty state', () => {
  it.each(CASES)('upcoming=$upcoming past=$past team=$team', async (c) => {
    s.upcoming = c.upcoming; s.past = c.past; s.team = c.team;
    await renderPage();
    const anyError = c.upcoming === 'error' || c.past === 'error' || c.team === 'error';

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
    expect(bodyText().includes('Teachers & DJs')).toBe(c.team === 'data');

    const empty = screen.queryByTestId('org-public-empty');
    if (anyError) {
      expect(empty, 'no empty-state box while a feed has failed').toBeNull();
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
    if (feed === 'team') expect(bodyText()).toContain('Teachers & DJs');
    else expect(document.getElementById(feed)).not.toBeNull();
  });
});
