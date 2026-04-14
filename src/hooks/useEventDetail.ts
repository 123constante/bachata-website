import { useQuery } from '@tanstack/react-query';
import {
  getEventPageSnapshot,
  EventPageSnapshot,
  GetEventPageSnapshotParams,
} from '@/integrations/supabase/eventRpcs';

interface UseEventDetailOptions {
  enabled?: boolean;
}

/**
 * Fetch event detail page snapshot for a specific event and optional occurrence
 * Returns full event metadata, lineup, and occurrences
 */
export const useEventDetail = (
  params: GetEventPageSnapshotParams,
  options: UseEventDetailOptions = {},
) => {
  return useQuery({
    queryKey: ['event-detail', params.p_event_id, params.p_occurrence_id],
    queryFn: () => getEventPageSnapshot(params),
    enabled: options.enabled !== false && !!params.p_event_id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
