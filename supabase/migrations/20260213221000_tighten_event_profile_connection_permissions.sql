-- Phase 6: Tighten permissions for event_profile_connections writes
-- Uses person identity links + legacy ownership fallback.

-- Helper: can current user manage graph links for an event?
CREATE OR REPLACE FUNCTION public.can_current_user_manage_event_graph(
  p_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.can_current_user_manage_event_graph(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_manage_event_graph(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_current_user_manage_event_graph(uuid) TO service_role;

-- Replace broad Phase 1 direct-write policies.
DROP POLICY IF EXISTS "Authenticated can insert links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Authenticated can update links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Authenticated can delete links" ON public.event_profile_connections;

CREATE POLICY "Admins can insert links directly"
ON public.event_profile_connections
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update links directly"
ON public.event_profile_connections
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete links directly"
ON public.event_profile_connections
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

-- Tighten write helper (upsert one edge)
CREATE OR REPLACE FUNCTION public.upsert_event_profile_connection(
  p_event_id uuid,
  p_person_type text,
  p_person_id uuid,
  p_connection_label text,
  p_is_primary boolean DEFAULT false,
  p_sort_order integer DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.upsert_event_profile_connection(uuid, text, uuid, text, boolean, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_event_profile_connection(uuid, text, uuid, text, boolean, integer, text) TO service_role;
