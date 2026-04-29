-- =============================================================================
-- Raffle: manual winner pick + per-event eligibility override (v1)
--
-- Two admin-only powers, one migration:
--
--   1. Manual pick — admin chooses ANY eligible entry as the winner from
--      the entries table. Goes through the same event_raffle_draws row shape
--      as the random draw, so the public winner_display tile lights up the
--      same way. New `pick_method` column distinguishes 'random' (existing)
--      vs 'manual' (new) for audit + UI.
--
--   2. Eligibility override — admin can flag a specific entry as
--      force-eligible for THIS event. Repurposed-purpose: overrides the
--      series-repeat silent-skip in admin_draw_raffle_winner_v1's random
--      pool, AND restores eligibility to a row that was admin-marked
--      ineligible. Audit trio mirrors the existing ineligible_* set.
--
-- Migrations after this one (Phase 6):
--   - tests + smoke
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Pick method on draws — distinguishes 'random' (admin_draw_raffle_winner_v1)
-- from 'manual' (admin_pick_raffle_winner_v1). Backfill all existing rows to
-- 'random' so the column can be NOT NULL.
ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS pick_method text;

UPDATE public.event_raffle_draws
   SET pick_method = 'random'
 WHERE pick_method IS NULL;

ALTER TABLE public.event_raffle_draws
  ALTER COLUMN pick_method SET NOT NULL,
  ALTER COLUMN pick_method SET DEFAULT 'random';

ALTER TABLE public.event_raffle_draws
  DROP CONSTRAINT IF EXISTS event_raffle_draws_pick_method_chk;
ALTER TABLE public.event_raffle_draws
  ADD CONSTRAINT event_raffle_draws_pick_method_chk
  CHECK (pick_method IN ('random', 'manual'));

