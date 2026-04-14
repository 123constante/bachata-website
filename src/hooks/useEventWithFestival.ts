import { useQuery } from '@tanstack/react-query';
import {
  getEventDetailWithFestival,
  EventPageSnapshot,
  FestivalDetail,
} from '@/integrations/supabase/eventRpcs';

interface UseEventWithFestivalOptions {
  enabled?: boolean;
}

interface EventWithFestivalData {
  snapshot: EventPageSnapshot | null;
  festival: FestivalDetail | null;
  isFestival: boolean;
}

/**
 * Fetch event page snapshot and festival details in parallel
 * Automatically detects event type (isFestival = festival !== null)
 * Useful for event detail pages that may be either standard or festival
 */
export const useEventWithFestival = (
  eventId: string,
  occurrenceId?: string | null,
  options: UseEventWithFestivalOptions = {},
) => {
  return useQuery({
    queryKey: ['event-with-festival', eventId, occurrenceId],
    queryFn: async (): Promise<EventWithFestivalData> => {
      const { snapshot, festival } = await getEventDetailWithFestival(
        eventId,
        occurrenceId,
      );

      return {
        snapshot,
        festival,
        isFestival: festival !== null,
      };
    },
    enabled: options.enabled !== false && !!eventId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
