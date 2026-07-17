import { useQuery } from '@tanstack/react-query';
import {
  FESTIVALS_LIST_QUERY_KEY,
  fetchPublicFestivalsList,
  filterUpcomingFestivals,
  type FestivalListItem,
} from '@/lib/festivalsList';
import { londonTodayKey } from '@/lib/londonDate';

export type FestivalPreview = FestivalListItem;

export function useUpcomingFestivalsGlobal() {
  return useQuery({
    // Shares the seam's cache entry (same key, same fetcher) instead of holding
    // a second copy of the identical payload under its own identity; the
    // "upcoming" window is a select-time projection. select re-runs on render,
    // so the London-midnight rollover is picked up without a shorter staleTime.
    queryKey: FESTIVALS_LIST_QUERY_KEY,
    queryFn: fetchPublicFestivalsList,
    staleTime: 1000 * 60 * 60,
    select: (rows: FestivalListItem[]) =>
      filterUpcomingFestivals(rows, londonTodayKey()).slice(0, 40),
  });
}
