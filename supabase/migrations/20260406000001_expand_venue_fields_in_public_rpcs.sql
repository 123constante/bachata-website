-- Migration: Expand venue fields in get_event_page_snapshot and get_public_festival_detail
-- Date: 2026-04-06
-- Applied directly to Supabase remote — saved locally for history sync.

CREATE OR REPLACE FUNCTION public.get_event_page_snapshot(p_event_id uuid, p_occurrence_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_event            record;
  v_occurrence       record;
  v_occurrence_id    uuid    := p_occurrence_id;
  v_city             record;
  v_venue            record;
  v_city_eff_id      uuid;
  v_tz               text;
  v_occurrences      jsonb;
  v_occ_eff          jsonb;
  v_going_count      bigint  := 0;
  v_interested_count bigint  := 0;
  v_cur_status       text    := NULL;
  v_now              timestamptz := now();
  v_empty_lineup     jsonb   := jsonb_build_object(
                                  'teachers',       '[]'::jsonb,
                                  'djs',            '[]'::jsonb,
                                  'dancers',        '[]'::jsonb,
                                  'vendors',        '[]'::jsonb,
                                  'videographers',  '[]'::jsonb
                                );
  v_organisers_json  jsonb   := '[]'::jsonb;
  v_teachers         jsonb   := '[]'::jsonb;
  v_djs              jsonb   := '[]'::jsonb;
  v_dancers          jsonb   := '[]'::jsonb;
  v_vendors          jsonb   := '[]'::jsonb;
  v_videographers    jsonb   := '[]'::jsonb;
  v_lineup           jsonb   := jsonb_build_object(
                                  'teachers',       '[]'::jsonb,
                                  'djs',            '[]'::jsonb,
                                  'dancers',        '[]'::jsonb,
                                  'vendors',        '[]'::jsonb,
                                  'videographers',  '[]'::jsonb
                                );
BEGIN
  SELECT id, name, description, poster_url, lifecycle_status, is_active,
         ticket_url, instagram_url, facebook_url, website, pricing,
         key_times, meta_data, type, city_id, city_slug
    INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found: %', p_event_id;
  END IF;

  IF v_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence
    FROM public.calendar_occurrences
    WHERE id = v_occurrence_id AND event_id = p_event_id;
    IF NOT FOUND THEN v_occurrence_id := NULL; END IF;
  END IF;

  IF v_occurrence_id IS NULL THEN
    SELECT * INTO v_occurrence
    FROM public.calendar_occurrences
    WHERE event_id = p_event_id
    ORDER BY instance_start NULLS LAST LIMIT 1;
    IF FOUND THEN v_occurrence_id := v_occurrence.id; END IF;
  END IF;

  v_city_eff_id := COALESCE(v_occurrence.city_id, v_event.city_id);
  IF v_city_eff_id IS NOT NULL THEN
    SELECT id, name, slug, timezone INTO v_city FROM public.cities WHERE id = v_city_eff_id;
  END IF;
  v_tz := COALESCE(v_city.timezone, 'UTC');

  IF v_occurrence.venue_id IS NOT NULL THEN
    SELECT id, name, address, postcode, google_maps_link, photo_url, gallery_urls,
           transport_json, description, capacity, floor_type, facilities_new
      INTO v_venue
    FROM public.venues
    WHERE id = v_occurrence.venue_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ent.id, 'display_name', ent.name, 'avatar_url', ent.avatar_url) ORDER BY ee.created_at ASC, ent.name ASC), '[]'::jsonb)
  INTO v_organisers_json
  FROM public.event_entities ee
  JOIN public.entities ent ON ent.id = ee.entity_id
  WHERE ee.event_id = p_event_id AND ee.role = 'organiser';

  IF v_occurrence_id IS NOT NULL THEN
    WITH base_links AS (
      SELECT epl.profile_id, epl.is_primary, epl.occurrence_id, epl.created_at
      FROM public.event_profile_links epl
      WHERE epl.event_id = p_event_id AND epl.status = 'active' AND epl.archived_at IS NULL
        AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id)
        AND epl.role = 'teacher'
    ), dedup AS (
      SELECT DISTINCT ON (profile_id) profile_id, is_primary FROM base_links
      ORDER BY profile_id, (occurrence_id IS NOT NULL) DESC, created_at ASC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', tp.id, 'display_name', COALESCE(NULLIF(TRIM(COALESCE(tp.first_name,'') || CASE WHEN tp.surname IS NOT NULL AND length(trim(tp.surname))>0 THEN ' '||trim(tp.surname) ELSE '' END),''), tp.id::text), 'avatar_url', tp.photo_url, 'is_primary', d.is_primary) ORDER BY tp.first_name, tp.surname), '[]'::jsonb)
    INTO v_teachers FROM dedup d JOIN public.teacher_profiles tp ON tp.id = d.profile_id;

    WITH base_links AS (
      SELECT epl.profile_id, epl.is_primary, epl.occurrence_id, epl.created_at
      FROM public.event_profile_links epl
      WHERE epl.event_id = p_event_id AND epl.status = 'active' AND epl.archived_at IS NULL
        AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id)
        AND epl.role = 'dj'
    ), dedup AS (
      SELECT DISTINCT ON (profile_id) profile_id, is_primary FROM base_links
      ORDER BY profile_id, (occurrence_id IS NOT NULL) DESC, created_at ASC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', dj.id, 'display_name', COALESCE(NULLIF(trim(COALESCE(dj.dj_name, dj.name, dj.real_name,'')), ''), dj.id::text), 'avatar_url', COALESCE(dj.photo_url[1], NULL), 'is_primary', d.is_primary) ORDER BY dj.dj_name, dj.name), '[]'::jsonb)
    INTO v_djs FROM dedup d JOIN public.dj_profiles dj ON dj.id = d.profile_id;

    WITH base_links AS (
      SELECT epl.profile_id, epl.profile_type, epl.is_primary, epl.occurrence_id, epl.created_at
      FROM public.event_profile_links epl
      WHERE epl.event_id = p_event_id AND epl.status = 'active' AND epl.archived_at IS NULL
        AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id)
        AND epl.role = 'dancer'
    ), dedup AS (
      SELECT DISTINCT ON (profile_id) profile_id, profile_type, is_primary FROM base_links
      ORDER BY profile_id, (occurrence_id IS NOT NULL) DESC, created_at ASC
    )
    SELECT COALESCE(jsonb_agg(obj.profile_obj ORDER BY obj.display_name), '[]'::jsonb)
    INTO v_dancers
    FROM (
      SELECT jsonb_build_object('id', dp.id, 'display_name', COALESCE(NULLIF(TRIM(COALESCE(dp.first_name,'') || CASE WHEN dp.surname IS NOT NULL AND length(trim(dp.surname))>0 THEN ' '||trim(dp.surname) ELSE '' END),''), dp.id::text), 'avatar_url', dp.avatar_url, 'is_primary', d.is_primary) AS profile_obj, COALESCE(NULLIF(TRIM(COALESCE(dp.first_name,'') || CASE WHEN dp.surname IS NOT NULL THEN ' '||trim(dp.surname) ELSE '' END),''), dp.id::text) AS display_name
      FROM dedup d JOIN public.dancer_profiles dp ON dp.id = d.profile_id WHERE d.profile_type = 'dancer'
      UNION ALL
      SELECT jsonb_build_object('id', gdp.id, 'display_name', COALESCE(NULLIF(TRIM(COALESCE(gdp.first_name,'') || CASE WHEN gdp.surname IS NOT NULL AND length(trim(gdp.surname))>0 THEN ' '||trim(gdp.surname) ELSE '' END),''), gdp.id::text), 'avatar_url', gdp.avatar_url, 'is_primary', d.is_primary) AS profile_obj, COALESCE(NULLIF(TRIM(COALESCE(gdp.first_name,'') || CASE WHEN gdp.surname IS NOT NULL THEN ' '||trim(gdp.surname) ELSE '' END),''), gdp.id::text) AS display_name
      FROM dedup d JOIN public.guest_dancer_profiles gdp ON gdp.id = d.profile_id WHERE d.profile_type = 'guest_dancer'
    ) obj;

    WITH base_links AS (
      SELECT epl.profile_id, epl.is_primary, epl.occurrence_id, epl.created_at
      FROM public.event_profile_links epl
      WHERE epl.event_id = p_event_id AND epl.status = 'active' AND epl.archived_at IS NULL
        AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id)
        AND epl.role = 'vendor'
    ), dedup AS (
      SELECT DISTINCT ON (profile_id) profile_id, is_primary FROM base_links
      ORDER BY profile_id, (occurrence_id IS NOT NULL) DESC, created_at ASC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', vnd.id, 'display_name', COALESCE(NULLIF(trim(COALESCE(vnd.business_name,'')), ''), vnd.id::text), 'avatar_url', COALESCE(vnd.photo_url[1], NULL), 'is_primary', d.is_primary) ORDER BY vnd.business_name), '[]'::jsonb)
    INTO v_vendors FROM dedup d JOIN public.vendors vnd ON vnd.id = d.profile_id;

    WITH base_links AS (
      SELECT epl.profile_id, epl.is_primary, epl.occurrence_id, epl.created_at
      FROM public.event_profile_links epl
      WHERE epl.event_id = p_event_id AND epl.status = 'active' AND epl.archived_at IS NULL
        AND (epl.occurrence_id IS NULL OR epl.occurrence_id = v_occurrence_id)
        AND epl.role = 'videographer'
    ), dedup AS (
      SELECT DISTINCT ON (profile_id) profile_id, is_primary FROM base_links
      ORDER BY profile_id, (occurrence_id IS NOT NULL) DESC, created_at ASC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', vid.id, 'display_name', COALESCE(NULLIF(trim(COALESCE(vid.business_name,'')), ''), vid.id::text), 'avatar_url', COALESCE(vid.photo_url[1], NULL), 'is_primary', d.is_primary) ORDER BY vid.business_name), '[]'::jsonb)
    INTO v_videographers FROM dedup d JOIN public.videographers vid ON vid.id = d.profile_id;

    v_lineup := jsonb_build_object('teachers', v_teachers, 'djs', v_djs, 'dancers', v_dancers, 'vendors', v_vendors, 'videographers', v_videographers);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('occurrence_id', co.id, 'starts_at', co.instance_start, 'ends_at', co.instance_end, 'local_date', to_char(co.instance_start AT TIME ZONE v_tz, 'YYYY-MM-DD'), 'timezone', v_tz, 'city_id', co.city_id, 'venue_id', co.venue_id, 'is_cancelled', (v_event.lifecycle_status = 'cancelled'), 'is_live', (co.instance_start <= v_now AND co.instance_end >= v_now), 'is_past', (co.instance_end < v_now), 'is_upcoming', (co.instance_start > v_now), 'lineup', v_empty_lineup) ORDER BY co.instance_start NULLS LAST), '[]'::jsonb)
  INTO v_occurrences FROM public.calendar_occurrences co WHERE co.event_id = p_event_id;

  IF v_occurrence_id IS NOT NULL THEN
    v_occ_eff := jsonb_build_object('occurrence_id', v_occurrence.id, 'starts_at', v_occurrence.instance_start, 'ends_at', v_occurrence.instance_end, 'local_date', to_char(v_occurrence.instance_start AT TIME ZONE v_tz, 'YYYY-MM-DD'), 'timezone', v_tz, 'city_id', v_occurrence.city_id, 'venue_id', v_occurrence.venue_id, 'is_cancelled', (v_event.lifecycle_status = 'cancelled'), 'is_live', (v_occurrence.instance_start <= v_now AND v_occurrence.instance_end >= v_now), 'is_past', (v_occurrence.instance_end < v_now), 'is_upcoming', (v_occurrence.instance_start > v_now), 'lineup', v_lineup);
  ELSE
    v_occ_eff := NULL;
  END IF;

  IF v_occurrence_id IS NOT NULL THEN
    SELECT COUNT(*) FILTER (WHERE status = 'going'), COUNT(*) FILTER (WHERE status = 'interested')
    INTO v_going_count, v_interested_count
    FROM public.event_attendance WHERE occurrence_id = v_occurrence_id;
  END IF;

  IF auth.uid() IS NOT NULL AND v_occurrence_id IS NOT NULL THEN
    SELECT status INTO v_cur_status FROM public.event_attendance
    WHERE occurrence_id = v_occurrence_id AND user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'event_id',      v_event.id,
    'occurrence_id', v_occurrence_id,
    'event', jsonb_build_object(
      'name',             v_event.name,
      'description',      v_event.description,
      'status',           v_event.lifecycle_status,
      'is_published',     (v_event.lifecycle_status = 'published'),
      'created_by',       NULL,
      'cover_image_url',  v_event.poster_url,
      'photo_urls',       COALESCE(v_event.meta_data->'gallery', '[]'::jsonb),
      'photo_url',        COALESCE(v_event.meta_data->'photo_url', '[]'::jsonb),
      'music_styles',     COALESCE(v_event.meta_data->'music_styles', '[]'::jsonb),
      'key_times',        COALESCE(v_event.meta_data->'key_times', '{}'::jsonb),
      'meta_data_public', (
        SELECT COALESCE(jsonb_object_agg(k, v_event.meta_data->k), '{}'::jsonb)
        FROM (VALUES
          ('aftermovie_url'),('age_restriction'),('dress_code'),('features'),
          ('food_drinks_available'),('food_drinks_description'),('guestlist'),
          ('has_raffle'),('raffle'),('tickets'),('promo_codes'),
          ('tiktok_url'),('whatsapp_link'),('livestream_url')
        ) AS t(k)
        WHERE v_event.meta_data ? k
      ),
      'actions', jsonb_build_object(
        'ticket_url',    v_event.ticket_url,
        'website_url',   v_event.website,
        'facebook_url',  v_event.facebook_url,
        'instagram_url', v_event.instagram_url,
        'pricing',       v_event.pricing
      )
    ),
    'location_default', jsonb_build_object(
      'city', CASE WHEN v_city.id IS NOT NULL THEN
        jsonb_build_object('id', v_city.id, 'name', v_city.name, 'slug', v_city.slug)
      ELSE NULL END,
      'venue', CASE WHEN v_venue.id IS NOT NULL THEN jsonb_build_object(
        'id',               v_venue.id,
        'name',             v_venue.name,
        'address_line',     v_venue.address,
        'postcode',         v_venue.postcode,
        'google_maps_link', v_venue.google_maps_link,
        'image_url',        v_venue.photo_url[1],
        'gallery_urls',     COALESCE(to_jsonb(v_venue.gallery_urls), '[]'::jsonb),
        'transport_json',   v_venue.transport_json,
        'description',      v_venue.description,
        'capacity',         v_venue.capacity,
        'floor_type',       v_venue.floor_type,
        'facilities_new',   COALESCE(to_jsonb(v_venue.facilities_new), '[]'::jsonb),
        'timezone',         v_tz
      ) ELSE NULL END,
      'timezone', v_tz
    ),
    'organisers',           v_organisers_json,
    'occurrences',          v_occurrences,
    'occurrence_effective', v_occ_eff,
    'attendance', jsonb_build_object(
      'going_count',         COALESCE(v_going_count, 0),
      'interested_count',    COALESCE(v_interested_count, 0),
      'current_user_status', v_cur_status,
      'preview',             '[]'::jsonb
    )
  );
END;
$function$;
