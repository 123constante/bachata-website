-- =============================================================================
-- Raffle Phase 2B — get_event_raffle strips phone_last4 and is_18_plus
-- -----------------------------------------------------------------------------
-- Two line-level changes to the live pg_proc body for public.get_event_raffle.
-- Both align the RPC with Phase 2A.1 admin-UI simplifications and tighten the
-- public response's PII posture.
--
--   1. phone_last4 removed from the v_winner_display jsonb_build_object.
--      Reason: phone numbers — even the last four digits — are PII and must
--      not be exposed to unauthenticated public callers of the event page.
--      The winner display is now { first_name, drawn_at } only.
--
--   2. is_18_plus removed from the final RETURN jsonb_build_object.
--      Reason: the is_18_plus config field was dropped from the raffle admin
--      UI in Phase 2A.1. With no admin write path, the RPC must stop exposing
--      a key that can no longer be trusted to reflect organiser intent. Any
--      existing meta_data.raffle.is_18_plus values in events.meta_data are
--      left untouched (they are simply not read or surfaced anymore); a
--      future cleanup can scrub them if desired.
--
-- Body below is copied verbatim from pg_get_functiondef as read from live
-- pg_proc on 2026-04-24. Only the two approved line deletions differ from
-- live. No whitespace, quote-style, or delimiter drift. $function$ delimiters
-- preserved as pg_proc emits them.
--
-- Not touched in this commit:
--   - submit_raffle_entry, admin_draw_raffle_winner_v1, admin_list_raffle_entries_v1
--   - sync_raffle_flag trigger, event_raffle_entries / event_raffle_draws tables
--   - guest list code, admin_save_event_v2_impl, admin_get_event_snapshot_v2
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_event_raffle(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        'drawn_at',    v_active_draw.drawn_at
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled',         true,
    'entry_count',     v_entry_count,
    'prize_text',      v_raffle_cfg->>'prize_text',
    'draw_date',       v_raffle_cfg->>'draw_date',
    'cutoff_time',     v_cutoff_time,
    'cutoff_passed',   v_cutoff_passed,
    'consent_version', v_raffle_cfg->>'consent_version',
    'winner_display',  v_winner_display
  );
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
