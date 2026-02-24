-- Scalable attendance counts for multiple events

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
    ep.event_id,
    COUNT(*) FILTER (WHERE ep.status = 'interested') AS interested_count,
    COUNT(*) FILTER (WHERE ep.status = 'going') AS going_count
  FROM public.event_participants ep
  WHERE ep.event_id = ANY (p_event_ids)
  GROUP BY ep.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid[]) TO authenticated;