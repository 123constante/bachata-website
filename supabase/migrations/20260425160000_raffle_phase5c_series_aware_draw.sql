-- ============================================================================
-- Raffle Phase 5C — series-aware winner draw
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 16:00:00 so it orders
-- after Phase 5B (20260425150000).
--
-- Changes admin_draw_raffle_winner_v1 to implement the "first-timer prize"
-- policy at draw time:
--
--   * The random winner pick is restricted to entries that are NOT
--     series_repeat (i.e. not previously-entered the same series_key).
--   * Standalone events (events.series_key IS NULL) behave exactly as before —
--     no series filter, every eligible entry is in the pool.
--   * Snapshot still captures the FULL eligible pool for audit (not the
--     filtered winner pool), and each snapshot entry now carries a
--     series_repeat boolean so the audit trail records which entries were
--     silently excluded.
--   * A new structured reason 'no_first_timers' is returned when there are
--     eligible entries but ALL are series repeats. UI shows a helpful message
--     ("Everyone entering this week has already entered the series. Nothing
--     to pick fairly — add a new dancer or loosen the rule.").
--
-- The series_repeat EXISTS subquery is duplicated between the snapshot/count
-- CTE and the winner-pick SELECT on purpose: keeping them as two independent
-- queries lets the winner-pick use an index scan + ORDER BY random() LIMIT 1,
-- while the CTE aggregates. Duplicated logic, identical semantics.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winner_v1(p_event_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id         uuid;
  v_series_key       text;
  v_existing_draw    record;
  v_snapshot         jsonb;
  v_entry_count      int;   -- raw eligible (pre series filter)
  v_first_timer      int;   -- after series filter — actual winner pool size
  v_winner_id        uuid;
  v_new_draw         record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  -- Validate event + fetch series_key in one round-trip.
  SELECT e.series_key INTO v_series_key
    FROM events e
   WHERE e.id = p_event_id;

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

  -- Snapshot + counts: compute series_repeat per row, aggregate both into
  -- the jsonb snapshot and the two count variables.
  --
  -- Same-transaction MVCC guarantee: any concurrent insert either commits
  -- before this read (included in both snapshot and winner pick) or after
  -- (excluded from both). The snapshot is authoritative for audit of who
  -- was in the pool at draw time.
  WITH eligible_entries AS (
    SELECT
      ere.id,
      ere.first_name,
      ere.phone_e164,
      ere.created_at,
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
      AND ere.ineligible_reason IS NULL
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',             id,
        'first_name',     first_name,
        'phone_e164',     phone_e164,
        'created_at',     created_at,
        'series_repeat',  series_repeat
      ) ORDER BY created_at
    ), '[]'::jsonb),
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT series_repeat)
  INTO v_snapshot, v_entry_count, v_first_timer
  FROM eligible_entries;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  IF v_first_timer = 0 THEN
    -- Eligible entries exist, but every one of them has already entered
    -- this series before. Fail structured so the UI can nudge the admin
    -- ("everyone here already entered the series this rule blocks") rather
    -- than generic "no entries".
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no_first_timers',
      'entry_count', v_entry_count,
      'series_key', v_series_key
    );
  END IF;

  -- Pick winner from the first-timer pool. The WHERE clause mirrors the
  -- snapshot's series_repeat=false filter; v_series_key short-circuits for
  -- standalone events. ORDER BY random() LIMIT 1 — adequate for Phase 1
  -- volumes. Audit integrity comes from the snapshot, not RNG strength.
  SELECT ere.id INTO v_winner_id
    FROM event_raffle_entries ere
   WHERE ere.event_id = p_event_id
     AND ere.deleted_at IS NULL
     AND ere.ineligible_reason IS NULL
     AND (
       v_series_key IS NULL
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
    'first_timer_count', v_first_timer,
    'series_key',        v_series_key,
    'is_redraw',         v_existing_draw.id IS NOT NULL,
    'prior_draw_id',     v_existing_draw.id,
    'reason',            v_new_draw.reason,
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
