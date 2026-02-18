-- Phase 9.1: Backfill unresolved entities.city_id using linked events
-- Runs before NOT NULL enforcement migration when legacy entities still have NULL city_id.

DO $$
DECLARE
  v_remaining bigint;
  v_examples text;
BEGIN
  -- 1) Best-effort from entities.city text first
  UPDATE public.entities e
  SET city_id = public.resolve_city_id(e.city, NULL)
  WHERE e.city_id IS NULL
    AND e.city IS NOT NULL
    AND trim(e.city) <> '';

  -- 2) Infer from linked events when there is exactly one inferred city for an entity
  WITH event_city_candidates AS (
    SELECT
      ee.entity_id,
      COALESCE(
        e.city_id,
        public.resolve_city_id(NULL, e.city_slug),
        public.resolve_city_id(e.city, NULL)
      ) AS inferred_city_id
    FROM public.event_entities ee
    JOIN public.events e ON e.id = ee.event_id
  )
  UPDATE public.entities target
  SET city_id = (
    SELECT ecc.inferred_city_id
    FROM event_city_candidates ecc
    WHERE ecc.entity_id = target.id
      AND ecc.inferred_city_id IS NOT NULL
    LIMIT 1
  )
  WHERE target.city_id IS NULL
    AND 1 = (
      SELECT count(DISTINCT ecc2.inferred_city_id)
      FROM event_city_candidates ecc2
      WHERE ecc2.entity_id = target.id
        AND ecc2.inferred_city_id IS NOT NULL
    );

  -- 3) Keep city text aligned where possible
  UPDATE public.entities e
  SET city = c.name
  FROM public.cities c
  WHERE e.city_id = c.id
    AND (e.city IS NULL OR trim(e.city) = '');

  -- 4) Report unresolved rows (don't silently ignore)
  SELECT count(*)
  INTO v_remaining
  FROM public.entities e
  WHERE e.city_id IS NULL;

  IF v_remaining > 0 THEN
    SELECT string_agg(id::text, ', ' ORDER BY id)
    INTO v_examples
    FROM (
      SELECT e.id
      FROM public.entities e
      WHERE e.city_id IS NULL
      ORDER BY e.id
      LIMIT 20
    ) q;

    RAISE EXCEPTION USING
      MESSAGE = format('Entities city backfill incomplete: %s rows still have NULL city_id', v_remaining),
      HINT = format('Set city/city_id for unresolved entity IDs, then rerun. Example IDs: %s', coalesce(v_examples, '[none]'));
  END IF;
END
$$;