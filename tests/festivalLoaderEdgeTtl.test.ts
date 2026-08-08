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

const EVENT_UUID = '00000000-0000-4000-8000-0000000000f1';
const SLUG = 'test-festival';
const FESTIVAL_TZ = 'Africa/Tunis';

// 23:20 on the festival's own calendar: 40 minutes of the pinned day left.
const RENDERED_AT = new Date('2026-09-06T22:20:00Z');
const SECONDS_LEFT_IN_PINNED_DAY = 40 * 60;

// Lets a case advance the faked clock DURING the loader's og-card await, which
// is the only way to exercise a request that straddles the festival's midnight.
// vi.hoisted because the mock factory below is hoisted above this file's body.
const clock = vi.hoisted(() => ({ ogCardAwaitMs: 0 }));

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
        vitest.setSystemTime(new Date(Date.now() + clock.ogCardAwaitMs));
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
    expect(await cdnHeaderOf(result)).toBe(`public, s-maxage=${SECONDS_LEFT_IN_PINNED_DAY}`);
  });

  it('keeps the full fresh window when the pinned day has hours left', async () => {
    // Early in the festival's day: the bound must not cost the normal 1h fresh
    // window, or this fix would quietly become a cache regression on every
    // festival page rather than a correction near midnight.
    vi.setSystemTime(new Date('2026-09-06T09:00:00Z')); // 10:00 in Tunis
    const cdn = await cdnHeaderOf(await runLoader());
    expect(cdn).toBe('public, s-maxage=3600, stale-while-revalidate=46800');
  });

  it('grants nothing when the loader crossed midnight mid-flight', async () => {
    // `todayKey` is derived, THEN resolveOgCardImage awaits. Advance the clock
    // past the festival's midnight during that await: the emitted document
    // carries a key that is no longer today, so it must not be cached at all.
    // A bound measured off a fresh `new Date()` at emission would hand this
    // document a full fresh day instead.
    vi.setSystemTime(new Date('2026-09-06T22:59:59Z')); // 23:59:59 in Tunis
    clock.ogCardAwaitMs = 3000;

    const result = await runLoader();

    // Non-vacuity: the pin really is the OLD day and the clock really did move
    // past it, so the zero below is the rollover being honoured rather than the
    // fixture failing to render.
    expect(pinnedKeyOf(result)).toBe('2026-09-06');
    expect(secondsUntilKeyRollsOver('2026-09-06', FESTIVAL_TZ)).toBe(0);

    expect(await cdnHeaderOf(result)).toBe('public, s-maxage=0');
  });
});
