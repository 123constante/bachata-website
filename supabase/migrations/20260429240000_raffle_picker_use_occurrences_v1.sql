-- =============================================================================
-- Raffle picker — anchor on calendar_occurrences.instance_start (v1)
--
-- Bug: admin_list_raffle_picker_events_v1 filtered upcoming events on
-- `e.start_time >= now() - interval '6 hours'`. For recurring weekly events
-- the anchor `start_time` is the series origin (often weeks/months in the
-- past) while the next live occurrence is in calendar_occurrences. Result:
-- ~14 recurring weekly events were silently missing from the admin /raffles
-- picker UI even when their next instance was tomorrow.
--
-- Fix: COALESCE(next_occurrence, e.start_time) drives both the WHERE filter
-- and the displayed start_at value, matching the pattern already used by
-- get_event_raffle and the website's public read paths.
--
-- Reversible: re-replay the prior body from
-- 20260429220000_raffle_cutoff_unify_v1.sql.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_list_raffle_picker_events_v1(
  p_days_ahead integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_days   int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_days := GREATEST(0, LEAST(COALESCE(p_days_ahead, 30), 365));

  WITH src AS (
    SELECT
      e.id, e.name, e.timezone, e.series_key, e.has_raffle,
      e.meta_data, e.raffle_preset_id,
      -- Effective start: next occurrence if available, else the event anchor.
      -- Recurring events store a series anchor in events.start_time that may
      -- be far in the past; the next live instance lives in
      -- calendar_occurrences.instance_start.
      COALESCE(occ.next_start, e.start_time) AS effective_start,
      rp.id AS preset_id, rp.name AS preset_name,
      rp.slug AS preset_slug, rp.prize_text AS preset_prize_text,
      rp.cutoff_offset_minutes AS preset_cutoff_mins,
      CASE
        WHEN rp.id IS NOT NULL THEN 'preset'
        WHEN e.meta_data ? 'raffle'
         AND e.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
         AND e.meta_data->'raffle' IS DISTINCT FROM '{}'::jsonb THEN 'custom'
        ELSE 'none'
      END AS config_source,
      CASE
        WHEN rp.id IS NOT NULL THEN COALESCE(rp.cutoff_offset_minutes, 120)
        WHEN e.meta_data ? 'raffle'
         AND e.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
         AND e.meta_data->'raffle' IS DISTINCT FROM '{}'::jsonb THEN
          COALESCE(NULLIF(e.meta_data->'raffle'->>'cutoff_offset_minutes', '')::int, 120)
        ELSE NULL
      END AS effective_offset_mins
    FROM events e
    LEFT JOIN raffle_presets rp ON rp.id = e.raffle_preset_id
    LEFT JOIN LATERAL (
      SELECT MIN(co.instance_start) AS next_start
        FROM calendar_occurrences co
       WHERE co.event_id = e.id
         AND co.instance_start >= now() - interval '6 hours'
    ) occ ON TRUE
    WHERE e.lifecycle_status = 'published'
      -- Effective start filter: include events whose NEXT occurrence is
      -- within window, even if their anchor start_time is in the past.
      AND COALESCE(occ.next_start, e.start_time) IS NOT NULL
      AND COALESCE(occ.next_start, e.start_time) >= now() - interval '6 hours'
      AND COALESCE(occ.next_start, e.start_time) <= now() + (v_days || ' days')::interval
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',           src.id,
      'name',               src.name,
      'start_at',           src.effective_start,
      'timezone',           src.timezone,
      'series_key',         src.series_key,
      'has_raffle',         COALESCE(src.has_raffle, false),
      'raffle_preset_id',   src.preset_id,
      'raffle_preset_name', src.preset_name,
      'raffle_preset_slug', src.preset_slug,
      'config_source',      src.config_source,
      'prize_text',
        COALESCE(src.preset_prize_text, src.meta_data->'raffle'->>'prize_text'),
      'draw_date',
        CASE
          WHEN src.preset_id IS NOT NULL AND src.effective_start IS NOT NULL
            THEN to_char((src.effective_start AT TIME ZONE COALESCE(src.timezone, 'Europe/London'))::date, 'YYYY-MM-DD')
          ELSE src.meta_data->'raffle'->>'draw_date'
        END,
      'cutoff_offset_minutes', src.effective_offset_mins,
      'cutoff_at',
        CASE
          WHEN src.effective_start IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN src.effective_start - make_interval(mins => src.effective_offset_mins)
          ELSE NULL
        END,
      'cutoff_time',
        CASE
          WHEN src.effective_start IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN to_char(
                   (src.effective_start - make_interval(mins => src.effective_offset_mins))
                     AT TIME ZONE COALESCE(src.timezone, 'Europe/London'),
                   'HH24:MI'
                 )
          ELSE NULL
        END,
      'cutoff_passed',
        CASE
          WHEN src.effective_start IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN (now() >= (src.effective_start - make_interval(mins => src.effective_offset_mins)))
          ELSE false
        END,
      'active_entry_count', (
        SELECT COUNT(*)
          FROM event_raffle_entries ere
         WHERE ere.event_id = src.id
           AND ere.deleted_at IS NULL
           AND ere.ineligible_reason IS NULL
      ),
      'total_entry_count', (
        SELECT COUNT(*) FROM event_raffle_entries ere WHERE ere.event_id = src.id
      ),
      'current_winner_first_name', (
        SELECT winner.first_name
          FROM event_raffle_draws erd
          LEFT JOIN event_raffle_entries winner ON winner.id = erd.winner_entry_id
         WHERE erd.event_id = src.id AND erd.is_active = true LIMIT 1
      ),
      'current_draw_is_active', EXISTS (
        SELECT 1 FROM event_raffle_draws erd
         WHERE erd.event_id = src.id AND erd.is_active = true
      )
    ) ORDER BY src.effective_start ASC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM src;

  RETURN v_result;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
