import { rpcLoose } from '@/integrations/supabase/rpcLoose';

/**
 * "Is this a real city?" -- answered ONLY by the DB's is_valid_city_slug
 * (cities.slug = lower(trim(p_slug)) AND cities.is_active). The /city/:slug
 * loader, the catchall's status gate (app/catchallGate.ts) and the client's
 * CityContext all ask here; there is no second list of cities in this repo.
 *
 * THROWS when the lookup fails, carrying the PostgREST/Postgres `code` so a
 * caller can tell a starved DB from a bug. A failed lookup is never "not a
 * city": callers answer 503 / their degraded path, never a 404 guess.
 */
export async function isRealCitySlug(slug: string): Promise<boolean> {
  const { data, error } = await rpcLoose('is_valid_city_slug', { p_slug: slug });
  if (error) {
    throw Object.assign(new Error(`is_valid_city_slug failed: ${error.message}`), {
      code: (error as { code?: unknown }).code,
    });
  }
  return data === true;
}
