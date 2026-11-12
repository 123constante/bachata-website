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
import { GOING_COPY } from '@/modules/going';
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
  // Option A Home (admin #1534) has no hero: the night is one list row, so the old hero-class assertions are retired.
  it('the gradient token pair keeps white text at 4.5:1', () => {
    for (const t of ['--da-gradient-from', '--da-gradient-mid', '--da-gradient-to'] as DancerToken[]) {
      expect(contrastRatio(DANCER_TOKENS['--da-on-gradient'], DANCER_TOKENS[t]), t).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('M19: no dead tiles', () => {
  it('Option A Home has no "coming soon" tile and no partner / numbers tiles', async () => {
    home();
    await screen.findByTestId('home-list');
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/coming soon/i);
    for (const id of ['tile-partner', 'partner-notify', 'tile-views', 'tile-strength', 'tile-going', 'stats-strip']) expect(screen.queryByTestId(id)).toBeNull();
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
    await screen.findByTestId('home-list');
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/Browse events/i);
    expect(screen.queryAllByRole('link', { name: /browse events/i })).toHaveLength(0);
  });
});

describe('seeds', () => {
  // Option A: the going list is ONE row naming the next night going ahead, never a count.
  it('15 upcoming nights: one going row naming the next night, no count tile', async () => {
    h.reply = { upcoming: Array.from({ length: 15 }, (_, i) => night(`s${i}`, `Night ${i}`, i + 1)), past: [] };
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    const row = await screen.findByTestId('home-row-going');
    // the row mounts before the going data lands; wait for the content, then assert the same facts
    await waitFor(() => expect(row.textContent).toContain('Night 0'));
    expect(screen.queryByTestId('tile-going-count')).toBeNull();
  });

  it('long name + no city: renders the name in full', async () => {
    home(makeProfile({ first_name: LONG_FIRST, surname: 'Rodriguez-Villanueva' }));
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(`Hi ${LONG_FIRST}`);
  });
});

/** shape -> [tile number, hero is a night]. Cancelled nights are not counted; a paused event's night is, but is never the hero. */
const HOME_EXPECT: Record<string, { count: string; hero: boolean }> = {
  empty: { count: '0', hero: false },
  upcomingOnly: { count: '2', hero: true },
  pastOnly: { count: '0', hero: false },
  cancelledNight: { count: '1', hero: true },
  endedNight: { count: '0', hero: false },
  eventNotLive: { count: '1', hero: false },
  many: { count: '40', hero: true },
};

describe('Home going row x every get_my_going_v1 shape', () => {
  it.each(Object.keys(GOING_SHAPES))('%s: the Going row names a night only when one is going ahead', async (shape) => {
    h.reply = GOING_SHAPES[shape]();
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await screen.findByTestId('home-list');
    const e = HOME_EXPECT[shape];
    // londoner() is unfinished: the Going row is always there; its line is a night or "Nothing booked yet.".
    await waitFor(() => expect(screen.getByTestId('home-row-going').textContent).toContain(e.hero ? ', ' : 'Nothing booked yet.'));
    expect(screen.getByTestId('dancer-screen-home').textContent ?? '').not.toMatch(/interested/i);
  });

  it('switch off: no night named, no get_my_going_v1 call, Home still renders', async () => {
    h.on = false;
    h.reply = GOING_SHAPES.many();
    renderInShell({ path: '/app/home', backend: { profile: londoner(), statsShape: 'normal' } });
    await screen.findByTestId('home-list');
    expect(screen.getByTestId('home-row-going').textContent).not.toMatch(/Nothing booked yet/);
    expect(h.calls).not.toContain('get_my_going_v1');
  });
});
