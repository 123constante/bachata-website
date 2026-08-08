// @vitest-environment node
/**
 * The /festival/:id LOADER must bound its own edge TTL.
 *
 * Separate from tests/pinnedDayKeyEdgeTtl.test.ts because this file mocks the
 * loader's data sources, and those mocks must not reach the pure cache-policy
 * cases over there. What is NOT mocked is the part under test: taggedData and
 * cacheHeaders are the real implementations, so this drives the actual seam --
 * loader computes a bound, attaches it, headers() honours it.
 *
 * WHY THIS FILE EXISTS AT ALL. The first attempt asserted the same claim by
 * hand-building the loader headers and feeding them to the route's headers()
 * export. Deleting the bound argument from the loader's taggedData call left
 * that green: it was testing cacheHeaders twice and the wiring never. Both
 * cases below were checked against that mutation.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { secondsUntilKeyRollsOver } from '@/lib/londonDate';
import { EDGE_STORE_MARGIN_SECONDS } from '../app/detailLoader';

const EVENT_UUID = '00000000-0000-4000-8000-0000000000f1';
const SLUG = 'test-festival';
const FESTIVAL_TZ = 'Africa/Tunis';

// 23:20 on the festival's own calendar: 40 minutes of the pinned day left.
const RENDERED_AT = new Date('2026-09-06T22:20:00Z');
const SECONDS_LEFT_IN_PINNED_DAY = 40 * 60;

// Lets a case advance the faked clock DURING the loader's og-card await, which
// is the only way to exercise a request that straddles the festival's midnight.
// vi.hoisted because the mock factory below is hoisted above this file's body.
const clock = vi.hoisted(() => ({ ogCardAwaitMs: 0, crossedMidnight: false }));

// Only the entity/image lookups are replaced. taggedData + cacheHeaders come
// through untouched from the real module.
vi.mock('../app/detailLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/detailLoader')>();
  const { vi: vitest } = await import('vitest');
  return {
    ...actual,
    resolveEntityInLoader: async () => ({ id: EVENT_UUID, slug: SLUG, arrivedViaUuid: false }),
    resolveOgCardImage: async () => {
      if (clock.ogCardAwaitMs > 0) {
        // On the FESTIVAL's calendar, not UTC: 22:59:59Z to 23:00:02Z is the
        // same UTC day and a different Tunis one, which is the whole point.
        const key = () =>
          new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
        const before = key();
        vitest.setSystemTime(new Date(Date.now() + clock.ogCardAwaitMs));
        clock.crossedMidnight = key() !== before;
      }
      return 'https://example.test/card.jpg';
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: {}, error: null }) },
}));

vi.mock('@/modules/event-page/festivalEventQuery', () => ({
  festivalEventQueryKey: (id: string) => ['festival-event', id],
  fetchFestivalEventRow: async () => ({ id: EVENT_UUID, name: 'Test Festival', city: 'Tunis' }),
}));

vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({
  festivalDetailQueryKey: (id: string) => ['festival-detail', id],
  fetchFestivalDetail: async () => ({
    eventId: EVENT_UUID,
    dates: { local_start: '2026-09-04', local_end: '2026-09-06', timezone: FESTIVAL_TZ },
  }),
}));

const runLoader = async () => {
  const { loader } = await import('../app/routes/festival');
  return loader({
    params: { id: SLUG },
    request: new Request(`https://example.test/festival/${SLUG}`),
    context: {} as never,
  } as never);
};

const cdnHeaderOf = async (result: unknown): Promise<string> => {
  const { headers } = await import('../app/routes/festival');
  const loaderHeaders = new Headers(
    (result as { init: { headers: Record<string, string> } }).init.headers,
  );
  return headers({ loaderHeaders } as never)['Vercel-CDN-Cache-Control'];
};

const pinnedKeyOf = (result: unknown): string =>
  (result as { data: { todayKey: string } }).data.todayKey;

beforeAll(() => {
  // Date only -- faking timers wholesale would stall the loader's awaits.
  vi.useFakeTimers({ toFake: ['Date'] });
});

beforeEach(() => {
  clock.ogCardAwaitMs = 0;
  clock.crossedMidnight = false;
  vi.setSystemTime(RENDERED_AT);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('festival loader edge TTL', () => {
  it('caps servability at the festival calendar rollover, not 25 hours', async () => {
    const result = await runLoader();

    // The pinned key the document ships with, on the FESTIVAL's calendar.
    expect(pinnedKeyOf(result)).toBe('2026-09-06');

    // Exact, not a bound: the whole point is that neither directive may push
    // this generation past the festival's own midnight. Before the fix this
    // read s-maxage=3600, stale-while-revalidate=86400.
    expect(await cdnHeaderOf(result)).toBe(
      `public, s-maxage=${SECONDS_LEFT_IN_PINNED_DAY - EDGE_STORE_MARGIN_SECONDS}`,
    );
  });

  it('keeps the full fresh window when the pinned day has hours left', async () => {
    // Early in the festival's day: the bound must not cost the normal 1h fresh
    // window, or this fix would quietly become a cache regression on every
    // festival page rather than a correction near midnight.
    vi.setSystemTime(new Date('2026-09-06T09:00:00Z')); // 10:00 in Tunis
    const cdn = await cdnHeaderOf(await runLoader());
    expect(cdn).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${50400 - EDGE_STORE_MARGIN_SECONDS - 3600}`,
    );
  });

  it('pins the day it EMITTED on, not the day it started on', async () => {
    // The loader enters at 23:59:59 and leaves after the festival's midnight,
    // because resolveOgCardImage awaits. The document must carry the day it is
    // actually being served on.
    //
    // THIS CASE PREVIOUSLY ASSERTED THE OPPOSITE. It pinned the OLD day and
    // called the resulting s-maxage=0 "the rollover being honoured" -- encoding
    // as correct a document that says "Happening now" about a festival that
    // finished, and merely declines to cache it. Declining to cache does not
    // unsay it: the requester, possibly the one crawl Googlebot makes, is still
    // served the claim. Deriving the key last fixes the document AND restores a
    // real bound.
    vi.setSystemTime(new Date('2026-09-06T22:59:59Z')); // 23:59:59 in Tunis
    clock.ogCardAwaitMs = 3000;

    const result = await runLoader();

    // Non-vacuity: the clock really did cross, so this is the late derivation
    // working and not the fixture sitting on the old day.
    expect(clock.crossedMidnight).toBe(true);
    expect(pinnedKeyOf(result)).toBe('2026-09-07');

    // ...and a full day's bound rather than the zero the stale pin forced.
    const expected = secondsUntilKeyRollsOver('2026-09-07', FESTIVAL_TZ, new Date());
    expect(expected).toBeGreaterThan(86000);
    expect(await cdnHeaderOf(result)).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${expected - EDGE_STORE_MARGIN_SECONDS - 3600}`,
    );
  });
});
