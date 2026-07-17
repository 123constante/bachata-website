import { useQuery } from '@tanstack/react-query';
import { fetchPublicFestivalsList, type FestivalListItem } from '@/lib/festivalsList';
import { londonTodayKey } from '@/lib/londonDate';

export type FestivalPreview = FestivalListItem;

export function useUpcomingFestivalsGlobal() {
  return useQuery({
    // Versioned alongside the shared festivals-list seam: the payload now comes from
    // the P5-native get_public_festivals_list_v1 rather than a direct events select.
    queryKey: ['upcoming-festivals-global-v2'],
    queryFn: async () => {
      // The RPC returns every live festival (past + future) already ordered by
      // start date, so the "upcoming" window is applied here. `date` is a London
      // calendar date — bound it with the London today key, not the browser/UTC one.
      const today = londonTodayKey();
      const rows = await fetchPublicFestivalsList();
      return rows.filter((f) => (f.date ?? '') >= today).slice(0, 40);
    },
    staleTime: 60_000,
  });
}
