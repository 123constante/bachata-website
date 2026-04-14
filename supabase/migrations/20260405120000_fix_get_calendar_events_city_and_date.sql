-- Fix: two-part repair for get_calendar_events returning no events
--
-- Problem 1: Events with city_id populated but city_slug NULL are excluded
--   because some callers (e.g. fix_calendar_rpc_complete.sql applied manually)
--   only match on city_slug text equality.
--
-- Problem 2: Events whose instances array contains date-only strings like
--   "2026-04-05" are excluded when range_start is an ISO timestamp
--   "2026-04-05T00:00:00.000Z" because the text sort is "2026-04-05" <
--   "2026-04-05T..." — so events occurring on the very first day of the
--   requested range are silently dropped.
--
-- Fixes applied:
--   1. Backfill city_slug from the cities catalogue for events that have
--      city_id but a NULL/empty city_slug.
--   2. Re-create get_calendar_events with:
--        a) instance_value::date >= range_start::date  (date-safe comparison)
--        b) city filter: city_id UUID match OR city_slug text match so
--           events tagged only by UUID are included correctly.

-- ── 1. Backfill city_slug ────────────────────────────────────────────────────
UPDATE public.events e
SET    city_slug = c.slug
FROM   public.cities c
WHERE  e.city_id = c.id
  AND  (e.city_slug IS NULL OR trim(e.city_slug) = '');

-- ── 2. Drop legacy overloads, then re-create the canonical 3-arg function ────
DROP FUNCTION IF EXISTS public.get_calendar_events(text, text);
DROP FUNCTION IF EXISTS public.get_calendar_events(text, text, text);

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  range_start      text,
  range_end        text,
  city_slug_param  text DEFAULT NULL
)
RETURNS TABLE (
  event_id        uuid,
  name            text,
  photo_url       text[],
  location        text,
  instance_date   text,
  start_time      text,
  end_time        text,
  is_recurring    boolean,
  meta_data       jsonb,
  key_times       jsonb,
  type            text,
  has_party       boolean,
  has_class       boolean,
  class_start     text,
  class_end       text,
  party_start     text,
  party_end       text,
  city_slug       text,
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
    (k.safe_key_times #>> '{classes,end}')   AS class_end,
    (k.safe_key_times #>> '{party,start}')   AS party_start,
    (k.safe_key_times #>> '{party,end}')     AS party_end,
    e.city_slug,
    e.cover_image_url
  FROM public.events e
  CROSS JOIN city_filter cf
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN e.instances IS NULL OR jsonb_array_length(e.instances) = 0
        THEN jsonb_build_array(e.start_time)
      ELSE e.instances
    END
  ) AS instance_value
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN e.key_times IS NULL               THEN '{}'::jsonb
      WHEN e.key_times::text = 'null'        THEN '{}'::jsonb
      ELSE e.key_times::jsonb
    END AS safe_key_times
  ) k
  WHERE
    e.is_active = true
    -- date-safe: "2026-04-05" and "2026-04-05T20:00:00" both cast cleanly
    AND instance_value::date >= range_start::date
    AND instance_value::date <= range_end::date
    AND (
      -- no city filter requested
      cf.target_slug IS NULL
      -- match by city_id UUID (handles events with NULL city_slug)
      OR (cf.target_city_id IS NOT NULL AND e.city_id = cf.target_city_id)
      -- match by city_slug text (legacy path)
      OR lower(COALESCE(e.city_slug, '')) = cf.target_slug
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text) TO service_role;
