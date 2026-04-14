-- Canonical user identity with based city
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS based_city_id uuid REFERENCES public.cities(id);

UPDATE public.profiles
SET first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), ''))
WHERE first_name IS NULL AND full_name IS NOT NULL;

UPDATE public.profiles
SET last_name = COALESCE(last_name, NULLIF(trim(regexp_replace(full_name, '^\s*\S+\s*', '')), ''))
WHERE last_name IS NULL AND full_name IS NOT NULL;

INSERT INTO public.cities (name, slug, country_id, is_active, image_url)
VALUES ('World', 'world', null, true, null)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.profiles
SET first_name = 'Member'
WHERE first_name IS NULL;

UPDATE public.profiles
SET based_city_id = (
  SELECT id FROM public.cities WHERE slug = 'world' LIMIT 1
)
WHERE based_city_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN based_city_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_based_city_id
  ON public.profiles (based_city_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_user_identity_prefill()
RETURNS TABLE (
  first_name text,
  last_name text,
  based_city_id uuid,
  based_city_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.first_name, p.last_name, p.based_city_id, c.name
  FROM public.profiles p
  LEFT JOIN public.cities c ON c.id = p.based_city_id
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_user_identity_prefill() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_based_city_id uuid;
BEGIN
  v_first_name := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'first_name', '')), '');
  v_last_name := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'last_name', '')), '');
  v_based_city_id := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'based_city_id', '')), '')::uuid;

  IF v_first_name IS NULL THEN
    RAISE EXCEPTION 'first_name is required';
  END IF;

  IF v_based_city_id IS NULL THEN
    RAISE EXCEPTION 'based_city_id is required';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, based_city_id, email)
  VALUES (NEW.id, v_first_name, v_last_name, v_based_city_id, NEW.email)
  ON CONFLICT (id) DO UPDATE
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      based_city_id = EXCLUDED.based_city_id,
      email = COALESCE(public.profiles.email, EXCLUDED.email);

  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'based_city_id must be a uuid';
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user_identity ON auth.users;
CREATE TRIGGER trg_handle_new_user_identity
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_identity();

CREATE OR REPLACE FUNCTION public.fill_city_id_from_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.city_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT based_city_id INTO NEW.city_id
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_profiles_fill_city ON public.teacher_profiles;
CREATE TRIGGER trg_teacher_profiles_fill_city
  BEFORE INSERT ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_city_id_from_profile();

DROP TRIGGER IF EXISTS trg_dancers_fill_city ON public.dancers;
CREATE TRIGGER trg_dancers_fill_city
  BEFORE INSERT ON public.dancers
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_city_id_from_profile();
