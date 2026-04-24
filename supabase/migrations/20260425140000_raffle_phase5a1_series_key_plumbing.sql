-- ============================================================================
-- Raffle Phase 5A.1 — plumbing series_key through the save, hydration, and
-- raffle events list RPCs.
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 14:00:00 so it orders
-- after the Phase 5A column-add migration (20260425130000).
--
-- Prerequisite: migration 20260425130000 has added events.series_key.
--
-- Changes:
--   1. admin_save_event_v2_impl — accept and persist series_key.
--      Pattern mirrors the 'level' field (partial-patch friendly via COALESCE
--      in UPDATE) but uses an explicit `key ? 'series_key'` guard in UPDATE so
--      that passing {"series_key": null} explicitly CLEARS the field (rare but
--      important for "this event is no longer part of a series" edits).
--
--   2. admin_get_event_snapshot_v2 — include 'series_key' in the event object
--      returned to the admin editor. Read-side mirror of change 1.
--
--   3. admin_list_raffle_events_v1 — include series_key in each row so the
--      /raffles picker can group events by series when we build that UI.
--
-- All three are pg_get_functiondef-dumped bodies with the minimal addition
-- required. No other behaviour changed. Apply manually in the Supabase SQL
-- editor; never `supabase db push`.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_save_event_v2_impl — accept + persist series_key
-- ─────────────────────────────────────────────────────────────────────────────
-- Read live body: pg_get_functiondef on 2026-04-24 before editing.
-- Changes: declare v_series_key_input + v_has_series_key, include in INSERT,
-- include in UPDATE with a ? guard that respects explicit null clears.
-- Everything else preserved byte-identically.

