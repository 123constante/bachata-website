// @vitest-environment jsdom
/**
 * Slice B audit fixes on /app/home: M14 (hero contrast), M19 (no dead tiles),
 * M20 (What's On uses the dancer's own city), L4 (the nudge names the night),
 * M16 (one word: hidden), L14 (one browse verb). Prod-shape seeds: 0 and 15
 * nights, hidden profile, long name, no city.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  calendar: [] as Record<string, unknown>[],
  calendarArgs: [] as Array<{ citySlug: string | null; enabled?: boolean }>,
  activeCity: 'madrid-es' as string | null,
  slugs: {} as Record<string, string>,
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
  from: null as unknown as (table: string) => unknown,
}));
h.rpc = async (fn: string, args?: Record<string, unknown>) => {
  if (fn === 'get_my_event_attendance_v2') return { data: h.rows, error: null };
  if (fn === 'series_level_summary_p5_v1') {
    return { data: { series_id: String(args?.p_series_id), vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }, error: null };
  }
  return { data: null, error: { message: `unexpected rpc ${fn}` } };
};
h.from = (table: string) => ({
  select: () => ({
    eq: (_col: string, id: string) => ({
      maybeSingle: async () => (table === 'cities' && h.slugs[id] ? { data: { slug: h.slugs[id] }, error: null } : { data: null, error: null }),
    }),
  }),
});

vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a), from: (t: string) => h.from(t) } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: h.activeCity, setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({
  useCalendarEvents: (a: { citySlug: string | null; enabled?: boolean }) => {
    h.calendarArgs.push(a);
    return { data: a.enabled === false ? undefined : h.calendar, isLoading: false, isError: false };
  },
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { CITY_LONDON, makeProfile } from '@/modules/dancer-app/api/fixtures';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { DANCER_TOKENS, contrastRatio, type DancerToken } from '@/modules/dancer-app/theme/tokens';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { shortDate } from '../../nights/nightsModel';

const today = londonTodayKey();
const day = (n: number) => addDaysToKey(today, n);
const row = (id: string, name: string, n: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name, occurrence_date: day(n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true,
});
const LONG_FIRST = 'Maria-Fernanda-Alejandra-Xim'; // 29 chars with the surname below = long-name seed
const londoner = (over = {}) => makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, ...over });

beforeEach(() => {
  h.rows = []; h.calendar = []; h.calendarArgs = []; h.activeCity = 'madrid-es'; h.slugs = { [CITY_LONDON.id]: 'london-gb' };
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { cleanup(); resetShell(); });

const home = (profile = londoner()) => renderInShell({ path: '/app/home', backend: { profile } });

/** Every colour the hero's background is painted with, resolved through the dancer tokens. */
const heroColours = (el: HTMLElement): string[] => {
  const bg = /background[^;]*/.exec(el.getAttribute('style') ?? '')?.[0] ?? '';
  const vars = [...bg.matchAll(/var\((--da-[a-z-]+)\)/g)].map((m) => DANCER_TOKENS[m[1] as DancerToken]);
  const hex = [...bg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
  return [...vars, ...hex];
};

describe('M14: hero text contrast', () => {
  it.each([
    ['0 nights (empty hero)', [] as Record<string, unknown>[]],
    ['an upcoming night', [row('s1', 'Soho Sensual', 3)]],
  ])('%s: white text reaches 4.5:1 on every gradient stop', async (_n, rows) => {
    h.rows = rows;
    home();
    const hero = await screen.findByTestId('home-hero');
    const colours = heroColours(hero);
    expect(colours.length).toBeGreaterThanOrEqual(2);
    for (const c of colours) expect(contrastRatio(DANCER_TOKENS['--da-on-gradient'], c), c).toBeGreaterThanOrEqual(4.5);
  });
});

describe('M19: no dead tiles', () => {
  it('no "Coming soon" tile on Home', async () => {
    home();
    await screen.findByTestId('home-hero');
    expect(screen.queryByTestId('tile-views')).toBeNull();
    expect(screen.queryByTestId('tile-partners')).toBeNull();
    expect(screen.getByTestId('dancer-screen-home').textContent).not.toMatch(/coming soon/i);
  });
});

describe("M20: What's On uses the dancer's own city", () => {
  it('profile city London, site city Madrid: London events and the London calendar', async () => {
    home();
    const browse = await screen.findByTestId('whats-on-browse');
    await waitFor(() => expect(browse.getAttribute('href')).toBe('/city/london-gb/calendar'));
    expect(h.calendarArgs.filter((a) => a.enabled !== false).every((a) => a.citySlug === 'london-gb')).toBe(true);
    expect(h.calendarArgs.some((a) => a.citySlug === 'madrid-es' && a.enabled !== false)).toBe(false);
  });

  it('no city: says what to do and links to the city field; never "Nothing listed"', async () => {
    home(makeProfile({ first_name: 'Ana' }));
    const box = await screen.findByTestId('whats-on-no-city');
    expect(within(box).getByRole('link', { name: 'Add my city' }).getAttribute('href')).toBe('/app/me/edit?focus=city');
    expect(screen.queryByTestId('whats-on-empty')).toBeNull();
    expect(screen.getByTestId('whats-on').textContent).not.toMatch(/Nothing listed/);
  });

  it('a city with no calendar events this week: an honest empty state plus the browse link', async () => {
    home();
    expect((await screen.findByTestId('whats-on-empty')).textContent).toMatch(/Nothing listed in your city this week/);
  });
});

describe('L4: the rate nudge names the night', () => {
  it.each([
    [6, (k: string) => `Rate ${shortDate(k)}`],
    [2, (k: string) => `Rate ${shortDate(k)}`],
    [1, () => 'Rate last night'],
  ])('%i days ago', async (ago, title) => {
    h.rows = [row('s3', 'Thursday Social', -ago)];
    home();
    const nudge = await screen.findByTestId('rate-nudge');
    expect(nudge.querySelector('b')?.textContent).toBe(title(day(-ago)));
    if (ago > 1) expect(nudge.textContent).not.toMatch(/last night/i);
  });
});

describe('M16: hidden profile on Home', () => {
  it('banner uses the shared hidden line and the shared show-again label, no "paused"', async () => {
    home(londoner({ is_active: false }));
    const b = await screen.findByTestId('paused-banner');
    expect(b.textContent).toContain(HIDDEN_STATE_LINE);
    expect(within(b).getByRole('link', { name: SHOW_AGAIN_LABEL }).getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('dancer-screen-home').textContent).not.toMatch(/paus/i);
  });
});

describe('L14: one browse verb on Home', () => {
  it('every browse link reads "Browse events"', async () => {
    home();
    await screen.findByTestId('whats-on-browse');
    const text = screen.getByTestId('dancer-screen-home').textContent ?? '';
    expect(text).not.toMatch(/Browse what.s on|Browse all events/);
    expect(screen.getAllByRole('link', { name: /^Browse events/ }).length).toBeGreaterThanOrEqual(2);
  });
});

describe('seeds', () => {
  it('15 nights: the count tile says 15', async () => {
    h.rows = Array.from({ length: 15 }, (_, i) => row(`s${i}`, `Night ${i}`, i + 1, i % 2 ? 'interested' : 'going'));
    home();
    await waitFor(() => expect(screen.getByTestId('tile-going-count').textContent).toBe('15'));
  });

  it('long name + no city: renders the name in full and the no-city hint', async () => {
    home(makeProfile({ first_name: LONG_FIRST, surname: 'Rodriguez-Villanueva' }));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(LONG_FIRST);
    expect(await screen.findByTestId('whats-on-no-city')).toBeTruthy();
  });
});
