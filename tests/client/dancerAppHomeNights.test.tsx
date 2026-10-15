// @vitest-environment jsdom
/**
 * W2b: Home (/app/home) and Nights (/app/nights), every screen x every shape.
 * The server is a small in-memory fake behind the SAME client modules the app
 * uses (getSupabase / supabase.rpc), so the real mapper, the real level-vote
 * hook and the real pendingLevelRating are exercised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  votes: {} as Record<string, string>,
  rateCalls: [] as Array<[string, string]>,
  serverComplete: true,
  events: [] as string[],
  calendar: [] as Record<string, unknown>[],
  city: 'london-gb' as string | null,
  attendanceFails: false,
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
h.rpc = async (fn, args) => {
  if (fn === 'get_my_event_attendance_v2') {
    return h.attendanceFails ? { data: null, error: { message: 'boom' } } : { data: h.rows, error: null };
  }
  if (fn === 'series_level_summary_p5_v1') {
    const id = String(args?.p_series_id);
    return { data: { series_id: id, vote_count: 1, threshold: 7, counts: null, derived_level: null, my_level: h.votes[id] ?? null }, error: null };
  }
  if (fn === 'rate_series_level_p5_v1') {
    if (!h.serverComplete) return { data: null, error: { message: 'profile_incomplete' } };
    h.rateCalls.push([String(args?.p_series_id), String(args?.p_level)]);
    h.votes[String(args?.p_series_id)] = String(args?.p_level);
    return { data: null, error: null };
  }
  return { data: null, error: { message: `unexpected rpc ${fn}` } };
};


vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a) }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a) } }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: h.city, setCitySlug: () => {} }) }));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({
  useCalendarEvents: ({ enabled }: { enabled?: boolean }) => ({ data: enabled === false ? undefined : h.calendar, isLoading: false, isError: false }),
}));
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics')>()),
  trackAnalyticsEvent: (name: string) => { h.events.push(name); },
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES, FAKE_PROFILE_ID, makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { PENDING_LEVEL_RATING_KEY } from '@/lib/pendingLevelRating';

const today = londonTodayKey();
const day = (n: number) => addDaysToKey(today, n);
const row = (id: string, name: string, n: number, status = 'going', over: Record<string, unknown> = {}) => ({
  event_id: id, status, updated_at: null, name, occurrence_date: day(n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true, ...over,
});

beforeEach(() => {
  h.rows = []; h.votes = {}; h.rateCalls = []; h.serverComplete = true; h.events = []; h.calendar = []; h.city = 'london-gb'; h.attendanceFails = false;
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { cleanup(); resetShell(); });

const home = (opts: Parameters<typeof renderInShell>[0] = {}) => renderInShell({ path: '/app/home', ...opts });
const nights = (opts: Parameters<typeof renderInShell>[0] = {}) => renderInShell({ path: '/app/nights', ...opts });

describe('Home x attendance shapes', () => {
  const cases: Array<{ name: string; rows: () => Record<string, unknown>[]; hero: RegExp | null; count: string; nudge: boolean }> = [
    { name: 'no attendance', rows: () => [], hero: null, count: '0', nudge: false },
    { name: 'one upcoming Going', rows: () => [row('s1', 'Soho Sensual', 4)], hero: /Soho Sensual/, count: '1', nudge: false },
    { name: 'one Interested', rows: () => [row('s2', 'Camden Social', 3, 'interested')], hero: /Camden Social/, count: '1', nudge: false },
    { name: 'past unrated, 2 days ago (nudge)', rows: () => [row('s3', 'Last Thursday', -2)], hero: null, count: '0', nudge: true },
    { name: 'past unrated, 7 days ago (nudge)', rows: () => [row('s3', 'Last Thursday', -7)], hero: null, count: '0', nudge: true },
    { name: 'past unrated, 8 days ago (no nudge)', rows: () => [row('s3', 'Last Thursday', -8)], hero: null, count: '0', nudge: false },
    { name: 'past Interested only (no nudge)', rows: () => [row('s3', 'Last Thursday', -2, 'interested')], hero: null, count: '0', nudge: false },
    { name: 'past rated (no nudge)', rows: () => { h.votes.s3 = 'mixed'; return [row('s3', 'Last Thursday', -2)]; }, hero: null, count: '0', nudge: false },
    { name: 'past festival (no nudge)', rows: () => [row('s3', 'Big Fest', -2, 'going', { type: 'festival' })], hero: null, count: '0', nudge: false },
  ];
  it.each(cases)('$name', async (c) => {
    h.rows = c.rows();
    home();
    const hero = await screen.findByTestId('home-hero');
    await waitFor(() => expect(screen.getByTestId('tile-going-count').textContent).toBe(c.count));
    if (c.hero) expect(hero.textContent).toMatch(c.hero);
    else {
      expect(hero.textContent).toMatch(/No upcoming night yet/);
      expect(within(hero).getByRole('link', { name: /Browse what.s on/ })).toBeTruthy();
    }
    if (c.nudge) expect(await screen.findByTestId('rate-nudge')).toBeTruthy();
    else {
      await waitFor(() => expect(h.rows.length === 0 || screen.queryByTestId('tile-going')).toBeTruthy());
      expect(screen.queryByTestId('rate-nudge')).toBeNull();
    }
  });

  it('shows no fake numbers: "Coming soon" tiles carry no digits and no button', async () => {
    home();
    for (const id of ['tile-views', 'tile-partners']) {
      const t = await screen.findByTestId(id);
      expect(t.textContent).toMatch(/Coming soon/);
      expect(t.textContent).not.toMatch(/\d/);
      expect(within(t).queryByRole('button')).toBeNull();
    }
    expect(screen.queryByText(/12 views/)).toBeNull();
  });

  it('hero card opens the normal event page and is the NEXT night', async () => {
    h.rows = [row('later', 'Later', 9), row('soon', 'Sooner', 2, 'interested')];
    home();
    const hero = await screen.findByTestId('home-hero');
    await waitFor(() => expect(hero.textContent).toMatch(/Sooner/));
    expect(within(hero).getByRole('link', { name: 'See event' }).getAttribute('href')).toBe('/event/soon');
    expect(screen.getByTestId('tile-going').textContent).toMatch(/Next: /);
  });
});

describe('Home x profile shapes', () => {
  it.each(DANCER_SHAPE_NAMES.filter((n) => DANCER_SHAPES[n].signedIn))('renders for shape %s without throwing', async (shape) => {
    home({ backend: { shape } });
    await screen.findByTestId('dancer-screen-home');
    await waitFor(() => expect(screen.queryByText(/Loading your home/)).toBeNull());
  });

  it('strength tile shows the server pct and says what to add', async () => {
    home({ backend: { profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id }) } });
    const tile = await screen.findByTestId('tile-strength');
    expect(tile.textContent).toMatch(/40%/);
    expect(tile.textContent).toMatch(/Pick how you dance/);
  });

  it('no profile: message-us copy pointing at Options', async () => {
    home({ backend: { profile: null } });
    const m = await screen.findByTestId('home-message');
    await waitFor(() => expect(m.textContent).toMatch(/Message us/));
    expect(within(m).getByRole('link', { name: 'Options' }).getAttribute('href')).toBe('/app/options');
  });

  it('paused profile: hidden banner links to account settings', async () => {
    home({ backend: { profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, is_active: false }) } });
    const b = await screen.findByTestId('paused-banner');
    expect(b.textContent).toMatch(/Your profile is hidden/);
    expect(within(b).getByRole('link').getAttribute('href')).toBe('/account/settings');
  });

  it('active profile: no hidden banner', async () => {
    home();
    await screen.findByTestId('home-hero');
    expect(screen.queryByTestId('paused-banner')).toBeNull();
  });

  it('linked-from-admin: notice on first visit, gone once dismissed, stays gone', async () => {
    const profile = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, linked_from_admin: true });
    const first = home({ backend: { profile } });
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('linked-notice')).toBeNull();
    first.unmount(); resetShell();
    home({ backend: { profile } });
    await screen.findByTestId('home-hero');
    expect(screen.queryByTestId('linked-notice')).toBeNull();
  });

  it('not linked: no notice', async () => {
    home();
    await screen.findByTestId('home-hero');
    expect(screen.queryByTestId('linked-notice')).toBeNull();
  });

  it('no city: what\'s on is hidden with a hint', async () => {
    home({ backend: { profile: makeProfile({ first_name: 'Ana' }) } });
    expect((await screen.findByTestId('whats-on-no-city')).textContent).toMatch(/Add your city in Me/);
    expect(screen.queryByTestId('whats-on-row')).toBeNull();
  });

  it('with a city: 3 events at most, each opening the event page, plus Browse all events', async () => {
    h.calendar = [1, 2, 3, 4].map((i) => ({ event_id: `e${i}`, name: `Event ${i}`, instance_date: day(i), occurrence_starts_at: `${day(i)}T20:00:00`, location: 'Soho', is_cancelled: false }));
    home();
    const rows = await screen.findAllByTestId('whats-on-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute('href')).toBe('/event/e1');
    expect(screen.getByTestId('whats-on-browse').getAttribute('href')).toBe('/city/london-gb/calendar');
  });
});

describe('analytics', () => {
  it('dancer_app_entered fires once per session for a signed-in person', async () => {
    const r = home();
    await screen.findByTestId('home-hero');
    r.unmount(); resetShell();
    home();
    await screen.findByTestId('home-hero');
    expect(h.events.filter((e) => e === 'dancer_app_entered')).toHaveLength(1);
  });
  it('never for a signed-out visitor', async () => {
    home({ auth: 'signed-out' });
    await waitFor(() => expect(screen.queryByTestId('dancer-screen-home')).toBeNull());
    expect(h.events).toEqual([]);
  });
});

describe('Nights', () => {
  it('empty states name controls that exist', async () => {
    nights();
    const up = await screen.findByTestId('nights-upcoming-empty');
    expect(up.textContent).toMatch(/not going to anything yet/);
    expect(within(up).getByRole('link', { name: /Browse what.s on/ }).getAttribute('href')).toBe('/city/london-gb/calendar');
    expect(screen.getByTestId('nights-past-empty').textContent).toBe('Your past nights will appear here.');
  });

  it('upcoming and past lists with status pills', async () => {
    h.rows = [row('a', 'Alpha', 3), row('b', 'Beta', 5, 'interested'), row('c', 'Gamma', -20)];
    nights();
    const up = await screen.findByTestId('nights-upcoming');
    expect(within(up).getAllByTestId('night-row').map((r) => r.textContent)).toEqual([
      expect.stringMatching(/Alpha.*Going/), expect.stringMatching(/Beta.*Interested/),
    ]);
    expect(within(screen.getByTestId('nights-past')).getAllByTestId('night-row')).toHaveLength(1);
  });

  it('the same night reads the same on Home and Nights (one mapper)', async () => {
    h.rows = [row('a', 'Alpha Social', 3, 'interested')];
    const n = nights();
    const nightRow = (await screen.findAllByTestId('night-row'))[0].textContent ?? '';
    n.unmount(); resetShell();
    home();
    const heroEl = await screen.findByTestId('home-hero');
    await waitFor(() => expect(heroEl.textContent).toContain('Alpha Social'));
    const hero = heroEl.textContent ?? '';
    for (const bit of ['Alpha Social', 'Interested', '21:00', 'London']) {
      expect(nightRow).toContain(bit);
      expect(hero).toContain(bit);
    }
  });

  it('attendance failure: error with retry, no fake empty state', async () => {
    h.attendanceFails = true;
    nights();
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn.t load your nights/);
    expect(screen.queryByTestId('nights-upcoming-empty')).toBeNull();
  });

  it('vote: answer, then "You said", then a second vote REPLACES the first (per series)', async () => {
    h.rows = [row('s1', 'Wk 1', -2), row('s1', 'Wk 1', -9)];
    nights();
    const votes = await screen.findAllByTestId('level-vote');
    expect(votes).toHaveLength(2); // two past dates of ONE series
    fireEvent.click(within(votes[0]).getByRole('radio', { name: 'Mixed' }));
    await waitFor(() => expect(screen.getAllByText('You said: Mixed')).toHaveLength(2)); // both rows: keyed by series
    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Strong' })[0]);
    await waitFor(() => expect(screen.getAllByText('You said: Strong')).toHaveLength(2));
    expect(h.rateCalls).toEqual([['s1', 'mixed'], ['s1', 'strong']]);
    expect(Object.keys(h.votes)).toEqual(['s1']);
  });

  it('upcoming nights carry no vote', async () => {
    h.rows = [row('a', 'Alpha', 3)];
    nights();
    await screen.findAllByTestId('night-row');
    expect(screen.queryByTestId('level-vote')).toBeNull();
  });

  it('nudge disappears after voting on Nights', async () => {
    h.rows = [row('s9', 'Last night', -1)];
    const r = home();
    const nudge = await screen.findByTestId('rate-nudge');
    expect(nudge.getAttribute('href')).toBe('/app/nights?focus=s9');
    fireEvent.click(screen.getByTestId('dancer-app-tab-nights'));
    const vote = await screen.findByTestId('level-vote');
    expect(r.location()).toBe('/app/nights');
    fireEvent.click(within(vote).getByRole('radio', { name: 'Strong' }));
    await screen.findByText('You said: Strong');
    fireEvent.click(screen.getByTestId('dancer-app-tab-home'));
    await screen.findByTestId('home-hero');
    await waitFor(() => expect(screen.queryByTestId('rate-nudge')).toBeNull());
  });

  it('focus param marks that night', async () => {
    h.rows = [row('s1', 'One', -2), row('s2', 'Two', -3)];
    renderInShell({ path: '/app/nights?focus=s2' });
    const rows = await screen.findAllByTestId('night-row');
    expect(rows.map((r) => r.getAttribute('data-focused'))).toEqual([null, 'true']);
  });

  it('incomplete profile: the vote is HELD, then replays once the profile completes', async () => {
    h.serverComplete = false;
    h.rows = [row('s1', 'Held night', -2)];
    const incomplete = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' });
    const r = nights({ backend: { profile: incomplete } });
    fireEvent.click(await screen.findByRole('radio', { name: 'Mixed' }));
    const held = await screen.findByTestId('level-vote-held');
    expect(held.textContent).toMatch(/Finish your profile to rate/);
    expect(within(held).getByRole('link', { name: 'Finish my profile' }).getAttribute('href')).toBe('/app/welcome');
    expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toContain('"mixed"');
    expect(h.rateCalls).toEqual([]);
    // finish onboarding: the profile becomes complete on the server, the vote replays
    h.serverComplete = true;
    await r.backend.saveMyDancerProfile({ avatar_url: 'https://img.example/a.jpg' });
    expect(r.backend.current()?.complete).toBe(true);
    await (r.queryClient as QueryClient).invalidateQueries({ queryKey: ['my-dancer-edit'] });
    await waitFor(() => expect(h.rateCalls).toEqual([['s1', 'mixed']]));
    await screen.findByText('You said: Mixed');
    expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull();
    expect(FAKE_PROFILE_ID).toBeTruthy();
  });
});
