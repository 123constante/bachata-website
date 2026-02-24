-- Ensure set_attendance RPC exists in the live schema cache
CREATE OR REPLACE FUNCTION public.set_attendance(
  p_event_id uuid,
  p_status text DEFAULT NULL
)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized_status text;
  v_row public.event_participants;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL THEN
    DELETE FROM public.event_participants
    WHERE event_id = p_event_id
      AND user_id = v_user_id
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;

  v_normalized_status := lower(btrim(p_status));
  IF v_normalized_status NOT IN ('interested', 'going') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_participants (event_id, user_id, status, updated_at)
  VALUES (p_event_id, v_user_id, v_normalized_status, now())
  ON CONFLICT (user_id, event_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_attendance(uuid, text) TO authenticated;
