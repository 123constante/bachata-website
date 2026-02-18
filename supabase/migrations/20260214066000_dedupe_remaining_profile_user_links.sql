-- Resolve duplicate user_id links across profile tables before unique constraints.
-- Keeps one row per user_id (latest by created_at when available, else highest id).
-- If user_id is nullable -> detach duplicates (set user_id = NULL).
-- If user_id is NOT NULL -> delete duplicates (safe fallback for strict schemas).

DO $$
DECLARE
  target_table text;
  has_created_at boolean;
  user_id_nullable boolean;
  affected_count integer;
  order_sql text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'vendors',
    'teacher_profiles',
    'dj_profiles',
    'organisers',
    'videographers'
  ]
  LOOP
    SELECT (c.is_nullable = 'YES')
    INTO user_id_nullable
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = target_table
      AND c.column_name = 'user_id';

    IF user_id_nullable IS NULL THEN
      RAISE NOTICE 'Skipping %.user_id (column not found).', target_table;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = target_table
        AND c.column_name = 'created_at'
    )
    INTO has_created_at;

    IF has_created_at THEN
      order_sql := 't.created_at DESC NULLS LAST, t.id DESC';
    ELSE
      order_sql := 't.id DESC';
    END IF;

    IF user_id_nullable THEN
      EXECUTE format(
        $sql$
          WITH ranked AS (
            SELECT
              t.id,
              ROW_NUMBER() OVER (
                PARTITION BY t.user_id
                ORDER BY %s
              ) AS rn
            FROM public.%I t
            WHERE t.user_id IS NOT NULL
          ),
          to_detach AS (
            SELECT r.id
            FROM ranked r
            WHERE r.rn > 1
          )
          UPDATE public.%I target
          SET user_id = NULL
          WHERE target.id IN (SELECT td.id FROM to_detach td)
        $sql$,
        order_sql,
        target_table,
        target_table
      );

      GET DIAGNOSTICS affected_count = ROW_COUNT;
      RAISE NOTICE 'Detached % duplicate user_id links in table %.', affected_count, target_table;
    ELSE
      EXECUTE format(
        $sql$
          WITH ranked AS (
            SELECT
              t.id,
              ROW_NUMBER() OVER (
                PARTITION BY t.user_id
                ORDER BY %s
              ) AS rn
            FROM public.%I t
            WHERE t.user_id IS NOT NULL
          ),
          to_delete AS (
            SELECT r.id
            FROM ranked r
            WHERE r.rn > 1
          )
          DELETE FROM public.%I target
          USING to_delete td
          WHERE target.id = td.id
        $sql$,
        order_sql,
        target_table,
        target_table
      );

      GET DIAGNOSTICS affected_count = ROW_COUNT;
      RAISE NOTICE 'Deleted % duplicate user_id rows in table % (user_id is NOT NULL).', affected_count, target_table;
    END IF;
  END LOOP;
END
$$;