-- Ensure public_visible_dancers exposes required columns
CREATE OR REPLACE VIEW public.public_visible_dancers AS
SELECT
  d.id,
  d.first_name,
  d.photo_url AS avatar_url,
  d.partner_role AS dancing_role,
  d.dancing_start_date,
  d.nationality,
  d.city_id,
  c.name AS city_name
FROM public.dancers d
LEFT JOIN public.cities c ON c.id = d.city_id;
