-- Portability capture: get_event_page_snapshot_v2
-- Date: 2026-04-11
-- Reason: This function existed in production but had no corresponding
-- local migration. Captured verbatim from pg_get_functiondef() on the live
-- DB so that a DB rebuild from migrations produces an identical function.
-- No logic changed -- pure capture.

CREATE OR REPLACE FUNCTION public.get_event_page_snapshot_v2(p_event_id uuid, p_occurrence_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event          record;
  v_meta           jsonb;
  v_occ_eff        record;
  v_occ_eff_id     uuid;
  v_venue          record;
  v_venue_obj      jsonb;
  v_city           record;
  v_city_eff_id    uuid;
  v_venue_eff_id   uuid;
  v_timezone       text;
  v_cover_url      text;
  v_meta_public    jsonb;
  v_organisers     jsonb := '[]'::jsonb;
  v_person_lookup  jsonb := '{}'::jsonb;
  v_occurrences    jsonb := '[]'::jsonb;
  v_occ_effective  jsonb := NULL;
  v_occ            record;
  v_occ_teachers   jsonb;
  v_occ_djs        jsonb;
  v_occ_dancers    jsonb;
  v_occ_vendors    jsonb;
  v_occ_vids       jsonb;
  v_occ_json       jsonb;
  v_att_count      bigint := 0;
  v_att_status     text   := NULL;
  v_att_preview    jsonb  := '[]'::jsonb;
  v_uid            uuid;
BEGIN
  -- ΓöÇΓöÇ 1. Load event (published only) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND OR v_event.lifecycle_status <> 'published' THEN
    RETURN NULL;
  END IF;

  v_meta := COALESCE(v_event.meta_data, '{}'::jsonb);
  v_uid  := auth.uid();

  -- ΓöÇΓöÇ 2. Find effective occurrence ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  IF p_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occ_eff
    FROM public.calendar_occurrences
    WHERE id = p_occurrence_id AND event_id = p_event_id;
    IF FOUND THEN v_occ_eff_id := v_occ_eff.id; END IF;
  END IF;

  IF v_occ_eff_id IS NULL THEN
    -- Next upcoming first, then most recent past
    SELECT * INTO v_occ_eff
    FROM public.calendar_occurrences
    WHERE event_id = p_event_id
      AND COALESCE(lifecycle_status, 'published') <> 'cancelled'
    ORDER BY (instance_start >= now()) DESC, instance_start ASC
    LIMIT 1;
    IF FOUND THEN v_occ_eff_id := v_occ_eff.id; END IF;
  END IF;

  -- ΓöÇΓöÇ 3. Resolve location ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  v_venue_eff_id := COALESCE(v_occ_eff.venue_id, v_event.venue_id);
  v_city_eff_id  := COALESCE(v_occ_eff.city_id, v_event.city_id);

  IF v_venue_eff_id IS NOT NULL THEN
    SELECT * INTO v_venue FROM public.venues WHERE id = v_venue_eff_id;
    IF FOUND THEN
      v_venue_obj := to_jsonb(v_venue);
    END IF;
  END IF;

  IF v_city_eff_id IS NOT NULL THEN
    SELECT * INTO v_city FROM public.cities WHERE id = v_city_eff_id;
  END IF;

  v_timezone := COALESCE(
    v_event.timezone,
    v_meta->>'timezone',
    v_venue_obj->>'timezone',
    v_city.timezone,
    'UTC'
  );

  -- ΓöÇΓöÇ 4. Cover image ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  v_cover_url := CASE
    WHEN v_event.poster_url IS NOT NULL AND length(trim(v_event.poster_url)) > 0
    THEN v_event.poster_url
    ELSE NULL
  END;

  -- ΓöÇΓöÇ 5. Build meta_data_public ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  v_meta_public := jsonb_build_object(
    'tickets',       COALESCE(v_meta->'tickets', '[]'::jsonb),
    'promo_codes',   COALESCE(v_meta->'promo_codes', '[]'::jsonb),
    'whatsapp_link', v_meta->>'whatsapp_link',
    'tiktok_url',    v_meta->>'tiktok_url',
    'livestream_url',v_meta->>'livestream_url'
  );

  -- ΓöÇΓöÇ 6. Resolve organisers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ent.id,
      'display_name', ent.name,
      'avatar_url', ent.avatar_url
    ) ORDER BY ee.created_at
  ), '[]'::jsonb)
  INTO v_organisers
  FROM public.event_entities ee
  JOIN public.entities ent ON ent.id = ee.entity_id
  WHERE ee.event_id = p_event_id AND ee.role = 'organiser';

  -- ΓöÇΓöÇ 7. Pre-resolve all lineup persons ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  -- Build a lookup: profile_id::text -> {id, display_name, avatar_url}
  -- One pass per role table, unioned together.
  SELECT COALESCE(jsonb_object_agg(sub.pid::text, sub.pjson), '{}'::jsonb)
  INTO v_person_lookup
  FROM (
    -- Teachers
    SELECT tp.id AS pid, jsonb_build_object(
      'id', tp.id,
      'display_name', COALESCE(
        NULLIF(TRIM(COALESCE(tp.first_name,'') ||
          CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname)) > 0
               THEN ' ' || trim(tp.surname) ELSE '' END), ''),
        tp.id::text),
      'avatar_url', tp.photo_url
    ) AS pjson
    FROM public.teacher_profiles tp
    WHERE tp.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'teacher'
        AND status = 'active' AND archived_at IS NULL
    )

    UNION ALL

    -- DJs
    SELECT dj.id, jsonb_build_object(
      'id', dj.id,
      'display_name', COALESCE(
        NULLIF(trim(COALESCE(dj.dj_name, dj.name, dj.real_name, '')), ''),
        dj.id::text),
      'avatar_url', dj.photo_url
    )
    FROM public.dj_profiles dj
    WHERE dj.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'dj'
        AND status = 'active' AND archived_at IS NULL
    )

    UNION ALL

    -- Dancers (dancer_profiles ΓÇö profile_type = 'dancer')
    SELECT dp.id, jsonb_build_object(
      'id', dp.id,
      'display_name', COALESCE(
        NULLIF(TRIM(COALESCE(dp.first_name,'') ||
          CASE WHEN dp.surname IS NOT NULL AND length(trim(dp.surname)) > 0
               THEN ' ' || trim(dp.surname) ELSE '' END), ''),
        dp.id::text),
      'avatar_url', dp.avatar_url
    )
    FROM public.dancer_profiles dp
    WHERE dp.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'dancer'
        AND profile_type = 'dancer'
        AND status = 'active' AND archived_at IS NULL
    )

    UNION ALL

    -- Guest dancers (guest_dancer_profiles ΓÇö profile_type = 'guest_dancer')
    SELECT gd.id, jsonb_build_object(
      'id', gd.id,
      'display_name', COALESCE(
        NULLIF(TRIM(COALESCE(gd.first_name,'') ||
          CASE WHEN gd.surname IS NOT NULL AND length(trim(gd.surname)) > 0
               THEN ' ' || trim(gd.surname) ELSE '' END), ''),
        gd.id::text),
      'avatar_url', gd.avatar_url
    )
    FROM public.guest_dancer_profiles gd
    WHERE gd.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'dancer'
        AND profile_type = 'guest_dancer'
        AND status = 'active' AND archived_at IS NULL
    )

    UNION ALL

    -- Vendors
    SELECT vnd.id, jsonb_build_object(
      'id', vnd.id,
      'display_name', COALESCE(
        NULLIF(trim(COALESCE(vnd.business_name, '')), ''),
        NULLIF(TRIM(COALESCE(vnd.first_name,'') ||
          CASE WHEN vnd.surname IS NOT NULL AND length(trim(vnd.surname)) > 0
               THEN ' ' || trim(vnd.surname) ELSE '' END), ''),
        vnd.id::text),
      'avatar_url', vnd.photo_url
    )
    FROM public.vendors vnd
    WHERE vnd.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'vendor'
        AND status = 'active' AND archived_at IS NULL
    )

    UNION ALL

    -- Videographers
    SELECT vid.id, jsonb_build_object(
      'id', vid.id,
      'display_name', COALESCE(
        NULLIF(trim(COALESCE(vid.business_name, '')), ''),
        NULLIF(TRIM(COALESCE(vid.first_name,'') ||
          CASE WHEN vid.surname IS NOT NULL AND length(trim(vid.surname)) > 0
               THEN ' ' || trim(vid.surname) ELSE '' END), ''),
        vid.id::text),
      'avatar_url', vid.photo_url
    )
    FROM public.videographers vid
    WHERE vid.id IN (
      SELECT profile_id FROM public.event_profile_links
      WHERE event_id = p_event_id AND role = 'videographer'
        AND status = 'active' AND archived_at IS NULL
    )
  ) sub;

  -- ΓöÇΓöÇ 8. Build occurrences with per-occurrence lineup ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  FOR v_occ IN
    SELECT *
    FROM public.calendar_occurrences
    WHERE event_id = p_event_id
    ORDER BY instance_start
    LIMIT 52
  LOOP
    -- One query per occurrence: resolve all 5 roles using FILTER
    -- DISTINCT ON (profile_id, role) with occurrence-specific override priority
    SELECT
      COALESCE(jsonb_agg(v_person_lookup->(d.profile_id::text))
        FILTER (WHERE d.role = 'teacher'), '[]'::jsonb),
      COALESCE(jsonb_agg(v_person_lookup->(d.profile_id::text))
        FILTER (WHERE d.role = 'dj'), '[]'::jsonb),
      COALESCE(jsonb_agg(v_person_lookup->(d.profile_id::text))
        FILTER (WHERE d.role = 'dancer'), '[]'::jsonb),
      COALESCE(jsonb_agg(v_person_lookup->(d.profile_id::text))
        FILTER (WHERE d.role = 'vendor'), '[]'::jsonb),
      COALESCE(jsonb_agg(v_person_lookup->(d.profile_id::text))
        FILTER (WHERE d.role = 'videographer'), '[]'::jsonb)
    INTO v_occ_teachers, v_occ_djs, v_occ_dancers, v_occ_vendors, v_occ_vids
    FROM (
      SELECT DISTINCT ON (profile_id, role) profile_id, role
      FROM public.event_profile_links
      WHERE event_id = p_event_id
        AND status = 'active' AND archived_at IS NULL
        AND role IN ('teacher', 'dj', 'dancer', 'vendor', 'videographer')
        AND (occurrence_id IS NULL OR occurrence_id = v_occ.id)
      ORDER BY profile_id, role, (occurrence_id IS NOT NULL) DESC
    ) d
    WHERE v_person_lookup ? (d.profile_id::text);

    v_occ_json := jsonb_build_object(
      'occurrence_id', v_occ.id,
      'starts_at',     v_occ.instance_start,
      'ends_at',       v_occ.instance_end,
      'local_date',    to_char(v_occ.instance_start AT TIME ZONE v_timezone, 'YYYY-MM-DD'),
      'timezone',      v_timezone,
      'is_cancelled',  COALESCE(v_occ.lifecycle_status, 'published') = 'cancelled',
      'is_live',       now() BETWEEN v_occ.instance_start
                         AND COALESCE(v_occ.instance_end, v_occ.instance_start + interval '4 hours'),
      'is_past',       COALESCE(v_occ.instance_end, v_occ.instance_start) < now(),
      'is_upcoming',   v_occ.instance_start > now(),
      'lineup', jsonb_build_object(
        'teachers',     v_occ_teachers,
        'djs',          v_occ_djs,
        'dancers',      v_occ_dancers,
        'vendors',      v_occ_vendors,
        'videographers', v_occ_vids
      )
    );

    v_occurrences := v_occurrences || jsonb_build_array(v_occ_json);

    IF v_occ.id = v_occ_eff_id THEN
      v_occ_effective := v_occ_json;
    END IF;
  END LOOP;

  -- ΓöÇΓöÇ 9. Attendance ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  IF to_regclass('public.event_attendance') IS NOT NULL AND v_occ_eff_id IS NOT NULL THEN
    EXECUTE $att$
      SELECT COUNT(*)
      FROM public.event_attendance ea
      WHERE ea.occurrence_id = $1 AND ea.status = 'going'
    $att$ INTO v_att_count USING v_occ_eff_id;

    IF v_uid IS NOT NULL THEN
      EXECUTE $att$
        SELECT ea.status
        FROM public.event_attendance ea
        WHERE ea.occurrence_id = $1 AND ea.user_id = $2
        LIMIT 1
      $att$ INTO v_att_status USING v_occ_eff_id, v_uid;
    END IF;

    EXECUTE $att$
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
    $att$ INTO v_att_preview USING v_occ_eff_id;

  ELSIF to_regclass('public.event_participants') IS NOT NULL THEN
    EXECUTE $att$
      SELECT COUNT(*)
      FROM public.event_participants ep
      WHERE ep.event_id = $1 AND ep.status = 'going'
    $att$ INTO v_att_count USING p_event_id;

    IF v_uid IS NOT NULL THEN
      EXECUTE $att$
        SELECT ep.status
        FROM public.event_participants ep
        WHERE ep.event_id = $1 AND ep.user_id = $2
        LIMIT 1
      $att$ INTO v_att_status USING p_event_id, v_uid;
    END IF;

    EXECUTE $att$
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
    $att$ INTO v_att_preview USING p_event_id;
  END IF;

  -- ΓöÇΓöÇ 10. Return final snapshot ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  RETURN jsonb_build_object(
    'event_id',       p_event_id,
    'occurrence_id',  v_occ_eff_id,

    'event', jsonb_build_object(
      'name',            v_event.name,
      'description',     v_event.description,
      'status',          v_event.lifecycle_status,
      'is_published',    true,
      'created_by',      v_event.created_by,
      'cover_image_url', v_cover_url,
      'hero_image_url',  v_cover_url,
      'photo_urls',      COALESCE(v_meta->'gallery', '[]'::jsonb),
      'music_styles',    COALESCE(v_meta->'music_styles', '[]'::jsonb),
      'key_times',       COALESCE(v_meta->'key_times', v_event.key_times),
      'meta_data_public', v_meta_public,
      'actions', jsonb_build_object(
        'ticket_url',    v_event.ticket_url,
        'website_url',   v_event.website,
        'facebook_url',  v_event.facebook_url,
        'instagram_url', v_event.instagram_url,
        'pricing',       COALESCE(v_event.pricing, '{}'::jsonb)
      )
    ),

    'organisers',           v_organisers,
    'occurrences',          v_occurrences,
    'occurrence_effective', v_occ_effective,

    'location_default', jsonb_build_object(
      'city', CASE
        WHEN v_city.id IS NOT NULL THEN jsonb_build_object(
          'id',   v_city.id,
          'name', v_city.name,
          'slug', v_city.slug
        ) ELSE NULL END,
      'venue', CASE
        WHEN v_venue_obj IS NOT NULL THEN jsonb_build_object(
          'id',               v_venue_obj->>'id',
          'name',             v_venue_obj->>'name',
          'address_line',     v_venue_obj->>'address',
          'postcode',         v_venue_obj->>'postcode',
          'google_maps_link', v_venue_obj->>'google_maps_link',
          'image_url',        v_venue_obj->'photo_url'->>0,
          'gallery_urls',     COALESCE(v_venue_obj->'gallery_urls', '[]'::jsonb),
          'transport_json',   v_venue_obj->'transport_json',
          'description',      v_venue_obj->>'description',
          'capacity',         v_venue_obj->'capacity',
          'floor_type',       v_venue_obj->>'floor_type',
          'facilities_new',   COALESCE(v_venue_obj->'facilities_new', '[]'::jsonb),
          'timezone',         v_venue_obj->>'timezone'
        ) ELSE NULL END,
      'timezone', v_timezone
    ),

    'attendance', jsonb_build_object(
      'going_count',        v_att_count,
      'current_user_status', v_att_status,
      'preview',            v_att_preview
    )
  );
END;
$function$


-- Grants matching production
GRANT EXECUTE ON FUNCTION public.get_event_page_snapshot_v2(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_page_snapshot_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_page_snapshot_v2(uuid, uuid) TO service_role;
