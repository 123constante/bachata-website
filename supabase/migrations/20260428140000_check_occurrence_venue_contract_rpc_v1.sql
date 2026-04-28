-- =============================================================================
-- check_occurrence_venue_contract_v1
-- Date: 2026-04-28
--
-- Health-check RPC for the calendar_occurrences venue/city override contract
-- introduced in 20260428120000_occurrence_venue_drift_fix_v1.
--
-- Returns a JSON status indicating whether the contract is in force
-- (trigger present + check constraint present + old propagation trigger
-- absent + zero contract violations in the data). Aggregate-only — never
-- returns row-level data, so safe to expose via anon role.
--
-- Consumed by .github/workflows/db-contract-check.yml via
-- scripts/check-venue-contract.mjs. Runs on every push/PR and daily at
-- 06:00 UTC. Catches operator error from outside the app (e.g. raw SQL
-- admin work) that could re-introduce the venue-drift bug.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_occurrence_venue_contract_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_total           int;
  v_violations      int;
  v_trigger_present bool;
  v_check_present   bool;
  v_old_trig_gone   bool;
  v_errors          jsonb := '[]'::jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.calendar_occurrences;

  SELECT COUNT(*) INTO v_violations
  FROM public.calendar_occurrences
  WHERE COALESCE(is_override, false) = false
    AND (venue_id IS NOT NULL OR city_id IS NOT NULL OR city_slug IS NOT NULL);

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.calendar_occurrences'::regclass
      AND tgname = 'trg_coerce_occurrence_venue_default'
      AND tgenabled <> 'D'
  ) INTO v_trigger_present;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.calendar_occurrences'::regclass
      AND conname = 'calendar_occurrences_venue_requires_override'
  ) INTO v_check_present;

  SELECT NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.events'::regclass
      AND tgname = 'trg_propagate_event_venue'
  ) INTO v_old_trig_gone;

  IF v_violations > 0 THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'CONTRACT_VIOLATIONS',
      'message', format('%s row(s) have venue/city set with is_override=false', v_violations)
    ));
  END IF;

  IF NOT v_trigger_present THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'TRIGGER_MISSING',
      'message', 'trg_coerce_occurrence_venue_default is missing or disabled'
    ));
  END IF;

  IF NOT v_check_present THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'CHECK_MISSING',
      'message', 'calendar_occurrences_venue_requires_override constraint is missing'
    ));
  END IF;

  IF NOT v_old_trig_gone THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'code', 'STALE_TRIGGER_PRESENT',
      'message', 'old trg_propagate_event_venue is back; this conflicts with the new contract'
    ));
  END IF;

  RETURN jsonb_build_object(
    'ok',                jsonb_array_length(v_errors) = 0,
    'total_occurrences', v_total,
    'violations',        v_violations,
    'trigger_present',   v_trigger_present,
    'check_present',     v_check_present,
    'old_trigger_gone',  v_old_trig_gone,
    'errors',            v_errors,
    'checked_at',        now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_occurrence_venue_contract_v1() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
