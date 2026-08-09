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
// ASIA/TOKYO, AND THE CHOICE IS THE POINT. This was Africa/Tunis, which is UTC+1
// year-round -- the same offset Europe/London runs at all BST season. Every
// instant in this file rendered an IDENTICAL wall clock in both zones, so the
// timezone half of the wiring was untested: replacing the loader's
// `detail?.dates?.timezone ?? 'Europe/London'` with the bare London literal left
// all four cases green. The file exists because the first version "was testing
// cacheHeaders twice and the wiring never"; the same blindness had survived one
// layer in. Tokyo is UTC+9 with no DST, so it disagrees with London by nine
// hours on every fixture below and by a whole DAY on the straddle -- see the
// discriminating-fixture guard at the top of the describe block, which fails if
// a future edit picks a zone that collapses back onto London.
const FESTIVAL_TZ = 'Asia/Tokyo';

// 23:20 on the festival's own calendar: 40 minutes of the pinned day left.
// (15:20 in London, which has 8h40m left -- the gap that makes this assertable.)
const RENDERED_AT = new Date('2026-09-06T14:20:00Z');
const SECONDS_LEFT_IN_PINNED_DAY = 40 * 60;

// Lets a case advance the faked clock DURING the loader's og-card await, which
// is the only way to exercise a request that straddles the festival's midnight.
// vi.hoisted because the mock factory below is hoisted above this file's body.
const clock = vi.hoisted(() => ({ ogCardAwaitMs: 0, crossedMidnight: false }));

// Lets a case make the festival-detail PREFETCH fail. prefetchQuery swallows
// errors, so the loader carries on with no timezone -- see the zoneResolved case.
const detailFetch = vi.hoisted(() => ({ shouldThrow: false }));

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
        // On the FESTIVAL's calendar, not UTC: 14:59:59Z to 15:00:02Z is the
        // same UTC day (and the same LONDON day) and a different Tokyo one,
        // which is the whole point. Reads FESTIVAL_TZ rather than restating the
        // zone -- the hardcoded copy that used to sit here would have gone on
        // measuring Tunis after the constant moved, silently reporting
        // crossedMidnight against a calendar the loader was no longer using.
        const key = () =>
          new Intl.DateTimeFormat('en-CA', { timeZone: FESTIVAL_TZ }).format(new Date());
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
  fetchFestivalDetail: async () => {
    if (detailFetch.shouldThrow) throw new Error('transient supabase blip');
    return {
      eventId: EVENT_UUID,
      dates: { local_start: '2026-09-04', local_end: '2026-09-06', timezone: FESTIVAL_TZ },
    };
  },
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
  detailFetch.shouldThrow = false;
  vi.setSystemTime(RENDERED_AT);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('festival loader edge TTL', () => {
  // THE FIXTURES MUST DISCRIMINATE. Everything below asserts that the bound is
  // measured on the FESTIVAL's calendar, and every one of those assertions is
  // vacuous if the chosen zone happens to match London's offset -- which is
  // exactly how this file shipped, on a zone that matched all BST season. This
  // is the guard that cannot be satisfied by luck: if a future edit picks a zone
  // that collapses back onto London, this reds first and names why, instead of
  // four green cases quietly testing nothing.
  it('uses fixture instants where the festival calendar and London DISAGREE', () => {
    const day = (tz: string, d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    const clockOf = (tz: string, d: Date) =>
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeStyle: 'medium' }).format(d);
    for (const instant of [RENDERED_AT, new Date('2026-09-06T01:00:00Z')]) {
      expect(clockOf(FESTIVAL_TZ, instant)).not.toBe(clockOf('Europe/London', instant));
    }
    // The straddle case leans harder: it needs the two calendars on different
    // DAYS, not merely different clocks, or "pins the day it EMITTED on" passes
    // whichever calendar the loader read.
    const afterStraddle = new Date('2026-09-06T15:00:02Z');
    expect(day(FESTIVAL_TZ, afterStraddle)).toBe('2026-09-07');
    expect(day('Europe/London', afterStraddle)).toBe('2026-09-06');
  });

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
    vi.setSystemTime(new Date('2026-09-06T01:00:00Z')); // 10:00 in Tokyo (02:00 London)
    const cdn = await cdnHeaderOf(await runLoader());
    expect(cdn).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${50400 - EDGE_STORE_MARGIN_SECONDS - 3600}`,
    );
  });

  it('caches nothing when the timezone could not be resolved', async () => {
    // The detail prefetch is deliberately NON-gating -- a transient blip must
    // not 500 a live festival page -- but prefetchQuery swallows the error, so
    // the loader falls back to Europe/London. That fallback is a GUESS: the
    // client's own query refetches and succeeds, so it holds Asia/Tokyo while
    // this document was pinned on London's calendar -- nine hours and, at other
    // instants, a whole day apart, so the crawled hero reads the wrong label.
    // Rendering on the guess is right; caching it is not.
    detailFetch.shouldThrow = true;

    const result = await runLoader();

    // Non-vacuity: the page really did render, on the London fallback -- 23:20
    // in Tokyo is 15:20 in London, still the same DATE at this instant, so the
    // key alone would not reveal the failure. The HEADER is what changed.
    expect(pinnedKeyOf(result)).toBe('2026-09-06');
    expect(await cdnHeaderOf(result)).toBe('public, s-maxage=0, must-revalidate');
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
    vi.setSystemTime(new Date('2026-09-06T14:59:59Z')); // 23:59:59 in Tokyo
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
