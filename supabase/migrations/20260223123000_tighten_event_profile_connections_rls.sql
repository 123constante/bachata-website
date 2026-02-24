-- Tighten RLS for event_profile_connections: organisers only for writes
ALTER TABLE public.event_profile_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read non-dancer links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Authenticated can insert links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Authenticated can update links" ON public.event_profile_connections;
DROP POLICY IF EXISTS "Authenticated can delete links" ON public.event_profile_connections;

-- Read policy: public can read non-dancer links, authenticated can read dancer links
CREATE POLICY "Public can read non-dancer links"
ON public.event_profile_connections
FOR SELECT
USING (person_type <> 'dancer' OR auth.uid() IS NOT NULL);

-- Write policy: only organisers of the event can mutate links
CREATE POLICY "Organisers can insert links"
ON public.event_profile_connections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.organisers o
      ON o.id = ANY(e.organiser_ids)
    WHERE e.id = event_profile_connections.event_id
      AND o.user_id = auth.uid()
  )
);

CREATE POLICY "Organisers can update links"
ON public.event_profile_connections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.organisers o
      ON o.id = ANY(e.organiser_ids)
    WHERE e.id = event_profile_connections.event_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.organisers o
      ON o.id = ANY(e.organiser_ids)
    WHERE e.id = event_profile_connections.event_id
      AND o.user_id = auth.uid()
  )
);

CREATE POLICY "Organisers can delete links"
ON public.event_profile_connections
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.organisers o
      ON o.id = ANY(e.organiser_ids)
    WHERE e.id = event_profile_connections.event_id
      AND o.user_id = auth.uid()
  )
);
