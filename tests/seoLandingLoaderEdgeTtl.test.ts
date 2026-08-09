// @vitest-environment node
/**
 * The three SEO landing LOADERS must bound their own edge TTL, and must ship a
 * pinned day key that the dehydrated cache entry is actually filed under.
 *
 * WHY IT DRIVES THE REAL LOADERS. The equivalent festival gate was first
 * written by hand-building loader headers and feeding them to the route's
 * headers() export; deleting the fix from the route left it green, because it
 * exercised cacheHeaders twice and the wiring never. Only the event RPC is
 * mocked here -- loadSeoLandingDay, taggedData and cacheHeaders are all the
 * real implementations, so these cases fail if the bound stops being computed,
 * stops being attached, or stops being honoured.
 *
 * The hydration-pin case is not decoration either. These routes cannot adopt
 * /festival's "derive the key last" shape: the key is an INPUT to the fetch and
 * seeds the dehydrated query key, so moving the derivation below the await
 * would ship a key the entry is not filed under and the client would hydrate
 * against a miss. That case fails on exactly that mutation.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { EDGE_STORE_MARGIN_SECONDS } from '../app/detailLoader';
import { SEO_LANDING_WINDOWS, seoLandingEventsKey } from '@/lib/seoLandingEvents';

// Lets a case advance the faked clock DURING the loader's event fetch, which is
// the only way to exercise a request straddling London midnight.
// vi.hoisted because the mock factory below is hoisted above this file's body.
const rpc = vi.hoisted(() => ({ calls: 0, advanceMsOnFirstCall: 0 }));

vi.mock('@/integrations/supabase/eventRpcs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/supabase/eventRpcs')>();
  const { vi: vitest } = await import('vitest');
  return {
    ...actual,
    getCalendarEvents: async () => {
      rpc.calls += 1;
      if (rpc.calls === 1 && rpc.advanceMsOnFirstCall > 0) {
        vitest.setSystemTime(new Date(Date.now() + rpc.advanceMsOnFirstCall));
      }
      return [];
    },
  };
});

// 23:20 on the London clock (BST): 40 minutes of the pinned day left.
const RENDERED_AT = new Date('2026-09-06T22:20:00Z');
const SECONDS_LEFT_IN_PINNED_DAY = 40 * 60;
// 10:00 London, so 14 hours remain -- comfortably past the 1h fresh window.
const MID_MORNING = new Date('2026-09-06T09:00:00Z');
const SECONDS_LEFT_MID_MORNING = 14 * 60 * 60;

const ROUTES = [
  {
    name: '/bachata-london-{weekday}',
    load: () => import('../app/routes/bachata-weekday'),
    windowDays: SEO_LANDING_WINDOWS.weekday,
  },
  {
    name: '/learn-bachata-london',
    load: () => import('../app/routes/learn-bachata-london'),
    windowDays: SEO_LANDING_WINDOWS.learn,
  },
  {
    name: '/london-bachata-guide',
    load: () => import('../app/routes/london-bachata-guide'),
    windowDays: SEO_LANDING_WINDOWS.guide,
  },
];

const cdnHeaderOf = (mod: { headers: unknown }, result: unknown): string => {
  const loaderHeaders = new Headers(
    (result as { init: { headers: Record<string, string> } }).init.headers,
  );
  const headers = mod.headers as (a: unknown) => Record<string, string>;
  return headers({ loaderHeaders })['Vercel-CDN-Cache-Control'];
};

const pinnedKeyOf = (result: unknown): string =>
  (result as { data: { todayKey: string } }).data.todayKey;

const dehydratedKeys = (result: unknown): string[] =>
  (result as { data: { dehydratedState: { queries: { queryKey: unknown }[] } } })
    .data.dehydratedState.queries.map((q) => JSON.stringify(q.queryKey));

beforeAll(() => {
  // Date only -- faking timers wholesale would stall the loader's awaits.
  vi.useFakeTimers({ toFake: ['Date'] });
});

beforeEach(() => {
  rpc.calls = 0;
  rpc.advanceMsOnFirstCall = 0;
  vi.setSystemTime(RENDERED_AT);
});

afterAll(() => {
  vi.useRealTimers();
});

describe.each(ROUTES)('SEO landing loader edge TTL -- $name', ({ load, windowDays }) => {
  it('caps servability at the London rollover, not 25 hours', async () => {
    const mod = await load();
    const result = await mod.loader();

    expect(pinnedKeyOf(result)).toBe('2026-09-06');

    // Exactly ONE fetch on the ordinary path -- the non-vacuity partner to the
    // straddle case's `toBe(2)`. Without it, a regression making the re-derive
    // fire on EVERY render (swap londonDateKey for a formatter of a different
    // string shape and the comparison is permanently true) doubles the RPC load
    // on all nine landing pages while every other assertion here still passes:
    // the second fetch returns the same rows under the same key.
    expect(rpc.calls).toBe(1);

    // Exact, not an upper bound: neither directive may push this generation
    // past London midnight. Unbounded this read
    // s-maxage=3600, stale-while-revalidate=86400.
    expect(cdnHeaderOf(mod, result)).toBe(
      `public, s-maxage=${SECONDS_LEFT_IN_PINNED_DAY - EDGE_STORE_MARGIN_SECONDS}`,
    );
  });

  it('keeps the full fresh window when the pinned day has hours left', async () => {
    // Otherwise the bound is not a correction near midnight but a cache
    // regression on every render of these pages.
    vi.setSystemTime(MID_MORNING);
    const mod = await load();
    const result = await mod.loader();

    expect(cdnHeaderOf(mod, result)).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${
        SECONDS_LEFT_MID_MORNING - EDGE_STORE_MARGIN_SECONDS - 3600
      }`,
    );
  });

  it('dehydrates the entry the shipped key is filed under', async () => {
    // The hydration pin. If the key ever gets derived below the fetch -- the
    // shape /festival adopted -- the shipped key and the cached entry diverge,
    // the client hydrates against a miss and re-fetches over server HTML that
    // already had events.
    const mod = await load();
    const result = await mod.loader();

    expect(dehydratedKeys(result)).toContain(
      JSON.stringify(seoLandingEventsKey(pinnedKeyOf(result), windowDays)),
    );
  });

  it('pins the day it EMITTED on when the fetch straddled midnight', async () => {
    // Enters at 23:59:59 and leaves after London midnight. Declining to cache
    // the stale pin would not unsay it -- the requester, possibly the one crawl
    // Googlebot makes, is still served the listing -- so the loader re-derives
    // and re-fetches on the new key.
    vi.setSystemTime(new Date('2026-09-06T22:59:59Z')); // 23:59:59 London
    rpc.advanceMsOnFirstCall = 3000;

    const mod = await load();
    const result = await mod.loader();

    // Non-vacuity: the clock really crossed and the loader really re-fetched,
    // so the assertions below are the retry working rather than the fixture
    // never leaving the old day.
    expect(rpc.calls).toBe(2);
    expect(pinnedKeyOf(result)).toBe('2026-09-07');

    // The shipped key still owns a dehydrated entry, and the bound is a real
    // day rather than the zero a stale pin would have forced.
    expect(dehydratedKeys(result)).toContain(
      JSON.stringify(seoLandingEventsKey('2026-09-07', windowDays)),
    );

    // ...and yesterday's superseded entry is GONE, not merely outranked.
    // `toContain` above is blind to an extra entry, and dehydrate() serialises
    // the WHOLE cache: on /learn and the weekday pages one entry is a 28-day
    // London window, so leaving it ships hundreds of event rows twice inside
    // the SSR document whose payload weight is the entire SEO product here.
    expect(dehydratedKeys(result).filter((k) => k.includes('calendar-events'))).toHaveLength(1);
    expect(cdnHeaderOf(mod, result)).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${86400 - 2 - EDGE_STORE_MARGIN_SECONDS - 3600}`,
    );
  });
});
