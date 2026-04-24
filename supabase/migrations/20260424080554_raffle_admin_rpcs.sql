BEGIN;

-- Forward-add entries_snapshot for audit-pure draw history.
ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS entries_snapshot jsonb;

-- Forward-add drawn_by for audit-trail actor attribution. FK to auth.users
-- so admin user deletion doesn't cascade away the draw history.
ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS drawn_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────
-- admin_draw_raffle_winner_v1 — manual draw with re-draw audit chain
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winner_v1(
  p_event_id uuid,
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
     AND ere.deleted_at IS NULL;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  -- Pick winner. ORDER BY random() LIMIT 1 — adequate for Phase 1 volumes.
  -- Audit integrity comes from the snapshot + chain, not RNG strength.
  SELECT id INTO v_winner_id
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL
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
    drawn_by
  ) VALUES (
    p_event_id,
    v_existing_draw.id,
    true,
    now(),
    v_winner_id,
    v_snapshot,
    v_actor_id
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
$$;

REVOKE ALL ON FUNCTION public.admin_draw_raffle_winner_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_draw_raffle_winner_v1(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- admin_list_raffle_entries_v1 — admin entries view
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_raffle_entries_v1(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_entries jsonb;
  v_total   int;
  v_active  int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE deleted_at IS NULL)
    INTO v_total, v_active
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
      'deleted_at',      ere.deleted_at
    ) ORDER BY ere.created_at DESC
  ), '[]'::jsonb)
  INTO v_entries
  FROM event_raffle_entries ere
  WHERE ere.event_id = p_event_id;

  RETURN jsonb_build_object(
    'event_id',     p_event_id,
    'total_count',  v_total,
    'active_count', v_active,
    'entries',      v_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_raffle_entries_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_raffle_entries_v1(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
