-- =============================================================================
-- Migration: 20260422190200_admin_search_profiles_v1_unified_dj.sql
-- Date:      2026-04-22
-- Purpose:   Rewrite the 'dj' branch of public.admin_search_profiles_v1 to
--            read from the unified person model (dancer_profiles joined to
--            person_roles filtered to role='djing', left-joined to
--            dj_role_details for dj_name) instead of the legacy dj_profiles
--            table. Emits dancer_profiles.id as the result's profile_id.
--
-- BACKGROUND
--   The DJ picker calls this RPC with p_profile_type='dj'. The current 'dj'
--   branch (202604140003) reads FROM public.dj_profiles and therefore never
--   surfaces DJs created via the unified PersonEditorV2Premium →
--   admin_save_person_v1 path. Migrations 20260422190000 and 20260422190100
--   prepare the data (legacy DJ unified, EPP profile_id remap). This RPC
--   rewrite cuts over the read path.
--
-- WHAT CHANGES
--   ONLY the 'dj' branch of the function body.
--   Every other branch (teacher, dancer, organiser, videographer, vendor) is
--   preserved BYTE-FOR-BYTE from 202604140003_admin_search_profiles_v1.sql.
--   Function signature, grants, search_path, and SECURITY DEFINER are
--   unchanged.
--
-- NEW 'dj' BRANCH SHAPE
--   FROM public.dancer_profiles dp
--   JOIN public.person_roles    pr ON pr.person_id = dp.id
--                                 AND pr.role      = 'djing'
--                                 AND pr.is_active = true
--   LEFT JOIN public.dj_role_details dd ON dd.person_id = dp.id
--   WHERE COALESCE(dp.is_active, true) = true
--     AND dp.archived_at IS NULL
--     AND ( v_q IS NULL
--        OR dd.dj_name    ILIKE '%'||v_q||'%'
--        OR dp.first_name ILIKE '%'||v_q||'%'
--        OR dp.surname    ILIKE '%'||v_q||'%' )
--     AND ( p_exclude_program_item_id IS NULL OR NOT EXISTS(...) )
--
--   profile_id    = dp.id  (dancer_profiles.id — the unified canonical id)
--   display_name  = COALESCE(dd.dj_name, first_name || ' ' || surname)
--   avatar_url    = dp.avatar_url
--
-- AVATAR COLUMN NOTE (deliberate divergence from ticket spec)
--   The ticket spec said to use dancer_profiles.photo_url. That column does
--   not exist — dancer_profiles uses avatar_url only (documented in the
--   superseded 'dj' branch at line 157 of 202604140003 and again at line 22
--   of 202604140002). The JSON key emitted is still `avatar_url`, so the
--   caller contract is unchanged; only the source column name differs from
--   the legacy dj_profiles.photo_url. For the single pre-existing DJ the
--   orphan migration (20260422190000) explicitly copied photo_url →
--   dancer_profiles.avatar_url so the visible avatar is preserved.
--
-- FILTERS ADDED
--   The legacy dj_profiles branch had no is_active / archived_at filters.
--   The unified model has both. We respect them here: inactive / archived
--   DJs don't surface in the picker. If the user wants the legacy
--   everything-visible behaviour they can toggle a DJ is_active via the
--   PersonEditorV2Premium status pills (already in the UI).
--
-- IDEMPOTENCY
--   CREATE OR REPLACE FUNCTION with identical signature. Re-running the
--   migration replaces the function body with the same body.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_search_profiles_v1(text, text, integer, uuid);

