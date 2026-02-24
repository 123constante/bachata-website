-- Ensure attendance rows are removed when an event is deleted
DO $$
BEGIN
  DELETE FROM public.event_participants ep
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = ep.event_id
  );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.event_participants'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.events'::regclass
      AND a.attname = 'event_id'
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_event_id_fkey
      FOREIGN KEY (event_id)
      REFERENCES public.events (id)
      ON DELETE CASCADE;
  END IF;
END $$;
