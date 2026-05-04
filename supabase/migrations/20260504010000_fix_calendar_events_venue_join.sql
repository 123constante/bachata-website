-- =============================================================================
-- Migration: Fix get_calendar_events venue name resolution
-- Date: 2026-05-04
--
-- Problem: Migration 20260427120000 removed the LEFT JOIN to venues table,
--          causing get_calendar_events to return e.location instead of the
--          proper venue name (v.name) from the venues table. This breaks
--          display when e.location is NULL or stale.
--
-- Solution: Restore the LEFT JOIN to venues and use COALESCE to prioritize:
--   1. v.name (venue display name from venues table)
--   2. e.location (event explicit location text fallback)
--   3. v.address (venue address fallback)
--   4. '' (empty string default)
--
-- Production hardening:
--   - Ignore blank strings via NULLIF(trim(...), '') for all location sources.
--   - Keep city filtering occurrence-aware (co.city_id/co.city_slug fallback to event).
--
-- This restores the contract from 20260405200000_remote_schema_baseline.sql
-- while preserving the override_payload-aware logic from 20260427120000.
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
      WHEN eff.effective_poster_url IS NULL THEN ARRAY[]::text[]
      ELSE ARRAY[eff.effective_poster_url::text]
    END AS photo_url,
    COALESCE(
      NULLIF(trim(v.name), ''),
      NULLIF(trim(e.location), ''),
      NULLIF(trim(v.address), ''),
      ''
    )::text AS location,
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
    eff.effective_poster_url                 AS cover_image_url,
    co.id                                    AS occurrence_id,
    co.instance_start                        AS occurrence_starts_at,
    co.instance_end                          AS occurrence_ends_at,
    COALESCE(c.timezone, 'UTC')              AS city_timezone
  FROM public.calendar_occurrences co
  JOIN public.events e ON e.id = co.event_id
  LEFT JOIN public.venues v ON v.id = COALESCE(co.venue_id, e.venue_id)
  LEFT JOIN public.cities c
    ON c.id = COALESCE(co.city_id, e.city_id)
  CROSS JOIN city_filter cf
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(NULLIF(co.override_payload->>'poster_url', ''), e.poster_url)
        AS effective_poster_url,
      CASE
        WHEN co.override_payload ? 'key_times' THEN co.override_payload->'key_times'
        ELSE e.key_times
      END AS effective_key_times
  ) eff
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN eff.effective_key_times IS NULL        THEN '{}'::jsonb
      WHEN eff.effective_key_times::text = 'null' THEN '{}'::jsonb
      ELSE eff.effective_key_times::jsonb
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
      OR (cf.target_city_id IS NOT NULL AND COALESCE(co.city_id, e.city_id) = cf.target_city_id)
      OR lower(COALESCE(co.city_slug, e.city_slug, '')) = cf.target_slug
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(text, text, text, boolean) TO service_role;

COMMIT;
