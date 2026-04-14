-- Grant SELECT on event_participants to anon and authenticated roles.
--
-- The RLS policy "event_participants_select_public" (USING (true)) was added in
-- 20260222120000_add_set_attendance_rpc.sql but the object-level privilege was
-- never granted. PostgREST requires GRANT SELECT before it will check RLS,
-- so anon callers received a 404 when querying the table directly.

GRANT SELECT ON public.event_participants TO anon;
GRANT SELECT ON public.event_participants TO authenticated;
