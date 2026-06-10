import { useQuery } from '@tanstack/react-query';
import { getMapEvents } from '@/integrations/supabase/eventRpcs';
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
 * surface as isError (the surfaces show RetryNotice) and route to Sentry.
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
      getMapEvents({
        city_slug_param: citySlug as string,
        range_start: rangeStart,
        range_end: rangeEnd,
      }),
    enabled: enabled && !!citySlug,
    staleTime: 1000 * 60 * 5,
  });
};
