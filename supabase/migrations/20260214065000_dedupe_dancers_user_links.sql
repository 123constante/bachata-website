-- Resolve duplicate dancers.user_id links before unique constraints are enforced.
-- Strategy: keep the most recent row per user_id and detach older duplicates by nulling user_id.

DO $$
DECLARE
  dancers_user_id_nullable boolean;
  has_created_at boolean;
  has_photo_updated_at boolean;
  detached_count integer := 0;
  order_sql text;
BEGIN
  SELECT (c.is_nullable = 'YES')
  INTO dancers_user_id_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'dancers'
    AND c.column_name = 'user_id';

  IF dancers_user_id_nullable IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      USING MESSAGE = 'Cannot auto-dedupe dancers.user_id because column is NOT NULL. Make it nullable or manually merge duplicates first.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dancers'
      AND c.column_name = 'created_at'
  )
  INTO has_created_at;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dancers'
      AND c.column_name = 'photo_updated_at'
  )
  INTO has_photo_updated_at;

  IF has_photo_updated_at AND has_created_at THEN
    order_sql := 'COALESCE(d.photo_updated_at, d.created_at) DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id DESC';
  ELSIF has_created_at THEN
    order_sql := 'd.created_at DESC NULLS LAST, d.id DESC';
  ELSE
    order_sql := 'd.id DESC';
  END IF;

  EXECUTE format(
    $sql$
      WITH ranked AS (
        SELECT
          d.id,
          ROW_NUMBER() OVER (
            PARTITION BY d.user_id
            ORDER BY %s
          ) AS rn
        FROM public.dancers d
        WHERE d.user_id IS NOT NULL
      ),
      to_detach AS (
        SELECT r.id
        FROM ranked r
        WHERE r.rn > 1
      )
      UPDATE public.dancers d
      SET user_id = NULL
      WHERE d.id IN (SELECT td.id FROM to_detach td)
    $sql$,
    order_sql
  );

  GET DIAGNOSTICS detached_count = ROW_COUNT;

  RAISE NOTICE 'Detached % duplicate dancers.user_id links.', detached_count;
END
$$;