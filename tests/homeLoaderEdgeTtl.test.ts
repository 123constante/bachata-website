// @vitest-environment node
/**
 * The HOMEPAGE loader must bound its edge TTL by the SOONEST of two expiries:
 * the pinned London day, and the next instant its server-rendered "On now" /
 * "Soon" badge changes answer.
 *
 * WHY BOTH. /city/:slug pins todayKey AND nowMs. A day bound alone fixes the
 * grouping and leaves a finished social reading "On now" to Googlebot for the
 * rest of the evening -- worse than no bound, because the page then looks fixed.
 * A badge bound alone would leave the quiet hours after the last event ends
 * unbounded back to 25 hours.
 *
 * WHY IT DRIVES THE REAL LOADER. The first festival gate of this family was
 * written by hand-building loader headers and feeding them to headers(); it
 * stayed green when the fix was deleted from the route, because it exercised
 * cacheHeaders twice and the wiring never. Only the two event RPCs are mocked
 * here -- the key derivation, soonestLiveStatusChangeMs, taggedData and
 * cacheHeaders are all real.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { EDGE_STORE_MARGIN_SECONDS } from '../app/detailLoader';
import { londonDateKey } from '@/lib/londonDate';
import { todayLiveStatus, type MapEvent } from '@/modules/home-map/mapTypes';

const rpc = vi.hoisted(() => ({
  calendarCalls: 0,
  mapCalls: 0,
  mapRows: [] as unknown[],
  advanceMsOnFirstCall: 0,
}));

vi.mock('@/integrations/supabase/eventRpcs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/supabase/eventRpcs')>();
  const { vi: vitest } = await import('vitest');
  return {
    ...actual,
    getCalendarEvents: async () => {
      rpc.calendarCalls += 1;
      if (rpc.calendarCalls === 1 && rpc.advanceMsOnFirstCall > 0) {
        vitest.setSystemTime(new Date(Date.now() + rpc.advanceMsOnFirstCall));
      }
      return [];
    },
    getMapEvents: async () => {
      rpc.mapCalls += 1;
      return rpc.mapRows;
    },
  };
});

const TODAY = '2026-09-06';
// 10:00 on the London clock (BST) -- 14 hours of the pinned day left, well past
// the 1h fresh window, so an unbounded regression is unmistakable.
const MID_MORNING = new Date('2026-09-06T09:00:00Z');
const SECONDS_LEFT_MID_MORNING = 14 * 60 * 60;

const row = (over: Record<string, unknown> = {}) => ({
  occurrence_id: 'o1',
  event_id: '11111111-1111-4111-8111-111111111111',
  name: 'Sensual Social',
  cover_image_url: null,
  venue_name: null,
  area: null,
  city_slug: 'london-gb',
  lat: null,
  lng: null,
  instance_date: TODAY,
  start_time: `${TODAY} 20:00:00+00`,
  end_time: `${TODAY} 23:00:00+00`,
  type: 'standard',
  has_party: true,
  has_class: false,
  class_start: null,
  class_end: null,
  party_start: null,
  party_end: null,
  created_at: null,
  updated_at: null,
  freshness_kind: null,
  is_cancelled: false,
  cancellation_reason_label: null,
  ...over,
});

const cdnHeaderOf = (mod: { headers: unknown }, result: unknown): string => {
  const loaderHeaders = new Headers(
    (result as { init: { headers: Record<string, string> } }).init.headers,
  );
  const headers = mod.headers as (a: unknown) => Record<string, string>;
  return headers({ loaderHeaders })['Vercel-CDN-Cache-Control'];
};

const dataOf = (result: unknown) =>
  (result as { data: { todayKey: string; nowMs: number } }).data;

/** The two pins the document ships must name the SAME London day. They are the
 *  joint input to every badge (todayLiveStatus gates on the key and measures
 *  against the clock), so a pair naming different days is not a stale render but
 *  a false one. Held on every path by reading both from one Date.now(). */
const expectPinnedPairAgree = (result: unknown) => {
  const { todayKey, nowMs } = dataOf(result);
  expect(londonDateKey(new Date(nowMs))).toBe(todayKey);
};

const dehydratedKeys = (result: unknown): string[] =>
  (result as { data: { dehydratedState: { queries: { queryKey: unknown }[] } } })
    .data.dehydratedState.queries.map((q) => JSON.stringify(q.queryKey));

const run = async () => {
  const mod = await import('../app/routes/home');
  const result = await (mod.loader as (a: unknown) => Promise<unknown>)({
    params: { slug: 'london-gb' },
  });
  return { mod, result };
};

/** `public, s-maxage=A, stale-while-revalidate=B` -> A + B. An ABSENT stale
 *  window is the intended spelling of zero (see cacheControl in detailLoader). */
const totalServableSeconds = (value: string): number =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('s-maxage=') || s.startsWith('stale-while-revalidate='))
    .reduce((sum, s) => sum + Number(s.slice(s.indexOf('=') + 1)), 0);

