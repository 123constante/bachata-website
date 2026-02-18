-- Phase 9: City rollout hardening
-- 1) Audit unresolved legacy city mappings
-- 2) Add city_id-first calendar RPC overload with legacy fallback

CREATE OR REPLACE VIEW public.v_city_unresolved_rows AS
SELECT
  'events'::text AS table_name,
  e.id AS row_id,
  NULL::text AS city_text,
  e.city_slug AS city_slug,
  public.resolve_city_id(NULL, e.city_slug) AS resolved_city_id,
  e.city_id AS current_city_id
FROM public.events e
WHERE (e.city_id IS NULL OR e.city_id <> public.resolve_city_id(NULL, e.city_slug))
  AND e.city_slug IS NOT NULL
  AND trim(e.city_slug) <> ''

UNION ALL

SELECT
  'venues'::text AS table_name,
  v.id AS row_id,
  v.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(v.city, NULL) AS resolved_city_id,
  v.city_id AS current_city_id
FROM public.venues v
WHERE (v.city_id IS NULL OR v.city_id <> public.resolve_city_id(v.city, NULL))
  AND v.city IS NOT NULL
  AND trim(v.city) <> ''

UNION ALL

SELECT
  'entities'::text AS table_name,
  e.id AS row_id,
  e.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(e.city, NULL) AS resolved_city_id,
  e.city_id AS current_city_id
FROM public.entities e
WHERE (e.city_id IS NULL OR e.city_id <> public.resolve_city_id(e.city, NULL))
  AND e.city IS NOT NULL
  AND trim(e.city) <> ''

UNION ALL

SELECT
  'organisers'::text AS table_name,
  o.id AS row_id,
  o.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(o.city, NULL) AS resolved_city_id,
  o.city_id AS current_city_id
FROM public.organisers o
WHERE (o.city_id IS NULL OR o.city_id <> public.resolve_city_id(o.city, NULL))
  AND o.city IS NOT NULL
  AND trim(o.city) <> ''

UNION ALL

SELECT
  'teacher_profiles'::text AS table_name,
  t.id AS row_id,
  t.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(t.city, NULL) AS resolved_city_id,
  t.city_id AS current_city_id
FROM public.teacher_profiles t
WHERE (t.city_id IS NULL OR t.city_id <> public.resolve_city_id(t.city, NULL))
  AND t.city IS NOT NULL
  AND trim(t.city) <> ''

UNION ALL

SELECT
  'dj_profiles'::text AS table_name,
  d.id AS row_id,
  d.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(d.city, NULL) AS resolved_city_id,
  d.city_id AS current_city_id
FROM public.dj_profiles d
WHERE (d.city_id IS NULL OR d.city_id <> public.resolve_city_id(d.city, NULL))
  AND d.city IS NOT NULL
  AND trim(d.city) <> ''

UNION ALL

SELECT
  'dancers'::text AS table_name,
  d.id AS row_id,
  d.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(d.city, NULL) AS resolved_city_id,
  d.city_id AS current_city_id
FROM public.dancers d
WHERE (d.city_id IS NULL OR d.city_id <> public.resolve_city_id(d.city, NULL))
  AND d.city IS NOT NULL
  AND trim(d.city) <> ''

UNION ALL

SELECT
  'vendors'::text AS table_name,
  v.id AS row_id,
  v.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(v.city, NULL) AS resolved_city_id,
  v.city_id AS current_city_id
FROM public.vendors v
WHERE (v.city_id IS NULL OR v.city_id <> public.resolve_city_id(v.city, NULL))
  AND v.city IS NOT NULL
  AND trim(v.city) <> ''

UNION ALL

SELECT
  'videographers'::text AS table_name,
  v.id AS row_id,
  v.city AS city_text,
  NULL::text AS city_slug,
  public.resolve_city_id(v.city, NULL) AS resolved_city_id,
  v.city_id AS current_city_id
FROM public.videographers v
WHERE (v.city_id IS NULL OR v.city_id <> public.resolve_city_id(v.city, NULL))
  AND v.city IS NOT NULL
  AND trim(v.city) <> '';

