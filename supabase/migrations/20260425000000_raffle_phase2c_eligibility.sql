-- =============================================================================
-- Raffle Phase 2C — per-entry eligibility management + raffle events list RPC
-- -----------------------------------------------------------------------------
-- Six changes in one carefully-ordered migration.
--
--   1. Schema: 4 nullable columns on event_raffle_entries
--        ineligible_reason text   (NULL = eligible; non-NULL = excluded)
--        ineligible_notes  text
--        ineligible_at     timestamptz
--        ineligible_by     uuid REFERENCES auth.users(id)
--      No DB-side CHECK on the reason text — UI enforces the preset dropdown
--      (won_before | collected_in_person | other) and callers of the mark RPC
--      below are the only intended write path.
--
--   2. admin_draw_raffle_winner_v1 — patched
--      Two WHERE-clause additions. Both the pre-draw SNAPSHOT query and the
--      winner-pick SELECT now exclude rows where ineligible_reason IS NOT NULL.
--      entries_snapshot therefore reflects the exact draw pool at draw time.
--      Everything else byte-identical to pg_get_functiondef (live 2026-04-24).
--
--   3. admin_list_raffle_entries_v1 — patched
--      DECLARE gains v_eligible int; the 2-count SELECT grows a third FILTER;
--      each entry's jsonb_build_object exposes the 4 ineligible_* fields; the
--      return object adds eligible_count alongside the existing total_count /
--      active_count (backward-compat: active_count still means "deleted_at
--      IS NULL"; eligible_count is the new draw-pool size).
--      Everything else byte-identical to pg_get_functiondef (live 2026-04-24).
--
--   4. admin_mark_raffle_entry_ineligible_v1 — new
--      Admin-only. Sets the 4 columns with auth.uid() as ineligible_by.
--      Validates preset reason codes. Blocks if the entry is the active
--      winner of a current draw (instructs caller to re-draw first).
--
--   5. admin_mark_raffle_entry_eligible_v1 — new
--      Admin-only. Restores eligibility by NULLing all four columns.
--      Returns 'already_eligible' if the row wasn't marked ineligible.
--
--   6. admin_list_raffle_events_v1 — new
--      Admin-only. One row per event with has_raffle = true. active_entry_count
--      uses the draw-pool filter (deleted_at IS NULL AND ineligible_reason
--      IS NULL). cutoff_passed is safely computed with a regex-validated cast
--      so malformed meta_data.raffle.cutoff_time values never raise.
--      Event slug is NOT returned — callers slugify event.name client-side for
--      CSV filenames.
--
-- Not touched in this commit:
--   - submit_raffle_entry, get_event_raffle, sync_raffle_flag trigger
--   - admin_save_event_v2_impl, admin_get_event_snapshot_v2
--   - event_raffle_draws table, guest list RPCs
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema: per-entry eligibility columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.event_raffle_entries
  ADD COLUMN IF NOT EXISTS ineligible_reason text,
  ADD COLUMN IF NOT EXISTS ineligible_notes  text,
  ADD COLUMN IF NOT EXISTS ineligible_at     timestamptz,
  ADD COLUMN IF NOT EXISTS ineligible_by     uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.event_raffle_entries.ineligible_reason IS
  'NULL = eligible for draw. Non-NULL values flag the entry as excluded from '
  'the draw pool. Admin UI uses preset codes (won_before, collected_in_person, '
  'other) but the column is free-form text — no DB-side CHECK.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_draw_raffle_winner_v1 — snapshot + winner-pick exclude ineligibles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winner_v1(p_event_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id      uuid;
  v_existing_draw record;
  v_snapshot      jsonb;
  v_entry_count   int;
  v_winner_id     uuid;
  v_new_draw      record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
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

  -- Snapshot live entries (excludes soft-deleted) into jsonb array.
  -- Same-transaction MVCC: any concurrent insert either commits before
  -- this read (included) or after (excluded). Snapshot and winner pick
  -- below see the same row set.
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          ere.id,
        'first_name',  ere.first_name,
        'phone_e164',  ere.phone_e164,
        'created_at',  ere.created_at
      ) ORDER BY ere.created_at
    ), '[]'::jsonb),
    COUNT(*)
    INTO v_snapshot, v_entry_count
    FROM event_raffle_entries ere
   WHERE ere.event_id = p_event_id
     AND ere.deleted_at IS NULL
     AND ere.ineligible_reason IS NULL;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  -- Pick winner. ORDER BY random() LIMIT 1 — adequate for Phase 1 volumes.
  -- Audit integrity comes from the snapshot + chain, not RNG strength.
  SELECT id INTO v_winner_id
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL AND ineligible_reason IS NULL
   ORDER BY random()
   LIMIT 1;

  -- Demote existing active draw before insert. The partial unique index
  -- uq_event_raffle_draws_one_active_per_event enforces at-most-one
  -- is_active=true per event_id. UPDATE-then-INSERT order is load-bearing:
  -- reordering would fire unique_violation before FK evaluation.
  IF v_existing_draw.id IS NOT NULL THEN
    UPDATE event_raffle_draws
       SET is_active = false
     WHERE id = v_existing_draw.id;
  END IF;

  INSERT INTO event_raffle_draws (
    event_id,
    prior_draw_id,
    is_active,
    drawn_at,
    winner_entry_id,
    entries_snapshot,
    drawn_by,
    claimed_at
  ) VALUES (
    p_event_id,
    v_existing_draw.id,
    true,
    now(),
    v_winner_id,
    v_snapshot,
    v_actor_id,
    now()
  )
  RETURNING * INTO v_new_draw;

  RETURN jsonb_build_object(
    'ok',                true,
    'draw_id',           v_new_draw.id,
    'winner_entry_id',   v_winner_id,
    'entry_count',       v_entry_count,
    'is_redraw',         v_existing_draw.id IS NOT NULL,
    'prior_draw_id',     v_existing_draw.id,
    'reason',            p_reason,
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_list_raffle_entries_v1 — expose eligibility fields + eligible_count
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_raffle_entries_v1(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entries jsonb;
  v_total   int;
  v_active  int;
  v_eligible int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND ineligible_reason IS NULL)
    INTO v_total, v_active, v_eligible
    FROM event_raffle_entries
   WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',              ere.id,
      'first_name',      ere.first_name,
      'phone_e164',      ere.phone_e164,
      'consent_version', ere.consent_version,
      'session_id',      ere.session_id,
      'created_at',      ere.created_at,
      'deleted_at',      ere.deleted_at,
      'ineligible_reason', ere.ineligible_reason,
      'ineligible_notes',  ere.ineligible_notes,
      'ineligible_at',     ere.ineligible_at,
      'ineligible_by',     ere.ineligible_by
    ) ORDER BY ere.created_at DESC
  ), '[]'::jsonb)
  INTO v_entries
  FROM event_raffle_entries ere
  WHERE ere.event_id = p_event_id;

  RETURN jsonb_build_object(
    'event_id',       p_event_id,
    'total_count',    v_total,
    'active_count',   v_active,
    'eligible_count', v_eligible,
    'entries',        v_entries
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_mark_raffle_entry_ineligible_v1 — flag row as excluded
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_mark_raffle_entry_ineligible_v1(
  p_entry_id uuid,
  p_reason   text,
  p_notes    text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entry            record;
  v_is_active_winner boolean;
  v_now              timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) NOT IN ('won_before', 'collected_in_person', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reason');
  END IF;

  SELECT * INTO v_entry FROM event_raffle_entries WHERE id = p_entry_id;
  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_raffle_draws
     WHERE winner_entry_id = p_entry_id
       AND is_active = true
  ) INTO v_is_active_winner;

  IF v_is_active_winner THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'entry_is_active_winner',
      'hint', 'Re-draw first, then mark ineligible'
    );
  END IF;

  UPDATE event_raffle_entries
     SET ineligible_reason = p_reason,
         ineligible_notes  = NULLIF(trim(p_notes), ''),
         ineligible_at     = v_now,
         ineligible_by     = auth.uid()
   WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', p_entry_id,
    'ineligible_reason', p_reason,
    'ineligible_at', v_now
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_mark_raffle_entry_eligible_v1 — restore eligibility
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_mark_raffle_entry_eligible_v1(
  p_entry_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entry record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_entry FROM event_raffle_entries WHERE id = p_entry_id;
  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_entry.ineligible_reason IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_eligible');
  END IF;

  UPDATE event_raffle_entries
     SET ineligible_reason = NULL,
         ineligible_notes  = NULL,
         ineligible_at     = NULL,
         ineligible_by     = NULL
   WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', p_entry_id
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. admin_list_raffle_events_v1 — picker-table source
-- ─────────────────────────────────────────────────────────────────────────────
-- active_entry_count = draw-pool size (not deleted AND not ineligible).
-- cutoff_passed: regex-validated HH:MM[:SS] before the ::timestamp cast so
-- malformed cutoff_time values never raise. Fails closed to false on any
-- missing/invalid input (mirrors get_event_raffle's fail-open semantics for
-- cutoff — a bad cutoff never locks admins out of the picker).

CREATE OR REPLACE FUNCTION public.admin_list_raffle_events_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
      'event_id',                  e.id,
      'name',                      e.name,
      'start_at',                  e.start_time,
      'timezone',                  e.timezone,
      'prize_text',                e.meta_data->'raffle'->>'prize_text',
      'draw_date',                 e.meta_data->'raffle'->>'draw_date',
      'cutoff_time',               e.meta_data->'raffle'->>'cutoff_time',
      'cutoff_passed', (
        CASE
          WHEN (e.meta_data->'raffle'->>'cutoff_time') IS NULL
            OR (e.meta_data->'raffle'->>'cutoff_time') = ''
            OR e.start_time IS NULL
            OR (e.meta_data->'raffle'->>'cutoff_time') !~ '^\d{2}:\d{2}(:\d{2})?$'
          THEN false
          ELSE (now() >= (
            (e.start_time AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))::date
            || ' ' || (e.meta_data->'raffle'->>'cutoff_time')
          )::timestamp AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))
        END
      ),
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
  WHERE e.has_raffle = true;

  RETURN v_result;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Grants — mirror existing admin-RPC pattern (REVOKE PUBLIC, GRANT authenticated)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.admin_mark_raffle_entry_ineligible_v1(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_raffle_entry_ineligible_v1(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_mark_raffle_entry_eligible_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_raffle_entry_eligible_v1(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_raffle_events_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_raffle_events_v1() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
