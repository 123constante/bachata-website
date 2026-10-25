import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { londonTodayKey } from '@/lib/londonDate';
import { fetchOrganiserHome, organiserHomeQueryKey } from '../../shared/selfServeApi';
import { RANGE_DAYS, fetchViewsStats, rangeFrom, viewsStatsKey } from './stats';

/** organiser_home_v1, the SAME cache entry the R1 area fills (one read, one key). */
export function useP3Home() {
  const { user } = useAuth();
  return useQuery({
    queryKey: organiserHomeQueryKey(user?.id),
    queryFn: fetchOrganiserHome,
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/**
 * Views for the last 30 London days ending today (the device's London day, not the
 * server's, so the key never waits on another read). Across midnight the key moves on
 * and the old window stays on screen until the new one lands. Today and 7 days are
 * sliced from it (stats.ts sliceStats).
 */
export function useP3Views() {
  const { user } = useAuth();
  const to = londonTodayKey();
  const from = rangeFrom(to, RANGE_DAYS.m);
  return useQuery({
    queryKey: viewsStatsKey(user?.id, from, to),
    queryFn: () => fetchViewsStats(from, to),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
