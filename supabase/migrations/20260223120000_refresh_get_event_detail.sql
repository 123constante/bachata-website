-- Align get_event_detail with current events schema
CREATE OR REPLACE FUNCTION public.get_event_detail(p_event_id uuid)
RETURNS TABLE(event jsonb, venue jsonb, organisers jsonb, teachers jsonb, djs jsonb, venue_entity jsonb)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event_record record;
  v_venue_record jsonb;
  v_organisers jsonb;
  v_teachers jsonb;
  v_djs jsonb;
  v_key_times jsonb;
BEGIN
  -- A. Fetch basic event info
  SELECT * INTO v_event_record FROM events WHERE id = p_event_id;

  IF v_event_record IS NULL THEN
    RETURN;
  END IF;

  -- B. Fetch Venue
  SELECT to_jsonb(v) INTO v_venue_record FROM venues v WHERE id = v_event_record.venue_id;

  -- C. Fetch Linked Entities
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'organisation_name', o.organisation_name,
      'photo_url', o.photo_url,
      'city', o.city,
      'meta_data', o.meta_data
    )
  ) INTO v_organisers
  FROM organisers o
  WHERE o.id = ANY(v_event_record.organiser_ids);

  SELECT jsonb_agg(to_jsonb(t)) INTO v_teachers
  FROM teacher_profiles t
  WHERE t.id = ANY(v_event_record.teacher_ids);

  SELECT jsonb_agg(to_jsonb(d)) INTO v_djs
  FROM dj_profiles d
  WHERE d.id = ANY(v_event_record.dj_ids);

  v_key_times := COALESCE(v_event_record.key_times, v_event_record.meta_data->'key_times', '{}'::jsonb);

  -- D. Assemble Response
  RETURN QUERY SELECT
    jsonb_build_object(
      'id', v_event_record.id,
      'name', v_event_record.name,
      'date', v_event_record.date,
      'description', v_event_record.description,
      'photo_url', v_event_record.photo_url,
      'cover_image_url', v_event_record.cover_image_url,
      'location', v_event_record.location,
      'city_slug', v_event_record.city_slug,
      'is_published', v_event_record.is_published,
      'venue_id', v_event_record.venue_id,
      'created_by', v_event_record.created_by,
      'meta_data', v_event_record.meta_data,
      'key_times', v_key_times,
      'class_start', v_key_times->'classes'->>'start',
      'class_end', v_key_times->'classes'->>'end',
      'party_start', v_key_times->'party'->>'start',
      'party_end', v_key_times->'party'->>'end'
    ) AS event,
    COALESCE(v_venue_record, 'null'::jsonb) AS venue,
    COALESCE(v_organisers, '[]'::jsonb) AS organisers,
    COALESCE(v_teachers, '[]'::jsonb) AS teachers,
    COALESCE(v_djs, '[]'::jsonb) AS djs,
    COALESCE(v_venue_record, 'null'::jsonb) AS venue_entity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_detail(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_detail(uuid) TO authenticated;
