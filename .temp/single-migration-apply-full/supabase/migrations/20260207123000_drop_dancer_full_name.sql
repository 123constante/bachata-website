-- Migration: 20260207123000_drop_dancer_full_name.sql
-- Description: Split full_name into first_name/surname and then drop full_name.

BEGIN;

-- 1. Create new columns
ALTER TABLE public.dancers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- 2. Backfill from full_name before dropping it
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dancers' AND column_name = 'full_name') THEN
    
    WITH normalized AS (
      SELECT
        id,
        trim(coalesce(first_name, '')) AS existing_first,
        trim(coalesce(surname, '')) AS existing_surname,
        trim(coalesce(full_name, '')) AS safe_full
      FROM public.dancers
    ),
    split AS (
      SELECT
        id,
        CASE
          WHEN existing_first <> '' THEN existing_first
          WHEN safe_full <> '' THEN split_part(safe_full, ' ', 1)
          ELSE 'Dancer' -- Default if empty
        END AS new_first_name,
        CASE
          WHEN existing_surname <> '' THEN existing_surname
          WHEN safe_full <> '' AND position(' ' IN safe_full) > 0 THEN nullif(trim(regexp_replace(safe_full, '^\s*[^\s]+\s*', '')), '') -- Everything after first space
          ELSE ''
        END AS new_surname
      FROM normalized
    )
    UPDATE public.dancers d
    SET
      first_name = split.new_first_name,
      surname = nullif(split.new_surname, '')
    FROM split
    WHERE d.id = split.id AND (d.first_name IS NULL OR d.first_name = '');
    
  END IF;
END $$;

-- 3. Drop full_name
ALTER TABLE public.dancers DROP COLUMN IF EXISTS full_name;

-- 4. Constraints
DO $$
BEGIN
  -- Only set NOT NULL if we successfully populated it
  IF EXISTS (SELECT 1 FROM public.dancers WHERE first_name IS NOT NULL) THEN
    ALTER TABLE public.dancers ALTER COLUMN first_name SET NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.dancers.first_name IS 'Primary first name for Dancer profiles';
COMMENT ON COLUMN public.dancers.surname IS 'Optional surname for Dancer profiles (can be hidden)';

COMMIT;
