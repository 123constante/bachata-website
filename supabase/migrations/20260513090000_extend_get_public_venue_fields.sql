-- Extend get_public_venue_by_venues_id to expose all admin-saved venue fields
-- on the public venue page.
--
-- Adds: facebook, water_situation, food_situation, late_night_notes,
-- last_entry_time. Pre-existing fields (gallery_urls, video_urls, rules,
-- parking_cost_notes, etc.) are preserved.
--
-- Applied to remote DB on 2026-05-08.

CREATE OR REPLACE FUNCTION public.get_public_venue_by_venues_id(p_venue_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $$
  SELECT json_build_object(
    'id',                 v.id,
    'entity_id',          v.entity_id,
    'name',               v.name,
    'address',            v.address,
    'postcode',           v.postcode,
    'country',            v.country,
    'timezone',           v.timezone,
    'image_url',          v.photo_url,
    'gallery_urls',       v.gallery_urls,
    'video_urls',         v.video_urls,
    'description',        v.description,
    'capacity',           v.capacity,
    'floor_type',         CASE
                            WHEN v.floor_type IS NULL THEN NULL
                            WHEN v.floor_type::text LIKE '[%' THEN (v.floor_type::jsonb)->>0
                            ELSE v.floor_type::text
                          END,
    'facilities',         v.facilities,
    'facilities_new',     v.facilities_new,
    'opening_hours',      v.opening_hours,
    'google_maps_url',    v.google_maps_url,
    'google_maps_link',   v.google_maps_link,
    'google_maps_href',   COALESCE(v.google_maps_link, v.google_maps_url),
    'website',            v.website,
    'instagram',          v.instagram,
    'facebook',           v.facebook,
    'phone',              v.phone,
    'email',              v.email,
    'transport',          v.transport,
    'transport_json',     v.transport_json,
    'parking',            v.parking,
    'parking_json',       v.parking_json,
    'parking_cost_notes', v.parking_cost_notes,
    'water_situation',    v.water_situation,
    'food_situation',     v.food_situation,
    'late_night_notes',   v.late_night_notes,
    'last_entry_time',    v.last_entry_time,
    'faq_json',           v.faq_json,
    'bar_available',      v.bar_available,
    'cloakroom_available',v.cloakroom_available,
    'id_required',        v.id_required,
    'accessibility',      v.accessibility,
    'city_id',            c.id,
    'city_name',          c.name,
    'rules',              v.rules
  )
  FROM public.venues v
  LEFT JOIN public.entities e ON e.id = v.entity_id
  LEFT JOIN public.cities   c ON c.id = e.city_id
  WHERE v.id = p_venue_id;
$$;

NOTIFY pgrst, 'reload schema';
