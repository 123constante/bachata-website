import { resolveCanonicalCity } from '@/lib/city-canonical';

/**
 * The default_city_id a create sends (Lever 2 B1). The server's series.upsert takes the
 * city only from the payload, and event_publish_readiness_v1 refuses a series with none,
 * so an event created without one could never be approved. Source of truth, in order:
 * the chosen venue's city (the venue rows carry only city_name, so it is resolved to an
 * id with the shared resolver), else the organiser's own city_id, else null (the key is
 * then left out; an id is never invented). A resolver failure falls through to the next
 * source rather than blocking the submit.
 */
export async function resolveCreateCityId(input: {
  venueCityName: string | null;
  organiserCityId: string | null;
  resolveCity?: (name: string) => Promise<{ cityId: string } | null>;
}): Promise<string | null> {
  const resolve = input.resolveCity ?? resolveCanonicalCity;
  if (input.venueCityName?.trim()) {
    try {
      const city = await resolve(input.venueCityName);
      if (city && typeof city.cityId === 'string' && city.cityId) return city.cityId;
    } catch {
      // fall through to the organiser's city
    }
  }
  return input.organiserCityId || null;
}
