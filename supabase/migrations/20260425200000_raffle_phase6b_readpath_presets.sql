-- =============================================================================
-- Phase 6B — Read-path updates for raffle presets
--
-- Patches two RPCs to read preset-first with fallback to meta_data.raffle:
--   1. public.get_event_raffle(event_id, session_id)  — public site
--   2. public.admin_list_raffle_events_v1()           — admin /raffles picker
--
-- Precedence at read time:
--   (a) events.raffle_preset_id IS NOT NULL → load from raffle_presets.
--       cutoff_time derived from cutoff_offset_minutes, draw_date = event date.
--   (b) meta_data.raffle exists             → current custom-config behaviour.
--   (c) Neither                             → raffle not enabled.
--
-- Adds "config_source" to both responses: 'preset' | 'custom' | 'none'.
-- No data changes. Fully reversible by replaying the prior function defs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- public.get_event_raffle(p_event_id, p_session_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_raffle(
  p_event_id uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_enabled             boolean;
  v_meta                jsonb;
  v_raffle_cfg          jsonb;
  v_preset_id           uuid;
  v_preset_prize        text;
  v_preset_cutoff_mins  int;
  v_preset_show_winner  boolean;
  v_preset_consent      text;
  v_has_preset          boolean;
  v_has_meta_raffle     boolean;
  v_config_source       text;
  v_prize_text          text;
  v_draw_date           text;
  v_consent_version     text;
  v_show_winner         boolean := false;
  v_entry_count         int;
  v_event_start         timestamptz;
  v_event_tz            text;
  v_series_key          text;
  v_cutoff_time         text;
  v_cutoff_dt           timestamptz;
  v_cutoff_passed       boolean := false;
  v_active_draw         record;
  v_winner              record;
  v_winner_display      jsonb := NULL;
  v_my_entry            record;
  v_my_status_code      text;
  v_my_entered          boolean := false;
  v_alt_event           jsonb := NULL;
  v_my_status           jsonb := NULL;
BEGIN
  SELECT has_raffle, meta_data, start_time, timezone, series_key, raffle_preset_id
    INTO v_enabled, v_meta, v_event_start, v_event_tz, v_series_key, v_preset_id
    FROM events
   WHERE id = p_event_id AND lifecycle_status = 'published';

  IF v_enabled IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'event_not_found');
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  v_raffle_cfg      := COALESCE(v_meta->'raffle', '{}'::jsonb);
  v_has_preset      := (v_preset_id IS NOT NULL);
  v_has_meta_raffle := (
    v_meta IS NOT NULL
    AND v_meta ? 'raffle'
    AND v_meta->'raffle' IS DISTINCT FROM 'null'::jsonb
    AND v_meta->'raffle' IS DISTINCT FROM '{}'::jsonb
  );

  IF v_has_preset THEN
    SELECT prize_text, cutoff_offset_minutes, show_winner_publicly, consent_version
      INTO v_preset_prize, v_preset_cutoff_mins, v_preset_show_winner, v_preset_consent
      FROM raffle_presets
     WHERE id = v_preset_id;

    v_config_source   := 'preset';
    v_prize_text      := v_preset_prize;
    v_consent_version := v_preset_consent;
    v_show_winner     := COALESCE(v_preset_show_winner, false);

    IF v_event_start IS NOT NULL THEN
      v_cutoff_dt     := v_event_start - make_interval(mins => v_preset_cutoff_mins);
      v_cutoff_time   := to_char(v_cutoff_dt AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'), 'HH24:MI');
      v_cutoff_passed := (now() >= v_cutoff_dt);
      v_draw_date     := to_char((v_event_start AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'))::date, 'YYYY-MM-DD');
    END IF;
  ELSIF v_has_meta_raffle THEN
    v_config_source   := 'custom';
    v_prize_text      := v_raffle_cfg->>'prize_text';
    v_draw_date       := v_raffle_cfg->>'draw_date';
    v_consent_version := v_raffle_cfg->>'consent_version';
    v_show_winner     := COALESCE((v_raffle_cfg->>'show_winner_publicly')::boolean, false);
    v_cutoff_time     := v_raffle_cfg->>'cutoff_time';

    IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_event_start IS NOT NULL THEN
      BEGIN
        v_cutoff_dt := (
          (v_event_start AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'))::date
          || ' ' || v_cutoff_time
        )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');
        v_cutoff_passed := (now() >= v_cutoff_dt);
      EXCEPTION WHEN OTHERS THEN
        v_cutoff_passed := false;
      END;
    END IF;
  ELSE
    v_config_source := 'none';
  END IF;

  SELECT COUNT(*) INTO v_entry_count
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL;

  -- Winner display: gated on draw + public opt-in.
  SELECT * INTO v_active_draw
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true
   LIMIT 1;

  IF v_active_draw.id IS NOT NULL AND v_show_winner = true THEN
    SELECT first_name, phone_e164 INTO v_winner
      FROM event_raffle_entries
     WHERE id = v_active_draw.winner_entry_id;

    IF v_winner.first_name IS NOT NULL THEN
      v_winner_display := jsonb_build_object(
        'first_name', v_winner.first_name,
        'drawn_at',   v_active_draw.drawn_at
      );
    END IF;
  END IF;

  -- Phase 5E — per-session status.
  IF p_session_id IS NOT NULL THEN
    SELECT id, ineligible_reason, deleted_at
      INTO v_my_entry
      FROM event_raffle_entries
     WHERE event_id = p_event_id
       AND session_id = p_session_id
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_my_entry.id IS NULL THEN
      v_my_status_code := 'none';
      v_my_entered := false;
    ELSE
      v_my_entered := true;
      IF v_active_draw.id IS NOT NULL AND v_active_draw.winner_entry_id = v_my_entry.id THEN
        v_my_status_code := 'already_won';
      ELSIF v_my_entry.ineligible_reason IS NOT NULL THEN
        -- Visible tier — admin explicitly marked ineligible. Silent
        -- series-repeat stays 'eligible' here on purpose.
        v_my_status_code := 'admin_excluded';
      ELSE
        v_my_status_code := 'eligible';
      END IF;
    END IF;

    -- Alternate event suggestion (preset-aware prize_text).
    IF v_my_status_code IN ('admin_excluded', 'already_won') THEN
      SELECT jsonb_build_object(
        'event_id',   alt.id,
        'name',       alt.name,
        'slug',       alt.city_slug,
        'start_at',   alt.start_time,
        'prize_text', COALESCE(alt_preset.prize_text, alt.meta_data->'raffle'->>'prize_text')
      )
      INTO v_alt_event
      FROM events alt
      LEFT JOIN raffle_presets alt_preset ON alt_preset.id = alt.raffle_preset_id
      WHERE alt.id <> p_event_id
        AND alt.has_raffle = true
        AND alt.lifecycle_status = 'published'
        AND alt.start_time > now()
        AND (
          v_series_key IS NULL
          OR alt.series_key IS NULL
          OR alt.series_key <> v_series_key
        )
      ORDER BY alt.start_time ASC
      LIMIT 1;
    END IF;

    v_my_status := jsonb_build_object(
      'entered',         v_my_entered,
      'status',          v_my_status_code,
      'alternate_event', v_alt_event
    );
  END IF;

  RETURN jsonb_build_object(
    'enabled',         true,
    'config_source',   v_config_source,
    'entry_count',     v_entry_count,
    'prize_text',      v_prize_text,
    'draw_date',       v_draw_date,
    'cutoff_time',     v_cutoff_time,
    'cutoff_passed',   v_cutoff_passed,
    'consent_version', v_consent_version,
    'winner_display',  v_winner_display,
    'my_status',       v_my_status
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- public.admin_list_raffle_events_v1()
--
-- Adds preset metadata + config_source, and computes effective
-- prize_text / draw_date / cutoff_time / cutoff_passed preset-first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_raffle_events_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',   e.id,
      'name',       e.name,
      'start_at',   e.start_time,
      'timezone',   e.timezone,
      'series_key', e.series_key,

      -- Preset metadata (null when no preset assigned).
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

      -- Counts and draw info (unchanged).
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
  WHERE e.has_raffle = true;

  RETURN v_result;
END;
$function$;

NOTIFY pgrst, 'reload schema';
