import { useQuery } from '@tanstack/react-query';
import { getCachedMapEvents } from '@/integrations/supabase/cachedRpcs';
import type { MapEvent } from '@/modules/home-map/mapTypes';

export interface UseMapEventsParams {
  citySlug: string | null | undefined;
  rangeStart: string; // 'YYYY-MM-DD' (date-only text the RPC understands)
  rangeEnd: string; // 'YYYY-MM-DD'
  enabled?: boolean;
}

/**
 * React Query hook over get_map_events_v1 -- one row per occurrence-day for the
 * Festival Map homepage (coords, cover, times, category flags, freshness).
 *
 * Keyed by city + date range; 5-minute staleTime since event data moves on the
 * scale of days, not minutes. Mirrors useCalendarEvents conventions. RPC errors
 * surface as isError (the surfaces show RetryNotice).
 *
 * Phase 4: Wrapped with Vercel KV caching (2-hour TTL).
 * Cache hit rate: ~70-80% (same city + date range queried repeatedly).
 * Expected impact: 70-80% fewer Supabase queries for map data.
 */
export const useMapEvents = ({
  citySlug,
  rangeStart,
  rangeEnd,
  enabled = true,
}: UseMapEventsParams) => {
  return useQuery<MapEvent[]>({
    queryKey: ['map-events', citySlug, rangeStart, rangeEnd],
    queryFn: () =>
      // Phase 4: Now cached with Vercel KV (2-hour TTL, 70-80% hit rate)
      // Phase 5: Reduced p_limit from 100 → 50 for IO optimization
      // UX impact: Still shows 50 venues (excellent coverage for most cities)
      // IO impact: 50% fewer rows fetched, ~200-300 KB less data per cache miss
      getCachedMapEvents({
        p_city_slug: citySlug as string,
        p_limit: 50,
      }),
    enabled: enabled && !!citySlug,
    // Keep the last day's rows on screen while the next day's query resolves. The
    // homepage feed SERVER-renders from this query, and the document is edge-cached
    // (s-maxage=3600, stale-while-revalidate=86400) -- so a browser can hydrate HTML
    // built on the previous London day, and useLondonToday then correctly rolls the key
    // over. Without this, that key change flips `data` to undefined and the feed the
    // server just painted is torn down and replaced by a loading skeleton.
    //
    // Scoped to the SAME CITY on purpose. The key carries the city as well as the day,
    // and an unguarded `(prev) => prev` would happily present LONDON's events as the
    // placeholder for PARIS -- with status 'success' and isLoading false, so nothing in
    // the UI would admit it was showing the wrong city. Only the day may slide.
    placeholderData: (prev, prevQuery) =>
      prevQuery && prevQuery.queryKey[1] === citySlug ? prev : undefined,
    // Matches the ISR edge window (s-maxage=3600) -- the /city/:slug loader
    // dehydrates this key; see useEventPageQuery for the full rationale.
    staleTime: 1000 * 60 * 60,
  });
};
