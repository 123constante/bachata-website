-- Phase 7: Canonical city catalog (city-first UX, country as metadata)
-- Idempotent foundation with strict city slug validation helpers.

CREATE TABLE IF NOT EXISTS public.countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  country_code text NOT NULL REFERENCES public.countries(code),
  timezone text NOT NULL DEFAULT 'UTC',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.cities
SET timezone = 'UTC'
WHERE timezone IS NULL;

ALTER TABLE public.cities
  ALTER COLUMN timezone SET DEFAULT 'UTC';

ALTER TABLE public.cities
  ALTER COLUMN timezone SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.city_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (lower(trim(alias))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_cities_name ON public.cities (lower(name));
CREATE INDEX IF NOT EXISTS idx_cities_active ON public.cities (is_active);
CREATE INDEX IF NOT EXISTS idx_city_aliases_normalized ON public.city_aliases (normalized_alias);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read countries" ON public.countries;
CREATE POLICY "Public can read countries"
ON public.countries
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can read active cities" ON public.cities;
CREATE POLICY "Public can read active cities"
ON public.cities
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Public can read city aliases" ON public.city_aliases;
CREATE POLICY "Public can read city aliases"
ON public.city_aliases
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;
CREATE POLICY "Admins can manage countries"
ON public.countries
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage cities" ON public.cities;
CREATE POLICY "Admins can manage cities"
ON public.cities
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage city aliases" ON public.city_aliases;
CREATE POLICY "Admins can manage city aliases"
ON public.city_aliases
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

INSERT INTO public.countries (code, name)
VALUES
  ('GB', 'United Kingdom'),
  ('ES', 'Spain')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.cities (name, slug, country_code, timezone, is_active)
VALUES
  ('London', 'london', 'GB', 'Europe/London', true),
  ('Brighton', 'brighton', 'GB', 'Europe/London', true),
  ('Madrid', 'madrid', 'ES', 'Europe/Madrid', true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  timezone = COALESCE(EXCLUDED.timezone, public.cities.timezone),
  is_active = EXCLUDED.is_active;

INSERT INTO public.city_aliases (city_id, alias)
SELECT c.id, v.alias
FROM public.cities c
JOIN (
  VALUES
    ('london', 'london uk'),
    ('brighton', 'brighton uk'),
    ('madrid', 'madrid spain')
) AS v(slug, alias)
ON c.slug = v.slug
ON CONFLICT (city_id, normalized_alias) DO NOTHING;

CREATE OR REPLACE FUNCTION public.search_cities(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  city_id uuid,
  city_name text,
  city_slug text,
  country_name text,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(COALESCE(p_query, ''))) AS term
  )
  SELECT
    c.id AS city_id,
    c.name AS city_name,
    c.slug AS city_slug,
    co.name AS country_name,
    c.name AS display_name
  FROM public.cities c
  JOIN public.countries co ON co.code = c.country_code
  CROSS JOIN q
  WHERE c.is_active = true
    AND (
      q.term = ''
      OR lower(c.name) LIKE q.term || '%'
      OR EXISTS (
        SELECT 1
        FROM public.city_aliases ca
        WHERE ca.city_id = c.id
          AND ca.normalized_alias LIKE q.term || '%'
      )
    )
  ORDER BY
    CASE WHEN lower(c.name) = q.term THEN 0 ELSE 1 END,
    CASE WHEN lower(c.name) LIKE q.term || '%' THEN 0 ELSE 1 END,
    c.name
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

CREATE OR REPLACE FUNCTION public.is_valid_city_slug(
  p_slug text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cities c
    WHERE c.slug = lower(trim(COALESCE(p_slug, '')))
      AND c.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.search_cities(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_cities(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_cities(text, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_valid_city_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_valid_city_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_city_slug(text) TO service_role;
