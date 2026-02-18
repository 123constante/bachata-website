-- Phase 1: Event <-> Profile graph foundation
-- Supports: event page people lists and profile timeline of connected events

CREATE TABLE public.event_profile_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  person_type text NOT NULL CHECK (person_type IN ('dancer', 'organiser', 'teacher', 'dj', 'vendor', 'videographer')),
  person_id uuid NOT NULL,
  connection_label text NOT NULL CHECK (connection_label IN ('attending', 'interested', 'teaching', 'performing_dj', 'organising', 'vendor_partner')),
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  UNIQUE (event_id, person_type, person_id, connection_label)
);

CREATE INDEX idx_event_profile_connections_event
  ON public.event_profile_connections (event_id, person_type, connection_label, sort_order);

CREATE INDEX idx_event_profile_connections_person
  ON public.event_profile_connections (person_type, person_id, connection_label);

ALTER TABLE public.event_profile_connections ENABLE ROW LEVEL SECURITY;

-- Read policy:
-- - all public links are visible
-- - dancer links are only visible to logged-in users
CREATE POLICY "Public can read non-dancer links"
ON public.event_profile_connections
FOR SELECT
USING (person_type <> 'dancer' OR auth.uid() IS NOT NULL);

-- Write policy (Phase 1 baseline): authenticated users can manage links.
-- We can tighten this in Phase 2/3 based on organiser/admin ownership.
CREATE POLICY "Authenticated can insert links"
ON public.event_profile_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update links"
ON public.event_profile_connections
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete links"
ON public.event_profile_connections
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- RPC 1: event -> connected people (group on frontend by person_type)
CREATE OR REPLACE FUNCTION public.get_event_profile_connections(
  p_event_id uuid
)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  person_type text,
  person_id uuid,
  connection_label text,
  is_primary boolean,
  sort_order integer,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.get_event_profile_connections(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_profile_connections(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_profile_connections(uuid) TO service_role;

-- RPC 2: profile -> connected events (timeline source)
CREATE OR REPLACE FUNCTION public.get_profile_event_timeline(
  p_person_type text,
  p_person_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_id uuid,
  event_name text,
  event_location text,
  event_start_time timestamptz,
  connection_label text,
  is_primary boolean,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.get_profile_event_timeline(text, uuid, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_event_timeline(text, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_event_timeline(text, uuid, integer, integer) TO service_role;

-- RPC 3: write helper (upsert one edge)
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
