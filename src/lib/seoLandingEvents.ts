import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { getCalendarEvents, type CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { londonDayRangeUtc } from '@/lib/londonDate';

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
