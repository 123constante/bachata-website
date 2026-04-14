-- Recreate public_visible_dancers to expose the columns that
-- CommunitySpotlight, Dancers, and PracticePartners need so they can
-- query this view instead of the raw dancers table (which anon cannot access).
--
-- Columns exposed:
--   id               — dancer profile UUID (used for /dancers/:id routing)
--   first_name       — display name
--   avatar_url       — single photo URL (aliased from photo_url)
--   dance_role       — partner_role value (Leader / Follower / Both)
--   dancing_start_date — used to compute years dancing
--   nationality      — full-name string ("British", "Brazilian" …)
--   city_name        — flat city name string (from cities join)
--   city_country_code — ISO-2 country code for flag display
--
-- Only is_public = true rows are exposed.

CREATE OR REPLACE VIEW public.public_visible_dancers AS
SELECT
  d.id,
  d.first_name,
  d.photo_url            AS avatar_url,
  d.partner_role         AS dance_role,
  d.dancing_start_date,
  d.nationality,
  c.name                 AS city_name,
  c.country_code         AS city_country_code
FROM  public.dancers d
LEFT JOIN public.cities c ON c.id = d.city_id
WHERE d.is_public = true;

GRANT SELECT ON public.public_visible_dancers TO anon;
GRANT SELECT ON public.public_visible_dancers TO authenticated;
GRANT SELECT ON public.public_visible_dancers TO service_role;