CREATE OR REPLACE FUNCTION public.admin_save_event_v2_impl(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_now                          timestamptz  := now();
  v_actor                        uuid         := auth.uid();
  v_event                        jsonb        := p_payload->'event';
  v_event_id                     uuid         := NULLIF(COALESCE(v_event->>'id',''), '')::uuid;
  v_is_update                    boolean      := false;
  v_occ                          jsonb        := p_payload->'occurrences';
  v_has_schedule                 boolean      := false;
  v_type                         text         := NULL;
  v_schedule_type                text         := NULL;
  v_start                        timestamptz  := NULL;
  v_end                          timestamptz  := NULL;
  v_organisers                   jsonb        := NULL;
  v_organiser_input_present      boolean      := false;
  v_organiser_valid_count        int          := 0;
  v_country                      text         := NULLIF(v_event->>'country','');
  v_location                     text         := NULLIF(v_event->>'location','');
  v_city                         text         := NULLIF(v_event->>'city','');
  v_timezone                     text         := NULLIF(v_event->>'timezone','');
  v_is_active_input              boolean      := CASE WHEN (v_event ? 'is_active') THEN (v_event->>'is_active')::boolean ELSE NULL END;
  v_instagram_url                text         := NULLIF(v_event->>'instagram_url','');
  v_facebook_url                 text         := NULLIF(v_event->>'facebook_url','');

  v_has_guestlist_input          boolean      := CASE WHEN (v_event ? 'has_guestlist') THEN (v_event->>'has_guestlist')::boolean ELSE NULL END;
  v_has_raffle_input             boolean      := CASE WHEN (v_event ? 'has_raffle') THEN (v_event->>'has_raffle')::boolean ELSE NULL END;

  v_level_input                  text         := NULLIF(v_event->>'level','');

  -- Phase 5A.1 — series_key input.
  -- v_has_series_key discriminates "payload omitted this field" (preserve
  -- existing) vs "payload provided null-or-empty" (clear the column).
  v_has_series_key               boolean      := (v_event ? 'series_key');
  v_series_key_input             text         := NULLIF(btrim(COALESCE(v_event->>'series_key','')), '');

  v_existing_country             text         := NULL;
  v_existing_city_id             uuid         := NULL;
  v_existing_is_active           boolean      := false;
  v_existing_venue_id            uuid         := NULL;
  v_effective_is_active          boolean      := false;
  v_effective_country            text         := NULL;
  v_effective_city_id            uuid         := NULL;
  v_effective_venue_id           uuid         := NULL;

  v_has_parent_event_id          boolean      := false;
  v_has_source_occurrence_id     boolean      := false;
  v_parent_event_id_input        uuid         := NULL;
  v_source_occurrence_id_input   uuid         := NULL;
  v_existing_parent_event_id     uuid         := NULL;
  v_existing_source_occurrence_id uuid        := NULL;
  v_effective_parent_event_id    uuid         := NULL;
  v_effective_source_occurrence_id uuid       := NULL;

  v_payload_lifecycle            text         := NULLIF(v_event->>'lifecycle_status','');

  v_error_code                   text;
  v_error_message                text;
  v_started_child                timestamptz;
  v_duration_ms                  integer;
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

  IF (v_event ? 'end_time') THEN
    v_end := NULLIF(v_event->>'end_time','')::timestamptz;
  END IF;

  IF (v_event ? 'start_time') THEN
    v_start := NULLIF(v_event->>'start_time','')::timestamptz;
  ELSIF (p_payload ? 'occurrences') AND jsonb_typeof(v_occ) = 'array' AND jsonb_array_length(v_occ) > 0 THEN
    SELECT min((elem->>'instance_start')::timestamptz)
    INTO v_start
    FROM jsonb_array_elements(v_occ) AS elem
    WHERE (elem ? 'instance_start');
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

  IF v_event_id IS NULL THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','AUTH_REQUIRED','message','authenticated user required','path','/auth')));
    END IF;

    IF v_payload_lifecycle IS NOT NULL AND v_payload_lifecycle <> 'draft' THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object(
          'code','LIFECYCLE_TRANSITION_REQUIRED',
          'message','new events must be created as draft; use admin_event_publish or admin_archive_event_v1 for other states',
          'path','/event/lifecycle_status',
          'details', jsonb_build_object('provided', v_payload_lifecycle)
        )));
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

    -- Phase 5A.1: added series_key to INSERT column list + VALUES.
    INSERT INTO public.events (
      name, venue_id, city_id, country, location, city, timezone, lifecycle_status, website, ticket_url,
      instagram_url, facebook_url,
      description, meta_data, poster_url,
      type, schedule_type, start_time, end_time, created_by, created_at, updated_at, is_active,
      parent_event_id, source_occurrence_id,
      has_guestlist,
      has_raffle,
      level,
      series_key
    ) VALUES (
      NULLIF(v_event->>'name',''),
      NULLIF(v_event->>'venue_id','')::uuid,
      v_effective_city_id,
      v_effective_country,
      v_location,
      v_city,
      v_timezone,
      'draft',
      NULLIF(v_event->>'website',''),
      NULLIF(v_event->>'ticket_url',''),
      v_instagram_url,
      v_facebook_url,
      v_event->>'description',
      COALESCE(v_event->'meta_data', '{}'::jsonb),
      NULLIF(v_event->>'poster_url',''),
      COALESCE(v_type, 'standard'),
      v_schedule_type,
      v_start,
      v_end,
      v_actor,
      v_now,
      v_now,
      v_effective_is_active,
      v_effective_parent_event_id,
      v_effective_source_occurrence_id,
      COALESCE(v_has_guestlist_input, false),
      COALESCE(v_has_raffle_input, false),
      v_level_input,
      CASE WHEN v_has_series_key THEN v_series_key_input ELSE NULL END
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

    -- Phase 5A.1: series_key partial-patch. When payload omits the key,
    -- preserve existing. When payload sets it (even to empty / null),
    -- treat as an explicit clear or change.
    UPDATE public.events e SET
      name = COALESCE(v_event->>'name', e.name),
      venue_id = v_effective_venue_id,
      city_id = v_effective_city_id,
      country = COALESCE(v_country, e.country),
      location = COALESCE(v_location, e.location),
      city = COALESCE(v_city, e.city),
      timezone = COALESCE(v_timezone, e.timezone),
      website = COALESCE(NULLIF(v_event->>'website',''), e.website),
      ticket_url = COALESCE(NULLIF(v_event->>'ticket_url',''), e.ticket_url),
      instagram_url = COALESCE(v_instagram_url, e.instagram_url),
      facebook_url = COALESCE(v_facebook_url, e.facebook_url),
      description = COALESCE(v_event->>'description', e.description),
      meta_data = COALESCE(v_event->'meta_data', e.meta_data),
      poster_url = COALESCE(NULLIF(v_event->>'poster_url',''), e.poster_url),
      type = COALESCE(v_type, e.type),
      schedule_type = COALESCE(v_schedule_type, e.schedule_type),
      start_time = COALESCE(v_start, e.start_time),
      end_time = COALESCE(v_end, e.end_time),
      is_active = v_effective_is_active,
      parent_event_id = v_effective_parent_event_id,
      source_occurrence_id = v_effective_source_occurrence_id,
      has_guestlist = COALESCE(v_has_guestlist_input, e.has_guestlist),
      has_raffle = COALESCE(v_has_raffle_input, e.has_raffle),
      level = COALESCE(v_level_input, e.level),
      series_key = CASE WHEN v_has_series_key THEN v_series_key_input ELSE e.series_key END,
      updated_at = v_now
    WHERE e.id = v_event_id;
  END IF;

  IF v_organisers IS NOT NULL THEN
    v_started_child := clock_timestamp();
    BEGIN
      PERFORM public.replace_or_patch_organisers(v_event_id, v_organisers, true);
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
          v_error_code    = RETURNED_SQLSTATE,
          v_error_message = MESSAGE_TEXT;
        v_duration_ms := (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_child)) * 1000)::integer;

        INSERT INTO public.occurrence_write_audit (
          function_name, event_id, actor_uid, jwt_role,
          replace_mode, occurrence_count, ids_matched_count,
          success, error_code, error_message, duration_ms
        ) VALUES (
          'replace_or_patch_organisers',
          v_event_id,
          auth.uid(),
          current_setting('request.jwt.claim.role', true),
          true,
          CASE WHEN v_organisers IS NOT NULL AND jsonb_typeof(v_organisers) = 'array'
               THEN jsonb_array_length(v_organisers)
               ELSE NULL END,
          NULL,
          false,
          v_error_code,
          v_error_message,
          v_duration_ms
        );

        RAISE;
    END;
  END IF;

  v_has_schedule := (p_payload ? 'occurrences') OR (v_event ? 'start_time') OR (v_event ? 'end_time');
  IF v_has_schedule THEN
    IF (p_payload ? 'occurrences') AND jsonb_typeof(v_occ) <> 'array' THEN
      RETURN jsonb_build_object('success', false, 'status', 'error',
        'errors', jsonb_build_array(jsonb_build_object('code','OCC_INVALID_TYPE','message','occurrences must be an array when provided','path','/occurrences')));
    END IF;

    v_started_child := clock_timestamp();
    BEGIN
      PERFORM public.replace_or_patch_occurrences(v_event_id, COALESCE(v_occ, '[]'::jsonb), true);
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
          v_error_code    = RETURNED_SQLSTATE,
          v_error_message = MESSAGE_TEXT;
        v_duration_ms := (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_child)) * 1000)::integer;

        INSERT INTO public.occurrence_write_audit (
          function_name, event_id, actor_uid, jwt_role,
          replace_mode, occurrence_count, ids_matched_count,
          success, error_code, error_message, duration_ms
        ) VALUES (
          'replace_or_patch_occurrences',
          v_event_id,
          auth.uid(),
          current_setting('request.jwt.claim.role', true),
          true,
          CASE WHEN v_occ IS NOT NULL AND jsonb_typeof(v_occ) = 'array'
               THEN jsonb_array_length(v_occ)
               ELSE NULL END,
          NULL,
          false,
          v_error_code,
          v_error_message,
          v_duration_ms
        );

        RAISE;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'ok', 'event_id', v_event_id::text,
                             'updated_at', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_get_event_snapshot_v2 — add series_key to the event object
