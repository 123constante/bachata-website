-- ============================================================================
-- Raffle Phase 5E — public get_event_raffle gains my_status + alternate_event
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 18:00:00 so it orders
-- after Phase 5D (20260425170000).
--
-- Extends the public get_event_raffle(p_event_id) RPC to accept an optional
-- session_id. When provided, the response adds:
--
--   my_status: {
--     entered: boolean,              -- a live (non-soft-deleted) entry exists
--                                       for this session on this event
--     status:  'none'                -- no entry from this session
--            | 'eligible'            -- entered, not manually excluded, not winner
--                                       (silent series-repeat stays 'eligible' —
--                                        we NEVER surface it at the public layer)
--            | 'admin_excluded'      -- admin set ineligible_reason on this entry
--            | 'already_won'         -- this entry was selected as the active
--                                       winner of a current draw on THIS event
--     alternate_event: { event_id, name, slug, start_at, prize_text } | null
--   }
--
-- alternate_event is only populated when status is 'admin_excluded' or
-- 'already_won' — the two cases where the UI wants to redirect the user to
-- somewhere they can still participate. The lookup picks the next upcoming
-- published event with has_raffle=true AND a different series_key from the
-- current event. When the current event is standalone (series_key IS NULL),
-- we still avoid re-suggesting it (filtered by event_id <> current).
--
-- The argument list changes (added p_session_id uuid DEFAULT NULL). Callers
-- that still pass only p_event_id work unchanged — default kicks in and
-- my_status is omitted from the response (keeping the existing envelope
-- intact for cold loads before the Website ships the new wiring).
-- ============================================================================

BEGIN;

-- Drop the single-arg version first so the new 2-arg version is unambiguous.
-- CREATE OR REPLACE only replaces in-place when the argument signature matches
-- byte-identically; adding a parameter is treated as a different function.
DROP FUNCTION IF EXISTS public.get_event_raffle(uuid);

CREATE FUNCTION public.get_event_raffle(
  p_event_id uuid,
  p_session_id uuid DEFAULT NULL
)
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
  v_series_key     text;
  v_cutoff_time    text;
  v_cutoff_dt      timestamptz;
  v_cutoff_passed  boolean := false;
  v_active_draw    record;
  v_winner         record;
  v_winner_display jsonb := NULL;
  v_my_entry       record;
  v_my_status_code text;
  v_my_entered     boolean := false;
  v_alt_event      jsonb := NULL;
  v_my_status      jsonb := NULL;
BEGIN
  SELECT has_raffle, meta_data, start_time, timezone, series_key
    INTO v_enabled, v_meta, v_event_start, v_event_tz, v_series_key
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

  -- Phase 5E — per-session status.
  -- Only runs when the client supplied a session_id. Without one, my_status
  -- is omitted from the response (existing callers unchanged).
  IF p_session_id IS NOT NULL THEN
    -- Find this session's most recent entry for this event. session_id is
    -- not unique (theoretically a session could retry), so take the latest
    -- non-deleted row.
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
      IF v_active_draw.id IS NOT NULL
         AND v_active_draw.winner_entry_id = v_my_entry.id THEN
        v_my_status_code := 'already_won';
      ELSIF v_my_entry.ineligible_reason IS NOT NULL THEN
        -- Visible tier — admin explicitly marked this entry ineligible.
        -- Silent series-repeat stays 'eligible' here on purpose: never
        -- surface automatic fairness rules to individual dancers.
        v_my_status_code := 'admin_excluded';
      ELSE
        v_my_status_code := 'eligible';
      END IF;
    END IF;

    -- Alternate event suggestion — only for states that redirect the user.
    IF v_my_status_code IN ('admin_excluded', 'already_won') THEN
      SELECT jsonb_build_object(
        'event_id',    e.id,
        'name',        e.name,
        'slug',        e.city_slug,         -- city_slug is what the website URL uses
        'start_at',    e.start_time,
        'prize_text',  e.meta_data->'raffle'->>'prize_text'
      )
      INTO v_alt_event
      FROM events e
      WHERE e.id <> p_event_id
        AND e.has_raffle = true
        AND e.lifecycle_status = 'published'
        AND e.start_time > now()
        AND (
          v_series_key IS NULL
          OR e.series_key IS NULL
          OR e.series_key <> v_series_key
        )
      ORDER BY e.start_time ASC
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
    'entry_count',     v_entry_count,
    'prize_text',      v_raffle_cfg->>'prize_text',
    'draw_date',       v_raffle_cfg->>'draw_date',
    'cutoff_time',     v_cutoff_time,
    'cutoff_passed',   v_cutoff_passed,
    'consent_version', v_raffle_cfg->>'consent_version',
    'winner_display',  v_winner_display,
    'my_status',       v_my_status
  );
END;
$function$;

-- Preserve anon + authenticated access (public function — dancers are anon).
REVOKE ALL ON FUNCTION public.get_event_raffle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_raffle(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
