import { useQuery } from '@tanstack/react-query';
import { useCity } from '@/contexts/CityContext';
import { getLatestEvents } from '@/integrations/supabase/eventRpcs';
import { resolveEventImage } from '@/lib/utils';

/**
 * Card model for the homepage "Just added" wheel. One per most-recently
 * uploaded event (events.created_at DESC).
 */
export interface LatestEventCard {
  id: string;
  occurrenceId: string | null;
  name: string;
  createdAt: string; // ISO freshness time (UTC) -> rendered as "added/updated X ago"
  kind: 'added' | 'updated'; // drives the "Added" vs "Updated" verb on the card
  dateIso: string | null; // 'YYYY-MM-DD' display date (city tz) -- soonest upcoming occurrence
  venueName: string;
  coverImage: string | null;
  type: string; // 'festival' | 'standard' | ...
  hasClass: boolean;
  hasParty: boolean;
}

export const LATEST_EVENTS_LIMIT = 6;

/**
 * Newest uploads for the active city. Mirrors the React Query conventions of
 * useCalendarEvents: gated on citySlug, 5-minute staleTime. Returns [] (and the
 * caller hides the section) when there is no city or no data.
 */
export const useLatestEvents = (limit: number = LATEST_EVENTS_LIMIT) => {
  const { citySlug } = useCity();

  return useQuery({
    queryKey: ['latest-events', citySlug, limit],
    queryFn: async (): Promise<LatestEventCard[]> => {
      const rows = await getLatestEvents({ p_city_slug: citySlug ?? null, p_limit: limit });
      return rows.map((r) => ({
        id: r.event_id,
        occurrenceId: r.occurrence_id ?? null,
        name: r.name,
        createdAt: r.created_at,
        kind: r.freshness_kind,
        dateIso: r.instance_date ?? null,
        venueName: r.location || 'TBA',
        coverImage: resolveEventImage(r.photo_url, r.cover_image_url),
        type: r.type,
        hasClass: r.has_class,
        hasParty: r.has_party,
      }));
    },
    enabled: !!citySlug,
    staleTime: 5 * 60_000,
  });
};
