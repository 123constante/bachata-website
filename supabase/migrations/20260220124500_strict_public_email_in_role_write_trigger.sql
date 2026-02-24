-- Strict mode: vendors use public_email only (no legacy email fallback).

CREATE OR REPLACE FUNCTION public.enforce_dancer_profile_on_role_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row jsonb;
BEGIN
  v_row := to_jsonb(NEW);

  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.ensure_dancer_profile(
      NEW.user_id,
      NULLIF(trim(coalesce(v_row ->> 'public_email', '')), ''),
      NULL,
      NULL,
      NULLIF(trim(coalesce(v_row ->> 'city', '')), '')
    );
  END IF;

  RETURN NEW;
END;
$$;
