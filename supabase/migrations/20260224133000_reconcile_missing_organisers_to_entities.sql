-- Reconciliation backfill: organisers -> entities(type='organiser')
-- Idempotent and safe to run multiple times.
-- Inserts only organisers not already represented as organiser entities.

INSERT INTO public.entities (
  id,
  type,
  name,
  avatar_url,
  bio,
  city,
  claimed_by,
  created_at,
  socials
)
SELECT
  o.id,
  'organiser',
  o.name,
  CASE
    WHEN jsonb_typeof(to_jsonb(o.photo_url)) = 'array' THEN o.photo_url->>0
    ELSE NULL
  END AS avatar_url,
  o.bio,
  o.city,
  o.user_id AS claimed_by,
  COALESCE(o.created_at, now()) AS created_at,
  jsonb_strip_nulls(
    jsonb_build_object(
      'instagram', NULLIF(trim(o.instagram), ''),
      'website', NULLIF(trim(o.website), ''),
      'email', NULLIF(trim(o.public_email), '')
    )
  ) AS socials
FROM public.organisers o
LEFT JOIN public.entities e
  ON e.id = o.id
  AND e.type = 'organiser'
WHERE e.id IS NULL
ON CONFLICT (id) DO NOTHING;
