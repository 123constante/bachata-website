-- Migration: Add get_public_venues_list_v1 public RPC
-- Date: 2026-04-20 (UTC)
--
-- Returns a SETOF jsonb — one row per venue — shaped for the public
-- /venues list page. Mirrors the JOIN pattern of
-- get_public_venue_by_venues_id (venues → entities → cities) so the
-- resolved city_name is available in a single call.
--
-- No soft-delete filter: the venues table has no archived_at,
-- is_active, is_published, or lifecycle_status column. All rows are
-- returned; sorted by name ASC.
--
-- floor_type is normalized identically to the detail RPC: values
-- stored as JSON-array text like '["hardwood"]' are unwrapped to
-- 'hardwood'.
--
-- Amenity flags returned:
--   bar_available       (raw column, COALESCEd to false)
--   cloakroom_available (raw column, COALESCEd to false)
--   has_parking         computed — parking text OR parking_json present
--   facilities_new      raw text[] passthrough (empty array if null) —
--                       callers iterate this for additional amenity
--                       pills (e.g. outdoor space). No dedicated
--                       has_outdoor_space field: it would duplicate
--                       the facilities_new data.

BEGIN;

DROP FUNCTION IF EXISTS public.get_public_venues_list_v1();

CREATE FUNCTION public.get_public_venues_list_v1()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'id',                  v.id,
    'name',                v.name,
    'cover_image',         CASE
                             WHEN v.photo_url IS NULL OR array_length(v.photo_url, 1) IS NULL
                               THEN NULL
                             ELSE v.photo_url[1]
                           END,
    'city_name',           c.name,
    'capacity',            v.capacity,
    'floor_type',          CASE
                             WHEN v.floor_type IS NULL THEN NULL
                             WHEN v.floor_type::text LIKE '[%' THEN (v.floor_type::jsonb)->>0
                             ELSE v.floor_type::text
                           END,
    'description',         v.description,
    'bar_available',       COALESCE(v.bar_available, false),
    'cloakroom_available', COALESCE(v.cloakroom_available, false),
    'has_parking',         (v.parking IS NOT NULL AND length(trim(v.parking)) > 0)
                           OR (v.parking_json IS NOT NULL AND v.parking_json <> '{}'::jsonb),
    'facilities_new',      COALESCE(v.facilities_new, ARRAY[]::text[])
  )
  FROM public.venues v
  LEFT JOIN public.entities e ON e.id = v.entity_id
  LEFT JOIN public.cities   c ON c.id = e.city_id
  ORDER BY v.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_venues_list_v1() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_venues_list_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_venues_list_v1() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
