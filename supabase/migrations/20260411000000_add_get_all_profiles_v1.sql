-- Unified RPC: return every profile (dancer, teacher, DJ, vendor, videographer,
-- organiser) in a single normalised result set so the front-end can render a
-- combined directory without knowing about individual tables.
--
-- Columns are intentionally broad and nullable – each role supplies what it can.
-- The function is read-only (STABLE) and runs as the invoker, so existing RLS
-- policies on each underlying table still apply.

CREATE OR REPLACE FUNCTION public.get_all_profiles_v1()
RETURNS TABLE (
  profile_id        uuid,
  role              text,
  display_name      text,
  photo_url         text,
  city_id           uuid,
  city_name         text,
  country_code      text,
  specialties       text[],
  bio               text,
  nationality       text,
  instagram         text,
  website           text,
  is_verified       boolean,
  is_active         boolean,
  person_entity_id  uuid
)
LANGUAGE sql
STABLE
AS $$
  ------------------------------------------------------------------ dancers
  SELECT
    dp.id,
    'dancer'::text,
    TRIM(COALESCE(dp.first_name, '') || ' ' || COALESCE(dp.surname, '')),
    dp.avatar_url,
    dp.based_city_id,
    c.name,
    NULL::text,                       -- no country_code on dancer_profiles
    dp.favorite_styles,
    NULL::text,                       -- dancers have no bio column
    dp.nationality,
    dp.instagram,
    dp.website,
    false,
    COALESCE(dp.is_active, true),
    dp.person_entity_id
  FROM dancer_profiles dp
  LEFT JOIN cities c ON c.id = dp.based_city_id

  UNION ALL

  ------------------------------------------------------------------ teachers
  SELECT
    tp.id,
    'teacher'::text,
    TRIM(
      COALESCE(tp.first_name, '')
      || CASE
           WHEN tp.hide_surname IS NOT TRUE AND tp.surname IS NOT NULL
           THEN ' ' || tp.surname
           ELSE ''
         END
    ),
    tp.photo_url,
    tp.city_id,
    c.name,
    tp.country_code,
    COALESCE(tp.teaching_styles, '{}'),
    tp.journey,                       -- "journey" serves as bio for teachers
    tp.nationality,
    tp.instagram,
    tp.website,
    false,                            -- no verified column
    COALESCE(tp.is_active, true),
    tp.person_entity_id
  FROM teacher_profiles tp
  LEFT JOIN cities c ON c.id = tp.city_id

  UNION ALL

  ------------------------------------------------------------------ DJs
  SELECT
    dj.id,
    'dj'::text,
    COALESCE(
      NULLIF(dj.dj_name, ''),
      TRIM(COALESCE(dj.first_name, '') || ' ' || COALESCE(dj.surname, ''))
    ),
    dj.photo_url,
    dj.city_id,
    COALESCE(c.name, dj.city),
    dj.country_code,
    COALESCE(dj.genres, '{}'),
    dj.bio,
    dj.nationality,
    dj.instagram,
    dj.website,
    COALESCE(dj.verified, false),
    COALESCE(dj.is_active, true),
    dj.person_entity_id
  FROM dj_profiles dj
  LEFT JOIN cities c ON c.id = dj.city_id

  UNION ALL

  ------------------------------------------------------------------ vendors
  SELECT
    v.id,
    'vendor'::text,
    COALESCE(
      NULLIF(v.business_name, ''),
      TRIM(COALESCE(v.first_name, '') || ' ' || COALESCE(v.surname, ''))
    ),
    v.photo_url,
    v.city_id,
    COALESCE(c.name, v.city),
    v.country_code,
    COALESCE(v.product_categories, '{}'),
    v.short_description,
    NULL::text,                       -- no nationality on vendors
    v.instagram,
    v.website,
    COALESCE(v.verified, false),
    COALESCE(v.is_active, true),
    v.person_entity_id
  FROM vendors v
  LEFT JOIN cities c ON c.id = v.city_id

  UNION ALL

  ------------------------------------------------------------------ videographers
  SELECT
    vg.id,
    'videographer'::text,
    COALESCE(
      NULLIF(vg.business_name, ''),
      TRIM(COALESCE(vg.first_name, '') || ' ' || COALESCE(vg.surname, ''))
    ),
    vg.photo_url,
    vg.city_id,
    COALESCE(c.name, vg.city),
    vg.country_code,
    COALESCE(vg.videography_styles, '{}'),
    COALESCE(vg.bio, vg.short_description),
    vg.nationality,
    vg.instagram,
    vg.website,
    COALESCE(vg.verified, false),
    COALESCE(vg.is_active, true),
    vg.person_entity_id
  FROM videographers vg
  LEFT JOIN cities c ON c.id = vg.city_id

  UNION ALL

  ------------------------------------------------------------------ organisers
  SELECT
    e.id,
    'organiser'::text,
    e.name,
    e.avatar_url,
    e.city_id,
    c.name,
    NULL::text,                       -- no country_code on entities
    CASE
      WHEN e.organisation_category IS NOT NULL
      THEN ARRAY[e.organisation_category]
      ELSE '{}'::text[]
    END,
    e.bio,
    NULL::text,                       -- no nationality on entities
    e.instagram,
    e.website,
    false,
    COALESCE(e.is_active, true),
    NULL::uuid                        -- entities are not person_entity linked
  FROM entities e
  LEFT JOIN cities c ON c.id = e.city_id
  WHERE e.type = 'organiser';
$$;

-- Allow both anonymous and authenticated callers to use this function
-- (mirrors the existing public-read policies on the underlying profile tables).
GRANT EXECUTE ON FUNCTION public.get_all_profiles_v1() TO anon, authenticated;