CREATE FUNCTION public.admin_search_profiles_v1(
    p_profile_type              text,
    p_query                     text    DEFAULT '',
    p_limit                     integer DEFAULT 20,
    p_exclude_program_item_id   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_q      text;
    v_result jsonb;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'admin_only';
    END IF;

    -- Normalise query — NULL and blank both mean "no filter"
    v_q := NULLIF(BTRIM(p_query), '');

    -- ── teacher (unchanged from 202604140003) ────────────────────────────────
    IF p_profile_type = 'teacher' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'teacher',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                tp.id AS profile_id,
                NULLIF(BTRIM(COALESCE(tp.first_name,'') || ' ' || COALESCE(tp.surname,'')), '') AS display_name,
                tp.photo_url AS avatar_url
            FROM public.teacher_profiles tp
            WHERE
                (
                    v_q IS NULL
                    OR tp.first_name ILIKE '%' || v_q || '%'
                    OR tp.surname    ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = tp.id
                          AND epp.profile_type    = 'teacher'
                    )
                )
            ORDER BY BTRIM(COALESCE(tp.first_name,'') || ' ' || COALESCE(tp.surname,''))
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    -- ── dj (REWRITTEN — reads unified person model) ──────────────────────────
    ELSIF p_profile_type = 'dj' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'dj',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                dp.id AS profile_id,
                COALESCE(
                    NULLIF(BTRIM(dd.dj_name), ''),
                    NULLIF(BTRIM(COALESCE(dp.first_name,'') || ' ' || COALESCE(dp.surname,'')), '')
                ) AS display_name,
                dp.avatar_url  -- dancer_profiles uses avatar_url (NOT photo_url)
            FROM public.dancer_profiles    dp
            JOIN public.person_roles       pr
                ON pr.person_id = dp.id
               AND pr.role      = 'djing'
               AND pr.is_active = true
            LEFT JOIN public.dj_role_details dd
                ON dd.person_id = dp.id
            WHERE
                COALESCE(dp.is_active, true) = true
                AND dp.archived_at IS NULL
                AND (
                    v_q IS NULL
                    OR dd.dj_name    ILIKE '%' || v_q || '%'
                    OR dp.first_name ILIKE '%' || v_q || '%'
                    OR dp.surname    ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = dp.id
                          AND epp.profile_type    = 'dj'
                    )
                )
            ORDER BY
                COALESCE(
                    NULLIF(BTRIM(dd.dj_name), ''),
                    NULLIF(BTRIM(COALESCE(dp.first_name,'') || ' ' || COALESCE(dp.surname,'')), '')
                )
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    -- ── dancer (unchanged from 202604140003) ──────────────────────────────────
    ELSIF p_profile_type = 'dancer' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'dancer',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                dp.id AS profile_id,
                NULLIF(BTRIM(COALESCE(dp.first_name,'') || ' ' || COALESCE(dp.surname,'')), '') AS display_name,
                dp.avatar_url   -- dancer_profiles uses avatar_url (NOT photo_url)
            FROM public.dancer_profiles dp
            WHERE
                (
                    v_q IS NULL
                    OR dp.first_name ILIKE '%' || v_q || '%'
                    OR dp.surname    ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = dp.id
                          AND epp.profile_type    = 'dancer'
                    )
                )
            ORDER BY BTRIM(COALESCE(dp.first_name,'') || ' ' || COALESCE(dp.surname,''))
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    -- ── organiser (unchanged from 202604140003) ───────────────────────────────
    ELSIF p_profile_type = 'organiser' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'organiser',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                e.id        AS profile_id,
                e.name      AS display_name,
                e.avatar_url
            FROM public.entities e
            WHERE
                e.type = 'organiser'
                AND (
                    v_q IS NULL
                    OR e.name ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = e.id
                          AND epp.profile_type    = 'organiser'
                    )
                )
            ORDER BY e.name
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    -- ── videographer (unchanged from 202604140003) ────────────────────────────
    ELSIF p_profile_type = 'videographer' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'videographer',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                v.id AS profile_id,
                COALESCE(
                    NULLIF(BTRIM(COALESCE(v.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.first_name,'') || ' ' || COALESCE(v.surname,'')), '')
                ) AS display_name,
                v.photo_url AS avatar_url
            FROM public.videographers v
            WHERE
                (
                    v_q IS NULL
                    OR v.business_name ILIKE '%' || v_q || '%'
                    OR v.first_name    ILIKE '%' || v_q || '%'
                    OR v.surname       ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = v.id
                          AND epp.profile_type    = 'videographer'
                    )
                )
            ORDER BY
                COALESCE(
                    NULLIF(BTRIM(COALESCE(v.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.first_name,'') || ' ' || COALESCE(v.surname,'')), '')
                )
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    -- ── vendor (unchanged from 202604140003) ──────────────────────────────────
    ELSIF p_profile_type = 'vendor' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'profile_id',   sub.profile_id,
                'profile_type', 'vendor',
                'display_name', sub.display_name,
                'avatar_url',   sub.avatar_url
            )
        )
        INTO v_result
        FROM (
            SELECT
                v.id AS profile_id,
                COALESCE(
                    NULLIF(BTRIM(COALESCE(v.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.representative_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.first_name,'') || ' ' || COALESCE(v.surname,'')), '')
                ) AS display_name,
                v.photo_url AS avatar_url
            FROM public.vendors v
            WHERE
                (
                    v_q IS NULL
                    OR v.business_name       ILIKE '%' || v_q || '%'
                    OR v.representative_name ILIKE '%' || v_q || '%'
                )
                AND (
                    p_exclude_program_item_id IS NULL
                    OR NOT EXISTS (
                        SELECT 1
                        FROM public.event_program_people epp
                        WHERE epp.program_item_id = p_exclude_program_item_id
                          AND epp.profile_id      = v.id
                          AND epp.profile_type    = 'vendor'
                    )
                )
            ORDER BY
                COALESCE(
                    NULLIF(BTRIM(COALESCE(v.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.representative_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(v.first_name,'') || ' ' || COALESCE(v.surname,'')), '')
                )
            LIMIT GREATEST(COALESCE(p_limit, 20), 1)
        ) sub;

    ELSE
        RAISE EXCEPTION 'admin_search_profiles_v1: unknown profile_type %', p_profile_type;
    END IF;

    -- Always return an array, never null
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Admin-only: no anon or authenticated grant (matches 202604140003 grants;
-- 202604140007_fix_epp_rpc_grants.sql added a separate authenticated grant if
-- present on live — Supabase SQL editor session uses service_role and isn't
-- affected either way).
REVOKE ALL     ON FUNCTION public.admin_search_profiles_v1(text, text, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_search_profiles_v1(text, text, integer, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_search_profiles_v1(text, text, integer, uuid) TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_search_profiles_v1(text, text, integer, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (Ricky: run after applying, paste results back)
-- =============================================================================
--
-- V3.1 Search for a recently-created DJ by name fragment — should return a row
-- now (replace <new-dj-name>):
-- SELECT public.admin_search_profiles_v1('dj', '<new-dj-name>', 20, NULL);
--
-- V3.2 Search for the just-migrated legacy DJ by name fragment — should return
-- a row with profile_id = the new dancer_profiles.id (NOT the old dj_profiles.id):
-- SELECT public.admin_search_profiles_v1('dj', '<old-dj-name>', 20, NULL);
--
-- V3.3 Empty query — count of unified DJs:
-- SELECT jsonb_array_length(public.admin_search_profiles_v1('dj', '', 20, NULL))
--     AS total_djs_visible;
-- -- Expected: ~11 (10 pre-existing unified + 1 newly migrated orphan),
-- -- subject to is_active=true and archived_at IS NULL on dancer_profiles.
--
-- V3.4 Sanity — teacher/dancer/organiser/videographer/vendor still work:
-- SELECT jsonb_array_length(public.admin_search_profiles_v1('teacher',       '', 20, NULL)) AS teachers,
--        jsonb_array_length(public.admin_search_profiles_v1('dancer',        '', 20, NULL)) AS dancers,
--        jsonb_array_length(public.admin_search_profiles_v1('organiser',     '', 20, NULL)) AS organisers,
--        jsonb_array_length(public.admin_search_profiles_v1('videographer',  '', 20, NULL)) AS videographers,
--        jsonb_array_length(public.admin_search_profiles_v1('vendor',        '', 20, NULL)) AS vendors;
