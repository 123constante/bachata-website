import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import type { VenueOption } from '@/modules/organiser/shared/publicVenues';

/**
 * The occurrence.set_override patch for a date's venue (G7). The city follows the
 * venue: it is resolved the way the event page resolves it (the venue row's
 * city_name through resolveCreateCityId, no organiser fallback), and going back
 * to the usual venue (null) clears the city too. A city that cannot be resolved
 * is sent as null rather than leaving the old venue's city behind.
 */
export async function venueOverridePatch(
  venueId: string | null,
  venues: VenueOption[] | undefined,
  resolveCity?: (name: string) => Promise<{ cityId: string } | null>,
): Promise<{ venue_id: string | null; city_id: string | null }> {
  if (!venueId) return { venue_id: null, city_id: null };
  const venueCityName = venues?.find((v) => v.id === venueId)?.city_name ?? null;
  const cityId = venueCityName ? await resolveCreateCityId({ venueCityName, organiserCityId: null, resolveCity }) : null;
  return { venue_id: venueId, city_id: cityId };
}
