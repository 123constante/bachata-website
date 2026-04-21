-- Migration: backfill calendar_occurrences.instance_end for historical
--            pre-Apr-20 rows, and fix 50/50's stale events.end_time.
--
-- Fixes two bug shapes in calendar_occurrences (both historical):
--   1. Zero-duration rows: instance_end = instance_start
--   2. Series-end rows:    instance_end = events.end_time at save time
--
-- Both are legacy from pre-commit-95f99fb client logic. New saves write
-- correct per-occurrence instance_end. This migration repairs the ~478
-- stale rows that were never re-materialized.
--
-- Also fixes event 50/50 (a722aed1-41eb-45a5-b738-3fa6fa428fa0) whose
-- events.end_time slipped through the 2026-04-20 backfill. Derived
-- duration from its key_times (19:00 -> 02:00 next day = 7h overnight).

BEGIN;

-- Step 1: Fix 50/50's event row end_time.
UPDATE public.events
SET end_time = start_time + interval '7 hours',
    updated_at = now()
WHERE id = 'a722aed1-41eb-45a5-b738-3fa6fa428fa0'
  AND end_time - start_time > interval '24 hours';

-- Step 2: Show pre-backfill counts so we can sanity-check.
DO $$
DECLARE
  v_zero int;
  v_series int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE co.instance_end = co.instance_start),
    COUNT(*) FILTER (WHERE co.instance_end > co.instance_start + interval '12 hours')
  INTO v_zero, v_series
  FROM public.calendar_occurrences co
  JOIN public.events e ON e.id = co.event_id
  WHERE e.type = 'standard'
    AND e.meta_data ? 'recurrence'
    AND e.start_time IS NOT NULL
    AND e.end_time IS NOT NULL
    AND e.end_time > e.start_time
    AND e.end_time - e.start_time < interval '24 hours';
  RAISE NOTICE 'Pre-backfill: % zero-duration rows, % series-end rows', v_zero, v_series;
END $$;

-- Step 3: Backfill occurrences.
UPDATE public.calendar_occurrences co
SET instance_end = co.instance_start + (e.end_time - e.start_time),
    updated_at   = now()
FROM public.events e
WHERE co.event_id = e.id
  AND e.type = 'standard'
  AND e.meta_data ? 'recurrence'
  AND e.start_time IS NOT NULL
  AND e.end_time   IS NOT NULL
  AND e.end_time > e.start_time
  AND e.end_time - e.start_time < interval '24 hours'
  AND (
    co.instance_end = co.instance_start
    OR co.instance_end > co.instance_start + interval '12 hours'
  );

-- Step 4: Show post-backfill counts.
DO $$
DECLARE
  v_zero int;
  v_series int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE co.instance_end = co.instance_start),
    COUNT(*) FILTER (WHERE co.instance_end > co.instance_start + interval '12 hours')
  INTO v_zero, v_series
  FROM public.calendar_occurrences co
  JOIN public.events e ON e.id = co.event_id
  WHERE e.type = 'standard'
    AND e.meta_data ? 'recurrence'
    AND e.start_time IS NOT NULL
    AND e.end_time IS NOT NULL
    AND e.end_time > e.start_time
    AND e.end_time - e.start_time < interval '24 hours';
  RAISE NOTICE 'Post-backfill: % zero-duration rows, % series-end rows', v_zero, v_series;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
