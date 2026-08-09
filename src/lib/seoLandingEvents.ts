import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { getCalendarEvents, type CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import {
  LONDON_TZ,
  londonDateKey,
  londonDayRangeUtc,
  secondsUntilKeyRollsOver,
} from '@/lib/londonDate';

/**
 * The single calendar-events fetch seam for the SEO landing pages, in the shape
 * of `festivalsList.ts`.
 *
 * The 9 event-bearing landing pages (/london-bachata-guide,
 * /learn-bachata-london and the 7 /bachata-london-{weekday} pages) moved off
 * build-time prerender onto on-demand SSR + tagged ISR, so their loaders now
 * dehydrate the list the page renders. Loader and component MUST agree on the
 * query key or the client would hydrate against a different entry, re-fetch,
 * and render an empty list over server HTML that had events -- a hydration
 * mismatch, not just a wasted request. Sharing ONE key builder and ONE fetcher
 * makes that structurally impossible instead of a review rule.
 *
 * The key reproduces `useCalendarEvents`'s exactly
 * (`['calendar-events', rangeStart.toISOString(), rangeEnd.toISOString(), citySlug]`,
 * see hooks/useCalendarEventsRpc.ts) so the two hooks share cache entries where
 * their windows coincide.
 */

/**
 * The city these pages are ABOUT -- a constant, deliberately not `useCity()`.
 *
 * CityContext seeds itself from localStorage on non-/city routes, so a returning
 * visitor whose last city was e.g. `manchester-gb` would hydrate these pages
 * with a different citySlug -- hence a different query key -- than the server
 * dehydrated, blanking a server-rendered list on the first client render. That
 * was survivable while the list was client-only and empty in the HTML; it is a
 * hydration mismatch now that the HTML carries real events.
 *
 * Pinning is also the honest semantics: every one of these pages is titled,
 * canonicalised and written about London, so a Manchester slug rendering
 * Manchester events under an <h1> reading "Bachata in London on Fridays" was
 * always wrong.
 */
export const SEO_LANDING_CITY_SLUG = 'london-gb';

/**
 * The look-ahead window per landing surface, in days. Shared so a route loader
 * and its page cannot drift into two different query keys -- the window is part
 * of the key.
 */
export const SEO_LANDING_WINDOWS = {
  /** /london-bachata-guide -- "what's on this week". */
  guide: 7,
  /** /learn-bachata-london -- beginner classes over the next four weeks. */
  learn: 28,
  /** /bachata-london-{weekday} -- the next four of that weekday. */
  weekday: 28,
} as const;

/** Cache lifetime: matches the ISR edge window (s-maxage=3600) these pages sit behind. */
export const SEO_LANDING_STALE_TIME = 1000 * 60 * 60;

export function seoLandingEventsKey(todayKey: string, windowDays: number) {
  const { start, end } = londonDayRangeUtc(todayKey, windowDays);
  return ['calendar-events', start.toISOString(), end.toISOString(), SEO_LANDING_CITY_SLUG];
}

export function fetchSeoLandingEvents(
  todayKey: string,
  windowDays: number,
): Promise<CalendarEventRow[]> {
  const { start, end } = londonDayRangeUtc(todayKey, windowDays);
  return getCalendarEvents({
    range_start: start.toISOString(),
    range_end: end.toISOString(),
    city_slug_param: SEO_LANDING_CITY_SLUG,
  });
}

/**
 * Loader side: fill `qc` with the entry the page will read, then dehydrate it.
 *
 * `fetchQuery` (NOT `prefetchQuery`) so a transient RPC error THROWS out of the
 * loader -> 500 with no Vercel-Cache-Tag -> cacheHeaders leaves it uncached,
 * instead of edge-caching an empty listing for an hour on these SEO-critical
 * pages. Mirrors the /festivals + detail routes.
 */
export function fetchSeoLandingEventsIntoCache(
  qc: QueryClient,
  todayKey: string,
  windowDays: number,
): Promise<CalendarEventRow[]> {
  return qc.fetchQuery({
    queryKey: seoLandingEventsKey(todayKey, windowDays),
    queryFn: () => fetchSeoLandingEvents(todayKey, windowDays),
    staleTime: SEO_LANDING_STALE_TIME,
  });
}

/**
 * The whole loader-side sequence for an SEO landing route: pin the London day,
 * fill `qc` with the entry the page will read, and report how long that pin
 * stays true so the caller can bound its edge TTL.
 *
 * ONE helper rather than three copies because the ORDER is load-bearing and is
 * not self-evident at a call site. `todayKey` must be derived BEFORE the fetch
 * -- it is an INPUT to it and it seeds the dehydrated query key -- while the
 * bound must be measured AFTER it, at emission. /festival/:id fixed the same
 * defect by moving its derivation below its awaits; that option does not exist
 * here, and a route that "tidied" the derivation downward would ship a key the
 * dehydrated entry is not filed under, hydrating against a miss and re-fetching
 * over server HTML that already had events -- the failure useSeoLandingEvents
 * warns about below. Sharing the sequence makes that mistake unavailable, which
 * is the argument this module already makes for sharing ONE key builder.
 *
 * WHY A BOUND AT ALL. These documents are edge-cached at s-maxage=3600 +
 * stale-while-revalidate=86400 -- 25 hours of servability for one generation,
 * with nothing evicting on a clock tick, since the tag purge fires on content
 * edits and time passing is not one. A page rendered at 23:50 is otherwise
 * still served at 00:50, to a reader or to Googlebot, listing a window that
 * opened yesterday. See edgeCacheControl in app/detailLoader.ts for what the
 * cap buys and what it costs.
 *
 * THE MIDNIGHT STRADDLE. A fetch that spans London midnight leaves the pin
 * stale before the document is even emitted. /festival/:id settles this by
 * deriving its key last, on the ground that declining to CACHE a false claim
 * does not unsay it -- the requester, possibly the single crawl Googlebot
 * makes, is still served it. Deriving last is unavailable here, so the
 * equivalent is to re-derive and re-fetch: at most one extra RPC, in a window
 * as wide as one fetch out of a day, in exchange for never emitting a listing
 * whose window opened yesterday.
 *
 * The retry is bounded at one, and `secondsUntilKeyRollsOver` -- keyed on the
 * PIN, not on `now` -- backstops it: were the second fetch to straddle midnight
 * too, the bound reads 0 and that document is served but never cached.
 */
export async function loadSeoLandingDay(qc: QueryClient, windowDays: number) {
  let todayKey = londonDateKey(new Date());
  await fetchSeoLandingEventsIntoCache(qc, todayKey, windowDays);

  const keyAtEmission = londonDateKey(new Date());
  if (keyAtEmission !== todayKey) {
    const supersededKey = todayKey;
    todayKey = keyAtEmission;
    await fetchSeoLandingEventsIntoCache(qc, todayKey, windowDays);
    // Evict yesterday's entry before dehydrate() sees it. The client only ever
    // reads the key this function returns, so leaving it would not be WRONG --
    // but dehydrate serialises every entry in the cache, and on /learn and the
    // weekday pages one entry is a 28-day London window, which in a busy month
    // is hundreds of event rows. Shipping that array twice would double the
    // dehydrated payload of exactly the documents whose SSR weight is the SEO
    // product, to buy a cache entry nothing reads.
    qc.removeQueries({ queryKey: seoLandingEventsKey(supersededKey, windowDays) });
  }

  // MEASURED OFF THE PIN, WHICH IS WHY THIS NEEDS NO THIRD STRADDLE CHECK.
  // `secondsUntilKeyRollsOver` is keyed on `todayKey`, not on `now`, so if the
  // SECOND fetch also crossed midnight it returns 0 on its own and
  // edgeCacheControl declines to cache the document. That is the same backstop
  // the one-retry bound rests on above, not a second unguarded clock read.
  //
  // NOT pinDayAndBound, despite the family resemblance. That helper detects a
  // straddle between two ADJACENT statements, where the only evidence is a zero
  // bound. Here the straddle spans an awaited fetch and the evidence is the key
  // itself changing -- and, unlike there, the pin is an INPUT to work already
  // done, so recovering means re-fetching rather than re-reading. Two different
  // straddles with two different signals; collapsing them would need the weaker
  // signal to stand in for the stronger one.
  return {
    todayKey,
    edgeTtlBoundSeconds: secondsUntilKeyRollsOver(todayKey, LONDON_TZ),
  };
}

/**
 * Component side: the same key + fetcher, so the dehydrated entry IS the entry
 * this hook reads. `todayKey` must be the pinned first-render key (the loader's,
 * threaded through `useLondonToday(serverTodayKey)`), never a freshly derived
 * one -- an ISR document served after a London midnight would otherwise hydrate
 * against tomorrow's key.
 */
export function useSeoLandingEvents(
  todayKey: string,
  windowDays: number,
  enabled = true,
) {
  return useQuery({
    queryKey: seoLandingEventsKey(todayKey, windowDays),
    queryFn: () => fetchSeoLandingEvents(todayKey, windowDays),
    enabled,
    staleTime: SEO_LANDING_STALE_TIME,
  });
}
