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

  const isLikelyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedCity);

  if (isLikelyUuid) {
    const { data: cityById, error: cityByIdError } = await supabase
      .from('cities')
      .select('id, name, slug')
      .eq('id', normalizedCity)
      .maybeSingle();

    if (cityByIdError) {
      throw cityByIdError;
    }

    if (cityById) {
      return {
        cityId: cityById.id,
        cityName: cityById.name,
        citySlug: cityById.slug,
      };
    }
  }

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