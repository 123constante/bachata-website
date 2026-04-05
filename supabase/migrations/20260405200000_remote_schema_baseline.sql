


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."event_entity_role" AS ENUM (
    'organiser'
);


ALTER TYPE "public"."event_entity_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_block_legacy_lineup_writes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'Legacy lineup table % is read-only. Use event_profile_links via admin_save_event_v2.', TG_TABLE_NAME;
END;
$$;


ALTER FUNCTION "public"."_block_legacy_lineup_writes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_block_organiser_role_writes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.role = 'organiser' THEN
    IF auth.role() <> 'service_role' AND NOT is_current_user_admin() THEN
      RAISE EXCEPTION 'Direct organiser writes are restricted. Use approved admin flows.';
    END IF;
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."_block_organiser_role_writes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_derive_event_organiser_ids"("p_event_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT e.entity_id
      FROM public.event_entities e
      WHERE e.event_id = p_event_id AND e.role = 'organiser'
      ORDER BY e.entity_id ASC
    ),
    ARRAY[]::uuid[]
  );
$$;


ALTER FUNCTION "public"."_derive_event_organiser_ids"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_floor_test_probe"() RETURNS "text"
    LANGUAGE "sql"
    AS $$ SELECT 'ok'$$;


ALTER FUNCTION "public"."_floor_test_probe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_guard_events_legacy_organiser_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF current_setting('app.derive_organisers', true) IS DISTINCT FROM 'on' THEN
    IF (NEW.organiser_id IS DISTINCT FROM OLD.organiser_id) OR (NEW.organiser_ids IS DISTINCT FROM OLD.organiser_ids) THEN
      RAISE EXCEPTION 'Direct writes to organiser_id/organiser_ids are disallowed in Phase B; update public.event_entities instead';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_guard_events_legacy_organiser_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_log_legacy_read"("_surface" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.rpc_deprecation_log(function_name, params, auth_uid)
  VALUES ('legacy_read', jsonb_build_object('surface', _surface), auth.uid());
END;$$;


ALTER FUNCTION "public"."_log_legacy_read"("_surface" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_map_role_to_profile_type"("p_role" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT CASE p_role
    WHEN 'teacher'      THEN 'teacher'
    WHEN 'dj'           THEN 'dj'
    WHEN 'vendor'       THEN 'vendor'
    WHEN 'videographer' THEN 'videographer'
    WHEN 'dancer'       THEN 'dancer'
    WHEN 'hosting'      THEN 'teacher'
    WHEN 'performing'   THEN 'teacher'
    ELSE NULL
  END;
$$;


ALTER FUNCTION "public"."_map_role_to_profile_type"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_member_profile_user_id"("p_member_profile_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT pal.user_id
  FROM public.profile_claims pal
  WHERE pal.profile_id = p_member_profile_id
    AND pal.profile_type = 'member'
    AND pal.status = 'approved'
  ORDER BY pal.created_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."_member_profile_user_id"("p_member_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_secdef_probe"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$SELECT 'ok'$$;


ALTER FUNCTION "public"."_secdef_probe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_upsert_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_is_primary" boolean, "p_source" "text", "p_occurrence_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_pt text; BEGIN
  v_pt := public._map_role_to_profile_type(p_role);
  IF v_pt IS NULL THEN RAISE EXCEPTION 'unsupported role % for profile_type derivation', p_role; END IF;
  IF p_occurrence_id IS NOT NULL THEN
    UPDATE public.event_profile_links epl
       SET is_primary = COALESCE(p_is_primary, epl.is_primary), updated_at = now(), updated_by = auth.uid()
     WHERE epl.occurrence_id = p_occurrence_id AND epl.profile_id = p_profile_id AND epl.role = p_role AND epl.status='active' AND epl.archived_at IS NULL;
    IF NOT FOUND THEN
      INSERT INTO public.event_profile_links (event_id, profile_id, profile_type, role, is_primary, status, created_by, source, occurrence_id)
      VALUES (p_event_id, p_profile_id, v_pt, p_role, COALESCE(p_is_primary,false), 'active', auth.uid(), COALESCE(NULLIF(p_source,''),'manual'), p_occurrence_id);
    END IF;
  ELSE
    UPDATE public.event_profile_links epl
       SET is_primary = COALESCE(p_is_primary, epl.is_primary), updated_at = now(), updated_by = auth.uid()
     WHERE epl.event_id = p_event_id AND epl.profile_id = p_profile_id AND epl.role = p_role AND epl.occurrence_id IS NULL AND epl.status='active' AND epl.archived_at IS NULL;
    IF NOT FOUND THEN
      INSERT INTO public.event_profile_links (event_id, profile_id, profile_type, role, is_primary, status, created_by, source, occurrence_id)
      VALUES (p_event_id, p_profile_id, v_pt, p_role, COALESCE(p_is_primary,false), 'active', auth.uid(), COALESCE(NULLIF(p_source,''),'manual'), NULL);
    END IF;
  END IF;
END; $$;


ALTER FUNCTION "public"."_upsert_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_is_primary" boolean, "p_source" "text", "p_occurrence_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."account_exists_by_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;


ALTER FUNCTION "public"."account_exists_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_archive_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text := lower(COALESCE(p_role, ''));
  v_link_id uuid;
  v_profile_type text;
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to manage connectivity';
  END IF;

  UPDATE public.event_profile_links l
  SET
    status = 'archived',
    archived_at = now(),
    archived_by = auth.uid(),
    updated_by = auth.uid(),
    reason = COALESCE(p_reason, l.reason)
  WHERE l.event_id = p_event_id
    AND l.profile_id = p_profile_id
    AND l.role = v_role
    AND l.status = 'active'
    AND l.archived_at IS NULL
  RETURNING l.id, l.profile_type INTO v_link_id, v_profile_type;

  IF v_link_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'archived', false, 'message', 'No active link found');
  END IF;

  PERFORM public.admin_log_link_action(
    v_link_id,
    p_event_id,
    p_profile_id,
    v_profile_type,
    v_role,
    'archive',
    p_reason,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'archived', true, 'link_id', v_link_id);
END;
$$;


ALTER FUNCTION "public"."admin_archive_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_audit_event_profile_connections_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_new jsonb;
  v_old jsonb;
  v_action text;
  v_link_id uuid;
  v_event_id uuid;
  v_profile_id uuid;
  v_profile_type text;
  v_role text;
  v_reason text;
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'create';
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    if lower(coalesce(v_new ->> 'status', 'active')) = 'archived'
       and lower(coalesce(v_old ->> 'status', 'active')) <> 'archived' then
      v_action := 'archive';
    else
      v_action := 'update';
    end if;
  else
    v_old := to_jsonb(old);
    v_action := 'archive';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if coalesce(v_new ->> 'id', '') ~* v_uuid_pattern then v_link_id := (v_new ->> 'id')::uuid; end if;
    if coalesce(v_new ->> 'event_id', '') ~* v_uuid_pattern then v_event_id := (v_new ->> 'event_id')::uuid; end if;
    if coalesce(v_new ->> 'profile_id', '') ~* v_uuid_pattern then v_profile_id := (v_new ->> 'profile_id')::uuid; end if;
    v_profile_type := lower(coalesce(nullif(v_new ->> 'profile_type', ''), nullif(v_new ->> 'role', '')));
    v_role := lower(coalesce(nullif(v_new ->> 'role', ''), nullif(v_new ->> 'profile_type', '')));
    v_reason := nullif(v_new ->> 'reason', '');
  else
    if coalesce(v_old ->> 'id', '') ~* v_uuid_pattern then v_link_id := (v_old ->> 'id')::uuid; end if;
    if coalesce(v_old ->> 'event_id', '') ~* v_uuid_pattern then v_event_id := (v_old ->> 'event_id')::uuid; end if;
    if coalesce(v_old ->> 'profile_id', '') ~* v_uuid_pattern then v_profile_id := (v_old ->> 'profile_id')::uuid; end if;
    v_profile_type := lower(coalesce(nullif(v_old ->> 'profile_type', ''), nullif(v_old ->> 'role', '')));
    v_role := lower(coalesce(nullif(v_old ->> 'role', ''), nullif(v_old ->> 'profile_type', '')));
    v_reason := nullif(v_old ->> 'reason', '');
  end if;

  perform public.admin_log_link_action(
    v_link_id,
    v_event_id,
    v_profile_id,
    v_profile_type,
    v_role,
    v_action,
    v_reason,
    case
      when tg_op = 'INSERT' then v_new
      when tg_op = 'UPDATE' then jsonb_build_object('old', v_old, 'new', v_new)
      else v_old
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."admin_audit_event_profile_connections_changes"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."dancers_archive_april2026" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "photo_url" "text",
    "nationality" "text",
    "favorite_styles" "text"[],
    "favorite_songs" "text"[],
    "achievements" "text"[],
    "partner_role" "text",
    "partner_details" "jsonb",
    "instagram" "text",
    "looking_for_partner" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "facebook" "text",
    "partner_practice_goals" "text"[],
    "website" "text",
    "dancing_start_date" timestamp with time zone,
    "partner_search_level" "text"[],
    "partner_search_role" "text",
    "first_name" "text",
    "surname" "text",
    "city_id" "uuid",
    "whatsapp" "text" DEFAULT ''::"text",
    "country_code" "text",
    CONSTRAINT "dancers_partner_role_check" CHECK ((("partner_role" IS NULL) OR ("partner_role" = ANY (ARRAY['Leader'::"text", 'Follower'::"text", 'Lead and Follow'::"text"])))),
    CONSTRAINT "dancers_partner_search_role_check" CHECK ((("partner_search_role" IS NULL) OR ("partner_search_role" = ANY (ARRAY['Leader'::"text", 'Follower'::"text", 'Lead and Follow'::"text"]))))
);


ALTER TABLE "public"."dancers_archive_april2026" OWNER TO "postgres";


COMMENT ON TABLE "public"."dancers_archive_april2026" IS 'Dancers Profile (Cache Refreshed)';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."photo_url" IS 'Profile photo URLs.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."nationality" IS 'Optional nationality.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."favorite_styles" IS 'Array of favorite dance styles.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."favorite_songs" IS 'Array of favorite songs.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."achievements" IS 'Array of achievements.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."partner_role" IS 'Leader/Follower/Both.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."partner_details" IS 'Partner search details as jsonb.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."instagram" IS 'Optional Instagram handle.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."looking_for_partner" IS 'Whether dancer is looking for a partner.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."facebook" IS 'Optional Facebook profile.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."partner_practice_goals" IS 'Partner practice goals.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."website" IS 'Optional website or linktree.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."dancing_start_date" IS 'Text value for experience start date.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."partner_search_level" IS 'Partner search level(s).';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."partner_search_role" IS 'Partner search role.';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."first_name" IS 'Primary first name for Dancer profiles';



COMMENT ON COLUMN "public"."dancers_archive_april2026"."surname" IS 'Optional surname for Dancer profiles (can be hidden)';



CREATE OR REPLACE FUNCTION "public"."admin_create_dancer"("p_target_user_id" "uuid", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_based_city_id" "uuid" DEFAULT NULL::"uuid", "p_dancer_patch" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."dancers_archive_april2026"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_row public.dancers%ROWTYPE;
  v_patch jsonb := COALESCE(p_dancer_patch, '{}'::jsonb);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id_required';
  END IF;

  IF jsonb_typeof(v_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_dancer_patch_must_be_object';
  END IF;

  PERFORM public.admin_upsert_member_profile(
    p_target_user_id,
    p_first_name,
    p_last_name,
    p_full_name,
    p_avatar_url,
    p_based_city_id
  );

  INSERT INTO public.dancers (user_id)
  VALUES (p_target_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT d.*
    INTO v_row
    FROM public.dancers d
    WHERE d.user_id = p_target_user_id
    LIMIT 1;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'dancer_create_failed';
    END IF;
  END IF;

  IF v_patch <> '{}'::jsonb THEN
    v_row := public.admin_update_dancer(v_row.id, v_patch);
  END IF;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."admin_create_dancer"("p_target_user_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_full_name" "text", "p_avatar_url" "text", "p_based_city_id" "uuid", "p_dancer_patch" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_dancer_v1"("p_payload" "jsonb") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "dance_role" "text", "dance_started_year" integer, "nationality" "text", "gallery_urls" "text"[], "achievements" "text"[], "favorite_styles" "text"[], "favorite_songs" "text"[], "partner_search_role" "text", "partner_search_level" "text"[], "partner_practice_goals" "text"[], "partner_details" "text", "looking_for_partner" boolean, "instagram" "text", "facebook" "text", "whatsapp" "text", "website" "text", "is_active" boolean, "profile_source" "text", "meta_data" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_user_id := (p_payload->>'id')::uuid;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'id_required';
  END IF;

  INSERT INTO public.dancer_profiles (
    id, first_name, surname, avatar_url, based_city_id,
    dance_role, dance_started_year, nationality,
    gallery_urls, achievements, favorite_styles, favorite_songs,
    partner_search_role, partner_search_level, partner_practice_goals,
    partner_details, looking_for_partner,
    instagram, facebook, whatsapp, website,
    is_active, profile_source, meta_data, created_by
  )
  VALUES (
    v_user_id,
    NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'surname', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'avatar_url', '')), ''),
    NULLIF(p_payload->>'based_city_id', '')::uuid,
    NULLIF(btrim(COALESCE(p_payload->>'dance_role', '')), ''),
    (p_payload->>'dance_started_year')::integer,
    NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls',           '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'achievements',           '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_styles',        '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_songs',         '[]'::jsonb))),
    NULLIF(btrim(COALESCE(p_payload->>'partner_search_role', '')), ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_search_level',   '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_practice_goals', '[]'::jsonb))),
    NULLIF(btrim(COALESCE(p_payload->>'partner_details', '')), ''),
    COALESCE((p_payload->>'looking_for_partner')::boolean, false),
    NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'website', '')), ''),
    (p_payload->>'is_active')::boolean,
    NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''),
    COALESCE(p_payload->'meta_data', '{}'::jsonb),
    auth.uid()
  );

  RETURN QUERY
    SELECT
      dp.id, dp.first_name, dp.surname, dp.avatar_url,
      dp.based_city_id, c.name AS city,
      dp.dance_role, dp.dance_started_year, dp.nationality,
      dp.gallery_urls, dp.achievements, dp.favorite_styles, dp.favorite_songs,
      dp.partner_search_role, dp.partner_search_level, dp.partner_practice_goals,
      dp.partner_details, dp.looking_for_partner,
      dp.instagram, dp.facebook, dp.whatsapp, dp.website,
      dp.is_active, dp.profile_source, dp.meta_data,
      dp.created_at, dp.updated_at
    FROM public.dancer_profiles dp
    LEFT JOIN public.cities c ON c.id = dp.based_city_id
    WHERE dp.id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_dancer_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_verified" boolean DEFAULT false, "p_reason" "text" DEFAULT NULL::"text", "p_profile_type" "text" DEFAULT NULL::"text", "p_is_primary" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text := lower(COALESCE(p_role, ''));
  v_profile_type text := lower(COALESCE(p_profile_type, public.admin_role_to_profile_type(p_role)));
  v_link_id uuid;
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to manage connectivity';
  END IF;

  IF v_role NOT IN ('organiser', 'teacher', 'dj', 'vendor', 'videographer', 'dancer', 'venue') THEN
    RAISE EXCEPTION 'Unsupported role: %', v_role;
  END IF;

  IF v_profile_type IS NULL THEN
    RAISE EXCEPTION 'Could not infer profile_type for role: %', v_role;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  IF NOT public.admin_profile_exists(v_profile_type, p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found for type % and id %', v_profile_type, p_profile_id;
  END IF;

  -- Role constraints: one primary venue per event
  IF v_role = 'venue' AND p_is_primary THEN
    UPDATE public.event_profile_links l
    SET is_primary = false,
        updated_by = auth.uid(),
        reason = COALESCE(l.reason, 'auto-unset primary due to new primary venue')
    WHERE l.event_id = p_event_id
      AND l.role = 'venue'
      AND l.status = 'active'
      AND l.archived_at IS NULL;
  END IF;

  INSERT INTO public.event_profile_links (
    event_id, profile_id, profile_type, role, verified, is_primary, status, created_by, updated_by, reason, source
  )
  VALUES (
    p_event_id,
    p_profile_id,
    v_profile_type,
    v_role,
    COALESCE(p_verified, false),
    CASE WHEN v_role = 'venue' THEN p_is_primary ELSE false END,
    'active',
    auth.uid(),
    auth.uid(),
    p_reason,
    'manual'
  )
  ON CONFLICT (event_id, profile_id, role, status) DO UPDATE
  SET
    verified = COALESCE(EXCLUDED.verified, event_profile_links.verified),
    is_primary = CASE WHEN v_role = 'venue' THEN EXCLUDED.is_primary ELSE event_profile_links.is_primary END,
    updated_by = auth.uid(),
    reason = COALESCE(EXCLUDED.reason, event_profile_links.reason)
  RETURNING id INTO v_link_id;

  PERFORM public.admin_log_link_action(
    v_link_id,
    p_event_id,
    p_profile_id,
    v_profile_type,
    v_role,
    'create',
    p_reason,
    jsonb_build_object('verified', p_verified, 'is_primary', p_is_primary)
  );

  RETURN jsonb_build_object('ok', true, 'link_id', v_link_id, 'event_id', p_event_id, 'profile_id', p_profile_id, 'role', v_role);
END;
$$;


ALTER FUNCTION "public"."admin_create_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_verified" boolean, "p_reason" "text", "p_profile_type" "text", "p_is_primary" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text" DEFAULT NULL::"text", "p_website" "text" DEFAULT NULL::"text", "p_instagram" "text" DEFAULT NULL::"text", "p_facebook" "text" DEFAULT NULL::"text", "p_team_member_user_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_team_ids             uuid[] := COALESCE(p_team_member_user_ids, ARRAY[]::uuid[]);
  v_duplicate_count      integer := 0;
  v_missing_member_count integer := 0;
  v_full_name            text;
  v_organisation_id      uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_leader_user_id IS NULL THEN
    RAISE EXCEPTION 'leader_user_required';
  END IF;

  IF NULLIF(btrim(coalesce(p_leader_first_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'leader_first_name_required';
  END IF;

  IF NULLIF(btrim(coalesce(p_leader_avatar_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'leader_avatar_required';
  END IF;

  IF NULLIF(btrim(coalesce(p_organisation_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'organisation_name_required';
  END IF;

  IF NULLIF(btrim(coalesce(p_logo_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'organisation_logo_required';
  END IF;

  IF p_primary_city_id IS NULL THEN
    RAISE EXCEPTION 'primary_city_required';
  END IF;

  IF p_category IS NULL OR NOT (p_category = ANY (ARRAY[
    'Promoter',
    'Dance School',
    'Festival Brand',
    'Event Brand',
    'Community Group',
    'Venue',
    'Travel Group',
    'Production Team'
  ])) THEN
    RAISE EXCEPTION 'invalid_organisation_category';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p_leader_user_id) THEN
    RAISE EXCEPTION 'leader_user_not_found';
  END IF;

  SELECT count(*) - count(DISTINCT team_member_id)
    INTO v_duplicate_count
  FROM unnest(v_team_ids) AS team_member_id;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'duplicate_team_member';
  END IF;

  IF p_leader_user_id = ANY (v_team_ids) THEN
    RAISE EXCEPTION 'leader_cannot_be_team_member';
  END IF;

  SELECT count(*)
    INTO v_missing_member_count
  FROM unnest(v_team_ids) AS team_member_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.member_profiles mp
    WHERE mp.id = team_member_id
  );

  IF v_missing_member_count > 0 THEN
    RAISE EXCEPTION 'team_member_not_found';
  END IF;

  v_full_name := NULLIF(btrim(concat_ws(' ', p_leader_first_name, p_leader_last_name)), '');

  -- ── member_profiles upsert ────────────────────────────────────────────
  INSERT INTO public.member_profiles (
    id,
    first_name,
    last_name,
    full_name,
    avatar_url,
    based_city_id
  ) VALUES (
    p_leader_user_id,
    NULLIF(btrim(p_leader_first_name), ''),
    NULLIF(btrim(p_leader_last_name),  ''),
    v_full_name,
    NULLIF(btrim(p_leader_avatar_url), ''),
    p_primary_city_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name    = EXCLUDED.first_name,
    last_name     = EXCLUDED.last_name,
    full_name     = EXCLUDED.full_name,
    avatar_url    = EXCLUDED.avatar_url,
    based_city_id = EXCLUDED.based_city_id;

  -- ── dancer_profiles upsert (replaces dancers INSERT/UPDATE) ──────────
  -- dancer_profiles.id = auth.users.id — no generated UUID needed.
  INSERT INTO public.dancer_profiles (
    id,
    first_name,
    surname,
    avatar_url,
    based_city_id
  ) VALUES (
    p_leader_user_id,
    NULLIF(btrim(p_leader_first_name), ''),
    NULLIF(btrim(p_leader_last_name),  ''),
    NULLIF(btrim(p_leader_avatar_url), ''),
    p_primary_city_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name    = COALESCE(EXCLUDED.first_name,    dancer_profiles.first_name),
    surname       = COALESCE(EXCLUDED.surname,        dancer_profiles.surname),
    avatar_url    = COALESCE(EXCLUDED.avatar_url,     dancer_profiles.avatar_url),
    based_city_id = COALESCE(EXCLUDED.based_city_id,  dancer_profiles.based_city_id);

  -- ── entity + org team ─────────────────────────────────────────────────
  INSERT INTO public.entities (
    id,
    type,
    name,
    avatar_url,
    city_id,
    organisation_category,
    contact_phone,
    website,
    instagram,
    socials,
    claimed_by
  ) VALUES (
    gen_random_uuid(),
    'organiser',
    NULLIF(btrim(p_organisation_name), ''),
    NULLIF(btrim(p_logo_url),          ''),
    p_primary_city_id,
    p_category,
    NULLIF(btrim(p_phone),     ''),
    NULLIF(btrim(p_website),   ''),
    NULLIF(btrim(p_instagram), ''),
    jsonb_build_object('facebook', NULLIF(btrim(p_facebook), '')),
    p_leader_user_id
  )
  RETURNING id INTO v_organisation_id;

  INSERT INTO public.organiser_team_members (
    organiser_entity_id,
    member_profile_id,
    role,
    is_active,
    is_leader
  ) VALUES (
    v_organisation_id,
    p_leader_user_id,
    'Leader',
    true,
    true
  );

  IF cardinality(v_team_ids) > 0 THEN
    INSERT INTO public.organiser_team_members (
      organiser_entity_id,
      member_profile_id,
      role,
      is_active,
      is_leader
    )
    SELECT
      v_organisation_id,
      team_member_id,
      'Member',
      true,
      false
    FROM unnest(v_team_ids) AS team_member_id;
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'organiser_id',       v_organisation_id,
    'leader_user_id',     p_leader_user_id,
    'leader_dancer_id',   p_leader_user_id,   -- now equals auth.users.id
    'team_member_count',  cardinality(v_team_ids),
    'identity_key',       'auth.users.id',
    'team_link_lifecycle','soft_deactivate'
  );
END;
$$;


ALTER FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text", "p_website" "text", "p_instagram" "text", "p_facebook" "text", "p_team_member_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_vendor"("p_target_user_id" "uuid", "p_vendor_payload" "jsonb") RETURNS TABLE("vendor_id" "uuid", "dancer_id" "uuid", "created" boolean, "vendor_row" "jsonb", "completeness" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_admin_sub uuid;
  v_existing_vendor_id uuid;
  v_vendor_rec public.vendors%ROWTYPE;
  v_dancer_id uuid;
  v_photo_url text[] := NULL;
  v_product_categories text[] := NULL;
  v_upcoming_events text[] := NULL;
  v_ensure_result uuid;
BEGIN
  v_admin_sub := auth.uid();

  IF v_admin_sub IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_super_users s
    WHERE s.user_id = v_admin_sub
      AND COALESCE(s.is_active, false) = true
  ) THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  SELECT id
  INTO v_ensure_result
  FROM public.dancers
  WHERE user_id = p_target_user_id
  LIMIT 1;

  IF v_ensure_result IS NULL THEN
    INSERT INTO public.dancers (user_id, created_at)
    VALUES (p_target_user_id, now())
    RETURNING id INTO v_ensure_result;
  END IF;

  v_dancer_id := v_ensure_result;

  IF p_vendor_payload ? 'photo_url'
     AND jsonb_typeof(p_vendor_payload -> 'photo_url') = 'array' THEN
    SELECT array_agg(elem)
    INTO v_photo_url
    FROM (
      SELECT elem::text AS elem
      FROM jsonb_array_elements_text(p_vendor_payload -> 'photo_url') AS elem
    ) s;
  END IF;

  IF p_vendor_payload ? 'product_categories'
     AND jsonb_typeof(p_vendor_payload -> 'product_categories') = 'array' THEN
    SELECT array_agg(elem)
    INTO v_product_categories
    FROM (
      SELECT elem::text AS elem
      FROM jsonb_array_elements_text(p_vendor_payload -> 'product_categories') AS elem
    ) s;
  END IF;

  IF p_vendor_payload ? 'upcoming_events'
     AND jsonb_typeof(p_vendor_payload -> 'upcoming_events') = 'array' THEN
    SELECT array_agg(elem)
    INTO v_upcoming_events
    FROM (
      SELECT elem::text AS elem
      FROM jsonb_array_elements_text(p_vendor_payload -> 'upcoming_events') AS elem
    ) s;
  END IF;

  SELECT id
  INTO v_existing_vendor_id
  FROM public.vendors
  WHERE user_id = p_target_user_id
  LIMIT 1;

  IF v_existing_vendor_id IS NOT NULL THEN
    UPDATE public.vendors
    SET
      business_name = COALESCE((p_vendor_payload ->> 'business_name')::text, business_name),
      photo_url = COALESCE(v_photo_url, photo_url),
      product_categories = COALESCE(v_product_categories, product_categories),
      ships_international = COALESCE((p_vendor_payload ->> 'ships_international')::boolean, ships_international),
      website = COALESCE((p_vendor_payload ->> 'website')::text, website),
      instagram = COALESCE((p_vendor_payload ->> 'instagram')::text, instagram),
      facebook = COALESCE((p_vendor_payload ->> 'facebook')::text, facebook),
      public_email = COALESCE((p_vendor_payload ->> 'public_email')::text, public_email),
      city = CASE
        WHEN p_vendor_payload ? 'city' THEN (p_vendor_payload ->> 'city')::text
        ELSE city
      END,
      products = COALESCE(p_vendor_payload -> 'products', products),
      upcoming_events = COALESCE(v_upcoming_events, upcoming_events),
      whatsapp = COALESCE((p_vendor_payload ->> 'whatsapp')::text, whatsapp),
      promo_code = COALESCE((p_vendor_payload ->> 'promo_code')::text, promo_code),
      meta_data = COALESCE(p_vendor_payload -> 'meta_data', meta_data),
      faq = COALESCE((p_vendor_payload ->> 'faq')::text, faq),
      promo_discount_type = COALESCE((p_vendor_payload ->> 'promo_discount_type')::text, promo_discount_type),
      promo_discount_value = COALESCE(NULLIF(p_vendor_payload ->> 'promo_discount_value', '')::numeric, promo_discount_value),
      team = COALESCE(p_vendor_payload -> 'team', team),
      city_id = COALESCE((p_vendor_payload ->> 'city_id')::uuid, city_id)
    WHERE id = v_existing_vendor_id
    RETURNING * INTO v_vendor_rec;

    vendor_id := v_existing_vendor_id;
    created := false;
  ELSE
    INSERT INTO public.vendors (
      user_id,
      business_name,
      photo_url,
      product_categories,
      ships_international,
      website,
      instagram,
      facebook,
      public_email,
      city,
      products,
      upcoming_events,
      whatsapp,
      promo_code,
      meta_data,
      faq,
      promo_discount_type,
      promo_discount_value,
      team,
      city_id,
      created_at
    )
    VALUES (
      p_target_user_id,
      (p_vendor_payload ->> 'business_name')::text,
      v_photo_url,
      v_product_categories,
      (p_vendor_payload ->> 'ships_international')::boolean,
      (p_vendor_payload ->> 'website')::text,
      (p_vendor_payload ->> 'instagram')::text,
      (p_vendor_payload ->> 'facebook')::text,
      (p_vendor_payload ->> 'public_email')::text,
      CASE
        WHEN p_vendor_payload ? 'city' THEN (p_vendor_payload ->> 'city')::text
        ELSE NULL
      END,
      COALESCE(p_vendor_payload -> 'products', 'null'::jsonb),
      v_upcoming_events,
      (p_vendor_payload ->> 'whatsapp')::text,
      (p_vendor_payload ->> 'promo_code')::text,
      COALESCE(p_vendor_payload -> 'meta_data', '{}'::jsonb),
      (p_vendor_payload ->> 'faq')::text,
      (p_vendor_payload ->> 'promo_discount_type')::text,
      NULLIF(p_vendor_payload ->> 'promo_discount_value', '')::numeric,
      COALESCE(p_vendor_payload -> 'team', '[]'::jsonb),
      (p_vendor_payload ->> 'city_id')::uuid,
      now()
    )
    RETURNING * INTO v_vendor_rec;

    vendor_id := v_vendor_rec.id;
    created := true;
  END IF;

  RETURN QUERY
  SELECT
    v_vendor_rec.id,
    v_dancer_id,
    created,
    to_jsonb(v_vendor_rec),
    public.dancer_completeness(p_target_user_id);
END;
$$;


ALTER FUNCTION "public"."admin_create_vendor"("p_target_user_id" "uuid", "p_vendor_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_venue_v1"("p_payload" "jsonb") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "user_id" "uuid", "name" "text", "photo_url" "text"[], "gallery_urls" "text"[], "video_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "postcode" "text", "google_maps_link" "text", "capacity" integer, "floor_type" "text", "facilities_new" "text"[], "parking_json" "jsonb", "transport_json" "jsonb", "opening_hours" "jsonb", "bar_available" boolean, "cloakroom_available" boolean, "id_required" boolean, "last_entry_time" "text", "venue_rating" numeric, "admin_notes" "text", "description" "text", "faq_json" "jsonb", "meta_data" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_id    uuid;
  v_entity_id uuid;
  v_actor     uuid;
  v_name      text;
  v_city_id   uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_actor   := auth.uid();
  v_name    := NULLIF(btrim(COALESCE(p_payload->>'name', '')), '');
  v_city_id := NULLIF(btrim(COALESCE(p_payload->>'city_id', '')), '')::uuid;

  -- Step 1: Create the canonical entity row (type = 'venue').
  -- city_id is authoritative here; venues.city_id is never written.
  INSERT INTO public.entities (type, name, city_id)
  VALUES ('venue', v_name, v_city_id)
  RETURNING public.entities.id INTO v_entity_id;

  -- Step 2: Insert the venue row, linking it to the new entity.
  INSERT INTO public.venues (
    entity_id,
    name, country, address, postcode, google_maps_link,
    description, capacity, floor_type,
    opening_hours, facilities_new, transport_json, parking_json,
    id_required, bar_available, cloakroom_available,
    venue_rating, photo_url, gallery_urls, video_urls,
    admin_notes, faq_json, meta_data,
    user_id
  )
  VALUES (
    v_entity_id,
    v_name,
    NULLIF(btrim(COALESCE(p_payload->>'country', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'address', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'postcode', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'google_maps_link', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'description', '')), ''),
    (p_payload->>'capacity')::integer,
    NULLIF(btrim(COALESCE(p_payload->>'floor_type', '')), ''),
    p_payload->'opening_hours',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'facilities_new', '[]'::jsonb))),
    COALESCE(p_payload->'transport_json', '{}'::jsonb),
    COALESCE(p_payload->'parking_json', '{}'::jsonb),
    (p_payload->>'id_required')::boolean,
    (p_payload->>'bar_available')::boolean,
    (p_payload->>'cloakroom_available')::boolean,
    (p_payload->>'venue_rating')::numeric,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photo_url',    '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'video_urls',   '[]'::jsonb))),
    NULLIF(btrim(COALESCE(p_payload->>'admin_notes', '')), ''),
    COALESCE(p_payload->'faq_json', '{}'::jsonb),
    COALESCE(p_payload->'meta_data', '{}'::jsonb),
    v_actor
  )
  RETURNING venues.id INTO v_new_id;

  -- Step 3: Return the full row joined with entities for canonical city data.
  RETURN QUERY
    SELECT
      v.entity_id::uuid,
      v.id::uuid,
      v.user_id::uuid,
      v.name::text,
      v.photo_url::text[],
      v.gallery_urls::text[],
      v.video_urls::text[],
      e.city_id::uuid,
      e.city::text,
      v.country::text,
      v.address::text,
      v.postcode::text,
      v.google_maps_link::text,
      v.capacity::integer,
      v.floor_type::text,
      v.facilities_new::text[],
      v.parking_json::jsonb,
      v.transport_json::jsonb,
      v.opening_hours::jsonb,
      v.bar_available::boolean,
      v.cloakroom_available::boolean,
      v.id_required::boolean,
      v.last_entry_time::text,
      v.venue_rating::numeric,
      v.admin_notes::text,
      v.description::text,
      v.faq_json::jsonb,
      v.meta_data::jsonb,
      v.created_at::timestamptz
    FROM public.venues v
    INNER JOIN public.entities e ON e.id = v.entity_id
    WHERE v.id = v_new_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_venue_v1"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_dashboard_events_list_v1"("p_status" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_uid      uuid    := auth.uid();
    v_is_admin boolean := is_admin();
    v_limit    int     := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset   int     := GREATEST(COALESCE(p_offset, 0), 0);
    v_result   jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object(
            'error',       'Unauthorized: authentication required',
            'rows',        '[]'::jsonb,
            'total_count', 0
        );
    END IF;

    SELECT jsonb_build_object(
        'rows',        COALESCE(jsonb_agg(row_obj ORDER BY sort_key ASC NULLS LAST), '[]'::jsonb),
        'total_count', COALESCE(MAX(full_count), 0)
    )
    INTO v_result
    FROM (
        SELECT
            jsonb_build_object(
                -- identity
                'event_id',                   e.id,
                'name',                        e.name,
                -- status
                'lifecycle_status',            e.lifecycle_status,
                'visibility_status',           CASE
                    WHEN e.lifecycle_status = 'published' AND e.is_active = true THEN 'live'
                    WHEN e.lifecycle_status = 'draft'                            THEN 'draft'
                    WHEN e.lifecycle_status = 'archived'                         THEN 'archived'
                    WHEN e.lifecycle_status = 'cancelled'                        THEN 'cancelled'
                    ELSE e.lifecycle_status
                END,
                'is_active',                   e.is_active,
                -- timing
                'next_occurrence_start_time',  occ.next_occ,
                'occurrence_count',            COALESCE(occ.occ_count, 0),
                'schedule_type',               COALESCE(e.schedule_type, e.type),
                -- location
                'city_id',                     e.city_id,
                'city_name',                   c.name,
                'city_slug',                   e.city_slug,
                'venue_name',                  vent.name,
                -- display
                'poster_url',                  e.poster_url,
                'ticket_url',                  e.ticket_url,
                'website',                     e.website,
                -- organiser
                'organiser_name',              org.organiser_name,
                -- audit
                'created_at',                  e.created_at,
                'updated_at',                  e.updated_at
            )                                                   AS row_obj,
            COALESCE(occ.next_occ, e.start_time, e.created_at) AS sort_key,
            COUNT(*) OVER ()                                    AS full_count

        FROM events e

        LEFT JOIN cities c
            ON c.id = e.city_id

        LEFT JOIN venues v
            ON v.id = e.venue_id
        LEFT JOIN entities vent
            ON vent.id = v.entity_id

        LEFT JOIN LATERAL (
            SELECT
                MIN(co.instance_start) FILTER (WHERE co.instance_start >= now()) AS next_occ,
                COUNT(*)                                                          AS occ_count
            FROM calendar_occurrences co
            WHERE co.event_id = e.id
        ) occ ON TRUE

        LEFT JOIN LATERAL (
            SELECT ent_o.name AS organiser_name
            FROM event_entities ee
            JOIN entities ent_o ON ent_o.id = ee.entity_id
            WHERE ee.event_id = e.id
              AND ee.role = 'organiser'
            ORDER BY ent_o.name ASC
            LIMIT 1
        ) org ON TRUE

        WHERE
            (
                v_is_admin
                OR EXISTS (
                    SELECT 1
                    FROM event_entities ee2
                    JOIN entities ent2
                        ON ent2.id = ee2.entity_id
                        AND ent2.type = 'organiser'
                    LEFT JOIN organiser_team_members otm
                        ON otm.organiser_entity_id = ee2.entity_id
                        AND COALESCE(otm.is_active, true)
                    LEFT JOIN LATERAL _member_profile_user_id(otm.member_profile_id) AS tm(user_id)
                        ON TRUE
                    WHERE ee2.event_id = e.id
                      AND ee2.role = 'organiser'
                      AND (
                          ent2.claimed_by = v_uid
                          OR tm.user_id   = v_uid
                      )
                )
            )
            AND (p_status  IS NULL OR e.lifecycle_status = p_status)
            AND (p_city_id IS NULL OR e.city_id          = p_city_id)
            -- p_search matches event name OR city name (parity with old client-side filter)
            AND (
                p_search IS NULL
                OR e.name ILIKE '%' || p_search || '%'
                OR c.name ILIKE '%' || p_search || '%'
            )

        ORDER BY sort_key ASC NULLS LAST
        LIMIT  v_limit
        OFFSET v_offset
    ) sub;

    RETURN COALESCE(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total_count', 0));
END;
$$;


ALTER FUNCTION "public"."admin_dashboard_events_list_v1"("p_status" "text", "p_search" "text", "p_city_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_dashboard_summary"() RETURNS TABLE("incomplete_profiles_count" bigint, "draft_events_count" bigint, "upcoming_events_count" bigint, "events_missing_key_data_count" bigint, "last_event_audit_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
SELECT
  (SELECT COUNT(1)
   FROM public.profiles p
   WHERE
     (p.full_name IS NULL OR trim(p.full_name) = '')
     OR (p.email IS NULL OR trim(p.email) = '')
  )::bigint AS incomplete_profiles_count,

  (SELECT COUNT(1)
   FROM public.events e
   WHERE
     (e.lifecycle_status IS NOT NULL AND lower(e.lifecycle_status) = 'draft')
     OR (e.lifecycle_status IS NULL AND coalesce(e.is_published, false) = false)
  )::bigint AS draft_events_count,

  (SELECT COUNT(1)
   FROM public.events e
   WHERE
     (
       e.date IS NOT NULL AND e.date >= current_date
     )
     OR (
       e.date IS NULL AND e.start_time IS NOT NULL AND e.start_time >= now()
     )
  )::bigint AS upcoming_events_count,

  (SELECT COUNT(1)
   FROM public.events e
   WHERE
     e.organiser_id IS NULL
     OR (
       e.date IS NULL
       AND (
         e.instances IS NULL
         OR (jsonb_typeof(e.instances) = 'array' AND jsonb_array_length(e.instances) = 0)
       )
       AND e.recurrence IS NULL
     )
  )::bigint AS events_missing_key_data_count,

  (SELECT MAX(created_at) FROM public.event_audit) AS last_event_audit_at;
$$;


ALTER FUNCTION "public"."admin_dashboard_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_organiser"("p_organiser_entity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_entity_id      uuid;
  v_event_links    integer := 0;
BEGIN
  -- Admin guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_organiser_entity_id IS NULL THEN
    RAISE EXCEPTION 'organiser_entity_id_required';
  END IF;

  -- Verify the entity exists and is an organiser
  SELECT e.id INTO v_entity_id
  FROM public.entities e
  WHERE e.id = p_organiser_entity_id AND e.type = 'organiser';

  IF v_entity_id IS NULL THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'event_links', 0,
      'organiser_entity_id', p_organiser_entity_id
    );
  END IF;

  -- Check for linked events via event_entities
  SELECT count(*) INTO v_event_links
  FROM public.event_entities ee
  WHERE ee.entity_id = v_entity_id;

  IF v_event_links > 0 THEN
    RETURN jsonb_build_object(
      'deleted', false,
      'reason', 'has_linked_events',
      'event_links', v_event_links,
      'organiser_entity_id', v_entity_id
    );
  END IF;

  -- Remove team members
  DELETE FROM public.organiser_team_members
  WHERE organiser_entity_id = v_entity_id;

  -- Remove the entity
  DELETE FROM public.entities
  WHERE id = v_entity_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'reason', 'deleted',
    'event_links', 0,
    'organiser_entity_id', v_entity_id
  );
END;
$$;


ALTER FUNCTION "public"."admin_delete_organiser"("p_organiser_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_timezone" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_city_id uuid := p_city_id;
  v_venue_id uuid;
BEGIN
  INSERT INTO public.rpc_city_compat_audit (
    rpc_name,
    request_role,
    request_sub,
    request_iss,
    auth_uid,
    has_city,
    has_city_slug,
    has_city_id
  )
  VALUES (
    'admin_event_create_draft',
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.iss', true),
    auth.uid(),
    false,
    (p_city_slug IS NOT NULL),
    (p_city_id IS NOT NULL)
  );

  IF p_city_slug IS NOT NULL THEN
    RAISE EXCEPTION 'city_slug_retired_use_city_id' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.id INTO v_venue_id
  FROM public.venues v
  ORDER BY v.created_at NULLS LAST, v.id
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'no_venues_available_for_draft' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.events (
    id, name, city_id, venue_id, timezone, lifecycle_status, is_published, created_by, created_at, updated_at
  ) VALUES (
    v_event_id, p_name, v_city_id, v_venue_id, COALESCE(p_timezone, 'UTC'), 'draft', false, p_created_by, now(), now()
  );

  RETURN v_event_id;
END;
$$;


ALTER FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_timezone" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_country" "text", "p_timezone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_city_id uuid := p_city_id;
  v_venue_id uuid;
BEGIN
  INSERT INTO public.rpc_city_compat_audit (
    rpc_name,
    request_role,
    request_sub,
    request_iss,
    auth_uid,
    has_city,
    has_city_slug,
    has_city_id
  )
  VALUES (
    'admin_event_create_draft',
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.iss', true),
    auth.uid(),
    (p_city IS NOT NULL),
    (p_city_slug IS NOT NULL),
    (p_city_id IS NOT NULL)
  );

  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
     RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_city IS NOT NULL THEN
    RAISE EXCEPTION 'city_retired_use_city_id' USING ERRCODE = 'P0001';
  END IF;

  IF p_city_slug IS NOT NULL THEN
    RAISE EXCEPTION 'city_slug_retired_use_city_id' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.id INTO v_venue_id
  FROM public.venues v
  ORDER BY v.created_at NULLS LAST, v.id
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'no_venues_available_for_draft' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.events (
     id,
     name,
     country,
     city_id,
     venue_id,
     timezone,
     lifecycle_status,
     is_active,
     created_by,
     created_at,
     updated_at
  )
  VALUES (
     v_event_id,
     p_name,
     p_country,
     v_city_id,
     v_venue_id,
     p_timezone,
     'draft',
     false,
     auth.uid(),
     now(),
     now()
  );

  RETURN v_event_id;
END;
$$;


ALTER FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_country" "text", "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_publish"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_row record;
  v_missing text := '';
BEGIN

IF NOT public.is_admin() THEN
  RAISE EXCEPTION 'admin_only';
END IF;

SELECT id, name, city_id, date, start_time
INTO v_row
FROM public.events
WHERE id = p_event_id;

IF NOT FOUND THEN
  RAISE EXCEPTION 'event_not_found';
END IF;

IF v_row.name IS NULL THEN
  v_missing := v_missing || 'name,';
END IF;

IF v_row.date IS NULL THEN
  v_missing := v_missing || 'date,';
END IF;

IF v_row.start_time IS NULL THEN
  v_missing := v_missing || 'start_time,';
END IF;

IF v_row.city_id IS NULL THEN
  v_missing := v_missing || 'city_id,';
END IF;

IF v_missing <> '' THEN
  RAISE EXCEPTION 'cannot_publish_missing_fields: %', left(v_missing,-1);
END IF;

UPDATE public.events
SET lifecycle_status = 'published',
    is_active = true,
    updated_at = now()
WHERE id = p_event_id;

RETURN true;

END;
$$;


ALTER FUNCTION "public"."admin_event_publish"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_key text;
  -- Phase 1 contract freeze: legacy RPC is non-authoritative for organiser data.
  v_disallowed constant text[] := ARRAY[
    'organiser_id','organiser_ids','organisers','organiser_entity_ids','organiserEntityIds',
    'teacher_ids','dj_ids','vendor_ids','videographer_ids','city','city_slug','location','instances'
  ];
BEGIN
  INSERT INTO public.rpc_city_compat_audit (
    rpc_name,
    request_role,
    request_sub,
    request_iss,
    auth_uid,
    has_city,
    has_city_slug,
    has_city_id
  )
  VALUES (
    'admin_event_update',
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.iss', true),
    auth.uid(),
    (coalesce(p_patch, '{}'::jsonb) ? 'city'),
    (coalesce(p_patch, '{}'::jsonb) ? 'city_slug'),
    (coalesce(p_patch, '{}'::jsonb) ? 'city_id')
  );

  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
     RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_event_id IS NULL THEN
     RAISE EXCEPTION 'p_event_id_required';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
     RAISE EXCEPTION 'p_patch_must_be_object';
  END IF;

  -- Phase 2 hard-gate: block organiser-related mutation on legacy surface.
  FOREACH v_key IN ARRAY v_disallowed LOOP
    IF p_patch ? v_key THEN
      RAISE EXCEPTION 'legacy_organiser_contract_blocked: %', v_key USING ERRCODE='P0001';
    END IF;
  END LOOP;

  -- Allowlist update of canonical/simple fields only
  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key IN ('venue_id','name','description','is_published','facebook_url','has_guestlist','instagram_url','pricing','recurrence','ticket_url','website','guestlist_config','key_times','tickets','schedule_type','festival_config','is_active','meta_data','date','start_time','end_time','faq','country','timezone','city_id','poster_url','lifecycle_status') THEN
      IF v_key IN ('venue_id','city_id') THEN
        EXECUTE format('UPDATE public.events SET %I = $1::uuid, updated_at = now() WHERE id = $2', v_key)
        USING (p_patch ->> v_key), p_event_id;
      ELSIF v_key IN ('is_published','has_guestlist','is_active') THEN
        EXECUTE format('UPDATE public.events SET %I = ($1)::boolean, updated_at = now() WHERE id = $2', v_key)
        USING (p_patch ->> v_key), p_event_id;
      ELSIF v_key IN ('date') THEN
        EXECUTE format('UPDATE public.events SET %I = ($1)::date, updated_at = now() WHERE id = $2', v_key)
        USING (p_patch ->> v_key), p_event_id;
      ELSIF v_key IN ('start_time','end_time') THEN
        EXECUTE format('UPDATE public.events SET %I = ($1)::timestamptz, updated_at = now() WHERE id = $2', v_key)
        USING (p_patch ->> v_key), p_event_id;
      ELSE
        EXECUTE format('UPDATE public.events SET %I = $1, updated_at = now() WHERE id = $2', v_key)
        USING (p_patch ->> v_key), p_event_id;
      END IF;
    ELSE
      CONTINUE;
    END IF;
  END LOOP;

  RETURN p_event_id;
END;
$_$;


ALTER FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb") IS 'LEGACY RPC: non-authoritative for organiser contract. Organiser save authority is admin_save_event_v2; organiser reload authority is admin_get_event_snapshot_v2. Do not use for organiser linkage.';



CREATE OR REPLACE FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_next jsonb := COALESCE(p_patch, '{}'::jsonb);
  v_city_id uuid := NULL;
  v_has_city_change boolean := false;
  v_has_venue boolean := false;
BEGIN
  INSERT INTO public.rpc_city_compat_audit (
    rpc_name,
    request_role,
    request_sub,
    request_iss,
    auth_uid,
    has_city,
    has_city_slug,
    has_city_id
  )
  VALUES (
    'admin_event_update',
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.iss', true),
    auth.uid(),
    (coalesce(p_patch, '{}'::jsonb) ? 'city'),
    (coalesce(p_patch, '{}'::jsonb) ? 'city_slug'),
    (coalesce(p_patch, '{}'::jsonb) ? 'city_id')
  );

  IF v_next ?| ARRAY['organiser_id','organiser_ids','organisers','organiser_entity_ids','organiserEntityIds','teacher_ids','dj_ids','vendor_ids','videographer_ids','city','city_slug'] THEN
    RAISE EXCEPTION 'legacy_organiser_contract_blocked' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found', p_event_id;
  END IF;

  v_has_venue := v_event.venue_id IS NOT NULL;

  IF v_next ? 'city_id' THEN
    v_city_id := (v_next ->> 'city_id')::uuid;
    v_has_city_change := true;
  END IF;

  IF v_has_venue AND v_has_city_change THEN
    v_next := v_next - 'city_id';
  END IF;

  UPDATE public.events e
  SET
    name = COALESCE((v_next ->> 'name'), e.name),
    date = COALESCE((v_next ->> 'date')::date, e.date),
    start_time = COALESCE((v_next ->> 'start_time')::timestamptz, e.start_time),
    end_time = COALESCE((v_next ->> 'end_time')::timestamptz, e.end_time),
    description = COALESCE((v_next ->> 'description'), e.description),
    timezone = COALESCE((v_next ->> 'timezone'), e.timezone),
    city_id = COALESCE(v_city_id, e.city_id),
    website = COALESCE((v_next ->> 'website'), e.website),
    ticket_url = COALESCE((v_next ->> 'ticket_url'), e.ticket_url),
    instagram_url = COALESCE((v_next ->> 'instagram_url'), e.instagram_url),
    facebook_url = COALESCE((v_next ->> 'facebook_url'), e.facebook_url),
    meta_data = COALESCE(NULLIF(v_next -> 'meta_data', 'null'::jsonb), e.meta_data),
    key_times = COALESCE(NULLIF(v_next -> 'key_times', 'null'::jsonb), e.key_times),
    is_published = COALESCE((v_next ->> 'is_published')::boolean, e.is_published),
    lifecycle_status = COALESCE((v_next ->> 'lifecycle_status'), e.lifecycle_status),
    updated_at = now()
  WHERE e.id = p_event_id;

END;
$$;


ALTER FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb", "p_actor_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb", "p_actor_user_id" "uuid") IS 'LEGACY RPC: non-authoritative for organiser contract. Organiser save authority is admin_save_event_v2; organiser reload authority is admin_get_event_snapshot_v2. Do not use for organiser linkage.';



CREATE OR REPLACE FUNCTION "public"."admin_generate_event_link_suggestions"("p_event_id" "uuid", "p_role" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 30) RETURNS TABLE("suggestion_id" "uuid", "event_id" "uuid", "profile_id" "uuid", "profile_type" "text", "role" "text", "confidence" numeric, "reason" "text", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text := lower(COALESCE(p_role, ''));
  v_event_city_id uuid;
  v_event_city_slug text;
  v_event_city text;
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to manage connectivity';
  END IF;

  SELECT NULLIF(COALESCE(to_jsonb(e) ->> 'city_id', ''), '')::uuid, NULLIF(COALESCE(e.city_slug, ''), ''), NULLIF(COALESCE(e.city, ''), '')
  INTO v_event_city_id, v_event_city_slug, v_event_city
  FROM public.events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  IF v_role IS NULL OR v_role = 'teacher' THEN
    INSERT INTO public.event_profile_link_suggestions (event_id, profile_id, profile_type, role, confidence, reason, source)
    SELECT p_event_id, t.id, 'teacher', 'teacher', 85, 'city match', 'city_match'
    FROM public.teacher_profiles t
    WHERE public.admin_row_city_matches(to_jsonb(t), v_event_city_id, v_event_city_slug, v_event_city)
      AND NOT EXISTS (SELECT 1 FROM public.event_profile_links l WHERE l.event_id = p_event_id AND l.profile_id = t.id AND l.role = 'teacher' AND l.status = 'active' AND l.archived_at IS NULL)
    LIMIT p_limit
    ON CONFLICT (event_id, profile_id, role, status) DO UPDATE SET updated_at = now(), reason = EXCLUDED.reason, confidence = EXCLUDED.confidence;
  END IF;

  IF v_role IS NULL OR v_role = 'dj' THEN
    INSERT INTO public.event_profile_link_suggestions (event_id, profile_id, profile_type, role, confidence, reason, source)
    SELECT p_event_id, d.id, 'dj', 'dj', 85, 'city match', 'city_match'
    FROM public.dj_profiles d
    WHERE public.admin_row_city_matches(to_jsonb(d), v_event_city_id, v_event_city_slug, v_event_city)
      AND NOT EXISTS (SELECT 1 FROM public.event_profile_links l WHERE l.event_id = p_event_id AND l.profile_id = d.id AND l.role = 'dj' AND l.status = 'active' AND l.archived_at IS NULL)
    LIMIT p_limit
    ON CONFLICT (event_id, profile_id, role, status) DO UPDATE SET updated_at = now(), reason = EXCLUDED.reason, confidence = EXCLUDED.confidence;
  END IF;

  IF v_role IS NULL OR v_role = 'vendor' THEN
    INSERT INTO public.event_profile_link_suggestions (event_id, profile_id, profile_type, role, confidence, reason, source)
    SELECT p_event_id, v.id, 'vendor', 'vendor', 80, 'city match', 'city_match'
    FROM public.vendors v
    WHERE public.admin_row_city_matches(to_jsonb(v), v_event_city_id, v_event_city_slug, v_event_city)
      AND NOT EXISTS (SELECT 1 FROM public.event_profile_links l WHERE l.event_id = p_event_id AND l.profile_id = v.id AND l.role = 'vendor' AND l.status = 'active' AND l.archived_at IS NULL)
    LIMIT p_limit
    ON CONFLICT (event_id, profile_id, role, status) DO UPDATE SET updated_at = now(), reason = EXCLUDED.reason, confidence = EXCLUDED.confidence;
  END IF;

  IF v_role IS NULL OR v_role = 'videographer' THEN
    INSERT INTO public.event_profile_link_suggestions (event_id, profile_id, profile_type, role, confidence, reason, source)
    SELECT p_event_id, vg.id, 'videographer', 'videographer', 80, 'city match', 'city_match'
    FROM public.videographers vg
    WHERE public.admin_row_city_matches(to_jsonb(vg), v_event_city_id, v_event_city_slug, v_event_city)
      AND NOT EXISTS (SELECT 1 FROM public.event_profile_links l WHERE l.event_id = p_event_id AND l.profile_id = vg.id AND l.role = 'videographer' AND l.status = 'active' AND l.archived_at IS NULL)
    LIMIT p_limit
    ON CONFLICT (event_id, profile_id, role, status) DO UPDATE SET updated_at = now(), reason = EXCLUDED.reason, confidence = EXCLUDED.confidence;
  END IF;

  IF v_role IS NULL OR v_role = 'venue' THEN
    INSERT INTO public.event_profile_link_suggestions (event_id, profile_id, profile_type, role, confidence, reason, source)
    SELECT p_event_id, ve.id, 'venue', 'venue', 90, 'city match (primary venue candidate)', 'city_match'
    FROM public.venues ve
    LEFT JOIN public.entities ent ON ent.id = ve.entity_id
    LEFT JOIN public.cities c ON c.id = ent.city_id
    WHERE public.admin_row_city_matches(jsonb_build_object('id', ve.id, 'entity_id', ve.entity_id, 'name', ent.name, 'city_id', ent.city_id, 'city_slug', c.slug, 'city', c.name), v_event_city_id, v_event_city_slug, v_event_city)
      AND NOT EXISTS (SELECT 1 FROM public.event_profile_links l WHERE l.event_id = p_event_id AND l.profile_id = ve.id AND l.role = 'venue' AND l.status = 'active' AND l.archived_at IS NULL)
    LIMIT 1
    ON CONFLICT (event_id, profile_id, role, status) DO UPDATE SET updated_at = now(), reason = EXCLUDED.reason, confidence = EXCLUDED.confidence;
  END IF;

  RETURN QUERY
  SELECT s.id, s.event_id, s.profile_id, s.profile_type, s.role, s.confidence, s.reason, s.status
  FROM public.event_profile_link_suggestions s
  WHERE s.event_id = p_event_id AND s.status = 'pending' AND (v_role IS NULL OR s.role = v_role)
  ORDER BY s.confidence DESC, s.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."admin_generate_event_link_suggestions"("p_event_id" "uuid", "p_role" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_broken_reference_queue"("p_limit" integer DEFAULT 200) RETURNS TABLE("event_id" "uuid", "role" "text", "broken_profile_id" "text", "source" "text", "detail" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH broken_arrays AS (
    SELECT l.event_id, l.profile_type AS role, l.profile_id::text, 
           'event_profile_links'::text AS source
    FROM public.event_profile_links l
    WHERE l.status = 'active' AND l.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.teacher_profiles WHERE id = l.profile_id
        UNION ALL SELECT 1 FROM public.dj_profiles WHERE id = l.profile_id
        UNION ALL SELECT 1 FROM public.organisers WHERE id = l.profile_id
        UNION ALL SELECT 1 FROM public.vendors WHERE id = l.profile_id
        UNION ALL SELECT 1 FROM public.videographers WHERE id = l.profile_id
        UNION ALL SELECT 1 FROM public.dancer_profiles WHERE id = l.profile_id
      )
  ),
  broken_graph AS (
    SELECT
      l.event_id,
      l.role,
      l.profile_id::text AS broken_profile_id,
      'event_profile_links'::text AS source
    FROM public.event_profile_links l
    WHERE l.status = 'active'
      AND l.archived_at IS NULL
      AND (
        NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = l.event_id)
        OR NOT public.admin_profile_exists(l.profile_type, l.profile_id)
      )
  )
  SELECT
    b.event_id,
    b.role,
    b.profile_id AS broken_profile_id,
    b.source,
    'missing target record'::text AS detail
  FROM broken_arrays b

  UNION ALL

  SELECT
    g.event_id,
    g.role,
    g.broken_profile_id,
    g.source,
    'broken graph link target'::text AS detail
  FROM broken_graph g

  ORDER BY event_id
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;


ALTER FUNCTION "public"."admin_get_broken_reference_queue"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_connectivity_health_metrics"("p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text") RETURNS TABLE("published_events_with_organiser_pct" numeric, "published_events_with_venue_pct" numeric, "profiles_linked_to_at_least_one_event_pct" numeric, "unlinked_events_count" bigint, "unlinked_profiles_count" bigint, "unresolved_city_mappings_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to read connectivity health metrics';
  END IF;

  RETURN QUERY
  WITH filtered_events AS (
    SELECT e.*
    FROM public.events e
    WHERE public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
  ),
  published_events AS (
    SELECT e.*
    FROM filtered_events e
    WHERE COALESCE(e.lifecycle_status = 'published', false) OR COALESCE(e.is_active, false)
  ),
  event_roles AS (
    SELECT
      e.id,
      EXISTS (
        SELECT 1 FROM public.event_profile_links l
        WHERE l.event_id = e.id
          AND l.profile_type = 'organiser'
          AND l.status = 'active'
          AND l.archived_at IS NULL
      ) AS has_organiser,
      (
        e.venue_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.event_profile_links l
          WHERE l.event_id = e.id
            AND l.profile_type = 'venue'
            AND l.status = 'active'
            AND l.archived_at IS NULL
        )
      ) AS has_venue
    FROM published_events e
  ),
  profile_universe AS (
    SELECT 'teacher'::text AS profile_type, t.id AS profile_id, to_jsonb(t) AS row_json FROM public.teacher_profiles t
    UNION ALL SELECT 'dj', d.id, to_jsonb(d) FROM public.dj_profiles d
    UNION ALL SELECT 'organiser', o.id, to_jsonb(o) FROM public.organisers o
    UNION ALL SELECT 'vendor', v.id, to_jsonb(v) FROM public.vendors v
    UNION ALL SELECT 'videographer', vg.id, to_jsonb(vg) FROM public.videographers vg
    UNION ALL SELECT 'dancer', da.id,
                     to_jsonb(da) || jsonb_build_object('city_id', da.based_city_id)
              FROM public.dancer_profiles da
    UNION ALL SELECT 'venue', ve.id, to_jsonb(ve) FROM public.venues ve
  ),
  filtered_profiles AS (
    SELECT pu.profile_type, pu.profile_id
    FROM profile_universe pu
    WHERE public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  linked_profiles AS (
    SELECT DISTINCT l.profile_type, l.profile_id::text AS profile_id
    FROM public.event_profile_links l
    JOIN filtered_events e ON e.id = l.event_id
    WHERE l.status = 'active' AND l.archived_at IS NULL

    UNION

    SELECT 'venue', e.venue_id::text FROM filtered_events e WHERE e.venue_id IS NOT NULL
  ),
  unresolved_city AS (
    SELECT COUNT(*) AS total
    FROM public.admin_unresolved_city_mappings_v v
    WHERE public.admin_row_city_matches(
      jsonb_build_object(
        'city_id', v.city_id_text,
        'city_slug', v.city_slug,
        'city', v.city
      ),
      p_city_id,
      p_city_slug,
      p_city
    )
  )
  SELECT
    COALESCE(ROUND((COUNT(*) FILTER (WHERE er.has_organiser)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2), 0) AS published_events_with_organiser_pct,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE er.has_venue)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2), 0) AS published_events_with_venue_pct,
    COALESCE(
      ROUND(
        (
          (SELECT COUNT(*)::numeric FROM filtered_profiles fp
             WHERE EXISTS (
               SELECT 1 FROM linked_profiles lp
               WHERE lp.profile_type = fp.profile_type
                 AND lp.profile_id = fp.profile_id::text
             )
          )
          /
          NULLIF((SELECT COUNT(*)::numeric FROM filtered_profiles), 0)
        ) * 100,
      2),
    0) AS profiles_linked_to_at_least_one_event_pct,
    COALESCE((SELECT COUNT(*) FROM event_roles er2 WHERE (NOT er2.has_organiser OR NOT er2.has_venue)), 0) AS unlinked_events_count,
    COALESCE((SELECT COUNT(*) FROM filtered_profiles fp
              WHERE NOT EXISTS (
                SELECT 1 FROM linked_profiles lp
                WHERE lp.profile_type = fp.profile_type
                  AND lp.profile_id = fp.profile_id::text
              )), 0) AS unlinked_profiles_count,
    COALESCE((SELECT total FROM unresolved_city), 0) AS unresolved_city_mappings_count
  FROM event_roles er;
END;
$$;


ALTER FUNCTION "public"."admin_get_connectivity_health_metrics"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_dancer_v1"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "dance_role" "text", "dance_started_year" integer, "nationality" "text", "gallery_urls" "text"[], "achievements" "text"[], "favorite_styles" "text"[], "favorite_songs" "text"[], "partner_search_role" "text", "partner_search_level" "text"[], "partner_practice_goals" "text"[], "partner_details" "text", "looking_for_partner" boolean, "instagram" "text", "facebook" "text", "whatsapp" "text", "website" "text", "is_active" boolean, "profile_source" "text", "meta_data" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id,
    dp.first_name,
    dp.surname,
    dp.avatar_url,
    dp.based_city_id,
    c.name AS city,
    dp.dance_role,
    dp.dance_started_year,
    dp.nationality,
    dp.gallery_urls,
    dp.achievements,
    dp.favorite_styles,
    dp.favorite_songs,
    dp.partner_search_role,
    dp.partner_search_level,
    dp.partner_practice_goals,
    dp.partner_details,
    dp.looking_for_partner,
    dp.instagram,
    dp.facebook,
    dp.whatsapp,
    dp.website,
    dp.is_active,
    dp.profile_source,
    dp.meta_data,
    dp.created_at,
    dp.updated_at
  FROM public.dancer_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.based_city_id
  WHERE dp.id = p_user_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."admin_get_dancer_v1"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "dj_name" "text", "first_name" "text", "surname" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "nationality" "text", "genres" "text"[], "soundcloud" "text", "youtube_url" "text", "mixcloud" "text", "pricing" "text", "upcoming_events" "text"[], "whatsapp" "text", "faq" "text", "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text", "is_active" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id           AS entity_id,
    dp.id,
    dp.dj_name,
    dp.first_name,
    dp.surname,
    dp.photo_url,
    dp.gallery_urls,
    dp.city_id,
    c.name          AS city,
    dp.nationality,
    dp.genres,
    dp.soundcloud,
    dp.youtube_url,
    dp.mixcloud,
    dp.pricing,
    dp.upcoming_events,
    dp.whatsapp,
    dp.faq,
    dp.website,
    dp.instagram,
    dp.facebook,
    dp.email,
    dp.phone,
    dp.is_active,
    dp.meta_data,
    dp.profile_source,
    dp.created_at::timestamptz,
    dp.updated_at
  FROM public.dj_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.city_id
  WHERE dp.id = p_entity_id;
$$;


ALTER FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_djs_by_ids_v1"("p_ids" "uuid"[]) RETURNS TABLE("entity_id" "uuid", "id" "uuid", "dj_name" "text", "first_name" "text", "surname" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "nationality" "text", "genres" "text"[], "soundcloud" "text", "youtube_url" "text", "mixcloud" "text", "upcoming_events" "text"[], "pricing" "text", "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text", "whatsapp" "text", "faq" "text", "meta_data" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    d.id AS entity_id,
    d.id,
    d.dj_name,
    d.first_name,
    d.surname,
    d.photo_url,
    d.gallery_urls,
    d.city_id,
    d.city,
    d.country,
    d.nationality,
    d.genres,
    d.soundcloud,
    d.youtube_url,
    d.mixcloud,
    d.upcoming_events,
    d.pricing,
    d.website,
    d.instagram,
    d.facebook,
    d.email,
    d.phone,
    d.whatsapp,
    d.faq,
    d.meta_data
  FROM public.dj_profiles d
  WHERE d.id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."admin_get_djs_by_ids_v1"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_event_organiser_ids_v1"("p_event_id" "uuid") RETURNS TABLE("entity_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ee.entity_id
  FROM public.event_entities ee
  WHERE ee.event_id = p_event_id
    AND ee.role = 'organiser';
$$;


ALTER FUNCTION "public"."admin_get_event_organiser_ids_v1"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_event_organiser_links_batch_v1"("p_event_ids" "uuid"[]) RETURNS TABLE("event_id" "uuid", "entity_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ee.event_id, ee.entity_id
  FROM public.event_entities ee
  WHERE ee.event_id = ANY(p_event_ids)
    AND ee.role = 'organiser';
$$;


ALTER FUNCTION "public"."admin_get_event_organiser_links_batch_v1"("p_event_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_event_snapshot_v2"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_event               jsonb;
  v_occ                 jsonb := '[]'::jsonb;
  v_org_ids             uuid[] := array[]::uuid[];
  v_teacher_ids         jsonb := '[]'::jsonb;
  v_mc_ids              jsonb := '[]'::jsonb;
  v_performer_ids       jsonb := '[]'::jsonb;
  v_guest_series        jsonb := '[]'::jsonb;
  v_guest_by_occurrence jsonb := '{}'::jsonb;
begin
  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'description', e.description,
    'venue_id', e.venue_id,
    'is_published', e.is_published,
    'created_at', e.created_at,
    'created_by', e.created_by,
    'facebook_url', e.facebook_url,
    'has_guestlist', e.has_guestlist,
    'has_raffle', e.has_raffle,
    'instagram_url', e.instagram_url,
    'payment_methods', e.payment_methods,
    'pricing', e.pricing,
    'recurrence', e.recurrence,
    'ticket_url', e.ticket_url,
    'user_id', e.user_id,
    'website', e.website,
    'guestlist_config', e.guestlist_config,
    'key_times', e.key_times,
    'promo_codes', e.promo_codes,
    'raffle_config', e.raffle_config,
    'tickets', e.tickets,
    'schedule_type', e.schedule_type,
    'festival_config', e.festival_config,
    'is_active', e.is_active,
    'meta_data', e.meta_data,
    'type', e.type,
    'attendance_count', e.attendance_count,
    'date', e.date,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'faq', e.faq,
    'country', e.country,
    'timezone', e.timezone,
    'city_slug', c_evt_resolved.slug,
    'lifecycle_status', e.lifecycle_status,
    'updated_at', e.updated_at,
    'city_id', c_evt_resolved.id,
    'poster_url', e.poster_url,
    'parent_event_id', e.parent_event_id,
    'source_occurrence_id', e.source_occurrence_id,
    'city_display', jsonb_build_object(
      'name', c_evt_resolved.name,
      'slug', c_evt_resolved.slug,
      'is_derived', true,
      'authoritative_source', 'entity_city_projection'
    )
  )
  into v_event
  from public.events e
  left join public.venues v_evt on v_evt.id = e.venue_id
  left join public.entities ve_evt on ve_evt.id = v_evt.entity_id
  left join public.cities c_evt_resolved on c_evt_resolved.id = coalesce(ve_evt.city_id, e.city_id)
  where e.id = p_event_id;

  if v_event is null then
    raise exception 'event % not found', p_event_id using errcode = '22000';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', co.id,
               'event_id', co.event_id,
               'instance_start', co.instance_start,
               'instance_end', co.instance_end,
               'source', co.source,
               'is_override', co.is_override,
               'override_payload', co.override_payload,
               'city_id', c_occ_resolved.id,
               'city_slug', c_occ_resolved.slug,
               'city_display', jsonb_build_object(
                 'name', c_occ_resolved.name,
                 'slug', c_occ_resolved.slug,
                 'is_derived', true,
                 'authoritative_source', 'entity_city_projection'
               ),
               'lifecycle_status', co.lifecycle_status,
               'created_at', co.created_at,
               'updated_at', co.updated_at,
               'venue_id', co.venue_id
             )
             order by co.instance_start, co.id
           ),
           '[]'::jsonb
         )
  into v_occ
  from public.calendar_occurrences co
  left join public.events e on e.id = co.event_id
  left join public.venues v_occ on v_occ.id = co.venue_id
  left join public.entities ve_occ on ve_occ.id = v_occ.entity_id
  left join public.venues v_evt on v_evt.id = e.venue_id
  left join public.entities ve_evt on ve_evt.id = v_evt.entity_id
  left join public.cities c_occ_resolved
    on c_occ_resolved.id = coalesce(ve_occ.city_id, co.city_id, ve_evt.city_id, e.city_id)
  where co.event_id = p_event_id;

  select coalesce(array_agg(src.entity_id order by src.first_seen_at, src.entity_id), array[]::uuid[])
  into v_org_ids
  from (
    select ee.entity_id, min(ee.created_at) as first_seen_at
    from public.event_entities ee
    where ee.event_id = p_event_id
      and ee.role = 'organiser'
    group by ee.entity_id
  ) src;

  -- Teachers (role = 'teacher')
  select coalesce(
           jsonb_agg(distinct epl.profile_id) FILTER (WHERE epl.profile_id IS NOT NULL),
           '[]'::jsonb
         )
  into v_teacher_ids
  from public.event_profile_links epl
  where epl.event_id = p_event_id
    and epl.role = 'teacher'
    and epl.status = 'active'
    and epl.archived_at is null;

  -- MCs / hosts (role = 'hosting')
  select coalesce(
           jsonb_agg(distinct epl.profile_id) FILTER (WHERE epl.profile_id IS NOT NULL),
           '[]'::jsonb
         )
  into v_mc_ids
  from public.event_profile_links epl
  where epl.event_id = p_event_id
    and epl.role = 'hosting'
    and epl.status = 'active'
    and epl.archived_at is null;

  -- Performers (role = 'performing')
  select coalesce(
           jsonb_agg(distinct epl.profile_id) FILTER (WHERE epl.profile_id IS NOT NULL),
           '[]'::jsonb
         )
  into v_performer_ids
  from public.event_profile_links epl
  where epl.event_id = p_event_id
    and epl.role = 'performing'
    and epl.status = 'active'
    and epl.archived_at is null;

  -- Guest dancers: series (event-level, occurrence_id IS NULL)
  select coalesce(
           jsonb_agg(distinct epl.profile_id) FILTER (WHERE epl.profile_id IS NOT NULL),
           '[]'::jsonb
         )
  into v_guest_series
  from public.event_profile_links epl
  where epl.event_id = p_event_id
    and epl.role = 'dancer'
    and epl.occurrence_id is null;

  -- Guest dancers: per-occurrence
  select coalesce(
           jsonb_object_agg(src.occurrence_id, src.profile_ids),
           '{}'::jsonb
         )
  into v_guest_by_occurrence
  from (
    select
      epl.occurrence_id::text as occurrence_id,
      coalesce(
        jsonb_agg(distinct epl.profile_id) FILTER (WHERE epl.profile_id IS NOT NULL),
        '[]'::jsonb
      ) as profile_ids
    from public.event_profile_links epl
    where epl.event_id = p_event_id
      and epl.role = 'dancer'
      and epl.occurrence_id is not null
    group by epl.occurrence_id
  ) src;

  return jsonb_build_object(
    'event', v_event,
    'occurrences', v_occ,
    'childGraph', jsonb_build_object(
      'organisers', to_jsonb(coalesce(v_org_ids, array[]::uuid[])),
      'lineup', jsonb_build_object(
        'teacher_ids',   v_teacher_ids,
        'mc_ids',        v_mc_ids,
        'performer_ids', v_performer_ids
      ),
      'guest_dancers', jsonb_build_object(
        'series',        v_guest_series,
        'by_occurrence', v_guest_by_occurrence
      )
    )
  );
end;
$$;


ALTER FUNCTION "public"."admin_get_event_snapshot_v2"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_my_city_scopes"() RETURNS TABLE("city_id" "uuid", "city_name" "text", "city_slug" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.slug
  FROM public.admin_manager_city_scopes s
  JOIN public.cities c ON c.id = s.city_id
  WHERE s.user_id = v_uid
  ORDER BY c.name;
END;
$$;


ALTER FUNCTION "public"."admin_get_my_city_scopes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_my_settings"() RETURNS TABLE("user_id" "uuid", "role" "text", "is_active" boolean, "notes" "text", "is_super_admin" boolean, "city_ids" "uuid"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    m.user_id,
    m.role,
    m.is_active,
    m.notes,
    public.is_super_admin(v_uid) AS is_super_admin,
    COALESCE((
      SELECT array_agg(s.city_id ORDER BY s.city_id)
      FROM public.admin_manager_city_scopes s
      WHERE s.user_id = m.user_id
    ), '{}'::uuid[]) AS city_ids
  FROM public.admin_link_managers m
  WHERE m.user_id = v_uid;
END;
$$;


ALTER FUNCTION "public"."admin_get_my_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_organiser_display_rows_v1"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT e.id, e.name
  FROM public.entities e
  WHERE e.type = 'organiser'
    AND e.id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."admin_get_organiser_display_rows_v1"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_suspected_duplicate_profiles"("p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200) RETURNS TABLE("profile_type" "text", "normalized_name" "text", "city_key" "text", "candidate_count" bigint, "profile_ids" "uuid"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH profile_universe AS (
    SELECT 'teacher'::text AS profile_type, t.id AS profile_id, to_jsonb(t) AS row_json,
           public.admin_normalize_name(trim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.surname, ''))) AS normalized_name
    FROM public.teacher_profiles t

    UNION ALL
    SELECT 'dj', d.id, to_jsonb(d),
           public.admin_normalize_name(COALESCE(NULLIF(d.dj_name, ''), trim(COALESCE(d.first_name, '') || ' ' || COALESCE(d.surname, ''))))
    FROM public.dj_profiles d

    UNION ALL
    SELECT 'organiser', o.id, to_jsonb(o),
           public.admin_normalize_name(COALESCE(NULLIF(o.organisation_name, ''), trim(COALESCE(o.first_name, '') || ' ' || COALESCE(o.surname, ''))))
    FROM public.organisers o

    UNION ALL
    SELECT 'vendor', v.id, to_jsonb(v), public.admin_normalize_name(v.business_name)
    FROM public.vendors v

    UNION ALL
    SELECT 'videographer', vg.id, to_jsonb(vg), public.admin_normalize_name(vg.business_name)
    FROM public.videographers vg

    UNION ALL
    SELECT 'dancer', da.id,
           to_jsonb(da) || jsonb_build_object('city_id', da.based_city_id),
           public.admin_normalize_name(trim(COALESCE(da.first_name, '') || ' ' || COALESCE(da.surname, '')))
    FROM public.dancer_profiles da

    UNION ALL
    SELECT 'venue', ve.id, to_jsonb(ve), public.admin_normalize_name(ve.name)
    FROM public.venues ve
  ),
  filtered AS (
    SELECT
      pu.profile_type,
      pu.profile_id,
      pu.normalized_name,
      COALESCE(NULLIF(pu.row_json ->> 'city_id', ''), NULLIF(pu.row_json ->> 'city_slug', ''), NULLIF(pu.row_json ->> 'city', ''), '__no_city__') AS city_key
    FROM profile_universe pu
    WHERE pu.normalized_name <> ''
      AND public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  )
  SELECT
    f.profile_type,
    f.normalized_name,
    f.city_key,
    COUNT(*) AS candidate_count,
    array_agg(f.profile_id ORDER BY f.profile_id) AS profile_ids
  FROM filtered f
  GROUP BY f.profile_type, f.normalized_name, f.city_key
  HAVING COUNT(*) > 1
  ORDER BY candidate_count DESC, f.profile_type, f.normalized_name
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;


ALTER FUNCTION "public"."admin_get_suspected_duplicate_profiles"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_teacher_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "first_name" "text", "surname" "text", "photo_url" "text", "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "nationality" "text", "years_teaching" integer, "teaching_styles" "text"[], "languages" "text"[], "achievements" "text"[], "faq" "text", "journey" "text", "offers_private" boolean, "availability" "text", "private_lesson_types" "text"[], "private_lesson_locations" "text"[], "private_travel_distance" numeric, "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text", "is_active" boolean, "hide_surname" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    tp.id                              AS entity_id,
    tp.id,
    tp.first_name,
    tp.surname,
    tp.photo_url,
    tp.gallery_urls,
    tp.city_id,
    c.name                             AS city,
    tp.nationality,
    tp.years_teaching,
    tp.teaching_styles,
    tp.languages,
    tp.achievements,
    tp.faq,
    tp.journey,
    COALESCE(tp.offers_private, false) AS offers_private,
    tp.availability,
    tp.private_lesson_types,
    tp.private_lesson_locations,
    tp.private_travel_distance,
    tp.website,
    tp.instagram,
    tp.facebook,
    tp.email,
    tp.phone,
    tp.is_active,
    COALESCE(tp.hide_surname, false)   AS hide_surname,
    tp.meta_data,
    tp.profile_source,
    tp.created_at::timestamptz,
    tp.updated_at
  FROM public.teacher_profiles tp
  LEFT JOIN public.cities c ON c.id = tp.city_id
  WHERE tp.id = p_entity_id;
$$;


ALTER FUNCTION "public"."admin_get_teacher_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_unlinked_events_queue"("p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("event_id" "uuid", "event_name" "text", "start_time" timestamp with time zone, "city_id_text" "text", "city_slug" "text", "city" "text", "missing_organiser" boolean, "missing_venue" boolean, "reason" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH filtered_events AS (
    SELECT e.*
    FROM public.events e
    WHERE public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
      AND (COALESCE(e.lifecycle_status = 'published', false) OR COALESCE(e.is_active, false))
  ),
  event_flags AS (
    SELECT
      e.id,
      (
        EXISTS (
          SELECT 1
          FROM public.event_entities ee
          JOIN public.entities en ON en.id = ee.entity_id
          WHERE ee.event_id = e.id
            AND ee.role = 'organiser'
            AND en.type = 'organiser'
        )
        OR EXISTS (
          SELECT 1
          FROM public.event_profile_links l
          WHERE l.event_id = e.id
            AND l.role = 'organiser'
            AND l.status = 'active'
            AND l.archived_at IS NULL
        )
      ) AS has_organiser,
      (
        e.venue_id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.event_profile_links l
          WHERE l.event_id = e.id
            AND l.role = 'venue'
            AND l.status = 'active'
            AND l.archived_at IS NULL
        )
      ) AS has_venue
    FROM filtered_events e
  )
  SELECT
    e.id AS event_id,
    e.name AS event_name,
    e.start_time,
    e.city_id::text AS city_id_text,
    COALESCE(c.slug, NULLIF(btrim(e.city_slug), '')) AS city_slug,
    c.name AS city,
    (NOT f.has_organiser) AS missing_organiser,
    (NOT f.has_venue) AS missing_venue,
    CASE
      WHEN (NOT f.has_organiser) AND (NOT f.has_venue) THEN 'missing_organiser_and_venue'
      WHEN (NOT f.has_organiser) THEN 'missing_organiser'
      WHEN (NOT f.has_venue) THEN 'missing_venue'
      ELSE 'ok'
    END AS reason
  FROM filtered_events e
  JOIN event_flags f ON f.id = e.id
  LEFT JOIN public.cities c ON c.id = e.city_id
  WHERE (NOT f.has_organiser) OR (NOT f.has_venue)
  ORDER BY e.start_time NULLS LAST, e.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;


ALTER FUNCTION "public"."admin_get_unlinked_events_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_unlinked_profiles_queue"("p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200) RETURNS TABLE("profile_type" "text", "profile_id" "uuid", "display_name" "text", "city_id_text" "text", "city_slug" "text", "city" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH profile_universe AS (
    SELECT 'teacher'::text AS profile_type, t.id AS profile_id, to_jsonb(t) AS row_json,
           COALESCE(NULLIF(trim(COALESCE(t.first_name, '') || ' ' || COALESCE(t.surname, '')), ''), 'Teacher ' || t.id::text) AS display_name
    FROM public.teacher_profiles t

    UNION ALL
    SELECT 'dj', d.id, to_jsonb(d),
           COALESCE(NULLIF(d.dj_name, ''), NULLIF(trim(COALESCE(d.first_name, '') || ' ' || COALESCE(d.surname, '')), ''), 'DJ ' || d.id::text)
    FROM public.dj_profiles d

    UNION ALL
    SELECT 'organiser', o.id, to_jsonb(o),
           COALESCE(NULLIF(o.organisation_name, ''), NULLIF(trim(COALESCE(o.first_name, '') || ' ' || COALESCE(o.surname, '')), ''), 'Organiser ' || o.id::text)
    FROM public.organisers o

    UNION ALL
    SELECT 'vendor', v.id, to_jsonb(v), COALESCE(NULLIF(v.business_name, ''), 'Vendor ' || v.id::text)
    FROM public.vendors v

    UNION ALL
    SELECT 'videographer', vg.id, to_jsonb(vg), COALESCE(NULLIF(vg.business_name, ''), 'Videographer ' || vg.id::text)
    FROM public.videographers vg

    UNION ALL
    SELECT 'dancer', da.id,
           to_jsonb(da) || jsonb_build_object('city_id', da.based_city_id),
           COALESCE(NULLIF(trim(COALESCE(da.first_name, '') || ' ' || COALESCE(da.surname, '')), ''), 'Dancer ' || da.id::text)
    FROM public.dancer_profiles da

    UNION ALL
    SELECT 'venue', ve.id, to_jsonb(ve), COALESCE(NULLIF(ve.name, ''), 'Venue ' || ve.id::text)
    FROM public.venues ve
  ),
  filtered_profiles AS (
    SELECT pu.*
    FROM profile_universe pu
    WHERE public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  linked_profiles AS (
    SELECT DISTINCT l.profile_type, l.profile_id::text AS profile_id
    FROM public.event_profile_links l
    WHERE l.status = 'active' AND l.archived_at IS NULL

    UNION SELECT 'venue', e.venue_id::text FROM public.events e WHERE e.venue_id IS NOT NULL
  )
  SELECT
    fp.profile_type,
    fp.profile_id,
    fp.display_name,
    fp.row_json ->> 'city_id' AS city_id_text,
    fp.row_json ->> 'city_slug' AS city_slug,
    fp.row_json ->> 'city' AS city
  FROM filtered_profiles fp
  WHERE NOT EXISTS (
    SELECT 1
    FROM linked_profiles lp
    WHERE lp.profile_type = fp.profile_type
      AND lp.profile_id = fp.profile_id::text
  )
  ORDER BY fp.profile_type, fp.display_name
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;


ALTER FUNCTION "public"."admin_get_unlinked_profiles_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_vendor_v1"("p_id" "uuid") RETURNS TABLE("id" "uuid", "business_name" "text", "representative_name" "text", "first_name" "text", "surname" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "product_categories" "text"[], "product_photos" "text"[], "products" "jsonb", "ships_international" boolean, "promo_code" "text", "promo_discount_type" "text", "promo_discount_value" numeric, "upcoming_events" "text"[], "team" "jsonb", "instagram" "text", "facebook" "text", "website" "text", "email" "text", "public_email" "text", "phone" "text", "whatsapp" "text", "faq" "text", "short_description" "text", "description" "text", "verified" boolean, "is_active" boolean, "meta_data" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.id,
    v.business_name,
    v.representative_name,
    v.first_name,
    v.surname,
    v.photo_url,
    v.gallery_urls,
    v.city_id,
    c.name AS city,
    v.country,
    v.address,
    v.product_categories,
    v.product_photos,
    v.products,
    v.ships_international,
    v.promo_code,
    v.promo_discount_type,
    v.promo_discount_value,
    v.upcoming_events,
    v.team,
    v.instagram,
    v.facebook,
    v.website,
    v.email,
    v.public_email,
    v.phone,
    v.whatsapp,
    v.faq,
    v.short_description,
    v.description,
    v.verified,
    v.is_active,
    v.meta_data
  FROM public.vendors v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."admin_get_vendor_v1"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_venue_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "user_id" "uuid", "name" "text", "photo_url" "text"[], "gallery_urls" "text"[], "video_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "postcode" "text", "google_maps_link" "text", "capacity" integer, "floor_type" "text", "facilities_new" "text"[], "parking_json" "jsonb", "transport_json" "jsonb", "opening_hours" "jsonb", "bar_available" boolean, "cloakroom_available" boolean, "id_required" boolean, "last_entry_time" "text", "venue_rating" numeric, "admin_notes" "text", "description" "text", "faq_json" "jsonb", "meta_data" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(v.entity_id, v.id) AS entity_id,
    v.id,
    v.user_id,
    v.name,
    v.photo_url,
    v.gallery_urls,
    v.video_urls,
    e.city_id,
    e.city,
    v.country,
    v.address,
    v.postcode,
    v.google_maps_link,
    v.capacity,
    v.floor_type,
    v.facilities_new,
    v.parking_json,
    v.transport_json,
    v.opening_hours,
    v.bar_available,
    v.cloakroom_available,
    v.id_required,
    v.last_entry_time::text,
    v.venue_rating,
    v.admin_notes,
    v.description,
    v.faq_json,
    v.meta_data,
    v.created_at
  FROM public.venues v
  LEFT JOIN public.entities e ON e.id = v.entity_id
  WHERE v.id = p_entity_id OR v.entity_id = p_entity_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."admin_get_venue_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "business_name" "text", "first_name" "text", "surname" "text", "nationality" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "videography_styles" "text"[], "equipment" "text", "travel_options" "text", "team" "jsonb", "upcoming_events" "text"[], "instagram" "text", "facebook" "text", "website" "text", "email" "text", "public_email" "text", "phone" "text", "whatsapp" "text", "faq" "text", "short_description" "text", "description" "text", "verified" boolean, "is_active" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.id           AS entity_id,
    v.id,
    v.business_name,
    v.first_name,
    v.surname,
    v.nationality,
    v.photo_url,
    v.gallery_urls,
    v.city_id,
    c.name         AS city,
    v.country,
    v.address,
    v.videography_styles,
    v.equipment,
    v.travel_options,
    v.team,
    v.upcoming_events,
    v.instagram,
    v.facebook,
    v.website,
    v.email,
    v.public_email,
    v.phone,
    v.whatsapp,
    v.faq,
    v.short_description,
    v.description,
    v.verified,
    v.is_active,
    v.meta_data,
    v.profile_source,
    v.created_at,
    v.updated_at
  FROM public.videographers v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_entity_id;
$$;


ALTER FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."admin_is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_is_admin"() IS 'Strict wrapper over public.is_admin(); it uses the same admin truth and raises admin_only instead of returning false for non-admin callers.';



CREATE OR REPLACE FUNCTION "public"."admin_link_managers_restricted_columns_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
BEGIN
  v_is_super := public.is_super_admin(v_uid);

  -- Non super-admins can update only non-sensitive fields on their own row.
  IF NOT v_is_super THEN
    IF v_uid IS NULL OR v_uid <> OLD.user_id THEN
      RAISE EXCEPTION 'NOT_ALLOWED_TO_UPDATE_OTHER_ADMINS'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'ROLE_CHANGE_REQUIRES_SUPER_ADMIN'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'ACTIVE_STATUS_CHANGE_REQUIRES_SUPER_ADMIN'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."admin_link_managers_restricted_columns_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_link_managers_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."admin_link_managers_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_dancers_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "display_name" "text", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "nationality" "text", "dance_role" "text", "dance_started_year" integer, "looking_for_partner" boolean, "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id,
    COALESCE(NULLIF(btrim(concat_ws(' ', dp.first_name, dp.surname)), ''), 'Dancer') AS display_name,
    dp.first_name,
    dp.surname,
    dp.avatar_url,
    dp.based_city_id,
    c.name AS city,
    dp.nationality,
    dp.dance_role,
    dp.dance_started_year,
    dp.looking_for_partner,
    dp.is_active,
    dp.created_at,
    dp.updated_at
  FROM public.dancer_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.based_city_id
  WHERE
    p_query IS NULL
    OR dp.first_name  ILIKE '%' || p_query || '%'
    OR dp.surname     ILIKE '%' || p_query || '%'
    OR c.name         ILIKE '%' || p_query || '%'
    OR dp.nationality ILIKE '%' || p_query || '%'
  ORDER BY dp.first_name NULLS LAST, dp.surname NULLS LAST, dp.id
  LIMIT  GREATEST(COALESCE(p_limit,  200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0),   0);
$$;


ALTER FUNCTION "public"."admin_list_dancers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_djs_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_id" "uuid", "id" "uuid", "display_name" "text", "dj_name" "text", "first_name" "text", "surname" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "is_active" boolean, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id                                              AS entity_id,
    dp.id,
    COALESCE(
      NULLIF(btrim(COALESCE(dp.dj_name, '')), ''),
      NULLIF(btrim(concat_ws(' ',
        NULLIF(btrim(COALESCE(dp.first_name, '')), ''),
        NULLIF(btrim(COALESCE(dp.surname,    '')), '')
      )), ''),
      'Unnamed DJ'
    )                                                  AS display_name,
    dp.dj_name,
    dp.first_name,
    dp.surname,
    dp.photo_url[1]                                    AS photo_url,
    dp.city_id,
    c.name                                             AS city,
    dp.is_active,
    dp.updated_at
  FROM public.dj_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.city_id
  WHERE (
    p_query IS NULL
    OR dp.dj_name    ILIKE '%' || p_query || '%'
    OR dp.first_name ILIKE '%' || p_query || '%'
    OR dp.surname    ILIKE '%' || p_query || '%'
    OR c.name        ILIKE '%' || p_query || '%'
  )
  ORDER BY dp.updated_at DESC NULLS LAST, dp.id DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."admin_list_djs_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_organiser_options_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_controlled_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT e.id, e.name
  FROM public.entities e
  WHERE e.type = 'organiser'
    AND (
      public.is_admin()
      OR (p_controlled_ids IS NOT NULL AND e.id = ANY(p_controlled_ids))
    )
    AND (
      p_query IS NULL
      OR e.name ILIKE '%' || p_query || '%'
    )
  ORDER BY e.name ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;


ALTER FUNCTION "public"."admin_list_organiser_options_v1"("p_query" "text", "p_limit" integer, "p_controlled_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_teachers_v1"("p_request" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_query text := NULLIF(COALESCE(p_request->>'query', ''), '');
  v_limit int := COALESCE((p_request #>> '{page,limit}')::int, 20);
  v_offset int := COALESCE((p_request #>> '{page,offset}')::int, 0);
  v_city_id uuid := NULLIF(p_request #>> '{filters,city_id}', '')::uuid;
  v_is_active boolean := CASE WHEN (p_request #> '{filters,is_active}') IS NOT NULL THEN (p_request #>> '{filters,is_active}')::boolean ELSE NULL END;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
BEGIN
  v_limit := LEAST(GREATEST(v_limit, 1), 100);
  v_offset := GREATEST(v_offset, 0);

  WITH teacher_rows AS (
    SELECT
      e.id AS entity_id,
      e.name AS display_name,
      e.avatar_url,
      e.city_id,
      c.slug AS city_slug,
      COALESCE(tp.teaching_styles, ARRAY[]::text[]) AS styles,
      COALESCE((tp.meta_data->>'is_active')::boolean, true) AS is_active,
      COALESCE(tp.created_at::timestamptz, e.created_at) AS updated_at
    FROM public.entities e
    LEFT JOIN public.cities c ON c.id = e.city_id
    LEFT JOIN LATERAL (
      SELECT tpp.*
      FROM public.teacher_profiles tpp
      WHERE (
        (tpp.meta_data ? 'entity_id')
        AND (tpp.meta_data->>'entity_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND (tpp.meta_data->>'entity_id')::uuid = e.id
      )
      OR (e.claimed_by IS NOT NULL AND tpp.user_id = e.claimed_by)
      ORDER BY
        CASE WHEN (tpp.meta_data ? 'entity_id') AND (tpp.meta_data->>'entity_id') = e.id::text THEN 0 ELSE 1 END,
        tpp.created_at DESC NULLS LAST
      LIMIT 1
    ) tp ON true
    WHERE (e.type = 'teacher' OR tp.id IS NOT NULL)
      AND (v_query IS NULL OR e.name ILIKE ('%' || v_query || '%'))
      AND (v_city_id IS NULL OR e.city_id = v_city_id)
      AND (v_is_active IS NULL OR COALESCE((tp.meta_data->>'is_active')::boolean, true) = v_is_active)
  )
  SELECT count(*) INTO v_total FROM teacher_rows;

  WITH teacher_rows AS (
    SELECT
      e.id AS entity_id,
      e.name AS display_name,
      e.avatar_url,
      e.city_id,
      c.slug AS city_slug,
      COALESCE(tp.teaching_styles, ARRAY[]::text[]) AS styles,
      COALESCE((tp.meta_data->>'is_active')::boolean, true) AS is_active,
      COALESCE(tp.created_at::timestamptz, e.created_at) AS updated_at
    FROM public.entities e
    LEFT JOIN public.cities c ON c.id = e.city_id
    LEFT JOIN LATERAL (
      SELECT tpp.*
      FROM public.teacher_profiles tpp
      WHERE (
        (tpp.meta_data ? 'entity_id')
        AND (tpp.meta_data->>'entity_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND (tpp.meta_data->>'entity_id')::uuid = e.id
      )
      OR (e.claimed_by IS NOT NULL AND tpp.user_id = e.claimed_by)
      ORDER BY
        CASE WHEN (tpp.meta_data ? 'entity_id') AND (tpp.meta_data->>'entity_id') = e.id::text THEN 0 ELSE 1 END,
        tpp.created_at DESC NULLS LAST
      LIMIT 1
    ) tp ON true
    WHERE (e.type = 'teacher' OR tp.id IS NOT NULL)
      AND (v_query IS NULL OR e.name ILIKE ('%' || v_query || '%'))
      AND (v_city_id IS NULL OR e.city_id = v_city_id)
      AND (v_is_active IS NULL OR COALESCE((tp.meta_data->>'is_active')::boolean, true) = v_is_active)
    ORDER BY e.name ASC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entity_id', entity_id,
    'display_name', display_name,
    'avatar_url', avatar_url,
    'city_id', city_id,
    'city_slug', city_slug,
    'styles', to_jsonb(styles),
    'is_active', is_active,
    'updated_at', to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )), '[]'::jsonb)
  INTO v_items
  FROM teacher_rows;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ok',
    'data', jsonb_build_object(
      'items', v_items,
      'page', jsonb_build_object(
        'limit', v_limit,
        'offset', v_offset,
        'total', v_total
      )
    )
  );
END;
$_$;


ALTER FUNCTION "public"."admin_list_teachers_v1"("p_request" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_teachers_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_id" "uuid", "id" "uuid", "display_name" "text", "first_name" "text", "surname" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "is_active" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    tp.id                                                                             AS entity_id,
    tp.id                                                                             AS id,
    NULLIF(btrim(COALESCE(tp.first_name,'') || ' ' || COALESCE(tp.surname,'')), '')  AS display_name,
    tp.first_name,
    tp.surname,
    tp.photo_url,
    tp.city_id,
    c.name                                                                            AS city,
    tp.is_active
  FROM public.teacher_profiles tp
  LEFT JOIN public.cities c ON c.id = tp.city_id
  WHERE
    p_query IS NULL
    OR tp.first_name ILIKE '%' || p_query || '%'
    OR tp.surname    ILIKE '%' || p_query || '%'
  ORDER BY tp.surname NULLS LAST, tp.first_name NULLS LAST, tp.id
  LIMIT  GREATEST(COALESCE(p_limit,  200), 1)
  OFFSET GREATEST(COALESCE(p_offset,   0), 0);
$$;


ALTER FUNCTION "public"."admin_list_teachers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_vendors_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "display_name" "text", "business_name" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "country" "text", "verified" boolean, "is_active" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.id,
    COALESCE(
      NULLIF(btrim(COALESCE(v.business_name, '')), ''),
      NULLIF(btrim(COALESCE(v.representative_name, '')), ''),
      NULLIF(btrim(concat_ws(' ', v.first_name, v.surname)), ''),
      'Vendor'
    ) AS display_name,
    v.business_name,
    v.photo_url[1] AS photo_url,
    v.city_id,
    c.name         AS city,
    v.country,
    v.verified,
    v.is_active
  FROM public.vendors v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE
    p_query IS NULL
    OR v.business_name        ILIKE '%' || p_query || '%'
    OR v.representative_name  ILIKE '%' || p_query || '%'
    OR c.name                 ILIKE '%' || p_query || '%'
  ORDER BY v.business_name NULLS LAST, v.id
  LIMIT  GREATEST(COALESCE(p_limit,  200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0),   0);
$$;


ALTER FUNCTION "public"."admin_list_vendors_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_venues_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_id" "uuid", "id" "uuid", "display_name" "text", "name" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "country" "text", "address" "text", "capacity" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(v.entity_id, v.id)                   AS entity_id,
    v.id,
    COALESCE(NULLIF(btrim(v.name), ''), 'Venue')  AS display_name,
    v.name,
    v.photo_url[1]                                AS photo_url,
    e.city_id,
    e.city,
    -- Use cities.country_code (canonical) rather than venues.country (stale text column)
    c.country_code                                AS country,
    v.address,
    v.capacity
  FROM public.venues v
  LEFT JOIN public.entities e ON e.id = v.entity_id
  LEFT JOIN public.cities   c ON c.id = e.city_id
  WHERE
    p_query IS NULL
    OR v.name        ILIKE '%' || p_query || '%'
    OR e.city        ILIKE '%' || p_query || '%'
    OR c.country_code ILIKE '%' || p_query || '%'
    OR v.address     ILIKE '%' || p_query || '%'
  ORDER BY v.name NULLS LAST, v.id
  LIMIT  GREATEST(COALESCE(p_limit,  200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0),   0);
$$;


ALTER FUNCTION "public"."admin_list_venues_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_videographers_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200, "p_offset" integer DEFAULT 0) RETURNS TABLE("entity_id" "uuid", "id" "uuid", "display_name" "text", "business_name" "text", "first_name" "text", "surname" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "is_active" boolean, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.id                                              AS entity_id,
    v.id,
    COALESCE(
      NULLIF(btrim(COALESCE(v.business_name, '')), ''),
      NULLIF(btrim(concat_ws(' ',
        NULLIF(btrim(COALESCE(v.first_name, '')), ''),
        NULLIF(btrim(COALESCE(v.surname,    '')), '')
      )), ''),
      'Videographer'
    )                                                 AS display_name,
    v.business_name,
    v.first_name,
    v.surname,
    v.photo_url[1]                                    AS photo_url,
    v.city_id,
    c.name                                            AS city,
    v.is_active,
    v.updated_at
  FROM public.videographers v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE (
    p_query IS NULL
    OR v.business_name ILIKE '%' || p_query || '%'
    OR v.first_name    ILIKE '%' || p_query || '%'
    OR v.surname       ILIKE '%' || p_query || '%'
    OR c.name          ILIKE '%' || p_query || '%'
  )
  ORDER BY v.updated_at DESC NULLS LAST, v.id DESC
  LIMIT  GREATEST(COALESCE(p_limit,  200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0),   0);
$$;


ALTER FUNCTION "public"."admin_list_videographers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_log_link_action"("p_link_id" "uuid", "p_event_id" "uuid", "p_profile_id" "uuid", "p_profile_type" "text", "p_role" "text", "p_action" "text", "p_reason" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.event_profile_link_audit (
    link_id,
    event_id,
    profile_id,
    profile_type,
    role,
    action,
    actor_id,
    reason,
    payload
  )
  VALUES (
    p_link_id,
    p_event_id,
    p_profile_id,
    p_profile_type,
    p_role,
    p_action,
    auth.uid(),
    p_reason,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."admin_log_link_action"("p_link_id" "uuid", "p_event_id" "uuid", "p_profile_id" "uuid", "p_profile_type" "text", "p_role" "text", "p_action" "text", "p_reason" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_normalize_name"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT trim(regexp_replace(lower(COALESCE(p_name, '')), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."admin_normalize_name"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_people_audit"() RETURNS TABLE("role" "text", "linked" bigint, "role_only" bigint, "orphan" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$

SELECT
  role,
  COUNT(*) FILTER (WHERE has_identity) AS linked,
  COUNT(*) FILTER (WHERE NOT has_identity) AS role_only,
  COUNT(*) FILTER (WHERE NOT has_auth) AS orphan
FROM public.admin_people_view
GROUP BY role
ORDER BY role;

$$;


ALTER FUNCTION "public"."admin_people_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("user_id" "uuid", "role" "text", "role_row_id" "uuid", "has_identity" boolean, "has_auth" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    p_limit := 50;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  RETURN QUERY
  SELECT
    apv.user_id,
    apv.role,
    apv.role_row_id,
    apv.has_identity,
    apv.has_auth
  FROM public.admin_people_view apv
  WHERE
    (p_role IS NULL OR apv.role = lower(p_role))
  ORDER BY apv.role, apv.user_id
  LIMIT p_limit
  OFFSET p_offset;

END;
$$;


ALTER FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_people_search_v2"("p_request" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_query text := NULLIF(COALESCE(p_request->>'query', ''), '');
  v_limit int := COALESCE((p_request #>> '{page,limit}')::int, 25);
  v_offset int := COALESCE((p_request #>> '{page,offset}')::int, 0);
  v_teacher_active boolean := CASE WHEN (p_request #> '{filters,teacher,is_active}') IS NOT NULL THEN (p_request #>> '{filters,teacher,is_active}')::boolean ELSE NULL END;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
BEGIN
  v_limit := LEAST(GREATEST(v_limit, 1), 100);
  v_offset := GREATEST(v_offset, 0);

  WITH base AS (
    SELECT
      e.id AS entity_id,
      e.name AS display_name,
      e.avatar_url,
      COALESCE(tp.teaching_styles, ARRAY[]::text[]) AS teacher_styles,
      (tp.id IS NOT NULL OR e.type = 'teacher') AS has_teacher,
      COALESCE((tp.meta_data->>'is_active')::boolean, true) AS teacher_is_active
    FROM public.entities e
    LEFT JOIN LATERAL (
      SELECT tpp.*
      FROM public.teacher_profiles tpp
      WHERE (
        (tpp.meta_data ? 'entity_id')
        AND (tpp.meta_data->>'entity_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND (tpp.meta_data->>'entity_id')::uuid = e.id
      )
      OR (e.claimed_by IS NOT NULL AND tpp.user_id = e.claimed_by)
      ORDER BY
        CASE WHEN (tpp.meta_data ? 'entity_id') AND (tpp.meta_data->>'entity_id') = e.id::text THEN 0 ELSE 1 END,
        tpp.created_at DESC NULLS LAST
      LIMIT 1
    ) tp ON true
    WHERE (v_query IS NULL OR e.name ILIKE ('%' || v_query || '%'))
      AND (v_teacher_active IS NULL OR COALESCE((tp.meta_data->>'is_active')::boolean, true) = v_teacher_active)
  )
  SELECT count(*) INTO v_total FROM base;

  WITH base AS (
    SELECT
      e.id AS entity_id,
      e.name AS display_name,
      e.avatar_url,
      COALESCE(tp.teaching_styles, ARRAY[]::text[]) AS teacher_styles,
      (tp.id IS NOT NULL OR e.type = 'teacher') AS has_teacher,
      COALESCE((tp.meta_data->>'is_active')::boolean, true) AS teacher_is_active
    FROM public.entities e
    LEFT JOIN LATERAL (
      SELECT tpp.*
      FROM public.teacher_profiles tpp
      WHERE (
        (tpp.meta_data ? 'entity_id')
        AND (tpp.meta_data->>'entity_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND (tpp.meta_data->>'entity_id')::uuid = e.id
      )
      OR (e.claimed_by IS NOT NULL AND tpp.user_id = e.claimed_by)
      ORDER BY
        CASE WHEN (tpp.meta_data ? 'entity_id') AND (tpp.meta_data->>'entity_id') = e.id::text THEN 0 ELSE 1 END,
        tpp.created_at DESC NULLS LAST
      LIMIT 1
    ) tp ON true
    WHERE (v_query IS NULL OR e.name ILIKE ('%' || v_query || '%'))
      AND (v_teacher_active IS NULL OR COALESCE((tp.meta_data->>'is_active')::boolean, true) = v_teacher_active)
    ORDER BY e.name ASC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entity_id', entity_id,
    'display_name', display_name,
    'avatar_url', avatar_url,
    'facets', jsonb_build_object(
      'teacher', CASE WHEN has_teacher THEN jsonb_build_object('styles', to_jsonb(teacher_styles), 'is_active', teacher_is_active) ELSE NULL END
    )
  )), '[]'::jsonb)
  INTO v_items
  FROM base;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ok',
    'data', jsonb_build_object(
      'items', v_items,
      'page', jsonb_build_object('limit', v_limit, 'offset', v_offset, 'total', v_total)
    )
  );
END;
$_$;


ALTER FUNCTION "public"."admin_people_search_v2"("p_request" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_people_search_v2"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("person_key" "text", "id" "text", "user_id" "text", "display_name" "text", "avatar_url" "text", "role_types" "text"[], "entity_id" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH candidates AS (
    -- Teachers
    SELECT
      tp.id::text                                                        AS person_key,
      tp.id::text                                                        AS id,
      COALESCE(tp.user_id::text, '')                                     AS user_id,
      NULLIF(btrim(COALESCE(tp.first_name,'') || ' ' || COALESCE(tp.surname,'')), '') AS display_name,
      tp.photo_url                                                       AS avatar_url,
      ARRAY['teacher']::text[]                                           AS role_types,
      tp.id::text                                                        AS entity_id
    FROM public.teacher_profiles tp
    WHERE p_query IS NULL
      OR tp.first_name ILIKE '%' || p_query || '%'
      OR tp.surname    ILIKE '%' || p_query || '%'

    UNION ALL

    -- DJs
    SELECT
      d.id::text                                                         AS person_key,
      d.id::text                                                         AS id,
      COALESCE(d.user_id::text, '')                                      AS user_id,
      COALESCE(
        NULLIF(btrim(d.dj_name), ''),
        NULLIF(btrim(COALESCE(d.first_name,'') || ' ' || COALESCE(d.surname,'')), ''),
        'DJ'
      )                                                                  AS display_name,
      d.photo_url[1]                                                     AS avatar_url,
      ARRAY['dj']::text[]                                                AS role_types,
      d.id::text                                                         AS entity_id
    FROM public.dj_profiles d
    WHERE p_query IS NULL
      OR d.dj_name   ILIKE '%' || p_query || '%'
      OR d.first_name ILIKE '%' || p_query || '%'
      OR d.surname    ILIKE '%' || p_query || '%'

    UNION ALL

    -- Dancers (registered, with auth account)
    SELECT
      dp.id::text                                                        AS person_key,
      dp.id::text                                                        AS id,
      dp.id::text                                                        AS user_id,
      NULLIF(btrim(COALESCE(dp.first_name,'') || ' ' || COALESCE(dp.surname,'')), '') AS display_name,
      dp.avatar_url                                                      AS avatar_url,
      ARRAY['dancer']::text[]                                            AS role_types,
      dp.id::text                                                        AS entity_id
    FROM public.dancer_profiles dp
    WHERE p_query IS NULL
      OR dp.first_name ILIKE '%' || p_query || '%'
      OR dp.surname    ILIKE '%' || p_query || '%'
  )
  SELECT
    c.person_key,
    c.id,
    c.user_id,
    COALESCE(c.display_name, c.person_key) AS display_name,
    COALESCE(c.avatar_url, '')             AS avatar_url,
    c.role_types,
    c.entity_id
  FROM candidates c
  ORDER BY c.display_name NULLS LAST, c.person_key
  LIMIT  GREATEST(COALESCE(p_limit,  20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0),  0);
$$;


ALTER FUNCTION "public"."admin_people_search_v2"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_profile_exists"("p_profile_type" "text", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  CASE p_profile_type
    WHEN 'organiser'    THEN RETURN EXISTS (SELECT 1 FROM public.organisers o WHERE o.id = p_profile_id);
    WHEN 'teacher'      THEN RETURN EXISTS (SELECT 1 FROM public.teacher_profiles t WHERE t.id = p_profile_id);
    WHEN 'dj'           THEN RETURN EXISTS (SELECT 1 FROM public.dj_profiles d WHERE d.id = p_profile_id);
    WHEN 'vendor'       THEN RETURN EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = p_profile_id);
    WHEN 'videographer' THEN RETURN EXISTS (SELECT 1 FROM public.videographers v WHERE v.id = p_profile_id);
    WHEN 'dancer'       THEN RETURN EXISTS (SELECT 1 FROM public.dancer_profiles dp WHERE dp.id = p_profile_id);
    WHEN 'venue'        THEN RETURN EXISTS (SELECT 1 FROM public.venues v WHERE v.id = p_profile_id);
    ELSE RETURN false;
  END CASE;
END; $$;


ALTER FUNCTION "public"."admin_profile_exists"("p_profile_type" "text", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_resolve_city"("in_city_text" "text", "in_city_slug" "text") RETURNS TABLE("city_id" "uuid", "slug" "text", "name" "text", "resolution_status" "text", "candidate_list" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  norm_text text;
BEGIN

  norm_text := NULL;

  IF in_city_text IS NOT NULL THEN
    norm_text := lower(trim(in_city_text));
  END IF;

  -- 1 Exact slug match
  IF in_city_slug IS NOT NULL THEN
    RETURN QUERY
    SELECT id, slug, name, 'resolved_exact_slug', '[]'::jsonb
    FROM public.cities
    WHERE slug = trim(in_city_slug)
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 2 Alias match
  IF norm_text IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.slug, c.name, 'resolved_alias', '[]'::jsonb
    FROM public.city_aliases ca
    JOIN public.cities c ON ca.city_id = c.id
    WHERE ca.normalized_alias = norm_text
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 3 Exact name match
  IF norm_text IS NOT NULL THEN
    RETURN QUERY
    SELECT id, slug, name, 'resolved_exact_name', '[]'::jsonb
    FROM public.cities
    WHERE lower(trim(name)) = norm_text
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 4 Ambiguous matches
  IF norm_text IS NOT NULL THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::text,
      NULL::text,
      'ambiguous',
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'slug', slug,
          'name', name
        )
      )
    FROM (
      SELECT id, slug, name
      FROM public.cities
      WHERE lower(name) LIKE '%' || norm_text || '%'
      LIMIT 10
    ) t;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- 5 Not found
  RETURN QUERY
  SELECT NULL::uuid, NULL::text, NULL::text, 'not_found', '[]'::jsonb;

END;
$$;


ALTER FUNCTION "public"."admin_resolve_city"("in_city_text" "text", "in_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF NULLIF(btrim(coalesce(p_email, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT au.id
    INTO v_user_id
  FROM auth.users au
  WHERE lower(au.email) = lower(btrim(p_email))
  ORDER BY au.created_at ASC
  LIMIT 1;

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_event_link_suggestion"("p_suggestion_id" "uuid", "p_action" "text", "p_verified" boolean DEFAULT false, "p_is_primary" boolean DEFAULT false, "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action text := lower(COALESCE(p_action, ''));
  v_s public.event_profile_link_suggestions%ROWTYPE;
  v_link_result jsonb;
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to manage connectivity';
  END IF;

  SELECT * INTO v_s
  FROM public.event_profile_link_suggestions
  WHERE id = p_suggestion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found: %', p_suggestion_id;
  END IF;

  IF v_s.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Suggestion already reviewed', 'status', v_s.status);
  END IF;

  IF v_action = 'approve' THEN
    v_link_result := public.admin_create_event_profile_link(
      v_s.event_id,
      v_s.profile_id,
      v_s.role,
      p_verified,
      COALESCE(p_reason, v_s.reason),
      v_s.profile_type,
      p_is_primary
    );

    UPDATE public.event_profile_link_suggestions
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(), reason = COALESCE(p_reason, reason)
    WHERE id = p_suggestion_id;

    PERFORM public.admin_log_link_action(
      NULL,
      v_s.event_id,
      v_s.profile_id,
      v_s.profile_type,
      v_s.role,
      'approve_suggestion',
      p_reason,
      jsonb_build_object('suggestion_id', p_suggestion_id)
    );

    RETURN jsonb_build_object('ok', true, 'action', 'approved', 'link', v_link_result);
  ELSIF v_action = 'reject' THEN
    UPDATE public.event_profile_link_suggestions
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(), reason = COALESCE(p_reason, reason)
    WHERE id = p_suggestion_id;

    PERFORM public.admin_log_link_action(
      NULL,
      v_s.event_id,
      v_s.profile_id,
      v_s.profile_type,
      v_s.role,
      'reject_suggestion',
      p_reason,
      jsonb_build_object('suggestion_id', p_suggestion_id)
    );

    RETURN jsonb_build_object('ok', true, 'action', 'rejected');
  END IF;

  RAISE EXCEPTION 'Unsupported action: % (use approve or reject)', p_action;
END;
$$;


ALTER FUNCTION "public"."admin_review_event_link_suggestion"("p_suggestion_id" "uuid", "p_action" "text", "p_verified" boolean, "p_is_primary" boolean, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_role_to_profile_type"("p_role" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE lower(COALESCE(p_role, ''))
    WHEN 'organiser' THEN 'organiser'
    WHEN 'teacher' THEN 'teacher'
    WHEN 'dj' THEN 'dj'
    WHEN 'vendor' THEN 'vendor'
    WHEN 'videographer' THEN 'videographer'
    WHEN 'dancer' THEN 'dancer'
    WHEN 'venue' THEN 'venue'
    ELSE NULL
  END;
$$;


ALTER FUNCTION "public"."admin_role_to_profile_type"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_row_city_matches"("p_row" "jsonb", "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_city_slug" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_city_id_text text := NULLIF(btrim(COALESCE(p_row ->> 'city_id', '')), '');
  v_row_city_id uuid := NULL;
BEGIN
  BEGIN
    IF v_city_id_text IS NOT NULL THEN
      v_row_city_id := v_city_id_text::uuid;
    END IF;
  EXCEPTION WHEN others THEN
    v_row_city_id := NULL;
  END;

  IF p_city_id IS NOT NULL THEN
    RETURN v_row_city_id IS NOT NULL AND v_row_city_id = p_city_id;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."admin_row_city_matches"("p_row" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "dance_role" "text", "dance_started_year" integer, "nationality" "text", "gallery_urls" "text"[], "achievements" "text"[], "favorite_styles" "text"[], "favorite_songs" "text"[], "partner_search_role" "text", "partner_search_level" "text"[], "partner_practice_goals" "text"[], "partner_details" "text", "looking_for_partner" boolean, "instagram" "text", "facebook" "text", "whatsapp" "text", "website" "text", "is_active" boolean, "profile_source" "text", "meta_data" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
#variable_conflict use_column
DECLARE
  v_is_new             boolean;
  v_dance_started_year integer;
  v_first_name         text;
  v_last_name          text;
  v_full_name          text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  v_is_new := NOT EXISTS (
    SELECT 1 FROM public.dancer_profiles WHERE dancer_profiles.id = p_user_id
  );

  IF p_payload ? 'dancing_start_date' AND p_payload->>'dancing_start_date' IS NOT NULL
     AND btrim(p_payload->>'dancing_start_date') <> '' THEN
    BEGIN
      v_dance_started_year := CASE
        WHEN btrim(p_payload->>'dancing_start_date') ~ '^\d{4}$'
          THEN (btrim(p_payload->>'dancing_start_date'))::integer
        ELSE EXTRACT(year FROM (btrim(p_payload->>'dancing_start_date'))::date)::integer
      END;
    EXCEPTION WHEN OTHERS THEN
      v_dance_started_year := NULL;
    END;
  ELSIF p_payload ? 'dance_started_year' THEN
    v_dance_started_year := (p_payload->>'dance_started_year')::integer;
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name  := NULLIF(btrim(COALESCE(p_payload->>'surname', '')), '');
  v_full_name  := NULLIF(btrim(concat_ws(' ', v_first_name, v_last_name)), '');

  INSERT INTO public.member_profiles (
    id, first_name, last_name, full_name, avatar_url, based_city_id
  ) VALUES (
    p_user_id,
    v_first_name,
    v_last_name,
    v_full_name,
    CASE WHEN p_payload ? 'avatar_url'    THEN NULLIF(btrim(COALESCE(p_payload->>'avatar_url', '')), '') ELSE NULL END,
    CASE WHEN p_payload ? 'based_city_id' THEN NULLIF(p_payload->>'based_city_id', '')::uuid            ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name    = CASE WHEN p_payload ? 'first_name'    THEN v_first_name                                              ELSE member_profiles.first_name    END,
    last_name     = CASE WHEN p_payload ? 'surname'       THEN v_last_name                                               ELSE member_profiles.last_name     END,
    full_name     = CASE WHEN (p_payload ? 'first_name' OR p_payload ? 'surname')
                         THEN COALESCE(v_full_name, member_profiles.full_name)                                           ELSE member_profiles.full_name     END,
    avatar_url    = CASE WHEN p_payload ? 'avatar_url'    THEN NULLIF(btrim(COALESCE(p_payload->>'avatar_url', '')), '') ELSE member_profiles.avatar_url    END,
    based_city_id = CASE WHEN p_payload ? 'based_city_id' THEN NULLIF(p_payload->>'based_city_id', '')::uuid             ELSE member_profiles.based_city_id END,
    updated_at    = now();

  IF v_is_new THEN
    INSERT INTO public.dancer_profiles (
      id, first_name, surname, avatar_url, based_city_id, dance_role, dance_started_year,
      nationality, gallery_urls, looking_for_partner, partner_search_role, partner_search_level,
      partner_practice_goals, partner_details, favorite_styles, favorite_songs, achievements,
      instagram, facebook, whatsapp, website, is_active, profile_source, created_by, meta_data
    ) VALUES (
      p_user_id,
      v_first_name,
      v_last_name,
      CASE WHEN p_payload ? 'avatar_url'    THEN NULLIF(btrim(COALESCE(p_payload->>'avatar_url', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'based_city_id' THEN NULLIF(p_payload->>'based_city_id', '')::uuid            ELSE NULL END,
      CASE WHEN p_payload ? 'dance_role'    THEN NULLIF(btrim(COALESCE(p_payload->>'dance_role', '')), '') ELSE NULL END,
      v_dance_started_year,
      CASE WHEN p_payload ? 'nationality'   THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'gallery_urls'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls',           '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'looking_for_partner'    THEN COALESCE((p_payload->>'looking_for_partner')::boolean, false)                                        ELSE false END,
      CASE WHEN p_payload ? 'partner_search_role'    THEN NULLIF(btrim(COALESCE(p_payload->>'partner_search_role', '')), '')                                   ELSE NULL  END,
      CASE WHEN p_payload ? 'partner_search_level'   THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_search_level',   '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'partner_practice_goals' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_practice_goals', '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'partner_details'        THEN NULLIF(btrim(COALESCE(p_payload->>'partner_details', '')), '')                                       ELSE NULL  END,
      CASE WHEN p_payload ? 'favorite_styles'        THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_styles',        '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'favorite_songs'         THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_songs',         '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'achievements'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'achievements',           '[]'::jsonb))) ELSE '{}'  END,
      CASE WHEN p_payload ? 'instagram' THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'facebook'  THEN NULLIF(btrim(COALESCE(p_payload->>'facebook',  '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'whatsapp'  THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp',  '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'website'   THEN NULLIF(btrim(COALESCE(p_payload->>'website',   '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE NULL END,
      COALESCE(NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''), 'rpc_upsert'),
      auth.uid(),
      CASE WHEN p_payload ? 'meta_data' THEN COALESCE(p_payload->'meta_data', '{}'::jsonb) ELSE '{}'::jsonb END
    );

  ELSE
    UPDATE public.dancer_profiles dp SET
      first_name             = CASE WHEN p_payload ? 'first_name'             THEN v_first_name                                                                             ELSE dp.first_name             END,
      surname                = CASE WHEN p_payload ? 'surname'                THEN v_last_name                                                                              ELSE dp.surname                END,
      avatar_url             = CASE WHEN p_payload ? 'avatar_url'             THEN NULLIF(btrim(COALESCE(p_payload->>'avatar_url', '')), '')                                ELSE dp.avatar_url             END,
      based_city_id          = CASE WHEN p_payload ? 'based_city_id'          THEN NULLIF(p_payload->>'based_city_id', '')::uuid                                            ELSE dp.based_city_id          END,
      dance_role             = CASE WHEN p_payload ? 'dance_role'             THEN NULLIF(btrim(COALESCE(p_payload->>'dance_role', '')), '')                                ELSE dp.dance_role             END,
      dance_started_year     = CASE WHEN (p_payload ? 'dancing_start_date' OR p_payload ? 'dance_started_year')
                                    THEN v_dance_started_year                                                                                                               ELSE dp.dance_started_year     END,
      nationality            = CASE WHEN p_payload ? 'nationality'            THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '')                               ELSE dp.nationality            END,
      gallery_urls           = CASE WHEN p_payload ? 'gallery_urls'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls',           '[]'::jsonb))) ELSE dp.gallery_urls           END,
      looking_for_partner    = CASE WHEN p_payload ? 'looking_for_partner'    THEN COALESCE((p_payload->>'looking_for_partner')::boolean, false)                           ELSE dp.looking_for_partner    END,
      partner_search_role    = CASE WHEN p_payload ? 'partner_search_role'    THEN NULLIF(btrim(COALESCE(p_payload->>'partner_search_role', '')), '')                      ELSE dp.partner_search_role    END,
      partner_search_level   = CASE WHEN p_payload ? 'partner_search_level'   THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_search_level',   '[]'::jsonb))) ELSE dp.partner_search_level   END,
      partner_practice_goals = CASE WHEN p_payload ? 'partner_practice_goals' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_practice_goals', '[]'::jsonb))) ELSE dp.partner_practice_goals END,
      partner_details        = CASE WHEN p_payload ? 'partner_details'        THEN NULLIF(btrim(COALESCE(p_payload->>'partner_details', '')), '')                          ELSE dp.partner_details        END,
      favorite_styles        = CASE WHEN p_payload ? 'favorite_styles'        THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_styles',        '[]'::jsonb))) ELSE dp.favorite_styles        END,
      favorite_songs         = CASE WHEN p_payload ? 'favorite_songs'         THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_songs',         '[]'::jsonb))) ELSE dp.favorite_songs         END,
      achievements           = CASE WHEN p_payload ? 'achievements'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'achievements',           '[]'::jsonb))) ELSE dp.achievements           END,
      instagram              = CASE WHEN p_payload ? 'instagram'              THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')                                ELSE dp.instagram              END,
      facebook               = CASE WHEN p_payload ? 'facebook'               THEN NULLIF(btrim(COALESCE(p_payload->>'facebook',  '')), '')                                ELSE dp.facebook               END,
      whatsapp               = CASE WHEN p_payload ? 'whatsapp'               THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp',  '')), '')                                ELSE dp.whatsapp               END,
      website                = CASE WHEN p_payload ? 'website'                THEN NULLIF(btrim(COALESCE(p_payload->>'website',   '')), '')                                ELSE dp.website                END,
      is_active              = CASE WHEN p_payload ? 'is_active'              THEN (p_payload->>'is_active')::boolean                                                      ELSE dp.is_active              END,
      profile_source         = CASE WHEN p_payload ? 'profile_source'         THEN NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), '')                           ELSE dp.profile_source         END,
      meta_data              = CASE WHEN p_payload ? 'meta_data'              THEN COALESCE(dp.meta_data, '{}'::jsonb) || (p_payload->'meta_data')                         ELSE dp.meta_data              END,
      updated_at             = now()
    WHERE dp.id = p_user_id;
  END IF;

  RETURN QUERY
    SELECT
      dp.id, dp.first_name, dp.surname, dp.avatar_url,
      dp.based_city_id, c.name AS city,
      dp.dance_role, dp.dance_started_year, dp.nationality,
      dp.gallery_urls, dp.achievements, dp.favorite_styles, dp.favorite_songs,
      dp.partner_search_role, dp.partner_search_level, dp.partner_practice_goals,
      dp.partner_details, dp.looking_for_partner,
      dp.instagram, dp.facebook, dp.whatsapp, dp.website,
      dp.is_active, dp.profile_source, dp.meta_data,
      dp.created_at, dp.updated_at
    FROM public.dancer_profiles dp
    LEFT JOIN public.cities c ON c.id = dp.based_city_id
    WHERE dp.id = p_user_id
    LIMIT 1;
END;
$_$;


ALTER FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "dj_name" "text", "first_name" "text", "surname" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "nationality" "text", "genres" "text"[], "soundcloud" "text", "youtube_url" "text", "mixcloud" "text", "pricing" "text", "upcoming_events" "text"[], "whatsapp" "text", "faq" "text", "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text", "is_active" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_is_new     boolean;
  v_record_id  uuid;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
  v_user_id    uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_is_new    := (p_entity_id IS NULL);
  v_record_id := COALESCE(p_entity_id, gen_random_uuid());

  IF NOT v_is_new AND NOT EXISTS (
    SELECT 1 FROM public.dj_profiles WHERE dj_profiles.id = v_record_id
  ) THEN
    RAISE EXCEPTION 'dj_not_found';
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name  := NULLIF(btrim(COALESCE(p_payload->>'surname',     '')), '');
  v_full_name  := NULLIF(btrim(concat_ws(' ', v_first_name, v_last_name)), '');

  v_user_id := CASE
    WHEN p_payload ? 'user_id' AND p_payload->>'user_id' IS NOT NULL
      THEN NULLIF(btrim(p_payload->>'user_id'), '')::uuid
    ELSE NULL
  END;

  -- ── member_profiles upsert (conditional on user_id) ────────────────────────
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.member_profiles (
      id, first_name, last_name, full_name, avatar_url, based_city_id
    ) VALUES (
      v_user_id,
      v_first_name,
      v_last_name,
      v_full_name,
      CASE WHEN p_payload ? 'photo_url'
             THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
             ELSE NULL END,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid
             ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name    = CASE WHEN p_payload ? 'first_name' THEN v_first_name
                           ELSE member_profiles.first_name    END,
      last_name     = CASE WHEN p_payload ? 'surname'    THEN v_last_name
                           ELSE member_profiles.last_name     END,
      full_name     = CASE WHEN (p_payload ? 'first_name' OR p_payload ? 'surname')
                           THEN COALESCE(v_full_name, member_profiles.full_name)
                           ELSE member_profiles.full_name     END,
      avatar_url    = CASE WHEN p_payload ? 'photo_url'
                           THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
                           ELSE member_profiles.avatar_url    END,
      based_city_id = CASE WHEN p_payload ? 'city_id'
                           THEN NULLIF(p_payload->>'city_id', '')::uuid
                           ELSE member_profiles.based_city_id END,
      updated_at    = now();
  END IF;

  -- ── dj_profiles INSERT ──────────────────────────────────────────────────────
  IF v_is_new THEN
    INSERT INTO public.dj_profiles (
      id, dj_name, first_name, surname,
      photo_url, gallery_urls, city_id, nationality,
      genres, soundcloud, youtube_url, mixcloud, pricing,
      upcoming_events, whatsapp, faq,
      website, instagram, facebook, email, phone,
      is_active, meta_data, user_id, profile_source, created_by
    ) VALUES (
      v_record_id,
      -- dj_name: fall back to first_name then sentinel — column is NOT NULL
      COALESCE(
        NULLIF(btrim(COALESCE(p_payload->>'dj_name',    '')), ''),
        NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), ''),
        'Unnamed DJ'
      ),
      v_first_name,
      v_last_name,
      CASE WHEN p_payload ? 'photo_url'
             THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'gallery_urls'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid                       ELSE NULL END,
      CASE WHEN p_payload ? 'nationality'
             THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '')    ELSE NULL END,
      CASE WHEN p_payload ? 'genres'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'genres'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'soundcloud'
             THEN NULLIF(btrim(COALESCE(p_payload->>'soundcloud', '')), '')     ELSE NULL END,
      CASE WHEN p_payload ? 'youtube_url'
             THEN NULLIF(btrim(COALESCE(p_payload->>'youtube_url', '')), '')    ELSE NULL END,
      CASE WHEN p_payload ? 'mixcloud'
             THEN NULLIF(btrim(COALESCE(p_payload->>'mixcloud', '')), '')       ELSE NULL END,
      CASE WHEN p_payload ? 'pricing'
             THEN NULLIF(btrim(COALESCE(p_payload->>'pricing', '')), '')        ELSE NULL END,
      CASE WHEN p_payload ? 'upcoming_events'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'whatsapp'
             THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')       ELSE NULL END,
      CASE WHEN p_payload ? 'faq'          THEN p_payload->>'faq'              ELSE NULL END,
      CASE WHEN p_payload ? 'website'
             THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')        ELSE NULL END,
      CASE WHEN p_payload ? 'instagram'
             THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')      ELSE NULL END,
      CASE WHEN p_payload ? 'facebook'
             THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')       ELSE NULL END,
      CASE WHEN p_payload ? 'email'
             THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')          ELSE NULL END,
      CASE WHEN p_payload ? 'phone'
             THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')          ELSE NULL END,
      CASE WHEN p_payload ? 'is_active'
             THEN (p_payload->>'is_active')::boolean                            ELSE NULL END,
      CASE WHEN p_payload ? 'meta_data'
             THEN COALESCE(p_payload->'meta_data', '{}'::jsonb)
             ELSE '{}'::jsonb END,
      v_user_id,
      COALESCE(NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''), 'admin_create'),
      auth.uid()
    );

  -- ── dj_profiles UPDATE ──────────────────────────────────────────────────────
  ELSE
    UPDATE public.dj_profiles dp SET
      dj_name         = CASE WHEN p_payload ? 'dj_name'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'dj_name', '')), '')
                               ELSE dp.dj_name         END,
      first_name      = CASE WHEN p_payload ? 'first_name'     THEN v_first_name   ELSE dp.first_name      END,
      surname         = CASE WHEN p_payload ? 'surname'         THEN v_last_name    ELSE dp.surname         END,
      photo_url       = CASE WHEN p_payload ? 'photo_url'
                               THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
                               ELSE dp.photo_url       END,
      gallery_urls    = CASE WHEN p_payload ? 'gallery_urls'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
                               ELSE dp.gallery_urls    END,
      city_id         = CASE WHEN p_payload ? 'city_id'
                               THEN NULLIF(p_payload->>'city_id', '')::uuid
                               ELSE dp.city_id         END,
      nationality     = CASE WHEN p_payload ? 'nationality'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '')
                               ELSE dp.nationality     END,
      genres          = CASE WHEN p_payload ? 'genres'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'genres'))
                               ELSE dp.genres          END,
      soundcloud      = CASE WHEN p_payload ? 'soundcloud'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'soundcloud', '')), '')
                               ELSE dp.soundcloud      END,
      youtube_url     = CASE WHEN p_payload ? 'youtube_url'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'youtube_url', '')), '')
                               ELSE dp.youtube_url     END,
      mixcloud        = CASE WHEN p_payload ? 'mixcloud'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'mixcloud', '')), '')
                               ELSE dp.mixcloud        END,
      pricing         = CASE WHEN p_payload ? 'pricing'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'pricing', '')), '')
                               ELSE dp.pricing         END,
      upcoming_events = CASE WHEN p_payload ? 'upcoming_events'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
                               ELSE dp.upcoming_events END,
      whatsapp        = CASE WHEN p_payload ? 'whatsapp'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')
                               ELSE dp.whatsapp        END,
      faq             = CASE WHEN p_payload ? 'faq'     THEN p_payload->>'faq'     ELSE dp.faq             END,
      website         = CASE WHEN p_payload ? 'website'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')
                               ELSE dp.website         END,
      instagram       = CASE WHEN p_payload ? 'instagram'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')
                               ELSE dp.instagram       END,
      facebook        = CASE WHEN p_payload ? 'facebook'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')
                               ELSE dp.facebook        END,
      email           = CASE WHEN p_payload ? 'email'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')
                               ELSE dp.email           END,
      phone           = CASE WHEN p_payload ? 'phone'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')
                               ELSE dp.phone           END,
      is_active       = CASE WHEN p_payload ? 'is_active'
                               THEN (p_payload->>'is_active')::boolean
                               ELSE dp.is_active       END,
      meta_data       = CASE WHEN p_payload ? 'meta_data'
                               THEN COALESCE(dp.meta_data, '{}'::jsonb) || (p_payload->'meta_data')
                               ELSE dp.meta_data       END,
      user_id         = CASE WHEN p_payload ? 'user_id'   THEN v_user_id           ELSE dp.user_id         END,
      profile_source  = CASE WHEN p_payload ? 'profile_source'
                               THEN NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), '')
                               ELSE dp.profile_source  END,
      updated_at      = now()
    WHERE dp.id = v_record_id;
  END IF;

  -- Return full row; cast created_at to timestamptz (column is timestamp w/o tz)
  RETURN QUERY
    SELECT
      dp.id,
      dp.dj_name,
      dp.first_name,
      dp.surname,
      dp.photo_url,
      dp.gallery_urls,
      dp.city_id,
      c.name       AS city,
      dp.nationality,
      dp.genres,
      dp.soundcloud,
      dp.youtube_url,
      dp.mixcloud,
      dp.pricing,
      dp.upcoming_events,
      dp.whatsapp,
      dp.faq,
      dp.website,
      dp.instagram,
      dp.facebook,
      dp.email,
      dp.phone,
      dp.is_active,
      dp.meta_data,
      dp.profile_source,
      dp.created_at::timestamptz,
      dp.updated_at
    FROM public.dj_profiles dp
    LEFT JOIN public.cities c ON c.id = dp.city_id
    WHERE dp.id = v_record_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_event jsonb := p_payload->'event';
  v_event_id uuid := NULLIF(COALESCE(v_event->>'id',''), '')::uuid;
BEGIN
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'error',
      'errors', jsonb_build_array(jsonb_build_object('code','MISSING_EVENT','message','event object is required','path','/event')));
  END IF;

  IF v_event_id IS NULL AND NULLIF(v_event->>'name','') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'errors', jsonb_build_array(
        jsonb_build_object(
          'code', 'EVENT_NAME_REQUIRED',
          'message', 'event name is required',
          'path', '/event/name'
        )
      )
    );
  END IF;

  IF v_event_id IS NULL AND NULLIF(v_event->>'venue_id','') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'error',
      'errors', jsonb_build_array(
        jsonb_build_object(
          'code', 'EVENT_VENUE_REQUIRED',
          'message', 'event venue_id is required',
          'path', '/event/venue_id'
        )
      )
    );
  END IF;

  RETURN public.admin_save_event_v2_impl(p_payload);
END;
$$;


ALTER FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_event_v2_impl"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $_$
DECLARE
  v_now timestamptz := now();
  v_actor uuid := auth.uid();
  v_event jsonb := p_payload->'event';
  v_event_id uuid := NULLIF(COALESCE(v_event->>'id',''), '')::uuid;
  v_is_update boolean := false;
  v_occ jsonb := p_payload->'occurrences';
  v_has_schedule boolean := false;
  v_valid_occ_count int := 0;
  v_type text := NULL;
  v_schedule_type text := NULL;
  v_start timestamptz := NULL;
  v_end timestamptz := NULL;
  v_organisers jsonb := NULL;
  v_organiser_input_present boolean := false;
  v_organiser_valid_count int := 0;
  v_country text := NULLIF(v_event->>'country','');
  v_is_active_input boolean := CASE WHEN (v_event ? 'is_active') THEN (v_event->>'is_active')::boolean ELSE NULL END;

  v_existing_country text := NULL;
  v_existing_city_id uuid := NULL;
  v_existing_is_active boolean := false;
  v_existing_venue_id uuid := NULL;
  v_effective_is_active boolean := false;
  v_effective_country text := NULL;
  v_effective_city_id uuid := NULL;
  v_effective_venue_id uuid := NULL;

  v_has_parent_event_id boolean := false;
  v_has_source_occurrence_id boolean := false;
  v_parent_event_id_input uuid := NULL;
  v_source_occurrence_id_input uuid := NULL;
  v_existing_parent_event_id uuid := NULL;
  v_existing_source_occurrence_id uuid := NULL;
  v_effective_parent_event_id uuid := NULL;
  v_effective_source_occurrence_id uuid := NULL;

  v_lineup jsonb := NULL;
  v_lineup_replace boolean := COALESCE((p_payload #>> '{replace,lineup}')::boolean, false);
  v_full_lineup jsonb := '[]'::jsonb;

  v_guest jsonb := p_payload->'guest_dancers';
  v_guest_replace boolean := COALESCE((p_payload #>> '{replace,guest_dancers}')::boolean, false);
  v_guest_norm jsonb := '[]'::jsonb;
  v_series_ids jsonb := NULL;
  v_occ_map jsonb := NULL;
  v_k text;
  v_v jsonb;
  v_item jsonb;
  v_profile_id uuid;
  v_occurrence_id uuid;
BEGIN
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'error',
      'errors', jsonb_build_array(jsonb_build_object('code','MISSING_EVENT','message','event object is required','path','/event')));
  END IF;

  v_has_parent_event_id := (v_event ? 'parent_event_id');
  v_has_source_occurrence_id := (v_event ? 'source_occurrence_id');

  IF v_has_parent_event_id THEN
    BEGIN
      v_parent_event_id_input := NULLIF(v_event->>'parent_event_id','')::uuid;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','PARENT_EVENT_ID_INVALID','message','parent_event_id must be a valid uuid','path','/event/parent_event_id')));
    END;
  END IF;

  IF v_has_source_occurrence_id THEN
    BEGIN
      v_source_occurrence_id_input := NULLIF(v_event->>'source_occurrence_id','')::uuid;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','SOURCE_OCCURRENCE_ID_INVALID','message','source_occurrence_id must be a valid uuid','path','/event/source_occurrence_id')));
    END;
  END IF;

  v_type := NULLIF(v_event->>'type','');
  v_schedule_type := NULLIF(v_event->>'schedule_type','');

  IF (p_payload ? 'occurrences') AND jsonb_typeof(v_occ) = 'array' AND jsonb_array_length(v_occ) > 0 THEN
    SELECT min((elem->>'instance_start')::timestamptz), max((elem->>'instance_end')::timestamptz)
    INTO v_start, v_end
    FROM jsonb_array_elements(v_occ) AS elem
    WHERE (elem ? 'instance_start') AND (elem ? 'instance_end');
  ELSE
    IF (v_event ? 'start_time') THEN v_start := NULLIF(v_event->>'start_time','')::timestamptz; END IF;
    IF (v_event ? 'end_time') THEN v_end := NULLIF(v_event->>'end_time','')::timestamptz; END IF;
  END IF;

  v_organiser_input_present :=
    ((p_payload ? 'event_entities') AND jsonb_typeof(p_payload->'event_entities') = 'array')
    OR ((p_payload ? 'organiser_entity_ids') AND jsonb_typeof(p_payload->'organiser_entity_ids') = 'array')
    OR ((p_payload #> '{childGraph,organisers}') IS NOT NULL AND jsonb_typeof(p_payload #> '{childGraph,organisers}') = 'array')
    OR ((p_payload #> '{childGraph,organiser_entity_ids}') IS NOT NULL AND jsonb_typeof(p_payload #> '{childGraph,organiser_entity_ids}') = 'array')
    OR ((v_event ? 'organiser_ids') AND jsonb_typeof(v_event->'organiser_ids') = 'array');

  IF v_organiser_input_present THEN
    WITH candidate_ids AS (
      SELECT elem->>'entity_id' AS candidate
      FROM jsonb_array_elements(COALESCE(p_payload->'event_entities', '[]'::jsonb)) AS elem
      WHERE jsonb_typeof(elem) = 'object'
        AND (elem ? 'entity_id')
        AND COALESCE(NULLIF(elem->>'role',''),'organiser') IN ('organiser','organizer')

      UNION ALL

      SELECT value
      FROM jsonb_array_elements_text(COALESCE(p_payload->'organiser_entity_ids', '[]'::jsonb)) AS value

      UNION ALL

      SELECT CASE
        WHEN jsonb_typeof(elem) = 'object' AND (elem ? 'entity_id') THEN elem->>'entity_id'
        WHEN jsonb_typeof(elem) = 'object' AND (elem ? 'id') THEN elem->>'id'
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' FROM elem::text)
        ELSE NULL
      END AS candidate
      FROM jsonb_array_elements(COALESCE(p_payload #> '{childGraph,organisers}', '[]'::jsonb)) AS elem

      UNION ALL

      SELECT value
      FROM jsonb_array_elements_text(COALESCE(p_payload #> '{childGraph,organiser_entity_ids}', '[]'::jsonb)) AS value

      UNION ALL

      SELECT value
      FROM jsonb_array_elements_text(COALESCE(v_event->'organiser_ids', '[]'::jsonb)) AS value
    ), valid_ids AS (
      SELECT DISTINCT candidate
      FROM candidate_ids
      WHERE candidate IS NOT NULL
        AND NULLIF(candidate, '') IS NOT NULL
        AND candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('entity_id', candidate)), '[]'::jsonb),
           COUNT(*)::int
    INTO v_organisers, v_organiser_valid_count
    FROM valid_ids;

    IF v_organiser_valid_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'error',
        'errors', jsonb_build_array(
          jsonb_build_object(
            'code', 'ORGANISERS_REQUIRED',
            'message', 'organiser input was supplied but no valid organiser entity_id values were found',
            'path', '/organisers'
          )
        )
      );
    END IF;
  END IF;

  v_lineup := COALESCE(
    CASE WHEN jsonb_typeof(p_payload->'lineup') = 'array' THEN p_payload->'lineup' ELSE NULL END,
    CASE WHEN jsonb_typeof(p_payload #> '{childGraph,lineup,teachers}') = 'array' THEN p_payload #> '{childGraph,lineup,teachers}' ELSE NULL END,
    CASE WHEN jsonb_typeof(p_payload #> '{childGraph,lineup,teacher_ids}') = 'array' THEN p_payload #> '{childGraph,lineup,teacher_ids}' ELSE NULL END
  );

  IF v_lineup IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'profile_id', src.profile_id,
            'role', src.role,
            'is_primary', src.is_primary,
            'source', src.source,
            'occurrence_id', src.occurrence_id
          )
        )
      ),
      '[]'::jsonb
    )
    INTO v_full_lineup
    FROM (
      SELECT
        CASE
          WHEN jsonb_typeof(e.item) = 'object' THEN NULLIF(COALESCE(e.item->>'profile_id', e.item->>'id'), '')
          WHEN jsonb_typeof(e.item) = 'string' THEN NULLIF(trim(both '"' FROM e.item::text), '')
          ELSE NULL
        END AS profile_id,
        CASE
          WHEN jsonb_typeof(e.item) = 'object' THEN COALESCE(NULLIF(lower(e.item->>'role'), ''), 'teacher')
          ELSE 'teacher'
        END AS role,
        CASE
          WHEN jsonb_typeof(e.item) = 'object' THEN COALESCE((e.item->>'is_primary')::boolean, false)
          ELSE false
        END AS is_primary,
        CASE
          WHEN jsonb_typeof(e.item) = 'object' THEN COALESCE(NULLIF(e.item->>'source',''), 'manual')
          ELSE 'manual'
        END AS source,
        CASE
          WHEN jsonb_typeof(e.item) = 'object' AND (e.item ? 'occurrence_id') THEN NULLIF(e.item->>'occurrence_id','')
          ELSE NULL
        END AS occurrence_id
      FROM jsonb_array_elements(v_lineup) AS e(item)
      WHERE (
        jsonb_typeof(e.item) = 'string'
        OR (
          jsonb_typeof(e.item) = 'object'
          AND COALESCE(NULLIF(lower(e.item->>'role'), ''), 'teacher') IN ('teacher','dj','vendor','videographer','hosting','performing')
        )
      )
    ) src
    WHERE src.profile_id IS NOT NULL
      AND src.profile_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  END IF;

  IF v_event_id IS NULL THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','AUTH_REQUIRED','message','authenticated user required','path','/auth')));
    END IF;

    v_effective_is_active := COALESCE(v_is_active_input, false);
    v_effective_country := v_country;
    v_effective_city_id := NULLIF(v_event->>'city_id','')::uuid;
    v_effective_parent_event_id := CASE WHEN v_has_parent_event_id THEN v_parent_event_id_input ELSE NULL END;
    v_effective_source_occurrence_id := CASE WHEN v_has_source_occurrence_id THEN v_source_occurrence_id_input ELSE NULL END;

    IF v_effective_is_active AND (v_effective_city_id IS NULL OR v_effective_country IS NULL OR btrim(v_effective_country) = '') THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object(
          'code','EVENTS_COUNTRY_CITY_REQUIRED',
          'message','active events require both country and city_id',
          'path','/event',
          'details', jsonb_build_object('country_present', (v_effective_country IS NOT NULL AND btrim(v_effective_country) <> ''), 'city_id_present', (v_effective_city_id IS NOT NULL))
        )));
    END IF;

    IF v_effective_source_occurrence_id IS NOT NULL AND v_effective_parent_event_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','PARENT_EVENT_REQUIRED','message','parent_event_id is required when source_occurrence_id is provided','path','/event/parent_event_id')));
    END IF;

    IF v_effective_source_occurrence_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_occurrences co
      WHERE co.id = v_effective_source_occurrence_id
        AND co.event_id = v_effective_parent_event_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','SOURCE_OCCURRENCE_PARENT_MISMATCH','message','source_occurrence_id must belong to parent_event_id','path','/event/source_occurrence_id')));
    END IF;

    INSERT INTO public.events (
      name, venue_id, city_id, country, lifecycle_status, website, ticket_url, description, meta_data,
      type, schedule_type, start_time, end_time, created_by, created_at, updated_at, is_active,
      parent_event_id, source_occurrence_id
    ) VALUES (
      NULLIF(v_event->>'name',''),
      NULLIF(v_event->>'venue_id','')::uuid,
      v_effective_city_id,
      v_effective_country,
      COALESCE(NULLIF(v_event->>'lifecycle_status',''), 'draft'),
      NULLIF(v_event->>'website',''),
      NULLIF(v_event->>'ticket_url',''),
      v_event->>'description',
      COALESCE(v_event->'meta_data', '{}'::jsonb),
      COALESCE(v_type, 'standard'),
      v_schedule_type,
      v_start,
      v_end,
      v_actor,
      v_now,
      v_now,
      v_effective_is_active,
      v_effective_parent_event_id,
      v_effective_source_occurrence_id
    ) RETURNING id INTO v_event_id;
  ELSE
    SELECT e.country, e.city_id, e.is_active, e.venue_id, e.parent_event_id, e.source_occurrence_id
    INTO v_existing_country, v_existing_city_id, v_existing_is_active, v_existing_venue_id, v_existing_parent_event_id, v_existing_source_occurrence_id
    FROM public.events e
    WHERE e.id = v_event_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','EVENT_NOT_FOUND','message','event.id does not exist','path','/event/id', 'details', jsonb_build_object('id', v_event_id::text))));
    END IF;

    v_is_update := true;

    v_effective_venue_id := COALESCE(NULLIF(v_event->>'venue_id','')::uuid, v_existing_venue_id);
    v_effective_is_active := COALESCE(v_is_active_input, v_existing_is_active);
    v_effective_country := COALESCE(v_country, v_existing_country);

    v_effective_city_id := CASE
      WHEN v_effective_venue_id IS NOT NULL THEN
        COALESCE((
          SELECT en.city_id
          FROM public.venues vv
          JOIN public.entities en ON en.id = vv.entity_id
          WHERE vv.id = v_effective_venue_id
          LIMIT 1
        ), v_existing_city_id)
      ELSE COALESCE(NULLIF(v_event->>'city_id','')::uuid, v_existing_city_id)
    END;

    v_effective_parent_event_id := CASE
      WHEN v_has_parent_event_id THEN v_parent_event_id_input
      ELSE v_existing_parent_event_id
    END;

    v_effective_source_occurrence_id := CASE
      WHEN v_has_source_occurrence_id THEN v_source_occurrence_id_input
      ELSE v_existing_source_occurrence_id
    END;

    IF v_effective_is_active AND (v_effective_city_id IS NULL OR v_effective_country IS NULL OR btrim(v_effective_country) = '') THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object(
          'code','EVENTS_COUNTRY_CITY_REQUIRED',
          'message','active events require both country and city_id',
          'path','/event',
          'details', jsonb_build_object('country_present', (v_effective_country IS NOT NULL AND btrim(v_effective_country) <> ''), 'city_id_present', (v_effective_city_id IS NOT NULL))
        )));
    END IF;

    IF v_effective_source_occurrence_id IS NOT NULL AND v_effective_parent_event_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','PARENT_EVENT_REQUIRED','message','parent_event_id is required when source_occurrence_id is provided','path','/event/parent_event_id')));
    END IF;

    IF v_effective_source_occurrence_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_occurrences co
      WHERE co.id = v_effective_source_occurrence_id
        AND co.event_id = v_effective_parent_event_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','SOURCE_OCCURRENCE_PARENT_MISMATCH','message','source_occurrence_id must belong to parent_event_id','path','/event/source_occurrence_id')));
    END IF;

    UPDATE public.events e SET
      name = COALESCE(v_event->>'name', e.name),
      venue_id = v_effective_venue_id,
      city_id = v_effective_city_id,
      country = COALESCE(v_country, e.country),
      lifecycle_status = COALESCE(v_event->>'lifecycle_status', e.lifecycle_status),
      website = COALESCE(NULLIF(v_event->>'website',''), e.website),
      ticket_url = COALESCE(NULLIF(v_event->>'ticket_url',''), e.ticket_url),
      description = COALESCE(v_event->>'description', e.description),
      meta_data = COALESCE(v_event->'meta_data', e.meta_data),
      type = COALESCE(v_type, e.type),
      schedule_type = COALESCE(v_schedule_type, e.schedule_type),
      start_time = COALESCE(v_start, e.start_time),
      end_time = COALESCE(v_end, e.end_time),
      parent_event_id = v_effective_parent_event_id,
      source_occurrence_id = v_effective_source_occurrence_id,
      updated_at = v_now
    WHERE e.id = v_event_id;
  END IF;

  IF v_organisers IS NOT NULL THEN
    PERFORM public.replace_or_patch_organisers(v_event_id, v_organisers, true);
  END IF;

  IF v_lineup IS NOT NULL OR v_lineup_replace THEN
    PERFORM public.replace_or_patch_lineup(v_event_id, v_full_lineup, v_lineup_replace);
  END IF;

  v_has_schedule := (p_payload ? 'occurrences') OR (v_event ? 'start_time') OR (v_event ? 'end_time');
  IF v_has_schedule THEN
    IF (p_payload ? 'occurrences') AND jsonb_typeof(v_occ) <> 'array' THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','OCC_INVALID_TYPE','message','occurrences must be an array when provided','path','/occurrences')));
    END IF;

    PERFORM public.replace_or_patch_occurrences(v_event_id, COALESCE(v_occ, '[]'::jsonb), true);

    SELECT count(*) INTO v_valid_occ_count FROM public.calendar_occurrences co WHERE co.event_id = v_event_id;
    IF v_valid_occ_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','OCC_REQUIRED','message','scheduling data present but no valid occurrences were persisted','path','/occurrences')));
    END IF;
  END IF;

  IF (p_payload ? 'guest_dancers') THEN
    IF jsonb_typeof(v_guest) <> 'object' THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_INVALID_TYPE','message','guest_dancers must be an object','path','/guest_dancers')));
    END IF;

    v_series_ids := v_guest->'series_profile_ids';
    v_occ_map := v_guest->'occurrence_guest_dancers';

    IF v_series_ids IS NOT NULL THEN
      IF jsonb_typeof(v_series_ids) <> 'array' THEN
        RETURN jsonb_build_object('success', false, 'status', 'error',
          'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_SERIES_INVALID','message','series_profile_ids must be an array','path','/guest_dancers/series_profile_ids')));
      END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_series_ids) LOOP
        BEGIN
          IF jsonb_typeof(v_item) = 'object' THEN
            v_profile_id := NULLIF(v_item->>'profile_id','')::uuid;
          ELSE
            v_profile_id := NULLIF(trim(both '"' from v_item::text),'')::uuid;
          END IF;
        EXCEPTION WHEN others THEN
          RETURN jsonb_build_object('success', false, 'status', 'error',
            'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_PROFILE_ID_INVALID','message','invalid series guest dancer profile_id','path','/guest_dancers/series_profile_ids')));
        END;
        v_guest_norm := v_guest_norm || jsonb_build_array(jsonb_build_object('profile_id', v_profile_id::text));
      END LOOP;
    END IF;

    IF v_occ_map IS NOT NULL THEN
      IF jsonb_typeof(v_occ_map) <> 'object' THEN
        RETURN jsonb_build_object('success', false, 'status', 'error',
          'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_OCC_MAP_INVALID','message','occurrence_guest_dancers must be an object keyed by occurrence uuid','path','/guest_dancers/occurrence_guest_dancers')));
      END IF;
      FOR v_k, v_v IN SELECT key, value FROM jsonb_each(v_occ_map) LOOP
        BEGIN
          v_occurrence_id := v_k::uuid;
        EXCEPTION WHEN others THEN
          RETURN jsonb_build_object('success', false, 'status', 'error',
            'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_OCC_KEY_INVALID','message','occurrence_guest_dancers key must be uuid','path','/guest_dancers/occurrence_guest_dancers/' || v_k)));
        END;
        IF jsonb_typeof(v_v) <> 'array' THEN
          RETURN jsonb_build_object('success', false, 'status', 'error',
            'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_OCC_VALUE_INVALID','message','occurrence_guest_dancers values must be arrays','path','/guest_dancers/occurrence_guest_dancers/' || v_k)));
        END IF;
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_v) LOOP
          BEGIN
            IF jsonb_typeof(v_item) = 'object' THEN
              v_profile_id := NULLIF(v_item->>'profile_id','')::uuid;
            ELSE
              v_profile_id := NULLIF(trim(both '"' from v_item::text),'')::uuid;
            END IF;
          EXCEPTION WHEN others THEN
            RETURN jsonb_build_object('success', false, 'status', 'error',
              'errors', jsonb_build_array(jsonb_build_object('code','GUEST_DANCERS_PROFILE_ID_INVALID','message','invalid occurrence guest dancer profile_id','path','/guest_dancers/occurrence_guest_dancers/' || v_k)));
          END;
          v_guest_norm := v_guest_norm || jsonb_build_array(jsonb_build_object('profile_id', v_profile_id::text, 'occurrence_id', v_occurrence_id::text));
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF (p_payload ? 'guest_dancers') OR v_guest_replace THEN
    PERFORM public.replace_or_patch_guest_dancers(v_event_id, v_guest_norm, v_guest_replace);
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'ok', 'event_id', v_event_id::text,
                             'updated_at', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END;
$_$;


ALTER FUNCTION "public"."admin_save_event_v2_impl"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "photo_url" "text", "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "nationality" "text", "years_teaching" integer, "teaching_styles" "text"[], "languages" "text"[], "achievements" "text"[], "faq" "text", "journey" "text", "offers_private" boolean, "availability" "text", "private_lesson_types" "text"[], "private_lesson_locations" "text"[], "private_travel_distance" numeric, "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text", "is_active" boolean, "hide_surname" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_is_new     boolean;
  v_record_id  uuid;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
  v_user_id    uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- Determine INSERT vs UPDATE
  v_is_new    := (p_entity_id IS NULL);
  v_record_id := COALESCE(p_entity_id, gen_random_uuid());

  IF NOT v_is_new AND NOT EXISTS (
    SELECT 1 FROM public.teacher_profiles WHERE teacher_profiles.id = v_record_id
  ) THEN
    RAISE EXCEPTION 'teacher_not_found';
  END IF;

  -- Resolve name fields
  v_first_name := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name  := NULLIF(btrim(COALESCE(p_payload->>'surname',     '')), '');
  v_full_name  := NULLIF(btrim(concat_ws(' ', v_first_name, v_last_name)), '');

  -- Resolve optional user_id link to member_profiles
  v_user_id := CASE
    WHEN p_payload ? 'user_id' AND p_payload->>'user_id' IS NOT NULL
      THEN NULLIF(btrim(p_payload->>'user_id'), '')::uuid
    ELSE NULL
  END;

  -- ── member_profiles upsert (conditional on user_id) ────────────────────────
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.member_profiles (
      id, first_name, last_name, full_name, avatar_url, based_city_id
    ) VALUES (
      v_user_id,
      v_first_name,
      v_last_name,
      v_full_name,
      CASE WHEN p_payload ? 'photo_url' THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'city_id'   THEN NULLIF(p_payload->>'city_id', '')::uuid                 ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name    = CASE WHEN p_payload ? 'first_name' THEN v_first_name
                           ELSE member_profiles.first_name    END,
      last_name     = CASE WHEN p_payload ? 'surname'    THEN v_last_name
                           ELSE member_profiles.last_name     END,
      full_name     = CASE WHEN (p_payload ? 'first_name' OR p_payload ? 'surname')
                           THEN COALESCE(v_full_name, member_profiles.full_name)
                           ELSE member_profiles.full_name     END,
      avatar_url    = CASE WHEN p_payload ? 'photo_url'  THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
                           ELSE member_profiles.avatar_url    END,
      based_city_id = CASE WHEN p_payload ? 'city_id'    THEN NULLIF(p_payload->>'city_id', '')::uuid
                           ELSE member_profiles.based_city_id END,
      updated_at    = now();
  END IF;

  -- ── teacher_profiles INSERT ─────────────────────────────────────────────────
  IF v_is_new THEN
    INSERT INTO public.teacher_profiles (
      id,
      first_name,
      surname,
      photo_url,
      gallery_urls,
      city_id,
      nationality,
      years_teaching,
      teaching_styles,
      languages,
      achievements,
      faq,
      journey,
      availability,
      offers_private,
      private_lesson_types,
      private_lesson_locations,
      private_travel_distance,
      website,
      instagram,
      facebook,
      email,
      phone,
      is_active,
      hide_surname,
      meta_data,
      user_id,
      profile_source,
      created_by
    ) VALUES (
      v_record_id,
      v_first_name,
      v_last_name,
      CASE WHEN p_payload ? 'photo_url'   THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url',   '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'gallery_urls'     THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))      ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'city_id'     THEN NULLIF(p_payload->>'city_id', '')::uuid                                      ELSE NULL END,
      CASE WHEN p_payload ? 'nationality' THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'years_teaching'        THEN (p_payload->>'years_teaching')::integer                        ELSE NULL END,
      CASE WHEN p_payload ? 'teaching_styles'       THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'teaching_styles'))       ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'languages'             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'languages'))             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'achievements'          THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'achievements'))          ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'faq'         THEN p_payload->>'faq'                                          ELSE NULL END,
      CASE WHEN p_payload ? 'journey'     THEN p_payload->>'journey'                                      ELSE NULL END,
      CASE WHEN p_payload ? 'availability' THEN NULLIF(btrim(COALESCE(p_payload->>'availability', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'offers_private'        THEN COALESCE((p_payload->>'offers_private')::boolean, false)               ELSE false END,
      CASE WHEN p_payload ? 'private_lesson_types'  THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'private_lesson_types'))  ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'private_lesson_locations' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'private_lesson_locations')) ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'private_travel_distance' THEN (p_payload->>'private_travel_distance')::numeric                        ELSE NULL END,
      CASE WHEN p_payload ? 'website'   THEN NULLIF(btrim(COALESCE(p_payload->>'website',   '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'instagram' THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'facebook'  THEN NULLIF(btrim(COALESCE(p_payload->>'facebook',  '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'email'     THEN NULLIF(btrim(COALESCE(p_payload->>'email',     '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'phone'     THEN NULLIF(btrim(COALESCE(p_payload->>'phone',     '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE NULL END,
      CASE WHEN p_payload ? 'hide_surname' THEN COALESCE((p_payload->>'hide_surname')::boolean, false) ELSE false END,
      CASE WHEN p_payload ? 'meta_data' THEN COALESCE(p_payload->'meta_data', '{}'::jsonb) ELSE '{}'::jsonb END,
      v_user_id,
      COALESCE(NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''), 'admin_create'),
      auth.uid()
    );

  -- ── teacher_profiles UPDATE ─────────────────────────────────────────────────
  ELSE
    UPDATE public.teacher_profiles tp SET
      first_name               = CASE WHEN p_payload ? 'first_name'               THEN v_first_name                                                                 ELSE tp.first_name               END,
      surname                  = CASE WHEN p_payload ? 'surname'                  THEN v_last_name                                                                  ELSE tp.surname                  END,
      photo_url                = CASE WHEN p_payload ? 'photo_url'                THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url',  '')), '')                    ELSE tp.photo_url                END,
      gallery_urls             = CASE WHEN p_payload ? 'gallery_urls'             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))           ELSE tp.gallery_urls             END,
      city_id                  = CASE WHEN p_payload ? 'city_id'                  THEN NULLIF(p_payload->>'city_id', '')::uuid                                      ELSE tp.city_id                  END,
      nationality              = CASE WHEN p_payload ? 'nationality'              THEN NULLIF(btrim(COALESCE(p_payload->>'nationality','')),'')                     ELSE tp.nationality              END,
      years_teaching           = CASE WHEN p_payload ? 'years_teaching'           THEN (p_payload->>'years_teaching')::integer                                      ELSE tp.years_teaching           END,
      teaching_styles          = CASE WHEN p_payload ? 'teaching_styles'          THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'teaching_styles'))        ELSE tp.teaching_styles          END,
      languages                = CASE WHEN p_payload ? 'languages'                THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'languages'))              ELSE tp.languages                END,
      achievements             = CASE WHEN p_payload ? 'achievements'             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'achievements'))           ELSE tp.achievements             END,
      faq                      = CASE WHEN p_payload ? 'faq'                      THEN p_payload->>'faq'                                                            ELSE tp.faq                      END,
      journey                  = CASE WHEN p_payload ? 'journey'                  THEN p_payload->>'journey'                                                        ELSE tp.journey                  END,
      availability             = CASE WHEN p_payload ? 'availability'             THEN NULLIF(btrim(COALESCE(p_payload->>'availability','')),'')                    ELSE tp.availability             END,
      offers_private           = CASE WHEN p_payload ? 'offers_private'           THEN COALESCE((p_payload->>'offers_private')::boolean, false)                    ELSE tp.offers_private           END,
      private_lesson_types     = CASE WHEN p_payload ? 'private_lesson_types'     THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'private_lesson_types'))  ELSE tp.private_lesson_types     END,
      private_lesson_locations = CASE WHEN p_payload ? 'private_lesson_locations' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'private_lesson_locations')) ELSE tp.private_lesson_locations END,
      private_travel_distance  = CASE WHEN p_payload ? 'private_travel_distance'  THEN (p_payload->>'private_travel_distance')::numeric                            ELSE tp.private_travel_distance  END,
      website                  = CASE WHEN p_payload ? 'website'                  THEN NULLIF(btrim(COALESCE(p_payload->>'website',  '')), '')                      ELSE tp.website                  END,
      instagram                = CASE WHEN p_payload ? 'instagram'                THEN NULLIF(btrim(COALESCE(p_payload->>'instagram','')), '')                      ELSE tp.instagram                END,
      facebook                 = CASE WHEN p_payload ? 'facebook'                 THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')                      ELSE tp.facebook                 END,
      email                    = CASE WHEN p_payload ? 'email'                    THEN NULLIF(btrim(COALESCE(p_payload->>'email',    '')), '')                      ELSE tp.email                    END,
      phone                    = CASE WHEN p_payload ? 'phone'                    THEN NULLIF(btrim(COALESCE(p_payload->>'phone',    '')), '')                      ELSE tp.phone                    END,
      is_active                = CASE WHEN p_payload ? 'is_active'                THEN (p_payload->>'is_active')::boolean                                           ELSE tp.is_active                END,
      hide_surname             = CASE WHEN p_payload ? 'hide_surname'             THEN COALESCE((p_payload->>'hide_surname')::boolean, false)                       ELSE tp.hide_surname             END,
      meta_data                = CASE WHEN p_payload ? 'meta_data'                THEN COALESCE(tp.meta_data, '{}'::jsonb) || (p_payload->'meta_data')              ELSE tp.meta_data                END,
      user_id                  = CASE WHEN p_payload ? 'user_id'                  THEN v_user_id                                                                    ELSE tp.user_id                  END,
      profile_source           = CASE WHEN p_payload ? 'profile_source'           THEN NULLIF(btrim(COALESCE(p_payload->>'profile_source','')), '')                 ELSE tp.profile_source           END,
      updated_at               = now()
    WHERE tp.id = v_record_id;
  END IF;

  -- Return full row; cast created_at to timestamptz (column is timestamp w/o tz)
  RETURN QUERY
    SELECT
      tp.id,
      tp.first_name,
      tp.surname,
      tp.photo_url,
      tp.gallery_urls,
      tp.city_id,
      c.name                             AS city,
      tp.nationality,
      tp.years_teaching,
      tp.teaching_styles,
      tp.languages,
      tp.achievements,
      tp.faq,
      tp.journey,
      COALESCE(tp.offers_private, false) AS offers_private,
      tp.availability,
      tp.private_lesson_types,
      tp.private_lesson_locations,
      tp.private_travel_distance,
      tp.website,
      tp.instagram,
      tp.facebook,
      tp.email,
      tp.phone,
      tp.is_active,
      COALESCE(tp.hide_surname, false)   AS hide_surname,
      tp.meta_data,
      tp.profile_source,
      tp.created_at::timestamptz,
      tp.updated_at
    FROM public.teacher_profiles tp
    LEFT JOIN public.cities c ON c.id = tp.city_id
    WHERE tp.id = v_record_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "business_name" "text", "representative_name" "text", "first_name" "text", "surname" "text", "city_id" "uuid", "city" "text", "country" "text", "address" "text", "description" "text", "short_description" "text", "faq" "text", "ships_international" boolean, "products" "jsonb", "product_photos" "text"[], "product_categories" "text"[], "photo_url" "text"[], "gallery_urls" "text"[], "website" "text", "instagram" "text", "facebook" "text", "whatsapp" "text", "email" "text", "public_email" "text", "phone" "text", "promo_code" "text", "promo_discount_type" "text", "promo_discount_value" numeric, "team" "jsonb", "upcoming_events" "text"[], "verified" boolean, "is_active" boolean, "meta_data" "jsonb", "profile_source" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_is_new     boolean;
  v_record_id  uuid;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
  v_user_id    uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_is_new    := (p_entity_id IS NULL);
  v_record_id := COALESCE(p_entity_id, gen_random_uuid());

  IF NOT v_is_new AND NOT EXISTS (
    SELECT 1 FROM public.vendors WHERE vendors.id = v_record_id
  ) THEN
    RAISE EXCEPTION 'vendor_not_found';
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name  := NULLIF(btrim(COALESCE(p_payload->>'surname',     '')), '');
  v_full_name  := NULLIF(btrim(concat_ws(' ', v_first_name, v_last_name)), '');

  v_user_id := CASE
    WHEN p_payload ? 'user_id' AND p_payload->>'user_id' IS NOT NULL
      THEN NULLIF(btrim(p_payload->>'user_id'), '')::uuid
    ELSE NULL
  END;

  -- ── member_profiles upsert (conditional on user_id) ──────────────────────
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.member_profiles (
      id, first_name, last_name, full_name, avatar_url, based_city_id
    ) VALUES (
      v_user_id,
      v_first_name,
      v_last_name,
      v_full_name,
      CASE WHEN p_payload ? 'photo_url'
             THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
             ELSE NULL END,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid
             ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name    = CASE WHEN p_payload ? 'first_name' THEN v_first_name
                           ELSE member_profiles.first_name    END,
      last_name     = CASE WHEN p_payload ? 'surname'    THEN v_last_name
                           ELSE member_profiles.last_name     END,
      full_name     = CASE WHEN (p_payload ? 'first_name' OR p_payload ? 'surname')
                           THEN COALESCE(v_full_name, member_profiles.full_name)
                           ELSE member_profiles.full_name     END,
      avatar_url    = CASE WHEN p_payload ? 'photo_url'
                           THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
                           ELSE member_profiles.avatar_url    END,
      based_city_id = CASE WHEN p_payload ? 'city_id'
                           THEN NULLIF(p_payload->>'city_id', '')::uuid
                           ELSE member_profiles.based_city_id END,
      updated_at    = now();
  END IF;

  -- ── vendors INSERT ────────────────────────────────────────────────────────
  IF v_is_new THEN
    INSERT INTO public.vendors (
      id,
      business_name,
      representative_name,
      first_name,
      surname,
      city_id,
      city,
      country,
      address,
      description,
      short_description,
      faq,
      ships_international,
      products,
      product_photos,
      product_categories,
      photo_url,
      gallery_urls,
      website,
      instagram,
      facebook,
      whatsapp,
      email,
      public_email,
      phone,
      promo_code,
      promo_discount_type,
      promo_discount_value,
      team,
      upcoming_events,
      verified,
      is_active,
      meta_data,
      user_id,
      profile_source,
      created_by
    ) VALUES (
      v_record_id,
      CASE WHEN p_payload ? 'business_name'
             THEN NULLIF(btrim(COALESCE(p_payload->>'business_name', '')), '')         ELSE NULL END,
      CASE WHEN p_payload ? 'representative_name'
             THEN NULLIF(btrim(COALESCE(p_payload->>'representative_name', '')), '')   ELSE NULL END,
      v_first_name,
      v_last_name,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid                              ELSE NULL END,
      CASE WHEN p_payload ? 'city'
             THEN NULLIF(btrim(COALESCE(p_payload->>'city', '')), '')                  ELSE NULL END,
      CASE WHEN p_payload ? 'country'
             THEN NULLIF(btrim(COALESCE(p_payload->>'country', '')), '')               ELSE NULL END,
      CASE WHEN p_payload ? 'address'
             THEN NULLIF(btrim(COALESCE(p_payload->>'address', '')), '')               ELSE NULL END,
      CASE WHEN p_payload ? 'description'       THEN p_payload->>'description'         ELSE NULL END,
      CASE WHEN p_payload ? 'short_description'
             THEN NULLIF(btrim(COALESCE(p_payload->>'short_description', '')), '')     ELSE NULL END,
      CASE WHEN p_payload ? 'faq'               THEN p_payload->>'faq'                ELSE NULL END,
      CASE WHEN p_payload ? 'ships_international'
             THEN COALESCE((p_payload->>'ships_international')::boolean, false)        ELSE false END,
      CASE WHEN p_payload ? 'products'
             THEN COALESCE(p_payload->'products', '[]'::jsonb)
             ELSE '[]'::jsonb END,
      CASE WHEN p_payload ? 'product_photos'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'product_photos'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'product_categories'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'product_categories'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'photo_url'
             THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'gallery_urls'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'website'
             THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')               ELSE NULL END,
      CASE WHEN p_payload ? 'instagram'
             THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')             ELSE NULL END,
      CASE WHEN p_payload ? 'facebook'
             THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')              ELSE NULL END,
      CASE WHEN p_payload ? 'whatsapp'
             THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')              ELSE NULL END,
      CASE WHEN p_payload ? 'email'
             THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')                 ELSE NULL END,
      CASE WHEN p_payload ? 'public_email'
             THEN NULLIF(btrim(COALESCE(p_payload->>'public_email', '')), '')          ELSE NULL END,
      CASE WHEN p_payload ? 'phone'
             THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')                 ELSE NULL END,
      CASE WHEN p_payload ? 'promo_code'
             THEN NULLIF(btrim(COALESCE(p_payload->>'promo_code', '')), '')            ELSE NULL END,
      CASE WHEN p_payload ? 'promo_discount_type'
             THEN NULLIF(btrim(COALESCE(p_payload->>'promo_discount_type', '')), '')   ELSE NULL END,
      CASE WHEN p_payload ? 'promo_discount_value'
             THEN NULLIF(p_payload->>'promo_discount_value', '')::numeric              ELSE NULL END,
      CASE WHEN p_payload ? 'team'
             THEN COALESCE(p_payload->'team', '[]'::jsonb)
             ELSE '[]'::jsonb END,
      CASE WHEN p_payload ? 'upcoming_events'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'verified'
             THEN COALESCE((p_payload->>'verified')::boolean, false)                   ELSE false END,
      CASE WHEN p_payload ? 'is_active'
             THEN (p_payload->>'is_active')::boolean                                   ELSE NULL END,
      CASE WHEN p_payload ? 'meta_data'
             THEN COALESCE(p_payload->'meta_data', '{}'::jsonb)
             ELSE '{}'::jsonb END,
      v_user_id,
      COALESCE(NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''), 'admin_create'),
      auth.uid()
    );

  -- ── vendors UPDATE ────────────────────────────────────────────────────────
  ELSE
    UPDATE public.vendors v SET
      business_name        = CASE WHEN p_payload ? 'business_name'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'business_name', '')), '')
                                   ELSE v.business_name        END,
      representative_name  = CASE WHEN p_payload ? 'representative_name'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'representative_name', '')), '')
                                   ELSE v.representative_name  END,
      first_name           = CASE WHEN p_payload ? 'first_name'      THEN v_first_name  ELSE v.first_name           END,
      surname              = CASE WHEN p_payload ? 'surname'          THEN v_last_name   ELSE v.surname              END,
      city_id              = CASE WHEN p_payload ? 'city_id'
                                   THEN NULLIF(p_payload->>'city_id', '')::uuid
                                   ELSE v.city_id              END,
      city                 = CASE WHEN p_payload ? 'city'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'city', '')), '')
                                   ELSE v.city                 END,
      country              = CASE WHEN p_payload ? 'country'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'country', '')), '')
                                   ELSE v.country              END,
      address              = CASE WHEN p_payload ? 'address'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'address', '')), '')
                                   ELSE v.address              END,
      description          = CASE WHEN p_payload ? 'description'          THEN p_payload->>'description'          ELSE v.description          END,
      short_description    = CASE WHEN p_payload ? 'short_description'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'short_description', '')), '')
                                   ELSE v.short_description    END,
      faq                  = CASE WHEN p_payload ? 'faq'                  THEN p_payload->>'faq'                  ELSE v.faq                  END,
      ships_international  = CASE WHEN p_payload ? 'ships_international'
                                   THEN COALESCE((p_payload->>'ships_international')::boolean, false)
                                   ELSE v.ships_international  END,
      products             = CASE WHEN p_payload ? 'products'
                                   THEN COALESCE(p_payload->'products', '[]'::jsonb)
                                   ELSE v.products             END,
      product_photos       = CASE WHEN p_payload ? 'product_photos'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'product_photos'))
                                   ELSE v.product_photos       END,
      product_categories   = CASE WHEN p_payload ? 'product_categories'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'product_categories'))
                                   ELSE v.product_categories   END,
      photo_url            = CASE WHEN p_payload ? 'photo_url'
                                   THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
                                   ELSE v.photo_url            END,
      gallery_urls         = CASE WHEN p_payload ? 'gallery_urls'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
                                   ELSE v.gallery_urls         END,
      website              = CASE WHEN p_payload ? 'website'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')
                                   ELSE v.website              END,
      instagram            = CASE WHEN p_payload ? 'instagram'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')
                                   ELSE v.instagram            END,
      facebook             = CASE WHEN p_payload ? 'facebook'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')
                                   ELSE v.facebook             END,
      whatsapp             = CASE WHEN p_payload ? 'whatsapp'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')
                                   ELSE v.whatsapp             END,
      email                = CASE WHEN p_payload ? 'email'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')
                                   ELSE v.email                END,
      public_email         = CASE WHEN p_payload ? 'public_email'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'public_email', '')), '')
                                   ELSE v.public_email         END,
      phone                = CASE WHEN p_payload ? 'phone'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')
                                   ELSE v.phone                END,
      promo_code           = CASE WHEN p_payload ? 'promo_code'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'promo_code', '')), '')
                                   ELSE v.promo_code           END,
      promo_discount_type  = CASE WHEN p_payload ? 'promo_discount_type'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'promo_discount_type', '')), '')
                                   ELSE v.promo_discount_type  END,
      promo_discount_value = CASE WHEN p_payload ? 'promo_discount_value'
                                   THEN NULLIF(p_payload->>'promo_discount_value', '')::numeric
                                   ELSE v.promo_discount_value END,
      team                 = CASE WHEN p_payload ? 'team'
                                   THEN COALESCE(p_payload->'team', '[]'::jsonb)
                                   ELSE v.team                 END,
      upcoming_events      = CASE WHEN p_payload ? 'upcoming_events'
                                   THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
                                   ELSE v.upcoming_events      END,
      verified             = CASE WHEN p_payload ? 'verified'
                                   THEN COALESCE((p_payload->>'verified')::boolean, false)
                                   ELSE v.verified             END,
      is_active            = CASE WHEN p_payload ? 'is_active'
                                   THEN (p_payload->>'is_active')::boolean
                                   ELSE v.is_active            END,
      meta_data            = CASE WHEN p_payload ? 'meta_data'
                                   THEN COALESCE(v.meta_data, '{}'::jsonb) || (p_payload->'meta_data')
                                   ELSE v.meta_data            END,
      user_id              = CASE WHEN p_payload ? 'user_id'       THEN v_user_id          ELSE v.user_id              END,
      profile_source       = CASE WHEN p_payload ? 'profile_source'
                                   THEN NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), '')
                                   ELSE v.profile_source       END,
      -- created_by: immutable — never changed on UPDATE
      updated_at           = now()
    WHERE v.id = v_record_id;
  END IF;

  RETURN QUERY
    SELECT
      v.id,
      v.business_name,
      v.representative_name,
      v.first_name,
      v.surname,
      v.city_id,
      c.name               AS city,
      v.country,
      v.address,
      v.description,
      v.short_description,
      v.faq,
      v.ships_international,
      v.products,
      v.product_photos,
      v.product_categories,
      v.photo_url,
      v.gallery_urls,
      v.website,
      v.instagram,
      v.facebook,
      v.whatsapp,
      v.email,
      v.public_email,
      v.phone,
      v.promo_code,
      v.promo_discount_type,
      v.promo_discount_value,
      v.team,
      v.upcoming_events,
      v.verified,
      v.is_active,
      v.meta_data,
      v.profile_source,
      v.updated_at
    FROM public.vendors v
    LEFT JOIN public.cities c ON c.id = v.city_id
    WHERE v.id = v_record_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_venue"("p_venue_id" "uuid", "p_city_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_capacity" integer DEFAULT NULL::integer, "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("venue_id" "uuid", "venue_entity_id" "uuid", "entity_city_id" "uuid", "venue_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_entity_id uuid;
BEGIN
  SELECT v.entity_id INTO v_entity_id
  FROM public.venues v
  WHERE v.id = p_venue_id;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Venue % not found or missing entity_id', p_venue_id;
  END IF;

  IF p_city_id IS NOT NULL THEN
    UPDATE public.entities e
    SET city_id = p_city_id
    WHERE e.id = v_entity_id;
  END IF;

  UPDATE public.venues v SET
    name      = COALESCE(p_name, v.name),
    address   = COALESCE(p_address, v.address),
    capacity  = COALESCE(p_capacity, v.capacity),
    meta_data = COALESCE(p_metadata, v.meta_data)
  WHERE v.id = p_venue_id;

  RETURN QUERY
  SELECT
    v.id AS venue_id,
    v.entity_id AS venue_entity_id,
    e.city_id AS entity_city_id,
    v.name AS venue_name
  FROM public.venues v
  JOIN public.entities e ON e.id = v.entity_id
  WHERE v.id = p_venue_id;
END;$$;


ALTER FUNCTION "public"."admin_save_venue"("p_venue_id" "uuid", "p_city_id" "uuid", "p_name" "text", "p_address" "text", "p_capacity" integer, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "business_name" "text", "first_name" "text", "surname" "text", "nationality" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "videography_styles" "text"[], "equipment" "text", "travel_options" "text", "team" "jsonb", "upcoming_events" "text"[], "instagram" "text", "facebook" "text", "website" "text", "email" "text", "public_email" "text", "phone" "text", "whatsapp" "text", "faq" "text", "short_description" "text", "description" "text", "verified" boolean, "is_active" boolean, "meta_data" "jsonb", "profile_source" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_is_new     boolean;
  v_record_id  uuid;
  v_first_name text;
  v_last_name  text;
  v_full_name  text;
  v_user_id    uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  v_is_new    := (p_entity_id IS NULL);
  v_record_id := COALESCE(p_entity_id, gen_random_uuid());

  IF NOT v_is_new AND NOT EXISTS (
    SELECT 1 FROM public.videographers WHERE videographers.id = v_record_id
  ) THEN
    RAISE EXCEPTION 'videographer_not_found';
  END IF;

  v_first_name := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name  := NULLIF(btrim(COALESCE(p_payload->>'surname',     '')), '');
  v_full_name  := NULLIF(btrim(concat_ws(' ', v_first_name, v_last_name)), '');

  v_user_id := CASE
    WHEN p_payload ? 'user_id' AND p_payload->>'user_id' IS NOT NULL
      THEN NULLIF(btrim(p_payload->>'user_id'), '')::uuid
    ELSE NULL
  END;

  -- ── member_profiles upsert (conditional on user_id) ────────────────────────
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.member_profiles (
      id, first_name, last_name, full_name, avatar_url, based_city_id
    ) VALUES (
      v_user_id,
      v_first_name,
      v_last_name,
      v_full_name,
      CASE WHEN p_payload ? 'photo_url'
             THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
             ELSE NULL END,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid
             ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
      first_name    = CASE WHEN p_payload ? 'first_name' THEN v_first_name
                           ELSE member_profiles.first_name    END,
      last_name     = CASE WHEN p_payload ? 'surname'    THEN v_last_name
                           ELSE member_profiles.last_name     END,
      full_name     = CASE WHEN (p_payload ? 'first_name' OR p_payload ? 'surname')
                           THEN COALESCE(v_full_name, member_profiles.full_name)
                           ELSE member_profiles.full_name     END,
      avatar_url    = CASE WHEN p_payload ? 'photo_url'
                           THEN NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')
                           ELSE member_profiles.avatar_url    END,
      based_city_id = CASE WHEN p_payload ? 'city_id'
                           THEN NULLIF(p_payload->>'city_id', '')::uuid
                           ELSE member_profiles.based_city_id END,
      updated_at    = now();
  END IF;

  -- ── videographers INSERT ─────────────────────────────────────────────────────
  IF v_is_new THEN
    INSERT INTO public.videographers (
      id,
      business_name,
      first_name,
      surname,
      nationality,
      photo_url,
      gallery_urls,
      city_id,
      country,
      address,
      videography_styles,
      equipment,
      travel_options,
      team,
      upcoming_events,
      instagram,
      facebook,
      website,
      email,
      public_email,
      phone,
      whatsapp,
      faq,
      short_description,
      description,
      verified,
      is_active,
      meta_data,
      user_id,
      profile_source,
      created_by
    ) VALUES (
      v_record_id,
      CASE WHEN p_payload ? 'business_name'
             THEN NULLIF(btrim(COALESCE(p_payload->>'business_name', '')), '')   ELSE NULL END,
      v_first_name,
      v_last_name,
      CASE WHEN p_payload ? 'nationality'
             THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '')     ELSE NULL END,
      CASE WHEN p_payload ? 'photo_url'
             THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'gallery_urls'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'city_id'
             THEN NULLIF(p_payload->>'city_id', '')::uuid                        ELSE NULL END,
      CASE WHEN p_payload ? 'country'
             THEN NULLIF(btrim(COALESCE(p_payload->>'country', '')), '')         ELSE NULL END,
      CASE WHEN p_payload ? 'address'
             THEN NULLIF(btrim(COALESCE(p_payload->>'address', '')), '')         ELSE NULL END,
      CASE WHEN p_payload ? 'videography_styles'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'videography_styles'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'equipment'
             THEN NULLIF(btrim(COALESCE(p_payload->>'equipment', '')), '')       ELSE NULL END,
      CASE WHEN p_payload ? 'travel_options'
             THEN NULLIF(btrim(COALESCE(p_payload->>'travel_options', '')), '')  ELSE NULL END,
      CASE WHEN p_payload ? 'team'
             THEN COALESCE(p_payload->'team', '[]'::jsonb)
             ELSE '[]'::jsonb END,
      CASE WHEN p_payload ? 'upcoming_events'
             THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
             ELSE '{}'::text[] END,
      CASE WHEN p_payload ? 'instagram'
             THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')       ELSE NULL END,
      CASE WHEN p_payload ? 'facebook'
             THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')        ELSE NULL END,
      CASE WHEN p_payload ? 'website'
             THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')         ELSE NULL END,
      CASE WHEN p_payload ? 'email'
             THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')           ELSE NULL END,
      CASE WHEN p_payload ? 'public_email'
             THEN NULLIF(btrim(COALESCE(p_payload->>'public_email', '')), '')    ELSE NULL END,
      CASE WHEN p_payload ? 'phone'
             THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')           ELSE NULL END,
      CASE WHEN p_payload ? 'whatsapp'
             THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')        ELSE NULL END,
      CASE WHEN p_payload ? 'faq'              THEN p_payload->>'faq'           ELSE NULL END,
      CASE WHEN p_payload ? 'short_description'
             THEN NULLIF(btrim(COALESCE(p_payload->>'short_description', '')), '') ELSE NULL END,
      CASE WHEN p_payload ? 'description'      THEN p_payload->>'description'   ELSE NULL END,
      CASE WHEN p_payload ? 'verified'
             THEN COALESCE((p_payload->>'verified')::boolean, false)             ELSE false END,
      CASE WHEN p_payload ? 'is_active'
             THEN (p_payload->>'is_active')::boolean                             ELSE NULL END,
      CASE WHEN p_payload ? 'meta_data'
             THEN COALESCE(p_payload->'meta_data', '{}'::jsonb)
             ELSE '{}'::jsonb END,
      v_user_id,
      COALESCE(NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), ''), 'admin_create'),
      auth.uid()
    );

  -- ── videographers UPDATE ─────────────────────────────────────────────────────
  ELSE
    UPDATE public.videographers v SET
      business_name      = CASE WHEN p_payload ? 'business_name'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'business_name', '')), '')
                                 ELSE v.business_name      END,
      first_name         = CASE WHEN p_payload ? 'first_name'      THEN v_first_name  ELSE v.first_name         END,
      surname            = CASE WHEN p_payload ? 'surname'          THEN v_last_name   ELSE v.surname            END,
      nationality        = CASE WHEN p_payload ? 'nationality'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'nationality', '')), '')
                                 ELSE v.nationality        END,
      photo_url          = CASE WHEN p_payload ? 'photo_url'
                                 THEN ARRAY[NULLIF(btrim(COALESCE(p_payload->>'photo_url', '')), '')]::text[]
                                 ELSE v.photo_url          END,
      gallery_urls       = CASE WHEN p_payload ? 'gallery_urls'
                                 THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'gallery_urls'))
                                 ELSE v.gallery_urls       END,
      city_id            = CASE WHEN p_payload ? 'city_id'
                                 THEN NULLIF(p_payload->>'city_id', '')::uuid
                                 ELSE v.city_id            END,
      country            = CASE WHEN p_payload ? 'country'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'country', '')), '')
                                 ELSE v.country            END,
      address            = CASE WHEN p_payload ? 'address'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'address', '')), '')
                                 ELSE v.address            END,
      videography_styles = CASE WHEN p_payload ? 'videography_styles'
                                 THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'videography_styles'))
                                 ELSE v.videography_styles END,
      equipment          = CASE WHEN p_payload ? 'equipment'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'equipment', '')), '')
                                 ELSE v.equipment          END,
      travel_options     = CASE WHEN p_payload ? 'travel_options'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'travel_options', '')), '')
                                 ELSE v.travel_options     END,
      team               = CASE WHEN p_payload ? 'team'
                                 THEN COALESCE(p_payload->'team', '[]'::jsonb)
                                 ELSE v.team               END,
      upcoming_events    = CASE WHEN p_payload ? 'upcoming_events'
                                 THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'upcoming_events'))
                                 ELSE v.upcoming_events    END,
      instagram          = CASE WHEN p_payload ? 'instagram'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'instagram', '')), '')
                                 ELSE v.instagram          END,
      facebook           = CASE WHEN p_payload ? 'facebook'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'facebook', '')), '')
                                 ELSE v.facebook           END,
      website            = CASE WHEN p_payload ? 'website'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'website', '')), '')
                                 ELSE v.website            END,
      email              = CASE WHEN p_payload ? 'email'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'email', '')), '')
                                 ELSE v.email              END,
      public_email       = CASE WHEN p_payload ? 'public_email'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'public_email', '')), '')
                                 ELSE v.public_email       END,
      phone              = CASE WHEN p_payload ? 'phone'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '')
                                 ELSE v.phone              END,
      whatsapp           = CASE WHEN p_payload ? 'whatsapp'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'whatsapp', '')), '')
                                 ELSE v.whatsapp           END,
      faq                = CASE WHEN p_payload ? 'faq'        THEN p_payload->>'faq'        ELSE v.faq                END,
      short_description  = CASE WHEN p_payload ? 'short_description'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'short_description', '')), '')
                                 ELSE v.short_description  END,
      description        = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE v.description      END,
      verified           = CASE WHEN p_payload ? 'verified'
                                 THEN COALESCE((p_payload->>'verified')::boolean, false)
                                 ELSE v.verified           END,
      is_active          = CASE WHEN p_payload ? 'is_active'
                                 THEN (p_payload->>'is_active')::boolean
                                 ELSE v.is_active          END,
      meta_data          = CASE WHEN p_payload ? 'meta_data'
                                 THEN COALESCE(v.meta_data, '{}'::jsonb) || (p_payload->'meta_data')
                                 ELSE v.meta_data          END,
      user_id            = CASE WHEN p_payload ? 'user_id'    THEN v_user_id          ELSE v.user_id            END,
      profile_source     = CASE WHEN p_payload ? 'profile_source'
                                 THEN NULLIF(btrim(COALESCE(p_payload->>'profile_source', '')), '')
                                 ELSE v.profile_source     END,
      -- created_by: immutable — never changed on UPDATE
      updated_at         = now()
    WHERE v.id = v_record_id;
  END IF;

  RETURN QUERY
    SELECT
      v.id,
      v.business_name,
      v.first_name,
      v.surname,
      v.nationality,
      v.photo_url,
      v.gallery_urls,
      v.city_id,
      c.name             AS city,
      v.country,
      v.address,
      v.videography_styles,
      v.equipment,
      v.travel_options,
      v.team,
      v.upcoming_events,
      v.instagram,
      v.facebook,
      v.website,
      v.email,
      v.public_email,
      v.phone,
      v.whatsapp,
      v.faq,
      v.short_description,
      v.description,
      v.verified,
      v.is_active,
      v.meta_data,
      v.profile_source,
      v.created_at,
      v.updated_at
    FROM public.videographers v
    LEFT JOIN public.cities c ON c.id = v.city_id
    WHERE v.id = v_record_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("person_key" "uuid", "user_id" "uuid", "display_name" "text", "avatar_url" "text", "role_types" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- explicit admin check
  SELECT COALESCE(asu.is_active, false)
  INTO v_is_admin
  FROM public.admin_super_users AS asu
  WHERE asu.user_id = auth.uid()
  LIMIT 1;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'admin_search_existing_persons_v1: caller is not an active admin';
  END IF;

  RETURN QUERY
  WITH
    s_member_profiles AS (
      SELECT
        m.id::uuid AS canonical_key,
        m.id::uuid AS user_id,
        NULLIF(trim(COALESCE(m.full_name, '')), '') AS mp_full_name,
        NULLIF(trim(COALESCE(m.avatar_url, '')), '')::text AS avatar_url,
        'member'::text AS role_type
      FROM public.member_profiles m
      WHERE m.id IS NOT NULL
    ),

    s_profiles AS (
      SELECT
        p.id::uuid AS canonical_key,
        p.id::uuid AS user_id,
        NULLIF(trim(COALESCE(p.full_name, '')), '') AS p_full_name,
        NULLIF(trim(COALESCE(p.username, '')), '') AS p_username,
        NULLIF(trim(COALESCE(p.email, '')), '') AS p_email,
        NULLIF(trim(COALESCE(p.avatar_url, '')), '')::text AS avatar_url,
        'profile'::text AS role_type
      FROM public.profiles p
      WHERE p.id IS NOT NULL
    ),

    s_dancers AS (
      SELECT
        d.user_id::uuid AS canonical_key,
        d.user_id::uuid AS user_id,
        NULLIF(
          trim(
            COALESCE(d.first_name, '') ||
            CASE WHEN d.first_name IS NOT NULL AND d.surname IS NOT NULL THEN ' ' ELSE '' END ||
            COALESCE(d.surname, '')
          ),
          ''
        ) AS role_name,
        NULLIF(trim(COALESCE(d.photo_url, '')), '')::text AS avatar_url,
        'dancer'::text AS role_type
      FROM public.dancers d
      WHERE d.user_id IS NOT NULL
    ),

    s_teacher_profiles AS (
      SELECT
        tp.user_id::uuid AS canonical_key,
        tp.user_id::uuid AS user_id,
        NULLIF(
          trim(
            COALESCE(tp.first_name, '') ||
            CASE WHEN tp.first_name IS NOT NULL AND tp.surname IS NOT NULL THEN ' ' ELSE '' END ||
            COALESCE(tp.surname, '')
          ),
          ''
        ) AS role_name,
        NULLIF(trim(COALESCE(tp.photo_url, '')), '')::text AS avatar_url,
        'teacher'::text AS role_type
      FROM public.teacher_profiles tp
      WHERE tp.user_id IS NOT NULL
    ),

    s_dj_profiles AS (
      SELECT
        dp.user_id::uuid AS canonical_key,
        dp.user_id::uuid AS user_id,
        NULLIF(trim(COALESCE(dp.real_name, dp.name, dp.dj_name, '')), '') AS role_name,
        CASE
          WHEN array_length(dp.photo_url, 1) > 0 THEN NULLIF(trim(dp.photo_url[1]), '')
          ELSE NULL
        END::text AS avatar_url,
        'dj'::text AS role_type
      FROM public.dj_profiles dp
      WHERE dp.user_id IS NOT NULL
    ),

    s_vendors AS (
      SELECT
        v.user_id::uuid AS canonical_key,
        v.user_id::uuid AS user_id,
        NULLIF(trim(COALESCE(v.business_name, '')), '') AS role_name,
        CASE
          WHEN array_length(v.photo_url, 1) > 0 THEN NULLIF(trim(v.photo_url[1]), '')
          ELSE NULL
        END::text AS avatar_url,
        'vendor'::text AS role_type
      FROM public.vendors v
      WHERE v.user_id IS NOT NULL
    ),

    s_videographers AS (
      SELECT
        vg.user_id::uuid AS canonical_key,
        vg.user_id::uuid AS user_id,
        NULLIF(trim(COALESCE(vg.business_name, '')), '') AS role_name,
        CASE
          WHEN array_length(vg.photo_url, 1) > 0 THEN NULLIF(trim(vg.photo_url[1]), '')
          ELSE NULL
        END::text AS avatar_url,
        'videographer'::text AS role_type
      FROM public.videographers vg
      WHERE vg.user_id IS NOT NULL
    ),

    s_organisers_legacy AS (
      SELECT
        o.user_id::uuid AS canonical_key,
        o.user_id::uuid AS user_id,
        NULLIF(trim(COALESCE(o.first_name, o.name, '')), '') AS role_name,
        CASE
          WHEN array_length(o.photo_url, 1) > 0 THEN NULLIF(trim(o.photo_url[1]), '')
          ELSE NULL
        END::text AS avatar_url,
        'organiser'::text AS role_type
      FROM public.organisers_legacy o
      WHERE o.user_id IS NOT NULL
    ),

    candidates AS (
      SELECT
        m.canonical_key,
        m.user_id,
        m.mp_full_name,
        NULL::text AS p_full_name,
        NULL::text AS p_username,
        NULL::text AS p_email,
        NULL::text AS role_name,
        m.avatar_url,
        m.role_type
      FROM s_member_profiles m

      UNION ALL

      SELECT
        p.canonical_key,
        p.user_id,
        NULL::text,
        p.p_full_name,
        p.p_username,
        p.p_email,
        NULL::text,
        p.avatar_url,
        p.role_type
      FROM s_profiles p

      UNION ALL

      SELECT d.canonical_key, d.user_id, NULL::text, NULL::text, NULL::text, NULL::text, d.role_name, d.avatar_url, d.role_type
      FROM s_dancers d

      UNION ALL

      SELECT t.canonical_key, t.user_id, NULL::text, NULL::text, NULL::text, NULL::text, t.role_name, t.avatar_url, t.role_type
      FROM s_teacher_profiles t

      UNION ALL

      SELECT dj.canonical_key, dj.user_id, NULL::text, NULL::text, NULL::text, NULL::text, dj.role_name, dj.avatar_url, dj.role_type
      FROM s_dj_profiles dj

      UNION ALL

      SELECT v.canonical_key, v.user_id, NULL::text, NULL::text, NULL::text, NULL::text, v.role_name, v.avatar_url, v.role_type
      FROM s_vendors v

      UNION ALL

      SELECT vg.canonical_key, vg.user_id, NULL::text, NULL::text, NULL::text, NULL::text, vg.role_name, vg.avatar_url, vg.role_type
      FROM s_videographers vg

      UNION ALL

      SELECT o.canonical_key, o.user_id, NULL::text, NULL::text, NULL::text, NULL::text, o.role_name, o.avatar_url, o.role_type
      FROM s_organisers_legacy o
    ),

    ranked AS (
      SELECT
        c.canonical_key,
        c.user_id,
        CASE
          WHEN COALESCE(c.mp_full_name, '') <> '' THEN c.mp_full_name
          WHEN COALESCE(c.p_full_name, '') <> '' THEN c.p_full_name
          WHEN COALESCE(c.p_username, '') <> '' THEN c.p_username
          WHEN COALESCE(c.p_email, '') <> '' THEN split_part(c.p_email, '@', 1)
          WHEN COALESCE(c.role_name, '') <> '' THEN c.role_name
          ELSE NULL
        END AS display_name,
        c.avatar_url,
        c.role_type,
        ROW_NUMBER() OVER (
          PARTITION BY c.canonical_key
          ORDER BY
            CASE
              WHEN c.role_type = 'member' THEN 1
              WHEN c.role_type = 'profile' THEN 2
              WHEN c.role_type = 'dancer' THEN 3
              WHEN c.role_type = 'teacher' THEN 4
              WHEN c.role_type = 'dj' THEN 5
              WHEN c.role_type = 'vendor' THEN 6
              WHEN c.role_type = 'videographer' THEN 7
              WHEN c.role_type = 'organiser' THEN 8
              ELSE 9
            END
        ) AS rn
      FROM candidates c
      WHERE c.canonical_key IS NOT NULL
    ),

    representative AS (
      SELECT
        r.canonical_key AS person_key,
        r.user_id,
        r.display_name,
        r.avatar_url
      FROM ranked r
      WHERE r.rn = 1
    ),

    roles_agg AS (
      SELECT
        c.canonical_key,
        ARRAY_AGG(DISTINCT c.role_type ORDER BY c.role_type) AS role_types
      FROM candidates c
      WHERE c.canonical_key IS NOT NULL
      GROUP BY c.canonical_key
    )

  SELECT
    rep.person_key,
    rep.user_id,
    rep.display_name,
    rep.avatar_url,
    COALESCE(ra.role_types, ARRAY[]::text[]) AS role_types
  FROM representative rep
  LEFT JOIN roles_agg ra
    ON ra.canonical_key = rep.person_key
  WHERE
    p_query IS NULL
    OR COALESCE(rep.display_name, '') ILIKE ('%' || p_query || '%')
  ORDER BY rep.display_name NULLS LAST
  LIMIT p_limit OFFSET p_offset;

END;
$$;


ALTER FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_settings_audit_insert"("p_action" "text", "p_target_user_id" "uuid", "p_reason" "text", "p_before_data" "jsonb", "p_after_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.admin_settings_audit (
    action,
    target_user_id,
    actor_id,
    reason,
    before_data,
    after_data
  ) VALUES (
    p_action,
    p_target_user_id,
    auth.uid(),
    p_reason,
    p_before_data,
    p_after_data
  );
END;
$$;


ALTER FUNCTION "public"."admin_settings_audit_insert"("p_action" "text", "p_target_user_id" "uuid", "p_reason" "text", "p_before_data" "jsonb", "p_after_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_sync_event_links_to_event_row"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Pre-cutover safety: do not mirror canonical links back into deprecated events.*_ids arrays.
  -- We keep a minimal no-op that returns a success flag for backward compatibility.
  RETURN jsonb_build_object('synced', false, 'event_id', p_event_id, 'note', 'legacy arrays mirroring disabled');
END;
$$;


ALTER FUNCTION "public"."admin_sync_event_links_to_event_row"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_my_notes"("p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object('notes', m.notes)
  INTO v_before
  FROM public.admin_link_managers m
  WHERE m.user_id = v_uid;

  UPDATE public.admin_link_managers
  SET notes = NULLIF(trim(p_notes), '')
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.admin_link_managers (user_id, role, is_active, notes)
    VALUES (v_uid, 'manager', true, NULLIF(trim(p_notes), ''));
  END IF;

  SELECT jsonb_build_object('notes', m.notes)
  INTO v_after
  FROM public.admin_link_managers m
  WHERE m.user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'before', v_before, 'after', v_after);
END;
$$;


ALTER FUNCTION "public"."admin_update_my_notes"("p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_sensitive_settings"("p_target_user_id" "uuid", "p_new_role" "text" DEFAULT NULL::"text", "p_new_is_active" boolean DEFAULT NULL::boolean, "p_new_city_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_reason" "text" DEFAULT NULL::"text", "p_reauth_window_minutes" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_now_role text;
  v_now_active boolean;
  v_effective_reason text := trim(COALESCE(p_reason, ''));
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF length(v_effective_reason) < 20 THEN
    RAISE EXCEPTION 'SENSITIVE_REASON_MIN_20_CHARS' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.auth_reauth_within_minutes(COALESCE(p_reauth_window_minutes, 10)) THEN
    RAISE EXCEPTION 'REAUTH_REQUIRED' USING ERRCODE = '42501', HINT = 'Please re-authenticate and try again.';
  END IF;

  SELECT m.role, m.is_active
  INTO v_now_role, v_now_active
  FROM public.admin_link_managers m
  WHERE m.user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_ADMIN_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_before := jsonb_build_object(
    'role', v_now_role,
    'is_active', v_now_active,
    'city_ids', COALESCE((
      SELECT jsonb_agg(s.city_id ORDER BY s.city_id)
      FROM public.admin_manager_city_scopes s
      WHERE s.user_id = p_target_user_id
    ), '[]'::jsonb)
  );

  -- Role / active update
  UPDATE public.admin_link_managers m
  SET role = COALESCE(p_new_role, m.role),
      is_active = COALESCE(p_new_is_active, m.is_active),
      updated_at = now(),
      notes = m.notes
  WHERE m.user_id = p_target_user_id;

  -- Optional full replacement for city scope
  IF p_new_city_ids IS NOT NULL THEN
    DELETE FROM public.admin_manager_city_scopes s
    WHERE s.user_id = p_target_user_id
      AND NOT (s.city_id = ANY(p_new_city_ids));

    INSERT INTO public.admin_manager_city_scopes (user_id, city_id, created_by)
    SELECT p_target_user_id, x.city_id, v_actor
    FROM unnest(p_new_city_ids) AS x(city_id)
    ON CONFLICT (user_id, city_id) DO NOTHING;
  END IF;

  -- enforce manager scope rule (deferred trigger also covers this)
  PERFORM public.enforce_manager_city_scope_for_user(p_target_user_id);

  v_after := jsonb_build_object(
    'role', (SELECT role FROM public.admin_link_managers WHERE user_id = p_target_user_id),
    'is_active', (SELECT is_active FROM public.admin_link_managers WHERE user_id = p_target_user_id),
    'city_ids', COALESCE((
      SELECT jsonb_agg(s.city_id ORDER BY s.city_id)
      FROM public.admin_manager_city_scopes s
      WHERE s.user_id = p_target_user_id
    ), '[]'::jsonb)
  );

  -- required audit actions
  IF (v_before ->> 'is_active') IS DISTINCT FROM (v_after ->> 'is_active') THEN
    PERFORM public.admin_settings_audit_insert(
      'is_active_change',
      p_target_user_id,
      v_effective_reason,
      jsonb_build_object('is_active', v_before -> 'is_active'),
      jsonb_build_object('is_active', v_after -> 'is_active')
    );
  END IF;

  IF (v_before ->> 'role') IS DISTINCT FROM (v_after ->> 'role') THEN
    PERFORM public.admin_settings_audit_insert(
      'role_changed_by_super_admin',
      p_target_user_id,
      v_effective_reason,
      jsonb_build_object('role', v_before -> 'role'),
      jsonb_build_object('role', v_after -> 'role')
    );
  END IF;

  -- city add/remove events
  PERFORM public.admin_settings_audit_insert(
    'city_scope_diff',
    p_target_user_id,
    v_effective_reason,
    jsonb_build_object('city_ids', v_before -> 'city_ids'),
    jsonb_build_object('city_ids', v_after -> 'city_ids')
  );

  RETURN jsonb_build_object('ok', true, 'before', v_before, 'after', v_after);
END;
$$;


ALTER FUNCTION "public"."admin_update_sensitive_settings"("p_target_user_id" "uuid", "p_new_role" "text", "p_new_is_active" boolean, "p_new_city_ids" "uuid"[], "p_reason" "text", "p_reauth_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_dancer_facet_v1"("p_user_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "dance_role" "text", "dance_started_year" integer, "nationality" "text", "gallery_urls" "text"[], "achievements" "text"[], "favorite_styles" "text"[], "favorite_songs" "text"[], "partner_search_role" "text", "partner_search_level" "text"[], "partner_practice_goals" "text"[], "partner_details" "text", "looking_for_partner" boolean, "instagram" "text", "facebook" "text", "whatsapp" "text", "website" "text", "is_active" boolean, "profile_source" "text", "meta_data" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dancer_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'dancer_not_found';
  END IF;

  UPDATE public.dancer_profiles dp SET
    first_name             = CASE WHEN p_payload ? 'first_name'             THEN NULLIF(btrim(p_payload->>'first_name'), '')             ELSE dp.first_name             END,
    surname                = CASE WHEN p_payload ? 'surname'                THEN NULLIF(btrim(p_payload->>'surname'), '')                ELSE dp.surname                END,
    avatar_url             = CASE WHEN p_payload ? 'avatar_url'             THEN NULLIF(btrim(p_payload->>'avatar_url'), '')             ELSE dp.avatar_url             END,
    based_city_id          = CASE WHEN p_payload ? 'based_city_id'          THEN NULLIF(p_payload->>'based_city_id', '')::uuid           ELSE dp.based_city_id          END,
    dance_role             = CASE WHEN p_payload ? 'dance_role'             THEN NULLIF(btrim(p_payload->>'dance_role'), '')             ELSE dp.dance_role             END,
    dance_started_year     = CASE WHEN p_payload ? 'dance_started_year'     THEN (p_payload->>'dance_started_year')::integer            ELSE dp.dance_started_year     END,
    nationality            = CASE WHEN p_payload ? 'nationality'            THEN NULLIF(btrim(p_payload->>'nationality'), '')            ELSE dp.nationality            END,
    gallery_urls           = CASE WHEN p_payload ? 'gallery_urls'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls',           '[]'::jsonb))) ELSE dp.gallery_urls           END,
    achievements           = CASE WHEN p_payload ? 'achievements'           THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'achievements',           '[]'::jsonb))) ELSE dp.achievements           END,
    favorite_styles        = CASE WHEN p_payload ? 'favorite_styles'        THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_styles',        '[]'::jsonb))) ELSE dp.favorite_styles        END,
    favorite_songs         = CASE WHEN p_payload ? 'favorite_songs'         THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'favorite_songs',         '[]'::jsonb))) ELSE dp.favorite_songs         END,
    partner_search_role    = CASE WHEN p_payload ? 'partner_search_role'    THEN NULLIF(btrim(p_payload->>'partner_search_role'), '')    ELSE dp.partner_search_role    END,
    partner_search_level   = CASE WHEN p_payload ? 'partner_search_level'   THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_search_level',   '[]'::jsonb))) ELSE dp.partner_search_level   END,
    partner_practice_goals = CASE WHEN p_payload ? 'partner_practice_goals' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'partner_practice_goals', '[]'::jsonb))) ELSE dp.partner_practice_goals END,
    partner_details        = CASE WHEN p_payload ? 'partner_details'        THEN NULLIF(btrim(p_payload->>'partner_details'), '')        ELSE dp.partner_details        END,
    looking_for_partner    = CASE WHEN p_payload ? 'looking_for_partner'    THEN (p_payload->>'looking_for_partner')::boolean          ELSE dp.looking_for_partner    END,
    instagram              = CASE WHEN p_payload ? 'instagram'              THEN NULLIF(btrim(p_payload->>'instagram'), '')              ELSE dp.instagram              END,
    facebook               = CASE WHEN p_payload ? 'facebook'               THEN NULLIF(btrim(p_payload->>'facebook'), '')               ELSE dp.facebook               END,
    whatsapp               = CASE WHEN p_payload ? 'whatsapp'               THEN NULLIF(btrim(p_payload->>'whatsapp'), '')               ELSE dp.whatsapp               END,
    website                = CASE WHEN p_payload ? 'website'                THEN NULLIF(btrim(p_payload->>'website'), '')                ELSE dp.website                END,
    is_active              = CASE WHEN p_payload ? 'is_active'              THEN (p_payload->>'is_active')::boolean                    ELSE dp.is_active              END,
    profile_source         = CASE WHEN p_payload ? 'profile_source'         THEN NULLIF(btrim(p_payload->>'profile_source'), '')        ELSE dp.profile_source         END,
    meta_data              = CASE WHEN p_payload ? 'meta_data'              THEN COALESCE(dp.meta_data, '{}'::jsonb) || (p_payload->'meta_data') ELSE dp.meta_data    END,
    updated_at             = now()
  WHERE dp.id = p_user_id;

  RETURN QUERY
    SELECT
      dp.id, dp.first_name, dp.surname, dp.avatar_url,
      dp.based_city_id, c.name AS city,
      dp.dance_role, dp.dance_started_year, dp.nationality,
      dp.gallery_urls, dp.achievements, dp.favorite_styles, dp.favorite_songs,
      dp.partner_search_role, dp.partner_search_level, dp.partner_practice_goals,
      dp.partner_details, dp.looking_for_partner,
      dp.instagram, dp.facebook, dp.whatsapp, dp.website,
      dp.is_active, dp.profile_source, dp.meta_data,
      dp.created_at, dp.updated_at
    FROM public.dancer_profiles dp
    LEFT JOIN public.cities c ON c.id = dp.based_city_id
    WHERE dp.id = p_user_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_upsert_dancer_facet_v1"("p_user_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_organiser"("p_id" "uuid" DEFAULT NULL::"uuid", "p_name" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_claimed_by" "uuid" DEFAULT NULL::"uuid", "p_website" "text" DEFAULT NULL::"text", "p_instagram" "text" DEFAULT NULL::"text", "p_socials" "jsonb" DEFAULT '{}'::"jsonb", "p_organisation_category" "text" DEFAULT NULL::"text", "p_contact_phone" "text" DEFAULT NULL::"text", "p_team_members" "jsonb" DEFAULT '[]'::"jsonb", "p_is_active" boolean DEFAULT NULL::boolean, "p_profile_source" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_entity_id   uuid;
  v_is_create   boolean;
  v_name        text;
  v_team        jsonb;
  v_member      jsonb;
  v_member_id   uuid;
BEGIN
  -- Admin guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- Validate name
  v_name := NULLIF(btrim(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'organiser_name_required';
  END IF;

  -- Validate city
  IF p_city_id IS NULL THEN
    RAISE EXCEPTION 'city_required';
  END IF;

  v_is_create := (p_id IS NULL);

  IF v_is_create THEN
    -- ── CREATE ──
    INSERT INTO public.entities (
      id, type, name, avatar_url, city_id,
      organisation_category, contact_phone, website, instagram, socials, claimed_by,
      is_active, profile_source, created_by, updated_at
    ) VALUES (
      gen_random_uuid(),
      'organiser',
      v_name,
      NULLIF(btrim(COALESCE(p_avatar_url, '')), ''),
      p_city_id,
      NULLIF(btrim(COALESCE(p_organisation_category, '')), ''),
      NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
      NULLIF(btrim(COALESCE(p_website, '')), ''),
      NULLIF(btrim(COALESCE(p_instagram, '')), ''),
      COALESCE(p_socials, '{}'::jsonb),
      p_claimed_by,
      -- is_active: caller may supply explicit value; default NULL (auto/pending)
      p_is_active,
      -- profile_source: caller may supply label; default 'admin_create'
      COALESCE(NULLIF(btrim(COALESCE(p_profile_source, '')), ''), 'admin_create'),
      -- created_by: the admin who created it
      auth.uid(),
      now()
    )
    RETURNING id INTO v_entity_id;

  ELSE
    -- ── UPDATE ──
    SELECT e.id INTO v_entity_id
    FROM public.entities e
    WHERE e.id = p_id AND e.type = 'organiser';

    IF v_entity_id IS NULL THEN
      RAISE EXCEPTION 'organiser_not_found';
    END IF;

    UPDATE public.entities SET
      name                  = v_name,
      avatar_url            = NULLIF(btrim(COALESCE(p_avatar_url, '')), ''),
      city_id               = p_city_id,
      organisation_category = NULLIF(btrim(COALESCE(p_organisation_category, '')), ''),
      contact_phone         = NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
      website               = NULLIF(btrim(COALESCE(p_website, '')), ''),
      instagram             = NULLIF(btrim(COALESCE(p_instagram, '')), ''),
      socials               = COALESCE(p_socials, '{}'::jsonb),
      claimed_by            = COALESCE(p_claimed_by, claimed_by),
      -- is_active: preserve existing value unless caller explicitly supplies a new one
      is_active             = CASE WHEN p_is_active IS NOT NULL THEN p_is_active ELSE is_active END,
      -- profile_source: preserve existing value unless caller explicitly overrides
      profile_source        = CASE WHEN p_profile_source IS NOT NULL THEN NULLIF(btrim(p_profile_source), '') ELSE profile_source END,
      -- updated_at: always bump on every write
      updated_at            = now()
    WHERE id = v_entity_id;
  END IF;

  -- ── Sync team members ──
  v_team := COALESCE(p_team_members, '[]'::jsonb);

  IF jsonb_typeof(v_team) = 'array' THEN
    -- Soft-deactivate existing members not in the new list
    UPDATE public.organiser_team_members
    SET is_active = false
    WHERE organiser_entity_id = v_entity_id;

    FOR v_member IN SELECT * FROM jsonb_array_elements(v_team)
    LOOP
      v_member_id := (v_member ->> 'member_profile_id')::uuid;

      IF v_member_id IS NOT NULL THEN
        INSERT INTO public.organiser_team_members (
          organiser_entity_id,
          member_profile_id,
          role,
          is_active,
          is_leader
        ) VALUES (
          v_entity_id,
          v_member_id,
          COALESCE(NULLIF(btrim(v_member ->> 'role'), ''), 'Member'),
          COALESCE((v_member ->> 'is_active')::boolean, true),
          COALESCE((v_member ->> 'is_leader')::boolean, false)
        )
        ON CONFLICT (organiser_entity_id, member_profile_id)
        DO UPDATE SET
          role       = EXCLUDED.role,
          is_active  = EXCLUDED.is_active,
          is_leader  = EXCLUDED.is_leader,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  -- ── Validate leadership invariant ──
  IF NOT EXISTS (
    SELECT 1 FROM public.organiser_team_members
    WHERE organiser_entity_id = v_entity_id
      AND role = 'Leader'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'organiser_requires_leader';
  END IF;

  RETURN jsonb_build_object(
    'organiser_entity_id', v_entity_id,
    'id',                  v_entity_id,
    'entity_id',           v_entity_id,
    'is_create',           v_is_create
  );
END;
$$;


ALTER FUNCTION "public"."admin_upsert_organiser"("p_id" "uuid", "p_name" "text", "p_avatar_url" "text", "p_city_id" "uuid", "p_claimed_by" "uuid", "p_website" "text", "p_instagram" "text", "p_socials" "jsonb", "p_organisation_category" "text", "p_contact_phone" "text", "p_team_members" "jsonb", "p_is_active" boolean, "p_profile_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_venue_facet_v1"("p_entity_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("entity_id" "uuid", "id" "uuid", "user_id" "uuid", "name" "text", "photo_url" "text"[], "gallery_urls" "text"[], "video_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "postcode" "text", "google_maps_link" "text", "capacity" integer, "floor_type" "text", "facilities_new" "text"[], "parking_json" "jsonb", "transport_json" "jsonb", "opening_hours" "jsonb", "bar_available" boolean, "cloakroom_available" boolean, "id_required" boolean, "last_entry_time" "text", "venue_rating" numeric, "admin_notes" "text", "description" "text", "faq_json" "jsonb", "meta_data" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.venues
    WHERE venues.id = p_entity_id OR venues.entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'venue_not_found';
  END IF;

  UPDATE public.venues v SET
    name             = CASE WHEN p_payload ? 'name'             THEN NULLIF(btrim(p_payload->>'name'), '')             ELSE v.name             END,
    country          = CASE WHEN p_payload ? 'country'          THEN NULLIF(btrim(p_payload->>'country'), '')          ELSE v.country          END,
    address          = CASE WHEN p_payload ? 'address'          THEN NULLIF(btrim(p_payload->>'address'), '')          ELSE v.address          END,
    postcode         = CASE WHEN p_payload ? 'postcode'         THEN NULLIF(btrim(p_payload->>'postcode'), '')         ELSE v.postcode         END,
    google_maps_link = CASE WHEN p_payload ? 'google_maps_link' THEN NULLIF(btrim(p_payload->>'google_maps_link'), '') ELSE v.google_maps_link END,
    description      = CASE WHEN p_payload ? 'description'      THEN NULLIF(btrim(p_payload->>'description'), '')      ELSE v.description      END,
    capacity         = CASE WHEN p_payload ? 'capacity'         THEN (p_payload->>'capacity')::integer                ELSE v.capacity         END,
    floor_type       = CASE WHEN p_payload ? 'floor_type'       THEN NULLIF(btrim(p_payload->>'floor_type'), '')       ELSE v.floor_type       END,
    opening_hours    = CASE WHEN p_payload ? 'opening_hours'    THEN p_payload->'opening_hours'                       ELSE v.opening_hours    END,
    facilities_new   = CASE WHEN p_payload ? 'facilities_new'   THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'facilities_new', '[]'::jsonb))) ELSE v.facilities_new  END,
    transport_json   = CASE WHEN p_payload ? 'transport_json'   THEN COALESCE(p_payload->'transport_json', '{}'::jsonb) ELSE v.transport_json  END,
    parking_json     = CASE WHEN p_payload ? 'parking_json'     THEN COALESCE(p_payload->'parking_json', '{}'::jsonb)   ELSE v.parking_json    END,
    id_required      = CASE WHEN p_payload ? 'id_required'      THEN (p_payload->>'id_required')::boolean              ELSE v.id_required      END,
    bar_available    = CASE WHEN p_payload ? 'bar_available'    THEN (p_payload->>'bar_available')::boolean            ELSE v.bar_available    END,
    cloakroom_available = CASE WHEN p_payload ? 'cloakroom_available' THEN (p_payload->>'cloakroom_available')::boolean ELSE v.cloakroom_available END,
    venue_rating     = CASE WHEN p_payload ? 'venue_rating'     THEN (p_payload->>'venue_rating')::numeric             ELSE v.venue_rating     END,
    photo_url        = CASE WHEN p_payload ? 'photo_url'        THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photo_url',    '[]'::jsonb))) ELSE v.photo_url     END,
    gallery_urls     = CASE WHEN p_payload ? 'gallery_urls'     THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'gallery_urls', '[]'::jsonb))) ELSE v.gallery_urls  END,
    video_urls       = CASE WHEN p_payload ? 'video_urls'       THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'video_urls',   '[]'::jsonb))) ELSE v.video_urls    END,
    admin_notes      = CASE WHEN p_payload ? 'admin_notes'      THEN NULLIF(btrim(p_payload->>'admin_notes'), '')      ELSE v.admin_notes      END,
    faq_json         = CASE WHEN p_payload ? 'faq_json'         THEN COALESCE(p_payload->'faq_json', '{}'::jsonb)      ELSE v.faq_json         END,
    meta_data        = CASE WHEN p_payload ? 'meta_data'        THEN COALESCE(v.meta_data, '{}'::jsonb) || (p_payload->'meta_data') ELSE v.meta_data END
  WHERE v.id = p_entity_id OR v.entity_id = p_entity_id;

  RETURN QUERY
    SELECT
      COALESCE(v.entity_id, v.id)::uuid             AS entity_id,
      v.id::uuid,
      v.user_id::uuid,
      v.name::text,
      v.photo_url::text[],
      v.gallery_urls::text[],
      v.video_urls::text[],
      e.city_id::uuid,
      e.city::text,
      v.country::text,
      v.address::text,
      v.postcode::text,
      v.google_maps_link::text,
      v.capacity::integer,
      v.floor_type::text,
      v.facilities_new::text[],
      v.parking_json::jsonb,
      v.transport_json::jsonb,
      v.opening_hours::jsonb,
      v.bar_available::boolean,
      v.cloakroom_available::boolean,
      v.id_required::boolean,
      v.last_entry_time::text,
      v.venue_rating::numeric,
      v.admin_notes::text,
      v.description::text,
      v.faq_json::jsonb,
      v.meta_data::jsonb,
      v.created_at::timestamptz              -- explicit: timestamp w/o tz → timestamptz
    FROM public.venues v
    LEFT JOIN public.entities e ON e.id = v.entity_id
    WHERE v.id = p_entity_id OR v.entity_id = p_entity_id
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."admin_upsert_venue_facet_v1"("p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_city_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_req public.city_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO v_req
  FROM public.city_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_request_not_found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'city_request_not_pending: current status is %', v_req.status;
  END IF;

  -- Derive slug from requested_slug or name if not provided.
  INSERT INTO public.cities (name, slug, country_code, timezone, is_active)
  VALUES (
    v_req.requested_name,
    COALESCE(
      NULLIF(trim(v_req.requested_slug), ''),
      lower(regexp_replace(trim(v_req.requested_name), '\s+', '-', 'g'))
    ),
    'XX',   -- placeholder — admin should update after approval
    'UTC',  -- placeholder — admin should update after approval
    false   -- starts in pending-review state
  )
  ON CONFLICT (slug) DO NOTHING;

  UPDATE public.city_requests
  SET status = 'approved'
  WHERE id = p_request_id;
END;
$$;


ALTER FUNCTION "public"."approve_city_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_is_event_organiser"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_entities ee
    JOIN public.entities ent ON ent.id = ee.entity_id AND ent.type = 'organiser'
    LEFT JOIN public.organiser_team_members otm
      ON otm.organiser_entity_id = ee.entity_id AND COALESCE(otm.is_active, true)
    LEFT JOIN LATERAL public._member_profile_user_id(otm.member_profile_id) AS team_user(user_id) ON TRUE
    WHERE ee.event_id = p_event_id
      AND ee.role = 'organiser'
      AND (
        ent.claimed_by = auth.uid()
        OR team_user.user_id = auth.uid()
      )
  );
$$;


ALTER FUNCTION "public"."auth_is_event_organiser"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_reauth_within_minutes"("p_minutes" integer DEFAULT 10) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_claim text;
  v_epoch bigint;
  v_ts timestamptz;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN true;
  END IF;

  -- Prefer auth_time if present; fallback to iat.
  v_claim := NULLIF(auth.jwt() ->> 'auth_time', '');
  IF v_claim IS NULL THEN
    v_claim := NULLIF(auth.jwt() ->> 'iat', '');
  END IF;

  IF v_claim IS NULL THEN
    RETURN false;
  END IF;

  v_epoch := v_claim::bigint;
  v_ts := to_timestamp(v_epoch);

  RETURN (now() - v_ts) <= make_interval(mins => GREATEST(p_minutes, 1));
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."auth_reauth_within_minutes"("p_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_organisers_view_writes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'public.organisers is read-only compatibility surface; use canonical organiser admin RPC contract';
END;
$$;


ALTER FUNCTION "public"."block_organisers_view_writes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_member_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  INSERT INTO public.member_profiles (id, created_at, updated_at, first_name, last_name, full_name)
  VALUES (NEW.id, now(), now(), ''::text, NULL::text, NULL::text)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bootstrap_member_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calendar_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_venue_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object(
    'row_id', co.id,
    'event_id', e.id,
    'occurrence_id', co.id,
    'name', e.name,
    'instance_start', co.instance_start,
    'instance_end', co.instance_end,
    'venue_id', COALESCE(co.venue_id, e.venue_id),
    'city_id', COALESCE(co.city_id, e.city_id),
    'city_display', c.name,
    'poster_url', e.poster_url,
    'type', e.type
  )
  FROM public.events e
  JOIN public.calendar_occurrences co ON co.event_id = e.id
  LEFT JOIN public.cities c ON c.id = COALESCE(co.city_id, e.city_id)
  WHERE e.is_active = true
    AND e.lifecycle_status IN ('published','scheduled','approved')
    AND (p_city_id IS NULL OR COALESCE(co.city_id, e.city_id) = p_city_id)
    AND (p_venue_id IS NULL OR COALESCE(co.venue_id, e.venue_id) = p_venue_id)
    AND (co.instance_start, co.instance_end) OVERLAPS (p_from, p_to)
  ORDER BY co.instance_start, e.id;
$$;


ALTER FUNCTION "public"."calendar_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calendar_occurrences_prune"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_keep_from timestamptz := now() - interval '180 days';
  v_keep_to timestamptz := now() + interval '13 months';
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.calendar_occurrences co
  WHERE (co.source <> 'manual' AND co.is_override IS DISTINCT FROM true)
    AND (co.instance_start < v_keep_from OR co.instance_start > v_keep_to);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."calendar_occurrences_prune"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calendar_occurrences_update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calendar_occurrences_update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calendar_occurrences_upsert_protected"("p_event_id" "uuid", "p_instance_start" timestamp with time zone, "p_instance_end" timestamp with time zone, "p_source" "text", "p_is_override" boolean, "p_override_payload" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_lifecycle_status" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_city_slug text;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_city_slug, '')), '') IS NOT NULL
     AND p_city_id IS NULL THEN
    RAISE EXCEPTION 'city_slug_retired_use_city_id' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.phase4_tmp_occurrence_write_city_compat_audit (
    function_name,
    event_id,
    auth_uid,
    jwt_sub,
    jwt_role,
    has_city_slug,
    has_city_id,
    replace_mode,
    occurrence_count
  )
  VALUES (
    'calendar_occurrences_upsert_protected',
    p_event_id,
    auth.uid(),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.role', true),
    NULLIF(BTRIM(COALESCE(p_city_slug, '')), '') IS NOT NULL,
    p_city_id IS NOT NULL,
    NULL,
    1
  );

  IF p_city_id IS NOT NULL THEN
    SELECT c.slug INTO v_city_slug
    FROM public.cities c
    WHERE c.id = p_city_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id
      AND co.instance_start = p_instance_start
      AND (co.source = 'manual' OR co.is_override = true)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.calendar_occurrences (
    event_id, instance_start, instance_end, source, is_override, override_payload,
    city_id, city_slug, lifecycle_status, created_at, updated_at
  ) VALUES (
    p_event_id, p_instance_start, p_instance_end, p_source, p_is_override, p_override_payload,
    p_city_id, v_city_slug, p_lifecycle_status, now(), now()
  )
  ON CONFLICT (event_id, instance_start) DO UPDATE
  SET instance_end = EXCLUDED.instance_end,
      source = EXCLUDED.source,
      is_override = EXCLUDED.is_override,
      override_payload = EXCLUDED.override_payload,
      city_id = EXCLUDED.city_id,
      city_slug = EXCLUDED.city_slug,
      lifecycle_status = EXCLUDED.lifecycle_status,
      updated_at = now();
END;
$$;


ALTER FUNCTION "public"."calendar_occurrences_upsert_protected"("p_event_id" "uuid", "p_instance_start" timestamp with time zone, "p_instance_end" timestamp with time zone, "p_source" "text", "p_is_override" boolean, "p_override_payload" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_lifecycle_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_current_user_manage_event_graph"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = p_event_id
        AND e.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_entities ee
      JOIN public.entities en ON en.id = ee.entity_id
      WHERE ee.event_id = p_event_id
        AND ee.role = 'organiser'
        AND en.type = 'organiser'
        AND public.can_current_user_manage_profile('organiser', en.id)
    )
  );
$$;


ALTER FUNCTION "public"."can_current_user_manage_event_graph"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_current_user_manage_profile"("p_profile_type" "text", "p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM public.person_profiles pp
      JOIN public.person_account_links pal
        ON pal.person_id = pp.person_id
      WHERE pp.profile_type = p_profile_type
        AND pp.profile_id = p_profile_id
        AND pal.user_id = auth.uid()
        AND pal.verification_status = 'verified'
    )
    OR (
      p_profile_type IN ('organiser', 'teacher', 'dj')
      AND EXISTS (
        SELECT 1
        FROM public.entities e
        WHERE e.id = p_profile_id
          AND e.type = p_profile_type
          AND e.claimed_by = auth.uid()
      )
    )
  );
$$;


ALTER FUNCTION "public"."can_current_user_manage_profile"("p_profile_type" "text", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_connectivity"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_claim_role text;
  v_claim_app_role text;
BEGIN
  -- Allow trusted DB execution roles (e.g. SQL editor / migration runner)
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN true;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  v_claim_role := COALESCE(auth.jwt() ->> 'role', '');
  v_claim_app_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');

  IF lower(v_claim_role) IN ('admin', 'manager')
     OR lower(v_claim_app_role) IN ('admin', 'manager') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_link_managers m
    WHERE m.user_id = v_uid
      AND m.is_active = true
  );
END;
$$;


ALTER FUNCTION "public"."can_manage_connectivity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  WITH base AS (
    SELECT e.id AS event_id, e.organiser_id AS owner_user_id
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  is_admin AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.admin_super_users s
      WHERE s.user_id = p_user_id
        AND s.is_active
    ) AS val
  ),
  has_event_permission AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.event_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.event_id = p_event_id
        AND ep.role IN ('editor','publisher','admin')
    ) AS val
  ),
  is_owner AS (
    SELECT EXISTS (
      SELECT 1
      FROM base b
      WHERE b.owner_user_id = p_user_id
    ) AS val
  )
  SELECT
    (SELECT val FROM is_admin)
    OR (SELECT val FROM has_event_permission)
    OR (SELECT val FROM is_owner)
  ;
$$;


ALTER FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_dancer_profile"("p_dancer_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.dancers
  SET user_id = v_user_id
  WHERE id = p_dancer_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;


ALTER FUNCTION "public"."claim_dancer_profile"("p_dancer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_dj_profile"("p_dj_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.dj_profiles
  SET user_id = v_user_id
  WHERE id = p_dj_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;


ALTER FUNCTION "public"."claim_dj_profile"("p_dj_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_organiser_profile"("p_organiser_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.organisers
  SET user_id = v_user_id
  WHERE id = p_organiser_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;


ALTER FUNCTION "public"."claim_organiser_profile"("p_organiser_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_teacher_profile"("p_teacher_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.teacher_profiles
  SET user_id = v_user_id
  WHERE id = p_teacher_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;


ALTER FUNCTION "public"."claim_teacher_profile"("p_teacher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id uuid;
  v_dancer_id uuid;
  v_existing_vendor_id uuid;
  v_claimed_vendor_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id
  INTO v_existing_vendor_id
  FROM public.vendors
  WHERE user_id = v_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_existing_vendor_id IS NOT NULL THEN
    RETURN v_existing_vendor_id;
  END IF;

  SELECT id
  INTO v_dancer_id
  FROM public.dancers
  WHERE user_id = v_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_dancer_id IS NULL THEN
    RAISE EXCEPTION 'No dancer profile linked to current user';
  END IF;

  UPDATE public.vendors v
  SET user_id = v_user_id
  WHERE v.id = p_vendor_id
    AND v.user_id IS NULL
    AND (
      COALESCE(v.meta_data ->> 'business_leader_dancer_id', '') = v_dancer_id::text
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v.team, '[]'::jsonb)) AS member
        WHERE member ->> 'dancer_id' = v_dancer_id::text
      )
    )
  RETURNING v.id INTO v_claimed_vendor_id;

  RETURN v_claimed_vendor_id;
END;
$$;


ALTER FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dancer_completeness"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_first_name text;
  v_based_city_id uuid;
  v_avatar_url text;
  v_partner_role text;
  v_dancing_start_date timestamp with time zone;
  v_missing text[] := ARRAY[]::text[];
  v_complete boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'complete', FALSE,
      'missing_fields', ARRAY['p_user_id']
    );
  END IF;

  SELECT m.first_name, m.based_city_id, m.avatar_url
  INTO v_first_name, v_based_city_id, v_avatar_url
  FROM public.member_profiles m
  WHERE m.id = p_user_id
  LIMIT 1;

  SELECT d.partner_role, d.dancing_start_date
  INTO v_partner_role, v_dancing_start_date
  FROM public.dancers d
  WHERE d.user_id = p_user_id
  LIMIT 1;

  IF v_first_name IS NULL OR length(trim(coalesce(v_first_name, ''))) = 0 THEN
    v_missing := array_append(v_missing, 'member_profiles.first_name');
  END IF;

  IF v_based_city_id IS NULL THEN
    v_missing := array_append(v_missing, 'member_profiles.based_city_id');
  END IF;

  IF v_avatar_url IS NULL OR length(trim(coalesce(v_avatar_url, ''))) = 0 THEN
    v_missing := array_append(v_missing, 'member_profiles.avatar_url');
  END IF;

  IF v_partner_role IS NULL THEN
    v_missing := array_append(v_missing, 'dancers.partner_role');
  END IF;

  IF v_dancing_start_date IS NULL THEN
    v_missing := array_append(v_missing, 'dancers.dancing_start_date');
  END IF;

  v_complete := coalesce(array_length(v_missing, 1), 0) = 0;

  RETURN jsonb_build_object(
    'complete', v_complete,
    'missing_fields', v_missing
  );
END;
$$;


ALTER FUNCTION "public"."dancer_completeness"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dancer_profiles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."dancer_profiles_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS SETOF "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT *
  FROM public.admin_dashboard_events_list_v1(
    NULL,
    NULL,
    NULL,
    NULL,
    p_limit,
    p_offset
  );
$$;


ALTER FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer, "p_offset" integer) IS 'Deprecated wrapper. Delegates to admin_dashboard_events_list_v1.';



CREATE OR REPLACE FUNCTION "public"."delete_venue_admin"("p_entity_id" "uuid", "actor_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_entity_type text;
  v_deleted_venue_count integer := 0;
  v_deleted_entity_count integer := 0;
  v_caller_uid uuid := auth.uid();
  v_caller_role text := auth.role();
  v_venue_id uuid;
  v_event_count bigint := 0;
  v_occurrence_count bigint := 0;
BEGIN
  IF actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'p_entity_id is required';
  END IF;

  IF COALESCE(v_caller_role, '') <> 'service_role' THEN
    IF v_caller_uid IS NULL OR v_caller_uid <> actor_user_id THEN
      RAISE EXCEPTION 'Not authorized: actor_user_id must match authenticated user';
    END IF;
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin role required';
  END IF;

  SELECT e.type
  INTO v_entity_type
  FROM public.entities e
  WHERE e.id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity not found: %', p_entity_id;
  END IF;

  IF v_entity_type <> 'venue' THEN
    RAISE EXCEPTION 'Entity % is not a venue (type=%)', p_entity_id, v_entity_type;
  END IF;

  SELECT v.id
  INTO v_venue_id
  FROM public.venues v
  WHERE v.entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue row not found for entity %', p_entity_id;
  END IF;

  SELECT COUNT(*) INTO v_event_count
  FROM public.events e
  WHERE e.venue_id = v_venue_id;

  SELECT COUNT(*) INTO v_occurrence_count
  FROM public.calendar_occurrences co
  WHERE co.venue_id = v_venue_id;

  IF v_event_count > 0 OR v_occurrence_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'VENUE_DELETE_BLOCKED_DEPENDENCIES',
      DETAIL = jsonb_build_object(
        'code', 'VENUE_DELETE_BLOCKED_DEPENDENCIES',
        'entity_id', p_entity_id,
        'venue_id', v_venue_id,
        'dependencies', jsonb_build_object(
          'events', v_event_count,
          'calendar_occurrences', v_occurrence_count
        )
      )::text,
      HINT = 'Remove or reassign dependent records before deleting venue';
  END IF;

  DELETE FROM public.venues v
  WHERE v.entity_id = p_entity_id;
  GET DIAGNOSTICS v_deleted_venue_count = ROW_COUNT;

  DELETE FROM public.entities e
  WHERE e.id = p_entity_id
    AND e.type = 'venue';
  GET DIAGNOSTICS v_deleted_entity_count = ROW_COUNT;

  IF v_deleted_entity_count <> 1 THEN
    RAISE EXCEPTION 'Delete failed for venue entity %', p_entity_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_entity_id', p_entity_id,
    'deleted_venue_id', v_venue_id,
    'deleted_venue_count', v_deleted_venue_count,
    'message', 'Venue deleted successfully'
  );
END;
$$;


ALTER FUNCTION "public"."delete_venue_admin"("p_entity_id" "uuid", "actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_dancer_profile_on_role_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_row jsonb;
BEGIN
  v_row := to_jsonb(NEW);

  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.ensure_dancer_profile(
      NEW.user_id,
      NULLIF(trim(coalesce(v_row ->> 'public_email', '')), ''),
      NULL,
      NULL,
      NULLIF(trim(coalesce(v_row ->> 'city', '')), '')
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_dancer_profile_on_role_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_manager_city_scope_for_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_active boolean;
  v_has_scope boolean;
BEGIN
  SELECT role, is_active
  INTO v_role, v_active
  FROM public.admin_link_managers
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Rule: active managers must have at least one city scope.
  IF v_role = 'manager' AND v_active = true THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.admin_manager_city_scopes s
      WHERE s.user_id = p_user_id
    ) INTO v_has_scope;

    IF NOT v_has_scope THEN
      RAISE EXCEPTION 'ACTIVE_MANAGER_CITY_SCOPE_REQUIRED'
        USING ERRCODE = 'P0001',
              DETAIL = 'Active managers must have at least one city assignment.';
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."enforce_manager_city_scope_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_event_job"("p_event_id" "uuid", "p_job_type" "text", "p_payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_id uuid := uuid_generate_v4();
BEGIN
  INSERT INTO public.event_jobs(id, event_id, job_type, payload, status, created_at)
  VALUES (v_id, p_event_id, p_job_type, COALESCE(p_payload, '{}'::jsonb), 'pending', now());
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."enqueue_event_job"("p_event_id" "uuid", "p_job_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_dancer_profile"("p_user_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_first_name" "text" DEFAULT NULL::"text", "p_surname" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_existing_id uuid;
  v_name text;
  v_city text;
  v_city_id uuid;
  v_role text;
  v_auth_uid uuid;
  v_email_for_name text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  v_role := auth.role();
  v_auth_uid := auth.uid();

  IF v_role = 'anon' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_auth_uid IS NOT NULL
     AND v_role IS DISTINCT FROM 'service_role'
     AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to ensure dancer profile for this user';
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in auth.users', p_user_id;
  END IF;

  v_city := nullif(trim(coalesce(
    p_city,
    v_user.raw_user_meta_data ->> 'city',
    ''
  )), '');

  -- Attempt to resolve text city to a city_id, otherwise leave NULL
  v_city_id := NULL;
  IF v_city IS NOT NULL THEN
    SELECT id INTO v_city_id FROM public.cities WHERE lower(name) = lower(v_city) LIMIT 1;
    IF v_city_id IS NULL THEN
      -- try slug match
      SELECT id INTO v_city_id FROM public.cities WHERE lower(slug) = lower(regexp_replace(v_city, '\s+', '-', 'g')) LIMIT 1;
    END IF;
  END IF;

  v_email_for_name := nullif(trim(coalesce(v_user.email, '')), '');

  v_name := nullif(trim(coalesce(
    p_first_name,
    v_user.raw_user_meta_data ->> 'first_name',
    split_part(coalesce(v_email_for_name, ''), '@', 1),
    ''
  )), '');

  IF v_name IS NULL THEN
    v_name := 'Member';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.dancers
  WHERE user_id = p_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.dancers
    SET
      first_name = CASE
        WHEN nullif(trim(coalesce(first_name, '')), '') IS NULL THEN v_name
        ELSE first_name
      END,
      city_id = CASE
        WHEN city_id IS NULL THEN v_city_id
        ELSE city_id
      END
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  END IF;

  BEGIN
    INSERT INTO public.dancers (
      user_id,
      first_name,
      surname,
      city_id,
      verified,
      is_public,
      hide_surname
    )
    VALUES (
      p_user_id,
      v_name,
      nullif(trim(coalesce(p_surname, v_user.raw_user_meta_data ->> 'surname', '')), ''),
      v_city_id,
      false,
      false,
      false
    )
    RETURNING id INTO v_existing_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id
      INTO v_existing_id
      FROM public.dancers
      WHERE user_id = p_user_id
      ORDER BY created_at ASC NULLS LAST
      LIMIT 1;
  END;

  RETURN v_existing_id;
END;
$$;


ALTER FUNCTION "public"."ensure_dancer_profile"("p_user_id" "uuid", "p_email" "text", "p_first_name" "text", "p_surname" "text", "p_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_entity_is_venue"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.entities e
  WHERE e.id = NEW.entity_id
    AND e.type = 'venue';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_id must reference entities.type = venue';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_entity_is_venue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_event_city_canonical"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN

  -- CASE A: city_id provided → derive canonical slug
  IF NEW.city_id IS NOT NULL THEN

    SELECT slug INTO v_slug
    FROM public.cities
    WHERE id = NEW.city_id
    LIMIT 1;

    IF NOT FOUND OR v_slug IS NULL THEN
      RAISE EXCEPTION 'Valid city is required (city_slug must match canonical city list)';
    END IF;

    NEW.city_slug := v_slug;

    RETURN NEW;
  END IF;


  -- CASE B: slug provided → resolve id
  IF NEW.city_slug IS NOT NULL THEN

    SELECT id, slug INTO v_id, v_slug
    FROM public.cities
    WHERE slug = NEW.city_slug
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Valid city is required (city_slug must match canonical city list)';
    END IF;

    NEW.city_id := v_id;
    NEW.city_slug := v_slug;

    RETURN NEW;
  END IF;


  -- CASE C: both null
  IF NEW.lifecycle_status = 'draft' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Valid city is required (city_slug must match canonical city list)';

END;
$$;


ALTER FUNCTION "public"."ensure_event_city_canonical"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_profile_link_suggestions_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."event_profile_link_suggestions_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_profile_links_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."event_profile_links_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.updated_at := COALESCE(NEW.updated_at, now());
        RETURN NEW;
    END IF;

    IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        NEW.updated_at := now();
    ELSE
        -- Prevent manual tampering and no-op timestamp churn
        NEW.updated_at := OLD.updated_at;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."events_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_sync_lifecycle_and_active"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If lifecycle was not provided, infer from is_active
    IF NEW.lifecycle_status IS NULL THEN
        NEW.lifecycle_status := CASE WHEN COALESCE(NEW.is_active, false) THEN 'published' ELSE 'draft' END;
    END IF;

    -- lifecycle_status is canonical
    IF NEW.lifecycle_status = 'published' THEN
        NEW.is_active := true;
    ELSE
        NEW.is_active := false;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."events_sync_lifecycle_and_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_city_id_from_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.city_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT based_city_id INTO NEW.city_id
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fill_city_id_from_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_occurrences_for_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE

v_event RECORD;
v_recur jsonb;
v_type text;
v_interval int := 1;

v_weekdays_int int[] := ARRAY[]::int[];

v_day_of_month int;
v_nth int;

v_tz text := 'UTC';

v_base_local_ts timestamp;
v_event_local_date date;

v_event_start_time time := '00:00:00';
v_event_end_time time := NULL;

v_duration interval := '1 hour';

v_window_start timestamptz := now() - interval '30 days';
v_window_end timestamptz := now() + interval '12 months';

v_city_id uuid := NULL;
v_city_slug text := NULL;
BEGIN

SELECT * INTO v_event
FROM public.events
WHERE id = p_event_id;

IF NOT FOUND THEN
  RETURN;
END IF;

v_city_id := v_event.city_id;
IF v_city_id IS NOT NULL THEN
  SELECT slug INTO v_city_slug FROM public.cities WHERE id = v_city_id;
ELSE
  v_city_slug := NULL;
END IF;

IF v_event.recurrence IS NOT NULL THEN
  v_recur := v_event.recurrence;
ELSIF v_event.meta_data IS NOT NULL THEN
  v_recur := v_event.meta_data -> 'recurrence';
END IF;

IF v_recur IS NOT NULL THEN
  IF (v_recur ? 'weekdays') IS FALSE AND (v_recur ? 'weekday') IS TRUE THEN
    v_recur := v_recur || jsonb_build_object('weekdays', jsonb_build_array(v_recur->'weekday'));
  END IF;
END IF;

IF v_event.timezone IS NOT NULL THEN
  v_tz := v_event.timezone;
END IF;

IF v_event.start_time IS NOT NULL THEN

  v_base_local_ts := (v_event.start_time AT TIME ZONE v_tz);
  v_event_local_date := date_trunc('day', v_base_local_ts)::date;
  v_event_start_time := v_base_local_ts::time;

  IF v_event.end_time IS NOT NULL THEN
    v_event_end_time := (v_event.end_time AT TIME ZONE v_tz)::time;
  END IF;

ELSE

  v_event_local_date := v_event.date;

  IF v_event.meta_data IS NOT NULL THEN
    IF (v_event.meta_data ->> 'start_time') IS NOT NULL THEN
      v_event_start_time := (v_event.meta_data ->> 'start_time')::time;
    END IF;

    IF (v_event.meta_data ->> 'end_time') IS NOT NULL THEN
      v_event_end_time := (v_event.meta_data ->> 'end_time')::time;
    END IF;
  END IF;

  v_base_local_ts := (v_event_local_date::timestamp + v_event_start_time);

END IF;

IF v_event_end_time IS NOT NULL THEN
  v_duration := (v_event_end_time - v_event_start_time);
ELSE
  v_duration := interval '1 hour';
END IF;

IF v_recur IS NULL OR (v_recur ->> 'type') IS NULL THEN
  v_type := 'one_off';
ELSE
  v_type := v_recur ->> 'type';
END IF;

IF v_recur IS NOT NULL THEN
  IF (v_recur ->> 'interval') IS NOT NULL THEN
    v_interval := GREATEST(1,(v_recur ->> 'interval')::int);
  END IF;
END IF;

IF v_recur IS NOT NULL AND (v_recur -> 'weekdays') IS NOT NULL THEN
SELECT array_agg(
CASE upper(value)
WHEN 'SU' THEN 0
WHEN 'MO' THEN 1
WHEN 'TU' THEN 2
WHEN 'WE' THEN 3
WHEN 'TH' THEN 4
WHEN 'FR' THEN 5
WHEN 'SA' THEN 6
END
)
INTO v_weekdays_int
FROM jsonb_array_elements_text(v_recur -> 'weekdays');
END IF;

IF v_recur IS NOT NULL AND (v_recur ->> 'day_of_month') IS NOT NULL THEN
v_day_of_month := (v_recur ->> 'day_of_month')::int;
END IF;

IF v_recur IS NOT NULL AND (v_recur ->> 'nth') IS NOT NULL THEN
v_nth := (v_recur ->> 'nth')::int;
END IF;

DELETE FROM public.calendar_occurrences
WHERE event_id = p_event_id
AND source = 'auto'
AND instance_start >= v_window_start
AND instance_start <= v_window_end;

PERFORM 1;

IF v_type = 'one_off' THEN
INSERT INTO public.calendar_occurrences
(id,event_id,instance_start,instance_end,source,is_override,city_id,city_slug,created_at,updated_at)
VALUES
(
  gen_random_uuid(),
  p_event_id,
  (v_base_local_ts AT TIME ZONE v_tz),
  (v_base_local_ts AT TIME ZONE v_tz) + v_duration,
  'auto',
  false,
  v_city_id,
  v_city_slug,
  now(),
  now()
)
ON CONFLICT ON CONSTRAINT uq_calendar_occurrences_event_start_auto
DO UPDATE SET
  instance_end = EXCLUDED.instance_end,
  city_id = EXCLUDED.city_id,
  city_slug = EXCLUDED.city_slug,
  updated_at = now();
RETURN;
END IF;

IF v_type = 'weekly' THEN
IF array_length(v_weekdays_int,1) IS NULL THEN
v_weekdays_int := ARRAY[extract(dow from v_event_local_date)::int];
END IF;

INSERT INTO public.calendar_occurrences
(id,event_id,instance_start,instance_end,source,is_override,city_id,city_slug,created_at,updated_at)
SELECT
  gen_random_uuid(),
  p_event_id,
  (((d::date)::timestamp + v_event_start_time) AT TIME ZONE v_tz),
  (((d::date)::timestamp + v_event_start_time) AT TIME ZONE v_tz) + v_duration,
  'auto',
  false,
  v_city_id,
  v_city_slug,
  now(),
  now()
FROM generate_series(
  (v_window_start AT TIME ZONE v_tz)::date,
  (v_window_end AT TIME ZONE v_tz)::date,
  interval '1 day'
) d
WHERE extract(dow FROM d)::int = ANY(v_weekdays_int)
AND (((d::timestamp + v_event_start_time) AT TIME ZONE v_tz)
     BETWEEN GREATEST((v_base_local_ts AT TIME ZONE v_tz),v_window_start)
     AND v_window_end)
AND (
  ((date_trunc('week',d)::date - date_trunc('week',v_event_local_date)::date)/7)::int
  % v_interval = 0
)
ON CONFLICT ON CONSTRAINT uq_calendar_occurrences_event_start_auto
DO UPDATE SET
  instance_end = EXCLUDED.instance_end,
  city_id = EXCLUDED.city_id,
  city_slug = EXCLUDED.city_slug,
  updated_at = now();
RETURN;
END IF;

IF v_type = 'monthly_by_day_of_month' THEN
INSERT INTO public.calendar_occurrences
(id,event_id,instance_start,instance_end,source,is_override,city_id,city_slug,created_at,updated_at)
SELECT
  gen_random_uuid(),
  p_event_id,
  ((((month_start::date + (v_day_of_month - 1))::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz),
  ((((month_start::date + (v_day_of_month - 1))::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz) + v_duration,
  'auto',
  false,
  v_city_id,
  v_city_slug,
  now(),
  now()
FROM generate_series(
  date_trunc('month',(v_window_start AT TIME ZONE v_tz)::date)::date,
  date_trunc('month',(v_window_end AT TIME ZONE v_tz)::date)::date,
  interval '1 month'
) month_start
WHERE date_trunc('month',((month_start::date + (v_day_of_month - 1))::date)) = month_start::date
AND ((((month_start::date + (v_day_of_month - 1))::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz)
    BETWEEN GREATEST((v_base_local_ts AT TIME ZONE v_tz),v_window_start)
    AND v_window_end
ON CONFLICT ON CONSTRAINT uq_calendar_occurrences_event_start_auto
DO UPDATE SET
  instance_end = EXCLUDED.instance_end,
  city_id = EXCLUDED.city_id,
  city_slug = EXCLUDED.city_slug,
  updated_at = now();
RETURN;
END IF;

IF v_type = 'monthly_by_nth_weekday' THEN
IF array_length(v_weekdays_int,1) IS NULL THEN
v_weekdays_int := ARRAY[extract(dow from v_event_local_date)::int];
END IF;

INSERT INTO public.calendar_occurrences
(id,event_id,instance_start,instance_end,source,is_override,city_id,city_slug,created_at,updated_at)
SELECT
  gen_random_uuid(),
  p_event_id,
  ((((month_start::date + off.offset_days)::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz),
  ((((month_start::date + off.offset_days)::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz) + v_duration,
  'auto',
  false,
  v_city_id,
  v_city_slug,
  now(),
  now()
FROM generate_series(
  date_trunc('month',(v_window_start AT TIME ZONE v_tz)::date)::date,
  date_trunc('month',(v_window_end AT TIME ZONE v_tz)::date)::date,
  interval '1 month'
) month_start
CROSS JOIN LATERAL (
  SELECT (
    ((v_weekdays_int[1] - extract(dow from month_start)::int + 7) % 7)
    + (v_nth - 1) * 7
  )::int AS offset_days
) off
WHERE ((((month_start::date + off.offset_days)::date + v_event_start_time::time )::timestamp) AT TIME ZONE v_tz)
  BETWEEN GREATEST((v_base_local_ts AT TIME ZONE v_tz),v_window_start)
  AND v_window_end
ON CONFLICT ON CONSTRAINT uq_calendar_occurrences_event_start_auto
DO UPDATE SET
  instance_end = EXCLUDED.instance_end,
  city_id = EXCLUDED.city_id,
  city_slug = EXCLUDED.city_slug,
  updated_at = now();
END IF;

END;
$$;


ALTER FUNCTION "public"."generate_occurrences_for_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_occurrences_for_event_backup"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.generate_occurrences_for_event(p_event_id);
END;
$$;


ALTER FUNCTION "public"."generate_occurrences_for_event_backup"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_cities"() RETURNS TABLE("name" "text", "slug" "text", "country_code" "text", "event_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    c.name,
    c.slug,
    c.country_code,
    (
      SELECT count(*) 
      FROM events e 
      WHERE e.city_slug = c.slug 
      AND e.is_active = true
    ) as event_count
  FROM cities c
  WHERE c.is_active = true
  ORDER BY c.country_code, c.name;
$$;


ALTER FUNCTION "public"."get_active_cities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_based_city_prefill"() RETURNS TABLE("city_id" "uuid", "city_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_order text := 't.id DESC';
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'member_profiles'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'member_profiles'
          AND column_name = 'based_city_id'
    ) THEN
        RETURN QUERY
        SELECT mp.based_city_id, c.name
        FROM public.member_profiles mp
        JOIN public.cities c ON c.id = mp.based_city_id
        WHERE mp.id = auth.uid()
          AND mp.based_city_id IS NOT NULL
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_profiles'
          AND column_name = 'updated_at'
    ) THEN
        v_order := 't.updated_at DESC NULLS LAST';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_profiles'
          AND column_name = 'created_at'
    ) THEN
        v_order := v_order || ', t.created_at DESC NULLS LAST';
    END IF;

    v_order := v_order || ', t.id DESC';

    RETURN QUERY EXECUTE format(
        'SELECT t.city_id, c.name
         FROM public.teacher_profiles t
         JOIN public.cities c ON c.id = t.city_id
         WHERE t.user_id = auth.uid()
           AND t.city_id IS NOT NULL
         ORDER BY %s
         LIMIT 1',
        v_order
    );
END;
$$;


ALTER FUNCTION "public"."get_based_city_prefill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text") RETURNS TABLE("event_id" "uuid", "name" "text", "photo_url" "text"[], "location" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "meta_data" "jsonb", "key_times" "jsonb", "type" "text", "has_party" boolean, "has_class" boolean, "class_start" "text", "class_end" "text", "party_start" "text", "party_end" "text", "city_slug" "text", "cover_image_url" "text")
    LANGUAGE "sql" STABLE
    AS $$
  WITH slug_input AS (
    SELECT NULLIF(btrim(city_slug_param), '') AS normalized_slug
  ),
  mapped_city AS (
    SELECT c.id AS city_id
    FROM public.cities c
    JOIN slug_input s ON c.slug = s.normalized_slug
    LIMIT 1
  )
  SELECT g.*
  FROM slug_input s
  LEFT JOIN mapped_city mc ON true
  CROSS JOIN LATERAL public.get_calendar_events(
    range_start,
    range_end,
    city_slug_param,
    mc.city_id
  ) AS g
  WHERE s.normalized_slug IS NULL
     OR mc.city_id IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text", "city_id_param" "uuid") RETURNS TABLE("event_id" "uuid", "name" "text", "photo_url" "text"[], "location" "text", "start_time" timestamp with time zone, "end_time" timestamp with time zone, "meta_data" "jsonb", "key_times" "jsonb", "type" "text", "has_party" boolean, "has_class" boolean, "class_start" "text", "class_end" "text", "party_start" "text", "party_end" "text", "city_slug" "text", "cover_image_url" "text")
    LANGUAGE "sql" STABLE
    AS $$
  WITH city_filter AS (
    SELECT city_id_param AS effective_city_id
  )
  SELECT
    e.id AS event_id,
    e.name,
    ARRAY[e.poster_url]::text[] AS photo_url,
    COALESCE(v.name, v.address, ''::text) AS location,
    co.instance_start AS start_time,
    co.instance_end AS end_time,
    COALESCE(e.meta_data, '{}'::jsonb),
    COALESCE(e.key_times, '{}'::jsonb),
    e.type,
    false AS has_party,
    false AS has_class,
    null AS class_start,
    null AS class_end,
    null AS party_start,
    null AS party_end,
    COALESCE(co.city_slug, e.city_slug) AS city_slug,
    e.poster_url AS cover_image_url
  FROM public.calendar_occurrences co
  JOIN public.events e ON e.id = co.event_id
  LEFT JOIN public.venues v ON v.id = COALESCE(co.venue_id, e.venue_id)
  CROSS JOIN city_filter cf
  WHERE co.instance_start >= range_start
    AND co.instance_start < range_end
    AND e.lifecycle_status = 'published'
    AND (
      cf.effective_city_id IS NULL
      OR COALESCE(co.city_id, e.city_id) = cf.effective_city_id
    )
  ORDER BY co.instance_start ASC;
$$;


ALTER FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text", "city_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_organiser_entity_ids_v1"() RETURNS TABLE("entity_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT e.id AS entity_id
  FROM public.entities e
  WHERE e.type = 'organiser'
    AND e.claimed_by = auth.uid()
  UNION
  SELECT DISTINCT otm.organiser_entity_id AS entity_id
  FROM public.organiser_team_members otm
  WHERE otm.member_profile_id = auth.uid()
    AND otm.is_active = true;
$$;


ALTER FUNCTION "public"."get_current_user_organiser_entity_ids_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_discount_partners_with_next_event"("p_city_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "organisation_name" "text", "photo_url" "text"[], "city" "text", "instagram" "text", "next_event_name" "text", "next_event_date" "date")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_city_slug_norm text := NULL;
  v_city_id uuid := NULL;
BEGIN
  v_city_slug_norm := NULLIF(btrim(COALESCE(p_city_slug, '')), '');

  IF v_city_slug_norm IS NOT NULL THEN
    v_city_id := public.resolve_city_id(NULL, v_city_slug_norm);

    IF v_city_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.organisation_name AS name,
    o.organisation_name,
    CASE WHEN NULLIF(btrim(COALESCE(o.photo_url, '')), '') IS NULL
         THEN ARRAY[]::text[]
         ELSE ARRAY[o.photo_url]
    END AS photo_url,
    o.city,
    (o.meta_data->>'instagram') AS instagram,
    e.event_name AS next_event_name,
    e.event_date AS next_event_date
  FROM public.organisers o
  LEFT JOIN LATERAL (
    SELECT ev.name AS event_name, ev.date AS event_date
    FROM public.events ev
    JOIN public.event_entities ee
      ON ee.event_id = ev.id
     AND ee.entity_id = o.id
     AND ee.role = 'organiser'
    WHERE ev.date >= CURRENT_DATE
      AND ev.is_active = true
      AND (
        v_city_slug_norm IS NULL
        OR ev.city_id = v_city_id
      )
    ORDER BY ev.date ASC
    LIMIT 1
  ) e ON true
  WHERE e.event_name IS NOT NULL
  ORDER BY e.event_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_discount_partners_with_next_event"("p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_entity_events"("p_entity_id" "uuid", "p_role" "text", "p_city_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "date" "date", "is_published" boolean, "location" "text", "cover_image_url" "text", "photo_url" "text"[])
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_city_id uuid := NULL;
BEGIN
  IF NULLIF(btrim(COALESCE(p_city_slug, '')), '') IS NOT NULL THEN
    v_city_id := public.resolve_city_id(NULL, p_city_slug);
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.date,
    e.is_active AS is_published,
    NULL::text AS location,
    e.poster_url AS cover_image_url,
    CASE WHEN NULLIF(btrim(COALESCE(e.poster_url, '')), '') IS NULL
         THEN ARRAY[]::text[]
         ELSE ARRAY[e.poster_url]
    END AS photo_url
  FROM events e
  WHERE e.is_active = true
    AND (
      p_city_slug IS NULL
      OR (v_city_id IS NOT NULL AND e.city_id = v_city_id)
    )
    AND p_role IN ('organiser', 'teacher', 'dj')
    AND EXISTS (
      SELECT 1
      FROM public.event_entities ee
      WHERE ee.event_id = e.id
        AND ee.entity_id = p_entity_id
        AND ee.role::text = p_role
    )
  ORDER BY e.date ASC;
END;
$$;


ALTER FUNCTION "public"."get_entity_events"("p_entity_id" "uuid", "p_role" "text", "p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_engagement"("p_event_id" "uuid") RETURNS TABLE("interested_count" integer, "going_count" integer)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select
    count(*) filter (where status = 'interested') as interested_count,
    count(*) filter (where status = 'going') as going_count
  from public.event_participants
  where event_id = p_event_id;
$$;


ALTER FUNCTION "public"."get_event_engagement"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_page_snapshot"("p_event_id" "uuid", "p_occurrence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_event record;
  v_occurrence record;
  v_occurrence_id uuid := p_occurrence_id;
  v_lineup jsonb;
  v_guest_dancers jsonb;
  v_organisers jsonb;
  v_city record;
  v_city_eff_id uuid;
  v_city_display_name text;
BEGIN
  SELECT id, name, description, venue_id, city_id, poster_url, lifecycle_status, is_active,
         start_time, end_time, ticket_url, instagram_url, facebook_url, website, pricing, key_times, faq, meta_data, type
    INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  IF v_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence FROM public.calendar_occurrences co WHERE co.id = v_occurrence_id AND co.event_id = p_event_id;
    IF NOT FOUND THEN
      v_occurrence_id := NULL;
    END IF;
  END IF;

  IF v_occurrence_id IS NULL THEN
    SELECT * INTO v_occurrence
    FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id
    ORDER BY co.instance_start NULLS LAST
    LIMIT 1;
    IF FOUND THEN v_occurrence_id := v_occurrence.id; END IF;
  END IF;

  v_city_eff_id := COALESCE(v_occurrence.city_id, v_event.city_id);
  IF v_city_eff_id IS NOT NULL THEN
    SELECT id, name, slug INTO v_city
    FROM public.cities c
    WHERE c.id = v_city_eff_id;
  END IF;

  v_city_display_name := CASE
    WHEN v_city.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN NULL
    ELSE v_city.name
  END;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', epl.id,
      'profile_id', epl.profile_id,
      'role', epl.role,
      'is_primary', epl.is_primary,
      'occurrence_id', epl.occurrence_id
    ) ORDER BY epl.created_at
  ), '[]'::jsonb) INTO v_lineup
  FROM public.event_profile_links epl
  WHERE epl.event_id = p_event_id AND epl.status='active' AND epl.archived_at IS NULL
    AND epl.role IN ('teacher','dj','vendor','videographer')
    AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', epl.id,
      'profile_id', epl.profile_id,
      'is_primary', epl.is_primary,
      'occurrence_id', epl.occurrence_id
    ) ORDER BY epl.created_at
  ), '[]'::jsonb) INTO v_guest_dancers
  FROM public.event_profile_links epl
  WHERE epl.event_id = p_event_id AND epl.status='active' AND epl.archived_at IS NULL
    AND epl.role = 'dancer'
    AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('entity_id', ee.entity_id)
    ORDER BY ee.created_at
  ), '[]'::jsonb) INTO v_organisers
  FROM public.event_entities ee
  WHERE ee.event_id = p_event_id AND ee.role='organiser';

  RETURN jsonb_build_object(
    'event_id', v_event.id,
    'occurrence_id', v_occurrence_id,
    'city_id', v_city_eff_id,
    'city_display', jsonb_build_object(
      'name', v_city_display_name,
      'slug', v_city.slug,
      'is_derived', true,
      'authoritative_source', 'city_id'
    ),
    'event', to_jsonb(v_event) - 'id',
    'location', jsonb_build_object(
      'city', CASE WHEN v_city.id IS NOT NULL THEN jsonb_build_object('id', v_city.id, 'name', v_city_display_name, 'slug', v_city.slug) ELSE NULL END
    ),
    'organisers', v_organisers,
    'lineup', v_lineup,
    'guest_dancers', v_guest_dancers
  );
END;
$_$;


ALTER FUNCTION "public"."get_event_page_snapshot"("p_event_id" "uuid", "p_occurrence_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_event_page_snapshot"("p_event_id" "uuid", "p_occurrence_id" "uuid") IS 'anon revoked 2026-04-02';



CREATE OR REPLACE FUNCTION "public"."get_event_profile_connections"("p_event_id" "uuid") RETURNS TABLE("id" "uuid", "event_id" "uuid", "person_type" "text", "person_id" "uuid", "connection_label" "text", "is_primary" boolean, "sort_order" integer, "notes" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    epc.id,
    epc.event_id,
    epc.person_type,
    epc.person_id,
    epc.connection_label,
    epc.is_primary,
    epc.sort_order,
    epc.notes,
    epc.created_at
  FROM public.event_profile_connections epc
  WHERE epc.event_id = p_event_id
    AND (epc.person_type <> 'dancer' OR auth.uid() IS NOT NULL)
  ORDER BY epc.person_type, epc.sort_order, epc.created_at;
$$;


ALTER FUNCTION "public"."get_event_profile_connections"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_festival_attendance"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'going_count',      COUNT(*) FILTER (WHERE status = 'going'),
    'interested_count', COUNT(*) FILTER (WHERE status = 'interested'),
    'attendees', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('user_id', a.user_id, 'status', a.status)
        )
        FROM (
          SELECT user_id, status
          FROM public.event_participants
          WHERE event_id = p_event_id
            AND status IN ('going', 'interested')
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 200
        ) a
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.event_participants
  WHERE event_id = p_event_id
    AND status IN ('going', 'interested');

  RETURN COALESCE(
    v_result,
    '{"going_count":0,"interested_count":0,"attendees":[]}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."get_festival_attendance"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_occurrences_by_canonical_venue"("_venue_id" "uuid", "_start_at" timestamp with time zone, "_end_at" timestamp with time zone, "_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0) RETURNS TABLE("occurrence_id" "uuid", "event_id" "uuid", "instance_start" timestamp with time zone, "instance_end" timestamp with time zone, "canonical_venue_id" "uuid", "canonical_venue_source" "text")
    LANGUAGE "sql" STABLE
    AS $$
SELECT
  co.id,
  co.event_id,
  co.instance_start,
  co.instance_end,
  COALESCE(co.venue_id, e.venue_id) AS canonical_venue_id,
  CASE
    WHEN co.venue_id IS NOT NULL THEN 'occurrence_override'
    WHEN co.venue_id IS NULL AND e.venue_id IS NOT NULL THEN 'event_default'
    ELSE NULL
  END AS canonical_venue_source
FROM public.calendar_occurrences co
JOIN public.events e
  ON e.id = co.event_id
WHERE
  COALESCE(co.venue_id, e.venue_id) = _venue_id
  AND co.instance_start >= _start_at
  AND co.instance_start < _end_at
ORDER BY co.instance_start ASC
LIMIT _limit
OFFSET _offset;
$$;


ALTER FUNCTION "public"."get_occurrences_by_canonical_venue"("_venue_id" "uuid", "_start_at" timestamp with time zone, "_end_at" timestamp with time zone, "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organiser_event_counts"("p_city_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("entity_id" "uuid", "event_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_filter_slug text := lower(NULLIF(btrim(COALESCE(p_city_slug, '')), ''));
  v_filter_city_id uuid := NULL;
BEGIN
  IF v_filter_slug IS NOT NULL THEN
    SELECT c.id
      INTO v_filter_city_id
    FROM public.cities c
    WHERE lower(c.slug) = v_filter_slug
    LIMIT 1;

    IF v_filter_city_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    ee.entity_id,
    count(*) AS event_count
  FROM public.events e
  JOIN public.event_entities ee
    ON ee.event_id = e.id
   AND ee.role::text = 'organiser'
  WHERE e.is_active = true
    AND (v_filter_city_id IS NULL OR e.city_id = v_filter_city_id)
  GROUP BY ee.entity_id;
END;
$$;


ALTER FUNCTION "public"."get_organiser_event_counts"("p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "city" "text", "start_time" timestamp with time zone, "lifecycle_status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ev.id,
    ev.name,
    c.name AS city,
    ev.start_time,
    ev.lifecycle_status
  FROM public.event_entities ee
  JOIN public.events ev ON ev.id = ee.event_id
  LEFT JOIN public.cities c ON c.id = ev.city_id
  WHERE ee.entity_id = p_organiser_entity_id
    AND ee.role = 'organiser'
  ORDER BY ev.start_time DESC NULLS LAST;
$$;


ALTER FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_event_timeline"("p_person_type" "text", "p_person_id" "uuid", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("event_id" "uuid", "event_name" "text", "event_location" "text", "event_start_time" timestamp with time zone, "connection_label" "text", "is_primary" boolean, "sort_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id AS event_id,
    e.name AS event_name,
    e.location AS event_location,
    e.start_time AS event_start_time,
    epc.connection_label,
    epc.is_primary,
    epc.sort_order
  FROM public.event_profile_connections epc
  JOIN public.events e ON e.id = epc.event_id
  WHERE epc.person_type = p_person_type
    AND epc.person_id = p_person_id
    AND (epc.person_type <> 'dancer' OR auth.uid() IS NOT NULL)
  ORDER BY e.start_time DESC NULLS LAST, epc.sort_order, epc.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;


ALTER FUNCTION "public"."get_profile_event_timeline"("p_person_type" "text", "p_person_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_dancer_preview_v1"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "first_name" "text", "surname" "text", "avatar_url" "text", "based_city_id" "uuid", "city" "text", "dance_role" "text", "nationality" "text", "gallery_urls" "text"[], "achievements" "text"[], "favorite_styles" "text"[], "partner_search_role" "text", "partner_search_level" "text"[], "looking_for_partner" boolean, "instagram" "text", "facebook" "text", "website" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id,
    dp.first_name,
    dp.surname,
    dp.avatar_url,
    dp.based_city_id,
    c.name AS city,
    dp.dance_role,
    dp.nationality,
    dp.gallery_urls,
    dp.achievements,
    dp.favorite_styles,
    dp.partner_search_role,
    dp.partner_search_level,
    dp.looking_for_partner,
    dp.instagram,
    dp.facebook,
    dp.website
  FROM public.dancer_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.based_city_id
  WHERE dp.id = p_user_id
    -- Suspended dancers are never public
    AND dp.is_active IS NOT FALSE
    -- Completeness gate: all five fields required for a renderable public profile.
    -- Mirrors public_visible_dancers (202604030015) exactly.
    AND dp.first_name         IS NOT NULL AND btrim(dp.first_name)  <> ''
    AND dp.based_city_id      IS NOT NULL
    AND dp.avatar_url         IS NOT NULL AND btrim(dp.avatar_url)  <> ''
    AND dp.dance_role         IS NOT NULL AND btrim(dp.dance_role)  <> ''
    AND dp.dance_started_year IS NOT NULL
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_public_dancer_preview_v1"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "dj_name" "text", "first_name" "text", "surname" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "nationality" "text", "genres" "text"[], "soundcloud" "text", "youtube_url" "text", "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    dp.id           AS entity_id,
    dp.dj_name,
    dp.first_name,
    dp.surname,
    dp.photo_url[1] AS photo_url,
    dp.city_id,
    c.name          AS city,
    dp.nationality,
    dp.genres,
    dp.soundcloud,
    dp.youtube_url,
    dp.website,
    dp.instagram,
    dp.facebook,
    dp.email,
    dp.phone
  FROM public.dj_profiles dp
  LEFT JOIN public.cities c ON c.id = dp.city_id
  WHERE dp.id = p_entity_id
    AND dp.is_active IS NOT FALSE
    AND dp.first_name IS NOT NULL AND btrim(dp.first_name) <> ''
    AND dp.photo_url  IS NOT NULL AND dp.photo_url[1] IS NOT NULL
    AND dp.city_id    IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
  v_event RECORD;
  v_occ RECORD;
  v_occ_id uuid;
  v_city RECORD;
  v_city_eff_id uuid;
  v_city_display_name text;
  v_venue RECORD;
  v_venue_eff_id uuid;
  v_timezone text;
  v_photo_urls text[] := ARRAY[]::text[];
  v_cover_image_url text := NULL;
  v_actions jsonb := '{}'::jsonb;
  v_organiser RECORD;
  v_teachers jsonb := '[]'::jsonb;
  v_djs jsonb := '[]'::jsonb;
  v_dancers jsonb := '[]'::jsonb;
  v_vendors jsonb := '[]'::jsonb;
  v_videographers jsonb := '[]'::jsonb;
  v_attendance_preview jsonb := '[]'::jsonb;
  v_attendance_count bigint := 0;
BEGIN
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occ FROM public.calendar_occurrences co WHERE co.id = p_occurrence_id AND co.event_id = p_event_id LIMIT 1;
    IF FOUND THEN
      v_occ_id := v_occ.id;
    END IF;
  END IF;

  IF v_occ_id IS NULL THEN
    SELECT * INTO v_occ
    FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id AND COALESCE(co.lifecycle_status, 'published') <> 'cancelled'
    ORDER BY (co.instance_start >= now()) DESC, co.instance_start ASC
    LIMIT 1;
    IF FOUND THEN
      v_occ_id := v_occ.id;
    END IF;
  END IF;

  v_venue_eff_id := COALESCE(v_occ.venue_id, v_event.venue_id);
  v_city_eff_id := COALESCE(v_occ.city_id, v_event.city_id);

  IF v_venue_eff_id IS NOT NULL THEN
    SELECT * INTO v_venue FROM public.venues v WHERE v.id = v_venue_eff_id;
  END IF;
  IF v_city_eff_id IS NOT NULL THEN
    SELECT * INTO v_city FROM public.cities c WHERE c.id = v_city_eff_id;
  END IF;

  v_city_display_name := CASE
    WHEN v_city.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN NULL
    ELSE v_city.name
  END;

  v_timezone := COALESCE(v_event.timezone, v_city.timezone, 'UTC');

  IF v_event.poster_url IS NOT NULL AND length(trim(v_event.poster_url)) > 0 THEN
    v_photo_urls := ARRAY[v_event.poster_url];
    v_cover_image_url := v_event.poster_url;
  ELSE
    v_photo_urls := ARRAY[]::text[];
    v_cover_image_url := NULL;
  END IF;

  v_actions := jsonb_build_object(
    'ticket_url', v_event.ticket_url,
    'website', v_event.website,
    'facebook_url', v_event.facebook_url,
    'instagram_url', v_event.instagram_url,
    'pricing', COALESCE(v_event.pricing, '{}'::jsonb)
  );

  SELECT ent.id, ent.name AS display_name, ent.avatar_url
  INTO v_organiser
  FROM public.event_entities ee
  JOIN public.entities ent ON ent.id = ee.entity_id
  WHERE ee.event_id = p_event_id AND ee.role = 'organiser'
  ORDER BY ee.created_at ASC, ent.name ASC
  LIMIT 1;

  -- Teachers
  WITH base_links AS (
    SELECT * FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id AND epl.status = 'active'
      AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occ_id)
  ), dedup AS (
    SELECT DISTINCT ON (profile_id, role)
      profile_id, role, profile_type, is_primary
    FROM base_links
    ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC, created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', tp.id,
           'display_name', COALESCE(NULLIF(TRIM(COALESCE(tp.first_name,''))||CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname))>0 THEN ' '||trim(tp.surname) ELSE '' END,''), tp.public_email, tp.instagram, tp.id::text),
           'avatar_url', tp.photo_url
         ) ORDER BY tp.first_name, tp.surname), '[]'::jsonb)
  INTO v_teachers
  FROM dedup d
  JOIN public.teacher_profiles tp ON tp.id = d.profile_id
  WHERE d.role = 'teacher' AND d.profile_type IN ('teacher');

  -- DJs
  WITH base_links AS (
    SELECT * FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id AND epl.status = 'active'
      AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occ_id)
  ), dedup AS (
    SELECT DISTINCT ON (profile_id, role)
      profile_id, role, profile_type, is_primary
    FROM base_links
    ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC, created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', dj.id,
           'display_name', COALESCE(NULLIF(trim(COALESCE(dj.dj_name, dj.name, dj.real_name,'')) ,''), dj.public_email, dj.instagram, dj.id::text),
           'avatar_url', COALESCE(dj.photo_url[1], NULL)
         ) ORDER BY dj.dj_name, dj.name), '[]'::jsonb)
  INTO v_djs
  FROM dedup d
  JOIN public.dj_profiles dj ON dj.id = d.profile_id
  WHERE d.role = 'dj' AND d.profile_type IN ('dj');

  -- ── Dancers: read from dancer_profiles (registered) or guest_dancer_profiles ──
  WITH base_links AS (
    SELECT * FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id AND epl.status = 'active'
      AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occ_id)
  ), dedup AS (
    SELECT DISTINCT ON (profile_id, role)
      profile_id, role, profile_type, is_primary
    FROM base_links
    ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC, created_at ASC
  )
  SELECT COALESCE(jsonb_agg(profile_obj ORDER BY display_name), '[]'::jsonb)
  INTO v_dancers
  FROM (
    -- Registered dancer (dancer_profiles, id = auth.users.id)
    SELECT
      jsonb_build_object(
        'id',           dp.id,
        'display_name', COALESCE(
                          NULLIF(TRIM(
                            COALESCE(dp.first_name, '') ||
                            CASE WHEN dp.surname IS NOT NULL AND length(trim(dp.surname)) > 0
                                 THEN ' ' || trim(dp.surname) ELSE '' END
                          ), ''),
                          dp.instagram,
                          dp.id::text
                        ),
        'avatar_url',   dp.avatar_url
      ) AS profile_obj,
      COALESCE(NULLIF(TRIM(COALESCE(dp.first_name,'')||CASE WHEN dp.surname IS NOT NULL THEN ' '||trim(dp.surname) ELSE '' END),''), dp.id::text) AS display_name
    FROM dedup d
    JOIN public.dancer_profiles dp ON dp.id = d.profile_id
    WHERE d.role = 'dancer' AND d.profile_type = 'dancer'

    UNION ALL

    -- Guest dancer (guest_dancer_profiles, id = preserved dancers.id UUID)
    SELECT
      jsonb_build_object(
        'id',           gdp.id,
        'display_name', COALESCE(
                          NULLIF(TRIM(
                            COALESCE(gdp.first_name, '') ||
                            CASE WHEN gdp.surname IS NOT NULL AND length(trim(gdp.surname)) > 0
                                 THEN ' ' || trim(gdp.surname) ELSE '' END
                          ), ''),
                          gdp.instagram,
                          gdp.id::text
                        ),
        'avatar_url',   gdp.avatar_url
      ) AS profile_obj,
      COALESCE(NULLIF(TRIM(COALESCE(gdp.first_name,'')||CASE WHEN gdp.surname IS NOT NULL THEN ' '||trim(gdp.surname) ELSE '' END),''), gdp.id::text) AS display_name
    FROM dedup d
    JOIN public.guest_dancer_profiles gdp ON gdp.id = d.profile_id
    WHERE d.role = 'dancer' AND d.profile_type = 'guest_dancer'
  ) combined_dancers;

  -- Vendors
  WITH base_links AS (
    SELECT * FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id AND epl.status = 'active'
      AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occ_id)
  ), dedup AS (
    SELECT DISTINCT ON (profile_id, role)
      profile_id, role, profile_type, is_primary
    FROM base_links
    ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC, created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', vnd.id,
           'display_name', COALESCE(NULLIF(trim(COALESCE(vnd.business_name,'')),''), vnd.public_email, vnd.instagram, vnd.id::text),
           'avatar_url', COALESCE(vnd.photo_url[1], NULL)
         ) ORDER BY vnd.business_name), '[]'::jsonb)
  INTO v_vendors
  FROM dedup d
  JOIN public.vendors vnd ON vnd.id = d.profile_id
  WHERE d.role = 'vendor' AND d.profile_type IN ('vendor');

  -- Videographers
  WITH base_links AS (
    SELECT * FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id AND epl.status = 'active'
      AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occ_id)
  ), dedup AS (
    SELECT DISTINCT ON (profile_id, role)
      profile_id, role, profile_type, is_primary
    FROM base_links
    ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC, created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', vid.id,
           'display_name', COALESCE(NULLIF(trim(COALESCE(vid.business_name,'')),''), vid.public_email, vid.instagram, vid.id::text),
           'avatar_url', COALESCE(vid.photo_url[1], NULL)
         ) ORDER BY vid.business_name), '[]'::jsonb)
  INTO v_videographers
  FROM dedup d
  JOIN public.videographers vid ON vid.id = d.profile_id
  WHERE d.role = 'videographer' AND d.profile_type IN ('videographer');

  IF to_regclass('public.event_participants') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.event_participants ep
      WHERE ep.event_id = $1 AND ep.status = 'going'
    $sql$
    INTO v_attendance_count
    USING p_event_id;

    EXECUTE $sql$
      SELECT COALESCE(jsonb_agg(x.obj), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
                 'id', pr.id,
                 'display_name', COALESCE(pr.full_name, pr.username, pr.email, pr.id::text),
                 'avatar_url', pr.avatar_url
               ) AS obj
        FROM public.event_participants ep
        JOIN public.profiles pr ON pr.id = ep.user_id
        WHERE ep.event_id = $1 AND ep.status = 'going'
        ORDER BY pr.full_name NULLS LAST
        LIMIT 6
      ) x
    $sql$
    INTO v_attendance_preview
    USING p_event_id;
  ELSIF to_regclass('public.event_attendance') IS NOT NULL AND v_occ_id IS NOT NULL THEN
    EXECUTE $sql$
      SELECT COUNT(*)
      FROM public.event_attendance ea
      WHERE ea.occurrence_id = $1 AND ea.status = 'going'
    $sql$
    INTO v_attendance_count
    USING v_occ_id;

    EXECUTE $sql$
      SELECT COALESCE(jsonb_agg(x.obj), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
                 'id', pr.id,
                 'display_name', COALESCE(pr.full_name, pr.username, pr.email, pr.id::text),
                 'avatar_url', pr.avatar_url
               ) AS obj
        FROM public.event_attendance ea
        JOIN public.profiles pr ON pr.id = ea.user_id
        WHERE ea.occurrence_id = $1 AND ea.status = 'going'
        ORDER BY pr.full_name NULLS LAST
        LIMIT 6
      ) x
    $sql$
    INTO v_attendance_preview
    USING v_occ_id;
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'occurrence_id', v_occ_id,
    'city_id', v_city_eff_id,
    'city_display', jsonb_build_object(
      'name', v_city_display_name,
      'slug', v_city.slug,
      'is_derived', true,
      'authoritative_source', 'city_id'
    ),
    'event', jsonb_build_object(
      'name', v_event.name,
      'description', v_event.description,
      'status', v_event.lifecycle_status,
      'schedule_type', COALESCE(v_event.schedule_type, v_event.type),
      'is_published', (v_event.lifecycle_status = 'published'),
      'created_by', v_event.created_by,
      'photo_urls', COALESCE(to_jsonb(v_photo_urls), '[]'::jsonb),
      'cover_image_url', v_cover_image_url,
      'gallery_urls', COALESCE(v_event.meta_data->'gallery', '[]'::jsonb),
      'actions', v_actions
    ),
    'occurrence', jsonb_build_object(
      'starts_at', COALESCE(v_occ.instance_start, v_event.start_time),
      'ends_at', COALESCE(v_occ.instance_end, v_event.end_time),
      'local_date', to_char(COALESCE(v_occ.instance_start, v_event.start_time) AT TIME ZONE v_timezone, 'YYYY-MM-DD'),
      'timezone', v_timezone,
      'is_live', CASE WHEN v_occ.id IS NOT NULL AND now() BETWEEN v_occ.instance_start AND COALESCE(v_occ.instance_end, v_occ.instance_start + interval '1 hour') THEN true ELSE false END,
      'is_past', CASE WHEN COALESCE(v_occ.instance_end, v_occ.instance_start, v_event.end_time, v_event.start_time) < now() THEN true ELSE false END,
      'is_upcoming', CASE WHEN COALESCE(v_occ.instance_start, v_event.start_time) > now() THEN true ELSE false END
    ),
    'location', jsonb_build_object(
      'city', CASE WHEN v_city.id IS NOT NULL THEN jsonb_build_object('id', v_city.id, 'name', v_city_display_name, 'slug', v_city.slug, 'is_derived', true, 'authoritative_source', 'city_id') ELSE NULL END,
      'venue', CASE WHEN v_venue.id IS NOT NULL THEN jsonb_build_object('id', v_venue.id, 'name', v_venue.name, 'address', v_venue.address, 'timezone', v_venue.timezone, 'image_url', v_venue.photo_url[1]) ELSE NULL END
    ),
    'organiser', CASE WHEN v_organiser.id IS NOT NULL THEN jsonb_build_object('id', v_organiser.id, 'display_name', v_organiser.display_name, 'avatar_url', v_organiser.avatar_url) ELSE NULL END,
    'lineup', jsonb_build_object(
      'teachers', v_teachers,
      'djs', v_djs,
      'dancers', v_dancers,
      'vendors', v_vendors,
      'videographers', v_videographers
    ),
    'attendance', jsonb_build_object(
      'going_count', v_attendance_count,
      'current_user_status', NULL,
      'preview', v_attendance_preview
    )
  );
END;
$_$;


ALTER FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_event          RECORD;
    v_meta           jsonb;
    v_occ            RECORD;
    v_city           RECORD;
    v_primary_venue  RECORD;
    v_timezone       text;
    v_organiser      RECORD;
    v_teachers       jsonb := '[]'::jsonb;
    v_djs            jsonb := '[]'::jsonb;
    v_mcs            jsonb := '[]'::jsonb;
    v_performers     jsonb := '[]'::jsonb;
    v_videographers  jsonb := '[]'::jsonb;
    v_vendors        jsonb := '[]'::jsonb;
    v_guest_dancers  jsonb := '[]'::jsonb;
    v_schedule       jsonb := '[]'::jsonb;
    v_competitions   jsonb := '[]'::jsonb;
    v_passes         jsonb := '[]'::jsonb;
    v_venues         jsonb := '[]'::jsonb;
    v_hotels         jsonb := '[]'::jsonb;
    v_travel         jsonb;
BEGIN
    -- ── Load event, gate on published ─────────────────────────────────────
    SELECT * INTO v_event
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.lifecycle_status = 'published'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_meta := COALESCE(v_event.meta_data, '{}'::jsonb);

    -- ── Occurrence (primary — earliest non-cancelled) ──────────────────────
    SELECT * INTO v_occ
    FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id
      AND COALESCE(co.lifecycle_status, 'published') <> 'cancelled'
    ORDER BY co.instance_start ASC
    LIMIT 1;

    -- ── City ──────────────────────────────────────────────────────────────
    SELECT * INTO v_city
    FROM public.cities c
    WHERE c.id = COALESCE(v_occ.city_id, v_event.city_id)
    LIMIT 1;

    v_timezone := COALESCE(v_event.timezone, v_city.timezone, 'UTC');

    -- ── Primary venue (from events.venue_id or first occurrence venue) ───
    SELECT * INTO v_primary_venue
    FROM public.venues v
    WHERE v.id = COALESCE(v_occ.venue_id, v_event.venue_id)
    LIMIT 1;

    -- ── Organiser (first by created_at) ──────────────────────────────────
    SELECT ent.id, ent.name AS display_name, ent.avatar_url
    INTO v_organiser
    FROM public.event_entities ee
    JOIN public.entities ent ON ent.id = ee.entity_id
    WHERE ee.event_id = p_event_id AND ee.role = 'organiser'
    ORDER BY ee.created_at ASC, ent.name ASC
    LIMIT 1;

    -- ── Teachers ─────────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           tp.id,
               'display_name', COALESCE(
                                   NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                       CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                            THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                   tp.public_email, tp.id::text),
               'avatar_url',   tp.photo_url
           ) ORDER BY tp.first_name, tp.surname), '[]'::jsonb)
    INTO v_teachers
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'teacher'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.teacher_profiles tp ON tp.id = lnk.profile_id;

    -- ── DJs ───────────────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           dj.id,
               'display_name', COALESCE(
                                   NULLIF(TRIM(COALESCE(dj.dj_name, dj.name, dj.real_name, '')), ''),
                                   dj.public_email, dj.id::text),
               'avatar_url',   COALESCE(dj.photo_url[1], NULL)
           ) ORDER BY dj.dj_name, dj.name), '[]'::jsonb)
    INTO v_djs
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'dj'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.dj_profiles dj ON dj.id = lnk.profile_id;

    -- ── MCs / Hosts ───────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           tp.id,
               'display_name', COALESCE(
                                   NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                       CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                            THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                   tp.public_email, tp.id::text),
               'avatar_url',   tp.photo_url
           ) ORDER BY tp.first_name, tp.surname), '[]'::jsonb)
    INTO v_mcs
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'hosting'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.teacher_profiles tp ON tp.id = lnk.profile_id;

    -- ── Performers ────────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           tp.id,
               'display_name', COALESCE(
                                   NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                       CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                            THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                   tp.public_email, tp.id::text),
               'avatar_url',   tp.photo_url
           ) ORDER BY tp.first_name, tp.surname), '[]'::jsonb)
    INTO v_performers
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'performing'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.teacher_profiles tp ON tp.id = lnk.profile_id;

    -- ── Videographers ─────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           vid.id,
               'display_name', COALESCE(
                                   NULLIF(trim(COALESCE(vid.business_name, '')), ''),
                                   vid.public_email, vid.instagram, vid.id::text),
               'avatar_url',   COALESCE(vid.photo_url[1], NULL)
           ) ORDER BY vid.business_name), '[]'::jsonb)
    INTO v_videographers
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'videographer'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.videographers vid ON vid.id = lnk.profile_id;

    -- ── Vendors ───────────────────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id',           vnd.id,
               'display_name', COALESCE(
                                   NULLIF(trim(COALESCE(vnd.business_name, '')), ''),
                                   vnd.public_email, vnd.instagram, vnd.id::text),
               'avatar_url',   COALESCE(vnd.photo_url[1], NULL)
           ) ORDER BY vnd.business_name), '[]'::jsonb)
    INTO v_vendors
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'vendor'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.vendors vnd ON vnd.id = lnk.profile_id;

    -- ── Guest dancers (from EPL + appearing_days from meta_data) ─────────
    -- guest_dancers_series in meta_data is FestivalGuestDancer[] — each item
    -- has profile_id and appearing_days. EPL role='dancer' is the authority
    -- for whether a guest dancer is active.
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',            gdp.id,
            'display_name',  COALESCE(
                                 NULLIF(TRIM(COALESCE(gdp.first_name, '') ||
                                     CASE WHEN gdp.surname IS NOT NULL AND length(trim(gdp.surname)) > 0
                                          THEN ' ' || trim(gdp.surname) ELSE '' END), ''),
                                 gdp.instagram,
                                 gdp.id::text),
            'avatar_url',    gdp.avatar_url,
            'appearing_days', COALESCE(
                (
                    SELECT gds.value->'appearing_days'
                    FROM jsonb_array_elements(COALESCE(v_meta->'guest_dancers_series', '[]'::jsonb)) AS gds
                    WHERE gds.value->>'profile_id' = gdp.id::text
                    LIMIT 1
                ),
                '[]'::jsonb
            )
        )
        ORDER BY gdp.first_name, gdp.surname
    ), '[]'::jsonb)
    INTO v_guest_dancers
    FROM (
        SELECT DISTINCT ON (epl.profile_id) epl.profile_id
        FROM public.event_profile_links epl
        WHERE epl.event_id = p_event_id
          AND epl.role = 'dancer'
          AND epl.status = 'active'
          AND epl.archived_at IS NULL
    ) lnk
    JOIN public.guest_dancer_profiles gdp ON gdp.id = lnk.profile_id;

    -- ── Schedule (hydrate instructor + dj names) ──────────────────────────
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',          item->>'id',
            'day',         item->>'day',
            'type',        item->>'type',
            'title',       item->>'title',
            'start_time',  item->>'start_time',
            'end_time',    item->>'end_time',
            'venue_room',  item->>'venue_room',
            'style',       item->>'style',
            'level',       item->>'level',
            'max_capacity', (item->>'max_capacity')::int,
            'is_masterclass', COALESCE((item->>'is_masterclass')::boolean, false),
            'theme',       item->>'theme',
            'dress_code',  item->>'dress_code',
            'instructors', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id',           tp.id,
                    'display_name', COALESCE(
                                       NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                           CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                                THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                       tp.id::text),
                    'avatar_url',   tp.photo_url
                )), '[]'::jsonb)
                FROM jsonb_array_elements_text(COALESCE(item->'instructor_ids', '[]'::jsonb)) AS iid
                JOIN public.teacher_profiles tp ON tp.id::text = iid
            ),
            'djs', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id',           dj.id,
                    'display_name', COALESCE(
                                       NULLIF(TRIM(COALESCE(dj.dj_name, dj.name, dj.real_name, '')), ''),
                                       dj.id::text),
                    'avatar_url',   COALESCE(dj.photo_url[1], NULL)
                )), '[]'::jsonb)
                FROM jsonb_array_elements_text(COALESCE(item->'dj_ids', '[]'::jsonb)) AS djid
                JOIN public.dj_profiles dj ON dj.id::text = djid
            ),
            'performers', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id',           tp.id,
                    'display_name', COALESCE(
                                       NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                           CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                                THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                       tp.id::text),
                    'avatar_url',   tp.photo_url
                )), '[]'::jsonb)
                FROM jsonb_array_elements_text(COALESCE(item->'performer_ids', '[]'::jsonb)) AS pid
                JOIN public.teacher_profiles tp ON tp.id::text = pid
            )
        )
        ORDER BY item->>'day', item->>'start_time', item->>'id'
    ), '[]'::jsonb)
    INTO v_schedule
    FROM jsonb_array_elements(COALESCE(v_meta->'program', '[]'::jsonb)) AS item;

    -- ── Competitions (hydrate judge names) ────────────────────────────────
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',                   comp->>'id',
            'name',                 comp->>'name',
            'format',               comp->>'format',
            'levels',               COALESCE(comp->'levels', '[]'::jsonb),
            'day',                  comp->>'day',
            'qualifiers_time',      comp->>'qualifiers_time',
            'finals_time',          comp->>'finals_time',
            'venue_room',           comp->>'venue_room',
            'registration_required', COALESCE((comp->>'registration_required')::boolean, false),
            'max_participants',     (comp->>'max_participants')::int,
            'entry_fee',            (comp->>'entry_fee')::numeric,
            'prize_description',    comp->>'prize_description',
            'is_qualifier',         COALESCE((comp->>'is_qualifier')::boolean, false),
            'judges', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id',           tp.id,
                    'display_name', COALESCE(
                                       NULLIF(TRIM(COALESCE(tp.first_name, '') ||
                                           CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
                                                THEN ' ' || trim(tp.surname) ELSE '' END), ''),
                                       tp.id::text),
                    'avatar_url',   tp.photo_url
                )), '[]'::jsonb)
                FROM jsonb_array_elements_text(COALESCE(comp->'judge_ids', '[]'::jsonb)) AS jid
                JOIN public.teacher_profiles tp ON tp.id::text = jid
            )
        )
        ORDER BY comp->>'day', comp->>'name'
    ), '[]'::jsonb)
    INTO v_competitions
    FROM jsonb_array_elements(COALESCE(v_meta->'competitions', '[]'::jsonb)) AS comp;

    -- ── Passes (no promo_codes) ───────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',             pass->>'id',
            'name',           pass->>'name',
            'price',          (pass->>'price')::numeric,
            'currency',       pass->>'currency',
            'type',           pass->>'type',
            'tier',           pass->>'tier',
            'quantity',       (pass->>'quantity')::int,
            'description',    pass->>'description',
            'sale_start',     pass->>'sale_start',
            'sale_end',       pass->>'sale_end',
            'covers_days',    COALESCE(pass->'covers_days', '[]'::jsonb),
            'early_bird_price', (pass->>'early_bird_price')::numeric
        )
        ORDER BY pass->>'tier', pass->>'type', pass->>'name'
    ), '[]'::jsonb)
    INTO v_passes
    FROM jsonb_array_elements(COALESCE(v_meta->'passes', '[]'::jsonb)) AS pass;

    -- ── Festival venues (all) ─────────────────────────────────────────────
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',               venue_item->>'id',
            'entity_id',        venue_item->>'entity_id',
            'name',             venue_item->>'name',
            'address',          venue_item->>'address',
            'map_url',          COALESCE(venue_item->>'map_url', venue_item->>'google_maps_url'),
            'is_primary',       COALESCE((venue_item->>'is_primary')::boolean, false),
            'role',             venue_item->>'role',
            'rooms',            COALESCE(venue_item->'rooms', '[]'::jsonb)
        )
        ORDER BY (venue_item->>'is_primary')::boolean DESC NULLS LAST, venue_item->>'name'
    ), '[]'::jsonb)
    INTO v_venues
    FROM jsonb_array_elements(COALESCE(v_meta->'venues', '[]'::jsonb)) AS venue_item;

    -- ── Hotels (public fields only — exclude notes, rack_rate, rate_includes) ──
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',                   hotel->>'id',
            'name',                 hotel->>'name',
            'star_rating',          (hotel->>'star_rating')::int,
            'address',              hotel->>'address',
            'phone',                hotel->>'phone',
            'photo_url',            hotel->>'photo_url',
            'website_url',          hotel->>'website_url',
            'is_official',          COALESCE((hotel->>'is_official')::boolean, false),
            'is_venue',             COALESCE((hotel->>'is_venue')::boolean, false),
            'distance',             hotel->>'distance',
            'shuttle_available',    COALESCE((hotel->>'shuttle_available')::boolean, false),
            'shuttle_details',      hotel->>'shuttle_details',
            'price_from',           (hotel->>'price_from')::numeric,
            'price_to',             (hotel->>'price_to')::numeric,
            'price_currency',       hotel->>'price_currency',
            'room_types',           COALESCE(hotel->'room_types', '[]'::jsonb),
            'booking_url',          hotel->>'booking_url',
            'block_deadline',       hotel->>'block_deadline',
            'rate_valid_from',      hotel->>'rate_valid_from',
            'rate_valid_to',        hotel->>'rate_valid_to',
            'cancellation_policy',  hotel->>'cancellation_policy',
            'check_in_time',        hotel->>'check_in_time',
            'check_out_time',       hotel->>'check_out_time',
            'amenities',            COALESCE(hotel->'amenities', '[]'::jsonb),
            'parking_info',         hotel->>'parking_info',
            'pet_policy',           hotel->>'pet_policy',
            'sort_order',           (hotel->>'sort_order')::int
            -- excluded: notes, rack_rate, rate_includes, group_code, booking_phone, booking_instructions
        )
        ORDER BY (hotel->>'sort_order')::int NULLS LAST, hotel->>'name'
    ), '[]'::jsonb)
    INTO v_hotels
    FROM jsonb_array_elements(COALESCE(v_meta->'hotels', '[]'::jsonb)) AS hotel;

    -- ── Travel ────────────────────────────────────────────────────────────
    v_travel := v_meta->'travel';

    -- ── Assemble response ─────────────────────────────────────────────────
    RETURN jsonb_build_object(

        'event_id', p_event_id,

        -- Identity
        'identity', jsonb_build_object(
            'name',             v_event.name,
            'description',      v_event.description,
            'edition',          v_meta->>'edition',
            'is_qualifier',     (v_meta->>'is_qualifier')::boolean,
            'qualifier_series', v_meta->>'qualifier_series',
            'qualifier_link',   v_meta->>'qualifier_link',
            'features',         COALESCE(v_meta->'features', '[]'::jsonb),
            'age_restriction',  v_meta->>'age_restriction',
            'languages',        COALESCE(v_meta->'languages', '[]'::jsonb),
            'dress_code',       v_meta->>'dress_code',
            'livestream_url',   v_meta->>'livestream_url',
            'aftermovie_url',   v_meta->>'aftermovie_url',
            'tiktok_url',       v_meta->>'tiktok_url',
            'poster_url',       v_event.poster_url,
            'gallery_urls',     COALESCE(v_meta->'gallery', '[]'::jsonb),
            'music_styles',     COALESCE(v_meta->'music_styles', '[]'::jsonb)
        ),

        -- Dates
        'dates', jsonb_build_object(
            'starts_at',    COALESCE(v_occ.instance_start, v_event.start_time),
            'ends_at',      COALESCE(v_occ.instance_end, v_event.end_time),
            'local_start',  to_char(
                                COALESCE(v_occ.instance_start, v_event.start_time) AT TIME ZONE v_timezone,
                                'YYYY-MM-DD'
                            ),
            'local_end',    to_char(
                                COALESCE(v_occ.instance_end, v_event.end_time) AT TIME ZONE v_timezone,
                                'YYYY-MM-DD'
                            ),
            'timezone',     v_timezone
        ),

        -- Links
        'links', jsonb_build_object(
            'website',        v_event.website,
            'facebook_url',   v_event.facebook_url,
            'instagram_url',  v_event.instagram_url,
            'ticket_url',     COALESCE(NULLIF(v_meta->>'ticket_link', ''), v_event.ticket_url),
            'whatsapp_link',  v_meta->>'whatsapp_link',
            'volunteer_url',  CASE WHEN (v_meta->>'volunteer_info')::boolean THEN v_meta->>'volunteer_url' ELSE NULL END,
            'code_of_conduct_url', CASE WHEN (v_meta->>'code_of_conduct')::boolean THEN v_meta->>'code_of_conduct_url' ELSE NULL END
        ),

        -- Location
        'location', jsonb_build_object(
            'city', CASE WHEN v_city.id IS NOT NULL THEN jsonb_build_object(
                'id',   v_city.id,
                'name', v_city.name,
                'slug', v_city.slug
            ) ELSE NULL END,
            'primary_venue', CASE WHEN v_primary_venue.id IS NOT NULL THEN jsonb_build_object(
                'id',      v_primary_venue.id,
                'name',    v_primary_venue.name,
                'address', v_primary_venue.address,
                'image_url', v_primary_venue.photo_url[1]
            ) ELSE NULL END
        ),

        -- Organiser
        'organiser', CASE WHEN v_organiser.id IS NOT NULL THEN jsonb_build_object(
            'id',           v_organiser.id,
            'display_name', v_organiser.display_name,
            'avatar_url',   v_organiser.avatar_url
        ) ELSE NULL END,

        -- Lineup (6 roles)
        'lineup', jsonb_build_object(
            'teachers',      v_teachers,
            'djs',           v_djs,
            'mcs',           v_mcs,
            'performers',    v_performers,
            'videographers', v_videographers,
            'vendors',       v_vendors
        ),

        -- Guest dancers
        'guest_dancers', v_guest_dancers,

        -- Schedule (hydrated)
        'schedule', v_schedule,

        -- Competitions (hydrated)
        'competitions', v_competitions,

        -- Passes (no promo codes)
        'passes', v_passes,

        -- All festival venues
        'venues', v_venues,

        -- Hotels (public fields only)
        'hotels', v_hotels,

        -- Promo codes
        'promo_codes', COALESCE(v_meta->'promo_codes', '[]'::jsonb),

        -- Travel info
        'travel', v_travel,

        -- Publish metadata
        'publish', jsonb_build_object(
            'has_code_of_conduct',       COALESCE((v_meta->>'code_of_conduct')::boolean, false),
            'code_of_conduct_url',       CASE WHEN (v_meta->>'code_of_conduct')::boolean THEN v_meta->>'code_of_conduct_url' ELSE NULL END,
            'has_volunteer_info',        COALESCE((v_meta->>'volunteer_info')::boolean, false),
            'volunteer_url',             CASE WHEN (v_meta->>'volunteer_info')::boolean THEN v_meta->>'volunteer_url' ELSE NULL END,
            'press_media_contact_name',  v_meta->>'press_media_contact_name',
            'press_media_contact_email', v_meta->>'press_media_contact_email'
        )
    );
END;
$$;


ALTER FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_organiser_info"("organiser_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "bio" "text", "photo_url" "text", "city" "text", "instagram" "text", "website" "text", "category" "text", "verified" boolean, "teaching_styles" "text"[], "gallery_urls" "text"[], "promo_video_urls" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    o.id, o.name, o.bio, o.photo_url, o.city, o.instagram, o.website, 
    o.category, o.verified, o.teaching_styles, o.gallery_urls, o.promo_video_urls
  FROM public.organisers o
  WHERE o.id = organiser_id;
$$;


ALTER FUNCTION "public"."get_public_organiser_info"("organiser_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_teacher_detail_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "first_name" "text", "surname" "text", "photo_url" "text", "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "nationality" "text", "years_teaching" integer, "teaching_styles" "text"[], "languages" "text"[], "achievements" "text"[], "faq" "text", "journey" "text", "offers_private" boolean, "availability" "text", "private_lesson_types" "text"[], "private_lesson_locations" "text"[], "private_travel_distance" numeric, "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    tp.id                              AS entity_id,
    tp.first_name,
    CASE WHEN COALESCE(tp.hide_surname, false) THEN NULL ELSE tp.surname END AS surname,
    tp.photo_url,
    tp.gallery_urls,
    tp.city_id,
    c.name                             AS city,
    tp.nationality,
    tp.years_teaching,
    tp.teaching_styles,
    tp.languages,
    tp.achievements,
    tp.faq,
    tp.journey,
    COALESCE(tp.offers_private, false) AS offers_private,
    tp.availability,
    tp.private_lesson_types,
    tp.private_lesson_locations,
    tp.private_travel_distance,
    tp.website,
    tp.instagram,
    tp.facebook,
    tp.email,
    tp.phone
  FROM public.teacher_profiles tp
  LEFT JOIN public.cities c ON c.id = tp.city_id
  WHERE tp.id = p_entity_id
    AND tp.is_active IS NOT FALSE
    AND tp.first_name IS NOT NULL AND btrim(tp.first_name) <> ''
    AND tp.photo_url  IS NOT NULL AND btrim(tp.photo_url)  <> ''
    AND tp.city_id    IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_public_teacher_detail_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_teacher_preview_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "first_name" "text", "surname" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "nationality" "text", "years_teaching" integer, "teaching_styles" "text"[], "languages" "text"[], "offers_private" boolean, "website" "text", "instagram" "text", "facebook" "text", "email" "text", "phone" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    tp.id                              AS entity_id,
    tp.first_name,
    CASE WHEN COALESCE(tp.hide_surname, false) THEN NULL ELSE tp.surname END AS surname,
    tp.photo_url,
    tp.city_id,
    c.name                             AS city,
    tp.nationality,
    tp.years_teaching,
    tp.teaching_styles,
    tp.languages,
    COALESCE(tp.offers_private, false) AS offers_private,
    tp.website,
    tp.instagram,
    tp.facebook,
    tp.email,
    tp.phone
  FROM public.teacher_profiles tp
  LEFT JOIN public.cities c ON c.id = tp.city_id
  WHERE tp.id = p_entity_id
    AND tp.is_active IS NOT FALSE
    AND tp.first_name IS NOT NULL AND btrim(tp.first_name) <> ''
    AND tp.photo_url  IS NOT NULL AND btrim(tp.photo_url)  <> ''
    AND tp.city_id    IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_public_teacher_preview_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_venue_preview_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "name" "text", "photo_url" "text"[], "gallery_urls" "text"[], "city_id" "uuid", "city" "text", "country" "text", "address" "text", "postcode" "text", "google_maps_link" "text", "capacity" integer, "floor_type" "text", "facilities_new" "text"[], "opening_hours" "jsonb", "description" "text", "faq_json" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(v.entity_id, v.id) AS entity_id,
    v.name,
    v.photo_url,
    v.gallery_urls,
    e.city_id,
    e.city,
    v.country,
    v.address,
    v.postcode,
    v.google_maps_link,
    v.capacity,
    v.floor_type,
    v.facilities_new,
    v.opening_hours,
    v.description,
    v.faq_json
  FROM public.venues v
  LEFT JOIN public.entities e ON e.id = v.entity_id
  WHERE v.id = p_entity_id OR v.entity_id = p_entity_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_public_venue_preview_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") RETURNS TABLE("entity_id" "uuid", "business_name" "text", "first_name" "text", "surname" "text", "nationality" "text", "photo_url" "text", "city_id" "uuid", "city" "text", "country" "text", "videography_styles" "text"[], "instagram" "text", "facebook" "text", "website" "text", "public_email" "text", "short_description" "text", "description" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    v.id           AS entity_id,
    v.business_name,
    v.first_name,
    v.surname,
    v.nationality,
    v.photo_url[1] AS photo_url,
    v.city_id,
    c.name         AS city,
    v.country,
    v.videography_styles,
    v.instagram,
    v.facebook,
    v.website,
    v.public_email,
    v.short_description,
    v.description
  FROM public.videographers v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_entity_id
    AND v.is_active IS NOT FALSE
    AND v.first_name IS NOT NULL AND btrim(v.first_name) <> ''
    AND v.photo_url  IS NOT NULL AND v.photo_url[1] IS NOT NULL
    AND v.city_id    IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_identity_prefill"() RETURNS TABLE("full_name" "text", "based_city_id" "uuid", "based_city_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.full_name, p.based_city_id, c.name
  FROM public.profiles p
  LEFT JOIN public.cities c ON c.id = p.based_city_id
  WHERE p.id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_identity_prefill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_participant_events"("p_user_email" "text", "p_city_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("status" "text", "event_id" "uuid", "event_name" "text", "event_date" "date", "location" "text", "cover_image_url" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_filter_slug text := lower(NULLIF(btrim(COALESCE(p_city_slug, '')), ''));
  v_filter_city_id uuid := NULL;
BEGIN
  IF v_filter_slug IS NOT NULL THEN
    SELECT c.id
      INTO v_filter_city_id
    FROM public.cities c
    WHERE lower(c.slug) = v_filter_slug
    LIMIT 1;

    IF v_filter_city_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    r.status,
    e.id,
    e.name,
    e.date,
    NULL::text AS location,
    e.poster_url
  FROM public.event_registrations r
  JOIN public.events e ON r.event_id = e.id
  WHERE r.email = p_user_email
    AND (v_filter_city_id IS NULL OR e.city_id = v_filter_city_id);
END;
$$;


ALTER FUNCTION "public"."get_user_participant_events"("p_user_email" "text", "p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_venue_detail"("p_venue_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_row public.venues%ROWTYPE;
    v_json jsonb;
    v_metadata jsonb;
    v_city_name text;
    v_city_slug text;
    v_city_id uuid;
BEGIN
    SELECT *
    INTO v_row
    FROM public.venues v
    WHERE v.id = p_venue_id;

    IF v_row IS NULL THEN
        RETURN NULL;
    END IF;

    v_json := to_jsonb(v_row);
    v_metadata := COALESCE(v_json->'meta_data', '{}'::jsonb);

    v_city_id := NULL;

    IF v_row.city_id IS NOT NULL THEN
        v_city_id := v_row.city_id;
    ELSIF (v_json->>'city_id') IS NOT NULL AND trim(v_json->>'city_id') <> '' THEN
        v_city_id := (v_json->>'city_id')::uuid;
    END IF;

    IF v_city_id IS NOT NULL THEN
        SELECT c.name, c.slug
        INTO v_city_name, v_city_slug
        FROM public.cities c
        WHERE c.id = v_city_id
        LIMIT 1;
    END IF;

    IF v_city_name IS NULL THEN
        v_city_name := NULLIF(v_json->>'city', '');
    END IF;

    RETURN jsonb_build_object(
        'id', v_json->>'id',
        'name', v_json->>'name',
        'address', v_json->>'address',
        'city', v_city_name,
        'city_slug', v_city_slug,
        'country', v_json->>'country',
        'description', COALESCE(v_json->>'description', v_metadata->>'description'),
        'photo_url', v_json->'photo_url',
        'gallery_urls', v_json->'gallery_urls',
        'floor_type', v_json->'floor_type',
        'facilities', v_json->'facilities',
        'rules', v_json->'rules',
        'faq', v_json->>'faq',
        'capacity', COALESCE(v_metadata->>'capacity', '')::text,
        'phone', COALESCE(v_metadata->>'phone', ''),
        'email', COALESCE(v_metadata->>'email', ''),
        'website', COALESCE(v_metadata->>'website', ''),
        'facebook', COALESCE(v_metadata->>'facebook', ''),
        'instagram', COALESCE(v_metadata->>'instagram', ''),
        'google_maps_url', COALESCE(v_metadata->>'google_maps_url', ''),
        'transport', COALESCE(v_metadata->>'transport', ''),
        'parking', COALESCE(v_metadata->>'parking', ''),
        'opening_hours', v_metadata->'opening_hours'
    );
END;
$$;


ALTER FUNCTION "public"."get_venue_detail"("p_venue_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_venue_events"("p_venue_id" "uuid", "p_city_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "date" "date", "is_published" boolean, "location" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_city_id uuid := NULL;
  v_city_slug_norm text := NULL;
BEGIN
  v_city_slug_norm := NULLIF(btrim(COALESCE(p_city_slug, '')), '');

  IF v_city_slug_norm IS NOT NULL THEN
    v_city_id := public.resolve_city_id(NULL, v_city_slug_norm);
    IF v_city_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.date,
    e.is_active,
    v.address AS location
  FROM public.events e
  LEFT JOIN public.venues v
    ON v.id = e.venue_id
  WHERE e.venue_id = p_venue_id
    AND e.is_active = true
    AND (
      v_city_slug_norm IS NULL
      OR e.city_id = v_city_id
    )
  ORDER BY e.date DESC
  LIMIT 10;
END;
$$;


ALTER FUNCTION "public"."get_venue_events"("p_venue_id" "uuid", "p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN

    INSERT INTO public.member_profiles (id, created_at, updated_at)
    VALUES (NEW.id, now(), now())
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_auth_user_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_dancer_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.dancer_profiles (id, profile_source, created_at, updated_at)
    VALUES (NEW.id, 'auto_stub', now(), now())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_new_dancer_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_dancer_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.dancers (
    user_id,
    first_name,
    surname,
    created_at
  )
  VALUES (
    NEW.id,
    '',
    '',
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_dancer_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idempotency_claim"("p_key" "text", "p_request_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  BEGIN
    INSERT INTO public.idempotency (key, request_hash, status, response)
    VALUES (p_key, p_request_hash, 'pending', NULL);
    RETURN TRUE;
  EXCEPTION
    WHEN unique_violation THEN
      IF EXISTS (
        SELECT 1
        FROM public.idempotency
        WHERE key = p_key
          AND request_hash = p_request_hash
          AND status = 'pending'
      ) THEN
        RETURN TRUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.idempotency
        WHERE key = p_key
          AND request_hash = p_request_hash
          AND status = 'success'
      ) THEN
        RETURN FALSE;
      END IF;

      RETURN FALSE;
  END;
END;
$$;


ALTER FUNCTION "public"."idempotency_claim"("p_key" "text", "p_request_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idempotency_get"("p_key" "text") RETURNS TABLE("key" "text", "request_hash" "text", "status" "text", "response" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    i.key,
    i.request_hash,
    i.status,
    i.response,
    i.created_at,
    i.updated_at
  FROM public.idempotency i
  WHERE i.key = p_key;
$$;


ALTER FUNCTION "public"."idempotency_get"("p_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idempotency_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."idempotency_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idempotency_store"("p_key" "text", "p_request_hash" "text", "p_status" "text", "p_response" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_status NOT IN ('pending', 'success', 'failed') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  BEGIN
    INSERT INTO public.idempotency (key, request_hash, status, response)
    VALUES (p_key, p_request_hash, p_status, p_response);
    RETURN;
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.idempotency
      SET
        request_hash = p_request_hash,
        status = p_status,
        response = p_response,
        updated_at = now()
      WHERE key = p_key
        AND (request_hash = p_request_hash OR status = 'pending');
      RETURN;
  END;
END;
$$;


ALTER FUNCTION "public"."idempotency_store"("p_key" "text", "p_request_hash" "text", "p_status" "text", "p_response" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = v_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Canonical admin truth for auth.uid(), derived only from public.admin_users.';



CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN true;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_super_users s
    WHERE s.user_id = p_user_id
      AND s.is_active = true
  );
END;
$$;


ALTER FUNCTION "public"."is_super_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_city_slug"("p_slug" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.slug = lower(trim(COALESCE(p_slug, '')))
      AND c.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_valid_city_slug"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_to" timestamp with time zone DEFAULT ("now"() + '180 days'::interval), "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_venue_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS SETOF "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT *
  FROM public.admin_dashboard_events_list_v1(
    p_from,
    p_to,
    p_city_id,
    p_venue_id,
    p_limit,
    p_offset
  );
$$;


ALTER FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid", "p_limit" integer, "p_offset" integer) IS 'Deprecated wrapper. Delegates to admin_dashboard_events_list_v1.';



CREATE OR REPLACE FUNCTION "public"."member_profiles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."member_profiles_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_event_instances"("p_instances" "jsonb", "p_event_row" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
/*
Conservative normalizer for events.instances.

Behavior:
- p_instances NULL -> returns '[]'::jsonb
- p_instances the empty array [] -> returns '[]'::jsonb
- p_instances not an array -> returns '[]'::jsonb
- Each array element must be an object; non-objects are skipped.
- Ensures each instance has:
  - id (uuid text). If missing, generates a UUID using gen_random_uuid().
  - starts_at (timestamptz). REQUIRED. If missing, attempts derivation from
    p_event_row->>'date' + p_event_row->>'start_time' only if both present;
    otherwise raises an exception.
  - ends_at (timestamptz). If missing, defaults to starts_at + interval '1 hour'.
  - timezone: preserved if provided; if missing, set to COALESCE(p_event_row->>'timezone','UTC')
  - is_exception: preserved if provided; default false
- Preserves additional keys.
- Deduplicates by id (first occurrence wins).
- Returns normalized jsonb array sorted by starts_at asc then id.
*/
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_tz text;
  v_is_exception boolean;
  v_seen_ids text[];
  v_elem record;
  v_default_tz text := 'UTC';
  v_derived_start text;
  v_event_date text;
  v_event_start_time text;
  v_tmp jsonb;
BEGIN
  -- Null => empty array
  IF p_instances IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Preserve explicit empty array
  IF jsonb_typeof(p_instances) = 'array' AND jsonb_array_length(p_instances) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Must be array; otherwise return empty array
  IF jsonb_typeof(p_instances) IS DISTINCT FROM 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_seen_ids := ARRAY[]::text[];

  -- Optional derivation source
  IF p_event_row IS NOT NULL THEN
    v_event_date := NULLIF(p_event_row->>'date', '');
    v_event_start_time := NULLIF(p_event_row->>'start_time', '');
  END IF;

  FOR v_elem IN
    SELECT elem
    FROM jsonb_array_elements(p_instances) AS t(elem)
  LOOP
    v_item := v_elem.elem;

    -- Skip non-object elements
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      CONTINUE;
    END IF;

    -- id: use provided or generate
    v_id := COALESCE(NULLIF(v_item->>'id', ''), gen_random_uuid()::text);

    -- Skip duplicate ids (first wins)
    IF v_id = ANY(v_seen_ids) THEN
      CONTINUE;
    END IF;

    -- timezone fallback
    v_tz := COALESCE(
      NULLIF(v_item->>'timezone', ''),
      COALESCE(NULLIF(p_event_row->>'timezone', ''), v_default_tz)
    );

    -- starts_at: required
    IF (v_item ? 'starts_at')
       AND v_item->>'starts_at' IS NOT NULL
       AND trim(v_item->>'starts_at') <> '' THEN
      BEGIN
        v_starts_at := (v_item->>'starts_at')::timestamptz;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION
          'normalize_event_instances: invalid starts_at value for instance id %: %',
          v_id, v_item->>'starts_at';
      END;
    ELSE
      -- Attempt derivation from event row
      IF v_event_date IS NOT NULL AND v_event_start_time IS NOT NULL THEN
        v_derived_start := v_event_date || ' ' || v_event_start_time;
        BEGIN
          v_starts_at := v_derived_start::timestamptz;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION
            'normalize_event_instances: cannot derive starts_at for instance id % (derived value % invalid)',
            v_id, v_derived_start;
        END;
      ELSE
        RAISE EXCEPTION
          'normalize_event_instances: starts_at missing for instance id % and cannot be derived',
          v_id;
      END IF;
    END IF;

    -- ends_at: prefer provided else default to +1 hour
    IF (v_item ? 'ends_at')
       AND v_item->>'ends_at' IS NOT NULL
       AND trim(v_item->>'ends_at') <> '' THEN
      BEGIN
        v_ends_at := (v_item->>'ends_at')::timestamptz;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION
          'normalize_event_instances: invalid ends_at value for instance id %: %',
          v_id, v_item->>'ends_at';
      END;
    ELSE
      v_ends_at := v_starts_at + INTERVAL '1 hour';
    END IF;

    -- is_exception: preserve boolean if provided, else default false
    IF v_item ? 'is_exception' THEN
      BEGIN
        v_is_exception := (v_item->>'is_exception')::boolean;
      EXCEPTION WHEN others THEN
        v_is_exception := false;
      END;
    ELSE
      v_is_exception := false;
    END IF;

    -- Build normalized object, preserving extra keys
    v_tmp := jsonb_strip_nulls(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              v_item,
              '{id}',
              to_jsonb(v_id::text),
              true
            ),
            '{starts_at}',
            to_jsonb(to_char(v_starts_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')::text),
            true
          ),
          '{ends_at}',
          to_jsonb(to_char(v_ends_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')::text),
          true
        ),
        '{timezone}',
        to_jsonb(v_tz),
        true
      )
    );

    -- Ensure is_exception explicit boolean present
    v_tmp := jsonb_set(v_tmp, '{is_exception}', to_jsonb(v_is_exception), true);

    -- Append to output array
    v_out := v_out || jsonb_build_array(v_tmp);

    -- Mark id as seen
    v_seen_ids := array_append(v_seen_ids, v_id);
  END LOOP;

  -- Return sorted array; if zero valid rows, return []
  RETURN COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM (
          SELECT jsonb_array_elements(v_out) AS elem
        ) s
        ORDER BY ((elem->>'starts_at')::timestamptz) ASC, (elem->>'id')::text ASC
      ) sorted
    ),
    '[]'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."normalize_event_instances"("p_instances" "jsonb", "p_event_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_advisory_lock_event"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  SELECT pg_advisory_lock(uuid_to_bigint(p_event_id));
$$;


ALTER FUNCTION "public"."pg_advisory_lock_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_advisory_unlock_event"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    AS $$
  SELECT pg_advisory_unlock(uuid_to_bigint(p_event_id));
$$;


ALTER FUNCTION "public"."pg_advisory_unlock_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_try_advisory_lock_event"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    AS $$
  SELECT pg_try_advisory_lock(uuid_to_bigint(p_event_id));
$$;


ALTER FUNCTION "public"."pg_try_advisory_lock_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_event_venue_to_future_occurrences"("_event_id" "uuid", "_from_occurrence_id" "uuid", "_new_venue_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_from_start timestamptz;
  v_updated integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = _event_id
  ) THEN
    RAISE EXCEPTION 'Event % not found', _event_id;
  END IF;

  SELECT instance_start
  INTO v_from_start
  FROM public.calendar_occurrences
  WHERE id = _from_occurrence_id;

  IF v_from_start IS NULL THEN
    RAISE EXCEPTION 'Occurrence % not found', _from_occurrence_id;
  END IF;

  UPDATE public.calendar_occurrences
  SET venue_id = _new_venue_id
  WHERE event_id = _event_id
    AND instance_start > v_from_start;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."propagate_event_venue_to_future_occurrences"("_event_id" "uuid", "_from_occurrence_id" "uuid", "_new_venue_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quarantine_invalid_occurrence"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  invalid boolean;
  why text := NULL;
BEGIN
  invalid := (NEW.instance_end IS NOT NULL AND NEW.instance_start IS NOT NULL AND NEW.instance_end < NEW.instance_start)
             OR NEW.instance_start IS NULL; -- required bound missing

  IF invalid THEN
    why := CASE
      WHEN NEW.instance_start IS NULL THEN 'missing_instance_start'
      WHEN NEW.instance_end IS NOT NULL AND NEW.instance_end < NEW.instance_start THEN 'end_before_start'
      ELSE 'invalid_bounds'
    END;

    INSERT INTO public.calendar_occurrence_quarantine(occurrence_id, event_id, reason, payload)
    VALUES (NEW.id, NEW.event_id, why, to_jsonb(NEW));

    RETURN NULL; -- cancel the write
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."quarantine_invalid_occurrence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_city_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  UPDATE public.city_requests
  SET status = 'rejected'
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_request_not_found_or_not_pending';
  END IF;
END;
$$;


ALTER FUNCTION "public"."reject_city_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    v_tracks       jsonb := p_meta_data->'tracks';
    v_program      jsonb := p_meta_data->'program';
    v_track        jsonb;
    v_item         jsonb;
    v_legacy_id    text;
    v_new_track_id uuid;
    v_new_item_id  uuid;
    v_track_map    jsonb    := '{}'::jsonb;  -- legacy_id → new relational uuid
    v_sort_order   integer  := 0;
    v_title        text;
    v_resolved_track_legacy text;
BEGIN
    -- Guard: partial payload saves that don't carry program data must not
    -- disturb existing relational rows.
    IF NOT (p_meta_data ? 'tracks') AND NOT (p_meta_data ? 'program') THEN
        RETURN;
    END IF;

    -- ── 1. Delete existing rows — child-first FK order ────────────────────
    DELETE FROM public.event_program_djs
    WHERE program_item_id IN (
        SELECT id FROM public.event_program_items WHERE event_id = p_event_id
    );

    DELETE FROM public.event_program_instructors
    WHERE program_item_id IN (
        SELECT id FROM public.event_program_items WHERE event_id = p_event_id
    );

    DELETE FROM public.event_program_items WHERE event_id = p_event_id;
    DELETE FROM public.event_tracks          WHERE event_id = p_event_id;

    -- ── 2. Reinsert event_tracks ──────────────────────────────────────────
    IF v_tracks IS NOT NULL AND jsonb_typeof(v_tracks) = 'array' THEN
        v_sort_order := 0;
        FOR v_track IN SELECT value FROM jsonb_array_elements(v_tracks) LOOP
            -- Skip element if it is not an object or has no id
            CONTINUE WHEN jsonb_typeof(v_track) <> 'object';
            v_legacy_id := NULLIF(BTRIM(COALESCE(v_track->>'id', '')), '');
            CONTINUE WHEN v_legacy_id IS NULL;

            INSERT INTO public.event_tracks (
                event_id, legacy_id, name, color, description, sort_order
            ) VALUES (
                p_event_id,
                v_legacy_id,
                COALESCE(NULLIF(BTRIM(v_track->>'name'), ''), ''),
                NULLIF(BTRIM(COALESCE(v_track->>'color', '')), ''),
                NULLIF(BTRIM(COALESCE(v_track->>'description', '')), ''),
                v_sort_order
            )
            RETURNING id INTO v_new_track_id;

            -- Accumulate legacy → relational UUID mapping
            v_track_map    := v_track_map || jsonb_build_object(v_legacy_id, v_new_track_id::text);
            v_sort_order   := v_sort_order + 1;
        END LOOP;
    END IF;

    -- ── 3. Reinsert event_program_items ───────────────────────────────────
    IF v_program IS NOT NULL AND jsonb_typeof(v_program) = 'array' THEN
        v_sort_order := 0;
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_program) LOOP
            -- Skip non-object elements
            CONTINUE WHEN jsonb_typeof(v_item) <> 'object';

            -- Skip items with no id
            v_legacy_id := NULLIF(BTRIM(COALESCE(v_item->>'id', '')), '');
            CONTINUE WHEN v_legacy_id IS NULL;

            -- Skip items with null or blank title
            v_title := NULLIF(BTRIM(COALESCE(v_item->>'title', '')), '');
            CONTINUE WHEN v_title IS NULL;

            -- Resolve legacy track_id → relational uuid.
            -- NULL is safe: FK column allows NULL.
            v_resolved_track_legacy := NULLIF(BTRIM(COALESCE(v_item->>'track_id', '')), '');
            v_new_track_id := CASE
                WHEN v_resolved_track_legacy IS NOT NULL
                     AND v_track_map ? v_resolved_track_legacy
                THEN (v_track_map->>v_resolved_track_legacy)::uuid
                ELSE NULL
            END;

            INSERT INTO public.event_program_items (
                event_id, track_id, legacy_id,
                day, start_time, end_time,
                title, type, room, description,
                sort_order
            ) VALUES (
                p_event_id,
                v_new_track_id,
                v_legacy_id,
                -- day: ISO date string e.g. "2026-05-01"
                NULLIF(BTRIM(COALESCE(v_item->>'day',  '')), ''),
                -- start_time / end_time: full ISO datetime from frontend
                -- e.g. "2026-05-01T10:00:00" — cast to match live timestamptz columns
                NULLIF(BTRIM(COALESCE(v_item->>'start_time', '')), '')::timestamptz,
                NULLIF(BTRIM(COALESCE(v_item->>'end_time',   '')), '')::timestamptz,
                v_title,
                -- type: fallback to 'other' so column is never null
                COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'type', '')), ''), 'other'),
                NULLIF(BTRIM(COALESCE(v_item->>'room',        '')), ''),
                NULLIF(BTRIM(COALESCE(v_item->>'description', '')), ''),
                v_sort_order
            )
            RETURNING id INTO v_new_item_id;

            -- ── 4. Reinsert event_program_instructors ──────────────────
            IF (v_item ? 'instructor_ids')
               AND jsonb_typeof(v_item->'instructor_ids') = 'array' THEN
                INSERT INTO public.event_program_instructors (program_item_id, profile_id)
                SELECT
                    v_new_item_id,
                    NULLIF(BTRIM(trim(both '"' from elem::text)), '')::uuid
                FROM jsonb_array_elements(v_item->'instructor_ids') AS elem
                WHERE -- element is a valid non-empty UUID string
                      NULLIF(BTRIM(trim(both '"' from elem::text)), '') IS NOT NULL
                  AND NULLIF(BTRIM(trim(both '"' from elem::text)), '') ~*
                      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                ON CONFLICT (program_item_id, profile_id) DO NOTHING;
            END IF;

            -- ── 5. Reinsert event_program_djs ──────────────────────────
            IF (v_item ? 'dj_ids')
               AND jsonb_typeof(v_item->'dj_ids') = 'array' THEN
                INSERT INTO public.event_program_djs (program_item_id, profile_id)
                SELECT
                    v_new_item_id,
                    NULLIF(BTRIM(trim(both '"' from elem::text)), '')::uuid
                FROM jsonb_array_elements(v_item->'dj_ids') AS elem
                WHERE NULLIF(BTRIM(trim(both '"' from elem::text)), '') IS NOT NULL
                  AND NULLIF(BTRIM(trim(both '"' from elem::text)), '') ~*
                      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                ON CONFLICT (program_item_id, profile_id) DO NOTHING;
            END IF;

            v_sort_order := v_sort_order + 1;
        END LOOP;
    END IF;
END;
$_$;


ALTER FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_or_patch_guest_dancers"("p_event_id" "uuid", "p_guest_dancers" "jsonb", "p_replace" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_item jsonb; BEGIN
  IF p_replace THEN
    UPDATE public.event_profile_links epl
       SET status='archived', archived_at=now(), archived_by=auth.uid()
     WHERE epl.event_id = p_event_id AND epl.role = 'dancer' AND epl.status='active' AND epl.archived_at IS NULL;
    IF p_guest_dancers IS NOT NULL THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_guest_dancers) LOOP
        IF NOT (v_item ? 'profile_id') THEN RAISE EXCEPTION 'guest_dancer item requires profile_id'; END IF;
        PERFORM public._upsert_link(p_event_id, (v_item->>'profile_id')::uuid, 'dancer', COALESCE((v_item->>'is_primary')::boolean, false), COALESCE(NULLIF(v_item->>'source',''),'manual'), CASE WHEN v_item ? 'occurrence_id' THEN NULLIF(v_item->>'occurrence_id','')::uuid ELSE NULL END);
      END LOOP;
    END IF;
  ELSIF p_guest_dancers IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_guest_dancers) LOOP
      IF NOT (v_item ? 'profile_id') THEN RAISE EXCEPTION 'guest_dancer item requires profile_id'; END IF;
      PERFORM public._upsert_link(p_event_id, (v_item->>'profile_id')::uuid, 'dancer', COALESCE((v_item->>'is_primary')::boolean, false), COALESCE(NULLIF(v_item->>'source',''),'manual'), CASE WHEN v_item ? 'occurrence_id' THEN NULLIF(v_item->>'occurrence_id','')::uuid ELSE NULL END);
    END LOOP;
  END IF;
END; $$;


ALTER FUNCTION "public"."replace_or_patch_guest_dancers"("p_event_id" "uuid", "p_guest_dancers" "jsonb", "p_replace" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_or_patch_lineup"("p_event_id" "uuid", "p_lineup" "jsonb", "p_replace" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_item jsonb;
BEGIN
  IF p_replace THEN
    UPDATE public.event_profile_links epl
       SET status = 'archived', archived_at = now(), archived_by = auth.uid()
     WHERE epl.event_id = p_event_id
       AND epl.role IN ('teacher', 'dj', 'vendor', 'videographer', 'hosting', 'performing')
       AND epl.status = 'active'
       AND epl.archived_at IS NULL;

    IF p_lineup IS NOT NULL THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineup) LOOP
        IF NOT (v_item ? 'profile_id') THEN
          RAISE EXCEPTION 'lineup item requires profile_id';
        END IF;
        IF NOT (v_item ? 'role') THEN
          RAISE EXCEPTION 'lineup item requires role';
        END IF;
        IF (v_item->>'role') NOT IN ('teacher', 'dj', 'vendor', 'videographer', 'hosting', 'performing') THEN
          RAISE EXCEPTION 'lineup role must be one of teacher,dj,vendor,videographer,hosting,performing';
        END IF;
        PERFORM public._upsert_link(
          p_event_id,
          (v_item->>'profile_id')::uuid,
          (v_item->>'role'),
          COALESCE((v_item->>'is_primary')::boolean, false),
          COALESCE(NULLIF(v_item->>'source', ''), 'manual'),
          CASE WHEN v_item ? 'occurrence_id' THEN NULLIF(v_item->>'occurrence_id', '')::uuid ELSE NULL END
        );
      END LOOP;
    END IF;

  ELSIF p_lineup IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_lineup) LOOP
      IF NOT (v_item ? 'profile_id') THEN
        RAISE EXCEPTION 'lineup item requires profile_id';
      END IF;
      IF NOT (v_item ? 'role') THEN
        RAISE EXCEPTION 'lineup item requires role';
      END IF;
      IF (v_item->>'role') NOT IN ('teacher', 'dj', 'vendor', 'videographer', 'hosting', 'performing') THEN
        RAISE EXCEPTION 'lineup role must be one of teacher,dj,vendor,videographer,hosting,performing';
      END IF;
      PERFORM public._upsert_link(
        p_event_id,
        (v_item->>'profile_id')::uuid,
        (v_item->>'role'),
        COALESCE((v_item->>'is_primary')::boolean, false),
        COALESCE(NULLIF(v_item->>'source', ''), 'manual'),
        CASE WHEN v_item ? 'occurrence_id' THEN NULLIF(v_item->>'occurrence_id', '')::uuid ELSE NULL END
      );
    END LOOP;
  END IF;
END;
$$;


ALTER FUNCTION "public"."replace_or_patch_lineup"("p_event_id" "uuid", "p_lineup" "jsonb", "p_replace" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_or_patch_occurrences"("p_event_id" "uuid", "p_occurrences" "jsonb", "p_replace" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  occ jsonb;
  v_occ_id uuid;
  v_touched_ids uuid[] := ARRAY[]::uuid[];
  v_has_city_slug boolean := false;
  v_has_city_id boolean := false;
  v_occurrence_count integer := 0;
BEGIN
  IF p_occurrences IS NOT NULL AND jsonb_typeof(p_occurrences) = 'array' THEN
    v_occurrence_count := jsonb_array_length(p_occurrences);

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_occurrences) AS e(value)
      WHERE jsonb_typeof(e.value) = 'object'
        AND NULLIF(BTRIM(COALESCE(e.value->>'city_slug', '')), '') IS NOT NULL
    )
    INTO v_has_city_slug;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_occurrences) AS e(value)
      WHERE jsonb_typeof(e.value) = 'object'
        AND NULLIF(e.value->>'city_id', '') IS NOT NULL
    )
    INTO v_has_city_id;
  END IF;

  INSERT INTO public.phase4_tmp_occurrence_write_city_compat_audit (
    function_name,
    event_id,
    auth_uid,
    jwt_sub,
    jwt_role,
    has_city_slug,
    has_city_id,
    replace_mode,
    occurrence_count
  )
  VALUES (
    'replace_or_patch_occurrences',
    p_event_id,
    auth.uid(),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.role', true),
    v_has_city_slug,
    v_has_city_id,
    p_replace,
    v_occurrence_count
  );

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'replace_or_patch_occurrences: p_event_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id) THEN
    RAISE EXCEPTION 'replace_or_patch_occurrences: p_event_id % does not exist in events', p_event_id;
  END IF;

  IF p_occurrences IS NULL THEN
    IF p_replace THEN
      DELETE FROM public.calendar_occurrences WHERE event_id = p_event_id;
    END IF;
    RETURN p_event_id;
  END IF;

  IF jsonb_typeof(p_occurrences) <> 'array' THEN
    RAISE EXCEPTION 'replace_or_patch_occurrences: p_occurrences must be a jsonb array';
  END IF;

  FOR occ IN SELECT value FROM jsonb_array_elements(p_occurrences)
  LOOP
    IF occ IS NULL OR jsonb_typeof(occ) <> 'object' THEN
      RAISE EXCEPTION 'replace_or_patch_occurrences: each occurrence must be a jsonb object';
    END IF;

    IF NULLIF(BTRIM(COALESCE(occ->>'city_slug', '')), '') IS NOT NULL
       AND NULLIF(occ->>'city_id', '') IS NULL
       AND NULLIF(occ->>'venue_id', '') IS NULL THEN
      RAISE EXCEPTION 'city_slug_retired_use_city_id' USING ERRCODE = 'P0001';
    END IF;

    IF NULLIF(occ->>'id', '') IS NOT NULL THEN
      v_occ_id := (occ->>'id')::uuid;

      INSERT INTO public.calendar_occurrences AS co (
        id,event_id,instance_start,instance_end,lifecycle_status,venue_id,city_id,city_slug,source,is_override,override_payload,created_at,updated_at
      ) VALUES (
        v_occ_id,p_event_id,NULLIF(occ->>'instance_start','')::timestamptz,NULLIF(occ->>'instance_end','')::timestamptz,
        COALESCE(NULLIF(occ->>'lifecycle_status',''),'draft'),
        NULLIF(occ->>'venue_id','')::uuid,
        CASE
          WHEN NULLIF(occ->>'venue_id','')::uuid IS NOT NULL THEN (
            SELECT en.city_id
            FROM public.venues vv
            JOIN public.entities en ON en.id = vv.entity_id
            WHERE vv.id = NULLIF(occ->>'venue_id','')::uuid
            LIMIT 1
          )
          ELSE NULLIF(occ->>'city_id','')::uuid
        END,
        CASE
          WHEN NULLIF(occ->>'venue_id','')::uuid IS NOT NULL THEN (
            SELECT c.slug
            FROM public.venues vv
            JOIN public.entities en ON en.id = vv.entity_id
            LEFT JOIN public.cities c ON c.id = en.city_id
            WHERE vv.id = NULLIF(occ->>'venue_id','')::uuid
            LIMIT 1
          )
          WHEN NULLIF(occ->>'city_id','')::uuid IS NOT NULL THEN (
            SELECT c.slug
            FROM public.cities c
            WHERE c.id = NULLIF(occ->>'city_id','')::uuid
            LIMIT 1
          )
          ELSE NULL
        END,
        COALESCE(NULLIF(occ->>'source',''),'auto'),COALESCE((occ->>'is_override')::boolean,false),occ->'override_payload',now(),now()
      ) ON CONFLICT (id) DO UPDATE SET
        instance_start=EXCLUDED.instance_start,instance_end=EXCLUDED.instance_end,lifecycle_status=EXCLUDED.lifecycle_status,venue_id=EXCLUDED.venue_id,
        city_id=EXCLUDED.city_id,city_slug=EXCLUDED.city_slug,source=EXCLUDED.source,is_override=EXCLUDED.is_override,override_payload=EXCLUDED.override_payload,updated_at=now()
      WHERE co.event_id = p_event_id
      RETURNING co.id INTO v_occ_id;

      IF v_occ_id IS NULL THEN
        RAISE EXCEPTION 'replace_or_patch_occurrences: occurrence id % does not belong to event %', (occ->>'id'), p_event_id;
      END IF;

      v_touched_ids := array_append(v_touched_ids, v_occ_id);
    ELSE
      INSERT INTO public.calendar_occurrences AS co (
        id,event_id,instance_start,instance_end,lifecycle_status,venue_id,city_id,city_slug,source,is_override,override_payload,created_at,updated_at
      ) VALUES (
        gen_random_uuid(),p_event_id,NULLIF(occ->>'instance_start','')::timestamptz,NULLIF(occ->>'instance_end','')::timestamptz,
        COALESCE(NULLIF(occ->>'lifecycle_status',''),'draft'),
        NULLIF(occ->>'venue_id','')::uuid,
        CASE
          WHEN NULLIF(occ->>'venue_id','')::uuid IS NOT NULL THEN (
            SELECT en.city_id
            FROM public.venues vv
            JOIN public.entities en ON en.id = vv.entity_id
            WHERE vv.id = NULLIF(occ->>'venue_id','')::uuid
            LIMIT 1
          )
          ELSE NULLIF(occ->>'city_id','')::uuid
        END,
        CASE
          WHEN NULLIF(occ->>'venue_id','')::uuid IS NOT NULL THEN (
            SELECT c.slug
            FROM public.venues vv
            JOIN public.entities en ON en.id = vv.entity_id
            LEFT JOIN public.cities c ON c.id = en.city_id
            WHERE vv.id = NULLIF(occ->>'venue_id','')::uuid
            LIMIT 1
          )
          WHEN NULLIF(occ->>'city_id','')::uuid IS NOT NULL THEN (
            SELECT c.slug
            FROM public.cities c
            WHERE c.id = NULLIF(occ->>'city_id','')::uuid
            LIMIT 1
          )
          ELSE NULL
        END,
        COALESCE(NULLIF(occ->>'source',''),'auto'),COALESCE((occ->>'is_override')::boolean,false),occ->'override_payload',now(),now()
      ) RETURNING co.id INTO v_occ_id;

      v_touched_ids := array_append(v_touched_ids, v_occ_id);
    END IF;
  END LOOP;

  IF p_replace THEN
    DELETE FROM public.calendar_occurrences WHERE event_id = p_event_id AND NOT (id = ANY(v_touched_ids));
  END IF;

  RETURN p_event_id;
END;
$$;


ALTER FUNCTION "public"."replace_or_patch_occurrences"("p_event_id" "uuid", "p_occurrences" "jsonb", "p_replace" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_or_patch_organisers"("p_event_id" "uuid", "p_organisers" "jsonb", "p_replace" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_item jsonb;
  v_entity_id uuid;
  v_is_organiser boolean;
BEGIN
  IF p_replace THEN
    DELETE FROM public.event_entities ee
    WHERE ee.event_id = p_event_id AND ee.role = 'organiser';

    IF p_organisers IS NOT NULL THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_organisers) LOOP
        IF NOT (v_item ? 'entity_id') THEN
          RAISE EXCEPTION 'organiser item requires entity_id';
        END IF;

        v_entity_id := NULLIF(v_item->>'entity_id','')::uuid;
        IF v_entity_id IS NULL THEN
          RAISE EXCEPTION 'organiser item has invalid or empty entity_id';
        END IF;

        SELECT (e.type = 'organiser') INTO v_is_organiser
        FROM public.entities e
        WHERE e.id = v_entity_id;

        IF v_is_organiser IS NULL THEN
          RAISE EXCEPTION 'organiser entity_id % does not exist in public.entities', v_entity_id;
        ELSIF v_is_organiser IS FALSE THEN
          RAISE EXCEPTION 'entity % is not of type organiser', v_entity_id;
        END IF;

        INSERT INTO public.event_entities (event_id, entity_id, role)
        VALUES (p_event_id, v_entity_id, 'organiser');
      END LOOP;
    END IF;

  ELSIF p_organisers IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_organisers) LOOP
      IF NOT (v_item ? 'entity_id') THEN
        RAISE EXCEPTION 'organiser item requires entity_id';
      END IF;

      v_entity_id := NULLIF(v_item->>'entity_id','')::uuid;
      IF v_entity_id IS NULL THEN
        RAISE EXCEPTION 'organiser item has invalid or empty entity_id';
      END IF;

      SELECT (e.type = 'organiser') INTO v_is_organiser
      FROM public.entities e
      WHERE e.id = v_entity_id;

      IF v_is_organiser IS NULL THEN
        RAISE EXCEPTION 'organiser entity_id % does not exist in public.entities', v_entity_id;
      ELSIF v_is_organiser IS FALSE THEN
        RAISE EXCEPTION 'entity % is not of type organiser', v_entity_id;
      END IF;

      INSERT INTO public.event_entities (event_id, entity_id, role)
      SELECT p_event_id, v_entity_id, 'organiser'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.event_entities ee
        WHERE ee.event_id = p_event_id
          AND ee.entity_id = v_entity_id
          AND ee.role = 'organiser'
      );
    END LOOP;
  END IF;
END;
$$;


ALTER FUNCTION "public"."replace_or_patch_organisers"("p_event_id" "uuid", "p_organisers" "jsonb", "p_replace" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_city_id"("p_city" "text" DEFAULT NULL::"text", "p_city_slug" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id
  FROM public.cities c
  WHERE c.is_active = true
    AND (
      (p_city_slug IS NOT NULL AND lower(trim(p_city_slug)) <> '' AND c.slug = lower(trim(p_city_slug)))
      OR (
        p_city IS NOT NULL
        AND lower(trim(p_city)) <> ''
        AND (
          lower(c.name) = lower(trim(p_city))
          OR EXISTS (
            SELECT 1
            FROM public.city_aliases ca
            WHERE ca.city_id = c.id
              AND ca.normalized_alias = lower(trim(p_city))
          )
        )
      )
    )
  ORDER BY
    CASE WHEN p_city_slug IS NOT NULL AND lower(trim(p_city_slug)) <> '' AND c.slug = lower(trim(p_city_slug)) THEN 0 ELSE 1 END,
    c.name
  LIMIT 1;
$$;


ALTER FUNCTION "public"."resolve_city_id"("p_city" "text", "p_city_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_guest_assignments"("p_event_id" "uuid", "p_timezone" "text", "p_assignments" "jsonb") RETURNS TABLE("guest_profile_id" "uuid", "occurrence_id" "uuid", "role" "text")
    LANGUAGE "plpgsql" STRICT SECURITY DEFINER
    AS $$
DECLARE
  a jsonb;
  v_date date;
  v_role text;
  v_guest uuid;
BEGIN
  FOR a IN SELECT jsonb_array_elements(COALESCE(p_assignments, '[]'::jsonb)) LOOP
    v_guest := (a->>'guest_profile_id')::uuid;
    v_role := COALESCE(a->>'role','guest');
    v_date := (a->>'date')::date;

    RETURN QUERY
    SELECT v_guest,
           co.id AS occurrence_id,
           v_role
    FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id
      AND (co.instance_start AT TIME ZONE p_timezone)::date = v_date;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."resolve_guest_assignments"("p_event_id" "uuid", "p_timezone" "text", "p_assignments" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_event_core"("p_event_id" "uuid", "p_event_core" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_event_core IS NULL THEN RETURN; END IF;
  PERFORM 1 FROM jsonb_object_keys(p_event_core) k
   WHERE k NOT IN (
      'name','description','venue_id','city_id','poster_url','lifecycle_status','is_active',
      'start_time','end_time','ticket_url','instagram_url','facebook_url','website',
      'pricing','key_times','faq','meta_data','type'
   ) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'apply.event_core contains unsupported columns';
  END IF;

  IF p_event_core ? 'name' THEN UPDATE public.events SET name = (p_event_core->>'name') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'description' THEN UPDATE public.events SET description = (p_event_core->>'description') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'venue_id' THEN UPDATE public.events SET venue_id = ((p_event_core->>'venue_id')::uuid) WHERE id = p_event_id; END IF;
  IF p_event_core ? 'city_id' THEN UPDATE public.events SET city_id = ((p_event_core->>'city_id')::uuid) WHERE id = p_event_id; END IF;
  IF p_event_core ? 'poster_url' THEN UPDATE public.events SET poster_url = (p_event_core->>'poster_url') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'lifecycle_status' THEN UPDATE public.events SET lifecycle_status = (p_event_core->>'lifecycle_status') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'is_active' THEN UPDATE public.events SET is_active = ((p_event_core->>'is_active')::boolean) WHERE id = p_event_id; END IF;
  IF p_event_core ? 'start_time' THEN UPDATE public.events SET start_time = ((p_event_core->>'start_time')::timestamptz) WHERE id = p_event_id; END IF;
  IF p_event_core ? 'end_time' THEN UPDATE public.events SET end_time = ((p_event_core->>'end_time')::timestamptz) WHERE id = p_event_id; END IF;
  IF p_event_core ? 'ticket_url' THEN UPDATE public.events SET ticket_url = (p_event_core->>'ticket_url') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'instagram_url' THEN UPDATE public.events SET instagram_url = (p_event_core->>'instagram_url') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'facebook_url' THEN UPDATE public.events SET facebook_url = (p_event_core->>'facebook_url') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'website' THEN UPDATE public.events SET website = (p_event_core->>'website') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'pricing' THEN UPDATE public.events SET pricing = (p_event_core->'pricing') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'key_times' THEN UPDATE public.events SET key_times = (p_event_core->'key_times') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'faq' THEN UPDATE public.events SET faq = (p_event_core->>'faq') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'meta_data' THEN UPDATE public.events SET meta_data = (p_event_core->'meta_data') WHERE id = p_event_id; END IF;
  IF p_event_core ? 'type' THEN UPDATE public.events SET type = (p_event_core->>'type') WHERE id = p_event_id; END IF;
END;
$$;


ALTER FUNCTION "public"."save_event_core"("p_event_id" "uuid", "p_event_core" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_cities"("p_query" "text", "p_limit" integer DEFAULT 20) RETURNS TABLE("city_id" "uuid", "city_name" "text", "city_slug" "text", "country_name" "text", "display_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$WITH q AS (
    SELECT lower(trim(COALESCE(p_query, ''))) AS term
  )
  SELECT
    c.id AS city_id,
    c.name AS city_name,
    c.slug AS city_slug,
    co.name AS country_name,
    c.name AS display_name
  FROM public.cities c
  JOIN public.countries co ON co.code = c.country_code
  CROSS JOIN q
  WHERE c.is_active = true
    AND (
      q.term = ''
      OR lower(c.name) LIKE q.term || '%'
      OR EXISTS (
        SELECT 1
        FROM public.city_aliases ca
        WHERE ca.city_id = c.id
          AND ca.normalized_alias LIKE q.term || '%'
      )
    )
ORDER BY
  CASE WHEN lower(c.name) = q.term THEN 0 ELSE 1 END,
  CASE WHEN lower(c.name) LIKE q.term || '%' THEN 0 ELSE 1 END,
  CASE WHEN c.country_code = 'GB' THEN 0 ELSE 1 END,
  c.population DESC,
  c.name
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);$$;


ALTER FUNCTION "public"."search_cities"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurrence_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'going'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_attendance_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'interested'::"text", 'not_going'::"text"])))
);


ALTER TABLE "public"."event_attendance" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attendance"("p_event_id" "uuid", "p_status" "text" DEFAULT NULL::"text") RETURNS "public"."event_attendance"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized_status text;
  v_occurrence_id uuid;
  v_row public.event_attendance;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required' USING ERRCODE = '22023';
  END IF;

  -- Choose next upcoming occurrence for the event; fallback most recent past
  SELECT id INTO v_occurrence_id
  FROM public.calendar_occurrences
  WHERE event_id = p_event_id AND instance_start >= now()
  ORDER BY instance_start ASC
  LIMIT 1;

  IF v_occurrence_id IS NULL THEN
    SELECT id INTO v_occurrence_id
    FROM public.calendar_occurrences
    WHERE event_id = p_event_id
    ORDER BY instance_start DESC
    LIMIT 1;
  END IF;

  IF v_occurrence_id IS NULL THEN
    RAISE EXCEPTION 'No occurrences found for event %', p_event_id;
  END IF;

  IF p_status IS NULL THEN
    DELETE FROM public.event_attendance
    WHERE occurrence_id = v_occurrence_id AND user_id = v_user_id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  v_normalized_status := lower(btrim(p_status));
  IF v_normalized_status NOT IN ('interested', 'going', 'not_going') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', p_status USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_attendance (occurrence_id, user_id, status, updated_at)
  VALUES (v_occurrence_id, v_user_id, v_normalized_status, now())
  ON CONFLICT (occurrence_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."set_attendance"("p_event_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_calendar_occurrence_venue"("_occurrence_id" "uuid", "_venue_id" "uuid", "_propagate" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists boolean;
  v_event_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_occurrences
    WHERE id = _occurrence_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Occurrence % not found', _occurrence_id;
  END IF;

  IF _venue_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.venues
      WHERE id = _venue_id
    )
    INTO v_exists;

    IF NOT v_exists THEN
      RAISE EXCEPTION 'Venue % not found', _venue_id;
    END IF;
  END IF;

  UPDATE public.calendar_occurrences
  SET venue_id = _venue_id
  WHERE id = _occurrence_id;

  IF _propagate THEN
    SELECT event_id
    INTO v_event_id
    FROM public.calendar_occurrences
    WHERE id = _occurrence_id;

    PERFORM public.propagate_event_venue_to_future_occurrences(
      v_event_id,
      _occurrence_id,
      _venue_id
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."set_calendar_occurrence_venue"("_occurrence_id" "uuid", "_venue_id" "uuid", "_propagate" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_city_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.venue_id IS NOT NULL THEN
    -- Derive canonical city from entities.city_id via the venue's entity_id.
    SELECT e.city_id, c.slug
    INTO NEW.city_id, NEW.city_slug
    FROM public.venues v
    JOIN public.entities e ON e.id = v.entity_id
    JOIN public.cities c ON c.id = e.city_id
    WHERE v.id = NEW.venue_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_city_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_guest_dancer_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_guest_dancer_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_city_text_to_city_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- This trigger no longer enforces NEW.city_id on venues; entities.city_id is the canonical source.
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_city_text_to_city_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_event_city_to_city_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_city_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.city_slug IS NOT DISTINCT FROM OLD.city_slug
    AND NEW.city_id IS NOT DISTINCT FROM OLD.city_id THEN
    RETURN NEW;
  END IF;

  IF NEW.city_id IS NULL THEN
    v_city_id := public.resolve_city_id(NULL, NEW.city_slug);
    NEW.city_id := v_city_id;
  END IF;

  IF NEW.city_id IS NULL THEN
    RAISE EXCEPTION 'Valid city is required (city_slug must match canonical city list)';
  END IF;

  IF NEW.city_slug IS NULL OR trim(NEW.city_slug) = '' THEN
    SELECT c.slug INTO NEW.city_slug
    FROM public.cities c
    WHERE c.id = NEW.city_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_event_city_to_city_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_venue_to_entities_minimal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Safest approach: do nothing. Prevents venue -> entity canonical writes.
  -- Keep as SECURITY DEFINER to avoid privilege errors on existing triggers.
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_venue_to_entities_minimal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_manager_city_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  PERFORM public.enforce_manager_city_scope_for_user(v_user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_enforce_manager_city_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_attendance_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.events
    SET attendance_count = (
      SELECT count(*) 
      FROM public.event_participants 
      WHERE event_id = OLD.event_id
    )
    WHERE id = OLD.event_id;
    RETURN OLD;
  ELSE
    UPDATE public.events
    SET attendance_count = (
      SELECT count(*) 
      FROM public.event_participants 
      WHERE event_id = NEW.event_id
    )
    WHERE id = NEW.event_id;
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_event_attendance_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_event_guest_dancer_link"("_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.rpc_deprecation_log(function_name, params, auth_uid)
  VALUES ('upsert_event_guest_dancer_link', _payload, auth.uid());
  RAISE EXCEPTION 'Deprecated RPC. Use admin_save_event_v2 with guest_assignments_by_date and event_profile_links.';
END;$$;


ALTER FUNCTION "public"."upsert_event_guest_dancer_link"("_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_event_guest_dancer_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid" DEFAULT NULL::"uuid", "p_actor" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Validate dancer profile
  PERFORM 1 FROM public.dancers d WHERE d.id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % is not a valid dancer', p_profile_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Idempotency: identical active row already exists?
  SELECT EXISTS (
    SELECT 1
    FROM public.event_profile_links epl
    WHERE epl.event_id = p_event_id
      AND epl.profile_type = 'dancer'
      AND epl.profile_id = p_profile_id
      AND ((epl.occurrence_id IS NULL AND p_occurrence_id IS NULL)
           OR epl.occurrence_id = p_occurrence_id)
      AND epl.archived_at IS NULL
  ) INTO v_exists;

  IF v_exists THEN
    RETURN; -- no-op
  END IF;

  -- Insert a new active row; do not archive cross-scope rows
  INSERT INTO public.event_profile_links (
    event_id, profile_type, profile_id, occurrence_id, archived_at, role
  ) VALUES (
    p_event_id, 'dancer', p_profile_id, p_occurrence_id, NULL, NULL
  );
END;
$$;


ALTER FUNCTION "public"."upsert_event_guest_dancer_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_actor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_event_profile_connection"("p_event_id" "uuid", "p_person_type" "text", "p_person_id" "uuid", "p_connection_label" "text", "p_is_primary" boolean DEFAULT false, "p_sort_order" integer DEFAULT 0, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
  v_can_manage_event boolean;
  v_can_manage_profile boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_person_type NOT IN ('dancer', 'organiser', 'teacher', 'dj', 'vendor', 'videographer') THEN
    RAISE EXCEPTION 'Invalid person_type: %', p_person_type;
  END IF;

  IF p_connection_label NOT IN ('attending', 'interested', 'teaching', 'performing_dj', 'organising', 'vendor_partner') THEN
    RAISE EXCEPTION 'Invalid connection_label: %', p_connection_label;
  END IF;

  v_can_manage_event := public.can_current_user_manage_event_graph(p_event_id);
  v_can_manage_profile := public.can_current_user_manage_profile(p_person_type, p_person_id);

  IF NOT (v_can_manage_event OR v_can_manage_profile) THEN
    RAISE EXCEPTION 'Not authorised to manage this event/profile connection';
  END IF;

  INSERT INTO public.event_profile_connections (
    event_id,
    person_type,
    person_id,
    connection_label,
    is_primary,
    sort_order,
    notes,
    created_by
  )
  VALUES (
    p_event_id,
    p_person_type,
    p_person_id,
    p_connection_label,
    COALESCE(p_is_primary, false),
    COALESCE(p_sort_order, 0),
    p_notes,
    auth.uid()
  )
  ON CONFLICT (event_id, person_type, person_id, connection_label)
  DO UPDATE
  SET
    is_primary = EXCLUDED.is_primary,
    sort_order = EXCLUDED.sort_order,
    notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."upsert_event_profile_connection"("p_event_id" "uuid", "p_person_type" "text", "p_person_id" "uuid", "p_connection_label" "text", "p_is_primary" boolean, "p_sort_order" integer, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text" DEFAULT NULL::"text", "p_based_city_id" "uuid" DEFAULT NULL::"uuid", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_photo_url" "text" DEFAULT NULL::"text", "p_nationality" "text" DEFAULT NULL::"text", "p_favorite_styles" "text"[] DEFAULT NULL::"text"[], "p_favorite_songs" "text"[] DEFAULT NULL::"text"[], "p_achievements" "text"[] DEFAULT NULL::"text"[], "p_partner_role" "text" DEFAULT NULL::"text", "p_partner_details" "text" DEFAULT NULL::"text", "p_instagram" "text" DEFAULT NULL::"text", "p_looking_for_partner" boolean DEFAULT NULL::boolean, "p_facebook" "text" DEFAULT NULL::"text", "p_partner_practice_goals" "text"[] DEFAULT NULL::"text"[], "p_website" "text" DEFAULT NULL::"text", "p_dancing_start_date" "text" DEFAULT NULL::"text", "p_partner_search_level" "text"[] DEFAULT NULL::"text"[], "p_partner_search_role" "text" DEFAULT NULL::"text", "p_first_name_dancer" "text" DEFAULT NULL::"text", "p_surname" "text" DEFAULT NULL::"text", "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_whatsapp" "text" DEFAULT NULL::"text", "p_is_active" boolean DEFAULT NULL::boolean, "p_profile_source" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $_$
DECLARE
  v_outcome            text;
  v_dance_started_year int;
  v_resolved_city      uuid;
  v_resolved_first     text;
  v_resolved_last      text;
  v_gallery_urls       text[];
BEGIN
  -- Only authenticated callers may upsert their own profile, or admins any profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Resolve city: p_based_city_id takes precedence; fall back to p_city_id
  v_resolved_city := COALESCE(p_based_city_id, p_city_id);

  -- Resolve name fields
  v_resolved_first := NULLIF(btrim(COALESCE(p_first_name, p_first_name_dancer, '')), '');
  v_resolved_last  := NULLIF(btrim(COALESCE(p_last_name, p_surname, '')), '');

  -- Extract year from dancing_start_date
  IF p_dancing_start_date IS NOT NULL AND btrim(p_dancing_start_date) <> '' THEN
    BEGIN
      v_dance_started_year := CASE
        WHEN p_dancing_start_date ~ '^\d{4}$'
          THEN p_dancing_start_date::int
        ELSE EXTRACT(year FROM p_dancing_start_date::date)::int
      END;
    EXCEPTION WHEN OTHERS THEN
      v_dance_started_year := NULL;
    END;
  END IF;

  -- Build gallery_urls from p_photo_url scalar
  v_gallery_urls := CASE
    WHEN NULLIF(btrim(COALESCE(p_photo_url, '')), '') IS NOT NULL
      THEN ARRAY[btrim(p_photo_url)]::text[]
    ELSE NULL
  END;

  -- ── member_profiles upsert ────────────────────────────────────────────
  INSERT INTO public.member_profiles (
    id,
    first_name,
    last_name,
    full_name,
    avatar_url,
    based_city_id
  ) VALUES (
    p_user_id,
    v_resolved_first,
    v_resolved_last,
    NULLIF(btrim(COALESCE(p_full_name,
      concat_ws(' ', v_resolved_first, v_resolved_last), '')), ''),
    NULLIF(btrim(COALESCE(p_avatar_url, '')), ''),
    v_resolved_city
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name    = COALESCE(EXCLUDED.first_name,    member_profiles.first_name),
    last_name     = COALESCE(EXCLUDED.last_name,     member_profiles.last_name),
    full_name     = COALESCE(EXCLUDED.full_name,     member_profiles.full_name),
    avatar_url    = COALESCE(EXCLUDED.avatar_url,    member_profiles.avatar_url),
    based_city_id = COALESCE(EXCLUDED.based_city_id, member_profiles.based_city_id);

  -- ── dancer_profiles upsert ────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM public.dancer_profiles WHERE id = p_user_id) THEN
    v_outcome := 'updated';
  ELSE
    v_outcome := 'inserted';
  END IF;

  INSERT INTO public.dancer_profiles (
    id,
    first_name,
    surname,
    avatar_url,
    dance_role,
    based_city_id,
    dance_started_year,
    nationality,
    gallery_urls,
    looking_for_partner,
    partner_search_role,
    partner_search_level,
    partner_practice_goals,
    partner_details,
    favorite_styles,
    favorite_songs,
    achievements,
    instagram,
    facebook,
    whatsapp,
    website,
    -- Phase 2 governance columns
    is_active,
    profile_source,
    created_by
  ) VALUES (
    p_user_id,
    v_resolved_first,
    v_resolved_last,
    NULLIF(btrim(COALESCE(p_avatar_url, '')), ''),
    NULLIF(btrim(COALESCE(p_partner_role, '')), ''),
    v_resolved_city,
    v_dance_started_year,
    NULLIF(btrim(COALESCE(p_nationality,  '')), ''),
    COALESCE(v_gallery_urls, '{}'),
    COALESCE(p_looking_for_partner, false),
    NULLIF(btrim(COALESCE(p_partner_search_role, '')), ''),
    COALESCE(p_partner_search_level,    '{}'),
    COALESCE(p_partner_practice_goals,  '{}'),
    NULLIF(btrim(COALESCE(p_partner_details, '')), ''),
    COALESCE(p_favorite_styles,  '{}'),
    COALESCE(p_favorite_songs,   '{}'),
    COALESCE(p_achievements,     '{}'),
    NULLIF(btrim(COALESCE(p_instagram, '')), ''),
    NULLIF(btrim(COALESCE(p_facebook,  '')), ''),
    NULLIF(btrim(COALESCE(p_whatsapp,  '')), ''),
    NULLIF(btrim(COALESCE(p_website,   '')), ''),
    -- Governance: NULL = auto mode (completeness gate decides)
    p_is_active,
    -- Origin: 'rpc_upsert' when not explicitly supplied
    COALESCE(p_profile_source, 'rpc_upsert'),
    -- Creator: set from JWT on INSERT; NULL for service-role/unauthenticated calls
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name             = COALESCE(EXCLUDED.first_name,             dancer_profiles.first_name),
    surname                = COALESCE(EXCLUDED.surname,                dancer_profiles.surname),
    avatar_url             = COALESCE(EXCLUDED.avatar_url,             dancer_profiles.avatar_url),
    dance_role             = COALESCE(EXCLUDED.dance_role,             dancer_profiles.dance_role),
    based_city_id          = COALESCE(EXCLUDED.based_city_id,          dancer_profiles.based_city_id),
    dance_started_year     = COALESCE(EXCLUDED.dance_started_year,     dancer_profiles.dance_started_year),
    nationality            = COALESCE(EXCLUDED.nationality,            dancer_profiles.nationality),
    gallery_urls           = CASE
                               WHEN EXCLUDED.gallery_urls <> '{}' THEN EXCLUDED.gallery_urls
                               ELSE dancer_profiles.gallery_urls
                             END,
    looking_for_partner    = EXCLUDED.looking_for_partner,
    partner_search_role    = COALESCE(EXCLUDED.partner_search_role,    dancer_profiles.partner_search_role),
    partner_search_level   = CASE
                               WHEN EXCLUDED.partner_search_level <> '{}' THEN EXCLUDED.partner_search_level
                               ELSE dancer_profiles.partner_search_level
                             END,
    partner_practice_goals = CASE
                               WHEN EXCLUDED.partner_practice_goals <> '{}' THEN EXCLUDED.partner_practice_goals
                               ELSE dancer_profiles.partner_practice_goals
                             END,
    partner_details        = COALESCE(EXCLUDED.partner_details,        dancer_profiles.partner_details),
    favorite_styles        = CASE
                               WHEN EXCLUDED.favorite_styles <> '{}' THEN EXCLUDED.favorite_styles
                               ELSE dancer_profiles.favorite_styles
                             END,
    favorite_songs         = CASE
                               WHEN EXCLUDED.favorite_songs <> '{}' THEN EXCLUDED.favorite_songs
                               ELSE dancer_profiles.favorite_songs
                             END,
    achievements           = CASE
                               WHEN EXCLUDED.achievements <> '{}' THEN EXCLUDED.achievements
                               ELSE dancer_profiles.achievements
                             END,
    -- Phase 3: contact fields use EXCLUDED directly (no COALESCE fallback).
    -- The canonical gateway always sends all fields explicitly in a full upsert;
    -- submitting NULL means admin intentionally cleared the field.
    instagram              = EXCLUDED.instagram,
    facebook               = EXCLUDED.facebook,
    whatsapp               = EXCLUDED.whatsapp,
    website                = EXCLUDED.website,
    -- Governance: is_active only modifiable by admins
    is_active              = CASE
                               WHEN public.is_admin() THEN p_is_active
                               ELSE dancer_profiles.is_active
                             END,
    -- profile_source: preserve existing value unless caller explicitly supplies a new one
    profile_source         = COALESCE(p_profile_source, dancer_profiles.profile_source),
    -- created_by: NEVER changed on UPDATE — immutable audit record
    updated_at             = now();

  RETURN jsonb_build_object(
    'id',      p_user_id,
    'outcome', v_outcome
  );
END;
$_$;


ALTER FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text", "p_based_city_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_avatar_url" "text", "p_photo_url" "text", "p_nationality" "text", "p_favorite_styles" "text"[], "p_favorite_songs" "text"[], "p_achievements" "text"[], "p_partner_role" "text", "p_partner_details" "text", "p_instagram" "text", "p_looking_for_partner" boolean, "p_facebook" "text", "p_partner_practice_goals" "text"[], "p_website" "text", "p_dancing_start_date" "text", "p_partner_search_level" "text"[], "p_partner_search_role" "text", "p_first_name_dancer" "text", "p_surname" "text", "p_city_id" "uuid", "p_whatsapp" "text", "p_is_active" boolean, "p_profile_source" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_profile_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "profile_type" "text" NOT NULL,
    "role" "text" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "reason" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "occurrence_id" "uuid",
    CONSTRAINT "event_profile_links_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text", 'dancer'::"text", 'venue'::"text", 'guest_dancer'::"text"]))),
    CONSTRAINT "event_profile_links_role_check" CHECK (("role" = ANY (ARRAY['organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text", 'dancer'::"text", 'venue'::"text"]))),
    CONSTRAINT "event_profile_links_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."event_profile_links" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_profile_links"."occurrence_id" IS 'References occurrence_id from event_instances view; no DB-level FK because event_instances is a view. Maintain referential integrity via backend validation or scheduled checks.';



CREATE OR REPLACE FUNCTION "public"."upsert_guest_dancer"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid" DEFAULT NULL::"uuid", "p_archived_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."event_profile_links"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row public.event_profile_links;
  v_now timestamptz := now();
  v_role text := 'dancer';
  v_profile_type text := 'dancer';
BEGIN
  -- Authorization: ensure caller can edit the event
  IF NOT public.can_user_edit_event(auth.uid(), p_event_id) THEN
    RAISE EXCEPTION 'Not authorized to edit event %', p_event_id
      USING ERRCODE = '42501';
  END IF;

  -- Basic validation
  IF p_event_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'event_id and profile_id are required';
  END IF;

  -- Validate profile exists in public.dancers
  PERFORM 1 FROM public.dancers d WHERE d.id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found in public.dancers', p_profile_id;
  END IF;

  -- If occurrence provided, validate it belongs to the same event
  IF p_occurrence_id IS NOT NULL THEN
    PERFORM 1
    FROM public.calendar_occurrences co
    WHERE co.id = p_occurrence_id
      AND co.event_id = p_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Occurrence % does not belong to event %', p_occurrence_id, p_event_id;
    END IF;
  END IF;

  -- Branch by scope
  IF p_occurrence_id IS NULL THEN
    -- Series-wide scope
    SELECT *
      INTO v_row
      FROM public.event_profile_links
     WHERE event_id = p_event_id
       AND profile_id = p_profile_id
       AND role = v_role
       AND profile_type = v_profile_type
       AND archived_at IS NULL
       AND status = 'active'
       AND occurrence_id IS NULL
     LIMIT 1;

    IF p_archived_at IS NOT NULL THEN
      -- Archive if active exists; else idempotent no-op (NULL)
      IF v_row.id IS NOT NULL THEN
        UPDATE public.event_profile_links
           SET archived_at = COALESCE(p_archived_at, v_now),
               updated_at  = v_now
         WHERE id = v_row.id
         RETURNING * INTO v_row;
        RETURN v_row;
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      -- Activate/upsert: identical-scope idempotent
      IF v_row.id IS NOT NULL THEN
        UPDATE public.event_profile_links
           SET status     = 'active',
               updated_at = v_now
         WHERE id = v_row.id
         RETURNING * INTO v_row;
        RETURN v_row;
      ELSE
        -- Preflight identical-scope duplicate (indexes also enforce)
        PERFORM 1
          FROM public.event_profile_links
         WHERE event_id = p_event_id
           AND profile_id = p_profile_id
           AND role = v_role
           AND profile_type = v_profile_type
           AND archived_at IS NULL
           AND status = 'active'
           AND occurrence_id IS NULL
         LIMIT 1;
        IF FOUND THEN
          RAISE EXCEPTION 'Active series-wide dancer already exists for event %, profile %', p_event_id, p_profile_id;
        END IF;

        INSERT INTO public.event_profile_links (
          event_id, occurrence_id, profile_id, role, profile_type, status, archived_at, created_at, updated_at
        ) VALUES (
          p_event_id, NULL, p_profile_id, v_role, v_profile_type, 'active', NULL, v_now, v_now
        )
        RETURNING * INTO v_row;
        RETURN v_row;
      END IF;
    END IF;

  ELSE
    -- Occurrence-specific scope
    SELECT *
      INTO v_row
      FROM public.event_profile_links
     WHERE event_id = p_event_id
       AND occurrence_id = p_occurrence_id
       AND profile_id = p_profile_id
       AND role = v_role
       AND profile_type = v_profile_type
       AND archived_at IS NULL
       AND status = 'active'
     LIMIT 1;

    IF p_archived_at IS NOT NULL THEN
      -- Archive if active exists; else idempotent no-op (NULL)
      IF v_row.id IS NOT NULL THEN
        UPDATE public.event_profile_links
           SET archived_at = COALESCE(p_archived_at, v_now),
               updated_at  = v_now
         WHERE id = v_row.id
         RETURNING * INTO v_row;
        RETURN v_row;
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      -- Activate/upsert: identical-scope idempotent
      IF v_row.id IS NOT NULL THEN
        UPDATE public.event_profile_links
           SET status     = 'active',
               updated_at = v_now
         WHERE id = v_row.id
         RETURNING * INTO v_row;
        RETURN v_row;
      ELSE
        -- Preflight identical-scope duplicate (indexes also enforce)
        PERFORM 1
          FROM public.event_profile_links
         WHERE event_id = p_event_id
           AND occurrence_id = p_occurrence_id
           AND profile_id = p_profile_id
           AND role = v_role
           AND profile_type = v_profile_type
           AND archived_at IS NULL
           AND status = 'active'
         LIMIT 1;
        IF FOUND THEN
          RAISE EXCEPTION 'Active occurrence-specific dancer already exists for event %, occurrence %, profile %',
            p_event_id, p_occurrence_id, p_profile_id;
        END IF;

        INSERT INTO public.event_profile_links (
          event_id, occurrence_id, profile_id, role, profile_type, status, archived_at, created_at, updated_at
        ) VALUES (
          p_event_id, p_occurrence_id, p_profile_id, v_role, v_profile_type, 'active', NULL, v_now, v_now
        )
        RETURNING * INTO v_row;
        RETURN v_row;
      END IF;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_guest_dancer"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_archived_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "photo_url" "text"[],
    "address" "text",
    "google_maps_url" "text",
    "capacity" integer,
    "rules" "text"[],
    "parking" "text",
    "gallery_urls" "text"[],
    "opening_hours" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "facilities" "jsonb" DEFAULT '[]'::"jsonb",
    "floor_type" "text" DEFAULT '[]'::"jsonb",
    "website" "text",
    "instagram" "text",
    "facebook" "text",
    "email" "text",
    "phone" "text",
    "hide_paid_parking" boolean DEFAULT false,
    "transport" "text",
    "user_id" "uuid" NOT NULL,
    "description" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "faq" "text",
    "country" "text",
    "timezone" "text",
    "entity_id" "uuid",
    "postcode" "text",
    "google_maps_link" "text",
    "bar_available" boolean DEFAULT false,
    "cloakroom_available" boolean DEFAULT false,
    "id_required" boolean DEFAULT false,
    "last_entry_time" time without time zone,
    "venue_rating" numeric,
    "video_urls" "text"[] DEFAULT '{}'::"text"[],
    "admin_notes" "text",
    "facilities_new" "text"[] DEFAULT '{}'::"text"[],
    "transport_json" "jsonb" DEFAULT '{}'::"jsonb",
    "parking_json" "jsonb" DEFAULT '{}'::"jsonb",
    "faq_json" "jsonb" DEFAULT '[]'::"jsonb",
    "accessibility" "text"
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_venue_admin"("payload" "jsonb", "actor_user_id" "uuid") RETURNS "public"."venues"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_venue       jsonb := COALESCE(payload -> 'venue', '{}'::jsonb);
  v_identity    jsonb := COALESCE(payload -> 'identity', '{}'::jsonb);
  v_audit       jsonb := COALESCE(payload -> 'audit', '{}'::jsonb);

  v_venue_id    uuid := NULL;
  v_entity_id   uuid := NULL; -- requested/target entity id
  v_city_id     uuid := NULL; -- canonical city id for entities.city_id only
  v_name_resolved text := NULL; -- canonical name resolution

  v_now         timestamptz := now();

  v_row         public.venues%ROWTYPE;
  v_before      jsonb := NULL;
  v_after       jsonb := NULL;

  v_facilities_array text[] := NULL;
  v_video_urls_array text[] := NULL;
  v_entity_row public.entities%ROWTYPE;
BEGIN
  -- Basic guards
  IF actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_user_id is required'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN RAISE EXCEPTION 'payload must be a json object'; END IF;

  -- Allowed top-level keys
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(payload) AS k
    WHERE k NOT IN ('venue_id','identity','venue','audit')
  ) THEN RAISE EXCEPTION 'payload contains unknown top-level keys'; END IF;

  IF jsonb_typeof(v_identity) <> 'object' THEN RAISE EXCEPTION 'identity must be an object if provided'; END IF;
  IF jsonb_typeof(v_audit)    <> 'object' THEN RAISE EXCEPTION 'audit must be an object if provided'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_audit) AS k WHERE k NOT IN ('reason')
  ) THEN RAISE EXCEPTION 'audit contains unknown keys'; END IF;

  -- Inputs
  IF payload ? 'venue_id' THEN
    v_venue_id := NULLIF(payload ->> 'venue_id','')::uuid;
  END IF;

  IF v_identity ? 'entity_id' THEN
    v_entity_id := NULLIF(v_identity ->> 'entity_id','')::uuid;
  END IF;

  -- Canonical city_id only on entities
  IF v_identity ? 'city_id' THEN
    v_city_id := NULLIF(v_identity ->> 'city_id','')::uuid;
  END IF;

  IF v_venue ? 'city_id' THEN
    IF v_city_id IS NULL THEN
      RAISE EXCEPTION 'identity.city_id is required; venue.city_id is not authoritative';
    END IF;

    IF NULLIF(v_venue ->> 'city_id','')::uuid IS DISTINCT FROM v_city_id THEN
      RAISE EXCEPTION 'venue.city_id conflicts with identity.city_id; identity.city_id is authoritative';
    END IF;
  END IF;

  IF v_city_id IS NULL THEN RAISE EXCEPTION 'city_id is required'; END IF;

  -- Resolve canonical name: identity.name first, else venue.name
  v_name_resolved := NULLIF(v_identity ->> 'name', '');
  IF v_name_resolved IS NULL THEN
    v_name_resolved := NULLIF(v_venue ->> 'name', '');
  END IF;

  -- Validate venue payload types and map arrays
  IF payload ? 'venue' THEN
    IF jsonb_typeof(v_venue) <> 'object' THEN RAISE EXCEPTION 'venue must be an object'; END IF;

    IF v_venue ? 'capacity' AND NULLIF(v_venue ->> 'capacity','') IS NOT NULL THEN
      BEGIN IF (v_venue ->> 'capacity')::bigint < 0 THEN RAISE EXCEPTION 'capacity must be non-negative'; END IF; EXCEPTION WHEN others THEN RAISE EXCEPTION 'capacity must be a non-negative integer'; END; END IF;

    IF v_venue ? 'venue_rating' AND NULLIF(v_venue ->> 'venue_rating','') IS NOT NULL THEN
      BEGIN PERFORM (v_venue ->> 'venue_rating')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'venue_rating must be numeric'; END; END IF;

    IF v_venue ? 'last_entry_time' AND NULLIF(v_venue ->> 'last_entry_time','') IS NOT NULL THEN
      BEGIN PERFORM (v_venue ->> 'last_entry_time')::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'last_entry_time must be a valid time'; END; END IF;

    IF v_venue ? 'facilities' THEN
      IF jsonb_typeof(v_venue -> 'facilities') = 'null' THEN v_facilities_array := NULL; ELSE
        IF jsonb_typeof(v_venue -> 'facilities') <> 'array' THEN RAISE EXCEPTION 'facilities must be array or null'; END IF;
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_venue -> 'facilities') AS t(x) WHERE trim(x) = ''
        ) THEN RAISE EXCEPTION 'facilities array must not contain empty strings'; END IF;
        SELECT array_agg(x) INTO v_facilities_array FROM (SELECT jsonb_array_elements_text(v_venue -> 'facilities') AS x) s;
      END IF;
    END IF;

    IF v_venue ? 'video_urls' THEN
      IF jsonb_typeof(v_venue -> 'video_urls') = 'null' THEN v_video_urls_array := NULL; ELSE
        IF jsonb_typeof(v_venue -> 'video_urls') <> 'array' THEN RAISE EXCEPTION 'video_urls must be array or null'; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_venue -> 'video_urls') AS t(u) WHERE trim(u) = '') THEN
          RAISE EXCEPTION 'video_urls must not contain empty strings';
        END IF;
        SELECT array_agg(u) INTO v_video_urls_array FROM (SELECT jsonb_array_elements_text(v_venue -> 'video_urls') AS u) s;
      END IF;
    END IF;

    IF v_venue ? 'transport' THEN
      IF jsonb_typeof(v_venue -> 'transport') <> 'null' AND jsonb_typeof(v_venue -> 'transport') NOT IN ('object','array') THEN
        RAISE EXCEPTION 'transport must be object/array or null';
      END IF;
    END IF;

    IF v_venue ? 'parking' THEN
      IF jsonb_typeof(v_venue -> 'parking') <> 'null' AND jsonb_typeof(v_venue -> 'parking') NOT IN ('object','array') THEN
        RAISE EXCEPTION 'parking must be object/array or null';
      END IF;
    END IF;

    IF v_venue ? 'faq' THEN
      IF jsonb_typeof(v_venue -> 'faq') <> 'null' THEN
        IF jsonb_typeof(v_venue -> 'faq') <> 'array' THEN RAISE EXCEPTION 'faq must be array or null'; END IF;
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_venue -> 'faq') AS f(item)
          WHERE NOT (
            jsonb_typeof(item) = 'object' AND item ? 'q' AND item ? 'a' AND jsonb_typeof(item -> 'q') = 'string' AND jsonb_typeof(item -> 'a') = 'string'
          )
        ) THEN RAISE EXCEPTION 'each faq item must be object with string q and a'; END IF;
      END IF;
    END IF;
  END IF;

  -- Upsert path
  IF v_venue_id IS NULL THEN
    -- Create or resolve entity for type='venue'
    IF v_entity_id IS NOT NULL THEN
      SELECT * INTO v_entity_row FROM public.entities WHERE id = v_entity_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'identity.entity_id % does not exist', v_entity_id; END IF;
      IF v_entity_row.type IS NOT NULL AND v_entity_row.type <> 'venue' THEN RAISE EXCEPTION 'entity % has incompatible type %', v_entity_id, v_entity_row.type; END IF;
    ELSE
      INSERT INTO public.entities (type, name, city_id, created_at)
      VALUES ('venue', v_name_resolved, v_city_id, v_now)
      RETURNING * INTO v_entity_row;
      v_entity_id := v_entity_row.id;
    END IF;

    -- Always enforce canonical city and name on entity (name may be null)
    UPDATE public.entities SET city_id = v_city_id, name = COALESCE(v_name_resolved, name) WHERE id = v_entity_id;

    -- Insert venue row; never write venues.city or venues.city_id; name mirrors canonical
    INSERT INTO public.venues (
      name,
      city,
      address,
      postcode,
      google_maps_link,
      description,
      capacity,
      opening_hours,
      facilities_new,
      transport_json,
      parking_json,
      id_required,
      last_entry_time,
      bar_available,
      cloakroom_available,
      venue_rating,
      video_urls,
      admin_notes,
      faq_json,
      entity_id,
      user_id,
      created_at
    ) VALUES (
      v_name_resolved,
      NULL, -- legacy mirror deprecated: never write venues.city
      CASE WHEN v_venue ? 'address' THEN NULLIF(v_venue ->> 'address','') ELSE NULL END,
      CASE WHEN v_venue ? 'postcode' THEN NULLIF(v_venue ->> 'postcode','') ELSE NULL END,
      CASE WHEN v_venue ? 'google_maps_link' THEN NULLIF(v_venue ->> 'google_maps_link','') ELSE NULL END,
      CASE WHEN v_venue ? 'description' THEN NULLIF(v_venue ->> 'description','') ELSE NULL END,
      CASE WHEN v_venue ? 'capacity' THEN NULLIF(v_venue ->> 'capacity','')::integer ELSE NULL END,
      CASE WHEN v_venue ? 'opening_hours' THEN v_venue -> 'opening_hours' ELSE NULL END,
      CASE WHEN v_venue ? 'facilities' THEN v_facilities_array ELSE NULL END,
      CASE WHEN v_venue ? 'transport' THEN v_venue -> 'transport' ELSE NULL END,
      CASE WHEN v_venue ? 'parking' THEN v_venue -> 'parking' ELSE NULL END,
      CASE WHEN v_venue ? 'id_required' THEN (v_venue ->> 'id_required')::boolean ELSE NULL END,
      CASE WHEN v_venue ? 'last_entry_time' THEN NULLIF(v_venue ->> 'last_entry_time','')::time ELSE NULL END,
      CASE WHEN v_venue ? 'bar_available' THEN (v_venue ->> 'bar_available')::boolean ELSE NULL END,
      CASE WHEN v_venue ? 'cloakroom_available' THEN (v_venue ->> 'cloakroom_available')::boolean ELSE NULL END,
      CASE WHEN v_venue ? 'venue_rating' THEN NULLIF(v_venue ->> 'venue_rating','')::numeric ELSE NULL END,
      CASE WHEN v_venue ? 'video_urls' THEN v_video_urls_array ELSE NULL END,
      CASE WHEN v_venue ? 'admin_notes' THEN NULLIF(v_venue ->> 'admin_notes','') ELSE NULL END,
      CASE WHEN v_venue ? 'faq' THEN v_venue -> 'faq' ELSE NULL END,
      v_entity_id,
      actor_user_id,
      v_now
    ) RETURNING * INTO v_row;

    v_after := to_jsonb(v_row);

  ELSE
    -- UPDATE path: load the row and enforce linkage
    SELECT * INTO v_row FROM public.venues WHERE id = v_venue_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'venue with id % not found', v_venue_id; END IF;
    v_before := to_jsonb(v_row);

    -- Disallow conflicting reassignment
    IF v_identity ? 'entity_id' AND v_entity_id IS NOT NULL AND v_row.entity_id IS DISTINCT FROM v_entity_id THEN
      IF EXISTS (SELECT 1 FROM public.venues WHERE entity_id = v_entity_id AND id <> v_row.id) THEN
        RAISE EXCEPTION 'entity_id % already linked to another venue', v_entity_id;
      END IF;
      -- Ensure target entity exists and is type venue
      SELECT * INTO v_entity_row FROM public.entities WHERE id = v_entity_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'identity.entity_id % does not exist', v_entity_id; END IF;
      IF v_entity_row.type IS NOT NULL AND v_entity_row.type <> 'venue' THEN RAISE EXCEPTION 'entity % has incompatible type %', v_entity_id, v_entity_row.type; END IF;
    END IF;

    -- Canonical city: write to entities.city_id only
    IF v_city_id IS NOT NULL THEN
      UPDATE public.entities SET city_id = v_city_id WHERE id = COALESCE(v_entity_id, v_row.entity_id);
    END IF;

    -- Canonical name: update when provided in payload (identity.name or fallback venue.name)
    IF v_name_resolved IS NOT NULL THEN
      UPDATE public.entities
      SET name = v_name_resolved
      WHERE id = COALESCE(v_entity_id, v_row.entity_id);
    END IF;

    -- Update venue mirrors; never write venues.city or venues.city_id; name mirrors canonical when provided
    UPDATE public.venues
    SET
      name = COALESCE(v_name_resolved, name),
      city = city, -- preserved, never overwritten from payload
      address = CASE WHEN v_venue ? 'address' THEN NULLIF(v_venue ->> 'address','') ELSE address END,
      postcode = CASE WHEN v_venue ? 'postcode' THEN NULLIF(v_venue ->> 'postcode','') ELSE postcode END,
      google_maps_link = CASE WHEN v_venue ? 'google_maps_link' THEN NULLIF(v_venue ->> 'google_maps_link','') ELSE google_maps_link END,
      description = CASE WHEN v_venue ? 'description' THEN NULLIF(v_venue ->> 'description','') ELSE description END,
      capacity = CASE WHEN v_venue ? 'capacity' THEN NULLIF(v_venue ->> 'capacity','')::integer ELSE capacity END,
      opening_hours = CASE WHEN v_venue ? 'opening_hours' THEN v_venue -> 'opening_hours' ELSE opening_hours END,
      facilities_new = CASE WHEN v_venue ? 'facilities' THEN CASE WHEN jsonb_typeof(v_venue -> 'facilities') = 'null' THEN NULL ELSE v_facilities_array END ELSE facilities_new END,
      transport_json = CASE WHEN v_venue ? 'transport' THEN v_venue -> 'transport' ELSE transport_json END,
      parking_json = CASE WHEN v_venue ? 'parking' THEN v_venue -> 'parking' ELSE parking_json END,
      id_required = CASE WHEN v_venue ? 'id_required' THEN (v_venue ->> 'id_required')::boolean ELSE id_required END,
      last_entry_time = CASE WHEN v_venue ? 'last_entry_time' THEN NULLIF(v_venue ->> 'last_entry_time','')::time ELSE last_entry_time END,
      bar_available = CASE WHEN v_venue ? 'bar_available' THEN (v_venue ->> 'bar_available')::boolean ELSE bar_available END,
      cloakroom_available = CASE WHEN v_venue ? 'cloakroom_available' THEN (v_venue ->> 'cloakroom_available')::boolean ELSE cloakroom_available END,
      venue_rating = CASE WHEN v_venue ? 'venue_rating' THEN NULLIF(v_venue ->> 'venue_rating','')::numeric ELSE venue_rating END,
      video_urls = CASE WHEN v_venue ? 'video_urls' THEN CASE WHEN jsonb_typeof(v_venue -> 'video_urls') = 'null' THEN NULL ELSE v_video_urls_array END ELSE video_urls END,
      admin_notes = CASE WHEN v_venue ? 'admin_notes' THEN NULLIF(v_venue ->> 'admin_notes','') ELSE admin_notes END,
      faq_json = CASE WHEN v_venue ? 'faq' THEN v_venue -> 'faq' ELSE faq_json END,
      entity_id = CASE WHEN v_identity ? 'entity_id' THEN v_entity_id ELSE entity_id END
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    v_after := to_jsonb(v_row);
  END IF;

  -- Audit
  INSERT INTO public.admin_settings_audit (
    action, target_user_id, actor_id, reason, before_data, after_data, created_at
  ) VALUES (
    'upsert_venue_admin', NULL, actor_user_id,
    CASE WHEN v_audit ? 'reason' THEN v_audit ->> 'reason' ELSE NULL END,
    v_before, v_after, v_now
  );

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."upsert_venue_admin"("payload" "jsonb", "actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_venue_atomic"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  ent_id uuid;
  v_id uuid;
  entity_city_id uuid;

  incoming_entity jsonb := payload->'entity';
  incoming_venue jsonb := payload->'venue';

BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_super_users
    WHERE user_id = auth.uid()
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF incoming_entity IS NULL THEN
    RAISE EXCEPTION 'entity payload missing';
  END IF;

  IF incoming_entity->>'name' IS NULL THEN
    RAISE EXCEPTION 'name is required';
  END IF;

  IF incoming_entity->>'city_id' IS NULL
     OR trim(incoming_entity->>'city_id') = '' THEN
    RAISE EXCEPTION 'city_id is required';
  END IF;

  entity_city_id := (incoming_entity->>'city_id')::uuid;

  INSERT INTO public.entities (
    type,
    name,
    city_id,
    created_at
  )
  VALUES (
    'venue',
    incoming_entity->>'name',
    entity_city_id,
    now()
  )
  RETURNING id INTO ent_id;

  IF incoming_venue IS NOT NULL THEN
    INSERT INTO public.venues (
      name,
      address,
      entity_id,
      user_id,
      created_at
    )
    VALUES (
      incoming_venue->>'name',
      incoming_venue->>'address',
      ent_id,
      auth.uid(),
      now()
    )
    ON CONFLICT (entity_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'canonical_id', ent_id,
    'venue_id', v_id
  );
END;
$$;


ALTER FUNCTION "public"."upsert_venue_atomic"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uuid_to_bigint"("p_uuid" "uuid") RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT ('x' || substr(md5($1::text), 1, 16))::bit(64)::bigint;
$_$;


ALTER FUNCTION "public"."uuid_to_bigint"("p_uuid" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_link_managers" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'manager'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "notes" "text",
    CONSTRAINT "admin_link_managers_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))
);


ALTER TABLE "public"."admin_link_managers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_manager_city_scopes" (
    "user_id" "uuid" NOT NULL,
    "city_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."admin_manager_city_scopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dj_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "dj_name" "text" NOT NULL,
    "photo_url" "text"[],
    "bio" "text",
    "music_styles" "text"[],
    "instagram" "text",
    "mixcloud" "text",
    "youtube" "text",
    "sample_mix_urls" "text"[],
    "booking_email" "text",
    "phone" "text",
    "gallery_urls" "text"[],
    "created_at" timestamp without time zone DEFAULT "now"(),
    "nationality" "text",
    "city" "text",
    "public_email" "text",
    "facebook" "text",
    "genres" "text"[],
    "hide_real_name" boolean DEFAULT false,
    "name" "text",
    "real_name" "text",
    "soundcloud" "text",
    "verified" boolean DEFAULT false,
    "website" "text",
    "youtube_url" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "faq" "text",
    "country" "text",
    "first_name" "text",
    "surname" "text",
    "city_id" "uuid",
    "country_code" "text",
    "upcoming_events" "text"[],
    "pricing" "text",
    "whatsapp" "text",
    "email" "text",
    "is_active" boolean,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_source" "text" DEFAULT 'admin_create'::"text",
    "created_by" "uuid"
);


ALTER TABLE "public"."dj_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "city" "text",
    "socials" "jsonb" DEFAULT '{}'::"jsonb",
    "claimed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address" "text",
    "google_maps_url" "text",
    "capacity" integer,
    "parking" "text",
    "closest_transport" "text",
    "gallery_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "opening_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "facilities" "jsonb" DEFAULT '[]'::"jsonb",
    "floor_type" "jsonb" DEFAULT '[]'::"jsonb",
    "contact_email" "text",
    "contact_phone" "text",
    "website" "text",
    "instagram" "text",
    "city_id" "uuid",
    "organisation_category" "text",
    "is_active" boolean,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "profile_source" "text" DEFAULT 'admin_create'::"text"
);


ALTER TABLE "public"."entities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."entities"."is_active" IS 'Three-valued governance: NULL = auto/pending, true = approved/active, false = suspended/hidden.';



COMMENT ON COLUMN "public"."entities"."created_by" IS 'auth.users.id of the admin who created this entity row.';



COMMENT ON COLUMN "public"."entities"."profile_source" IS 'Origin of first write: admin_create, rpc_upsert, org_signup, edge_fn, etc.';



CREATE TABLE IF NOT EXISTS "public"."member_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "based_city_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" DEFAULT ''::"text",
    "last_name" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."member_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organisers" WITH ("security_invoker"='on') AS
 SELECT "id",
    "name" AS "organisation_name",
    NULL::"text" AS "first_name",
    NULL::"text" AS "surname",
    "avatar_url" AS "photo_url",
    "city",
    NULL::"text" AS "city_slug",
    "city_id",
    "socials" AS "meta_data",
    NULL::"jsonb" AS "team",
    NULL::"text" AS "team_members",
    NULL::"text"[] AS "linked_events",
    "bio" AS "description",
    NULL::"text" AS "faq",
    ("socials" ->> 'email'::"text") AS "email",
    NULL::"text" AS "phone",
    NULL::"text" AS "whatsapp",
    ("socials" ->> 'website'::"text") AS "website",
    ("socials" ->> 'instagram'::"text") AS "instagram",
    ("socials" ->> 'facebook'::"text") AS "facebook",
    "claimed_by" AS "user_id",
    NULL::boolean AS "verified",
    true AS "is_active",
    "created_at",
    NULL::timestamp with time zone AS "updated_at"
   FROM "public"."entities" "e"
  WHERE ("type" = 'organiser'::"text");


ALTER VIEW "public"."organisers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "photo_url" "text",
    "teaching_styles" "text"[],
    "instagram" "text",
    "phone" "text",
    "public_email" "text",
    "journey" "text",
    "faq" "text",
    "availability" "text",
    "gallery_urls" "text"[],
    "created_at" timestamp without time zone DEFAULT "now"(),
    "nationality" "text",
    "travel_willingness" "text" DEFAULT 'UK & Europe'::"text",
    "years_teaching" integer DEFAULT 0,
    "offers_private" boolean DEFAULT false,
    "offers_group" boolean DEFAULT true,
    "facebook" "text",
    "hide_surname" boolean DEFAULT false,
    "languages" "text"[],
    "private_lesson_locations" "text"[],
    "private_lesson_types" "text"[],
    "private_travel_distance" numeric,
    "website" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "country" "text",
    "first_name" "text",
    "surname" "text",
    "city_id" "uuid",
    "achievements" "text"[],
    "email" "text",
    "upcoming_events" "text",
    "socials" "jsonb" DEFAULT '{}'::"jsonb",
    "country_code" "text",
    "is_active" boolean,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "profile_source" "text" DEFAULT 'admin_create'::"text"
);


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_people_view" WITH ("security_barrier"='true') AS
 WITH "roles" AS (
         SELECT "dancers_archive_april2026"."user_id",
            'dancers'::"text" AS "role",
            "dancers_archive_april2026"."id" AS "role_row_id"
           FROM "public"."dancers_archive_april2026"
        UNION ALL
         SELECT "teacher_profiles"."user_id",
            'teachers'::"text",
            "teacher_profiles"."id"
           FROM "public"."teacher_profiles"
        UNION ALL
         SELECT "dj_profiles"."user_id",
            'djs'::"text",
            "dj_profiles"."id"
           FROM "public"."dj_profiles"
        UNION ALL
         SELECT "organisers"."user_id",
            'organisers'::"text",
            "organisers"."id"
           FROM "public"."organisers"
        )
 SELECT "r"."user_id",
    "r"."role",
    "r"."role_row_id",
    ("mp"."id" IS NOT NULL) AS "has_identity",
    ("au"."id" IS NOT NULL) AS "has_auth"
   FROM (("roles" "r"
     LEFT JOIN "public"."member_profiles" "mp" ON (("mp"."id" = "r"."user_id")))
     LEFT JOIN "auth"."users" "au" ON (("au"."id" = "r"."user_id")));


ALTER VIEW "public"."admin_people_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_settings_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "target_user_id" "uuid",
    "actor_id" "uuid",
    "reason" "text",
    "before_data" "jsonb",
    "after_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_settings_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_super_users" (
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."admin_super_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_venues_read" AS
 SELECT "v"."id" AS "venue_id",
    "v"."entity_id" AS "venue_entity_id",
    "e"."city_id" AS "entity_city_id",
    "v"."name" AS "venue_name",
    "v"."id",
    "v"."name",
    "v"."photo_url",
    "v"."address",
    "v"."capacity",
    "v"."rules",
    "v"."gallery_urls",
    "v"."opening_hours",
    "v"."created_at",
    "v"."floor_type",
    "v"."website",
    "v"."instagram",
    "v"."facebook",
    "v"."email",
    "v"."phone",
    "v"."hide_paid_parking",
    "v"."user_id",
    "v"."description",
    "v"."meta_data",
    "v"."country",
    "v"."timezone",
    "v"."entity_id",
    "v"."postcode",
    "v"."google_maps_link",
    "v"."bar_available",
    "v"."cloakroom_available",
    "v"."id_required",
    "v"."last_entry_time",
    "v"."venue_rating",
    "v"."video_urls",
    "v"."admin_notes",
    "v"."facilities_new",
    "v"."transport_json",
    "v"."parking_json",
    "v"."faq_json"
   FROM ("public"."venues" "v"
     LEFT JOIN "public"."entities" "e" ON (("e"."id" = "v"."entity_id")));


ALTER VIEW "public"."admin_venues_read" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backend_closure_records" (
    "id" bigint NOT NULL,
    "closure_key" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."backend_closure_records" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."backend_closure_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."backend_closure_records_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."backend_closure_records_id_seq" OWNED BY "public"."backend_closure_records"."id";



CREATE TABLE IF NOT EXISTS "public"."calendar_occurrences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "instance_start" timestamp with time zone NOT NULL,
    "instance_end" timestamp with time zone,
    "source" "text" DEFAULT 'auto'::"text" NOT NULL,
    "is_override" boolean DEFAULT false NOT NULL,
    "override_payload" "jsonb",
    "city_id" "uuid",
    "city_slug" "text",
    "lifecycle_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "venue_id" "uuid",
    CONSTRAINT "calendar_occurrences_valid_interval_check" CHECK ((("instance_end" IS NULL) OR ("instance_start" IS NULL) OR ("instance_end" >= "instance_start")))
);


ALTER TABLE "public"."calendar_occurrences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "country_code" "text" NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "header_image_url" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "country_name" "text",
    "population" integer
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "venue_id" "uuid" NOT NULL,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" "uuid",
    "dancer_ids" "text"[],
    "facebook_url" "text",
    "has_guestlist" boolean DEFAULT false,
    "has_raffle" boolean DEFAULT false,
    "instagram_url" "text",
    "payment_methods" "text",
    "photographer_ids" "text"[],
    "pricing" "jsonb",
    "recurrence" "jsonb",
    "ticket_url" "text",
    "user_id" "text",
    "website" "text",
    "guestlist_config" "text",
    "key_times" "jsonb",
    "promo_codes" "text",
    "raffle_config" "text",
    "tickets" "text",
    "schedule_type" "text",
    "festival_config" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT false,
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "type" "text" DEFAULT 'standard'::"text",
    "attendance_count" integer DEFAULT 0,
    "date" "date",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "faq" "text",
    "country" "text",
    "timezone" "text",
    "city_slug" "text",
    "lifecycle_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "city_id" "uuid",
    "poster_url" "text",
    "parent_event_id" "uuid",
    "source_occurrence_id" "uuid",
    CONSTRAINT "events_lifecycle_status_chk" CHECK (("lifecycle_status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "festival_config_no_numeric_keys" CHECK ((("festival_config" IS NULL) OR (NOT ("festival_config" ? '0'::"text")))),
    CONSTRAINT "key_times_no_numeric_keys" CHECK ((("key_times" IS NULL) OR (NOT ("key_times" ? '0'::"text")))),
    CONSTRAINT "meta_data_no_numeric_keys" CHECK ((("meta_data" IS NULL) OR (NOT ("meta_data" ? '0'::"text")))),
    CONSTRAINT "pricing_no_numeric_keys" CHECK ((("pricing" IS NULL) OR (NOT ("pricing" ? '0'::"text")))),
    CONSTRAINT "recurrence_no_numeric_keys" CHECK ((("recurrence" IS NULL) OR (NOT ("recurrence" ? '0'::"text"))))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."is_active" IS 'Controls whether the event is published (true) or draft (false)';



COMMENT ON COLUMN "public"."events"."meta_data" IS 'Flexible storage for extra event details (gallery, socials, config)';



COMMENT ON COLUMN "public"."events"."city_slug" IS 'DEPRECATED: Not used by Event Page. Writes revoked for anon/authenticated.';



CREATE OR REPLACE VIEW "public"."calendar_feed" AS
 SELECT "co"."event_id",
    "co"."instance_start",
    "co"."instance_end",
    "e"."name",
    "e"."poster_url",
    COALESCE("c_occ"."slug", "c_evt"."slug", NULLIF("btrim"("co"."city_slug"), ''::"text"), NULLIF("btrim"("e"."city_slug"), ''::"text")) AS "city_slug",
    "e"."venue_id",
    "e"."lifecycle_status",
    COALESCE("co"."city_id", "e"."city_id") AS "city_id",
    "e"."ticket_url",
    "e"."website",
    "e"."is_active",
    "e"."type" AS "event_type",
    "e"."created_at",
    "e"."updated_at",
    ("e"."pricing" ->> 'price_display'::"text") AS "price_display",
    "ve"."name" AS "venue_name",
    "co"."id" AS "row_id",
    "c_resolved"."name" AS "city_display"
   FROM (((((("public"."calendar_occurrences" "co"
     JOIN "public"."events" "e" ON (("e"."id" = "co"."event_id")))
     LEFT JOIN "public"."venues" "v" ON (("v"."id" = "e"."venue_id")))
     LEFT JOIN "public"."entities" "ve" ON (("ve"."id" = "v"."entity_id")))
     LEFT JOIN "public"."cities" "c_occ" ON (("c_occ"."id" = "co"."city_id")))
     LEFT JOIN "public"."cities" "c_evt" ON (("c_evt"."id" = "e"."city_id")))
     LEFT JOIN "public"."cities" "c_resolved" ON (("c_resolved"."id" = COALESCE("co"."city_id", "e"."city_id"))))
  WHERE ("e"."lifecycle_status" = 'published'::"text");


ALTER VIEW "public"."calendar_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_occurrence_quarantine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurrence_id" "uuid",
    "event_id" "uuid",
    "reason" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_occurrence_quarantine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "normalized_alias" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "alias"))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."city_aliases" OWNER TO "postgres";


COMMENT ON TABLE "public"."city_aliases" IS 'Alternative names/spellings for cities (e.g. Lisbon → Lisboa). Managed by admins.';



CREATE TABLE IF NOT EXISTS "public"."city_deprecation_usage_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "endpoint" "text",
    "actor_user_id" "uuid",
    "source" "text",
    "payload" "jsonb",
    "legacy_city" "text",
    "legacy_city_slug" "text",
    "provided_city_id" "uuid",
    "resolved_city_id" "uuid",
    "resolution_status" "text",
    "resolution_metadata" "jsonb",
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "processing_notes" "text"
);


ALTER TABLE "public"."city_deprecation_usage_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requested_name" "text" NOT NULL,
    "requested_slug" "text",
    "requested_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "context" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "city_requests_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."city_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dancer_profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "based_city_id" "uuid",
    "avatar_url" "text",
    "dance_role" "text",
    "dance_started_year" integer,
    "nationality" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surname" "text",
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "looking_for_partner" boolean DEFAULT false NOT NULL,
    "partner_search_role" "text",
    "partner_search_level" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "partner_practice_goals" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "partner_details" "text",
    "favorite_styles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "favorite_songs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "achievements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "instagram" "text",
    "facebook" "text",
    "whatsapp" "text",
    "website" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean,
    "profile_source" "text",
    "created_by" "uuid",
    CONSTRAINT "dancer_profiles_dance_role_check" CHECK ((("dance_role" IS NULL) OR ("dance_role" = ANY (ARRAY['Leader'::"text", 'Follower'::"text", 'Lead & Follow'::"text"])))),
    CONSTRAINT "dancer_profiles_dance_started_year_check" CHECK ((("dance_started_year" IS NULL) OR (("dance_started_year" >= 1950) AND ("dance_started_year" <= (EXTRACT(year FROM CURRENT_DATE))::integer))))
);


ALTER TABLE "public"."dancer_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."dancer_profiles"."is_active" IS 'Admin visibility override. NULL = completeness gate decides. TRUE = force visible. FALSE = suspended.';



COMMENT ON COLUMN "public"."dancer_profiles"."profile_source" IS 'Row origin: auto_stub | admin_create | rpc_upsert. Set once on creation; preserved on UPDATE.';



COMMENT ON COLUMN "public"."dancer_profiles"."created_by" IS 'auth.users.id of the actor who created this profile. NULL for auto-stub rows and service-role creates.';



CREATE TABLE IF NOT EXISTS "public"."dancer_profiles_legacy_backup" (
    "user_id" "uuid" NOT NULL,
    "avatar_url" "text" NOT NULL,
    "dance_role" "text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nationality_code" "text",
    "dance_started_year" integer,
    "dance_started_month" integer,
    CONSTRAINT "dancer_profiles_dance_role_check" CHECK (("dance_role" = ANY (ARRAY['leader'::"text", 'follower'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."dancer_profiles_legacy_backup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."djs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "photo_url" "text",
    "bio" "text",
    "city" "text",
    "genres" "text"[],
    "instagram" "text",
    "soundcloud" "text",
    "mixcloud" "text",
    "website" "text",
    "is_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."djs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_auth_bootstrap_manifest" (
    "id" bigint NOT NULL,
    "function_name" "text" NOT NULL,
    "canonical_role" "text" NOT NULL,
    "require_jwt" boolean NOT NULL,
    "env_requirements" "jsonb" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edge_auth_bootstrap_manifest" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."edge_auth_bootstrap_manifest_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."edge_auth_bootstrap_manifest_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."edge_auth_bootstrap_manifest_id_seq" OWNED BY "public"."edge_auth_bootstrap_manifest"."id";



CREATE TABLE IF NOT EXISTS "public"."event_attendees" (
    "event_id" "uuid" NOT NULL,
    "dancer_id" "uuid" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'going'::"text"
);


ALTER TABLE "public"."event_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_audit" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_user_id" "uuid",
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_fields" "jsonb",
    "operation_source" "text"
);


ALTER TABLE "public"."event_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_entities" (
    "event_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "role" "public"."event_entity_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_entities" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_instances" AS
 SELECT "co"."id" AS "occurrence_id",
    "e"."id" AS "event_id",
    "co"."instance_start",
    "co"."instance_end",
    COALESCE("c_occ"."slug", "c_evt"."slug", NULLIF("btrim"("co"."city_slug"), ''::"text"), NULLIF("btrim"("e"."city_slug"), ''::"text")) AS "city_slug",
    "e"."name" AS "event_name",
    "e"."venue_id",
    "ent"."name" AS "venue_name"
   FROM ((((("public"."calendar_occurrences" "co"
     LEFT JOIN "public"."events" "e" ON (("e"."id" = "co"."event_id")))
     LEFT JOIN "public"."venues" "v" ON (("v"."id" = "e"."venue_id")))
     LEFT JOIN "public"."entities" "ent" ON (("ent"."id" = "v"."entity_id")))
     LEFT JOIN "public"."cities" "c_occ" ON (("c_occ"."id" = "co"."city_id")))
     LEFT JOIN "public"."cities" "c_evt" ON (("c_evt"."id" = "e"."city_id")));


ALTER VIEW "public"."event_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "job_type" "text" NOT NULL,
    "payload" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_attempt_at" timestamp with time zone
);


ALTER TABLE "public"."event_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_passes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "name" "text" NOT NULL,
    "tier" "text",
    "type" "text",
    "price" numeric,
    "currency" "text",
    "quantity" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_passes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_posts" (
    "id" bigint NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "thread" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_posts_kind_check" CHECK (("kind" = ANY (ARRAY['board'::"text", 'chat'::"text"])))
);


ALTER TABLE "public"."event_posts" OWNER TO "postgres";


ALTER TABLE "public"."event_posts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."event_posts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."event_profile_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "person_type" "text" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "connection_label" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "event_profile_connections_connection_label_check" CHECK (("connection_label" = ANY (ARRAY['attending'::"text", 'interested'::"text", 'teaching'::"text", 'performing_dj'::"text", 'organising'::"text", 'vendor_partner'::"text"]))),
    CONSTRAINT "event_profile_connections_person_type_check" CHECK (("person_type" = ANY (ARRAY['dancer'::"text", 'organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text"])))
);


ALTER TABLE "public"."event_profile_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_profile_link_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid",
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "profile_type" "text",
    "role" "text",
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_profile_link_audit_action_check" CHECK (("action" = ANY (ARRAY['create'::"text", 'update'::"text", 'archive'::"text", 'approve_suggestion'::"text", 'reject_suggestion'::"text"])))
);


ALTER TABLE "public"."event_profile_link_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_profile_link_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "profile_type" "text" NOT NULL,
    "role" "text" NOT NULL,
    "confidence" numeric(5,2) DEFAULT 0 NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'city_match'::"text" NOT NULL,
    CONSTRAINT "event_profile_link_suggestions_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text", 'dancer'::"text", 'venue'::"text"]))),
    CONSTRAINT "event_profile_link_suggestions_role_check" CHECK (("role" = ANY (ARRAY['organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text", 'dancer'::"text", 'venue'::"text"]))),
    CONSTRAINT "event_profile_link_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."event_profile_link_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_program_djs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_item_id" "uuid",
    "profile_id" "uuid"
);


ALTER TABLE "public"."event_program_djs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_program_instructors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_item_id" "uuid",
    "profile_id" "uuid"
);


ALTER TABLE "public"."event_program_instructors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_program_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "track_id" "uuid",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "legacy_id" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "day" "text",
    "room" "text",
    "description" "text"
);


ALTER TABLE "public"."event_program_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "status" "text" DEFAULT 'confirmed'::"text",
    "amount_paid" numeric DEFAULT 0,
    "user_id" "uuid"
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_tracks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "legacy_id" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."event_tracks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text"
);


ALTER TABLE "public"."event_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "flag_name" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_dancer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "surname" "text",
    "avatar_url" "text",
    "dance_role" "text",
    "city_id" "uuid",
    "instagram" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guest_dancer_profiles_dance_role_check" CHECK ((("dance_role" IS NULL) OR ("dance_role" = ANY (ARRAY['Leader'::"text", 'Follower'::"text", 'Lead & Follow'::"text"]))))
);


ALTER TABLE "public"."guest_dancer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hardening_preserve_baseline" (
    "run_id" "uuid" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_super_users_count" integer NOT NULL,
    "admin_link_managers_count" integer NOT NULL,
    "admin_manager_city_scopes_count" integer NOT NULL,
    "admin_users_count" integer NOT NULL,
    "countries_count" integer NOT NULL,
    "cities_count" integer NOT NULL,
    "city_aliases_count" integer NOT NULL
);


ALTER TABLE "public"."hardening_preserve_baseline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hardening_seed_contract_snapshot" (
    "id" bigint NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recurrence_payload" "jsonb" NOT NULL,
    "override_payload" "jsonb" NOT NULL
);


ALTER TABLE "public"."hardening_seed_contract_snapshot" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."hardening_seed_contract_snapshot_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."hardening_seed_contract_snapshot_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."hardening_seed_contract_snapshot_id_seq" OWNED BY "public"."hardening_seed_contract_snapshot"."id";



CREATE TABLE IF NOT EXISTS "public"."idempotency" (
    "key" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "status" "text" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "idempotency_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."idempotency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "country_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_admin" boolean DEFAULT false,
    "based_city_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."member_profiles_directory" AS
 SELECT DISTINCT ON ("mp"."id") "mp"."id",
    "mp"."first_name",
    "mp"."last_name",
    "mp"."full_name",
    "mp"."avatar_url",
    "mp"."based_city_id",
    "p"."email",
    "e"."name" AS "entity_name",
    "c"."name" AS "city_name"
   FROM ((("public"."member_profiles" "mp"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "mp"."id")))
     LEFT JOIN "public"."entities" "e" ON (("e"."claimed_by" = "mp"."id")))
     LEFT JOIN "public"."cities" "c" ON (("c"."id" = "mp"."based_city_id")))
  ORDER BY "mp"."id", "e"."name", "e"."id";


ALTER VIEW "public"."member_profiles_directory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "target_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "onboarding_targets_category_check" CHECK (("category" = ANY (ARRAY['teachers'::"text", 'djs'::"text", 'organisers'::"text", 'venues'::"text", 'dancers'::"text", 'videographers'::"text"]))),
    CONSTRAINT "onboarding_targets_target_count_check" CHECK (("target_count" >= 0))
);


ALTER TABLE "public"."onboarding_targets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organiser_admin_dashboard_v1" AS
 SELECT "e"."id",
    "e"."type",
    "e"."name",
    "e"."avatar_url",
    "e"."city_id",
    "e"."organisation_category",
    "e"."contact_phone",
    "e"."website",
    "e"."instagram",
    "e"."socials",
    "e"."claimed_by",
    "c"."name" AS "city_name"
   FROM ("public"."entities" "e"
     LEFT JOIN "public"."cities" "c" ON (("c"."id" = "e"."city_id")))
  WHERE ("e"."type" = 'organiser'::"text");


ALTER VIEW "public"."organiser_admin_dashboard_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organiser_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organiser_entity_id" "uuid" NOT NULL,
    "role" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "member_profile_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_head" boolean DEFAULT false,
    "is_leader" boolean DEFAULT false NOT NULL,
    "capacity" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organiser_team_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organiser_admin_dashboard_v2" AS
 SELECT "e"."id",
    "e"."type",
    "e"."name",
    "e"."avatar_url",
    "e"."city_id",
    "e"."organisation_category",
    "e"."contact_phone",
    "e"."website",
    "e"."instagram",
    "e"."socials",
    "e"."claimed_by",
    "c"."name" AS "city_name",
    "e"."created_at",
    "e"."updated_at",
    "e"."is_active",
    "e"."profile_source",
    "e"."created_by",
    COALESCE("team_agg"."member_count", 0) AS "team_member_count",
    COALESCE("event_agg"."event_count", 0) AS "linked_event_count",
    "leader_agg"."leader_name",
    ("leader_agg"."active_leader_count" = 1) AS "has_leader",
    ("leader_agg"."active_leader_count" > 1) AS "leader_corruption"
   FROM (((("public"."entities" "e"
     LEFT JOIN "public"."cities" "c" ON (("c"."id" = "e"."city_id")))
     LEFT JOIN LATERAL ( SELECT ("count"(*))::integer AS "member_count"
           FROM "public"."organiser_team_members" "otm"
          WHERE (("otm"."organiser_entity_id" = "e"."id") AND ("otm"."is_active" = true))) "team_agg" ON (true))
     LEFT JOIN LATERAL ( SELECT ("count"(*))::integer AS "event_count"
           FROM "public"."event_entities" "ee"
          WHERE (("ee"."entity_id" = "e"."id") AND ("ee"."role" = 'organiser'::"public"."event_entity_role"))) "event_agg" ON (true))
     LEFT JOIN LATERAL ( SELECT ("count"(*))::integer AS "active_leader_count",
                CASE
                    WHEN ("count"(*) = 1) THEN "min"(COALESCE(NULLIF(TRIM(BOTH FROM "mp"."full_name"), ''::"text"), NULLIF(TRIM(BOTH FROM ((COALESCE("mp"."first_name", ''::"text") || ' '::"text") || COALESCE("mp"."last_name", ''::"text"))), ''::"text")))
                    ELSE NULL::"text"
                END AS "leader_name"
           FROM ("public"."organiser_team_members" "otm"
             JOIN "public"."member_profiles" "mp" ON (("mp"."id" = "otm"."member_profile_id")))
          WHERE (("otm"."organiser_entity_id" = "e"."id") AND ("otm"."is_leader" = true) AND ("otm"."is_active" = true))) "leader_agg" ON (true))
  WHERE ("e"."type" = 'organiser'::"text");


ALTER VIEW "public"."organiser_admin_dashboard_v2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_account_links" (
    "person_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "verification_status" "text" DEFAULT 'verified'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "person_account_links_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."person_account_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."person_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_profiles" (
    "person_id" "uuid" NOT NULL,
    "profile_type" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "person_profiles_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['dancer'::"text", 'organiser'::"text", 'teacher'::"text", 'dj'::"text", 'vendor'::"text", 'videographer'::"text"])))
);


ALTER TABLE "public"."person_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phase4_tmp_occurrence_write_city_compat_audit" (
    "id" bigint NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "function_name" "text" NOT NULL,
    "event_id" "uuid",
    "auth_uid" "uuid",
    "jwt_sub" "text",
    "jwt_role" "text",
    "db_user" "text" DEFAULT CURRENT_USER NOT NULL,
    "session_user_name" "text" DEFAULT SESSION_USER NOT NULL,
    "has_city_slug" boolean NOT NULL,
    "has_city_id" boolean NOT NULL,
    "replace_mode" boolean,
    "occurrence_count" integer
);


ALTER TABLE "public"."phase4_tmp_occurrence_write_city_compat_audit" OWNER TO "postgres";


ALTER TABLE "public"."phase4_tmp_occurrence_write_city_compat_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."phase4_tmp_occurrence_write_city_compat_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "profile_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "claim_name" "text" NOT NULL,
    "claim_email" "text" NOT NULL,
    "claim_phone" "text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profile_claims_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['teacher'::"text", 'organiser'::"text", 'dj'::"text"]))),
    CONSTRAINT "profile_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profile_claims" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_visible_dancers" WITH ("security_invoker"='true') AS
 SELECT "id",
    "first_name",
    "based_city_id",
    "avatar_url",
    "dance_role",
    "dance_started_year",
    "nationality"
   FROM "public"."dancer_profiles" "dp"
  WHERE (("is_active" IS NOT FALSE) AND ("first_name" IS NOT NULL) AND ("btrim"("first_name") <> ''::"text") AND ("based_city_id" IS NOT NULL) AND ("avatar_url" IS NOT NULL) AND ("btrim"("avatar_url") <> ''::"text") AND ("dance_role" IS NOT NULL) AND ("btrim"("dance_role") <> ''::"text") AND ("dance_started_year" IS NOT NULL));


ALTER VIEW "public"."public_visible_dancers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rpc_city_compat_audit" (
    "id" bigint NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rpc_name" "text" NOT NULL,
    "request_role" "text",
    "request_sub" "text",
    "request_iss" "text",
    "auth_uid" "uuid",
    "has_city" boolean NOT NULL,
    "has_city_slug" boolean NOT NULL,
    "has_city_id" boolean NOT NULL
);


ALTER TABLE "public"."rpc_city_compat_audit" OWNER TO "postgres";


ALTER TABLE "public"."rpc_city_compat_audit" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rpc_city_compat_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rpc_deprecation_log" (
    "id" bigint NOT NULL,
    "function_name" "text" NOT NULL,
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_uid" "uuid",
    "params" "jsonb",
    "client_ip" "inet"
);


ALTER TABLE "public"."rpc_deprecation_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rpc_deprecation_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rpc_deprecation_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rpc_deprecation_log_id_seq" OWNED BY "public"."rpc_deprecation_log"."id";



CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "artist" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_cities" (
    "name" "text",
    "country_code" "text",
    "country_name" "text",
    "population" integer,
    "timezone" "text"
);


ALTER TABLE "public"."staging_cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trigger_layer_manifest" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "trigger_name" "text" NOT NULL,
    "function_name" "text" NOT NULL,
    "trigger_def" "text" NOT NULL,
    "function_def" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trigger_layer_manifest" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trigger_layer_manifest_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trigger_layer_manifest_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trigger_layer_manifest_id_seq" OWNED BY "public"."trigger_layer_manifest"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "business_name" "text",
    "photo_url" "text"[],
    "product_categories" "text"[],
    "ships_international" boolean,
    "website" "text",
    "instagram" "text",
    "facebook" "text",
    "public_email" "text",
    "city" "text",
    "products" "jsonb",
    "upcoming_events" "text"[],
    "whatsapp" "text",
    "promo_code" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "faq" "text",
    "promo_discount_type" "text",
    "promo_discount_value" numeric,
    "team" "jsonb" DEFAULT '[]'::"jsonb",
    "city_id" "uuid",
    "country_code" "text",
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[],
    "product_photos" "text"[],
    "representative_name" "text",
    "first_name" "text",
    "surname" "text",
    "country" "text",
    "address" "text",
    "email" "text",
    "phone" "text",
    "short_description" "text",
    "description" "text",
    "verified" boolean DEFAULT false,
    "is_active" boolean,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_source" "text",
    "created_by" "uuid"
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vendors"."team" IS 'Array of team members: [{id, name, role, type, avatar_url}]';



CREATE TABLE IF NOT EXISTS "public"."videographers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "verified" boolean,
    "business_name" "text",
    "photo_url" "text"[],
    "gallery_urls" "text"[],
    "bio" "text",
    "videography_styles" "text"[],
    "city" "text",
    "website" "text",
    "instagram" "text",
    "facebook" "text",
    "public_email" "text",
    "phone" "text",
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "faq" "text",
    "first_name" "text",
    "surname" "text",
    "team" "jsonb" DEFAULT '[]'::"jsonb",
    "city_id" "uuid",
    "country_code" "text",
    "equipment" "text",
    "travel_options" "text",
    "upcoming_events" "text"[],
    "nationality" "text",
    "country" "text",
    "address" "text",
    "email" "text",
    "whatsapp" "text",
    "short_description" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_source" "text" DEFAULT 'admin_create'::"text",
    "created_by" "uuid"
);


ALTER TABLE "public"."videographers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_event_page_resolved" AS
 SELECT "event_id",
    "occurrence_id",
    "event",
    "occurrence",
    "location",
    "organiser",
    "lineup",
    COALESCE((("occurrence" ->> 'city_id'::"text"))::"uuid", ((("location" -> 'city'::"text") ->> 'id'::"text"))::"uuid") AS "city_id",
    "jsonb_build_object"('name',
        CASE
            WHEN ((("location" -> 'city'::"text") ->> 'name'::"text") ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::"text") THEN NULL::"text"
            ELSE (("location" -> 'city'::"text") ->> 'name'::"text")
        END, 'slug', (("location" -> 'city'::"text") ->> 'slug'::"text"), 'is_derived', true, 'authoritative_source', 'city_id') AS "city_display"
   FROM ( WITH "base" AS (
                 SELECT "e"."id" AS "event_id",
                    "occ"."id" AS "occurrence_id",
                    "jsonb_build_object"('id', "e"."id", 'name', "e"."name", 'description', "e"."description", 'type', "e"."type", 'is_active', "e"."is_active", 'lifecycle_status', "e"."lifecycle_status", 'poster_url', "e"."poster_url", 'actions', "jsonb_build_object"('ticket_url', "e"."ticket_url", 'website', "e"."website", 'facebook_url', "e"."facebook_url", 'instagram_url', "e"."instagram_url", 'pricing', "e"."pricing"), 'created_at', "e"."created_at", 'updated_at', "e"."updated_at") AS "event",
                        CASE
                            WHEN ("occ"."id" IS NULL) THEN NULL::"jsonb"
                            ELSE "jsonb_build_object"('id', "occ"."id", 'instance_start', "occ"."instance_start", 'instance_end', "occ"."instance_end", 'city_id', COALESCE("occ"."city_id", "e"."city_id"), 'venue_id', COALESCE("occ"."venue_id", "e"."venue_id"), 'timezone', NULL::"unknown", 'lifecycle_status', "occ"."lifecycle_status")
                        END AS "occurrence",
                    COALESCE("occ"."city_id", "e"."city_id") AS "resolved_city_id",
                    COALESCE("occ"."venue_id", "e"."venue_id") AS "resolved_venue_id"
                   FROM ("public"."events" "e"
                     LEFT JOIN "public"."calendar_occurrences" "occ" ON (("occ"."event_id" = "e"."id")))
                ), "city_block" AS (
                 SELECT "b"."event_id",
                    "b"."occurrence_id",
                    "b"."event",
                    "b"."occurrence",
                    "b"."resolved_city_id",
                    "b"."resolved_venue_id",
                    "ci"."timezone" AS "city_tz",
                    "jsonb_build_object"('id', "ci"."id", 'name', "ci"."name", 'slug', "ci"."slug", 'country_code', "ci"."country_code", 'timezone', "ci"."timezone") AS "city_json"
                   FROM ("base" "b"
                     LEFT JOIN "public"."cities" "ci" ON (("ci"."id" = "b"."resolved_city_id")))
                ), "venue_block" AS (
                 SELECT "c"."event_id",
                    "c"."occurrence_id",
                    "c"."event",
                    "c"."occurrence",
                    "c"."city_json",
                    "c"."city_tz",
                    "v"."timezone" AS "venue_tz",
                    "jsonb_build_object"('id', "v"."id", 'name', "ve"."name", 'address', "v"."address", 'google_maps_url', "v"."google_maps_url", 'city_id', "ve"."city_id", 'google_maps_link', "v"."google_maps_link", 'timezone', "v"."timezone") AS "venue_json"
                   FROM (("city_block" "c"
                     LEFT JOIN "public"."venues" "v" ON (("v"."id" = "c"."resolved_venue_id")))
                     LEFT JOIN "public"."entities" "ve" ON (("ve"."id" = "v"."entity_id")))
                ), "organiser_block" AS (
                 SELECT "vb"."event_id",
                    "vb"."occurrence_id",
                    "vb"."event",
                    "vb"."occurrence",
                    "vb"."city_json",
                    "vb"."city_tz",
                    "vb"."venue_json",
                    "vb"."venue_tz",
                    ( SELECT "jsonb_build_object"('id', "en"."id", 'type', "en"."type", 'name', "en"."name", 'avatar_url', "en"."avatar_url", 'city_id', "en"."city_id", 'website', "en"."website", 'instagram', "en"."instagram") AS "jsonb_build_object"
                           FROM ("public"."event_entities" "ee"
                             JOIN "public"."entities" "en" ON (("en"."id" = "ee"."entity_id")))
                          WHERE (("ee"."event_id" = "vb"."event_id") AND ("ee"."role" = 'organiser'::"public"."event_entity_role"))
                          ORDER BY "en"."name", "en"."id"
                         LIMIT 1) AS "organiser"
                   FROM "venue_block" "vb"
                ), "lineup_block" AS (
                 SELECT "ob"."event_id",
                    "ob"."occurrence_id",
                    "ob"."event",
                    "ob"."occurrence",
                    "ob"."city_json",
                    "ob"."city_tz",
                    "ob"."venue_json",
                    "ob"."venue_tz",
                    "ob"."organiser",
                    ( SELECT COALESCE("jsonb_agg"("s"."x" ORDER BY ("s"."x" ->> 'scope'::"text") DESC, (("s"."x" ->> 'is_primary'::"text"))::boolean DESC, ("s"."x" ->> 'name'::"text")), '[]'::"jsonb") AS "coalesce"
                           FROM ( SELECT "jsonb_build_object"('id', "epl"."profile_id", 'type', "epl"."profile_type", 'name', COALESCE((("d"."first_name" || ' '::"text") || "d"."surname"), "en"."name"), 'avatar_url', COALESCE("d"."photo_url", "en"."avatar_url"), 'city_id', COALESCE("d"."city_id", "en"."city_id"), 'is_primary', "epl"."is_primary", 'role', "epl"."role", 'occurrence_id', "epl"."occurrence_id", 'scope',
CASE
 WHEN ("epl"."occurrence_id" IS NULL) THEN 'series'::"text"
 ELSE 'occurrence'::"text"
END) AS "x"
                                   FROM (("public"."event_profile_links" "epl"
                                     LEFT JOIN "public"."dancers_archive_april2026" "d" ON ((("d"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'dancer'::"text"))))
                                     LEFT JOIN "public"."entities" "en" ON ((("en"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'organiser'::"text"))))
                                  WHERE (("epl"."event_id" = "ob"."event_id") AND ("epl"."status" = 'active'::"text") AND ("epl"."archived_at" IS NULL) AND ((("ob"."occurrence_id" IS NULL) AND ("epl"."occurrence_id" IS NULL)) OR (("ob"."occurrence_id" IS NOT NULL) AND (("epl"."occurrence_id" IS NULL) OR ("epl"."occurrence_id" = "ob"."occurrence_id")))) AND ("epl"."profile_type" = 'dancer'::"text"))) "s") AS "lineup_dancers",
                    ( SELECT COALESCE("jsonb_agg"("s"."x" ORDER BY ("s"."x" ->> 'scope'::"text") DESC, (("s"."x" ->> 'is_primary'::"text"))::boolean DESC, ("s"."x" ->> 'name'::"text")), '[]'::"jsonb") AS "coalesce"
                           FROM ( SELECT "jsonb_build_object"('id', "epl"."profile_id", 'type', "epl"."profile_type", 'name', COALESCE("dj"."name", "en"."name"), 'avatar_url', COALESCE("dj"."photo_url"[1], "en"."avatar_url"), 'city_id', COALESCE("dj"."city_id", "en"."city_id"), 'is_primary', "epl"."is_primary", 'role', "epl"."role", 'occurrence_id', "epl"."occurrence_id", 'scope',
CASE
 WHEN ("epl"."occurrence_id" IS NULL) THEN 'series'::"text"
 ELSE 'occurrence'::"text"
END) AS "x"
                                   FROM (("public"."event_profile_links" "epl"
                                     LEFT JOIN "public"."dj_profiles" "dj" ON ((("dj"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'dj'::"text"))))
                                     LEFT JOIN "public"."entities" "en" ON ((("en"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'organiser'::"text"))))
                                  WHERE (("epl"."event_id" = "ob"."event_id") AND ("epl"."status" = 'active'::"text") AND ("epl"."archived_at" IS NULL) AND ((("ob"."occurrence_id" IS NULL) AND ("epl"."occurrence_id" IS NULL)) OR (("ob"."occurrence_id" IS NOT NULL) AND (("epl"."occurrence_id" IS NULL) OR ("epl"."occurrence_id" = "ob"."occurrence_id")))) AND ("epl"."profile_type" = 'dj'::"text"))) "s") AS "lineup_djs",
                    ( SELECT COALESCE("jsonb_agg"("s"."x" ORDER BY ("s"."x" ->> 'scope'::"text") DESC, (("s"."x" ->> 'is_primary'::"text"))::boolean DESC, ("s"."x" ->> 'name'::"text")), '[]'::"jsonb") AS "coalesce"
                           FROM ( SELECT "jsonb_build_object"('id', "epl"."profile_id", 'type', "epl"."profile_type", 'name', COALESCE((("tp"."first_name" || ' '::"text") || "tp"."surname"), "en"."name"), 'avatar_url', COALESCE("tp"."photo_url", "en"."avatar_url"), 'city_id', COALESCE("tp"."city_id", "en"."city_id"), 'is_primary', "epl"."is_primary", 'role', "epl"."role", 'occurrence_id', "epl"."occurrence_id", 'scope',
CASE
 WHEN ("epl"."occurrence_id" IS NULL) THEN 'series'::"text"
 ELSE 'occurrence'::"text"
END) AS "x"
                                   FROM (("public"."event_profile_links" "epl"
                                     LEFT JOIN "public"."teacher_profiles" "tp" ON ((("tp"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'teacher'::"text"))))
                                     LEFT JOIN "public"."entities" "en" ON ((("en"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'organiser'::"text"))))
                                  WHERE (("epl"."event_id" = "ob"."event_id") AND ("epl"."status" = 'active'::"text") AND ("epl"."archived_at" IS NULL) AND ((("ob"."occurrence_id" IS NULL) AND ("epl"."occurrence_id" IS NULL)) OR (("ob"."occurrence_id" IS NOT NULL) AND (("epl"."occurrence_id" IS NULL) OR ("epl"."occurrence_id" = "ob"."occurrence_id")))) AND ("epl"."profile_type" = 'teacher'::"text"))) "s") AS "lineup_teachers",
                    ( SELECT COALESCE("jsonb_agg"("s"."x" ORDER BY ("s"."x" ->> 'scope'::"text") DESC, (("s"."x" ->> 'is_primary'::"text"))::boolean DESC, ("s"."x" ->> 'name'::"text")), '[]'::"jsonb") AS "coalesce"
                           FROM ( SELECT "jsonb_build_object"('id', "epl"."profile_id", 'type', "epl"."profile_type", 'name', COALESCE("vn"."business_name", "en"."name"), 'avatar_url', COALESCE("vn"."photo_url"[1], "en"."avatar_url"), 'city_id', COALESCE("vn"."city_id", "en"."city_id"), 'is_primary', "epl"."is_primary", 'role', "epl"."role", 'occurrence_id', "epl"."occurrence_id", 'scope',
CASE
 WHEN ("epl"."occurrence_id" IS NULL) THEN 'series'::"text"
 ELSE 'occurrence'::"text"
END) AS "x"
                                   FROM (("public"."event_profile_links" "epl"
                                     LEFT JOIN "public"."vendors" "vn" ON ((("vn"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'vendor'::"text"))))
                                     LEFT JOIN "public"."entities" "en" ON ((("en"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'organiser'::"text"))))
                                  WHERE (("epl"."event_id" = "ob"."event_id") AND ("epl"."status" = 'active'::"text") AND ("epl"."archived_at" IS NULL) AND ((("ob"."occurrence_id" IS NULL) AND ("epl"."occurrence_id" IS NULL)) OR (("ob"."occurrence_id" IS NOT NULL) AND (("epl"."occurrence_id" IS NULL) OR ("epl"."occurrence_id" = "ob"."occurrence_id")))) AND ("epl"."profile_type" = 'vendor'::"text"))) "s") AS "lineup_vendors",
                    ( SELECT COALESCE("jsonb_agg"("s"."x" ORDER BY ("s"."x" ->> 'scope'::"text") DESC, (("s"."x" ->> 'is_primary'::"text"))::boolean DESC, ("s"."x" ->> 'name'::"text")), '[]'::"jsonb") AS "coalesce"
                           FROM ( SELECT "jsonb_build_object"('id', "epl"."profile_id", 'type', "epl"."profile_type", 'name', COALESCE("vg"."business_name", "en"."name"), 'avatar_url', COALESCE("vg"."photo_url"[1], "en"."avatar_url"), 'city_id', COALESCE("vg"."city_id", "en"."city_id"), 'is_primary', "epl"."is_primary", 'role', "epl"."role", 'occurrence_id', "epl"."occurrence_id", 'scope',
CASE
 WHEN ("epl"."occurrence_id" IS NULL) THEN 'series'::"text"
 ELSE 'occurrence'::"text"
END) AS "x"
                                   FROM (("public"."event_profile_links" "epl"
                                     LEFT JOIN "public"."videographers" "vg" ON ((("vg"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'videographer'::"text"))))
                                     LEFT JOIN "public"."entities" "en" ON ((("en"."id" = "epl"."profile_id") AND ("epl"."profile_type" = 'organiser'::"text"))))
                                  WHERE (("epl"."event_id" = "ob"."event_id") AND ("epl"."status" = 'active'::"text") AND ("epl"."archived_at" IS NULL) AND ((("ob"."occurrence_id" IS NULL) AND ("epl"."occurrence_id" IS NULL)) OR (("ob"."occurrence_id" IS NOT NULL) AND (("epl"."occurrence_id" IS NULL) OR ("epl"."occurrence_id" = "ob"."occurrence_id")))) AND ("epl"."profile_type" = 'videographer'::"text"))) "s") AS "lineup_videographers"
                   FROM "organiser_block" "ob"
                )
         SELECT "lineup_block"."event_id",
            "lineup_block"."occurrence_id",
            "lineup_block"."event",
                CASE
                    WHEN ("lineup_block"."occurrence" IS NULL) THEN NULL::"jsonb"
                    ELSE "jsonb_set"("lineup_block"."occurrence", '{timezone}'::"text"[], "to_jsonb"(COALESCE("lineup_block"."city_tz", "lineup_block"."venue_tz", ("lineup_block"."event" ->> 'timezone'::"text"), 'UTC'::"text")))
                END AS "occurrence",
            "jsonb_build_object"('city', "lineup_block"."city_json", 'venue', "lineup_block"."venue_json", 'timezone', COALESCE("lineup_block"."city_tz", "lineup_block"."venue_tz", ("lineup_block"."event" ->> 'timezone'::"text"), 'UTC'::"text")) AS "location",
            "lineup_block"."organiser",
            "jsonb_build_object"('dancers', "lineup_block"."lineup_dancers", 'djs', "lineup_block"."lineup_djs", 'teachers', "lineup_block"."lineup_teachers", 'vendors', "lineup_block"."lineup_vendors", 'videographers', "lineup_block"."lineup_videographers") AS "lineup"
           FROM "lineup_block") "q";


ALTER VIEW "public"."v_event_page_resolved" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_event_page_snapshot" AS
 SELECT "e"."id" AS "event_id",
    "e"."name",
    "e"."description",
    "e"."lifecycle_status" AS "status",
    "e"."is_published",
    "e"."created_by",
    "e"."poster_url",
    "e"."website",
    "e"."facebook_url",
    "e"."instagram_url",
    "e"."ticket_url",
    COALESCE("e"."pricing", '{}'::"jsonb") AS "pricing",
    "e"."timezone" AS "event_timezone",
    "e"."city_id" AS "default_city_id",
    "e"."venue_id" AS "default_venue_id",
    "e"."city_id",
    "jsonb_build_object"('name',
        CASE
            WHEN ("c"."name" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::"text") THEN NULL::"text"
            ELSE "c"."name"
        END, 'slug', "c"."slug", 'is_derived', true, 'authoritative_source', 'city_id') AS "city_display"
   FROM ("public"."events" "e"
     LEFT JOIN "public"."cities" "c" ON (("c"."id" = "e"."city_id")));


ALTER VIEW "public"."v_event_page_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."v_is_admin" (
    "coalesce" boolean
);


ALTER TABLE "public"."v_is_admin" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."venue_city_audit_view" AS
 SELECT "v"."id" AS "venue_id",
    "v"."entity_id" AS "venue_entity_id",
    "e"."city_id" AS "entity_city_id",
    "e"."city_id" AS "venue_city_id",
    false AS "drift_flag",
    false AS "needs_backfill"
   FROM ("public"."venues" "v"
     LEFT JOIN "public"."entities" "e" ON (("e"."id" = "v"."entity_id")));


ALTER VIEW "public"."venue_city_audit_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."backend_closure_records" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."backend_closure_records_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."edge_auth_bootstrap_manifest" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."edge_auth_bootstrap_manifest_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."hardening_seed_contract_snapshot" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."hardening_seed_contract_snapshot_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rpc_deprecation_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rpc_deprecation_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trigger_layer_manifest" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trigger_layer_manifest_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_link_managers"
    ADD CONSTRAINT "admin_link_managers_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."admin_manager_city_scopes"
    ADD CONSTRAINT "admin_manager_city_scopes_pkey" PRIMARY KEY ("user_id", "city_id");



ALTER TABLE ONLY "public"."admin_settings_audit"
    ADD CONSTRAINT "admin_settings_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_super_users"
    ADD CONSTRAINT "admin_super_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."backend_closure_records"
    ADD CONSTRAINT "backend_closure_records_closure_key_key" UNIQUE ("closure_key");



ALTER TABLE ONLY "public"."backend_closure_records"
    ADD CONSTRAINT "backend_closure_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_occurrence_quarantine"
    ADD CONSTRAINT "calendar_occurrence_quarantine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_occurrences"
    ADD CONSTRAINT "calendar_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."city_aliases"
    ADD CONSTRAINT "city_aliases_city_id_normalized_alias_key" UNIQUE ("city_id", "normalized_alias");



ALTER TABLE ONLY "public"."city_aliases"
    ADD CONSTRAINT "city_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_deprecation_usage_audit"
    ADD CONSTRAINT "city_deprecation_usage_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_requests"
    ADD CONSTRAINT "city_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."dancer_profiles_legacy_backup"
    ADD CONSTRAINT "dancer_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."dancer_profiles"
    ADD CONSTRAINT "dancer_profiles_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dancers_archive_april2026"
    ADD CONSTRAINT "dancers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dancers_archive_april2026"
    ADD CONSTRAINT "dancers_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."dj_profiles"
    ADD CONSTRAINT "dj_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."djs"
    ADD CONSTRAINT "djs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_auth_bootstrap_manifest"
    ADD CONSTRAINT "edge_auth_bootstrap_manifest_function_name_key" UNIQUE ("function_name");



ALTER TABLE ONLY "public"."edge_auth_bootstrap_manifest"
    ADD CONSTRAINT "edge_auth_bootstrap_manifest_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."entities"
    ADD CONSTRAINT "entities_organisation_category_chk" CHECK ((("type" <> 'organiser'::"text") OR (("organisation_category" IS NOT NULL) AND ("organisation_category" = ANY (ARRAY['Promoter'::"text", 'Dance School'::"text", 'Festival Brand'::"text", 'Event Brand'::"text", 'Community Group'::"text", 'Venue'::"text", 'Travel Group'::"text", 'Production Team'::"text"]))))) NOT VALID;



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_occurrence_id_user_id_key" UNIQUE ("occurrence_id", "user_id");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("event_id", "dancer_id");



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_unique" UNIQUE ("event_id", "dancer_id");



ALTER TABLE ONLY "public"."event_audit"
    ADD CONSTRAINT "event_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_entities"
    ADD CONSTRAINT "event_entities_event_role_entity_uniq" UNIQUE ("event_id", "role", "entity_id");



ALTER TABLE ONLY "public"."event_entities"
    ADD CONSTRAINT "event_entities_pkey" PRIMARY KEY ("event_id", "entity_id", "role");



ALTER TABLE ONLY "public"."event_jobs"
    ADD CONSTRAINT "event_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_passes"
    ADD CONSTRAINT "event_passes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_permissions"
    ADD CONSTRAINT "event_permissions_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_permissions"
    ADD CONSTRAINT "event_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_posts"
    ADD CONSTRAINT "event_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_profile_connections"
    ADD CONSTRAINT "event_profile_connections_event_id_person_type_person_id_co_key" UNIQUE ("event_id", "person_type", "person_id", "connection_label");



ALTER TABLE ONLY "public"."event_profile_connections"
    ADD CONSTRAINT "event_profile_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_profile_link_audit"
    ADD CONSTRAINT "event_profile_link_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_profile_link_suggestions"
    ADD CONSTRAINT "event_profile_link_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_profile_links"
    ADD CONSTRAINT "event_profile_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_program_djs"
    ADD CONSTRAINT "event_program_djs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_program_djs"
    ADD CONSTRAINT "event_program_djs_unique" UNIQUE ("program_item_id", "profile_id");



ALTER TABLE ONLY "public"."event_program_instructors"
    ADD CONSTRAINT "event_program_instructors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_program_instructors"
    ADD CONSTRAINT "event_program_instructors_unique" UNIQUE ("program_item_id", "profile_id");



ALTER TABLE ONLY "public"."event_program_items"
    ADD CONSTRAINT "event_program_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_tracks"
    ADD CONSTRAINT "event_tracks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_views"
    ADD CONSTRAINT "event_views_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."events"
    ADD CONSTRAINT "events_country_city_required" CHECK ((("is_active" = false) OR (("country" IS NOT NULL) AND ("city_id" IS NOT NULL)))) NOT VALID;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."events"
    ADD CONSTRAINT "events_publish_requirements_chk" CHECK ((("lifecycle_status" <> 'published'::"text") OR (("name" IS NOT NULL) AND ("btrim"("name") <> ''::"text") AND ("start_time" IS NOT NULL) AND ("city_id" IS NOT NULL) AND ("venue_id" IS NOT NULL)))) NOT VALID;



ALTER TABLE "public"."events"
    ADD CONSTRAINT "events_time_order_chk" CHECK ((("start_time" IS NULL) OR ("end_time" IS NULL) OR ("end_time" > "start_time"))) NOT VALID;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("flag_name");



ALTER TABLE ONLY "public"."guest_dancer_profiles"
    ADD CONSTRAINT "guest_dancer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hardening_preserve_baseline"
    ADD CONSTRAINT "hardening_preserve_baseline_pkey" PRIMARY KEY ("run_id");



ALTER TABLE ONLY "public"."hardening_seed_contract_snapshot"
    ADD CONSTRAINT "hardening_seed_contract_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency"
    ADD CONSTRAINT "idempotency_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."member_profiles"
    ADD CONSTRAINT "member_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_targets"
    ADD CONSTRAINT "onboarding_targets_city_id_category_key" UNIQUE ("city_id", "category");



ALTER TABLE ONLY "public"."onboarding_targets"
    ADD CONSTRAINT "onboarding_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organiser_team_members"
    ADD CONSTRAINT "organiser_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_account_links"
    ADD CONSTRAINT "person_account_links_pkey" PRIMARY KEY ("person_id", "user_id");



ALTER TABLE ONLY "public"."person_identities"
    ADD CONSTRAINT "person_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_profiles"
    ADD CONSTRAINT "person_profiles_pkey" PRIMARY KEY ("person_id", "profile_type", "profile_id");



ALTER TABLE ONLY "public"."person_profiles"
    ADD CONSTRAINT "person_profiles_profile_type_profile_id_key" UNIQUE ("profile_type", "profile_id");



ALTER TABLE ONLY "public"."phase4_tmp_occurrence_write_city_compat_audit"
    ADD CONSTRAINT "phase4_tmp_occurrence_write_city_compat_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videographers"
    ADD CONSTRAINT "photographers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."rpc_city_compat_audit"
    ADD CONSTRAINT "rpc_city_compat_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rpc_deprecation_log"
    ADD CONSTRAINT "rpc_deprecation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_title_artist_key" UNIQUE ("title", "artist");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trigger_layer_manifest"
    ADD CONSTRAINT "trigger_layer_manifest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trigger_layer_manifest"
    ADD CONSTRAINT "trigger_layer_manifest_table_name_trigger_name_key" UNIQUE ("table_name", "trigger_name");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "uniq_event_attendance_occurrence_user" UNIQUE ("occurrence_id", "user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "unique_venues_entity_id" UNIQUE ("entity_id");



ALTER TABLE ONLY "public"."event_profile_links"
    ADD CONSTRAINT "uq_event_profile_links_event_occurrence_profile" UNIQUE ("event_id", "occurrence_id", "profile_id");



ALTER TABLE ONLY "public"."organiser_team_members"
    ADD CONSTRAINT "uq_organiser_team_member" UNIQUE ("organiser_entity_id", "member_profile_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_unique" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "cities_slug_unique_idx" ON "public"."cities" USING "btree" ("slug");



CREATE INDEX "event_entities_entity_id_idx" ON "public"."event_entities" USING "btree" ("entity_id");



CREATE INDEX "event_entities_event_id_role_idx" ON "public"."event_entities" USING "btree" ("event_id", "role");



CREATE INDEX "idx_admin_city_scopes_city_id" ON "public"."admin_manager_city_scopes" USING "btree" ("city_id");



CREATE INDEX "idx_admin_city_scopes_user_id" ON "public"."admin_manager_city_scopes" USING "btree" ("user_id");



CREATE INDEX "idx_admin_settings_audit_actor" ON "public"."admin_settings_audit" USING "btree" ("actor_id");



CREATE INDEX "idx_admin_settings_audit_created_at" ON "public"."admin_settings_audit" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_settings_audit_target" ON "public"."admin_settings_audit" USING "btree" ("target_user_id");



CREATE INDEX "idx_calendar_occurrences_active_city_start" ON "public"."calendar_occurrences" USING "btree" ("city_id", "instance_start") WHERE ("lifecycle_status" IS DISTINCT FROM 'cancelled'::"text");



CREATE INDEX "idx_calendar_occurrences_city_venue" ON "public"."calendar_occurrences" USING "btree" ("city_id", "venue_id");



CREATE INDEX "idx_calendar_occurrences_event" ON "public"."calendar_occurrences" USING "btree" ("event_id");



CREATE INDEX "idx_calendar_occurrences_event_id" ON "public"."calendar_occurrences" USING "btree" ("event_id");



CREATE INDEX "idx_calendar_occurrences_event_id_start" ON "public"."calendar_occurrences" USING "btree" ("event_id", "instance_start");



CREATE INDEX "idx_calendar_occurrences_event_start" ON "public"."calendar_occurrences" USING "btree" ("event_id", "instance_start");



CREATE INDEX "idx_calendar_occurrences_event_status" ON "public"."calendar_occurrences" USING "btree" ("event_id", "lifecycle_status");



CREATE INDEX "idx_calendar_occurrences_instance_start" ON "public"."calendar_occurrences" USING "btree" ("instance_start");



CREATE INDEX "idx_calendar_occurrences_venue_id" ON "public"."calendar_occurrences" USING "btree" ("venue_id");



CREATE INDEX "idx_cities_active" ON "public"."cities" USING "btree" ("is_active");



CREATE INDEX "idx_cities_lower_name" ON "public"."cities" USING "btree" ("lower"("name"));



CREATE INDEX "idx_cities_name" ON "public"."cities" USING "btree" ("lower"("name"));



CREATE INDEX "idx_cities_population" ON "public"."cities" USING "btree" ("population");



CREATE UNIQUE INDEX "idx_cities_unique_lower_name_country" ON "public"."cities" USING "btree" ("lower"("name"), "country_code");



CREATE INDEX "idx_city_aliases_city_id" ON "public"."city_aliases" USING "btree" ("city_id");



CREATE INDEX "idx_city_aliases_normalized" ON "public"."city_aliases" USING "btree" ("normalized_alias");



CREATE INDEX "idx_city_audit_actor" ON "public"."city_deprecation_usage_audit" USING "btree" ("actor_user_id");



CREATE INDEX "idx_city_audit_endpoint" ON "public"."city_deprecation_usage_audit" USING "btree" ("endpoint");



CREATE INDEX "idx_city_audit_resolved" ON "public"."city_deprecation_usage_audit" USING "btree" ("resolved_city_id");



CREATE INDEX "idx_city_requests_status" ON "public"."city_requests" USING "btree" ("status");



CREATE INDEX "idx_dancers_city_id" ON "public"."dancers_archive_april2026" USING "btree" ("city_id");



CREATE INDEX "idx_dancers_country_code" ON "public"."dancers_archive_april2026" USING "btree" ("country_code");



CREATE INDEX "idx_dj_profiles_city_id" ON "public"."dj_profiles" USING "btree" ("city_id");



CREATE INDEX "idx_dj_profiles_country_code" ON "public"."dj_profiles" USING "btree" ("country_code");



CREATE INDEX "idx_entities_city_id" ON "public"."entities" USING "btree" ("city_id");



CREATE INDEX "idx_entities_claimed_by" ON "public"."entities" USING "btree" ("claimed_by");



CREATE INDEX "idx_entities_name" ON "public"."entities" USING "btree" ("name");



CREATE INDEX "idx_entities_type" ON "public"."entities" USING "btree" ("type");



CREATE INDEX "idx_epl_event_occ_type_active" ON "public"."event_profile_links" USING "btree" ("event_id", "occurrence_id", "profile_type", "archived_at");



CREATE INDEX "idx_epl_event_role_active" ON "public"."event_profile_links" USING "btree" ("event_id", "role") WHERE (("status" = 'active'::"text") AND ("archived_at" IS NULL));



CREATE INDEX "idx_epl_event_role_type" ON "public"."event_profile_links" USING "btree" ("event_id", "role", "profile_type");



CREATE INDEX "idx_epl_occurrence" ON "public"."event_profile_links" USING "btree" ("occurrence_id");



CREATE INDEX "idx_event_attendance_occurrence" ON "public"."event_attendance" USING "btree" ("occurrence_id");



CREATE INDEX "idx_event_attendance_occurrence_status" ON "public"."event_attendance" USING "btree" ("occurrence_id", "status");



CREATE INDEX "idx_event_attendance_user" ON "public"."event_attendance" USING "btree" ("user_id");



CREATE INDEX "idx_event_entities_entity_id" ON "public"."event_entities" USING "btree" ("entity_id");



CREATE INDEX "idx_event_entities_event_id" ON "public"."event_entities" USING "btree" ("event_id");



CREATE INDEX "idx_event_entities_event_role" ON "public"."event_entities" USING "btree" ("event_id", "role");



CREATE INDEX "idx_event_entities_role_entity" ON "public"."event_entities" USING "btree" ("role", "entity_id");



CREATE INDEX "idx_event_posts_event" ON "public"."event_posts" USING "btree" ("event_id");



CREATE INDEX "idx_event_profile_connections_event" ON "public"."event_profile_connections" USING "btree" ("event_id", "person_type", "connection_label", "sort_order");



CREATE INDEX "idx_event_profile_connections_person" ON "public"."event_profile_connections" USING "btree" ("person_type", "person_id", "connection_label");



CREATE INDEX "idx_event_profile_link_audit_actor_id" ON "public"."event_profile_link_audit" USING "btree" ("actor_id");



CREATE INDEX "idx_event_profile_link_audit_created_at" ON "public"."event_profile_link_audit" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_event_profile_link_audit_event_id" ON "public"."event_profile_link_audit" USING "btree" ("event_id");



CREATE INDEX "idx_event_profile_link_suggestions_event_status" ON "public"."event_profile_link_suggestions" USING "btree" ("event_id", "status");



CREATE INDEX "idx_event_profile_links_core" ON "public"."event_profile_links" USING "btree" ("event_id", "profile_type", "occurrence_id", "status", "is_primary");



CREATE INDEX "idx_event_profile_links_event_id" ON "public"."event_profile_links" USING "btree" ("event_id");



CREATE INDEX "idx_event_profile_links_event_occ_type_active" ON "public"."event_profile_links" USING "btree" ("event_id", "occurrence_id", "profile_type") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_event_profile_links_event_role_occ" ON "public"."event_profile_links" USING "btree" ("event_id", "role", "occurrence_id") WHERE (("status" = 'active'::"text") AND ("archived_at" IS NULL));



CREATE INDEX "idx_event_profile_links_occurrence_id" ON "public"."event_profile_links" USING "btree" ("occurrence_id");



CREATE INDEX "idx_event_profile_links_profile_id" ON "public"."event_profile_links" USING "btree" ("profile_id");



CREATE INDEX "idx_event_profile_links_role_status" ON "public"."event_profile_links" USING "btree" ("role", "status");



CREATE INDEX "idx_event_program_djs_item_id" ON "public"."event_program_djs" USING "btree" ("program_item_id");



CREATE INDEX "idx_event_program_instructors_item_id" ON "public"."event_program_instructors" USING "btree" ("program_item_id");



CREATE INDEX "idx_event_program_items_event_id" ON "public"."event_program_items" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_event_program_items_event_legacy_id" ON "public"."event_program_items" USING "btree" ("event_id", "legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "idx_event_registrations_event_status" ON "public"."event_registrations" USING "btree" ("event_id", "status");



CREATE INDEX "idx_event_tracks_event_id" ON "public"."event_tracks" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_event_tracks_event_legacy_id" ON "public"."event_tracks" USING "btree" ("event_id", "legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "idx_events_active_start_time" ON "public"."events" USING "btree" ("is_active", "start_time");



CREATE INDEX "idx_events_city_id" ON "public"."events" USING "btree" ("city_id");



CREATE INDEX "idx_events_city_slug" ON "public"."events" USING "btree" ("city_slug");



CREATE INDEX "idx_events_cityid_start_time_pub_active" ON "public"."events" USING "btree" ("city_id", "start_time") WHERE (("is_active" = true) AND ("lifecycle_status" = 'published'::"text"));



CREATE INDEX "idx_events_is_active" ON "public"."events" USING "btree" ("is_active");



CREATE INDEX "idx_events_lifecycle_status" ON "public"."events" USING "btree" ("lifecycle_status");



CREATE INDEX "idx_events_parent_event_id" ON "public"."events" USING "btree" ("parent_event_id");



CREATE INDEX "idx_events_source_occurrence_id" ON "public"."events" USING "btree" ("source_occurrence_id");



CREATE INDEX "idx_events_start_time" ON "public"."events" USING "btree" ("start_time");



CREATE INDEX "idx_events_start_time_pub_active" ON "public"."events" USING "btree" ("start_time") WHERE (("is_active" = true) AND ("lifecycle_status" = 'published'::"text"));



CREATE INDEX "idx_events_venue_id" ON "public"."events" USING "btree" ("venue_id");



CREATE INDEX "idx_person_account_links_user" ON "public"."person_account_links" USING "btree" ("user_id", "verification_status");



CREATE INDEX "idx_person_profiles_profile" ON "public"."person_profiles" USING "btree" ("profile_type", "profile_id");



CREATE INDEX "idx_phase4_tmp_occ_write_city_compat_function" ON "public"."phase4_tmp_occurrence_write_city_compat_audit" USING "btree" ("function_name", "logged_at" DESC);



CREATE INDEX "idx_phase4_tmp_occ_write_city_compat_logged_at" ON "public"."phase4_tmp_occurrence_write_city_compat_audit" USING "btree" ("logged_at" DESC);



CREATE INDEX "idx_profiles_based_city_id" ON "public"."profiles" USING "btree" ("based_city_id");



CREATE INDEX "idx_teacher_profiles_city_id" ON "public"."teacher_profiles" USING "btree" ("city_id");



CREATE INDEX "idx_teacher_profiles_country_code" ON "public"."teacher_profiles" USING "btree" ("country_code");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_vendors_city_id" ON "public"."vendors" USING "btree" ("city_id");



CREATE INDEX "idx_vendors_country_code" ON "public"."vendors" USING "btree" ("country_code");



CREATE INDEX "idx_venues_entity_id" ON "public"."venues" USING "btree" ("entity_id");



CREATE INDEX "idx_videographers_city_id" ON "public"."videographers" USING "btree" ("city_id");



CREATE INDEX "idx_videographers_country_code" ON "public"."videographers" USING "btree" ("country_code");



CREATE INDEX "member_profiles_based_city_id_idx" ON "public"."member_profiles" USING "btree" ("based_city_id");



CREATE UNIQUE INDEX "organiser_team_members_one_active_leader_uidx" ON "public"."organiser_team_members" USING "btree" ("organiser_entity_id") WHERE (("is_leader" = true) AND ("is_active" = true));



CREATE UNIQUE INDEX "organiser_team_members_org_member_active_uidx" ON "public"."organiser_team_members" USING "btree" ("organiser_entity_id", "member_profile_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "organiser_team_members_unique" ON "public"."organiser_team_members" USING "btree" ("organiser_entity_id", "member_profile_id", "role");



CREATE INDEX "rpc_city_compat_audit_captured_at_idx" ON "public"."rpc_city_compat_audit" USING "btree" ("captured_at" DESC);



CREATE INDEX "rpc_city_compat_audit_rpc_name_captured_at_idx" ON "public"."rpc_city_compat_audit" USING "btree" ("rpc_name", "captured_at" DESC);



CREATE INDEX "songs_artist_idx" ON "public"."songs" USING "gin" ("to_tsvector"('"english"'::"regconfig", "artist"));



CREATE INDEX "songs_title_idx" ON "public"."songs" USING "gin" ("to_tsvector"('"english"'::"regconfig", "title"));



CREATE UNIQUE INDEX "uq_city_requests_pending_slug" ON "public"."city_requests" USING "btree" ("lower"("requested_slug")) WHERE (("status" = 'pending'::"text") AND ("requested_slug" IS NOT NULL));



CREATE UNIQUE INDEX "uq_epl_active_occurrence_dancer" ON "public"."event_profile_links" USING "btree" ("event_id", "occurrence_id", "profile_id", "role") WHERE (("archived_at" IS NULL) AND ("status" = 'active'::"text") AND ("occurrence_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_epl_active_series_dancer" ON "public"."event_profile_links" USING "btree" ("event_id", "profile_id", "role") WHERE (("archived_at" IS NULL) AND ("status" = 'active'::"text") AND ("occurrence_id" IS NULL));



CREATE UNIQUE INDEX "uq_event_profile_link_suggestions_state" ON "public"."event_profile_link_suggestions" USING "btree" ("event_id", "profile_id", "role", "status");



CREATE UNIQUE INDEX "uq_event_profile_links_occurrence_profile_role_not_null" ON "public"."event_profile_links" USING "btree" ("occurrence_id", "profile_id", "role") WHERE ("occurrence_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_event_profile_links_primary_venue" ON "public"."event_profile_links" USING "btree" ("event_id") WHERE (("status" = 'active'::"text") AND ("archived_at" IS NULL) AND ("role" = 'venue'::"text") AND ("is_primary" = true));



CREATE UNIQUE INDEX "uq_person_primary_account" ON "public"."person_account_links" USING "btree" ("person_id") WHERE (("is_primary" = true) AND ("verification_status" = 'verified'::"text"));



CREATE OR REPLACE TRIGGER "ensure_city_fields" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_city_fields"();



CREATE OR REPLACE TRIGGER "idempotency_updated_at_trigger" BEFORE UPDATE ON "public"."idempotency" FOR EACH ROW EXECUTE FUNCTION "public"."idempotency_set_updated_at"();



CREATE OR REPLACE TRIGGER "organisers_block_write_trg" INSTEAD OF INSERT OR DELETE OR UPDATE ON "public"."organisers" FOR EACH ROW EXECUTE FUNCTION "public"."block_organisers_view_writes"();



CREATE CONSTRAINT TRIGGER "trg_admin_city_scopes_scope_guard" AFTER INSERT OR DELETE ON "public"."admin_manager_city_scopes" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_manager_city_scope"();



CREATE OR REPLACE TRIGGER "trg_admin_link_managers_restricted_guard" BEFORE UPDATE ON "public"."admin_link_managers" FOR EACH ROW EXECUTE FUNCTION "public"."admin_link_managers_restricted_columns_guard"();



CREATE CONSTRAINT TRIGGER "trg_admin_link_managers_scope_guard" AFTER INSERT OR UPDATE OF "role", "is_active" ON "public"."admin_link_managers" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_manager_city_scope"();



CREATE OR REPLACE TRIGGER "trg_admin_link_managers_updated_at" BEFORE UPDATE ON "public"."admin_link_managers" FOR EACH ROW EXECUTE FUNCTION "public"."admin_link_managers_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_block_organiser_role_writes_ins" BEFORE INSERT ON "public"."event_profile_links" FOR EACH ROW EXECUTE FUNCTION "public"."_block_organiser_role_writes"();



CREATE OR REPLACE TRIGGER "trg_block_organiser_role_writes_upd" BEFORE UPDATE ON "public"."event_profile_links" FOR EACH ROW EXECUTE FUNCTION "public"."_block_organiser_role_writes"();



CREATE OR REPLACE TRIGGER "trg_calendar_occurrences_updated_at" BEFORE UPDATE ON "public"."calendar_occurrences" FOR EACH ROW EXECUTE FUNCTION "public"."calendar_occurrences_update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_dancer_profiles_set_updated_at" BEFORE UPDATE ON "public"."dancer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."dancer_profiles_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_dancers_fill_city" BEFORE INSERT ON "public"."dancers_archive_april2026" FOR EACH ROW EXECUTE FUNCTION "public"."fill_city_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_dj_profiles_ensure_dancer_profile" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."dj_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_dancer_profile_on_role_write"();



CREATE OR REPLACE TRIGGER "trg_dj_profiles_sync_city" BEFORE INSERT OR UPDATE ON "public"."dj_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_city_text_to_city_id"();



CREATE OR REPLACE TRIGGER "trg_entities_sync_city" BEFORE INSERT OR UPDATE ON "public"."entities" FOR EACH ROW EXECUTE FUNCTION "public"."sync_city_text_to_city_id"();



CREATE OR REPLACE TRIGGER "trg_event_profile_link_suggestions_updated_at" BEFORE UPDATE ON "public"."event_profile_link_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."event_profile_link_suggestions_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_event_profile_links_updated_at" BEFORE UPDATE ON "public"."event_profile_links" FOR EACH ROW EXECUTE FUNCTION "public"."event_profile_links_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_events_set_updated_at" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."events_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_events_sync_lifecycle_and_active" BEFORE INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."events_sync_lifecycle_and_active"();



CREATE OR REPLACE TRIGGER "trg_guest_dancer_profiles_updated_at" BEFORE UPDATE ON "public"."guest_dancer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_guest_dancer_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "trg_member_profiles_set_updated_at" BEFORE UPDATE ON "public"."member_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."member_profiles_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_quarantine_invalid_occurrence" BEFORE INSERT OR UPDATE ON "public"."calendar_occurrences" FOR EACH ROW EXECUTE FUNCTION "public"."quarantine_invalid_occurrence"();



CREATE OR REPLACE TRIGGER "trg_sync_venue_to_entities_minimal" AFTER INSERT OR UPDATE ON "public"."venues" FOR EACH ROW EXECUTE FUNCTION "public"."sync_venue_to_entities_minimal"();



CREATE OR REPLACE TRIGGER "trg_teacher_profiles_ensure_dancer_profile" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."teacher_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_dancer_profile_on_role_write"();



CREATE OR REPLACE TRIGGER "trg_teacher_profiles_fill_city" BEFORE INSERT ON "public"."teacher_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."fill_city_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_teacher_profiles_sync_city" BEFORE INSERT OR UPDATE ON "public"."teacher_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_city_text_to_city_id"();



CREATE OR REPLACE TRIGGER "trg_vendors_set_updated_at" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."dancer_profiles_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vendors_sync_city" BEFORE INSERT OR UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."sync_city_text_to_city_id"();



CREATE OR REPLACE TRIGGER "trg_videographers_ensure_dancer_profile" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."videographers" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_dancer_profile_on_role_write"();



CREATE OR REPLACE TRIGGER "trg_videographers_sync_city" BEFORE INSERT OR UPDATE ON "public"."videographers" FOR EACH ROW EXECUTE FUNCTION "public"."sync_city_text_to_city_id"();



ALTER TABLE ONLY "public"."admin_link_managers"
    ADD CONSTRAINT "admin_link_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_manager_city_scopes"
    ADD CONSTRAINT "admin_manager_city_scopes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_manager_city_scopes"
    ADD CONSTRAINT "admin_manager_city_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."admin_link_managers"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_super_users"
    ADD CONSTRAINT "admin_super_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_occurrences"
    ADD CONSTRAINT "calendar_occurrences_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."calendar_occurrences"
    ADD CONSTRAINT "calendar_occurrences_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_id_fkey_entities" FOREIGN KEY ("id") REFERENCES "public"."entities"("id");



ALTER TABLE ONLY "public"."city_aliases"
    ADD CONSTRAINT "city_aliases_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dancer_profiles"
    ADD CONSTRAINT "dancer_profiles_based_city_id_fkey" FOREIGN KEY ("based_city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dancer_profiles"
    ADD CONSTRAINT "dancer_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dancer_profiles"
    ADD CONSTRAINT "dancer_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dancer_profiles_legacy_backup"
    ADD CONSTRAINT "dancer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."member_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dancers_archive_april2026"
    ADD CONSTRAINT "dancers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."dancers_archive_april2026"
    ADD CONSTRAINT "dancers_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");



ALTER TABLE ONLY "public"."dancers_archive_april2026"
    ADD CONSTRAINT "dancers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dj_profiles"
    ADD CONSTRAINT "dj_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."dj_profiles"
    ADD CONSTRAINT "dj_profiles_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");



ALTER TABLE ONLY "public"."dj_profiles"
    ADD CONSTRAINT "dj_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."djs"
    ADD CONSTRAINT "djs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."calendar_occurrences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_dancer_id_fkey" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers_archive_april2026"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_entities"
    ADD CONSTRAINT "event_entities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_entities"
    ADD CONSTRAINT "event_entities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_passes"
    ADD CONSTRAINT "event_passes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_permissions"
    ADD CONSTRAINT "event_permissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_profile_connections"
    ADD CONSTRAINT "event_profile_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_profile_connections"
    ADD CONSTRAINT "event_profile_connections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_profile_link_suggestions"
    ADD CONSTRAINT "event_profile_link_suggestions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_profile_links"
    ADD CONSTRAINT "event_profile_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_program_djs"
    ADD CONSTRAINT "event_program_djs_program_item_id_fkey" FOREIGN KEY ("program_item_id") REFERENCES "public"."event_program_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_program_instructors"
    ADD CONSTRAINT "event_program_instructors_program_item_id_fkey" FOREIGN KEY ("program_item_id") REFERENCES "public"."event_program_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_program_items"
    ADD CONSTRAINT "event_program_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_tracks"
    ADD CONSTRAINT "event_tracks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_views"
    ADD CONSTRAINT "event_views_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_city_slug_fkey" FOREIGN KEY ("city_slug") REFERENCES "public"."cities"("slug");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_source_occurrence_id_fkey" FOREIGN KEY ("source_occurrence_id") REFERENCES "public"."calendar_occurrences"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."calendar_occurrences"
    ADD CONSTRAINT "fk_calendar_occurrences_venue_id" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dancer_profiles_legacy_backup"
    ADD CONSTRAINT "fk_dancer_profiles_nationality_code_countries_code" FOREIGN KEY ("nationality_code") REFERENCES "public"."countries"("code") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_dancer_profiles"
    ADD CONSTRAINT "guest_dancer_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guest_dancer_profiles"
    ADD CONSTRAINT "guest_dancer_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_profiles"
    ADD CONSTRAINT "member_profiles_based_city_id_fkey" FOREIGN KEY ("based_city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_profiles"
    ADD CONSTRAINT "member_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_targets"
    ADD CONSTRAINT "onboarding_targets_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organiser_team_members"
    ADD CONSTRAINT "organiser_team_members_member_profile_id_fkey" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organiser_team_members"
    ADD CONSTRAINT "organiser_team_members_organiser_entity_id_fkey" FOREIGN KEY ("organiser_entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_account_links"
    ADD CONSTRAINT "person_account_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."person_account_links"
    ADD CONSTRAINT "person_account_links_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."person_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_account_links"
    ADD CONSTRAINT "person_account_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_identities"
    ADD CONSTRAINT "person_identities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."person_profiles"
    ADD CONSTRAINT "person_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."person_profiles"
    ADD CONSTRAINT "person_profiles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."person_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videographers"
    ADD CONSTRAINT "photographers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_based_city_id_fkey" FOREIGN KEY ("based_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."videographers"
    ADD CONSTRAINT "videographers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."videographers"
    ADD CONSTRAINT "videographers_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code");



CREATE POLICY "Admin can read dancers" ON "public"."dancers_archive_april2026" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin can read dj_profiles" ON "public"."dj_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin can read profile_claims" ON "public"."profile_claims" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin can read teacher_profiles" ON "public"."teacher_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin can select event_views" ON "public"."event_views" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin can view all dj profiles" ON "public"."dj_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin can view all teacher profiles" ON "public"."teacher_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admin full access on onboarding_targets" ON "public"."onboarding_targets" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can delete links directly" ON "public"."event_profile_connections" FOR DELETE TO "authenticated" USING ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert links directly" ON "public"."event_profile_connections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can insert organiser entities" ON "public"."entities" FOR INSERT TO "authenticated" WITH CHECK ((("type" = 'organiser'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))));



CREATE POLICY "Admins can manage all djs" ON "public"."djs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage cities" ON "public"."cities" TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can manage city aliases" ON "public"."city_aliases" TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can manage countries" ON "public"."countries" TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can manage dj_profiles" ON "public"."dj_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage entities" ON "public"."entities" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage teacher_profiles" ON "public"."teacher_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage vendors" ON "public"."vendors" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage videographers" ON "public"."videographers" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update claims" ON "public"."profile_claims" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update links directly" ON "public"."event_profile_connections" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_admin"()) WITH CHECK ("public"."is_current_user_admin"());



CREATE POLICY "Admins can update organiser entities" ON "public"."entities" FOR UPDATE TO "authenticated" USING ((("type" = 'organiser'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))))) WITH CHECK ((("type" = 'organiser'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))));



CREATE POLICY "Admins can view all claims" ON "public"."profile_claims" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins manage teacher_profiles" ON "public"."teacher_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Allow authenticated insert to songs" ON "public"."songs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow public read access to songs" ON "public"."songs" FOR SELECT USING (true);



CREATE POLICY "Allow public read cities" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "Allow service role deletes" ON "public"."dancers_archive_april2026" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role inserts" ON "public"."dancers_archive_april2026" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow service role updates" ON "public"."dancers_archive_april2026" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Anyone can insert event_views" ON "public"."event_views" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Auth insert" ON "public"."vendors" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Auth insert" ON "public"."videographers" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated can claim unclaimed entity" ON "public"."entities" FOR UPDATE USING ((("claimed_by" IS NULL) AND ("auth"."uid"() IS NOT NULL))) WITH CHECK (("claimed_by" = "auth"."uid"()));



CREATE POLICY "Authenticated can create claimed organiser entities" ON "public"."entities" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("type" = 'organiser'::"text") AND ("claimed_by" = "auth"."uid"())));



CREATE POLICY "Authenticated can create person identities" ON "public"."person_identities" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Claimed user can update entity" ON "public"."entities" FOR UPDATE USING (("auth"."uid"() = "claimed_by"));



CREATE POLICY "DJ can delete own profile" ON "public"."dj_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "DJ can insert own profile" ON "public"."dj_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "DJ can update own profile" ON "public"."dj_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "DJs viewable by everyone" ON "public"."djs" FOR SELECT USING (true);



CREATE POLICY "Dancer attends event" ON "public"."event_attendees" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "dancers_archive_april2026"."user_id"
   FROM "public"."dancers_archive_april2026"
  WHERE ("dancers_archive_april2026"."id" = "event_attendees"."dancer_id"))));



CREATE POLICY "Dancer removes themselves" ON "public"."event_attendees" FOR DELETE USING (("auth"."uid"() = ( SELECT "dancers_archive_april2026"."user_id"
   FROM "public"."dancers_archive_april2026"
  WHERE ("dancers_archive_april2026"."id" = "event_attendees"."dancer_id"))));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."event_attendees" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."dj_profiles" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."event_attendees" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."teacher_profiles" FOR SELECT USING (true);



CREATE POLICY "Entities are publicly viewable" ON "public"."entities" FOR SELECT USING (true);



CREATE POLICY "Linked users can add account links" ON "public"."person_account_links" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "me"
  WHERE (("me"."person_id" = "person_account_links"."person_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can delete person profile links" ON "public"."person_profiles" FOR DELETE TO "authenticated" USING (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_profiles"."person_id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can insert person profile links" ON "public"."person_profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_profiles"."person_id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can read person identities" ON "public"."person_identities" FOR SELECT USING (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_identities"."id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can update account links" ON "public"."person_account_links" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "me"
  WHERE (("me"."person_id" = "person_account_links"."person_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."verification_status" = 'verified'::"text")))))) WITH CHECK (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "me"
  WHERE (("me"."person_id" = "person_account_links"."person_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can update person identities" ON "public"."person_identities" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_identities"."id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text")))))) WITH CHECK (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_identities"."id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Linked users can update person profile links" ON "public"."person_profiles" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_profiles"."person_id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text")))))) WITH CHECK (("public"."is_current_user_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."person_account_links" "pal"
  WHERE (("pal"."person_id" = "person_profiles"."person_id") AND ("pal"."user_id" = "auth"."uid"()) AND ("pal"."verification_status" = 'verified'::"text"))))));



CREATE POLICY "Owner delete" ON "public"."vendors" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner delete" ON "public"."videographers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner update" ON "public"."vendors" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner update" ON "public"."videographers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Public Read" ON "public"."dj_profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read" ON "public"."teacher_profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read" ON "public"."vendors" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read" ON "public"."videographers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read active cities" ON "public"."cities" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can read city aliases" ON "public"."city_aliases" FOR SELECT USING (true);



CREATE POLICY "Public can read countries" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "Public can read non-dancer links" ON "public"."event_profile_connections" FOR SELECT USING ((("person_type" <> 'dancer'::"text") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Public can read person profile links" ON "public"."person_profiles" FOR SELECT USING (true);



CREATE POLICY "Public can see attendee counts" ON "public"."event_attendees" FOR SELECT USING (true);



CREATE POLICY "Public can view DJ profiles" ON "public"."dj_profiles" FOR SELECT USING (true);



CREATE POLICY "Public can view dancers" ON "public"."dancers_archive_april2026" FOR SELECT USING (true);



CREATE POLICY "Public can view teacher profiles" ON "public"."teacher_profiles" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read" ON "public"."cities" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."vendors" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."videographers" FOR SELECT USING (true);



CREATE POLICY "Teacher can delete own profile" ON "public"."teacher_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Teacher can insert own profile" ON "public"."teacher_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Teacher can update own profile" ON "public"."teacher_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own teacher profile" ON "public"."teacher_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can edit own teacher profile" ON "public"."teacher_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert claims" ON "public"."profile_claims" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own account links" ON "public"."person_account_links" FOR SELECT TO "authenticated" USING (("public"."is_current_user_admin"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own dancer profile" ON "public"."dancers_archive_april2026" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own claims" ON "public"."profile_claims" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own dj profile" ON "public"."djs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own params" ON "public"."event_registrations" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "admin_city_scopes_delete_super_admin" ON "public"."admin_manager_city_scopes" FOR DELETE TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "admin_city_scopes_manage_super_admin" ON "public"."admin_manager_city_scopes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "admin_city_scopes_read" ON "public"."admin_manager_city_scopes" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



CREATE POLICY "admin_city_scopes_update_super_admin" ON "public"."admin_manager_city_scopes" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"())) WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



ALTER TABLE "public"."admin_link_managers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_link_managers_manage" ON "public"."admin_link_managers" TO "authenticated" USING ("public"."can_manage_connectivity"()) WITH CHECK ("public"."can_manage_connectivity"());



CREATE POLICY "admin_link_managers_self_read" ON "public"."admin_link_managers" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."can_manage_connectivity"()));



ALTER TABLE "public"."admin_manager_city_scopes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_settings_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_settings_audit_insert_super_admin" ON "public"."admin_settings_audit" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_super_admin"("auth"."uid"()) OR ("actor_id" = "auth"."uid"())));



CREATE POLICY "admin_settings_audit_read_super_admin" ON "public"."admin_settings_audit" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



ALTER TABLE "public"."admin_super_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_super_users_manage" ON "public"."admin_super_users" TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"())) WITH CHECK ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "admin_super_users_read" ON "public"."admin_super_users" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"())));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_ro" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "allow_postgres_delete_venue_entities" ON "public"."entities" FOR DELETE TO "postgres" USING (("type" = 'venue'::"text"));



CREATE POLICY "allow_service_role_all_venues" ON "public"."venues" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."calendar_occurrence_quarantine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_occurrences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_occurrences_public_read" ON "public"."calendar_occurrences" FOR SELECT USING (true);



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_admin_delete" ON "public"."cities" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "cities_admin_insert" ON "public"."cities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "cities_admin_update" ON "public"."cities" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."city_aliases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "city_aliases_admin_delete" ON "public"."city_aliases" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "city_aliases_admin_insert" ON "public"."city_aliases" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "city_aliases_public_read" ON "public"."city_aliases" FOR SELECT USING (true);



CREATE POLICY "city_deprecation_ro" ON "public"."city_deprecation_usage_audit" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."city_deprecation_usage_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."city_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "city_requests_admin_select" ON "public"."city_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "city_requests_admin_update" ON "public"."city_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "city_requests_insert_own" ON "public"."city_requests" FOR INSERT TO "authenticated" WITH CHECK (("requested_by" = "auth"."uid"()));



ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dancer_attends" ON "public"."event_attendees" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."dancers_archive_april2026" "d"
  WHERE (("d"."id" = "event_attendees"."dancer_id") AND ("d"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."dancer_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dancer_profiles_admin_all" ON "public"."dancer_profiles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "dancer_profiles_insert_self" ON "public"."dancer_profiles_legacy_backup" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."dancer_profiles_legacy_backup" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dancer_profiles_public_read" ON "public"."dancer_profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "dancer_profiles_select_own" ON "public"."dancer_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "dancer_profiles_select_self" ON "public"."dancer_profiles_legacy_backup" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "dancer_profiles_update_self" ON "public"."dancer_profiles_legacy_backup" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "dancer_unattends" ON "public"."event_attendees" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."dancers_archive_april2026" "d"
  WHERE (("d"."id" = "event_attendees"."dancer_id") AND ("d"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."dancers_archive_april2026" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dj_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."djs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entities_anon_read" ON "public"."entities" FOR SELECT TO "anon" USING (true);



CREATE POLICY "entities_authenticated_read" ON "public"."entities" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."event_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_attendance_delete_self" ON "public"."event_attendance" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "event_attendance_insert_self" ON "public"."event_attendance" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "event_attendance_select_self" ON "public"."event_attendance" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "event_attendance_update_self" ON "public"."event_attendance" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."event_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_attendees_delete_owner" ON "public"."event_attendees" FOR DELETE USING (("auth"."uid"() = ( SELECT "dancers_archive_april2026"."user_id"
   FROM "public"."dancers_archive_april2026"
  WHERE ("dancers_archive_april2026"."id" = "event_attendees"."dancer_id"))));



CREATE POLICY "event_attendees_owner" ON "public"."event_attendees" USING (("auth"."uid"() = ( SELECT "dancers_archive_april2026"."user_id"
   FROM "public"."dancers_archive_april2026"
  WHERE ("dancers_archive_april2026"."id" = "event_attendees"."dancer_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "dancers_archive_april2026"."user_id"
   FROM "public"."dancers_archive_april2026"
  WHERE ("dancers_archive_april2026"."id" = "event_attendees"."dancer_id"))));



ALTER TABLE "public"."event_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_audit_ro" ON "public"."event_audit" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."event_entities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_entities_public_read" ON "public"."event_entities" FOR SELECT USING (true);



ALTER TABLE "public"."event_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_jobs_ro" ON "public"."event_jobs" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."event_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_permissions_delete" ON "public"."event_permissions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_permissions"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))))))));



CREATE POLICY "event_permissions_insert" ON "public"."event_permissions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_permissions"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))))))));



CREATE POLICY "event_permissions_select" ON "public"."event_permissions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_permissions"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))))))));



CREATE POLICY "event_permissions_update" ON "public"."event_permissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_permissions"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_permissions"."event_id") AND (("e"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_admin" = true)))))))));



ALTER TABLE "public"."event_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_profile_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_profile_link_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_profile_link_audit_manager_insert" ON "public"."event_profile_link_audit" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_connectivity"());



CREATE POLICY "event_profile_link_audit_manager_read" ON "public"."event_profile_link_audit" FOR SELECT TO "authenticated" USING ("public"."can_manage_connectivity"());



ALTER TABLE "public"."event_profile_link_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_profile_link_suggestions_manager_read" ON "public"."event_profile_link_suggestions" FOR SELECT TO "authenticated" USING ("public"."can_manage_connectivity"());



CREATE POLICY "event_profile_link_suggestions_manager_write" ON "public"."event_profile_link_suggestions" TO "authenticated" USING ("public"."can_manage_connectivity"()) WITH CHECK ("public"."can_manage_connectivity"());



ALTER TABLE "public"."event_profile_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_profile_links_manager_write" ON "public"."event_profile_links" TO "authenticated" USING ("public"."can_manage_connectivity"()) WITH CHECK ("public"."can_manage_connectivity"());



CREATE POLICY "event_profile_links_public_read" ON "public"."event_profile_links" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"text"));



ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_registrations_owner_delete" ON "public"."event_registrations" FOR DELETE USING ("public"."auth_is_event_organiser"("event_id"));



CREATE POLICY "event_registrations_owner_read" ON "public"."event_registrations" FOR SELECT USING ("public"."auth_is_event_organiser"("event_id"));



CREATE POLICY "event_registrations_owner_update" ON "public"."event_registrations" FOR UPDATE USING ("public"."auth_is_event_organiser"("event_id")) WITH CHECK ("public"."auth_is_event_organiser"("event_id"));



CREATE POLICY "event_registrations_public_insert" ON "public"."event_registrations" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_registrations"."event_id") AND ("e"."is_active" = true)))));



ALTER TABLE "public"."event_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_auth_read_published_or_owned" ON "public"."events" FOR SELECT TO "authenticated" USING ((("is_active" = true) OR "public"."auth_is_event_organiser"("id") OR "public"."is_admin"()));



CREATE POLICY "events_public_read_published" ON "public"."events" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_flags_ro" ON "public"."feature_flags" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."guest_dancer_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_dancer_profiles_admin_write" ON "public"."guest_dancer_profiles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "guest_dancer_profiles_public_read" ON "public"."guest_dancer_profiles" FOR SELECT USING (true);



ALTER TABLE "public"."idempotency" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "idempotency_ro" ON "public"."idempotency" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "legacy_event_attendees_read_only" ON "public"."event_attendees" FOR SELECT USING (true);



CREATE POLICY "legacy_event_attendees_service_write" ON "public"."event_attendees" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "legacy_event_attendees_write_lock" ON "public"."event_attendees" USING (false) WITH CHECK (false);



ALTER TABLE "public"."member_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_profiles_admin_select" ON "public"."member_profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "member_profiles_insert_own" ON "public"."member_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "member_profiles_insert_self" ON "public"."member_profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "member_profiles_select_own" ON "public"."member_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "member_profiles_select_self" ON "public"."member_profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "member_profiles_update_own" ON "public"."member_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "member_profiles_update_self" ON "public"."member_profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."onboarding_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_owner_manage_team" ON "public"."organiser_team_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."entities" "e"
  WHERE (("e"."id" = "organiser_team_members"."organiser_entity_id") AND ("e"."type" = 'organiser'::"text") AND ("e"."claimed_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entities" "e"
  WHERE (("e"."id" = "organiser_team_members"."organiser_entity_id") AND ("e"."type" = 'organiser'::"text") AND ("e"."claimed_by" = "auth"."uid"())))));



ALTER TABLE "public"."organiser_team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organiser_team_members_admin_manage" ON "public"."organiser_team_members" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "organiser_team_members_admin_select" ON "public"."organiser_team_members" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."person_account_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_read_authenticated" ON "public"."event_posts" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."profile_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_can_view_attendees" ON "public"."event_attendees" FOR SELECT USING (true);



CREATE POLICY "public_read_venues" ON "public"."venues" FOR SELECT USING (true);



CREATE POLICY "quarantine_ro" ON "public"."calendar_occurrence_quarantine" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."rpc_deprecation_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rpc_deprecation_ro" ON "public"."rpc_deprecation_log" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_cities_ro" ON "public"."staging_cities" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "super_users_self_read" ON "public"."admin_super_users" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."teacher_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_ro" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."v_is_admin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "v_is_admin_ro" ON "public"."v_is_admin" FOR SELECT TO "authenticated" USING (false);



ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videographers" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_block_legacy_lineup_writes"() TO "anon";
GRANT ALL ON FUNCTION "public"."_block_legacy_lineup_writes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_block_legacy_lineup_writes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_block_organiser_role_writes"() TO "anon";
GRANT ALL ON FUNCTION "public"."_block_organiser_role_writes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_block_organiser_role_writes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_derive_event_organiser_ids"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_derive_event_organiser_ids"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_derive_event_organiser_ids"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_floor_test_probe"() TO "anon";
GRANT ALL ON FUNCTION "public"."_floor_test_probe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_floor_test_probe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_guard_events_legacy_organiser_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."_guard_events_legacy_organiser_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_guard_events_legacy_organiser_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_log_legacy_read"("_surface" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_log_legacy_read"("_surface" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_log_legacy_read"("_surface" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_map_role_to_profile_type"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_map_role_to_profile_type"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_map_role_to_profile_type"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_member_profile_user_id"("p_member_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_member_profile_user_id"("p_member_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_member_profile_user_id"("p_member_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_secdef_probe"() TO "anon";
GRANT ALL ON FUNCTION "public"."_secdef_probe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_secdef_probe"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."_upsert_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_is_primary" boolean, "p_source" "text", "p_occurrence_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_upsert_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_is_primary" boolean, "p_source" "text", "p_occurrence_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."account_exists_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."account_exists_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."account_exists_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."account_exists_by_email"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_archive_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_archive_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_archive_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_audit_event_profile_connections_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_audit_event_profile_connections_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_audit_event_profile_connections_changes"() TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dancers_archive_april2026" TO "service_role";
GRANT SELECT ON TABLE "public"."dancers_archive_april2026" TO "authenticated";
GRANT SELECT ON TABLE "public"."dancers_archive_april2026" TO "anon";



REVOKE ALL ON FUNCTION "public"."admin_create_dancer"("p_target_user_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_full_name" "text", "p_avatar_url" "text", "p_based_city_id" "uuid", "p_dancer_patch" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_dancer"("p_target_user_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_full_name" "text", "p_avatar_url" "text", "p_based_city_id" "uuid", "p_dancer_patch" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_dancer"("p_target_user_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_full_name" "text", "p_avatar_url" "text", "p_based_city_id" "uuid", "p_dancer_patch" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_dancer_v1"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_dancer_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_dancer_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_create_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_verified" boolean, "p_reason" "text", "p_profile_type" "text", "p_is_primary" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_verified" boolean, "p_reason" "text", "p_profile_type" "text", "p_is_primary" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_event_profile_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_role" "text", "p_verified" boolean, "p_reason" "text", "p_profile_type" "text", "p_is_primary" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text", "p_website" "text", "p_instagram" "text", "p_facebook" "text", "p_team_member_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text", "p_website" "text", "p_instagram" "text", "p_facebook" "text", "p_team_member_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text", "p_website" "text", "p_instagram" "text", "p_facebook" "text", "p_team_member_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_organisation_signup"("p_leader_user_id" "uuid", "p_leader_first_name" "text", "p_leader_last_name" "text", "p_leader_avatar_url" "text", "p_organisation_name" "text", "p_logo_url" "text", "p_primary_city_id" "uuid", "p_category" "text", "p_phone" "text", "p_website" "text", "p_instagram" "text", "p_facebook" "text", "p_team_member_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_vendor"("p_target_user_id" "uuid", "p_vendor_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_vendor"("p_target_user_id" "uuid", "p_vendor_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_vendor"("p_target_user_id" "uuid", "p_vendor_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_create_venue_v1"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_create_venue_v1"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_create_venue_v1"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_dashboard_events_list_v1"("p_status" "text", "p_search" "text", "p_city_id" "uuid", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_dashboard_events_list_v1"("p_status" "text", "p_search" "text", "p_city_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_dashboard_events_list_v1"("p_status" "text", "p_search" "text", "p_city_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_dashboard_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_dashboard_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_delete_organiser"("p_organiser_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_organiser"("p_organiser_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_organiser"("p_organiser_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_timezone" "text", "p_created_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_timezone" "text", "p_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_country" "text", "p_timezone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_event_create_draft"("p_name" "text", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_country" "text", "p_timezone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_event_publish"("p_event_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."admin_event_update"("p_event_id" "uuid", "p_patch" "jsonb", "p_actor_user_id" "uuid") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."admin_generate_event_link_suggestions"("p_event_id" "uuid", "p_role" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_generate_event_link_suggestions"("p_event_id" "uuid", "p_role" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_generate_event_link_suggestions"("p_event_id" "uuid", "p_role" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_broken_reference_queue"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_broken_reference_queue"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_broken_reference_queue"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_connectivity_health_metrics"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_connectivity_health_metrics"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_connectivity_health_metrics"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_dancer_v1"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_dancer_v1"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_dancer_v1"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_dj_v1"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_djs_by_ids_v1"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_djs_by_ids_v1"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_djs_by_ids_v1"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_ids_v1"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_ids_v1"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_ids_v1"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_links_batch_v1"("p_event_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_links_batch_v1"("p_event_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_event_organiser_links_batch_v1"("p_event_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_event_snapshot_v2"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_event_snapshot_v2"("p_event_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_get_event_snapshot_v2"("p_event_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_get_my_city_scopes"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_my_city_scopes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_my_city_scopes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_my_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_my_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_my_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_organiser_display_rows_v1"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_organiser_display_rows_v1"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_organiser_display_rows_v1"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_suspected_duplicate_profiles"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_suspected_duplicate_profiles"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_suspected_duplicate_profiles"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_teacher_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_teacher_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_teacher_v1"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_unlinked_events_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_unlinked_events_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_unlinked_events_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_unlinked_profiles_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_unlinked_profiles_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_unlinked_profiles_queue"("p_city_id" "uuid", "p_city_slug" "text", "p_city" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_vendor_v1"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_vendor_v1"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_vendor_v1"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_get_venue_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_venue_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_venue_v1"("p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_videographer_v1"("p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_link_managers_restricted_columns_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_link_managers_restricted_columns_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_link_managers_restricted_columns_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_link_managers_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_link_managers_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_link_managers_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_dancers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_dancers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_dancers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_djs_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_djs_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_djs_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_djs_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_organiser_options_v1"("p_query" "text", "p_limit" integer, "p_controlled_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_organiser_options_v1"("p_query" "text", "p_limit" integer, "p_controlled_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_organiser_options_v1"("p_query" "text", "p_limit" integer, "p_controlled_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_request" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_request" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_request" "jsonb") TO "supabase_read_only_user";



GRANT ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_teachers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_vendors_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_vendors_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_vendors_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_list_venues_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_venues_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_venues_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_videographers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_videographers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_videographers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_videographers_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_log_link_action"("p_link_id" "uuid", "p_event_id" "uuid", "p_profile_id" "uuid", "p_profile_type" "text", "p_role" "text", "p_action" "text", "p_reason" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_log_link_action"("p_link_id" "uuid", "p_event_id" "uuid", "p_profile_id" "uuid", "p_profile_type" "text", "p_role" "text", "p_action" "text", "p_reason" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_log_link_action"("p_link_id" "uuid", "p_event_id" "uuid", "p_profile_id" "uuid", "p_profile_type" "text", "p_role" "text", "p_action" "text", "p_reason" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_normalize_name"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_normalize_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_normalize_name"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_people_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_people_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_people_audit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_people_list"("p_role" "text", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_people_search_v2"("p_request" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_people_search_v2"("p_request" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_people_search_v2"("p_request" "jsonb") TO "supabase_read_only_user";



GRANT ALL ON FUNCTION "public"."admin_people_search_v2"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_people_search_v2"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_people_search_v2"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_profile_exists"("p_profile_type" "text", "p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_profile_exists"("p_profile_type" "text", "p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_profile_exists"("p_profile_type" "text", "p_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_resolve_city"("in_city_text" "text", "in_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_resolve_city"("in_city_text" "text", "in_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_resolve_city"("in_city_text" "text", "in_city_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_resolve_user_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_review_event_link_suggestion"("p_suggestion_id" "uuid", "p_action" "text", "p_verified" boolean, "p_is_primary" boolean, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_review_event_link_suggestion"("p_suggestion_id" "uuid", "p_action" "text", "p_verified" boolean, "p_is_primary" boolean, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_review_event_link_suggestion"("p_suggestion_id" "uuid", "p_action" "text", "p_verified" boolean, "p_is_primary" boolean, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_role_to_profile_type"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_role_to_profile_type"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_role_to_profile_type"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_row_city_matches"("p_row" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_row_city_matches"("p_row" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_row_city_matches"("p_row" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_city" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_dancer_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_dj_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_event_v2"("p_payload" "jsonb") TO "supabase_read_only_user";



REVOKE ALL ON FUNCTION "public"."admin_save_event_v2_impl"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_event_v2_impl"("p_payload" "jsonb") TO "supabase_read_only_user";



REVOKE ALL ON FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_teacher_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_vendor_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_venue"("p_venue_id" "uuid", "p_city_id" "uuid", "p_name" "text", "p_address" "text", "p_capacity" integer, "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_venue"("p_venue_id" "uuid", "p_city_id" "uuid", "p_name" "text", "p_address" "text", "p_capacity" integer, "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_videographer_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_search_existing_persons_v1"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_settings_audit_insert"("p_action" "text", "p_target_user_id" "uuid", "p_reason" "text", "p_before_data" "jsonb", "p_after_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_settings_audit_insert"("p_action" "text", "p_target_user_id" "uuid", "p_reason" "text", "p_before_data" "jsonb", "p_after_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_settings_audit_insert"("p_action" "text", "p_target_user_id" "uuid", "p_reason" "text", "p_before_data" "jsonb", "p_after_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_sync_event_links_to_event_row"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_sync_event_links_to_event_row"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_sync_event_links_to_event_row"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_my_notes"("p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_my_notes"("p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_my_notes"("p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_sensitive_settings"("p_target_user_id" "uuid", "p_new_role" "text", "p_new_is_active" boolean, "p_new_city_ids" "uuid"[], "p_reason" "text", "p_reauth_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_sensitive_settings"("p_target_user_id" "uuid", "p_new_role" "text", "p_new_is_active" boolean, "p_new_city_ids" "uuid"[], "p_reason" "text", "p_reauth_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_sensitive_settings"("p_target_user_id" "uuid", "p_new_role" "text", "p_new_is_active" boolean, "p_new_city_ids" "uuid"[], "p_reason" "text", "p_reauth_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_upsert_dancer_facet_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_dancer_facet_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_dancer_facet_v1"("p_user_id" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_upsert_organiser"("p_id" "uuid", "p_name" "text", "p_avatar_url" "text", "p_city_id" "uuid", "p_claimed_by" "uuid", "p_website" "text", "p_instagram" "text", "p_socials" "jsonb", "p_organisation_category" "text", "p_contact_phone" "text", "p_team_members" "jsonb", "p_is_active" boolean, "p_profile_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_organiser"("p_id" "uuid", "p_name" "text", "p_avatar_url" "text", "p_city_id" "uuid", "p_claimed_by" "uuid", "p_website" "text", "p_instagram" "text", "p_socials" "jsonb", "p_organisation_category" "text", "p_contact_phone" "text", "p_team_members" "jsonb", "p_is_active" boolean, "p_profile_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_organiser"("p_id" "uuid", "p_name" "text", "p_avatar_url" "text", "p_city_id" "uuid", "p_claimed_by" "uuid", "p_website" "text", "p_instagram" "text", "p_socials" "jsonb", "p_organisation_category" "text", "p_contact_phone" "text", "p_team_members" "jsonb", "p_is_active" boolean, "p_profile_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_upsert_venue_facet_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_venue_facet_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_venue_facet_v1"("p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_city_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_city_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_city_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_city_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_is_event_organiser"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_event_organiser"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_event_organiser"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_reauth_within_minutes"("p_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."auth_reauth_within_minutes"("p_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_reauth_within_minutes"("p_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."block_organisers_view_writes"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_organisers_view_writes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_organisers_view_writes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_member_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_member_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_member_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calendar_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calendar_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calendar_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calendar_occurrences_prune"() TO "anon";
GRANT ALL ON FUNCTION "public"."calendar_occurrences_prune"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calendar_occurrences_prune"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calendar_occurrences_update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."calendar_occurrences_update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calendar_occurrences_update_timestamp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."calendar_occurrences_upsert_protected"("p_event_id" "uuid", "p_instance_start" timestamp with time zone, "p_instance_end" timestamp with time zone, "p_source" "text", "p_is_override" boolean, "p_override_payload" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_lifecycle_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calendar_occurrences_upsert_protected"("p_event_id" "uuid", "p_instance_start" timestamp with time zone, "p_instance_end" timestamp with time zone, "p_source" "text", "p_is_override" boolean, "p_override_payload" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_lifecycle_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calendar_occurrences_upsert_protected"("p_event_id" "uuid", "p_instance_start" timestamp with time zone, "p_instance_end" timestamp with time zone, "p_source" "text", "p_is_override" boolean, "p_override_payload" "jsonb", "p_city_id" "uuid", "p_city_slug" "text", "p_lifecycle_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_current_user_manage_event_graph"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_current_user_manage_event_graph"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_current_user_manage_event_graph"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_current_user_manage_profile"("p_profile_type" "text", "p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_current_user_manage_profile"("p_profile_type" "text", "p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_current_user_manage_profile"("p_profile_type" "text", "p_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_connectivity"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_connectivity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_connectivity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_edit_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_dancer_profile"("p_dancer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_dancer_profile"("p_dancer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_dancer_profile"("p_dancer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_dj_profile"("p_dj_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_dj_profile"("p_dj_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_dj_profile"("p_dj_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_organiser_profile"("p_organiser_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_organiser_profile"("p_organiser_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_organiser_profile"("p_organiser_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_teacher_profile"("p_teacher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_teacher_profile"("p_teacher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_teacher_profile"("p_teacher_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_vendor_profile_for_current_user"("p_vendor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dancer_completeness"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dancer_completeness"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dancer_completeness"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dancer_profiles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."dancer_profiles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dancer_profiles_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_events_summary_dto"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_venue_admin"("p_entity_id" "uuid", "actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_venue_admin"("p_entity_id" "uuid", "actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_venue_admin"("p_entity_id" "uuid", "actor_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_dancer_profile_on_role_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_dancer_profile_on_role_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_dancer_profile_on_role_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_manager_city_scope_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_manager_city_scope_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_manager_city_scope_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_event_job"("p_event_id" "uuid", "p_job_type" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_event_job"("p_event_id" "uuid", "p_job_type" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_event_job"("p_event_id" "uuid", "p_job_type" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_dancer_profile"("p_user_id" "uuid", "p_email" "text", "p_first_name" "text", "p_surname" "text", "p_city" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_dancer_profile"("p_user_id" "uuid", "p_email" "text", "p_first_name" "text", "p_surname" "text", "p_city" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_dancer_profile"("p_user_id" "uuid", "p_email" "text", "p_first_name" "text", "p_surname" "text", "p_city" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_entity_is_venue"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."ensure_event_city_canonical"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_event_city_canonical"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_event_city_canonical"() TO "service_role";



GRANT ALL ON FUNCTION "public"."event_profile_link_suggestions_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."event_profile_link_suggestions_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."event_profile_link_suggestions_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."event_profile_links_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."event_profile_links_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."event_profile_links_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."events_sync_lifecycle_and_active"() TO "anon";
GRANT ALL ON FUNCTION "public"."events_sync_lifecycle_and_active"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."events_sync_lifecycle_and_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fill_city_id_from_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."fill_city_id_from_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_city_id_from_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_occurrences_for_event"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_occurrences_for_event_backup"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_event_backup"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_event_backup"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_cities"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_cities"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_cities"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_based_city_prefill"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_based_city_prefill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_based_city_prefill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text", "city_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text", "city_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_calendar_events"("range_start" timestamp with time zone, "range_end" timestamp with time zone, "city_slug_param" "text", "city_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_organiser_entity_ids_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_organiser_entity_ids_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_organiser_entity_ids_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_discount_partners_with_next_event"("p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_discount_partners_with_next_event"("p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_discount_partners_with_next_event"("p_city_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entity_events"("p_entity_id" "uuid", "p_role" "text", "p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_entity_events"("p_entity_id" "uuid", "p_role" "text", "p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entity_events"("p_entity_id" "uuid", "p_role" "text", "p_city_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_engagement"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_engagement"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_engagement"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_page_snapshot"("p_event_id" "uuid", "p_occurrence_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_page_snapshot"("p_event_id" "uuid", "p_occurrence_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_profile_connections"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_profile_connections"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_profile_connections"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_festival_attendance"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_festival_attendance"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_festival_attendance"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_occurrences_by_canonical_venue"("_venue_id" "uuid", "_start_at" timestamp with time zone, "_end_at" timestamp with time zone, "_limit" integer, "_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_occurrences_by_canonical_venue"("_venue_id" "uuid", "_start_at" timestamp with time zone, "_end_at" timestamp with time zone, "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_occurrences_by_canonical_venue"("_venue_id" "uuid", "_start_at" timestamp with time zone, "_end_at" timestamp with time zone, "_limit" integer, "_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organiser_event_counts"("p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organiser_event_counts"("p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organiser_event_counts"("p_city_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organiser_linked_events"("p_organiser_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_event_timeline"("p_person_type" "text", "p_person_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_event_timeline"("p_person_type" "text", "p_person_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_event_timeline"("p_person_type" "text", "p_person_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_dancer_preview_v1"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_dancer_preview_v1"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_dancer_preview_v1"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_dj_preview_v1"("p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_event_detail"("p_event_id" "uuid", "p_occurrence_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_festival_detail"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_organiser_info"("organiser_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_organiser_info"("organiser_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_organiser_info"("organiser_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_teacher_detail_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_teacher_detail_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_teacher_detail_v1"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_teacher_preview_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_teacher_preview_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_teacher_preview_v1"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_venue_preview_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_venue_preview_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_venue_preview_v1"("p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_videographer_preview_v1"("p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_identity_prefill"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_identity_prefill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_identity_prefill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_participant_events"("p_user_email" "text", "p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_participant_events"("p_user_email" "text", "p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_participant_events"("p_user_email" "text", "p_city_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_venue_detail"("p_venue_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_venue_detail"("p_venue_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_venue_detail"("p_venue_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_venue_events"("p_venue_id" "uuid", "p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_venue_events"("p_venue_id" "uuid", "p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_venue_events"("p_venue_id" "uuid", "p_city_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_dancer_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_dancer_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_dancer_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_dancer_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_dancer_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_dancer_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."idempotency_claim"("p_key" "text", "p_request_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."idempotency_claim"("p_key" "text", "p_request_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."idempotency_claim"("p_key" "text", "p_request_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."idempotency_get"("p_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."idempotency_get"("p_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."idempotency_get"("p_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."idempotency_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."idempotency_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."idempotency_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."idempotency_store"("p_key" "text", "p_request_hash" "text", "p_status" "text", "p_response" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."idempotency_store"("p_key" "text", "p_request_hash" "text", "p_status" "text", "p_response" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."idempotency_store"("p_key" "text", "p_request_hash" "text", "p_status" "text", "p_response" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_city_slug"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_city_slug"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_city_slug"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_events_dto"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_city_id" "uuid", "p_venue_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."member_profiles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."member_profiles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."member_profiles_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_event_instances"("p_instances" "jsonb", "p_event_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_event_instances"("p_instances" "jsonb", "p_event_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_event_instances"("p_instances" "jsonb", "p_event_row" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_lock_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_lock_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_advisory_unlock_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_advisory_unlock_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_try_advisory_lock_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pg_try_advisory_lock_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_try_advisory_lock_event"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."propagate_event_venue_to_future_occurrences"("_event_id" "uuid", "_from_occurrence_id" "uuid", "_new_venue_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propagate_event_venue_to_future_occurrences"("_event_id" "uuid", "_from_occurrence_id" "uuid", "_new_venue_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_event_venue_to_future_occurrences"("_event_id" "uuid", "_from_occurrence_id" "uuid", "_new_venue_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."quarantine_invalid_occurrence"() TO "anon";
GRANT ALL ON FUNCTION "public"."quarantine_invalid_occurrence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."quarantine_invalid_occurrence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_city_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_city_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_city_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_city_request"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_event_program"("p_event_id" "uuid", "p_meta_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_or_patch_guest_dancers"("p_event_id" "uuid", "p_guest_dancers" "jsonb", "p_replace" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_or_patch_guest_dancers"("p_event_id" "uuid", "p_guest_dancers" "jsonb", "p_replace" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_or_patch_lineup"("p_event_id" "uuid", "p_lineup" "jsonb", "p_replace" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_or_patch_lineup"("p_event_id" "uuid", "p_lineup" "jsonb", "p_replace" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_or_patch_occurrences"("p_event_id" "uuid", "p_occurrences" "jsonb", "p_replace" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_or_patch_occurrences"("p_event_id" "uuid", "p_occurrences" "jsonb", "p_replace" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_or_patch_organisers"("p_event_id" "uuid", "p_organisers" "jsonb", "p_replace" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_or_patch_organisers"("p_event_id" "uuid", "p_organisers" "jsonb", "p_replace" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_city_id"("p_city" "text", "p_city_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_city_id"("p_city" "text", "p_city_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_city_id"("p_city" "text", "p_city_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_guest_assignments"("p_event_id" "uuid", "p_timezone" "text", "p_assignments" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_guest_assignments"("p_event_id" "uuid", "p_timezone" "text", "p_assignments" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."resolve_guest_assignments"("p_event_id" "uuid", "p_timezone" "text", "p_assignments" "jsonb") TO "supabase_admin";



REVOKE ALL ON FUNCTION "public"."save_event_core"("p_event_id" "uuid", "p_event_core" "jsonb") FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."search_cities"("p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_cities"("p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_cities"("p_query" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."event_attendance" TO "anon";
GRANT ALL ON TABLE "public"."event_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attendance" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_attendance"("p_event_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_attendance"("p_event_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attendance"("p_event_id" "uuid", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_calendar_occurrence_venue"("_occurrence_id" "uuid", "_venue_id" "uuid", "_propagate" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_calendar_occurrence_venue"("_occurrence_id" "uuid", "_venue_id" "uuid", "_propagate" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_calendar_occurrence_venue"("_occurrence_id" "uuid", "_venue_id" "uuid", "_propagate" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_city_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_city_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_city_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_guest_dancer_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_guest_dancer_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_guest_dancer_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_city_text_to_city_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_city_text_to_city_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_city_text_to_city_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_event_city_to_city_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_event_city_to_city_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_event_city_to_city_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_venue_to_entities_minimal"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."trg_enforce_manager_city_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enforce_manager_city_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enforce_manager_city_scope"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_attendance_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_attendance_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_attendance_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_actor" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_actor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_event_guest_dancer_link"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_actor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_event_profile_connection"("p_event_id" "uuid", "p_person_type" "text", "p_person_id" "uuid", "p_connection_label" "text", "p_is_primary" boolean, "p_sort_order" integer, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_event_profile_connection"("p_event_id" "uuid", "p_person_type" "text", "p_person_id" "uuid", "p_connection_label" "text", "p_is_primary" boolean, "p_sort_order" integer, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_event_profile_connection"("p_event_id" "uuid", "p_person_type" "text", "p_person_id" "uuid", "p_connection_label" "text", "p_is_primary" boolean, "p_sort_order" integer, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text", "p_based_city_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_avatar_url" "text", "p_photo_url" "text", "p_nationality" "text", "p_favorite_styles" "text"[], "p_favorite_songs" "text"[], "p_achievements" "text"[], "p_partner_role" "text", "p_partner_details" "text", "p_instagram" "text", "p_looking_for_partner" boolean, "p_facebook" "text", "p_partner_practice_goals" "text"[], "p_website" "text", "p_dancing_start_date" "text", "p_partner_search_level" "text"[], "p_partner_search_role" "text", "p_first_name_dancer" "text", "p_surname" "text", "p_city_id" "uuid", "p_whatsapp" "text", "p_is_active" boolean, "p_profile_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text", "p_based_city_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_avatar_url" "text", "p_photo_url" "text", "p_nationality" "text", "p_favorite_styles" "text"[], "p_favorite_songs" "text"[], "p_achievements" "text"[], "p_partner_role" "text", "p_partner_details" "text", "p_instagram" "text", "p_looking_for_partner" boolean, "p_facebook" "text", "p_partner_practice_goals" "text"[], "p_website" "text", "p_dancing_start_date" "text", "p_partner_search_level" "text"[], "p_partner_search_role" "text", "p_first_name_dancer" "text", "p_surname" "text", "p_city_id" "uuid", "p_whatsapp" "text", "p_is_active" boolean, "p_profile_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text", "p_based_city_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_avatar_url" "text", "p_photo_url" "text", "p_nationality" "text", "p_favorite_styles" "text"[], "p_favorite_songs" "text"[], "p_achievements" "text"[], "p_partner_role" "text", "p_partner_details" "text", "p_instagram" "text", "p_looking_for_partner" boolean, "p_facebook" "text", "p_partner_practice_goals" "text"[], "p_website" "text", "p_dancing_start_date" "text", "p_partner_search_level" "text"[], "p_partner_search_role" "text", "p_first_name_dancer" "text", "p_surname" "text", "p_city_id" "uuid", "p_whatsapp" "text", "p_is_active" boolean, "p_profile_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_full_member_and_dancer"("p_user_id" "uuid", "p_full_name" "text", "p_based_city_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_avatar_url" "text", "p_photo_url" "text", "p_nationality" "text", "p_favorite_styles" "text"[], "p_favorite_songs" "text"[], "p_achievements" "text"[], "p_partner_role" "text", "p_partner_details" "text", "p_instagram" "text", "p_looking_for_partner" boolean, "p_facebook" "text", "p_partner_practice_goals" "text"[], "p_website" "text", "p_dancing_start_date" "text", "p_partner_search_level" "text"[], "p_partner_search_role" "text", "p_first_name_dancer" "text", "p_surname" "text", "p_city_id" "uuid", "p_whatsapp" "text", "p_is_active" boolean, "p_profile_source" "text") TO "service_role";



GRANT ALL ON TABLE "public"."event_profile_links" TO "service_role";
GRANT SELECT ON TABLE "public"."event_profile_links" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."event_profile_links" TO "authenticated";



GRANT ALL ON FUNCTION "public"."upsert_guest_dancer"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_archived_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_guest_dancer"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_archived_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_guest_dancer"("p_event_id" "uuid", "p_profile_id" "uuid", "p_occurrence_id" "uuid", "p_archived_at" timestamp with time zone) TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "service_role";
GRANT SELECT ON TABLE "public"."venues" TO "anon";
GRANT SELECT ON TABLE "public"."venues" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."upsert_venue_admin"("payload" "jsonb", "actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_venue_admin"("payload" "jsonb", "actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_venue_admin"("payload" "jsonb", "actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_venue_atomic"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_venue_atomic"("payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."uuid_to_bigint"("p_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."uuid_to_bigint"("p_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_to_bigint"("p_uuid" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_link_managers" TO "anon";
GRANT ALL ON TABLE "public"."admin_link_managers" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_link_managers" TO "service_role";



GRANT ALL ON TABLE "public"."admin_manager_city_scopes" TO "anon";
GRANT ALL ON TABLE "public"."admin_manager_city_scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_manager_city_scopes" TO "service_role";



GRANT ALL ON TABLE "public"."dj_profiles" TO "anon";
GRANT ALL ON TABLE "public"."dj_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."dj_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."entities" TO "service_role";
GRANT SELECT ON TABLE "public"."entities" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."entities" TO "anon";



GRANT SELECT("name") ON TABLE "public"."entities" TO "anon";



GRANT SELECT("avatar_url") ON TABLE "public"."entities" TO "anon";



GRANT ALL ON TABLE "public"."member_profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."member_profiles" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organisers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organisers" TO "authenticated";
GRANT ALL ON TABLE "public"."organisers" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_profiles" TO "anon";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."admin_people_view" TO "service_role";



GRANT ALL ON TABLE "public"."admin_settings_audit" TO "anon";
GRANT ALL ON TABLE "public"."admin_settings_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_settings_audit" TO "service_role";



GRANT ALL ON TABLE "public"."admin_super_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_super_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_super_users" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."admin_venues_read" TO "anon";
GRANT ALL ON TABLE "public"."admin_venues_read" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_venues_read" TO "service_role";



GRANT ALL ON TABLE "public"."backend_closure_records" TO "anon";
GRANT ALL ON TABLE "public"."backend_closure_records" TO "authenticated";
GRANT ALL ON TABLE "public"."backend_closure_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."backend_closure_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."backend_closure_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."backend_closure_records_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calendar_occurrences" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calendar_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_occurrences" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_feed" TO "anon";
GRANT ALL ON TABLE "public"."calendar_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_feed" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_occurrence_quarantine" TO "anon";
GRANT ALL ON TABLE "public"."calendar_occurrence_quarantine" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_occurrence_quarantine" TO "service_role";



GRANT ALL ON TABLE "public"."city_aliases" TO "anon";
GRANT ALL ON TABLE "public"."city_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."city_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."city_deprecation_usage_audit" TO "anon";
GRANT ALL ON TABLE "public"."city_deprecation_usage_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."city_deprecation_usage_audit" TO "service_role";



GRANT ALL ON TABLE "public"."city_requests" TO "anon";
GRANT ALL ON TABLE "public"."city_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."city_requests" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dancer_profiles" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dancer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_profiles" TO "service_role";



GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dancer_profiles_legacy_backup" TO "anon";
GRANT ALL ON TABLE "public"."dancer_profiles_legacy_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."dancer_profiles_legacy_backup" TO "service_role";



GRANT ALL ON TABLE "public"."djs" TO "anon";
GRANT ALL ON TABLE "public"."djs" TO "authenticated";
GRANT ALL ON TABLE "public"."djs" TO "service_role";



GRANT ALL ON TABLE "public"."edge_auth_bootstrap_manifest" TO "anon";
GRANT ALL ON TABLE "public"."edge_auth_bootstrap_manifest" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_auth_bootstrap_manifest" TO "service_role";



GRANT ALL ON SEQUENCE "public"."edge_auth_bootstrap_manifest_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."edge_auth_bootstrap_manifest_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."edge_auth_bootstrap_manifest_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_attendees" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."event_audit" TO "anon";
GRANT ALL ON TABLE "public"."event_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."event_audit" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."event_entities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."event_entities" TO "service_role";



GRANT ALL ON TABLE "public"."event_instances" TO "anon";
GRANT ALL ON TABLE "public"."event_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."event_instances" TO "service_role";



GRANT ALL ON TABLE "public"."event_jobs" TO "anon";
GRANT ALL ON TABLE "public"."event_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."event_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."event_passes" TO "anon";
GRANT ALL ON TABLE "public"."event_passes" TO "authenticated";
GRANT ALL ON TABLE "public"."event_passes" TO "service_role";



GRANT ALL ON TABLE "public"."event_permissions" TO "anon";
GRANT ALL ON TABLE "public"."event_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."event_posts" TO "anon";
GRANT ALL ON TABLE "public"."event_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."event_posts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."event_posts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."event_posts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_profile_connections" TO "anon";
GRANT ALL ON TABLE "public"."event_profile_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."event_profile_connections" TO "service_role";



GRANT ALL ON TABLE "public"."event_profile_link_audit" TO "anon";
GRANT ALL ON TABLE "public"."event_profile_link_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."event_profile_link_audit" TO "service_role";



GRANT ALL ON TABLE "public"."event_profile_link_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."event_profile_link_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_profile_link_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."event_program_djs" TO "anon";
GRANT ALL ON TABLE "public"."event_program_djs" TO "authenticated";
GRANT ALL ON TABLE "public"."event_program_djs" TO "service_role";



GRANT ALL ON TABLE "public"."event_program_instructors" TO "anon";
GRANT ALL ON TABLE "public"."event_program_instructors" TO "authenticated";
GRANT ALL ON TABLE "public"."event_program_instructors" TO "service_role";



GRANT ALL ON TABLE "public"."event_program_items" TO "anon";
GRANT ALL ON TABLE "public"."event_program_items" TO "authenticated";
GRANT ALL ON TABLE "public"."event_program_items" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."event_tracks" TO "anon";
GRANT ALL ON TABLE "public"."event_tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."event_tracks" TO "service_role";



GRANT ALL ON TABLE "public"."event_views" TO "anon";
GRANT ALL ON TABLE "public"."event_views" TO "authenticated";
GRANT ALL ON TABLE "public"."event_views" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."guest_dancer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."guest_dancer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_dancer_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."hardening_preserve_baseline" TO "anon";
GRANT ALL ON TABLE "public"."hardening_preserve_baseline" TO "authenticated";
GRANT ALL ON TABLE "public"."hardening_preserve_baseline" TO "service_role";



GRANT ALL ON TABLE "public"."hardening_seed_contract_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."hardening_seed_contract_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."hardening_seed_contract_snapshot" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hardening_seed_contract_snapshot_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hardening_seed_contract_snapshot_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hardening_seed_contract_snapshot_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency" TO "anon";
GRANT ALL ON TABLE "public"."idempotency" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."member_profiles_directory" TO "anon";
GRANT ALL ON TABLE "public"."member_profiles_directory" TO "authenticated";
GRANT ALL ON TABLE "public"."member_profiles_directory" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_targets" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_targets" TO "service_role";



GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v1" TO "anon";
GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v1" TO "service_role";



GRANT ALL ON TABLE "public"."organiser_team_members" TO "anon";
GRANT ALL ON TABLE "public"."organiser_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organiser_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v2" TO "anon";
GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."organiser_admin_dashboard_v2" TO "service_role";



GRANT ALL ON TABLE "public"."person_account_links" TO "anon";
GRANT ALL ON TABLE "public"."person_account_links" TO "authenticated";
GRANT ALL ON TABLE "public"."person_account_links" TO "service_role";



GRANT ALL ON TABLE "public"."person_identities" TO "anon";
GRANT ALL ON TABLE "public"."person_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."person_identities" TO "service_role";



GRANT ALL ON TABLE "public"."person_profiles" TO "anon";
GRANT ALL ON TABLE "public"."person_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."person_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."phase4_tmp_occurrence_write_city_compat_audit" TO "anon";
GRANT ALL ON TABLE "public"."phase4_tmp_occurrence_write_city_compat_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."phase4_tmp_occurrence_write_city_compat_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."phase4_tmp_occurrence_write_city_compat_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."phase4_tmp_occurrence_write_city_compat_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."phase4_tmp_occurrence_write_city_compat_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_claims" TO "anon";
GRANT ALL ON TABLE "public"."profile_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_claims" TO "service_role";



GRANT ALL ON TABLE "public"."public_visible_dancers" TO "anon";
GRANT ALL ON TABLE "public"."public_visible_dancers" TO "authenticated";
GRANT ALL ON TABLE "public"."public_visible_dancers" TO "service_role";



GRANT ALL ON TABLE "public"."rpc_city_compat_audit" TO "anon";
GRANT ALL ON TABLE "public"."rpc_city_compat_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."rpc_city_compat_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rpc_city_compat_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rpc_city_compat_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rpc_city_compat_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rpc_deprecation_log" TO "anon";
GRANT ALL ON TABLE "public"."rpc_deprecation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rpc_deprecation_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rpc_deprecation_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rpc_deprecation_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rpc_deprecation_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."staging_cities" TO "anon";
GRANT ALL ON TABLE "public"."staging_cities" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_cities" TO "service_role";



GRANT ALL ON TABLE "public"."trigger_layer_manifest" TO "anon";
GRANT ALL ON TABLE "public"."trigger_layer_manifest" TO "authenticated";
GRANT ALL ON TABLE "public"."trigger_layer_manifest" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trigger_layer_manifest_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trigger_layer_manifest_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trigger_layer_manifest_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."videographers" TO "anon";
GRANT ALL ON TABLE "public"."videographers" TO "authenticated";
GRANT ALL ON TABLE "public"."videographers" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_page_resolved" TO "anon";
GRANT ALL ON TABLE "public"."v_event_page_resolved" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_page_resolved" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_page_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."v_event_page_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_page_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."v_is_admin" TO "anon";
GRANT ALL ON TABLE "public"."v_is_admin" TO "authenticated";
GRANT ALL ON TABLE "public"."v_is_admin" TO "service_role";



GRANT ALL ON TABLE "public"."venue_city_audit_view" TO "anon";
GRANT ALL ON TABLE "public"."venue_city_audit_view" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_city_audit_view" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







