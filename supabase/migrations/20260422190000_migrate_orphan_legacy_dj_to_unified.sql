-- =============================================================================
-- Migration: 20260422190000_migrate_orphan_legacy_dj_to_unified.sql
-- Date:      2026-04-22
-- Purpose:   Materialise every orphan public.dj_profiles row (no corresponding
--            public.dj_role_details row via legacy_dj_id back-pointer) into the
--            unified person model so the DJ picker (once migrated in steps 3/4)
--            can find every legacy DJ.
--
-- BACKGROUND
--   After the Phase B person-unification, admin_save_person_v1 writes DJs into
--   dancer_profiles + person_roles(role='djing') + dj_role_details and never
--   touches public.dj_profiles. The DJ picker and link RPCs still read from
--   dj_profiles (steps 3/4 of this series migrate those). Per the diagnostic
--   taken 2026-04-22:
--     * dj_profiles:     1 row
--     * dj_role_details: 10 rows, ZERO with legacy_dj_id populated
--     * orphan legacy DJs (dj_profiles ∖ dj_role_details.legacy_dj_id): 1
--   This migration unifies the 1 orphan so the backfill in step 2 becomes
--   deterministic via the legacy_dj_id back-pointer, and so the DJ picker
--   after step 3 surfaces this legacy DJ from the unified read path.
--
-- STRATEGY
--   For every dj_profiles row that has no dj_role_details.legacy_dj_id = dp.id
--   match:
--     1. INSERT public.dancer_profiles with a fresh UUID. Copy minimal
--        identity: first_name, surname, avatar_url (sourced from the legacy
--        dj_profiles.photo_url — see AVATAR COLUMN NOTE below).
--        profile_source = 'migrated_from_dj_orphan' so this cohort is tagged.
--     2. INSERT public.person_roles (person_id, role='djing', is_active=true).
--     3. INSERT public.dj_role_details (person_id, dj_name, legacy_dj_id = the
--        original dj_profiles.id) — this is the back-pointer that makes the
--        step 2 backfill a one-line JOIN.
--   Do NOT dual-write to member_profiles: member_profiles.id is a FK to
--   auth.users.id (per 202602250004_member_profiles_identity.sql) and the
--   orphan legacy DJ row has no auth.users binding. admin_save_person_v1
--   only creates member_profiles rows for claimed persons. Flag in comments
--   and defer — this legacy DJ row is "unclaimed" from the unified model's
--   perspective, same as an admin-created person with claimed_by = NULL.
--
-- AVATAR COLUMN NOTE (deliberate divergence from ticket spec)
--   The ticket spec says "dancer_profiles uses photo_url AND avatar_url".
--   The repo says the opposite — two explicit comments:
--     * 202604140002_migrate_and_drop_legacy_program_tables.sql:22
--         "dancer_profiles : first_name, surname, avatar_url (NOT photo_url)"
--     * 202604140003_admin_search_profiles_v1.sql:157
--         "dp.avatar_url — dancer_profiles uses avatar_url (NOT photo_url)"
--   dancer_profiles therefore has avatar_url only. We copy the legacy
--   dj_profiles.photo_url (scalar text since 202604090009_phase_b_normalize_
--   photo_url_scalar) into dancer_profiles.avatar_url to preserve the visible
--   avatar. The DJ picker after step 3 returns dp.avatar_url for the unified
--   DJ branch. From the caller's perspective the JSON key `avatar_url` in the
--   picker response is identical — only the source column name changes.
--
-- SCHEMA PRECHECK
--   person_roles and dj_role_details have NO migration file in this repo —
--   their schema exists only on live (same pattern as admin_save_person_v1,
--   both listed in ADR-002's Phase D capture backlog). To avoid an obscure
--   INSERT failure if my column-name assumptions are wrong, the migration
--   starts with an information_schema precheck that aborts cleanly with a
--   listable array of missing objects.
--
-- IDEMPOTENCY
--   The outer loop guard is NOT EXISTS(dj_role_details.legacy_dj_id = dp.id).
--   After the first successful run, dj_role_details holds a row with
--   legacy_dj_id set for every formerly-orphan dj_profiles row, so the loop
--   body runs zero times on the second invocation. All INSERTs use WHERE
--   NOT EXISTS or ON CONFLICT DO NOTHING to survive partial re-runs.
--
-- ROLLBACK
--   Manual: DELETE FROM dj_role_details WHERE legacy_dj_id IS NOT NULL
--            AND person_id IN (SELECT id FROM dancer_profiles
--                              WHERE profile_source = 'migrated_from_dj_orphan');
--           DELETE FROM person_roles WHERE person_id IN (...same subquery...);
--           DELETE FROM dancer_profiles WHERE profile_source = 'migrated_from_dj_orphan';
-- =============================================================================

BEGIN;

-- ── 1. Schema precheck — fail early if assumptions are wrong ──────────────────
DO $$
DECLARE
    v_missing text[] := ARRAY[]::text[];
BEGIN
    -- Tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'person_roles') THEN
        v_missing := array_append(v_missing, 'public.person_roles (table)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'dj_role_details') THEN
        v_missing := array_append(v_missing, 'public.dj_role_details (table)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'dancer_profiles') THEN
        v_missing := array_append(v_missing, 'public.dancer_profiles (table)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'dj_profiles') THEN
        v_missing := array_append(v_missing, 'public.dj_profiles (table)');
    END IF;

    -- person_roles columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'person_roles'
                     AND column_name = 'person_id') THEN
        v_missing := array_append(v_missing, 'public.person_roles.person_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'person_roles'
                     AND column_name = 'role') THEN
        v_missing := array_append(v_missing, 'public.person_roles.role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'person_roles'
                     AND column_name = 'is_active') THEN
        v_missing := array_append(v_missing, 'public.person_roles.is_active');
    END IF;

    -- dj_role_details columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dj_role_details'
                     AND column_name = 'person_id') THEN
        v_missing := array_append(v_missing, 'public.dj_role_details.person_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dj_role_details'
                     AND column_name = 'dj_name') THEN
        v_missing := array_append(v_missing, 'public.dj_role_details.dj_name');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dj_role_details'
                     AND column_name = 'legacy_dj_id') THEN
        v_missing := array_append(v_missing, 'public.dj_role_details.legacy_dj_id');
    END IF;

    -- dancer_profiles columns we will INSERT into
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dancer_profiles'
                     AND column_name = 'avatar_url') THEN
        v_missing := array_append(v_missing, 'public.dancer_profiles.avatar_url');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dancer_profiles'
                     AND column_name = 'profile_source') THEN
        v_missing := array_append(v_missing, 'public.dancer_profiles.profile_source');
    END IF;

    -- dj_profiles source columns we will read
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dj_profiles'
                     AND column_name = 'photo_url') THEN
        v_missing := array_append(v_missing, 'public.dj_profiles.photo_url');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'dj_profiles'
                     AND column_name = 'dj_name') THEN
        v_missing := array_append(v_missing, 'public.dj_profiles.dj_name');
    END IF;

    IF array_length(v_missing, 1) > 0 THEN
        RAISE EXCEPTION 'schema precheck failed — missing: %', array_to_string(v_missing, ', ');
    END IF;
