-- =============================================================================
-- Migration: 20260422190250_admin_search_profiles_v1_unified_dj_null_safe.sql
-- Date:      2026-04-22
-- Purpose:   Patch admin_search_profiles_v1's DJ branch to treat
--            person_roles.is_active = NULL as active (true), matching the
--            existing COALESCE semantic on dancer_profiles.is_active.
--
-- BACKGROUND
--   20260422190200 introduced the unified DJ read path with a strict filter
--   `pr.is_active = true`. An audit on 2026-04-22 revealed 1+ rows in
--   person_roles where is_active = NULL (Julian's djing row, plus 1 dancing
--   row at audit time). NULL = true evaluates to NULL, not true, so strict
--   equality silently filtered these records out of the picker. Symmetric
--   to the dancer_profiles.is_active filter two lines below, this patch
--   uses COALESCE(pr.is_active, true) = true.
--
--   The DJ branch is the only branch changed. Every other branch is
--   byte-for-byte identical to 20260422190200.
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

    -- ── dj (NULL-safe patch: COALESCE(pr.is_active, true) = true) ────────────
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
               AND COALESCE(pr.is_active, true) = true
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
-- V3.5.1 Total DJs visible to picker (should be 10 now Julian is active):
-- SELECT count(*)
-- FROM public.dancer_profiles dp
-- JOIN public.person_roles pr
--   ON pr.person_id = dp.id
--  AND pr.role = 'djing'
--  AND COALESCE(pr.is_active, true) = true
-- WHERE COALESCE(dp.is_active, true) = true
--   AND dp.archived_at IS NULL;
-- -- Expected: 10

-- V3.5.2 Spot-check Julian (220b31fd...) is now in picker results:
-- SELECT EXISTS (
--   SELECT 1
--   FROM public.dancer_profiles dp
--   JOIN public.person_roles pr
--     ON pr.person_id = dp.id
--    AND pr.role = 'djing'
--    AND COALESCE(pr.is_active, true) = true
--   LEFT JOIN public.dj_role_details dd ON dd.person_id = dp.id
--   WHERE COALESCE(dp.is_active, true) = true
--     AND dp.archived_at IS NULL
--     AND dp.id = '220b31fd-6fd5-45ef-ae43-0f11ee918792'
-- ) AS julian_visible;
-- -- Expected: true
