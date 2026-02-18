-- Phase 8: Add canonical city_id to core tables (city-first, backward compatible)
-- Keeps existing city text / city_slug fields while introducing canonical FK.

CREATE OR REPLACE FUNCTION public.resolve_city_id(
  p_city text DEFAULT NULL,
  p_city_slug text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.cities c
  WHERE c.is_active = true
    AND (
      (p_city_slug IS NOT NULL AND lower(trim(p_city_slug)) <> '' AND c.slug = lower(trim(p_city_slug)))
      OR (
        p_city IS NOT NULL
        AND lower(trim(p_city)) <> ''
        AND (
          lower(c.name) = lower(trim(p_city))
          OR EXISTS (
            SELECT 1
            FROM public.city_aliases ca
            WHERE ca.city_id = c.id
              AND ca.normalized_alias = lower(trim(p_city))
          )
        )
      )
    )
  ORDER BY
    CASE WHEN p_city_slug IS NOT NULL AND lower(trim(p_city_slug)) <> '' AND c.slug = lower(trim(p_city_slug)) THEN 0 ELSE 1 END,
    c.name
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_city_id(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_city_id(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_city_id(text, text) TO service_role;

-- Add city_id columns
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.venues ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.entities ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.organisers ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.teacher_profiles ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.dj_profiles ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.dancers ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.vendors ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE IF EXISTS public.videographers ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);

CREATE INDEX IF NOT EXISTS idx_events_city_id ON public.events(city_id);
CREATE INDEX IF NOT EXISTS idx_venues_city_id ON public.venues(city_id);
CREATE INDEX IF NOT EXISTS idx_entities_city_id ON public.entities(city_id);
CREATE INDEX IF NOT EXISTS idx_organisers_city_id ON public.organisers(city_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_city_id ON public.teacher_profiles(city_id);
CREATE INDEX IF NOT EXISTS idx_dj_profiles_city_id ON public.dj_profiles(city_id);
CREATE INDEX IF NOT EXISTS idx_dancers_city_id ON public.dancers(city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_city_id ON public.vendors(city_id);
CREATE INDEX IF NOT EXISTS idx_videographers_city_id ON public.videographers(city_id);

-- Backfill city_id from existing city_slug/city text
-- Events are updated row-by-row to avoid hard failure when legacy rows violate
-- unrelated constraints (e.g. historical time-order data issues).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id, e.city_slug
    FROM public.events e
    WHERE e.city_id IS NULL
      AND e.city_slug IS NOT NULL
      AND trim(e.city_slug) <> ''
  LOOP
    BEGIN
      UPDATE public.events e
      SET city_id = public.resolve_city_id(NULL, r.city_slug)
      WHERE e.id = r.id;
    EXCEPTION
      WHEN check_violation THEN
        RAISE NOTICE 'Skipping events.id=% during city backfill due to existing constraint violation', r.id;
    END;
  END LOOP;
END
$$;

UPDATE public.venues v
SET city_id = public.resolve_city_id(v.city, NULL)
WHERE v.city_id IS NULL
  AND v.city IS NOT NULL
  AND trim(v.city) <> '';

UPDATE public.entities e
SET city_id = public.resolve_city_id(e.city, NULL)
WHERE e.city_id IS NULL
  AND e.city IS NOT NULL
  AND trim(e.city) <> '';

UPDATE public.organisers o
SET city_id = public.resolve_city_id(o.city, NULL)
WHERE o.city_id IS NULL
  AND o.city IS NOT NULL
  AND trim(o.city) <> '';

UPDATE public.teacher_profiles t
SET city_id = public.resolve_city_id(t.city, NULL)
WHERE t.city_id IS NULL
  AND t.city IS NOT NULL
  AND trim(t.city) <> '';

UPDATE public.dj_profiles d
SET city_id = public.resolve_city_id(d.city, NULL)
WHERE d.city_id IS NULL
  AND d.city IS NOT NULL
  AND trim(d.city) <> '';

UPDATE public.dancers d
SET city_id = public.resolve_city_id(d.city, NULL)
WHERE d.city_id IS NULL
  AND d.city IS NOT NULL
  AND trim(d.city) <> '';

UPDATE public.vendors v
SET city_id = public.resolve_city_id(v.city, NULL)
WHERE v.city_id IS NULL
  AND v.city IS NOT NULL
  AND trim(v.city) <> '';

UPDATE public.videographers v
SET city_id = public.resolve_city_id(v.city, NULL)
WHERE v.city_id IS NULL
  AND v.city IS NOT NULL
  AND trim(v.city) <> '';

-- Trigger functions to keep city text/slug and city_id aligned.
CREATE OR REPLACE FUNCTION public.sync_city_text_to_city_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.city IS NOT DISTINCT FROM OLD.city
    AND NEW.city_id IS NOT DISTINCT FROM OLD.city_id THEN
    RETURN NEW;
  END IF;

  IF NEW.city_id IS NULL THEN
    v_city_id := public.resolve_city_id(NEW.city, NULL);
    NEW.city_id := v_city_id;
  END IF;

  IF NEW.city_id IS NULL THEN
    RAISE EXCEPTION 'City is required and must match canonical city list';
  END IF;

  IF NEW.city IS NULL OR trim(NEW.city) = '' THEN
    SELECT c.name INTO NEW.city
    FROM public.cities c
    WHERE c.id = NEW.city_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_city_to_city_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.city_slug IS NOT DISTINCT FROM OLD.city_slug
    AND NEW.city_id IS NOT DISTINCT FROM OLD.city_id THEN
    RETURN NEW;
  END IF;

  IF NEW.city_id IS NULL THEN
    v_city_id := public.resolve_city_id(NULL, NEW.city_slug);
    NEW.city_id := v_city_id;
  END IF;

  IF NEW.city_id IS NULL THEN
    RAISE EXCEPTION 'Valid city is required (city_slug must match canonical city list)';
  END IF;

  IF NEW.city_slug IS NULL OR trim(NEW.city_slug) = '' THEN
    SELECT c.slug INTO NEW.city_slug
    FROM public.cities c
    WHERE c.id = NEW.city_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_sync_city ON public.events;
CREATE TRIGGER trg_events_sync_city
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_event_city_to_city_id();

DROP TRIGGER IF EXISTS trg_venues_sync_city ON public.venues;
CREATE TRIGGER trg_venues_sync_city
BEFORE INSERT OR UPDATE ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_entities_sync_city ON public.entities;
CREATE TRIGGER trg_entities_sync_city
BEFORE INSERT OR UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_organisers_sync_city ON public.organisers;
CREATE TRIGGER trg_organisers_sync_city
BEFORE INSERT OR UPDATE ON public.organisers
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_teacher_profiles_sync_city ON public.teacher_profiles;
CREATE TRIGGER trg_teacher_profiles_sync_city
BEFORE INSERT OR UPDATE ON public.teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_dj_profiles_sync_city ON public.dj_profiles;
CREATE TRIGGER trg_dj_profiles_sync_city
BEFORE INSERT OR UPDATE ON public.dj_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_dancers_sync_city ON public.dancers;
CREATE TRIGGER trg_dancers_sync_city
BEFORE INSERT OR UPDATE ON public.dancers
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_vendors_sync_city ON public.vendors;
CREATE TRIGGER trg_vendors_sync_city
BEFORE INSERT OR UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();

DROP TRIGGER IF EXISTS trg_videographers_sync_city ON public.videographers;
CREATE TRIGGER trg_videographers_sync_city
BEFORE INSERT OR UPDATE ON public.videographers
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_text_to_city_id();
