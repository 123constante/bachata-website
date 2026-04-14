-- Phase 9: Enforce canonical city_id requirement on core tables
-- Safe rollout: aborts with clear error if legacy null city_id rows still exist.

DO $$
DECLARE
  v_table_name text;
  v_null_count bigint;
  v_table_exists boolean;
  v_column_exists boolean;
  v_has_city boolean;
  v_has_city_slug boolean;
  v_unresolved_examples text;
  v_tables text[] := ARRAY[
    'events',
    'venues',
    'entities',
    'organisers',
    'teacher_profiles',
    'dj_profiles',
    'dancers',
    'vendors',
    'videographers'
  ];
BEGIN
  FOREACH v_table_name IN ARRAY v_tables LOOP
    SELECT to_regclass(format('public.%I', v_table_name)) IS NOT NULL
    INTO v_table_exists;

    IF NOT v_table_exists THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = v_table_name
        AND c.column_name = 'city_id'
    )
    INTO v_column_exists;

    IF NOT v_column_exists THEN
      CONTINUE;
    END IF;

    -- Best-effort backfill before enforcing NOT NULL
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = v_table_name
        AND c.column_name = 'city'
    )
    INTO v_has_city;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = v_table_name
        AND c.column_name = 'city_slug'
    )
    INTO v_has_city_slug;

    IF v_has_city AND v_has_city_slug THEN
      EXECUTE format(
        'UPDATE public.%I
         SET city_id = coalesce(
           public.resolve_city_id(city, city_slug),
           public.resolve_city_id(city, NULL),
           public.resolve_city_id(NULL, city_slug)
         )
         WHERE city_id IS NULL',
        v_table_name
      );
    ELSIF v_has_city THEN
      EXECUTE format(
        'UPDATE public.%I
         SET city_id = public.resolve_city_id(city, NULL)
         WHERE city_id IS NULL',
        v_table_name
      );
    ELSIF v_has_city_slug THEN
      EXECUTE format(
        'UPDATE public.%I
         SET city_id = public.resolve_city_id(NULL, city_slug)
         WHERE city_id IS NULL',
        v_table_name
      );
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE city_id IS NULL', v_table_name)
    INTO v_null_count;

    IF v_null_count > 0 THEN
      EXECUTE format(
        'SELECT string_agg(id::text, '', '' ORDER BY id)
         FROM (
           SELECT id
           FROM public.%I
           WHERE city_id IS NULL
           ORDER BY id
           LIMIT 10
         ) x',
        v_table_name
      )
      INTO v_unresolved_examples;

      RAISE EXCEPTION USING
        MESSAGE = format('Cannot enforce NOT NULL on public.%I.city_id: %s rows still have NULL city_id', v_table_name, v_null_count),
        HINT = format(
          'Backfill unresolved rows in public.%I, then rerun migration. Example IDs: %s',
          v_table_name,
          coalesce(v_unresolved_examples, '[none]')
        );
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN city_id SET NOT NULL', v_table_name);
  END LOOP;
END
$$;