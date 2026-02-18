-- Ensure every account has a foundational dancer profile.
-- Adds a callable RPC plus role-table trigger guards.

CREATE OR REPLACE FUNCTION public.ensure_dancer_profile(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_surname text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_existing_id uuid;
  v_name text;
  v_email text;
  v_city text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found in auth.users', p_user_id;
  END IF;

  v_email := nullif(trim(coalesce(p_email, v_user.email, '')), '');
  v_city := nullif(trim(coalesce(
    p_city,
    v_user.raw_user_meta_data ->> 'city',
    ''
  )), '');

  v_name := nullif(trim(coalesce(
    p_first_name,
    v_user.raw_user_meta_data ->> 'first_name',
    split_part(coalesce(v_user.email, ''), '@', 1),
    ''
  )), '');

  IF v_name IS NULL THEN
    v_name := 'Member';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM public.dancers
  WHERE user_id = p_user_id
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.dancers
    SET
      first_name = CASE
        WHEN nullif(trim(coalesce(first_name, '')), '') IS NULL THEN v_name
        ELSE first_name
      END,
      email = CASE
        WHEN nullif(trim(coalesce(email, '')), '') IS NULL THEN v_email
        ELSE email
      END,
      city = CASE
        WHEN nullif(trim(coalesce(city, '')), '') IS NULL THEN v_city
        ELSE city
      END
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  END IF;

  BEGIN
    INSERT INTO public.dancers (
      user_id,
      first_name,
      surname,
      email,
      city,
      verified,
      is_public,
      hide_surname
    )
    VALUES (
      p_user_id,
      v_name,
      nullif(trim(coalesce(p_surname, v_user.raw_user_meta_data ->> 'surname', '')), ''),
      v_email,
      v_city,
      false,
      false,
      false
    )
    RETURNING id INTO v_existing_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id
      INTO v_existing_id
      FROM public.dancers
      WHERE user_id = p_user_id
      ORDER BY created_at ASC NULLS LAST
      LIMIT 1;
  END;

  RETURN v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_dancer_profile(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_dancer_profile(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_dancer_profile(uuid, text, text, text, text) TO service_role;

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
      NULLIF(trim(coalesce(v_row ->> 'email', '')), ''),
      NULL,
      NULL,
      NULLIF(trim(coalesce(v_row ->> 'city', '')), '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_ensure_dancer_profile ON public.vendors;
CREATE TRIGGER trg_vendors_ensure_dancer_profile
BEFORE INSERT OR UPDATE OF user_id ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dancer_profile_on_role_write();

DROP TRIGGER IF EXISTS trg_organisers_ensure_dancer_profile ON public.organisers;
CREATE TRIGGER trg_organisers_ensure_dancer_profile
BEFORE INSERT OR UPDATE OF user_id ON public.organisers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dancer_profile_on_role_write();

DROP TRIGGER IF EXISTS trg_teacher_profiles_ensure_dancer_profile ON public.teacher_profiles;
CREATE TRIGGER trg_teacher_profiles_ensure_dancer_profile
BEFORE INSERT OR UPDATE OF user_id ON public.teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dancer_profile_on_role_write();

DROP TRIGGER IF EXISTS trg_dj_profiles_ensure_dancer_profile ON public.dj_profiles;
CREATE TRIGGER trg_dj_profiles_ensure_dancer_profile
BEFORE INSERT OR UPDATE OF user_id ON public.dj_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dancer_profile_on_role_write();

DROP TRIGGER IF EXISTS trg_videographers_ensure_dancer_profile ON public.videographers;
CREATE TRIGGER trg_videographers_ensure_dancer_profile
BEFORE INSERT OR UPDATE OF user_id ON public.videographers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dancer_profile_on_role_write();
