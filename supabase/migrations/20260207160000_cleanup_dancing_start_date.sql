-- Migration: 20260207160000_cleanup_dancing_start_date.sql
-- Description: Null out invalid dancing_start_date values.

UPDATE public.dancers
SET dancing_start_date = NULL
WHERE dancing_start_date IS NOT NULL
  AND (
    btrim(dancing_start_date::text) = ''
    OR lower(btrim(dancing_start_date::text)) IN ('null', 'undefined', 'invalid date')
    OR (
      dancing_start_date::text !~ '^\d{4}-\d{2}-\d{2}$'
    )
    OR (
      CASE
        WHEN dancing_start_date::text ~ '^\d{4}-\d{2}-\d{2}$'
          THEN to_char(to_date(dancing_start_date::text, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> dancing_start_date::text
        ELSE false
      END
    )
  );
