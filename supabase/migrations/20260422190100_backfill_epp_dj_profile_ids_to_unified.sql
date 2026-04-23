-- =============================================================================
-- Migration: 20260422190100_backfill_epp_dj_profile_ids_to_unified.sql
-- Date:      2026-04-22
-- Purpose:   Rewrite every public.event_program_people row whose profile_type
--            is 'dj' and whose profile_id currently points at a
--            public.dj_profiles row so that it points at the unified
--            public.dancer_profiles row, resolved via the legacy_dj_id
--            back-pointer on public.dj_role_details (populated for every
--            known DJ by migration 20260422190000).
--
-- BACKGROUND
--   Step 1 of this series (20260422190000) unified the last orphan legacy DJ,
--   so public.dj_role_details.legacy_dj_id is now populated for every DJ that
--   has (or ever had) a public.dj_profiles row. That makes a deterministic
--   backfill of the picker-written link table possible in a single UPDATE.
--
--   Per the 2026-04-22 diagnostic:
--     * event_program_people rows with profile_type='dj' with no resolvable
--       target ("orphan DJ links"): 0
--   So the UPDATE below will rewrite the entire cohort whose profile_id is
--   currently a dj_profiles.id via the legacy_dj_id join, and any rows that
--   already point at dancer_profiles.id are left untouched (the join doesn't
--   match them).
--
-- SHAPE
--   UPDATE epp
--   SET    profile_id = dd.person_id
--   FROM   dj_role_details dd
--   WHERE  epp.profile_type = 'dj'
--     AND  epp.profile_id   = dd.legacy_dj_id;
--
--   The join key makes the UPDATE a pure rewrite: every row that matches had a
--   legacy_dj_id source, every row that doesn't match was already unified.
--
-- IDEMPOTENCY
--   After the first successful run, no event_program_people row has
--   profile_id equal to any legacy_dj_id (because the UPDATE just rewrote
--   them all). A second run's UPDATE matches zero rows.
--
-- NOT TOUCHED
--   * event_profile_links — per diagnostic Part D, 0 DJ rows, frozen since
--     2026-04-15 via 202604150004 / 202604150005. Out of scope.
--   * dj_profiles — retained as a deprecated read-only archive (see
--     20260422190000's COMMENT ON TABLE).
-- =============================================================================

BEGIN;

-- ── 1. Preview — how many rows would be affected ─────────────────────────────
DO $$
DECLARE
    v_preview_count integer;
BEGIN
    SELECT count(*)
    INTO   v_preview_count
    FROM   public.event_program_people epp
    JOIN   public.dj_role_details      dd  ON dd.legacy_dj_id = epp.profile_id
    WHERE  epp.profile_type = 'dj';

    RAISE NOTICE 'event_program_people DJ rows matched for remap: %', v_preview_count;
END
$$;

-- ── 2. Remap ─────────────────────────────────────────────────────────────────
UPDATE public.event_program_people AS epp
SET    profile_id = dd.person_id
FROM   public.dj_role_details       AS dd
WHERE  epp.profile_type = 'dj'
  AND  epp.profile_id   = dd.legacy_dj_id;

-- ── 3. Postcheck — log how many dj_profiles-only refs remain ─────────────────
DO $$
DECLARE
    v_remaining_legacy_only integer;
    v_now_unified           integer;
BEGIN
    SELECT count(*) INTO v_remaining_legacy_only
    FROM   public.event_program_people epp
    WHERE  epp.profile_type = 'dj'
      AND  EXISTS      (SELECT 1 FROM public.dj_profiles     dp WHERE dp.id = epp.profile_id)
      AND  NOT EXISTS  (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = epp.profile_id);

    SELECT count(*) INTO v_now_unified
    FROM   public.event_program_people epp
    WHERE  epp.profile_type = 'dj'
      AND  EXISTS (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = epp.profile_id);

    RAISE NOTICE 'Remaining EPP DJ rows still pointing at dj_profiles only: %', v_remaining_legacy_only;
    RAISE NOTICE 'EPP DJ rows now resolving to dancer_profiles: %',             v_now_unified;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (Ricky: run after applying, paste results back)
-- =============================================================================
--
-- V2.1 Confirm legacy-only EPP DJ rows are now zero:
-- SELECT count(*) AS legacy_epp_dj_rows
-- FROM   public.event_program_people epp
-- WHERE  epp.profile_type = 'dj'
--   AND  EXISTS     (SELECT 1 FROM public.dj_profiles     dp WHERE dp.id = epp.profile_id)
--   AND  NOT EXISTS (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = epp.profile_id);
-- -- Expected: 0
--
-- V2.2 Unified EPP DJ rows — should equal pre-migration total DJ link count:
-- SELECT count(*) AS unified_epp_dj_rows
-- FROM   public.event_program_people epp
-- WHERE  epp.profile_type = 'dj'
--   AND  EXISTS (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = epp.profile_id);
--
-- V2.3 Sanity — no EPP DJ row is orphan (resolves to neither table):
-- SELECT count(*) AS orphan_epp_dj_rows
-- FROM   public.event_program_people epp
-- WHERE  epp.profile_type = 'dj'
--   AND  NOT EXISTS (SELECT 1 FROM public.dj_profiles     dp WHERE dp.id = epp.profile_id)
--   AND  NOT EXISTS (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = epp.profile_id);
-- -- Expected: 0