-- ─────────────────────────────────────────────────────────────────────────────
-- Only addition is `'series_key', e.series_key` inside the jsonb_build_object.

CREATE OR REPLACE FUNCTION public.admin_get_event_snapshot_v2(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event               jsonb;
  v_occ                 jsonb := '[]'::jsonb;
  v_org_ids             uuid[] := array[]::uuid[];
  v_teacher_ids         jsonb := '[]'::jsonb;
  v_mc_ids              jsonb := '[]'::jsonb;
  v_performer_ids       jsonb := '[]'::jsonb;
  v_guest_series        jsonb := '[]'::jsonb;
  v_guest_by_occurrence jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', e.id, 'name', e.name, 'description', e.description,
    'venue_id', e.venue_id, 'is_published', (e.lifecycle_status = 'published'),
    'created_at', e.created_at, 'created_by', e.created_by,
    'facebook_url', e.facebook_url, 'has_guestlist', e.has_guestlist,
    'has_raffle', e.has_raffle, 'instagram_url', e.instagram_url,
    'payment_methods', e.payment_methods, 'pricing', e.pricing,
    'recurrence', e.recurrence, 'ticket_url', e.ticket_url,
    'user_id', e.user_id, 'website', e.website,
    'guestlist_config', e.guestlist_config, 'key_times', e.key_times,
    'promo_codes', e.promo_codes,
    'tickets', e.tickets, 'schedule_type', e.schedule_type,
    'festival_config', e.festival_config, 'is_active', e.is_active,
    'meta_data', e.meta_data, 'type', e.type,
    'level', e.level,
    'series_key', e.series_key,
    'attendance_count', e.attendance_count, 'date', e.date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'faq', e.faq, 'country', e.country, 'timezone', e.timezone,
    'location', e.location, 'city', e.city,
    'city_slug', c_evt_resolved.slug,
    'lifecycle_status', e.lifecycle_status, 'updated_at', e.updated_at,
    'city_id', c_evt_resolved.id, 'poster_url', e.poster_url,
    'parent_event_id', e.parent_event_id,
    'source_occurrence_id', e.source_occurrence_id,
    'city_display', jsonb_build_object(
      'name', c_evt_resolved.name, 'slug', c_evt_resolved.slug,
      'is_derived', true, 'authoritative_source', 'entity_city_projection'
    )
  )
  INTO v_event
  FROM public.events e
  LEFT JOIN public.venues v_evt ON v_evt.id = e.venue_id
  LEFT JOIN public.entities ve_evt ON ve_evt.id = v_evt.entity_id
  LEFT JOIN public.cities c_evt_resolved ON c_evt_resolved.id = COALESCE(ve_evt.city_id, e.city_id)
  WHERE e.id = p_event_id;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'event % not found', p_event_id USING ERRCODE = '22000';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', co.id, 'event_id', co.event_id,
    'instance_start', co.instance_start, 'instance_end', co.instance_end,
    'source', co.source, 'is_override', co.is_override,
    'override_payload', co.override_payload,
    'city_id', c_occ_resolved.id, 'city_slug', c_occ_resolved.slug,
    'city_display', jsonb_build_object(
      'name', c_occ_resolved.name, 'slug', c_occ_resolved.slug,
      'is_derived', true, 'authoritative_source', 'entity_city_projection'
    ),
    'lifecycle_status', co.lifecycle_status,
    'created_at', co.created_at, 'updated_at', co.updated_at,
    'venue_id', co.venue_id
  ) ORDER BY co.instance_start, co.id), '[]'::jsonb)
  INTO v_occ
  FROM public.calendar_occurrences co
  LEFT JOIN public.events e ON e.id = co.event_id
  LEFT JOIN public.venues v_occ ON v_occ.id = co.venue_id
  LEFT JOIN public.entities ve_occ ON ve_occ.id = v_occ.entity_id
  LEFT JOIN public.venues v_evt ON v_evt.id = e.venue_id
  LEFT JOIN public.entities ve_evt ON ve_evt.id = v_evt.entity_id
  LEFT JOIN public.cities c_occ_resolved
    ON c_occ_resolved.id = COALESCE(ve_occ.city_id, co.city_id, ve_evt.city_id, e.city_id)
  WHERE co.event_id = p_event_id;

  SELECT COALESCE(array_agg(src.entity_id ORDER BY src.first_seen_at, src.entity_id), array[]::uuid[])
  INTO v_org_ids
  FROM (
    SELECT ee.entity_id, min(ee.created_at) AS first_seen_at
    FROM public.event_entities ee
    WHERE ee.event_id = p_event_id AND ee.role = 'organiser'
    GROUP BY ee.entity_id
  ) src;

  SELECT COALESCE(
    jsonb_agg(DISTINCT epp.profile_id) FILTER (WHERE epp.profile_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_teacher_ids
  FROM public.event_program_people epp
  WHERE epp.event_id = p_event_id AND epp.profile_type = 'teacher'
    AND COALESCE(epp.role, '') <> 'mc';

  SELECT COALESCE(
    jsonb_agg(DISTINCT epp.profile_id) FILTER (WHERE epp.profile_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_mc_ids
  FROM public.event_program_people epp
  WHERE epp.event_id = p_event_id AND epp.profile_type = 'teacher'
    AND epp.role = 'mc';

  SELECT COALESCE(
    jsonb_agg(DISTINCT epp.profile_id) FILTER (WHERE epp.profile_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_performer_ids
  FROM public.event_program_people epp
  WHERE epp.event_id = p_event_id AND epp.profile_type = 'dancer'
    AND epp.role = 'performing';

  SELECT COALESCE(
    jsonb_agg(DISTINCT epp.profile_id) FILTER (WHERE epp.profile_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_guest_series
  FROM public.event_program_people epp
  WHERE epp.event_id = p_event_id AND epp.profile_type = 'dancer'
    AND epp.role = 'guest_dancer';

  v_guest_by_occurrence := '{}'::jsonb;

  RETURN jsonb_build_object(
    'event',      v_event,
    'occurrences', v_occ,
    'childGraph', jsonb_build_object(
      'organisers',  to_jsonb(COALESCE(v_org_ids, array[]::uuid[])),
      'lineup',      jsonb_build_object(
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
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_list_raffle_events_v1 — surface series_key on each row
-- ─────────────────────────────────────────────────────────────────────────────
-- Only addition is a 'series_key' key in jsonb_build_object, mapped from
-- e.series_key. Used later by the /raffles picker to group siblings.

CREATE OR REPLACE FUNCTION public.admin_list_raffle_events_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id',                  e.id,
      'name',                      e.name,
      'start_at',                  e.start_time,
      'timezone',                  e.timezone,
      'series_key',                e.series_key,
      'prize_text',                e.meta_data->'raffle'->>'prize_text',
      'draw_date',                 e.meta_data->'raffle'->>'draw_date',
      'cutoff_time',               e.meta_data->'raffle'->>'cutoff_time',
      'cutoff_passed', (
        CASE
          WHEN (e.meta_data->'raffle'->>'cutoff_time') IS NULL
            OR (e.meta_data->'raffle'->>'cutoff_time') = ''
            OR e.start_time IS NULL
            OR (e.meta_data->'raffle'->>'cutoff_time') !~ '^\d{2}:\d{2}(:\d{2})?$'
          THEN false
          ELSE (now() >= (
            (e.start_time AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))::date
            || ' ' || (e.meta_data->'raffle'->>'cutoff_time')
          )::timestamp AT TIME ZONE COALESCE(e.timezone, 'Europe/London'))
        END
      ),
      'active_entry_count', (
        SELECT COUNT(*)
          FROM event_raffle_entries ere
         WHERE ere.event_id = e.id
           AND ere.deleted_at IS NULL
           AND ere.ineligible_reason IS NULL
      ),
      'total_entry_count', (
        SELECT COUNT(*)
          FROM event_raffle_entries ere
         WHERE ere.event_id = e.id
      ),
      'current_winner_first_name', (
        SELECT winner.first_name
          FROM event_raffle_draws erd
          LEFT JOIN event_raffle_entries winner ON winner.id = erd.winner_entry_id
         WHERE erd.event_id = e.id AND erd.is_active = true
         LIMIT 1
      ),
      'current_draw_is_active', EXISTS (
        SELECT 1 FROM event_raffle_draws erd
         WHERE erd.event_id = e.id AND erd.is_active = true
      )
    ) ORDER BY e.start_time ASC NULLS LAST
  ), '[]'::jsonb)
  INTO v_result
  FROM events e
  WHERE e.has_raffle = true;

  RETURN v_result;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Schema reload
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
