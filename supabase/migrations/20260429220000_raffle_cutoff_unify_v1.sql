-- =============================================================================
-- Raffle cutoff unify v1 — surface cutoff_at + offset-minutes everywhere
--
-- Background
-- ----------
-- The "raffle closes 2 hours before the event" rule was only half-implemented:
--
--   * Preset-based raffles (raffle_presets.cutoff_offset_minutes) — server
--     correctly computed `event_start - offset` in get_event_raffle (Phase 6B).
--   * Custom-config raffles (events.meta_data->'raffle'->>'cutoff_time') —
--     server combined the wall-clock TIME with the event date, so a 19:00
--     event with cutoff_time '21:00' "closed" 2 hours AFTER it began.
--   * Client useCountdown — parsed the wall-clock string against TODAY's date,
--     so the visible "Closes in Xh Ym" text was wrong on every event regardless
--     of which path the server took.
--
-- This migration
-- --------------
--   1. Backfills the single legacy custom-config raffle row's meta_data.raffle
--      with `cutoff_offset_minutes: 120` (default 2h), so the new logic has
--      something to read. Idempotent — safe to re-run.
--
--   2. Rewrites get_event_raffle so:
--        - both preset AND custom paths derive v_cutoff_dt from
--          (event_start - cutoff_offset_minutes), defaulting to 120 mins.
--        - returns a new cutoff_at (timestamptz, ISO) — single source of truth
--          for the client. Old cutoff_time still returned for back-compat.
--        - preserves the calendar_occurrences.instance_start lookup added by
--          the recurring-events canonical reads patch (it now drives v_cutoff_dt
--          for recurring events too — the override-naming is identical: the
--          variable is still called v_event_start internally).
--
--   3. Rewrites admin_list_raffle_events_v1 + admin_list_raffle_picker_events_v1
--      to mirror the new logic and surface cutoff_at + cutoff_offset_minutes.
--
--   4. Drops the legacy wall-clock parsing path. The 1 custom raffle in prod
--      (id 0000e780-…, "Sensual Vibes") is past-dated and had no cutoff_time
--      anyway — backfill installs offset 120 so any future custom raffle picks
--      up the platform default.
--
-- Rollback
-- --------
-- Fully reversible by replaying the prior CREATE OR REPLACE bodies (kept in
-- supabase/migrations/20260425200000_raffle_phase6b_readpath_presets.sql and
-- 20260426010000_raffle_phase6d_assign_and_picker_rpcs.sql). Backfill writes
-- a single new key into the JSON; safe to leave even on rollback.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill: inject cutoff_offset_minutes=120 into any custom-config raffle
--    that doesn't already have one. There is currently 1 such row (past
--    event); the operation is a no-op on rows that already carry the field.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE events
   SET meta_data = jsonb_set(
         meta_data,
         '{raffle,cutoff_offset_minutes}',
         to_jsonb(120),
         true
       )
 WHERE has_raffle = true
   AND raffle_preset_id IS NULL
   AND meta_data ? 'raffle'
   AND meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
   AND meta_data->'raffle' IS DISTINCT FROM '{}'::jsonb
   AND NOT (meta_data->'raffle' ? 'cutoff_offset_minutes');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_event_raffle — single canonical cutoff math + cutoff_at in response
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_event_raffle(
  p_event_id   uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
  v_cutoff_offset_mins  int;
  v_cutoff_dt           timestamptz;
  v_cutoff_time         text;
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
  -- v_event_start uses calendar_occurrences.instance_start when available so
  -- recurring events anchor to the next live instance instead of the stale
  -- series anchor.
  SELECT
      e.has_raffle, e.meta_data,
      COALESCE(occ.next_start, e.start_time),
      e.timezone, e.series_key, e.raffle_preset_id
    INTO v_enabled, v_meta, v_event_start, v_event_tz, v_series_key, v_preset_id
    FROM events e
    LEFT JOIN LATERAL (
      SELECT MIN(co.instance_start) AS next_start
        FROM calendar_occurrences co
       WHERE co.event_id = e.id
         AND co.instance_start >= now() - interval '6 hours'
    ) occ ON TRUE
   WHERE e.id = p_event_id AND e.lifecycle_status = 'published';

  IF v_enabled IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'event_not_found');
  END IF;
  IF NOT v_enabled THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  v_raffle_cfg      := COALESCE(v_meta->'raffle', '{}'::jsonb);
  v_has_preset      := (v_preset_id IS NOT NULL);
  v_has_meta_raffle := (
    v_meta IS NOT NULL AND v_meta ? 'raffle'
    AND v_meta->'raffle' IS DISTINCT FROM 'null'::jsonb
    AND v_meta->'raffle' IS DISTINCT FROM '{}'::jsonb
  );

  -- ── Resolve config source + the canonical cutoff offset (minutes).
  -- Default offset is 120 minutes (2 hours before event start).
  IF v_has_preset THEN
    SELECT prize_text, cutoff_offset_minutes, show_winner_publicly, consent_version
      INTO v_preset_prize, v_preset_cutoff_mins, v_preset_show_winner, v_preset_consent
      FROM raffle_presets WHERE id = v_preset_id;

    v_config_source      := 'preset';
    v_prize_text         := v_preset_prize;
    v_consent_version    := v_preset_consent;
    v_show_winner        := COALESCE(v_preset_show_winner, false);
    v_cutoff_offset_mins := COALESCE(v_preset_cutoff_mins, 120);
  ELSIF v_has_meta_raffle THEN
    v_config_source      := 'custom';
    v_prize_text         := v_raffle_cfg->>'prize_text';
    v_draw_date          := v_raffle_cfg->>'draw_date';
    v_consent_version    := v_raffle_cfg->>'consent_version';
    v_show_winner        := COALESCE((v_raffle_cfg->>'show_winner_publicly')::boolean, false);
    BEGIN
      v_cutoff_offset_mins := COALESCE((v_raffle_cfg->>'cutoff_offset_minutes')::int, 120);
    EXCEPTION WHEN OTHERS THEN
      v_cutoff_offset_mins := 120;
    END;
  ELSE
    v_config_source      := 'none';
    v_cutoff_offset_mins := NULL;
  END IF;

  -- ── Compute canonical cutoff timestamp + back-compat fields.
  IF v_event_start IS NOT NULL AND v_cutoff_offset_mins IS NOT NULL THEN
    v_cutoff_dt     := v_event_start - make_interval(mins => v_cutoff_offset_mins);
    v_cutoff_time   := to_char(v_cutoff_dt AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'), 'HH24:MI');
    v_cutoff_passed := (now() >= v_cutoff_dt);
  END IF;

  -- ── Preset path also derives draw_date from event_start.
  IF v_has_preset AND v_event_start IS NOT NULL THEN
    v_draw_date := to_char((v_event_start AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'))::date, 'YYYY-MM-DD');
  END IF;

  -- ── Counts and winner display (unchanged from prior).
  SELECT COUNT(*) INTO v_entry_count
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL;

  SELECT * INTO v_active_draw
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true LIMIT 1;

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

  -- ── Per-session status block (unchanged).
  IF p_session_id IS NOT NULL THEN
    SELECT id, ineligible_reason, deleted_at INTO v_my_entry
      FROM event_raffle_entries
     WHERE event_id = p_event_id AND session_id = p_session_id AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1;
    IF v_my_entry.id IS NULL THEN
      v_my_status_code := 'none';
      v_my_entered := false;
    ELSE
      v_my_entered := true;
      IF v_active_draw.id IS NOT NULL AND v_active_draw.winner_entry_id = v_my_entry.id THEN
        v_my_status_code := 'already_won';
      ELSIF v_my_entry.ineligible_reason IS NOT NULL THEN
        v_my_status_code := 'admin_excluded';
      ELSE
        v_my_status_code := 'eligible';
      END IF;
    END IF;
    IF v_my_status_code IN ('admin_excluded', 'already_won') THEN
      SELECT jsonb_build_object(
        'event_id',   alt.id,
        'name',       alt.name,
        'slug',       alt.city_slug,
        'start_at',   COALESCE(alt_occ.next_start, alt.start_time),
        'prize_text', COALESCE(alt_preset.prize_text, alt.meta_data->'raffle'->>'prize_text')
      )
      INTO v_alt_event
      FROM events alt
      LEFT JOIN raffle_presets alt_preset ON alt_preset.id = alt.raffle_preset_id
      LEFT JOIN LATERAL (
        SELECT MIN(co.instance_start) AS next_start
          FROM calendar_occurrences co
         WHERE co.event_id = alt.id
           AND co.instance_start >= now() - interval '6 hours'
      ) alt_occ ON TRUE
      WHERE alt.id <> p_event_id
        AND alt.has_raffle = true
        AND alt.lifecycle_status = 'published'
        AND COALESCE(alt_occ.next_start, alt.start_time) > now()
        AND (
          v_series_key IS NULL OR alt.series_key IS NULL OR alt.series_key <> v_series_key
        )
      ORDER BY COALESCE(alt_occ.next_start, alt.start_time) ASC LIMIT 1;
    END IF;
    v_my_status := jsonb_build_object(
      'entered',         v_my_entered,
      'status',          v_my_status_code,
      'alternate_event', v_alt_event
    );
  END IF;

  RETURN jsonb_build_object(
    'enabled',               true,
    'config_source',         v_config_source,
    'entry_count',           v_entry_count,
    'prize_text',            v_prize_text,
    'draw_date',             v_draw_date,
    'cutoff_time',           v_cutoff_time,
    'cutoff_at',             v_cutoff_dt,
    'cutoff_offset_minutes', v_cutoff_offset_mins,
    'cutoff_passed',         v_cutoff_passed,
    'consent_version',       v_consent_version,
    'winner_display',        v_winner_display,
    'my_status',             v_my_status
  );
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_list_raffle_events_v1 — unify cutoff math + add cutoff_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_raffle_events_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH src AS (
    SELECT
      e.id, e.name, e.start_time, e.timezone, e.series_key, e.has_raffle,
      e.meta_data, e.raffle_preset_id, rp.id AS preset_id, rp.name AS preset_name,
      rp.slug AS preset_slug, rp.prize_text AS preset_prize_text,
      rp.cutoff_offset_minutes AS preset_cutoff_mins,
      CASE
        WHEN rp.id IS NOT NULL THEN 'preset'
        WHEN e.meta_data ? 'raffle'
         AND e.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
         AND e.meta_data->'raffle' IS DISTINCT FROM '{}'::jsonb THEN 'custom'
        ELSE 'none'
      END AS config_source,
      -- Effective offset: preset > custom-config > default 120
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
    WHERE e.has_raffle = true
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',           src.id,
      'name',               src.name,
      'start_at',           src.start_time,
      'timezone',           src.timezone,
      'series_key',         src.series_key,
      'raffle_preset_id',   src.preset_id,
      'raffle_preset_name', src.preset_name,
      'raffle_preset_slug', src.preset_slug,
      'config_source',      src.config_source,
      'prize_text',
        COALESCE(src.preset_prize_text, src.meta_data->'raffle'->>'prize_text'),
      'draw_date',
        CASE
          WHEN src.preset_id IS NOT NULL AND src.start_time IS NOT NULL
            THEN to_char((src.start_time AT TIME ZONE COALESCE(src.timezone, 'Europe/London'))::date, 'YYYY-MM-DD')
          ELSE src.meta_data->'raffle'->>'draw_date'
        END,
      'cutoff_offset_minutes', src.effective_offset_mins,
      'cutoff_at',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN src.start_time - make_interval(mins => src.effective_offset_mins)
          ELSE NULL
        END,
      'cutoff_time',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN to_char(
                   (src.start_time - make_interval(mins => src.effective_offset_mins))
                     AT TIME ZONE COALESCE(src.timezone, 'Europe/London'),
                   'HH24:MI'
                 )
          ELSE NULL
        END,
      'cutoff_passed',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN (now() >= (src.start_time - make_interval(mins => src.effective_offset_mins)))
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
    ) ORDER BY src.start_time ASC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM src;

  RETURN v_result;
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_list_raffle_picker_events_v1 — unify cutoff math + add cutoff_at
-- ─────────────────────────────────────────────────────────────────────────────

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
      e.id, e.name, e.start_time, e.timezone, e.series_key, e.has_raffle,
      e.meta_data, e.raffle_preset_id, rp.id AS preset_id, rp.name AS preset_name,
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
    WHERE e.lifecycle_status = 'published'
      AND e.start_time IS NOT NULL
      AND e.start_time >= now() - interval '6 hours'
      AND e.start_time <= now() + (v_days || ' days')::interval
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',           src.id,
      'name',               src.name,
      'start_at',           src.start_time,
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
          WHEN src.preset_id IS NOT NULL AND src.start_time IS NOT NULL
            THEN to_char((src.start_time AT TIME ZONE COALESCE(src.timezone, 'Europe/London'))::date, 'YYYY-MM-DD')
          ELSE src.meta_data->'raffle'->>'draw_date'
        END,
      'cutoff_offset_minutes', src.effective_offset_mins,
      'cutoff_at',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN src.start_time - make_interval(mins => src.effective_offset_mins)
          ELSE NULL
        END,
      'cutoff_time',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN to_char(
                   (src.start_time - make_interval(mins => src.effective_offset_mins))
                     AT TIME ZONE COALESCE(src.timezone, 'Europe/London'),
                   'HH24:MI'
                 )
          ELSE NULL
        END,
      'cutoff_passed',
        CASE
          WHEN src.start_time IS NOT NULL AND src.effective_offset_mins IS NOT NULL
            THEN (now() >= (src.start_time - make_interval(mins => src.effective_offset_mins)))
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
    ) ORDER BY src.start_time ASC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM src;

  RETURN v_result;
END;
$function$;


COMMIT;

NOTIFY pgrst, 'reload schema';
