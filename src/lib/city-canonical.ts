import { supabase } from '@/integrations/supabase/client';
import { normalizeRequiredCity } from '@/lib/profile-validation';

export interface CanonicalCity {
  cityId: string;
  cityName: string;
  citySlug: string;
}

export const resolveCanonicalCity = async (value?: string | null): Promise<CanonicalCity | null> => {
  const normalizedCity = normalizeRequiredCity(value);
  if (!normalizedCity) return null;

  const { data: cityId, error: resolveError } = await (supabase.rpc as any)('resolve_city_id', {
    p_city: normalizedCity,
    p_city_slug: null,
  });

  if (resolveError) {
    throw resolveError;
  }

  if (!cityId) {
    return null;
  }

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id, name, slug')
    .eq('id', cityId)
    .single();

  if (cityError) {
    throw cityError;
  }

  if (!city) {
    return null;
  }

  return {
    cityId: city.id,
    cityName: city.name,
    citySlug: city.slug,
  };
};