END
$$;

-- ── 2. Orphan migration — idempotent loop ────────────────────────────────────
DO $$
DECLARE
    v_dj              RECORD;
    v_new_person_id   uuid;
    v_count           integer := 0;
BEGIN
    FOR v_dj IN
        SELECT dp.id, dp.dj_name, dp.first_name, dp.surname, dp.photo_url, dp.created_at
        FROM   public.dj_profiles dp
        WHERE  NOT EXISTS (
                   SELECT 1 FROM public.dj_role_details dd
                   WHERE  dd.legacy_dj_id = dp.id
               )
    LOOP
        v_new_person_id := gen_random_uuid();

        -- 2a. dancer_profiles — canonical person row (unclaimed, claimed_by left NULL)
        INSERT INTO public.dancer_profiles (
            id,
            first_name,
            surname,
            avatar_url,
            is_active,
            profile_source,
            created_at
        )
        VALUES (
            v_new_person_id,
            v_dj.first_name,
            v_dj.surname,
            v_dj.photo_url,   -- legacy scalar text → dancer_profiles.avatar_url
            true,
            'migrated_from_dj_orphan',
            COALESCE(v_dj.created_at, now())
        )
        ON CONFLICT (id) DO NOTHING;

        -- 2b. person_roles — djing active. Guarded by NOT EXISTS so we don't
        --     rely on knowing the unique-constraint name.
        INSERT INTO public.person_roles (person_id, role, is_active)
        SELECT v_new_person_id, 'djing', true
        WHERE  NOT EXISTS (
                   SELECT 1 FROM public.person_roles
                   WHERE  person_id = v_new_person_id
                     AND  role      = 'djing'
               );

        -- 2c. dj_role_details — legacy_dj_id is the back-pointer used by
        --     migration 2 to remap event_program_people.profile_id.
        INSERT INTO public.dj_role_details (person_id, dj_name, legacy_dj_id)
        SELECT v_new_person_id, v_dj.dj_name, v_dj.id
        WHERE  NOT EXISTS (
                   SELECT 1 FROM public.dj_role_details
                   WHERE  person_id = v_new_person_id
               );

        v_count := v_count + 1;
        RAISE NOTICE 'Migrated orphan legacy DJ % (%) → new person_id %',
            v_dj.id,
            COALESCE(
                NULLIF(BTRIM(v_dj.dj_name), ''),
                BTRIM(COALESCE(v_dj.first_name, '') || ' ' || COALESCE(v_dj.surname, ''))
            ),
            v_new_person_id;
    END LOOP;

    RAISE NOTICE 'Total orphan legacy DJs migrated this run: %', v_count;
