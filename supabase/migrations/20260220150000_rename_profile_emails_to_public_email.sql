-- Rename profile email columns to public_email for public-facing contact fields.

DO $$
BEGIN
  -- organisers
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisers'
      AND column_name = 'email'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organisers'
        AND column_name = 'public_email'
    ) THEN
      UPDATE public.organisers
      SET public_email = COALESCE(public_email, email)
      WHERE email IS NOT NULL;

      ALTER TABLE public.organisers
      DROP COLUMN email;
    ELSE
      ALTER TABLE public.organisers
      RENAME COLUMN email TO public_email;
    END IF;
  END IF;

  -- teacher_profiles
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_profiles'
      AND column_name = 'email'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'teacher_profiles'
        AND column_name = 'public_email'
    ) THEN
      UPDATE public.teacher_profiles
      SET public_email = COALESCE(public_email, email)
      WHERE email IS NOT NULL;

      ALTER TABLE public.teacher_profiles
      DROP COLUMN email;
    ELSE
      ALTER TABLE public.teacher_profiles
      RENAME COLUMN email TO public_email;
    END IF;
  END IF;

  -- dj_profiles
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dj_profiles'
      AND column_name = 'email'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'dj_profiles'
        AND column_name = 'public_email'
    ) THEN
      UPDATE public.dj_profiles
      SET public_email = COALESCE(public_email, email)
      WHERE email IS NOT NULL;

      ALTER TABLE public.dj_profiles
      DROP COLUMN email;
    ELSE
      ALTER TABLE public.dj_profiles
      RENAME COLUMN email TO public_email;
    END IF;
  END IF;

  -- videographers
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'videographers'
      AND column_name = 'email'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'videographers'
        AND column_name = 'public_email'
    ) THEN
      UPDATE public.videographers
      SET public_email = COALESCE(public_email, email)
      WHERE email IS NOT NULL;

      ALTER TABLE public.videographers
      DROP COLUMN email;
    ELSE
      ALTER TABLE public.videographers
      RENAME COLUMN email TO public_email;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
