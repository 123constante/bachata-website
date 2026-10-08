import { supabase } from '@/integrations/supabase/client';

export interface CityResult {
  id: string;
  label: string;
}

/**
 * search_cities, the same read the shared CityPicker makes. The picker is a
 * popover (banned in the organiser area), so the create screen shows these
 * results as a view of its one sheet instead.
 */
export async function searchCities(query: string): Promise<CityResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase.rpc('search_cities', { p_query: term, p_limit: 12 });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.city_id ? [{ id: row.city_id, label: row.display_name || [row.city_name, row.country_name].filter(Boolean).join(', ') }] : [],
  );
}
