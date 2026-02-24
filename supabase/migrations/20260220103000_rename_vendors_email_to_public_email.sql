-- Rename vendor contact email column to public_email and keep trigger behavior aligned.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'email'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vendors'
        AND column_name = 'public_email'
    ) THEN
      UPDATE public.vendors
      SET public_email = COALESCE(public_email, email)
      WHERE email IS NOT NULL;

      ALTER TABLE public.vendors
      DROP COLUMN email;
    ELSE
      ALTER TABLE public.vendors
      RENAME COLUMN email TO public_email;
    END IF;
  END IF;
END;
$$;

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
      NULLIF(trim(coalesce(v_row ->> 'public_email', v_row ->> 'email', '')), ''),
      NULL,
      NULL,
      NULLIF(trim(coalesce(v_row ->> 'city', '')), '')
    );
  END IF;

  RETURN NEW;
END;
$$;
