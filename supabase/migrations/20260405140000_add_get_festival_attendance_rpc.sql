-- SECURITY DEFINER wrapper so anon callers can read event_participants
-- without requiring a table-level GRANT (which requires db push to deploy).
-- Returns counts + a capped attendee list for the festival detail page.

CREATE OR REPLACE FUNCTION public.get_festival_attendance(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'going_count',      COUNT(*) FILTER (WHERE status = 'going'),
    'interested_count', COUNT(*) FILTER (WHERE status = 'interested'),
    'attendees', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('user_id', a.user_id, 'status', a.status)
        )
        FROM (
          SELECT user_id, status
          FROM public.event_participants
          WHERE event_id = p_event_id
            AND status IN ('going', 'interested')
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 200
        ) a
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.event_participants
  WHERE event_id = p_event_id
    AND status IN ('going', 'interested');

  RETURN COALESCE(
    v_result,
    '{"going_count":0,"interested_count":0,"attendees":[]}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_festival_attendance(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_festival_attendance(uuid) TO authenticated;