beforeAll(() => {
  process.env.VITE_SUPABASE_URL ||= 'https://stub-project.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'stub-publishable-key';
  // Date only -- faking timers wholesale would stall the loader's awaits.
  vi.useFakeTimers({ toFake: ['Date'] });
});

beforeEach(() => {
  rpc.calendarCalls = 0;
  rpc.mapCalls = 0;
  rpc.mapRows = [];
  rpc.advanceMsOnFirstCall = 0;
  vi.setSystemTime(MID_MORNING);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('home loader edge TTL', () => {
  it('caps servability at the London rollover when no badge changes sooner', async () => {
    // An empty feed: nothing to expire but the day itself. Unbounded this read
    // s-maxage=3600, stale-while-revalidate=86400 -- 25 hours for one clock read.
    const { mod, result } = await run();

    expect(dataOf(result).todayKey).toBe(TODAY);
    expect(rpc.mapCalls).toBe(1);
    expect(cdnHeaderOf(mod, result)).toBe(
      `public, s-maxage=3600, stale-while-revalidate=${
        SECONDS_LEFT_MID_MORNING - EDGE_STORE_MARGIN_SECONDS - 3600
      }`,
    );
  });

  it('measures the bound at EMISSION, not at the pin', async () => {
    // The gap between the two is the fetch, and it runs one way: sizing from
    // `nowMs` over-grants by however long the RPCs took, so every entry outlives
    // its own content by that much. Two minutes here, far short of a midnight
    // straddle, so the key never changes and nothing else in the loader moves --
    // which is what makes the number attributable.
    //
    // THE FEED IS POPULATED ON PURPOSE, and the first draft of this case was
    // wrong without it: with no rows the badge branch never runs and the day
    // bound wins, and secondsUntilKeyRollsOver reads the clock ITSELF, so it
    // absorbs the advance whether the caller measured at emission or not. The
    // case passed against the very mutation it was written for. Only the badge
    // half carries an instant the loader has to subtract by hand, so only a
    // fixture where the badge half WINS can gate it.
    rpc.advanceMsOnFirstCall = 120_000;
    rpc.mapRows = [row()];

    const { mod, result } = await run();
    expect(rpc.calendarCalls).toBe(1); // the clock moved but the day did not
    // 20:00 London (the start edge, where the row becomes ON) is 19:00Z; the
    // loader emits at 09:02Z. Comfortably inside the day bound, so this number
    // can only have come from the badge derivation.
    const SECONDS_TO_START_EDGE = 10 * 60 * 60;
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      SECONDS_TO_START_EDGE - 120 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('collapses to the badge edge when one lands before midnight', async () => {
    // 22:55 London, mid-event: 65 minutes of the calendar day left, but only 6
    // minutes of "On now" being TRUE. The day bound would grant the other 59.
    vi.setSystemTime(new Date('2026-09-06T21:55:00Z'));
    rpc.mapRows = [row()];

    const { mod, result } = await run();
    // 23:01 London (the first minute todayLiveStatus stops saying on-now) is
    // 22:01Z -- 6 minutes out.
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      6 * 60 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('floors a tiny-but-honest badge bound at five minutes', async () => {
    // 23:00 London, one minute short of the 23:01 edge. Unfloored this grants
    // 60s - margin, and the homepage re-invokes the SSR function every minute
    // through evening peak. The badge is a client-subscribing leaf (homeClock's
    // useHomeNow, 60s tick), so the only reader a 60s bound protects over a
    // 300s one is a crawler that does not run JS.
    //
    // NON-VACUITY: 300 is not reachable from the day bound (3600s here) nor
    // from the edge (60s), so only the floor can produce it.
    vi.setSystemTime(new Date('2026-09-06T22:00:00Z'));
    rpc.mapRows = [row()];

    const { mod, result } = await run();
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      300 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('does not let the floor raise the bound past the day rollover', async () => {
    // The half of the floor that is easy to get wrong: it applies to the BADGE
    // term, never to the combined value. 23:58:30 London leaves 90s of the
    // pinned day and 30s to the badge edge; flooring the MINIMUM would serve
    // this document 300s -- 210 of them under a todayKey that has rolled over.
    vi.setSystemTime(new Date('2026-09-06T22:58:30Z'));
    rpc.mapRows = [row({ end_time: `${TODAY} 23:58:00+00` })];

    const { mod, result } = await run();
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      90 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('reverts to the day bound when the same row is NOT today', async () => {
    // Non-vacuity for the case above: identical fixture, one field moved. If the
    // 6 minutes came from anywhere but the badge derivation, this stays at 6.
    vi.setSystemTime(new Date('2026-09-06T21:55:00Z'));
    rpc.mapRows = [row({ instance_date: '2026-09-07' })];

    const { mod, result } = await run();
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      65 * 60 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('does not shorten the bound for a badge edge already past', async () => {
    // 23:30 London: the badge has been null since 23:01 and stays null. The
    // remaining half-hour of the day is the only honest expiry.
    vi.setSystemTime(new Date('2026-09-06T22:30:00Z'));
    rpc.mapRows = [row()];

    const { mod, result } = await run();
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      30 * 60 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('declines to cache at all when the badge edge fell inside the fetch', async () => {
    // The loader's headline claim, asserted nowhere before this: a mark between
    // the pin and emission means the document was already false when it was
    // emitted, so it is served and never stored. The claim threads four
    // hand-offs -- (mark - Date.now()) / 1000, String(-0.5), parseEdgeTtlBound,
    // Math.max(0, floor - margin) -- and each can regress to a fail-open on its
    // own, restoring hours of caching for a badge that is already wrong with
    // every other case in this file still green.
    //
    // 19:59:30 London, 30s short of the 20:00 start edge; the fetch takes 60s.
    vi.setSystemTime(new Date('2026-09-06T18:59:30Z'));
    rpc.advanceMsOnFirstCall = 60_000;
    rpc.mapRows = [row()];

    const { mod, result } = await run();
    expect(rpc.calendarCalls).toBe(1); // no straddle: the day never moved
    expect(cdnHeaderOf(mod, result)).toBe('public, s-maxage=0, must-revalidate');
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(0);
  });

  it('pins the day it EMITTED on when the fetch straddled midnight', async () => {
    // Enters at 23:59:59 and leaves after London midnight. The key is an INPUT
    // to both queries, so the /festival "derive it last" shape is unavailable
    // and the loader re-derives and re-fetches instead.
    vi.setSystemTime(new Date('2026-09-06T22:59:59Z'));
    rpc.advanceMsOnFirstCall = 3000;

    const { result } = await run();

    // Non-vacuity: the clock really crossed and both queries really re-ran.
    expect(rpc.calendarCalls).toBe(2);
    expect(rpc.mapCalls).toBe(2);
    expect(dataOf(result).todayKey).toBe('2026-09-07');
    // THE PAIR INVARIANT. Both pins ship, and every badge is computed from the
    // two together: a re-derived key against a clock still on the previous day
    // reads minute 1439 of the NEW day, which is the one combination that can
    // make todayLiveStatus assert a status no row is in. Nothing else in this
    // file catches it -- the numbers below survive the desync intact.
    expectPinnedPairAgree(result);

    // The shipped key owns a dehydrated entry...
    expect(dehydratedKeys(result)).toContain(
      JSON.stringify(['map-events', 'london-gb', '2026-09-07', '2026-12-06']),
    );
    // ...and yesterday's superseded 90-day window is GONE, not merely outranked.
    // dehydrate() serialises the WHOLE cache, so leaving it ships the feed twice
    // inside the site's busiest document.
    expect(dehydratedKeys(result).filter((k) => k.includes('map-events'))).toHaveLength(1);
    expect(dehydratedKeys(result).filter((k) => k.includes('calendar-events'))).toHaveLength(1);
  });

  it('reads the feed back under the RE-DERIVED key after a straddle', async () => {
    // The read-back keys must follow the retry. Built from the original day they
    // return undefined, which empties the crawlable sr-only nav AND -- since the
    // same rows feed the badge bound -- silently reverts to the day-only bound
    // this change replaces. Two failures, no throw, on the one path no ordinary
    // request takes, so it needs its own case rather than trust in the diff.
    vi.setSystemTime(new Date('2026-09-06T22:59:59Z'));
    rpc.advanceMsOnFirstCall = 3000;
    rpc.mapRows = [
      row({ instance_date: '2026-09-07', start_time: '2026-09-07 20:00:00+00', end_time: null }),
    ];

    const { mod, result } = await run();
    expect(dataOf(result).todayKey).toBe('2026-09-07');
    expectPinnedPairAgree(result);
    // WHAT THE PAIR INVARIANT BUYS, on this fixture specifically. Keyed to the
    // 7th but clocked at 23:59 on the 6th, this row -- 20:00 on the 7th, no end
    // -- passes the today gate and is then measured against minute 1439, so it
    // server-renders "On now" for an event 20 hours away, and the bound below
    // edge-caches that claim for 18 more hours. Every number in this case is
    // reachable either way, which is what made it a green test of a live defect.
    expect(
      todayLiveStatus(
        rpc.mapRows[0] as MapEvent,
        new Date(dataOf(result).nowMs),
        dataOf(result).todayKey,
      ),
    ).toBeNull();
    // The row reached the crawlable nav...
    expect((result as { data: { seoEventLinks: unknown[] } }).data.seoEventLinks).toHaveLength(1);
    // ...and its 20:00 start edge (19:00Z on the 7th), not the 86398s day bound,
    // is what sized the TTL.
    expect(totalServableSeconds(cdnHeaderOf(mod, result))).toBe(
      71998 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('dehydrates the entry the shipped key is filed under', async () => {
    // The hydration pin. Derive todayKey below the fetch and the client hydrates
    // against a miss, refetching over server HTML that already had events.
    const { result } = await run();
    expect(dehydratedKeys(result)).toContain(
      JSON.stringify(['map-events', 'london-gb', dataOf(result).todayKey, '2026-12-05']),
    );
  });
});
