import { supabase } from '@/integrations/supabase/client';

export interface PublicVenue {
  id: string;
  entity_id: string | null;
  name: string;
  address: string | null;
  postcode: string | null;
  country: string | null;
  timezone: string | null;
  image_url: string[] | null;
  gallery_urls: string[] | null;
  description: string | null;
  capacity: number | null;
  floor_type: string | null;
  facilities: Record<string, unknown> | null;
  facilities_new: string[] | null;
  opening_hours: Record<string, unknown> | null;
  google_maps_url: string | null;
  google_maps_link: string | null;
  google_maps_href: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  transport: string | null;
  transport_json: Record<string, unknown> | null;
  parking: string | null;
  parking_json: Record<string, unknown> | null;
  faq_json: unknown[] | null;
  bar_available: boolean | null;
  cloakroom_available: boolean | null;
  id_required: boolean | null;
  accessibility: string | null;
  city_name?: string | null;
  rules?: string[] | null;
}

export async function fetchPublicVenue(venueId: string): Promise<PublicVenue | null> {
  const { data, error } = await supabase.rpc('get_public_venue_by_venues_id', {
    p_venue_id: venueId,
  });

  if (error || !data) return null;

  return data as PublicVenue;
}

export interface PublicVenueListItem {
  id: string;
  name: string;
  cover_image: string | null;
  city_name: string | null;
  capacity: number | null;
  floor_type: string | null;
  description: string | null;
  bar_available: boolean;
  cloakroom_available: boolean;
  has_parking: boolean;
  facilities_new: string[];
}

export async function fetchPublicVenuesList(): Promise<PublicVenueListItem[]> {
  const { data, error } = await supabase.rpc('get_public_venues_list_v1' as never);
  if (error || !data) return [];
  return data as PublicVenueListItem[];
}