END
$$;

-- ── 3. Deprecation marker on dj_profiles ──────────────────────────────────────
COMMENT ON TABLE public.dj_profiles IS
    'DEPRECATED — superseded by dancer_profiles + person_roles(role=''djing'') + dj_role_details. '
    'Retained while legacy references (AdminLandingPage counts, DynamicForm legacy DJ flow, '
    'djContractService, djSaveService, scripts/audit_festival_creation.ts) are migrated. '
    'Do not write new rows to this table.';

COMMIT;

-- ── 4. Schema reload outside the transaction ─────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (Ricky: run after applying, paste results back)
-- =============================================================================
--
-- V1.1 Confirm orphan count is now zero:
-- SELECT count(*) AS remaining_orphans
-- FROM   public.dj_profiles dp
-- WHERE  NOT EXISTS (SELECT 1 FROM public.dj_role_details dd
--                    WHERE dd.legacy_dj_id = dp.id);
-- -- Expected: 0
--
-- V1.2 Confirm dj_role_details grew by exactly 1 (pre-migration count was 10):
-- SELECT count(*) AS total_rows FROM public.dj_role_details;
-- -- Expected: 11
--
-- V1.3 Inspect the migrated row — confirm legacy_dj_id populated, identity copied:
-- SELECT dd.person_id,
--        dp.first_name, dp.surname, dp.avatar_url, dp.profile_source,
--        dd.dj_name, dd.legacy_dj_id,
--        pr.role, pr.is_active
-- FROM   public.dj_role_details    dd
-- JOIN   public.dancer_profiles    dp ON dp.id        = dd.person_id
-- JOIN   public.person_roles       pr ON pr.person_id = dd.person_id AND pr.role = 'djing'
-- WHERE  dp.profile_source = 'migrated_from_dj_orphan';
-- -- Expected: 1 row, all columns populated, legacy_dj_id = the original dj_profiles.id.
--
-- V1.4 Sanity — the deprecation comment lands on dj_profiles:
-- SELECT obj_description('public.dj_profiles'::regclass, 'pg_class');
