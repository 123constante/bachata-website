-- =============================================================================
-- Migration: 20260422190300_admin_link_session_people_v1_unified_dj.sql
-- Date:      2026-04-22
-- Purpose:   Rewrite the 'dj' LEFT JOIN inside public.admin_link_session_people_v1
--            to resolve display_name/avatar_url from the unified person model
--            (dancer_profiles + dj_role_details) instead of legacy dj_profiles.
--
-- BACKGROUND
--   admin_link_session_people_v1 accepts a p_profile_id that the picker (via
--   admin_search_profiles_v1, rewritten in 20260422190200) now returns as
--   dancer_profiles.id. The current link RPC (latest body in
--   202604150005_remove_epl_bridge.sql) resolves display_name/avatar_url for
--   the 'dj' arm via `LEFT JOIN public.dj_profiles dp ... ON dp.id = p_profile_id`
--   — which will NULL-out on unified DJ ids, producing blank display_name and
--   avatar_url on event_program_people.
--
-- WHAT CHANGES
--   The dj LEFT JOIN is swapped for a two-table join against dancer_profiles
--   + dj_role_details. The CASE arms for 'dj' reference the new aliases.
--
--   Every other profile_type branch (teacher, dancer, organiser, videographer,
--   vendor) is preserved BYTE-FOR-BYTE from 202604150005. Function signature,
--   v_role derivation, event_id lookup, REMOVE action, UPSERT shape, return
--   JSON shapes, SECURITY DEFINER, search_path, and grants are unchanged.
--
-- ALIAS COLLISION RESOLUTION
--   The existing body uses `dp` = dj_profiles, `da` = dancer_profiles. Keep
--   `da` (dancer branch) as-is. Drop `dp` (dj_profiles is no longer joined).
--   Introduce `djp` = dancer_profiles for the dj branch and `djd` =
--   dj_role_details. Both referenced only in the WHEN 'dj' arms of the
--   CASE expressions. No other branch references `djp` or `djd`.
--
-- AVATAR COLUMN NOTE (deliberate divergence from ticket spec)
--   dancer_profiles has avatar_url, not photo_url (repo evidence cited in
--   20260422190200). The return JSON key avatar_url is unchanged from the
--   caller's perspective; only the source column differs from the previous
--   dj_profiles.photo_url. The orphan migration (20260422190000) explicitly
--   mirrored dj_profiles.photo_url → dancer_profiles.avatar_url so legacy
--   avatars are preserved.
--
-- IDEMPOTENCY
--   DROP + CREATE of the function with the same signature. Re-running
--   replaces the function body with identical SQL.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_link_session_people_v1(uuid, uuid, text, text, text);