CREATE OR REPLACE VIEW public.v_city_unresolved_summary AS
SELECT
  table_name,
  count(*) AS total_rows,
  count(*) FILTER (WHERE resolved_city_id IS NULL) AS unresolved_rows,
  count(*) FILTER (WHERE resolved_city_id IS NOT NULL) AS backfillable_rows
FROM public.v_city_unresolved_rows
GROUP BY table_name
ORDER BY table_name;

GRANT SELECT ON public.v_city_unresolved_rows TO authenticated;
GRANT SELECT ON public.v_city_unresolved_summary TO authenticated;
GRANT SELECT ON public.v_city_unresolved_rows TO service_role;
GRANT SELECT ON public.v_city_unresolved_summary TO service_role;

DROP FUNCTION IF EXISTS public.get_calendar_events(text, text, text);

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  range_start text,
  range_end text,
  city_slug_param text DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  name text,
  photo_url text[],
  location text,
  instance_date text,
  start_time text,
  end_time text,
  is_recurring boolean,
  meta_data jsonb,
  key_times jsonb,
  type text,
  has_party boolean,
  has_class boolean,
  class_start text,
  class_end text,
  party_start text,
  party_end text,
  city_slug text,
  cover_image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH city_filter AS (
    SELECT
      CASE
        WHEN city_slug_param IS NULL OR trim(city_slug_param) = '' THEN NULL::uuid
        ELSE public.resolve_city_id(NULL, city_slug_param)
      END AS target_city_id,
      CASE
        WHEN city_slug_param IS NULL OR trim(city_slug_param) = '' THEN NULL::text
        ELSE lower(trim(city_slug_param))
      END AS target_slug
  )
  SELECT
    e.id AS event_id,
    e.name,
    CASE
      WHEN e.photo_url IS NULL THEN ARRAY[]::text[]
      ELSE ARRAY[e.photo_url::text]
    END AS photo_url,
    e.location,
    instance_value AS instance_date,
    e.start_time,
    e.end_time,
    (e.instances IS NOT NULL AND jsonb_array_length(e.instances) > 1) AS is_recurring,
    COALESCE(e.meta_data, '{}'::jsonb) AS meta_data,
    k.safe_key_times AS key_times,
    e.type,
    COALESCE(
      (k.safe_key_times #>> '{party,active}')::boolean,
      (
        (k.safe_key_times #>> '{party,start}') IS NOT NULL
        AND (k.safe_key_times #>> '{party,end}') IS NOT NULL
      ),
      false
    ) AS has_party,
    COALESCE(
      (k.safe_key_times #>> '{classes,active}')::boolean,
      (
        (k.safe_key_times #>> '{classes,start}') IS NOT NULL
        AND (k.safe_key_times #>> '{classes,end}') IS NOT NULL
      ),
      false
    ) AS has_class,
    (k.safe_key_times #>> '{classes,start}') AS class_start,
    (k.safe_key_times #>> '{classes,end}') AS class_end,
    (k.safe_key_times #>> '{party,start}') AS party_start,
    (k.safe_key_times #>> '{party,end}') AS party_end,
    e.city_slug,
    e.cover_image_url
  FROM public.events e
  CROSS JOIN city_filter cf
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN e.instances IS NULL OR jsonb_array_length(e.instances) = 0 THEN jsonb_build_array(e.start_time)
      ELSE e.instances
    END
  ) AS instance_value
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN e.key_times IS NULL OR trim(e.key_times) = '' OR e.key_times = 'null' THEN '{}'::jsonb
      ELSE e.key_times::jsonb
    END AS safe_key_times
  ) k
  WHERE
    e.is_active = true
    AND instance_value >= range_start
    AND instance_value <= range_end
    AND (
      cf.target_slug IS NULL
      OR (cf.target_city_id IS NOT NULL AND e.city_id = cf.target_city_id)
      OR lower(COALESCE(e.city_slug, '')) = cf.target_slug
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO service_role;
