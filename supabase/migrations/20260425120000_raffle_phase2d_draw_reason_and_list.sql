-- ============================================================================
-- Raffle Phase 2D — persist re-draw reason + admin_list_raffle_draws_v1
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 12:00:00 so it
-- orders after the Phase 2C eligibility migration (20260425000000).
--
-- Changes:
--   1. ALTER event_raffle_draws ADD COLUMN reason text
--      Nullable; existing rows stay NULL. The UI renders "—" for any draw
--      that doesn't carry a reason (either the initial draw or pre-audit
--      re-draws from before this column existed).
--
--   2. CREATE OR REPLACE admin_draw_raffle_winner_v1
--      Minimal patch to the Phase 2C body (read via pg_get_functiondef):
--      the INSERT now stores p_reason on the new draw. All other behaviour
--      is preserved byte-identically — same guards, same snapshot logic,
--      same error envelopes, same response shape.
--
--   3. CREATE FUNCTION admin_list_raffle_draws_v1(p_event_id uuid)
--      Returns draws for the event, ordered drawn_at DESC, with
--      winner_first_name joined from event_raffle_entries and drawn_by_email
--      joined from auth.users. Admin-only (same is_admin() guard as the
--      other admin_*_v1 RPCs in this codebase).
--
-- Apply manually in the Supabase SQL editor. Do NOT run `supabase db push`.
-- Mirror byte-identically to both repos (admin + Website) with SHA256
-- verified before apply, per workflow rules.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Persist re-draw reason
-- ─────────────────────────────────────────────────────────────────────────────
-- Safe to run on a live table: column is nullable with no default, so no
-- row rewrite. No backfill; existing draws surface as reason IS NULL.

ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS reason text NULL;

COMMENT ON COLUMN public.event_raffle_draws.reason IS
  'Reason text supplied when this draw was created (only populated on re-draws). NULL on the first draw for an event. Required (>=3 chars) by admin_draw_raffle_winner_v1 when a prior active draw exists.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Patch admin_draw_raffle_winner_v1 — persist p_reason in the INSERT
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit-first: this body was read from pg_proc on 2026-04-24 before editing.
-- Only the INSERT column list and VALUES tuple changed (reason added). All
-- other behaviour is unchanged.

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
    claimed_at,
    reason
  ) VALUES (
    p_event_id,
    v_existing_draw.id,
    true,
    now(),
    v_winner_id,
    v_snapshot,
    v_actor_id,
    now(),
    CASE WHEN p_reason IS NULL OR length(trim(p_reason)) = 0 THEN NULL ELSE trim(p_reason) END
  )
  RETURNING * INTO v_new_draw;

  RETURN jsonb_build_object(
    'ok',                true,
    'draw_id',           v_new_draw.id,
    'winner_entry_id',   v_winner_id,
    'entry_count',       v_entry_count,
    'is_redraw',         v_existing_draw.id IS NOT NULL,
    'prior_draw_id',     v_existing_draw.id,
    'reason',            v_new_draw.reason,
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_list_raffle_draws_v1 — history list source
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns a jsonb array. Each row has the draw identity, who drew it
-- (uuid + email from auth.users), the winner's first name joined from
-- event_raffle_entries, the active/demoted flag, the prior_draw_id chain
-- pointer, and the reason this draw itself was created with. Ordered
-- drawn_at DESC so the most recent event-level draw sits on top.
--
-- Admin-only via is_admin() — the same guard every other admin_*_v1 RPC
-- in this codebase uses. Email and reason may be NULL for legacy rows.

CREATE OR REPLACE FUNCTION public.admin_list_raffle_draws_v1(p_event_id uuid)
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
      'id',                  d.id,
      'drawn_at',            d.drawn_at,
      'drawn_by',            d.drawn_by,
      'drawn_by_email',      u.email,
      'winner_entry_id',     d.winner_entry_id,
      'winner_first_name',   e.first_name,
      'is_active',           d.is_active,
      'prior_draw_id',       d.prior_draw_id,
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
-- 4. Grants — mirror existing admin-RPC pattern
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.admin_list_raffle_draws_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_raffle_draws_v1(uuid) TO authenticated;

-- admin_draw_raffle_winner_v1 grants were set by Phase 1 and are unchanged.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Schema reload
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
