import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { londonTodayKey } from '@/lib/londonDate';
import { fetchOrganiserHome, organiserHomeQueryKey } from '../../shared/selfServeApi';
import { analyticsKey, fetchPageAnalytics, fetchShareCode, shareCodeKey } from './analyticsV2';
import { RANGE_DAYS, fetchViewsStats, rangeFrom, viewsStatsKey, type StatsRange } from './stats';

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

/** organiser_analytics_v2 for every series in the page scope, summed, for the chosen range. */
export function useP3Analytics(range: StatsRange, seriesIds: readonly string[]) {
  const { user } = useAuth();
  const to = londonTodayKey();
  const from = rangeFrom(to, RANGE_DAYS[range]);
  return useQuery({
    queryKey: analyticsKey(user?.id, seriesIds, from, to),
    queryFn: () => fetchPageAnalytics(seriesIds, from, to),
    enabled: !!user?.id && seriesIds.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** The page's share code (organiser_share_code_v1), owners and managers only. */
export function useP3ShareCode(pageId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: shareCodeKey(user?.id, pageId),
    queryFn: () => fetchShareCode(pageId as string),
    enabled: !!user?.id && !!pageId,
    staleTime: 5 * 60_000,
  });
}
