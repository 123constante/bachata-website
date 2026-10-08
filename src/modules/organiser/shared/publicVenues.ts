import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicVenuesList, type PublicVenueListItem } from '@/services/venuePublicService';

/**
 * The venues an organiser can pick (Lever 2 B2). get_organiser_venue_options_v1 (admin
 * 20261109240000) lists every venue, drafts included, to a signed-in user; the public
 * directory's get_public_venues_list_v4 hides draft venues, so a venue the team had not
 * curated yet could never be picked. Its rows are a subset of v4's keys, so the public list
 * is the fallback while the new RPC is not deployed (or errors): the merge order of the two
 * repos cannot break the picker.
 */
export type VenueOption = Pick<PublicVenueListItem, 'id' | 'name' | 'neighbourhood' | 'city_name' | 'address' | 'postcode'>;

export const venueOptionsQueryKey = ['organiser-venue-options'] as const;

type Loader = () => Promise<VenueOption[]>;

const fetchOrganiserVenueOptions: Loader = async () => {
  const { data, error } = await supabase.rpc('get_organiser_venue_options_v1' as never);
  if (error) throw error;
  return (data ?? []) as VenueOption[];
};

/** The organiser read, else the public list. Throws only when both fail. */
export async function loadVenueOptions(primary: Loader = fetchOrganiserVenueOptions, fallback: Loader = fetchPublicVenuesList): Promise<VenueOption[]> {
  try {
    return await primary();
  } catch {
    return fallback();
  }
}

export function useVenueOptions() {
  return useQuery({ queryKey: venueOptionsQueryKey, queryFn: () => loadVenueOptions(), staleTime: 10 * 60 * 1000 });
}

export function venueName(venues: VenueOption[] | undefined, id: string | null | undefined): string | null {
  if (!id) return null;
  return venues?.find((v) => v.id === id)?.name ?? null;
}
