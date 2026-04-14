-- Fix admin connectivity RPCs to match real event_profile_connections schema
-- Uses person_type/person_id as source-of-truth and venue_id from events.

DROP FUNCTION IF EXISTS public.admin_get_connectivity_health_metrics(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_get_unlinked_events_queue(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.admin_get_unlinked_profiles_queue(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.admin_get_broken_reference_queue(integer);

CREATE FUNCTION public.admin_get_connectivity_health_metrics(
  p_city_id uuid DEFAULT NULL,
  p_city_slug text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE (
  published_events_with_organiser_pct numeric,
  published_events_with_venue_pct numeric,
  profiles_linked_to_at_least_one_event_pct numeric,
  unlinked_events_count bigint,
  unlinked_profiles_count bigint,
  unresolved_city_mappings_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_connectivity() THEN
    RAISE EXCEPTION 'Not authorized to read connectivity health metrics';
  END IF;

  RETURN QUERY
  WITH filtered_events AS (
    SELECT e.id, e.lifecycle_status, e.is_active, e.venue_id, to_jsonb(e) AS row_json
    FROM public.events e
    WHERE public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
  ),
  published_events AS (
    SELECT fe.id, fe.venue_id
    FROM filtered_events fe
    WHERE lower(coalesce(fe.lifecycle_status, '')) = 'published'
       OR coalesce(fe.is_active, false)
  ),
  event_roles AS (
    SELECT
      pe.id AS event_id,
      EXISTS (
        SELECT 1
        FROM public.event_profile_connections c
        WHERE c.event_id = pe.id
          AND c.person_type = 'organiser'
      ) AS has_organiser,
      (pe.venue_id IS NOT NULL) AS has_venue
    FROM published_events pe
  ),
  profile_universe AS (
    SELECT 'teacher'::text AS profile_type, t.id AS profile_id, to_jsonb(t) AS row_json FROM public.teacher_profiles t
    UNION ALL SELECT 'dj', d.id, to_jsonb(d) FROM public.dj_profiles d
    UNION ALL SELECT 'organiser', o.id, to_jsonb(o) FROM public.organisers o
    UNION ALL SELECT 'vendor', v.id, to_jsonb(v) FROM public.vendors v
    UNION ALL SELECT 'videographer', vg.id, to_jsonb(vg) FROM public.videographers vg
    UNION ALL SELECT 'dancer', da.id, to_jsonb(da) FROM public.dancers da
    UNION ALL SELECT 'venue', ve.id, to_jsonb(ve) FROM public.venues ve
  ),
  filtered_profiles AS (
    SELECT pu.profile_type, pu.profile_id
    FROM profile_universe pu
    WHERE public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  linked_profiles AS (
    SELECT DISTINCT c.person_type AS profile_type, c.person_id::text AS profile_id_text
    FROM public.event_profile_connections c
    JOIN filtered_events fe ON fe.id = c.event_id
    UNION
    SELECT 'venue'::text AS profile_type, fe.venue_id::text AS profile_id_text
    FROM filtered_events fe
    WHERE fe.venue_id IS NOT NULL
  ),
  unresolved_city AS (
    WITH source_rows AS (
      SELECT to_jsonb(e) AS row_json FROM public.events e
      UNION ALL SELECT to_jsonb(t) FROM public.teacher_profiles t
      UNION ALL SELECT to_jsonb(d) FROM public.dj_profiles d
      UNION ALL SELECT to_jsonb(o) FROM public.organisers o
      UNION ALL SELECT to_jsonb(v) FROM public.vendors v
      UNION ALL SELECT to_jsonb(vg) FROM public.videographers vg
      UNION ALL SELECT to_jsonb(da) FROM public.dancers da
      UNION ALL SELECT to_jsonb(ve) FROM public.venues ve
    )
    SELECT count(*) AS total
    FROM source_rows sr
    WHERE (
      (nullif(coalesce(sr.row_json ->> 'city_id', ''), '') IS NULL AND nullif(coalesce(sr.row_json ->> 'city_slug', sr.row_json ->> 'city', ''), '') IS NOT NULL)
      OR
      (nullif(coalesce(sr.row_json ->> 'city_id', ''), '') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.cities c WHERE c.id::text = (sr.row_json ->> 'city_id')
      ))
    )
    AND public.admin_row_city_matches(sr.row_json, p_city_id, p_city_slug, p_city)
  )
  SELECT
    coalesce(round((count(*) FILTER (WHERE er.has_organiser)::numeric / nullif(count(*), 0)::numeric) * 100, 2), 0),
    coalesce(round((count(*) FILTER (WHERE er.has_venue)::numeric / nullif(count(*), 0)::numeric) * 100, 2), 0),
    coalesce(
      round(
        (
          (
            SELECT count(*)::numeric
            FROM filtered_profiles fp
            WHERE EXISTS (
              SELECT 1
              FROM linked_profiles lp
              WHERE lp.profile_type = fp.profile_type
                AND lp.profile_id_text = fp.profile_id::text
            )
          )
          /
          nullif((SELECT count(*)::numeric FROM filtered_profiles), 0)
        ) * 100,
      2),
    0),
    coalesce((SELECT count(*) FROM event_roles x WHERE NOT x.has_organiser OR NOT x.has_venue), 0),
    coalesce((
      SELECT count(*)
      FROM filtered_profiles fp
      WHERE NOT EXISTS (
        SELECT 1 FROM linked_profiles lp
        WHERE lp.profile_type = fp.profile_type
          AND lp.profile_id_text = fp.profile_id::text
      )
    ), 0),
    coalesce((SELECT total FROM unresolved_city), 0)
  FROM event_roles er;
END;
$$;

CREATE FUNCTION public.admin_get_unlinked_events_queue(
  p_city_id uuid DEFAULT NULL,
  p_city_slug text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  event_id uuid,
  event_name text,
  start_time timestamptz,
  city_id_text text,
  city_slug text,
  city text,
  missing_organiser boolean,
  missing_venue boolean,
  reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_events AS (
    SELECT
      e.id AS event_id,
      coalesce(e.name, 'Party ' || e.id::text) AS event_name,
      e.start_time,
      e.city_id::text AS city_id_text,
      e.city_slug,
      e.city,
      e.venue_id
    FROM public.events e
    WHERE public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
      AND (
        lower(coalesce(e.lifecycle_status, '')) = 'published'
        OR coalesce(e.is_active, false)
      )
  ),
  flags AS (
    SELECT
      fe.event_id,
      fe.event_name,
      fe.start_time,
      fe.city_id_text,
      fe.city_slug,
      fe.city,
      NOT EXISTS (
        SELECT 1
        FROM public.event_profile_connections c
        WHERE c.event_id = fe.event_id
          AND c.person_type = 'organiser'
      ) AS missing_organiser,
      (fe.venue_id IS NULL) AS missing_venue
    FROM filtered_events fe
  )
  SELECT
    f.event_id,
    f.event_name,
    f.start_time,
    f.city_id_text,
    f.city_slug,
    f.city,
    f.missing_organiser,
    f.missing_venue,
    CASE
      WHEN f.missing_organiser AND f.missing_venue THEN 'missing_organiser_and_venue'
      WHEN f.missing_organiser THEN 'missing_organiser'
      WHEN f.missing_venue THEN 'missing_venue'
      ELSE 'ok'
    END AS reason
  FROM flags f
  WHERE f.missing_organiser OR f.missing_venue
  ORDER BY f.start_time NULLS LAST, f.event_id
  LIMIT greatest(coalesce(p_limit, 100), 1);
$$;

CREATE FUNCTION public.admin_get_unlinked_profiles_queue(
  p_city_id uuid DEFAULT NULL,
  p_city_slug text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  profile_type text,
  profile_id uuid,
  display_name text,
  city_id_text text,
  city_slug text,
  city text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profile_universe AS (
    SELECT 'teacher'::text AS profile_type, t.id AS profile_id, to_jsonb(t) AS row_json,
      coalesce(nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.surname,'')), ''), 'Teacher ' || t.id::text) AS display_name
    FROM public.teacher_profiles t

    UNION ALL
    SELECT 'dj', d.id, to_jsonb(d),
      coalesce(nullif(d.dj_name, ''), nullif(trim(coalesce(d.first_name,'') || ' ' || coalesce(d.surname,'')), ''), 'DJ ' || d.id::text)
    FROM public.dj_profiles d

    UNION ALL
    SELECT 'organiser', o.id, to_jsonb(o),
      coalesce(nullif(o.organisation_name, ''), nullif(trim(coalesce(o.first_name,'') || ' ' || coalesce(o.surname,'')), ''), 'Organiser ' || o.id::text)
    FROM public.organisers o

    UNION ALL
    SELECT 'vendor', v.id, to_jsonb(v), coalesce(nullif(v.business_name, ''), 'Vendor ' || v.id::text)
    FROM public.vendors v

    UNION ALL
    SELECT 'videographer', vg.id, to_jsonb(vg), coalesce(nullif(vg.business_name, ''), 'Videographer ' || vg.id::text)
    FROM public.videographers vg

    UNION ALL
    SELECT 'dancer', da.id, to_jsonb(da),
      coalesce(nullif(trim(coalesce(da.first_name,'') || ' ' || coalesce(da.surname,'')), ''), 'Dancer ' || da.id::text)
    FROM public.dancers da

    UNION ALL
    SELECT 'venue', ve.id, to_jsonb(ve), coalesce(nullif(ve.name, ''), 'Venue ' || ve.id::text)
    FROM public.venues ve
  ),
  filtered_profiles AS (
    SELECT pu.profile_type, pu.profile_id, pu.display_name, pu.row_json
    FROM profile_universe pu
    WHERE public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  linked_profiles AS (
    SELECT DISTINCT c.person_type AS profile_type, c.person_id::text AS profile_id_text
    FROM public.event_profile_connections c

    UNION
    SELECT 'venue'::text AS profile_type, e.venue_id::text AS profile_id_text
    FROM public.events e
    WHERE e.venue_id IS NOT NULL
      AND public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
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
      AND lp.profile_id_text = fp.profile_id::text
  )
  ORDER BY fp.profile_type, fp.display_name
  LIMIT greatest(coalesce(p_limit, 200), 1);
$$;

CREATE FUNCTION public.admin_get_broken_reference_queue(
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  event_id uuid,
  role text,
  broken_profile_id text,
  source text,
  detail text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH broken AS (
    SELECT
      c.event_id,
      c.person_type AS role,
      c.person_id::text AS broken_profile_id,
      'event_profile_connections'::text AS source,
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = c.event_id) THEN 'missing event record'
        WHEN NOT public.admin_profile_exists(c.person_type, c.person_id) THEN 'missing profile record'
        ELSE 'ok'
      END AS detail
    FROM public.event_profile_connections c
  )
  SELECT
    b.event_id,
    b.role,
    b.broken_profile_id,
    b.source,
    b.detail
  FROM broken b
  WHERE b.detail <> 'ok'
  ORDER BY b.event_id NULLS FIRST
  LIMIT greatest(coalesce(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_connectivity_health_metrics(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_unlinked_events_queue(uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_unlinked_profiles_queue(uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_broken_reference_queue(integer) TO authenticated, service_role;
