BEGIN;

-- Forward-add winner_entry_id so the get_event_raffle winner_display branch
-- can reference it today. Commit 5 (admin_draw_raffle_winner_v1) will be the
-- writer; Phase 1 readers see NULL everywhere until then.
--
-- FK ON DELETE SET NULL mirrors prior_draw_id's pattern — deleting an entry
-- must not cascade-delete draw history (audit trail), but the pointer should
-- fall to NULL so the winner_display branch short-circuits cleanly.
ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS winner_entry_id uuid
    REFERENCES public.event_raffle_entries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_event_raffle(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_enabled        boolean;
  v_meta           jsonb;
  v_raffle_cfg     jsonb;
  v_entry_count    int;
  v_event_start    timestamptz;
  v_event_tz       text;
  v_cutoff_time    text;
  v_cutoff_dt      timestamptz;
  v_cutoff_passed  boolean := false;
  v_active_draw    record;
  v_winner         record;
  v_winner_display jsonb := NULL;
BEGIN
  SELECT has_raffle, meta_data, start_time, timezone
    INTO v_enabled, v_meta, v_event_start, v_event_tz
    FROM events
   WHERE id = p_event_id AND lifecycle_status = 'published';

  IF v_enabled IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'event_not_found');
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  v_raffle_cfg := COALESCE(v_meta->'raffle', '{}'::jsonb);

  SELECT COUNT(*) INTO v_entry_count
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL;

  v_cutoff_time := v_raffle_cfg->>'cutoff_time';
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

  -- Winner display: gated on draw existing AND organiser opting in to public display.
  -- Partial UNIQUE index on event_raffle_draws guarantees at most one active draw per event.
  SELECT * INTO v_active_draw
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true
   LIMIT 1;

  IF v_active_draw.id IS NOT NULL
     AND COALESCE((v_raffle_cfg->>'show_winner_publicly')::boolean, false) = true THEN

    SELECT first_name, phone_e164 INTO v_winner
      FROM event_raffle_entries
     WHERE id = v_active_draw.winner_entry_id;

    IF v_winner.first_name IS NOT NULL THEN
      v_winner_display := jsonb_build_object(
        'first_name',  v_winner.first_name,
        'phone_last4', right(v_winner.phone_e164, 4),
        'drawn_at',    v_active_draw.drawn_at
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled',         true,
    'entry_count',     v_entry_count,
    'prize_text',      v_raffle_cfg->>'prize_text',
    'draw_date',       v_raffle_cfg->>'draw_date',
    'is_18_plus',      COALESCE((v_raffle_cfg->>'is_18_plus')::boolean, false),
    'cutoff_time',     v_cutoff_time,
    'cutoff_passed',   v_cutoff_passed,
    'consent_version', v_raffle_cfg->>'consent_version',
    'winner_display',  v_winner_display
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_raffle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_raffle(uuid) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
