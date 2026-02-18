-- Enforce one profile row per authenticated user across profile tables.
-- This migration fails safely if duplicates exist, so data is not dropped implicitly.

DO $$
DECLARE
  duplicate_table text;
BEGIN
  SELECT t.table_name
  INTO duplicate_table
  FROM (
    SELECT 'dancers'::text AS table_name
    WHERE EXISTS (
      SELECT 1
      FROM public.dancers
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )

    UNION ALL

    SELECT 'vendors'::text
    WHERE EXISTS (
      SELECT 1
      FROM public.vendors
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )

    UNION ALL

    SELECT 'teacher_profiles'::text
    WHERE EXISTS (
      SELECT 1
      FROM public.teacher_profiles
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )

    UNION ALL

    SELECT 'dj_profiles'::text
    WHERE EXISTS (
      SELECT 1
      FROM public.dj_profiles
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )

    UNION ALL

    SELECT 'organisers'::text
    WHERE EXISTS (
      SELECT 1
      FROM public.organisers
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )

    UNION ALL

    SELECT 'videographers'::text
    WHERE EXISTS (
      SELECT 1
      FROM public.videographers
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    )
  ) AS t
  LIMIT 1;

  IF duplicate_table IS NOT NULL THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'Duplicate user_id links detected in table %s. Resolve duplicates before applying unique profile constraints.',
        duplicate_table
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dancers_user_id
  ON public.dancers(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_user_id
  ON public.vendors(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_profiles_user_id
  ON public.teacher_profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dj_profiles_user_id
  ON public.dj_profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organisers_user_id
  ON public.organisers(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_videographers_user_id
  ON public.videographers(user_id)
  WHERE user_id IS NOT NULL;
