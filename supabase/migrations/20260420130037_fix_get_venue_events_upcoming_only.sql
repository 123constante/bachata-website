-- Migration: fix get_venue_events to return UPCOMING events only
-- Date: 2026-04-20 (UTC)
--
-- Changes vs previous definition (20260405200000_remote_schema_baseline.sql):
--   - WHERE: add `e.date >= CURRENT_DATE` (exclude past events)
--   - ORDER BY: `e.date ASC` (soonest first) instead of DESC
--   - RETURNS: drop `is_published` (was misleadingly `e.is_active`) and
--     drop `location` (redundant — always this venue's address).
--     Add `key_times jsonb` and `poster_url text`.
--   - Remove the now-unused LEFT JOIN on public.venues.
--   - Keep: city_slug filter, LIMIT 10, LANGUAGE plpgsql STABLE, and all
--     existing GRANTs (anon, authenticated, service_role).
--
-- Note on mechanism: CREATE OR REPLACE FUNCTION cannot change a function's
-- RETURNS TABLE shape, so we DROP and re-create. GRANTs are re-applied
-- explicitly below to match the prior state exactly.

BEGIN;

DROP FUNCTION IF EXISTS public.get_venue_events(uuid, text);

CREATE FUNCTION public.get_venue_events(
  p_venue_id uuid,
  p_city_slug text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  date date,
  key_times jsonb,
  poster_url text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_city_id uuid := NULL;
  v_city_slug_norm text := NULL;
BEGIN
  v_city_slug_norm := NULLIF(btrim(COALESCE(p_city_slug, '')), '');

  IF v_city_slug_norm IS NOT NULL THEN
    v_city_id := public.resolve_city_id(NULL, v_city_slug_norm);
    IF v_city_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.date,
    e.key_times,
    e.poster_url
  FROM public.events e
  WHERE e.venue_id = p_venue_id
    AND e.is_active = true
    AND e.date >= CURRENT_DATE
    AND (
      v_city_slug_norm IS NULL
      OR e.city_id = v_city_id
    )
  ORDER BY e.date ASC
  LIMIT 10;
END;
$$;

ALTER FUNCTION public.get_venue_events(uuid, text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_venue_events(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_venue_events(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_events(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
