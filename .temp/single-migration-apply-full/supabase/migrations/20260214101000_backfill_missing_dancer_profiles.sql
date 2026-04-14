-- Backfill foundational dancer profiles for accounts missing one.

WITH candidate_users AS (
  SELECT DISTINCT u.id AS user_id,
    u.email,
    u.raw_user_meta_data ->> 'first_name' AS first_name,
    u.raw_user_meta_data ->> 'surname' AS surname,
    COALESCE(
      u.raw_user_meta_data ->> 'city',
      v.city,
      o.city,
      t.city,
      d.city,
      vg.city
    ) AS city
  FROM auth.users u
  LEFT JOIN public.vendors v ON v.user_id = u.id
  LEFT JOIN public.organisers o ON o.user_id = u.id
  LEFT JOIN public.teacher_profiles t ON t.user_id = u.id
  LEFT JOIN public.dj_profiles d ON d.user_id = u.id
  LEFT JOIN public.videographers vg ON vg.user_id = u.id
  WHERE u.id IS NOT NULL
),
missing_users AS (
  SELECT c.*
  FROM candidate_users c
  LEFT JOIN public.dancers da ON da.user_id = c.user_id
  WHERE da.id IS NULL
),
resolved_missing_users AS (
  SELECT
    m.user_id,
    m.email,
    m.first_name,
    m.surname,
    city_ref.name AS canonical_city
  FROM missing_users m
  JOIN public.cities city_ref
    ON city_ref.id = public.resolve_city_id(m.city, NULL)
)
INSERT INTO public.dancers (
  user_id,
  first_name,
  surname,
  email,
  city,
  verified,
  is_public,
  hide_surname
)
SELECT
  m.user_id,
  COALESCE(
    NULLIF(trim(m.first_name), ''),
    NULLIF(trim(split_part(COALESCE(m.email, ''), '@', 1)), ''),
    'Member'
  ) AS first_name,
  NULLIF(trim(m.surname), '') AS surname,
  NULLIF(trim(m.email), '') AS email,
  m.canonical_city AS city,
  false,
  false,
  false
FROM resolved_missing_users m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dancers da
  WHERE da.user_id = m.user_id
);
