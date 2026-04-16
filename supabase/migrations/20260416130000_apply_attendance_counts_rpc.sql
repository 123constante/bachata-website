-- Corrected get_event_attendance_counts RPC.
-- Reads from event_attendance (occurrence-based) joined through
-- calendar_occurrences to resolve back to event_id.
-- The old event_participants table no longer exists.

CREATE OR REPLACE FUNCTION public.get_event_attendance_counts(
  p_event_ids uuid[]
)
RETURNS TABLE (
  event_id uuid,
  interested_count bigint,
  going_count bigint
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    co.event_id,
    COUNT(*) FILTER (WHERE ea.status = 'interested') AS interested_count,
    COUNT(*) FILTER (WHERE ea.status = 'going') AS going_count
  FROM public.event_attendance ea
  JOIN public.calendar_occurrences co ON co.id = ea.occurrence_id
  WHERE co.event_id = ANY(p_event_ids)
  GROUP BY co.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
