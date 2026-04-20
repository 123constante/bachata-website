BEGIN;
DROP FUNCTION IF EXISTS public.get_venue_events(uuid, text);
NOTIFY pgrst, 'reload schema';
COMMIT;
