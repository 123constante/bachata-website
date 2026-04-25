-- =============================================================================
-- Phase 6D — Picker scope expansion + assign RPCs
--
-- Four new SECURITY DEFINER functions, all guarded by public.is_admin():
--
--   1. admin_list_raffle_picker_events_v1(p_days_ahead int DEFAULT 30)
--        → jsonb array of ALL upcoming events (published, in window).
--          Same shape as admin_list_raffle_events_v1 plus `has_raffle` and
--          `event_name_normalized`. Used by the new /raffles picker so admin
--          can assign raffles to events that don't have one yet.
--
--   2. admin_assign_raffle_preset_v1(p_event_id uuid, p_preset_id uuid|null)
--        → single-event assign. Sets events.raffle_preset_id and clears
--          meta_data.raffle (preset OR custom, mutually exclusive).
--          When p_preset_id is NULL, both are cleared (raffle disabled).
--
--   3. admin_bulk_assign_raffle_preset_v1(p_event_ids uuid[], p_preset_id uuid|null)
--        → bulk assign. Same semantics as single. Returns counts.
--
--   4. admin_list_series_upcoming_event_ids_v1(p_event_id uuid)
--        → series helper. Given an event_id, returns array of event IDs whose
--          name matches the target's, are published, and start at or after the
--          target's start_time. Used by the "Apply to this and upcoming" prompt.
--
-- Series match rule: by event NAME (Ricky's choice 2026-04-25). This is
-- intentionally looser than series_key (used for Phase 5 fairness). Two events
-- with the same display name are treated as the same series in the UI prompt
-- only — has no effect on fairness or draw logic.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. admin_list_raffle_picker_events_v1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_raffle_picker_events_v1(
  p_days_ahead int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_days   int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Clamp to a sane range. 0 = today only; cap at 365 days.
  v_days := GREATEST(0, LEAST(COALESCE(p_days_ahead, 30), 365));

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',   e.id,
      'name',       e.name,
      'start_at',   e.start_time,
      'timezone',   e.timezone,
      'series_key', e.series_key,
      'has_raffle', COALESCE(e.has_raffle, false),

      -- Preset metadata (null when config_source !== 'preset').
      'raffle_preset_id',   rp.id,
      'raffle_preset_name', rp.name,
      'raffle_preset_slug', rp.slug,
      'config_source', CASE
        WHEN rp.id IS NOT NULL THEN 'preset'
        WHEN e.meta_data ? 'raffle'
         AND e.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
         AND e.meta_data->'raffle' IS DISTINCT FROM '{}'::jsonb THEN 'custom'
        ELSE 'none'
      END,

      -- Effective values (preset > meta_data.raffle > null).
      'prize_text', COALESCE(rp.prize_text, e.meta_data->'raffle'->>'prize_text'),
      'draw_date', CASE
        WHEN rp.id IS NOT NULL AND e.start_time IS NOT NULL
          THEN to_char((e.start_time AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))::date, 'YYYY-MM-DD')
        ELSE e.meta_data->'raffle'->>'draw_date'
      END,
      'cutoff_time', CASE
        WHEN rp.id IS NOT NULL AND e.start_time IS NOT NULL
          THEN to_char(
                 (e.start_time - make_interval(mins => rp.cutoff_offset_minutes))
                   AT TIME ZONE COALESCE(e.timezone, 'Europe/London'),
                 'HH24:MI'
               )
        ELSE e.meta_data->'raffle'->>'cutoff_time'
      END,
      'cutoff_passed', CASE
        WHEN rp.id IS NOT NULL AND e.start_time IS NOT NULL THEN
          (now() >= (e.start_time - make_interval(mins => rp.cutoff_offset_minutes)))
        WHEN (e.meta_data->'raffle'->>'cutoff_time') IS NULL
          OR (e.meta_data->'raffle'->>'cutoff_time') = ''
          OR e.start_time IS NULL
          OR (e.meta_data->'raffle'->>'cutoff_time') !~ '^\d{2}:\d{2}(:\d{2})?$' THEN
          false
        ELSE (now() >= (
          (e.start_time AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))::date
          || ' ' || (e.meta_data->'raffle'->>'cutoff_time')
        )::timestamp AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))
      END,

      -- Counts and draw info (zero when no raffle).
      'active_entry_count', (
        SELECT COUNT(*)
          FROM event_raffle_entries ere
         WHERE ere.event_id = e.id
           AND ere.deleted_at IS NULL
           AND ere.ineligible_reason IS NULL
      ),
      'total_entry_count', (
        SELECT COUNT(*)
          FROM event_raffle_entries ere
         WHERE ere.event_id = e.id
      ),
      'current_winner_first_name', (
        SELECT winner.first_name
          FROM event_raffle_draws erd
          LEFT JOIN event_raffle_entries winner ON winner.id = erd.winner_entry_id
         WHERE erd.event_id = e.id AND erd.is_active = true
         LIMIT 1
      ),
      'current_draw_is_active', EXISTS (
        SELECT 1 FROM event_raffle_draws erd
         WHERE erd.event_id = e.id AND erd.is_active = true
      )
    ) ORDER BY e.start_time ASC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM events e
  LEFT JOIN raffle_presets rp ON rp.id = e.raffle_preset_id
  WHERE e.lifecycle_status = 'published'
    AND e.start_time IS NOT NULL
    AND e.start_time >= now() - interval '6 hours'  -- 6h past-event grace
    AND e.start_time <= now() + (v_days || ' days')::interval;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_raffle_picker_events_v1(int) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. admin_assign_raffle_preset_v1 — single-event assign / unassign
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_raffle_preset_v1(
  p_event_id uuid,
  p_preset_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_event_exists  boolean;
  v_preset_exists boolean := true;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_id_required');
  END IF;

  SELECT true INTO v_event_exists FROM events WHERE id = p_event_id;
  IF v_event_exists IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  IF p_preset_id IS NOT NULL THEN
    SELECT true INTO v_preset_exists
      FROM raffle_presets
     WHERE id = p_preset_id AND is_archived = false;
    IF v_preset_exists IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'preset_not_found_or_archived');
    END IF;
  END IF;

  -- Set preset, strip meta_data.raffle (preset OR custom, mutually exclusive).
  -- When p_preset_id is NULL, both fields are cleared (raffle disabled).
  UPDATE events
     SET raffle_preset_id = p_preset_id,
         meta_data = CASE
           WHEN meta_data IS NULL THEN NULL
           WHEN meta_data ? 'raffle' THEN meta_data - 'raffle'
           ELSE meta_data
         END
   WHERE id = p_event_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_assign_raffle_preset_v1(uuid, uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. admin_bulk_assign_raffle_preset_v1 — bulk assign / unassign
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_assign_raffle_preset_v1(
  p_event_ids uuid[],
  p_preset_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_preset_exists  boolean := true;
  v_assigned_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_event_ids IS NULL OR cardinality(p_event_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_ids_required');
  END IF;

  IF p_preset_id IS NOT NULL THEN
    SELECT true INTO v_preset_exists
      FROM raffle_presets
     WHERE id = p_preset_id AND is_archived = false;
    IF v_preset_exists IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'preset_not_found_or_archived');
    END IF;
  END IF;

  WITH updated AS (
    UPDATE events
       SET raffle_preset_id = p_preset_id,
           meta_data = CASE
             WHEN meta_data IS NULL THEN NULL
             WHEN meta_data ? 'raffle' THEN meta_data - 'raffle'
             ELSE meta_data
           END
     WHERE id = ANY(p_event_ids)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_assigned_count FROM updated;

  RETURN jsonb_build_object(
    'ok',              true,
    'assigned_count',  v_assigned_count,
    'requested_count', cardinality(p_event_ids),
    'skipped_count',   GREATEST(0, cardinality(p_event_ids) - v_assigned_count)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_assign_raffle_preset_v1(uuid[], uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 4. admin_list_series_upcoming_event_ids_v1 — series helper (by name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_series_upcoming_event_ids_v1(
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_name         text;
  v_target_start timestamptz;
  v_event_ids    uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_id_required');
  END IF;

  SELECT name, start_time
    INTO v_name, v_target_start
    FROM events
   WHERE id = p_event_id;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  SELECT array_agg(id ORDER BY start_time ASC NULLS LAST)
    INTO v_event_ids
    FROM events
   WHERE name = v_name
     AND lifecycle_status = 'published'
     AND start_time IS NOT NULL
     AND start_time >= COALESCE(v_target_start, now());  -- target's start onward, inclusive

  RETURN jsonb_build_object(
    'ok',        true,
    'name',      v_name,
    'event_ids', COALESCE(to_jsonb(v_event_ids), '[]'::jsonb),
    'count',     COALESCE(cardinality(v_event_ids), 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_series_upcoming_event_ids_v1(uuid) TO authenticated;


NOTIFY pgrst, 'reload schema';
