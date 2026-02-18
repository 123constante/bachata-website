CREATE OR REPLACE FUNCTION public.claim_vendor_profile_for_current_user(
  p_vendor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_dancer_id uuid;
  v_existing_vendor_id uuid;
  v_claimed_vendor_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id
  INTO v_existing_vendor_id
  FROM public.vendors
  WHERE user_id = v_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_existing_vendor_id IS NOT NULL THEN
    RETURN v_existing_vendor_id;
  END IF;

  SELECT id
  INTO v_dancer_id
  FROM public.dancers
  WHERE user_id = v_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_dancer_id IS NULL THEN
    RAISE EXCEPTION 'No dancer profile linked to current user';
  END IF;

  UPDATE public.vendors v
  SET user_id = v_user_id
  WHERE v.id = p_vendor_id
    AND v.user_id IS NULL
    AND (
      COALESCE(v.meta_data ->> 'business_leader_dancer_id', '') = v_dancer_id::text
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v.team, '[]'::jsonb)) AS member
        WHERE member ->> 'dancer_id' = v_dancer_id::text
      )
    )
  RETURNING v.id INTO v_claimed_vendor_id;

  RETURN v_claimed_vendor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_vendor_profile_for_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vendor_profile_for_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_vendor_profile_for_current_user(uuid) TO service_role;
