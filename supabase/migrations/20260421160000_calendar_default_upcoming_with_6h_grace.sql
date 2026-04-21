-- supabase/migrations/20260421160000_calendar_default_upcoming_with_6h_grace.sql
-- =============================================================================
-- get_calendar_events: default to upcoming-only with 6h grace window
-- =============================================================================
--
-- Applied to production via Supabase SQL editor on 2026-04-21. This file
-- captures the updated function definition for version control. The session
-- that authored the live update is the Apr 21 chat — source of truth for the
-- behavioural intent below.
--
-- Changes vs. 20260418121000_rework_calendar_events_for_tz_aware_overlap.sql:
--   1. p_include_past default flipped from true → false. Public-calendar,
--      homepage, and city-page callers now get upcoming-only by default with
--      no client change; callers that need historical occurrences (admin
--      views, the live-organiser-roundtrip proof script) must opt in
--      explicitly with p_include_past := true.
--   2. Past-exclusion filter changed from
--          co.instance_end > now()
--      to
--          co.instance_end > now() - interval '6 hours'
--      so an event that ended within the last 6 hours still appears on the
--      "today" view. Absorbs timezone/clock-skew edge cases at the minute
--      boundary and covers the "I'm still at the event" lookup window.
--
-- Everything else (return shape, city/timezone join, half-open overlap
-- predicate, SECURITY DEFINER, search_path, grants) is byte-for-byte
-- preserved from the Apr 18 rework.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_calendar_events(range_start text, range_end text, city_slug_param text DEFAULT NULL::text, p_include_past boolean DEFAULT false)
 RETURNS TABLE(event_id uuid, name text, photo_url text[], location text, instance_date text, start_time text, end_time text, is_recurring boolean, meta_data jsonb, key_times jsonb, type text, has_party boolean, has_class boolean, class_start text, class_end text, party_start text, party_end text, city_slug text, cover_image_url text, occurrence_id uuid, occurrence_starts_at timestamp with time zone, occurrence_ends_at timestamp with time zone, city_timezone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
      WHEN e.poster_url IS NULL THEN ARRAY[]::text[]
      ELSE ARRAY[e.poster_url::text]
    END AS photo_url,
    e.location,
    ((co.instance_start AT TIME ZONE COALESCE(c.timezone, 'UTC'))::date)::text
      AS instance_date,
    co.instance_start::text AS start_time,
    co.instance_end::text   AS end_time,
    (count(*) OVER (PARTITION BY e.id) > 1) AS is_recurring,
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
    COALESCE(co.city_slug, e.city_slug)      AS city_slug,
    e.poster_url                             AS cover_image_url,
    co.id                                    AS occurrence_id,
    co.instance_start                        AS occurrence_starts_at,
    co.instance_end                          AS occurrence_ends_at,
    COALESCE(c.timezone, 'UTC')              AS city_timezone
  FROM public.calendar_occurrences co
  JOIN public.events e ON e.id = co.event_id
  LEFT JOIN public.cities c
    ON c.id = COALESCE(co.city_id, e.city_id)
  CROSS JOIN city_filter cf
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN e.key_times IS NULL        THEN '{}'::jsonb
      WHEN e.key_times::text = 'null' THEN '{}'::jsonb
      ELSE e.key_times::jsonb
    END AS safe_key_times
  ) k
  WHERE
    e.is_active = true
    AND co.lifecycle_status IS DISTINCT FROM 'cancelled'
    AND co.instance_start < range_end::timestamptz
    AND co.instance_end   > range_start::timestamptz
    AND (p_include_past OR co.instance_end > now() - interval '6 hours')
    AND (
      cf.target_slug IS NULL
      OR (cf.target_city_id IS NOT NULL AND e.city_id = cf.target_city_id)
      OR lower(COALESCE(e.city_slug, '')) = cf.target_slug
    );
$$
;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
