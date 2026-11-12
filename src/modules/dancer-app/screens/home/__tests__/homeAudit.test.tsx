// @vitest-environment jsdom
/**
 * Slice B audit fixes on /app/home: M14 (hero contrast), M19 (no dead tiles),
 * M20 (What's On uses the dancer's own city), L4 (the nudge names the night),
 * M16 (one word: hidden), L14 (one browse verb). Prod-shape seeds: 0 and 15
 * nights, hidden profile, long name, no city. Going P2: the nights come from
 * get_my_going_v1 (goingShapes.ts), and the tile + strip Going number is the
 * one count over that list (goingUpcomingCount), table-driven over every shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  on: true,
  calls: [] as string[],
  reply: { upcoming: [], past: [] } as { upcoming: unknown[]; past: unknown[] },
  calendar: [] as Record<string, unknown>[],
  calendarArgs: [] as Array<{ citySlug: string | null; enabled?: boolean }>,
  activeCity: 'madrid-es' as string | null,
  slugs: {} as Record<string, string>,
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
  from: null as unknown as (table: string) => unknown,
}));
h.rpc = async (fn: string, args?: Record<string, unknown>) => {
  h.calls.push(fn);
  if (fn === 'get_my_going_v1') return { data: h.reply, error: null };
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
import { DANCER_TOKENS, contrastRatio, type DancerToken } from '@/modules/dancer-app/theme/tokens';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { shortDate } from '../../nights/nightsModel';
import { GOING_SHAPES, day, night } from '../../nights/__tests__/goingShapes';

const up = (...nights: ReturnType<typeof night>[]) => ({ upcoming: nights, past: [] });
const past = (...nights: ReturnType<typeof night>[]) => ({ upcoming: [], past: nights });
const LONG_FIRST = 'Maria-Fernanda-Alejandra-Xim'; // 29 chars with the surname below = long-name seed
const londoner = (over = {}) => makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, ...over });

beforeEach(() => {
  h.on = true; h.calls = []; h.reply = GOING_SHAPES.empty(); h.calendar = []; h.calendarArgs = []; h.activeCity = 'madrid-es'; h.slugs = { [CITY_LONDON.id]: 'london-gb' };
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { cleanup(); resetShell(); });

const home = (profile = londoner()) => renderInShell({ path: '/app/home', backend: { profile } });

describe('M14: hero text contrast', () => {
  // Calm first screen (admin #1534): the night hero is gone from Home; no gradient card renders for any shape.
  it.each([
    ['0 nights', GOING_SHAPES.empty()],
    ['an upcoming night', up(night('s1', 'Soho Sensual', 3))],
  ])('%s: no hero, no gradient card', async (_n, reply) => {
    h.reply = reply;
    home();
    await screen.findByTestId('home-main');
    expect(screen.queryByTestId('home-hero')).toBeNull();
    expect(document.querySelector('.da-hero')).toBeNull();
  });
  it('the gradient token pair keeps white text at 4.5:1', () => {
    for (const t of ['--da-gradient-from', '--da-gradient-mid', '--da-gradient-to'] as DancerToken[]) {
      expect(contrastRatio(DANCER_TOKENS['--da-on-gradient'], DANCER_TOKENS[t]), t).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('M19: no dead tiles', () => {
  it('calm Home: no tiles and no "coming soon" under the main card', async () => {
    home();
    await screen.findByTestId('home-main');
    for (const id of ['tile-views', 'tile-partner', 'tile-going', 'partner-notify']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/coming soon/i);
  });
});

describe('L4: the rate nudge names the night', () => {
  it.each([
    [6, (k: string) => `Rate ${shortDate(k)}`],
    [2, (k: string) => `Rate ${shortDate(k)}`],
    [1, () => 'Rate last night'],
  ])('%i days ago', async (ago, title) => {
    h.reply = past(night('s3', 'Thursday Social', -ago));
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
    expect(within(b).getByRole('link', { name: SHOW_AGAIN_LABEL }).getAttribute('href')).toBe('/account/settings?from=app') // S1: keeps Back to Options;
    expect(screen.getByTestId('dancer-screen-home').textContent).not.toMatch(/paus/i);
  });
});

describe('D130: no Browse events on Home', () => {
  it.each([['a night', up(night('s1', 'Soho Sensual', 3))], ['no nights', GOING_SHAPES.empty()]])('%s', async (_n, reply) => {
    h.reply = reply;
    home();
    await screen.findByTestId('home-main');
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/Browse/i);
    expect(screen.queryAllByRole('link', { name: /browse/i })).toHaveLength(0);
  });
});

describe('seeds', () => {
  // Calm Home: the tile and the strip are gone; 15 upcoming nights add no Going number to Home.
  it('15 upcoming nights: no Going tile or strip cell on Home', async () => {
    h.reply = { upcoming: Array.from({ length: 15 }, (_, i) => night(`s${i}`, `Night ${i}`, i + 1)), past: [] };
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await screen.findByTestId('home-main');
    expect(screen.queryByTestId('tile-going-count')).toBeNull();
    expect(screen.queryByTestId('stat-going-value')).toBeNull();
  });

  it('long name + no city: renders the name in full', async () => {
    home(makeProfile({ first_name: LONG_FIRST, surname: 'Rodriguez-Villanueva' }));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(LONG_FIRST);
  });
});

const REMOVED = ['home-hero', 'tile-going', 'tile-going-count', 'tile-views', 'tile-partner', 'stats-strip', 'stat-going', 'lineup-people'];

describe('Home x every get_my_going_v1 shape (calm first screen)', () => {
  it.each(Object.keys(GOING_SHAPES))('%s: main card only, removed blocks absent', async (shape) => {
    h.reply = GOING_SHAPES[shape]();
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await screen.findByTestId('home-main');
    for (const id of REMOVED) expect(screen.queryByTestId(id), id).toBeNull();
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/interested/i);
  });

  it('switch off: no get_my_going_v1 call and the main card still renders', async () => {
    h.on = false;
    h.reply = GOING_SHAPES.many();
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await screen.findByTestId('home-main');
    for (const id of REMOVED) expect(screen.queryByTestId(id), id).toBeNull();
    expect(h.calls).not.toContain('get_my_going_v1');
  });
});
