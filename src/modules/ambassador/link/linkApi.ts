// The ambassador shared link's two server calls, plus the fixed city chip's read.
// The city is read from `cities` (RLS public read, active or not) -- never through
// search_cities, which filters is_active and would hide an inactive city like Bristol.
import { supabase } from '@/integrations/supabase/client';
import { parseJoin, parseLookup, type JoinResult, type LinkLookup } from './linkLandingModel';

export const linkLookupKey = (code: string) => ['ambassador-link-public', code] as const;
export const linkCityKey = (slug: string) => ['ambassador-link-city', slug] as const;

export async function fetchLinkLookup(code: string): Promise<LinkLookup> {
  const { data, error } = await supabase.rpc('get_ambassador_link_public_v1', { p_code: code });
  if (error) throw error;
  return parseLookup(data);
}

export async function recordLinkJoin(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('record_ambassador_link_join_v1', { p_code: code });
  if (error) throw error;
  return parseJoin(data);
}

/** The chip's city row, by its slug from the link. null when it cannot be read (the RPC's name is used). */
export async function fetchLinkCity(slug: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from('cities').select('id, name').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string };
}
