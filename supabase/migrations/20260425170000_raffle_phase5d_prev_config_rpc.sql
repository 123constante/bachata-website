-- ============================================================================
-- Raffle Phase 5D — admin_get_prev_raffle_config_v1
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 17:00:00 so it orders
-- after Phase 5C (20260425160000).
--
-- Returns the most-recent past raffle config for a given series_key, so the
-- StandardPromotionsTab raffle block can offer a "Copy from last {event}"
-- button. Purely a lookup — doesn't write anything. Admin-only.
--
-- Contract:
--   input:
--     p_series_key  text — required, non-empty; empty or whitespace returns
--                          found=false
--     p_before_date date — optional; when set, only events strictly before
--                          this date are considered (to avoid copying "the
--                          future event in this series you just created").
--                          When NULL, any past event matches.
--
--   output jsonb envelope, one of:
--     { found: false }
--     { found: true,
--       from_event_id, from_event_name, from_event_date, from_event_timezone,
--       prize_text, draw_date, cutoff_time, show_winner_publicly }
--
-- The match requires has_raffle=true AND a non-empty prize_text so we never
-- propose copying an empty config. Ordered by start_time DESC — most recent
-- first.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_prev_raffle_config_v1(
  p_series_key text,
  p_before_date date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result    jsonb;
  v_normalized text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_normalized := btrim(COALESCE(p_series_key, ''));
  IF v_normalized = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found',                true,
    'from_event_id',        e.id,
    'from_event_name',      e.name,
    'from_event_date',      e.start_time,
    'from_event_timezone',  e.timezone,
    'prize_text',           e.meta_data->'raffle'->>'prize_text',
    'draw_date',            e.meta_data->'raffle'->>'draw_date',
    'cutoff_time',          e.meta_data->'raffle'->>'cutoff_time',
    'show_winner_publicly', COALESCE(
      NULLIF(e.meta_data->'raffle'->>'show_winner_publicly', '')::boolean,
      false
    )
  )
  INTO v_result
  FROM events e
  WHERE e.series_key = v_normalized
    AND e.has_raffle = true
    AND e.meta_data->'raffle'->>'prize_text' IS NOT NULL
    AND btrim(e.meta_data->'raffle'->>'prize_text') <> ''
    AND (p_before_date IS NULL OR e.start_time::date < p_before_date)
  ORDER BY e.start_time DESC NULLS LAST
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_prev_raffle_config_v1(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_prev_raffle_config_v1(text, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