CREATE FUNCTION public.admin_link_session_people_v1(
    p_program_item_id   uuid,
    p_profile_id        uuid,
    p_profile_type      text,
    p_role              text  DEFAULT NULL,
    p_action            text  DEFAULT 'add'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_event_id    uuid;
    v_display     text;
    v_avatar      text;
    v_role        text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'admin_only';
    END IF;

    -- ── Validate inputs ───────────────────────────────────────────────────────
    IF p_profile_type NOT IN ('teacher','dj','dancer','organiser','videographer','vendor') THEN
        RAISE EXCEPTION 'admin_link_session_people_v1: unknown profile_type %', p_profile_type;
    END IF;

    IF p_action NOT IN ('add','remove') THEN
        RAISE EXCEPTION 'admin_link_session_people_v1: unknown action %, must be add or remove', p_action;
    END IF;

    -- ── Role derivation: explicit wins; NULL/blank falls back to profile_type default ──
    v_role := COALESCE(
        NULLIF(BTRIM(p_role), ''),
        CASE p_profile_type
            WHEN 'teacher'      THEN 'teaching'
            WHEN 'dj'           THEN 'djing'
            WHEN 'dancer'       THEN 'guest_dancer'
            WHEN 'organiser'    THEN 'organising'
            WHEN 'videographer' THEN 'filming'
            WHEN 'vendor'       THEN 'selling'
            ELSE                     'other'
        END
    );

    -- ── Rule 13: derive event_id from event_program_items ────────────────────
    SELECT pi.event_id
    INTO   v_event_id
    FROM   public.event_program_items pi
    WHERE  pi.id = p_program_item_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'admin_link_session_people_v1: program_item_id % not found', p_program_item_id;
    END IF;

    -- ── REMOVE ────────────────────────────────────────────────────────────────
    IF p_action = 'remove' THEN
        DELETE FROM public.event_program_people
        WHERE  program_item_id = p_program_item_id
          AND  profile_id      = p_profile_id
          AND  profile_type    = p_profile_type;

        RETURN jsonb_build_object(
            'ok',           true,
            'action',       'remove',
            'profile_id',   p_profile_id,
            'profile_type', p_profile_type
        );
    END IF;

    -- ── ADD: Rule 12 — look up display_name and avatar_url server-side ────────
    SELECT
        CASE p_profile_type
            WHEN 'teacher' THEN
                NULLIF(BTRIM(COALESCE(tp.first_name,'') || ' ' || COALESCE(tp.surname,'')), '')
            WHEN 'dj' THEN
                COALESCE(
                    NULLIF(BTRIM(djd.dj_name), ''),
                    NULLIF(BTRIM(COALESCE(djp.first_name,'') || ' ' || COALESCE(djp.surname,'')), '')
                )
            WHEN 'dancer' THEN
                NULLIF(BTRIM(COALESCE(da.first_name,'') || ' ' || COALESCE(da.surname,'')), '')
            WHEN 'organiser' THEN
                e.name
            WHEN 'videographer' THEN
                COALESCE(
                    NULLIF(BTRIM(COALESCE(vi.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(vi.first_name,'') || ' ' || COALESCE(vi.surname,'')), '')
                )
            WHEN 'vendor' THEN
                COALESCE(
                    NULLIF(BTRIM(COALESCE(ve.business_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(ve.representative_name, '')), ''),
                    NULLIF(BTRIM(COALESCE(ve.first_name,'') || ' ' || COALESCE(ve.surname,'')), '')
                )
        END,
        CASE p_profile_type
            WHEN 'teacher'      THEN tp.photo_url
            WHEN 'dj'           THEN djp.avatar_url   -- dancer_profiles.avatar_url (unified)
            WHEN 'dancer'       THEN da.avatar_url
            WHEN 'organiser'    THEN e.avatar_url
            WHEN 'videographer' THEN vi.photo_url
            WHEN 'vendor'       THEN ve.photo_url
        END
    INTO v_display, v_avatar
    FROM  (SELECT 1) AS dummy
    LEFT JOIN public.teacher_profiles  tp  ON p_profile_type = 'teacher'      AND tp.id        = p_profile_id
    LEFT JOIN public.dancer_profiles   djp ON p_profile_type = 'dj'           AND djp.id       = p_profile_id
    LEFT JOIN public.dj_role_details   djd ON p_profile_type = 'dj'           AND djd.person_id = djp.id
    LEFT JOIN public.dancer_profiles   da  ON p_profile_type = 'dancer'       AND da.id        = p_profile_id
    LEFT JOIN public.entities           e  ON p_profile_type = 'organiser'    AND e.id         = p_profile_id AND e.type = 'organiser'
    LEFT JOIN public.videographers     vi  ON p_profile_type = 'videographer' AND vi.id        = p_profile_id
    LEFT JOIN public.vendors           ve  ON p_profile_type = 'vendor'       AND ve.id        = p_profile_id;

    -- ── ADD: upsert into event_program_people ─────────────────────────────────
    -- event_profile_links is FROZEN (202604150004/005). EPP is the only write target.
    INSERT INTO public.event_program_people (
        event_id, program_item_id, profile_id, profile_type,
        role, display_name, avatar_url, created_by
    )
    VALUES (
        v_event_id, p_program_item_id, p_profile_id, p_profile_type,
        v_role, v_display, v_avatar, auth.uid()
    )
    ON CONFLICT (program_item_id, profile_id, profile_type) DO UPDATE
        SET role         = EXCLUDED.role,
            display_name = EXCLUDED.display_name,
            avatar_url   = EXCLUDED.avatar_url;

    RETURN jsonb_build_object(
        'ok',           true,
        'action',       'add',
        'profile_id',   p_profile_id,
        'profile_type', p_profile_type,
        'role',         v_role,
        'display_name', v_display,
        'avatar_url',   v_avatar
    );
END;
$$;

-- Security: SECURITY DEFINER + is_admin() is the real gate.
-- authenticated must keep EXECUTE so the frontend Supabase client (JWT) can call this RPC.
REVOKE ALL     ON FUNCTION public.admin_link_session_people_v1(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_link_session_people_v1(uuid, uuid, text, text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_link_session_people_v1(uuid, uuid, text, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (Ricky: run after applying, paste results back)
-- =============================================================================
--
-- V4.1 Pick a program_item to test against:
-- SELECT pi.id AS program_item_id, pi.title, pi.event_id
-- FROM   public.event_program_items pi
-- ORDER  BY pi.created_at DESC
-- LIMIT  5;
--
-- V4.2 Pick a unified DJ (dancer_profiles.id) to link:
-- SELECT dp.id AS dancer_profile_id,
--        COALESCE(dd.dj_name, dp.first_name || ' ' || dp.surname) AS name
-- FROM   public.dancer_profiles dp
-- JOIN   public.person_roles    pr ON pr.person_id = dp.id AND pr.role = 'djing' AND pr.is_active = true
-- LEFT JOIN public.dj_role_details dd ON dd.person_id = dp.id
-- WHERE  COALESCE(dp.is_active, true) = true AND dp.archived_at IS NULL
-- LIMIT  5;
--
-- V4.3 Link the DJ to a program_item (replace placeholders):
-- SELECT public.admin_link_session_people_v1(
--     '<program_item_id>'::uuid,
--     '<dancer_profile_id>'::uuid,
--     'dj', NULL, 'add'
-- );
-- -- Expected: ok=true, display_name populated, avatar_url populated (if DJ has one).
--
-- V4.4 Confirm the row landed in event_program_people with populated
--      display_name + avatar_url:
-- SELECT program_item_id, profile_id, profile_type, role, display_name, avatar_url
-- FROM   public.event_program_people
-- WHERE  program_item_id = '<program_item_id>'
--   AND  profile_id      = '<dancer_profile_id>'
--   AND  profile_type    = 'dj';
--
-- V4.5 Remove the test link:
-- SELECT public.admin_link_session_people_v1(
--     '<program_item_id>'::uuid,
--     '<dancer_profile_id>'::uuid,
--     'dj', NULL, 'remove'
-- );
--
-- V4.6 End-to-end picker → link smoke test in the admin UI:
-- Open an event, open a session, type a DJ name in the picker, click + Add.
-- The row should appear in the session's people list with the correct name
-- and avatar. Then remove and re-add to confirm the REMOVE action works.
