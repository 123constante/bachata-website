import { useQuery } from '@tanstack/react-query';
import { fetchPublicVenuesList, type PublicVenueListItem } from '@/services/venuePublicService';

/** The venues listed on Bachata Calendar (the public venue directory's read), for the venue pickers. */
export const publicVenuesQueryKey = ['public-venues-list'] as const;

export function usePublicVenues() {
  return useQuery({ queryKey: publicVenuesQueryKey, queryFn: fetchPublicVenuesList, staleTime: 10 * 60 * 1000 });
}

export function venueName(venues: PublicVenueListItem[] | undefined, id: string | null | undefined): string | null {
  if (!id) return null;
  return venues?.find((v) => v.id === id)?.name ?? null;
}
