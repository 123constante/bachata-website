import { supabase } from '@/integrations/supabase/client';
import { CHIP_CITY_NAMES, pickChipCities, type CityChip } from './dancer4Model';

/**
 * The quick-pick chips: the named cities that exist (public read of `cities`, the same table search_cities reads).
 * Deliberately NO is_active filter: profile_complete_v1 only needs based_city_id non-null and the FK targets
 * cities(id), so an inactive city satisfies the gate (prod has 1 active of 319).
 */
export async function fetchChipCities(): Promise<CityChip[]> {
  const { data, error } = await supabase.from('cities').select('id, name').in('name', [...CHIP_CITY_NAMES]);
  if (error) throw error;
  return pickChipCities((data ?? []) as { id: string; name: string }[]);
}

/**
 * "Tell us your city": one row in city_requests (RLS city_requests_insert_own:
 * requested_by must be the caller). Deliberately NOT behind VITE_ENABLE_CITY_REQUESTS:
 * owner decision 11 makes the request part of this flow, and the person still
 * has to pick the nearest city to continue.
 */
export async function submitCityRequest(name: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not_signed_in');
  // city_requests is not in the generated types yet (the shared pickers cast the same way).
  const table = (supabase as unknown as { from: (t: string) => { insert: (v: object) => PromiseLike<{ error: unknown }> } }).from('city_requests');
  const { error } = await table.insert({
    requested_name: name,
    requested_by: auth.user.id,
    // city_requests.context is free text (no CHECK); 'general' is the shared picker default. Source goes in notes.
    context: 'general',
    notes: 'dancer4_onboarding',
  });
  if (error) throw error;
}

/** Whether a city id exists (no is_active filter, like the chips: the gate only needs the FK). A prefilled id is checked before it is trusted. */
export async function fetchCityExists(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('cities').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data != null;
}
