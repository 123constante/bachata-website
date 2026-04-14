-- Additive Event Page read model RPC.
--
-- Contract notes:
-- - Does not replace public.get_event_detail(uuid)
-- - Keeps occurrence RSVP identity scoped to the real calendar_occurrences.id
-- - Keeps attendance writes unchanged
-- - Keeps recurrence generation unchanged by reading from public.calendar_occurrences only
-- - First version intentionally defers slug-heavy and metadata-heavy extras

CREATE OR REPLACE FUNCTION public.get_event_page_detail(p_event_id uuid)
RETURNS TABLE(
  event jsonb,
  venue jsonb,
  schedule jsonb,
  description jsonb,
  teachers jsonb,
  djs jsonb,
  organiser jsonb,
  occurrence jsonb,
  attendance jsonb,
  balance jsonb,
  attendee_preview jsonb
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_event_record public.events%ROWTYPE;
  v_venue_record public.venues%ROWTYPE;
  v_occurrence_record public.calendar_occurrences%ROWTYPE;
  v_key_times jsonb := '{}'::jsonb;
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_base_date date;

  v_event_json jsonb := '{}'::jsonb;
  v_venue_json jsonb := '{}'::jsonb;
  v_schedule_json jsonb := '{}'::jsonb;
  v_description_json jsonb := '{}'::jsonb;
  v_teachers_json jsonb := '[]'::jsonb;
  v_djs_json jsonb := '[]'::jsonb;
  v_organiser_json jsonb := jsonb_build_object('primary', NULL, 'team', '[]'::jsonb);
  v_occurrence_json jsonb := '{}'::jsonb;
  v_attendance_json jsonb := '{}'::jsonb;
  v_balance_json jsonb := '{}'::jsonb;
  v_attendee_preview_json jsonb := '[]'::jsonb;

  v_status text := 'published';
  v_hero_image_url text;
  v_display_date text;
  v_display_day_label text;

  v_event_start_at timestamptz;
  v_event_end_at timestamptz;
  v_class_start_at timestamptz;
  v_class_end_at timestamptz;
  v_party_start_at timestamptz;
  v_party_end_at timestamptz;

  v_class_active boolean := false;
  v_party_active boolean := false;
  v_class_start_text text;
  v_class_end_text text;
  v_party_start_text text;
  v_party_end_text text;

  v_going_count integer := 0;
  v_interested_count integer := 0;
  v_user_status text := 'none';
  v_user_can_rsvp boolean := false;
  v_last_updated_at timestamptz;

  v_leaders integer := 0;
  v_followers integer := 0;
  v_switch integer := 0;
  v_unknown integer := 0;
  v_ratio numeric;
  v_balance_status text := 'insufficient_data';
BEGIN
  SELECT *
  INTO v_event_record
  FROM public.events
  WHERE id = p_event_id;

  IF v_event_record.id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_venue_record
  FROM public.venues
  WHERE id = v_event_record.venue_id;

  -- Deterministic occurrence selection for the Event Page:
  -- 1) first non-cancelled upcoming occurrence
  -- 2) fallback to the earliest non-cancelled occurrence
  SELECT co.*
  INTO v_occurrence_record
  FROM public.calendar_occurrences co
  WHERE co.event_id = p_event_id
    AND COALESCE(co.lifecycle_status, 'active') <> 'cancelled'
    AND co.instance_start >= now()
  ORDER BY co.instance_start ASC, co.id ASC
  LIMIT 1;

  IF v_occurrence_record IS NULL THEN
    SELECT co.*
    INTO v_occurrence_record
    FROM public.calendar_occurrences co
    WHERE co.event_id = p_event_id
      AND COALESCE(co.lifecycle_status, 'active') <> 'cancelled'
    ORDER BY co.instance_start ASC, co.id ASC
    LIMIT 1;
  END IF;

  v_timezone := COALESCE(v_event_record.timezone, v_venue_record.timezone, 'UTC');
  v_key_times := COALESCE(v_event_record.key_times, v_event_record.meta_data -> 'key_times', '{}'::jsonb);

  v_class_start_text := NULLIF(v_key_times -> 'classes' ->> 'start', '');
  v_class_end_text := NULLIF(v_key_times -> 'classes' ->> 'end', '');
  v_party_start_text := NULLIF(v_key_times -> 'party' ->> 'start', '');
  v_party_end_text := NULLIF(v_key_times -> 'party' ->> 'end', '');

  v_class_active := COALESCE((v_key_times -> 'classes' ->> 'active')::boolean, v_class_start_text IS NOT NULL OR v_class_end_text IS NOT NULL, false);
  v_party_active := COALESCE((v_key_times -> 'party' ->> 'active')::boolean, v_party_start_text IS NOT NULL OR v_party_end_text IS NOT NULL, false);

  v_base_date := COALESCE(
    CASE
      WHEN v_occurrence_record.instance_start IS NOT NULL THEN timezone(v_timezone, v_occurrence_record.instance_start)::date
      ELSE NULL
    END,
    v_event_record.date::date
  );

  IF v_occurrence_record.instance_start IS NOT NULL THEN
    v_event_start_at := v_occurrence_record.instance_start;
  ELSIF v_base_date IS NOT NULL AND v_event_record.start_time IS NOT NULL THEN
    v_event_start_at := ((v_base_date::text || ' ' || v_event_record.start_time::text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  IF v_occurrence_record.instance_end IS NOT NULL THEN
    v_event_end_at := v_occurrence_record.instance_end;
  ELSIF v_base_date IS NOT NULL AND v_event_record.end_time IS NOT NULL THEN
    v_event_end_at := ((v_base_date::text || ' ' || v_event_record.end_time::text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  IF v_base_date IS NOT NULL AND v_class_start_text IS NOT NULL THEN
    v_class_start_at := ((v_base_date::text || ' ' || v_class_start_text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  IF v_base_date IS NOT NULL AND v_class_end_text IS NOT NULL THEN
    v_class_end_at := ((v_base_date::text || ' ' || v_class_end_text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  IF v_base_date IS NOT NULL AND v_party_start_text IS NOT NULL THEN
    v_party_start_at := ((v_base_date::text || ' ' || v_party_start_text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  IF v_base_date IS NOT NULL AND v_party_end_text IS NOT NULL THEN
    v_party_end_at := ((v_base_date::text || ' ' || v_party_end_text)::timestamp AT TIME ZONE v_timezone);
  END IF;

  v_display_date := CASE WHEN v_base_date IS NOT NULL THEN v_base_date::text ELSE NULL END;
  v_display_day_label := CASE WHEN v_base_date IS NOT NULL THEN trim(to_char(v_base_date, 'FMDay')) ELSE NULL END;

  v_status := CASE
    WHEN COALESCE(v_event_record.lifecycle_status, '') = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(v_event_record.is_published, false) = false THEN 'draft'
    ELSE 'published'
  END;

  v_hero_image_url := NULLIF(v_event_record.poster_url, '');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'display_name', COALESCE(
          NULLIF(
            trim(
              CASE
                WHEN COALESCE(t.hide_surname, false) THEN COALESCE(t.first_name, '')
                ELSE concat_ws(' ', t.first_name, t.surname)
              END
            ),
            ''
          ),
          'Teacher'
        ),
        'avatar_url', CASE
          WHEN t.photo_url IS NULL THEN NULL
          WHEN jsonb_typeof(to_jsonb(t.photo_url)) = 'array' THEN to_jsonb(t.photo_url) ->> 0
          ELSE t.photo_url::text
        END,
        'city', t.city,
        'country', t.country,
        'instagram_url', t.instagram,
        'website_url', t.website,
        'verified', t.verified
      )
      ORDER BY COALESCE(t.first_name, ''), COALESCE(t.surname, ''), t.id
    ),
    '[]'::jsonb
  )
  INTO v_teachers_json
  FROM public.teacher_profiles t
  WHERE t.id = ANY(COALESCE(v_event_record.teacher_ids, ARRAY[]::uuid[]));

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'display_name', COALESCE(
          NULLIF(trim(d.dj_name), ''),
          NULLIF(trim(d.name), ''),
          NULLIF(trim(concat_ws(' ', d.first_name, d.surname)), ''),
          CASE
            WHEN COALESCE(d.hide_real_name, false) = false THEN NULLIF(trim(d.real_name), '')
            ELSE NULL
          END,
          'DJ'
        ),
        'avatar_url', CASE
          WHEN d.photo_url IS NULL THEN NULL
          WHEN jsonb_typeof(to_jsonb(d.photo_url)) = 'array' THEN to_jsonb(d.photo_url) ->> 0
          ELSE d.photo_url::text
        END,
        'city', d.city,
        'country', d.country,
        'instagram_url', d.instagram,
        'website_url', d.website,
        'soundcloud_url', d.soundcloud,
        'mixcloud_url', d.mixcloud,
        'verified', d.verified
      )
      ORDER BY COALESCE(NULLIF(trim(d.dj_name), ''), NULLIF(trim(d.name), ''), d.id::text)
    ),
    '[]'::jsonb
  )
  INTO v_djs_json
  FROM public.dj_profiles d
  WHERE d.id = ANY(COALESCE(v_event_record.dj_ids, ARRAY[]::uuid[]));

  WITH organiser_rows AS (
    SELECT
      en.id,
      en.name,
      en.avatar_url,
      en.city_id,
      en.website,
      en.socials,
      row_number() OVER (ORDER BY en.name ASC, en.id ASC) AS organiser_rank
    FROM public.event_entities ee
    JOIN public.entities en
      ON en.id = ee.entity_id
    WHERE ee.event_id = p_event_id
      AND ee.role = 'organiser'
      AND en.type = 'organiser'
  )
  SELECT jsonb_build_object(
    'primary', (
      SELECT jsonb_build_object(
        'id', o.id,
        'display_name', o.name,
        'avatar_url', o.avatar_url,
        'city_id', o.city_id,
        'instagram_url', COALESCE(o.socials ->> 'instagram', NULL),
        'website_url', COALESCE(NULLIF(o.website, ''), o.socials ->> 'website')
      )
      FROM organiser_rows o
      WHERE o.organiser_rank = 1
    ),
    'team', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'display_name', o.name,
            'avatar_url', o.avatar_url,
            'city_id', o.city_id,
            'instagram_url', COALESCE(o.socials ->> 'instagram', NULL),
            'website_url', COALESCE(NULLIF(o.website, ''), o.socials ->> 'website')
          )
          ORDER BY o.organiser_rank
        )
        FROM organiser_rows o
      ),
      '[]'::jsonb
    )
  )
  INTO v_organiser_json;

  IF v_occurrence_record.id IS NOT NULL THEN
    SELECT count(*)::int
    INTO v_going_count
    FROM public.event_attendance ea
    WHERE ea.occurrence_id = v_occurrence_record.id;

    IF v_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.event_attendance ea
        WHERE ea.occurrence_id = v_occurrence_record.id
          AND ea.user_id = v_user_id
      )
      INTO v_user_can_rsvp;

      IF v_user_can_rsvp THEN
        v_user_status := 'going';

        SELECT max(ea.created_at)
        INTO v_last_updated_at
        FROM public.event_attendance ea
        WHERE ea.occurrence_id = v_occurrence_record.id
          AND ea.user_id = v_user_id;
      END IF;
    END IF;
  END IF;

  SELECT count(*)::int
  INTO v_interested_count
  FROM public.event_participants ep
  WHERE ep.event_id = p_event_id
    AND ep.status = 'interested';

  IF v_user_id IS NOT NULL AND v_user_status <> 'going' THEN
    IF EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = p_event_id
        AND ep.user_id = v_user_id
        AND ep.status = 'interested'
    ) THEN
      v_user_status := 'interested';

      SELECT ep.updated_at
      INTO v_last_updated_at
      FROM public.event_participants ep
      WHERE ep.event_id = p_event_id
        AND ep.user_id = v_user_id
        AND ep.status = 'interested'
      ORDER BY ep.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  v_user_can_rsvp := (
    v_occurrence_record.id IS NOT NULL
    AND COALESCE(v_event_record.is_published, false) = true
    AND COALESCE(v_event_record.lifecycle_status, '') <> 'cancelled'
    AND COALESCE(v_occurrence_record.lifecycle_status, 'active') <> 'cancelled'
  );

  IF v_occurrence_record.id IS NOT NULL THEN
    WITH role_counts AS (
      SELECT
        count(*) FILTER (WHERE lower(COALESCE(d.partner_role, '')) = 'leader') AS leaders,
        count(*) FILTER (WHERE lower(COALESCE(d.partner_role, '')) = 'follower') AS followers,
        count(*) FILTER (WHERE lower(COALESCE(d.partner_role, '')) IN ('both', 'switch', 'lead & follow', 'lead and follow')) AS switch_count,
        count(*) FILTER (
          WHERE d.partner_role IS NULL
             OR lower(COALESCE(d.partner_role, '')) NOT IN ('leader', 'follower', 'both', 'switch', 'lead & follow', 'lead and follow')
        ) AS unknown_count
      FROM public.event_attendance ea
      LEFT JOIN public.dancers d
        ON d.user_id = ea.user_id
      WHERE ea.occurrence_id = v_occurrence_record.id
    )
    SELECT leaders, followers, switch_count, unknown_count
    INTO v_leaders, v_followers, v_switch, v_unknown
    FROM role_counts;
  END IF;

  v_ratio := CASE
    WHEN v_followers > 0 THEN round((v_leaders::numeric / v_followers::numeric), 4)
    ELSE NULL
  END;

  v_balance_status := CASE
    WHEN (v_leaders + v_followers + v_switch) = 0 THEN 'insufficient_data'
    WHEN v_leaders = v_followers THEN 'balanced'
    WHEN v_leaders > v_followers THEN 'leader_heavy'
    WHEN v_followers > v_leaders THEN 'follower_heavy'
    ELSE 'insufficient_data'
  END;

  IF v_occurrence_record.id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(preview_row.preview ORDER BY preview_row.created_at DESC, preview_row.user_id ASC),
      '[]'::jsonb
    )
    INTO v_attendee_preview_json
    FROM (
      SELECT
        ea.user_id,
        ea.created_at,
        jsonb_build_object(
          'user_id', ea.user_id,
          'dancer_id', d.id,
          'display_name', COALESCE(
            NULLIF(
              trim(
                CASE
                  WHEN COALESCE(d.hide_surname, false) THEN COALESCE(d.first_name, '')
                  ELSE concat_ws(' ', d.first_name, d.surname)
                END
              ),
              ''
            ),
            'Dancer'
          ),
          'avatar_url', d.photo_url,
          'role', CASE
            WHEN lower(COALESCE(d.partner_role, '')) = 'leader' THEN 'leader'
            WHEN lower(COALESCE(d.partner_role, '')) = 'follower' THEN 'follower'
            WHEN lower(COALESCE(d.partner_role, '')) IN ('both', 'switch', 'lead & follow', 'lead and follow') THEN 'both'
            ELSE 'unknown'
          END,
          'status', 'going',
          'blur_for_anonymous', true
        ) AS preview
      FROM public.event_attendance ea
      LEFT JOIN public.dancers d
        ON d.user_id = ea.user_id
      WHERE ea.occurrence_id = v_occurrence_record.id
      ORDER BY ea.created_at DESC, ea.user_id ASC
      LIMIT 12
    ) AS preview_row;
  END IF;

  v_event_json := jsonb_build_object(
    'id', v_event_record.id,
    'name', v_event_record.name,
    'type', v_event_record.type,
    'status', v_status,
    'date', v_event_record.date,
    'timezone', COALESCE(v_event_record.timezone, v_timezone),
    'location', v_event_record.location,
    'city_slug', v_event_record.city_slug,
    'venue_id', v_event_record.venue_id,
    'created_by', v_event_record.created_by,
    'hero_image_url', v_hero_image_url,
    'cover_image_url', v_event_record.poster_url,
    'photo_urls', CASE
      WHEN NULLIF(v_event_record.poster_url, '') IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(v_event_record.poster_url)
    END,
    'ticket_url', v_event_record.ticket_url,
    'website_url', v_event_record.website,
    'instagram_url', v_event_record.instagram_url,
    'facebook_url', v_event_record.facebook_url,
    'is_published', COALESCE(v_event_record.is_published, false)
  );

  v_venue_json := jsonb_build_object(
    'id', v_venue_record.id,
    'name', v_venue_record.name,
    'address_line', v_venue_record.address,
    'city', v_venue_record.city,
    'country', v_venue_record.country,
    'google_maps_url', v_venue_record.google_maps_url,
    'transport', v_venue_record.transport,
    'parking', v_venue_record.parking,
    'rules', COALESCE(to_jsonb(v_venue_record.rules), '[]'::jsonb),
    'floor_type', CASE
      WHEN v_venue_record.floor_type IS NULL THEN NULL
      WHEN jsonb_typeof(v_venue_record.floor_type) = 'string' THEN v_venue_record.floor_type #>> '{}'
      ELSE v_venue_record.floor_type::text
    END,
    'facilities', CASE
      WHEN v_venue_record.facilities IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(v_venue_record.facilities) = 'array' THEN v_venue_record.facilities
      ELSE '[]'::jsonb
    END,
    'image_url', CASE
      WHEN v_venue_record.photo_url IS NULL THEN NULL
      WHEN jsonb_typeof(to_jsonb(v_venue_record.photo_url)) = 'array' THEN to_jsonb(v_venue_record.photo_url) ->> 0
      ELSE v_venue_record.photo_url::text
    END
  );

  v_schedule_json := jsonb_build_object(
    'timezone', COALESCE(v_event_record.timezone, v_timezone),
    'display_date', v_display_date,
    'display_day_label', v_display_day_label,
    'start_at', v_event_start_at,
    'end_at', v_event_end_at,
    'class', jsonb_build_object(
      'active', v_class_active,
      'start_at', v_class_start_at,
      'end_at', v_class_end_at
    ),
    'party', jsonb_build_object(
      'active', v_party_active,
      'start_at', v_party_start_at,
      'end_at', v_party_end_at
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(item.obj ORDER BY item.sort_key)
        FROM (
          SELECT 1 AS sort_key, jsonb_build_object(
            'id', 'class',
            'kind', 'class',
            'label', 'Classes',
            'start_at', v_class_start_at,
            'end_at', v_class_end_at
          ) AS obj
          WHERE v_class_active
          UNION ALL
          SELECT 2 AS sort_key, jsonb_build_object(
            'id', 'party',
            'kind', 'party',
            'label', 'Party',
            'start_at', v_party_start_at,
            'end_at', v_party_end_at
          ) AS obj
          WHERE v_party_active
        ) AS item
      ),
      '[]'::jsonb
    )
  );

  v_description_json := jsonb_build_object(
    'full_text', v_event_record.description,
    'highlights', CASE
      WHEN jsonb_typeof(v_event_record.meta_data -> 'highlights') = 'array' THEN v_event_record.meta_data -> 'highlights'
      ELSE '[]'::jsonb
    END,
    'for_who', CASE
      WHEN jsonb_typeof(v_event_record.meta_data) = 'object' THEN v_event_record.meta_data ->> 'for_who'
      ELSE NULL
    END,
    'notes', CASE
      WHEN jsonb_typeof(v_event_record.meta_data) = 'object' THEN v_event_record.meta_data ->> 'notes'
      ELSE NULL
    END
  );

  v_occurrence_json := jsonb_build_object(
    'occurrence_id', v_occurrence_record.id,
    'event_id', v_event_record.id,
    'starts_at', v_occurrence_record.instance_start,
    'ends_at', v_occurrence_record.instance_end,
    'local_date', CASE
      WHEN v_occurrence_record.instance_start IS NOT NULL THEN timezone(v_timezone, v_occurrence_record.instance_start)::date::text
      ELSE v_event_record.date::date::text
    END,
    'timezone', COALESCE(v_event_record.timezone, v_timezone),
    'is_cancelled', COALESCE(v_occurrence_record.lifecycle_status = 'cancelled', false),
    'is_upcoming', CASE
      WHEN v_occurrence_record.instance_start IS NULL THEN false
      ELSE v_occurrence_record.instance_start > now()
    END,
    'is_live', CASE
      WHEN v_occurrence_record.instance_start IS NULL THEN false
      WHEN v_occurrence_record.instance_end IS NOT NULL THEN now() >= v_occurrence_record.instance_start AND now() < v_occurrence_record.instance_end
      ELSE now() >= v_occurrence_record.instance_start
    END,
    'is_past', CASE
      WHEN v_occurrence_record.instance_start IS NULL THEN false
      WHEN v_occurrence_record.instance_end IS NOT NULL THEN now() >= v_occurrence_record.instance_end
      ELSE now() >= v_occurrence_record.instance_start
    END
  );

  v_attendance_json := jsonb_build_object(
    'occurrence_id', v_occurrence_record.id,
    'going_count', v_going_count,
    'interested_count', v_interested_count,
    'user_status', v_user_status,
    'user_can_rsvp', v_user_can_rsvp,
    'rsvp_scope', 'occurrence',
    'last_updated_at', v_last_updated_at
  );

  v_balance_json := jsonb_build_object(
    'scope', 'going',
    'leaders', v_leaders,
    'followers', v_followers,
    'switch', v_switch,
    'unknown', v_unknown,
    'ratio_leaders_to_followers', v_ratio,
    'status', v_balance_status
  );

  RETURN QUERY
  SELECT
    v_event_json,
    v_venue_json,
    v_schedule_json,
    v_description_json,
    v_teachers_json,
    v_djs_json,
    v_organiser_json,
    v_occurrence_json,
    v_attendance_json,
    v_balance_json,
    v_attendee_preview_json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_page_detail(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_page_detail(uuid) TO authenticated;