COMMENT ON COLUMN public.event_raffle_draws.pick_method IS
  '''random'' = chosen by admin_draw_raffle_winner_v1 RNG. ''manual'' = chosen '
  'by admin_pick_raffle_winner_v1 (admin handpicked the winner from the entries '
  'table). Drives admin UI badges + audit reporting.';


-- Eligibility override on entries — tells the random-draw RPC to include
-- this row even if it would normally be filtered out (series_repeat or
-- ineligible_reason). Audit trio mirrors the existing ineligible_* set.
ALTER TABLE public.event_raffle_entries
  ADD COLUMN IF NOT EXISTS eligibility_override        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility_override_at     timestamptz,
  ADD COLUMN IF NOT EXISTS eligibility_override_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eligibility_override_reason text;

COMMENT ON COLUMN public.event_raffle_entries.eligibility_override IS
  'true = admin has force-included this entry in the draw pool for this event '
  'specifically. Overrides series-repeat silent-skip AND admin-set ineligibility. '
  'Per-event only — does NOT carry over to other events.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_pick_raffle_winner_v1 — manual pick by entry_id
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces or installs the active draw with a hand-chosen winner. Soft-validates
-- entry membership + non-deleted. Skips eligibility checks deliberately — the
-- whole point of manual pick is admin override of automatic filtering. Audit
-- trail still captures the snapshot of the eligible pool at pick time, plus
-- the chosen entry's row inline so post-hoc analysis can flag picks that
-- bypassed the normal pool.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_pick_raffle_winner_v1(
  p_event_id uuid,
  p_entry_id uuid,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id      uuid;
  v_existing      record;
  v_entry         record;
  v_snapshot      jsonb;
  v_chosen_inline jsonb;
  v_new_draw      record;
  v_event_exists  boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  IF p_event_id IS NULL OR p_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_id_and_entry_id_required');
  END IF;

  SELECT true INTO v_event_exists FROM events WHERE id = p_event_id;
  IF v_event_exists IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  -- Validate entry: belongs to this event, not soft-deleted.
  SELECT id, first_name, phone_e164, created_at, ineligible_reason,
         eligibility_override, deleted_at
    INTO v_entry
    FROM event_raffle_entries
   WHERE id = p_entry_id AND event_id = p_event_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_not_found');
  END IF;

  IF v_entry.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_deleted');
  END IF;

  -- Find any existing active draw on this event so we demote it before insert
  -- (partial unique index uq_event_raffle_draws_one_active_per_event).
  SELECT * INTO v_existing
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true
   LIMIT 1;

  -- Snapshot the eligible pool at pick time. Mirrors admin_draw_raffle_winner_v1
  -- shape (no series_repeat field — manual picks don't filter it).
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                    ere.id,
      'first_name',            ere.first_name,
      'phone_e164',            ere.phone_e164,
      'created_at',            ere.created_at,
      'ineligible_reason',     ere.ineligible_reason,
      'eligibility_override',  ere.eligibility_override
    ) ORDER BY ere.created_at
  ), '[]'::jsonb)
  INTO v_snapshot
  FROM event_raffle_entries ere
  WHERE ere.event_id = p_event_id
    AND ere.deleted_at IS NULL;

  -- Inline the chosen entry's row for fast-path audit (was the pick
  -- inside or outside the normal eligible pool?).
  v_chosen_inline := jsonb_build_object(
    'id',                    v_entry.id,
    'first_name',            v_entry.first_name,
    'phone_e164',            v_entry.phone_e164,
    'created_at',            v_entry.created_at,
    'ineligible_reason',     v_entry.ineligible_reason,
    'eligibility_override',  v_entry.eligibility_override
  );

  -- Demote existing active draw (if any) before insert.
  IF v_existing.id IS NOT NULL THEN
    UPDATE event_raffle_draws
       SET is_active = false
     WHERE id = v_existing.id;
  END IF;

  INSERT INTO event_raffle_draws (
    event_id,
    prior_draw_id,
    is_active,
    drawn_at,
    winner_entry_id,
    entries_snapshot,
    drawn_by,
    claimed_at,
    reason,
    pick_method
  ) VALUES (
    p_event_id,
    v_existing.id,
    true,
    now(),
    p_entry_id,
    jsonb_build_object('pool', v_snapshot, 'chosen', v_chosen_inline),
    v_actor_id,
    now(),
    CASE WHEN p_reason IS NULL OR length(trim(p_reason)) = 0 THEN NULL ELSE trim(p_reason) END,
    'manual'
  )
  RETURNING * INTO v_new_draw;

  RETURN jsonb_build_object(
    'ok',                true,
    'draw_id',           v_new_draw.id,
    'winner_entry_id',   p_entry_id,
    'winner_first_name', v_entry.first_name,
    'is_redraw',         v_existing.id IS NOT NULL,
    'prior_draw_id',     v_existing.id,
    'pick_method',       'manual',
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at,
    'reason',            v_new_draw.reason
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_pick_raffle_winner_v1(uuid, uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_override_raffle_eligibility_v1 — set/unset force-eligible flag
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Idempotent on the boolean. Records actor + reason for audit when toggling
-- ON; clears the audit trio when toggling OFF.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_override_raffle_eligibility_v1(
  p_entry_id uuid,
  p_override boolean,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id uuid;
  v_entry    record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  IF p_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_id_required');
  END IF;

  SELECT id, eligibility_override INTO v_entry
    FROM event_raffle_entries
   WHERE id = p_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_not_found');
  END IF;

  IF p_override IS TRUE THEN
    UPDATE event_raffle_entries
       SET eligibility_override        = true,
           eligibility_override_at     = now(),
           eligibility_override_by     = v_actor_id,
           eligibility_override_reason =
             CASE WHEN p_reason IS NULL OR length(trim(p_reason)) = 0
                  THEN NULL ELSE trim(p_reason) END
     WHERE id = p_entry_id;
  ELSE
    UPDATE event_raffle_entries
       SET eligibility_override        = false,
           eligibility_override_at     = NULL,
           eligibility_override_by     = NULL,
           eligibility_override_reason = NULL
     WHERE id = p_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'entry_id',   p_entry_id,
    'override',   p_override,
    'changed',    v_entry.eligibility_override IS DISTINCT FROM p_override,
    'updated_by', v_actor_id,
    'updated_at', now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_override_raffle_eligibility_v1(uuid, boolean, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_draw_raffle_winner_v1 — patched to include override entries
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Rule changes vs prior:
--   * Eligible-pool query now ORs in eligibility_override = true even when
--     ineligible_reason IS NOT NULL (override beats admin-set ineligibility).
--   * Series-repeat filter (NOT series_repeat) now also accepts overridden
--     rows: (NOT series_repeat OR eligibility_override = true).
--   * Snapshot row gains an `eligibility_override` field for audit.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winner_v1(
  p_event_id uuid,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id      uuid;
  v_series_key    text;
  v_existing_draw record;
  v_snapshot      jsonb;
  v_entry_count   int;
  v_first_timer   int;
  v_winner_id     uuid;
  v_new_draw      record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  SELECT e.series_key INTO v_series_key
    FROM events e WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  SELECT * INTO v_existing_draw
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true
   LIMIT 1;

  IF v_existing_draw.id IS NOT NULL THEN
    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'redraw_requires_reason',
        'existing_draw_id', v_existing_draw.id
      );
    END IF;
  END IF;

  WITH eligible_entries AS (
    SELECT
      ere.id, ere.first_name, ere.phone_e164, ere.created_at,
      ere.eligibility_override,
      CASE
        WHEN v_series_key IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM event_raffle_entries prior
          JOIN events e_prior ON e_prior.id = prior.event_id
          WHERE e_prior.series_key = v_series_key
            AND prior.phone_e164 = ere.phone_e164
            AND prior.event_id <> ere.event_id
            AND prior.created_at < ere.created_at
            AND prior.deleted_at IS NULL
        )
      END AS series_repeat
    FROM event_raffle_entries ere
    WHERE ere.event_id = p_event_id
      AND ere.deleted_at IS NULL
      AND (ere.ineligible_reason IS NULL OR ere.eligibility_override = true)
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                    id,
        'first_name',            first_name,
        'phone_e164',            phone_e164,
        'created_at',            created_at,
        'series_repeat',         series_repeat,
        'eligibility_override',  eligibility_override
      ) ORDER BY created_at
    ), '[]'::jsonb),
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT series_repeat OR eligibility_override = true)
  INTO v_snapshot, v_entry_count, v_first_timer
  FROM eligible_entries;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  IF v_first_timer = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no_first_timers',
      'entry_count', v_entry_count,
      'series_key', v_series_key
    );
  END IF;

  -- Winner pick mirrors the eligible_entries CTE filter exactly.
  SELECT ere.id INTO v_winner_id
    FROM event_raffle_entries ere
   WHERE ere.event_id = p_event_id
     AND ere.deleted_at IS NULL
     AND (ere.ineligible_reason IS NULL OR ere.eligibility_override = true)
     AND (
       v_series_key IS NULL
       OR ere.eligibility_override = true
       OR NOT EXISTS (
         SELECT 1
         FROM event_raffle_entries prior
         JOIN events e_prior ON e_prior.id = prior.event_id
         WHERE e_prior.series_key = v_series_key
           AND prior.phone_e164 = ere.phone_e164
           AND prior.event_id <> ere.event_id
           AND prior.created_at < ere.created_at
           AND prior.deleted_at IS NULL
       )
     )
   ORDER BY random()
   LIMIT 1;

  IF v_existing_draw.id IS NOT NULL THEN
    UPDATE event_raffle_draws
       SET is_active = false
     WHERE id = v_existing_draw.id;
  END IF;

  INSERT INTO event_raffle_draws (
    event_id, prior_draw_id, is_active, drawn_at, winner_entry_id,
    entries_snapshot, drawn_by, claimed_at, reason, pick_method
  ) VALUES (
    p_event_id, v_existing_draw.id, true, now(), v_winner_id,
    v_snapshot, v_actor_id, now(),
    CASE WHEN p_reason IS NULL OR length(trim(p_reason)) = 0 THEN NULL ELSE trim(p_reason) END,
    'random'
  )
  RETURNING * INTO v_new_draw;

  RETURN jsonb_build_object(
    'ok',                true,
    'draw_id',           v_new_draw.id,
    'winner_entry_id',   v_winner_id,
    'entry_count',       v_entry_count,
    'first_timer_count', v_first_timer,
    'series_key',        v_series_key,
    'is_redraw',         v_existing_draw.id IS NOT NULL,
    'prior_draw_id',     v_existing_draw.id,
    'pick_method',       'random',
    'reason',            v_new_draw.reason,
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at
  );
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_list_raffle_entries_v1 — surface eligibility_override fields
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_raffle_entries_v1(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entries          jsonb;
  v_total            int;
  v_active           int;
  v_eligible         int;
  v_first_timer      int;
  v_series_key       text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT e.series_key INTO v_series_key
    FROM events e WHERE e.id = p_event_id;

  WITH entry_rows AS (
    SELECT
      ere.id, ere.first_name, ere.phone_e164, ere.consent_version,
      ere.session_id, ere.created_at, ere.deleted_at,
      ere.ineligible_reason, ere.ineligible_notes, ere.ineligible_at, ere.ineligible_by,
      ere.eligibility_override, ere.eligibility_override_at,
      ere.eligibility_override_by, ere.eligibility_override_reason,
      CASE
        WHEN v_series_key IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM event_raffle_entries prior
          JOIN events e_prior ON e_prior.id = prior.event_id
          WHERE e_prior.series_key = v_series_key
            AND prior.phone_e164 = ere.phone_e164
            AND prior.event_id <> ere.event_id
            AND prior.created_at < ere.created_at
            AND prior.deleted_at IS NULL
        )
      END AS series_repeat
    FROM event_raffle_entries ere
    WHERE ere.event_id = p_event_id
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (
      WHERE deleted_at IS NULL
        AND (ineligible_reason IS NULL OR eligibility_override = true)
    ),
    COUNT(*) FILTER (
      WHERE deleted_at IS NULL
        AND (ineligible_reason IS NULL OR eligibility_override = true)
        AND (NOT series_repeat OR eligibility_override = true)
    ),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                          id,
        'first_name',                  first_name,
        'phone_e164',                  phone_e164,
        'consent_version',             consent_version,
        'session_id',                  session_id,
        'created_at',                  created_at,
        'deleted_at',                  deleted_at,
        'ineligible_reason',           ineligible_reason,
        'ineligible_notes',            ineligible_notes,
        'ineligible_at',               ineligible_at,
        'ineligible_by',               ineligible_by,
        'eligibility_override',        eligibility_override,
        'eligibility_override_at',     eligibility_override_at,
        'eligibility_override_by',     eligibility_override_by,
        'eligibility_override_reason', eligibility_override_reason,
        'series_repeat',               series_repeat
      ) ORDER BY created_at DESC
    ), '[]'::jsonb)
  INTO v_total, v_active, v_eligible, v_first_timer, v_entries
  FROM entry_rows;

  RETURN jsonb_build_object(
    'event_id',          p_event_id,
    'series_key',        v_series_key,
    'total_count',       v_total,
    'active_count',      v_active,
    'eligible_count',    v_eligible,
    'first_timer_count', v_first_timer,
    'entries',           v_entries
  );
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. admin_list_raffle_draws_v1 — surface pick_method
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_raffle_draws_v1(p_event_id uuid)
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                  d.id,
      'drawn_at',            d.drawn_at,
      'drawn_by',            d.drawn_by,
      'drawn_by_email',      u.email,
      'winner_entry_id',     d.winner_entry_id,
      'winner_first_name',   e.first_name,
      'is_active',           d.is_active,
      'prior_draw_id',       d.prior_draw_id,
      'pick_method',         d.pick_method,
      'reason',              d.reason
    ) ORDER BY d.drawn_at DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM event_raffle_draws d
  LEFT JOIN event_raffle_entries e ON e.id = d.winner_entry_id
  LEFT JOIN auth.users u ON u.id = d.drawn_by
  WHERE d.event_id = p_event_id;

  RETURN v_result;
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_event_raffle — my_status_code respects eligibility_override
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Single-line patch: when an entry has eligibility_override=true, the
-- per-session my_status returns 'eligible' regardless of ineligible_reason.
-- Mirrors the draw RPC's override semantics on the read side.
-- =============================================================================

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

  IF v_event_start IS NOT NULL AND v_cutoff_offset_mins IS NOT NULL THEN
    v_cutoff_dt     := v_event_start - make_interval(mins => v_cutoff_offset_mins);
    v_cutoff_time   := to_char(v_cutoff_dt AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'), 'HH24:MI');
    v_cutoff_passed := (now() >= v_cutoff_dt);
  END IF;

  IF v_has_preset AND v_event_start IS NOT NULL THEN
    v_draw_date := to_char((v_event_start AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'))::date, 'YYYY-MM-DD');
  END IF;

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

  IF p_session_id IS NOT NULL THEN
    SELECT id, ineligible_reason, eligibility_override, deleted_at
      INTO v_my_entry
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
      ELSIF v_my_entry.ineligible_reason IS NOT NULL
            AND COALESCE(v_my_entry.eligibility_override, false) = false THEN
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


COMMIT;

NOTIFY pgrst, 'reload schema';
