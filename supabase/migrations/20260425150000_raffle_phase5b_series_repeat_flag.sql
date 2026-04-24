-- ============================================================================
-- Raffle Phase 5B — series_repeat flag on entries + first_timer_count summary
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 15:00:00 so it orders
-- after Phase 5A.1 (20260425140000).
--
-- Changes admin_list_raffle_entries_v1 to compute, per entry, whether the
-- phone number has already entered *any earlier event sharing this event's
-- series_key*. This is the silent-exclusion signal for Ricky's first-timer
-- prize policy:
--   - series_key IS NULL on this event        → series_repeat always false
--                                               (standalone events don't
--                                                participate in series
--                                                fairness).
--   - series_key IS NOT NULL                  → true iff the same phone
--                                                appears in a prior entry
--                                                (earlier created_at, not
--                                                soft-deleted) for a different
--                                                event with the same
--                                                series_key.
--
-- Also adds first_timer_count to the summary counts — eligible entries that
-- are NOT series_repeat, i.e. the actual draw pool size once series fairness
-- is applied. The admin entries table uses this to drive the "X first-timers
-- / Y eligible / Z total" summary and, in Phase 5C, the draw pool filter.
--
-- Returns include new top-level `series_key` so the client can branch UI
-- ("this event isn't in a series, so the series_repeat flag is meaningless").
--
-- Soft-deleted prior entries are skipped (they've been editorially withdrawn
-- by admin). Ineligible prior entries DO count (the dancer still entered —
-- admin exclusion is orthogonal to attendance-proxy history).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_list_raffle_entries_v1(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  -- Fetch the event's series_key up front so the per-entry subquery can use
  -- it without re-joining. NULL is fine — downstream CASE short-circuits.
  SELECT e.series_key INTO v_series_key
    FROM events e
   WHERE e.id = p_event_id;

  -- Build the entries list + all four summary counts in a single pass.
  -- Each entry row gets its series_repeat computed inline; the outer SELECT
  -- aggregates it once into both the entries array and the first_timer count.
  WITH entry_rows AS (
    SELECT
      ere.id,
      ere.first_name,
      ere.phone_e164,
      ere.consent_version,
      ere.session_id,
      ere.created_at,
      ere.deleted_at,
      ere.ineligible_reason,
      ere.ineligible_notes,
      ere.ineligible_at,
      ere.ineligible_by,
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
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND ineligible_reason IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND ineligible_reason IS NULL AND NOT series_repeat),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                id,
        'first_name',        first_name,
        'phone_e164',        phone_e164,
        'consent_version',   consent_version,
        'session_id',        session_id,
        'created_at',        created_at,
        'deleted_at',        deleted_at,
        'ineligible_reason', ineligible_reason,
        'ineligible_notes',  ineligible_notes,
        'ineligible_at',     ineligible_at,
        'ineligible_by',     ineligible_by,
        'series_repeat',     series_repeat
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

NOTIFY pgrst, 'reload schema';

COMMIT;
