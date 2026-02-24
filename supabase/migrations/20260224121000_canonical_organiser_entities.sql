-- Canonical organiser source: entities(type='organiser')
-- Refactors claim + event-link auth + event detail organiser reads to entities only.

-- Allow authenticated users to create their own organiser entity profiles.
DROP POLICY IF EXISTS "Authenticated can create claimed organiser entities" ON public.entities;
CREATE POLICY "Authenticated can create claimed organiser entities"
ON public.entities
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND type = 'organiser'
  AND claimed_by = auth.uid()
);

-- Claim organiser profile against entities canonical table.
CREATE OR REPLACE FUNCTION public.claim_organiser_profile(p_organiser_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.entities
  SET claimed_by = v_user_id
  WHERE id = p_organiser_id
    AND type = 'organiser'
    AND claimed_by IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_organiser_profile(uuid) TO authenticated;

-- Event profile connection write policies: resolve organisers only from event_entities -> entities.
DROP POLICY IF EXISTS "Organisers can insert links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Organisers can update links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Organisers can delete links" ON public.event_profile_connections;

CREATE POLICY "Organisers can insert links"
ON public.event_profile_connections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.event_entities ee
    JOIN public.entities en
      ON en.id = ee.entity_id
    WHERE ee.event_id = event_profile_connections.event_id
      AND ee.role = 'organiser'
      AND en.type = 'organiser'
      AND public.can_current_user_manage_profile('organiser', en.id)
  )
);

CREATE POLICY "Organisers can update links"
ON public.event_profile_connections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_entities ee
    JOIN public.entities en
      ON en.id = ee.entity_id
    WHERE ee.event_id = event_profile_connections.event_id
      AND ee.role = 'organiser'
      AND en.type = 'organiser'
      AND public.can_current_user_manage_profile('organiser', en.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.event_entities ee
    JOIN public.entities en
      ON en.id = ee.entity_id
    WHERE ee.event_id = event_profile_connections.event_id
      AND ee.role = 'organiser'
      AND en.type = 'organiser'
      AND public.can_current_user_manage_profile('organiser', en.id)
  )
);

CREATE POLICY "Organisers can delete links"
ON public.event_profile_connections
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_entities ee
    JOIN public.entities en
      ON en.id = ee.entity_id
    WHERE ee.event_id = event_profile_connections.event_id
      AND ee.role = 'organiser'
      AND en.type = 'organiser'
      AND public.can_current_user_manage_profile('organiser', en.id)
  )
);

-- Event detail: organiser payload reads from canonical entities source and event_entities links.
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
  SELECT * INTO v_event_record FROM public.events WHERE id = p_event_id;

  IF v_event_record IS NULL THEN
    RETURN;
  END IF;

  SELECT to_jsonb(v) INTO v_venue_record
  FROM public.venues v
  WHERE v.id = v_event_record.venue_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', en.id,
      'name', en.name,
      'avatar_url', en.avatar_url,
      'city_id', en.city_id,
      'socials', en.socials
    )
    ORDER BY en.name
  ) INTO v_organisers
  FROM public.event_entities ee
  JOIN public.entities en
    ON en.id = ee.entity_id
  WHERE ee.event_id = p_event_id
    AND ee.role = 'organiser'
    AND en.type = 'organiser';

  SELECT jsonb_agg(to_jsonb(t)) INTO v_teachers
  FROM public.teacher_profiles t
  WHERE t.id = ANY(v_event_record.teacher_ids);

  SELECT jsonb_agg(to_jsonb(d)) INTO v_djs
  FROM public.dj_profiles d
  WHERE d.id = ANY(v_event_record.dj_ids);

  v_key_times := COALESCE(v_event_record.key_times, v_event_record.meta_data->'key_times', '{}'::jsonb);

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
