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

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
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

describe('M14: hero text contrast', () => {
  // The hero is painted by the stylesheet now (.da-hero = scrimmed sunset gradient); the ratios of its stops are
  // computed in tests/client/dancerAppColor.test.ts. Here: the night hero carries the class, the plain card does not.
  it.each([
    ['0 nights (empty hero)', [] as Record<string, unknown>[], false],
    ['an upcoming night', [row('s1', 'Soho Sensual', 3)], true],
  ])('%s: gradient only where white text sits on it', async (_n, rows, gradient) => {
    h.rows = rows;
    home();
    const hero = await screen.findByTestId('home-hero');
    await waitFor(() => expect(hero.classList.contains('da-hero')).toBe(gradient));
  });
  it('the gradient token pair keeps white text at 4.5:1', () => {
    for (const t of ['--da-gradient-from', '--da-gradient-mid', '--da-gradient-to'] as DancerToken[]) {
      expect(contrastRatio(DANCER_TOKENS['--da-on-gradient'], DANCER_TOKENS[t]), t).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('M19: no dead tiles', () => {
  it('B1b: the only "coming soon" tile is partner search, and it has a working button', async () => {
    home();
    await screen.findByTestId('home-hero');
    // The numbers tiles are real (they link to My page); the one coming-soon tile can be asked about.
    expect(await screen.findByTestId('tile-views')).toBeTruthy();
    expect(screen.queryByTestId('tile-partners')).toBeNull();
    const text = screen.getByTestId('dancer-screen-home').textContent ?? '';
    expect(text.match(/coming soon/gi)).toHaveLength(1);
    expect(screen.getByTestId('tile-partner').textContent).toMatch(/Partner search: coming soon/);
    expect((screen.getByTestId('partner-notify') as HTMLButtonElement).disabled).toBe(false);
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
    expect(within(b).getByRole('link', { name: SHOW_AGAIN_LABEL }).getAttribute('href')).toBe('/account/settings?from=app') // S1: keeps Back to Options;
    expect(screen.getByTestId('dancer-screen-home').textContent).not.toMatch(/paus/i);
  });
});

describe('D130: no Browse events on Home', () => {
  it.each([['a night', [row('s1', 'Soho Sensual', 3)]], ['no nights', []]])('%s', async (_n, rows) => {
    h.rows = rows as Record<string, unknown>[];
    home();
    await screen.findByTestId('home-hero');
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/Browse/i);
    expect(screen.queryAllByRole('link', { name: /browse/i })).toHaveLength(0);
  });
});

describe('seeds', () => {
  // Review F7 (owner decision): the tile reads my_dancer_stats_v1.nights_going_upcoming, the
  // same number as the strip's Going cell, not a count of these 15 list rows.
  it('15 nights in the list: the count tile says the stats Going number (3), same as the strip', async () => {
    h.rows = Array.from({ length: 15 }, (_, i) => row(`s${i}`, `Night ${i}`, i + 1, i % 2 ? 'interested' : 'going'));
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await waitFor(() => expect(screen.getByTestId('tile-going-count').textContent).toBe('3'));
    expect(screen.getByTestId('stat-going-value').textContent).toBe('3');
  });

  it('long name + no city: renders the name in full', async () => {
    home(makeProfile({ first_name: LONG_FIRST, surname: 'Rodriguez-Villanueva' }));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(LONG_FIRST);
  });
});
