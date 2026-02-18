-- Phase 5: Human identity model (multi-role + multi-account support)
-- Goal: A single real person can own many role profiles and link multiple auth accounts.
-- This is additive and keeps existing entities/event_profile_connections behavior intact.

CREATE TABLE IF NOT EXISTS public.person_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.person_account_links (
  person_id uuid NOT NULL REFERENCES public.person_identities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_status text NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('pending', 'verified', 'revoked')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (person_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_primary_account
  ON public.person_account_links (person_id)
  WHERE is_primary = true AND verification_status = 'verified';

CREATE INDEX IF NOT EXISTS idx_person_account_links_user
  ON public.person_account_links (user_id, verification_status);

CREATE TABLE IF NOT EXISTS public.person_profiles (
  person_id uuid NOT NULL REFERENCES public.person_identities(id) ON DELETE CASCADE,
  profile_type text NOT NULL
    CHECK (profile_type IN ('dancer', 'organiser', 'teacher', 'dj', 'vendor', 'videographer')),
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (person_id, profile_type, profile_id),
  UNIQUE (profile_type, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_person_profiles_profile
  ON public.person_profiles (profile_type, profile_id);

-- Enable RLS
ALTER TABLE public.person_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_profiles ENABLE ROW LEVEL SECURITY;

-- Admin helper
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO service_role;

-- Access helper: can the current account manage this role profile?
-- Supports both new model (person links) and legacy entity claim model.
CREATE OR REPLACE FUNCTION public.can_current_user_manage_profile(
  p_profile_type text,
  p_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1
      FROM public.person_profiles pp
      JOIN public.person_account_links pal
        ON pal.person_id = pp.person_id
      WHERE pp.profile_type = p_profile_type
        AND pp.profile_id = p_profile_id
        AND pal.user_id = auth.uid()
        AND pal.verification_status = 'verified'
    )
    OR (
      p_profile_type IN ('organiser', 'teacher', 'dj')
      AND EXISTS (
        SELECT 1
        FROM public.entities e
        WHERE e.id = p_profile_id
          AND e.type = p_profile_type
          AND e.claimed_by = auth.uid()
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_current_user_manage_profile(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_manage_profile(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_current_user_manage_profile(text, uuid) TO service_role;

-- RLS: person_identities
DROP POLICY IF EXISTS "Linked users can read person identities" ON public.person_identities;
CREATE POLICY "Linked users can read person identities"
ON public.person_identities
FOR SELECT
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_identities.id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "Authenticated can create person identities" ON public.person_identities;
CREATE POLICY "Authenticated can create person identities"
ON public.person_identities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Linked users can update person identities" ON public.person_identities;
CREATE POLICY "Linked users can update person identities"
ON public.person_identities
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_identities.id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
)
WITH CHECK (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_identities.id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
);

-- RLS: person_account_links
DROP POLICY IF EXISTS "Users can read own account links" ON public.person_account_links;
CREATE POLICY "Users can read own account links"
ON public.person_account_links
FOR SELECT
USING (
  public.is_current_user_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links me
    WHERE me.person_id = person_account_links.person_id
      AND me.user_id = auth.uid()
      AND me.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "Linked users can add account links" ON public.person_account_links;
CREATE POLICY "Linked users can add account links"
ON public.person_account_links
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links me
    WHERE me.person_id = person_account_links.person_id
      AND me.user_id = auth.uid()
      AND me.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "Linked users can update account links" ON public.person_account_links;
CREATE POLICY "Linked users can update account links"
ON public.person_account_links
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links me
    WHERE me.person_id = person_account_links.person_id
      AND me.user_id = auth.uid()
      AND me.verification_status = 'verified'
  )
)
WITH CHECK (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links me
    WHERE me.person_id = person_account_links.person_id
      AND me.user_id = auth.uid()
      AND me.verification_status = 'verified'
  )
);

-- RLS: person_profiles
DROP POLICY IF EXISTS "Public can read person profile links" ON public.person_profiles;
CREATE POLICY "Public can read person profile links"
ON public.person_profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Linked users can insert person profile links" ON public.person_profiles;
CREATE POLICY "Linked users can insert person profile links"
ON public.person_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_profiles.person_id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "Linked users can update person profile links" ON public.person_profiles;
CREATE POLICY "Linked users can update person profile links"
ON public.person_profiles
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_profiles.person_id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
)
WITH CHECK (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_profiles.person_id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
);

DROP POLICY IF EXISTS "Linked users can delete person profile links" ON public.person_profiles;
CREATE POLICY "Linked users can delete person profile links"
ON public.person_profiles
FOR DELETE
TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1 FROM public.person_account_links pal
    WHERE pal.person_id = person_profiles.person_id
      AND pal.user_id = auth.uid()
      AND pal.verification_status = 'verified'
  )
);

-- Bootstrap from existing claimed entities (organiser/teacher/dj)
WITH claimed_accounts AS (
  SELECT DISTINCT e.claimed_by AS user_id
  FROM public.entities e
  WHERE e.claimed_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.person_account_links pal
      WHERE pal.user_id = e.claimed_by
        AND pal.verification_status = 'verified'
    )
),
new_people AS (
  INSERT INTO public.person_identities (display_name, created_by)
  SELECT
    COALESCE(
      (
        SELECT e2.name
        FROM public.entities e2
        WHERE e2.claimed_by = ca.user_id
        ORDER BY e2.created_at ASC
        LIMIT 1
      ),
      'Member'
    ) AS display_name,
    ca.user_id AS created_by
  FROM claimed_accounts ca
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.person_identities pi
    WHERE pi.created_by = ca.user_id
  )
  RETURNING id, created_by
)
INSERT INTO public.person_account_links (
  person_id,
  user_id,
  verification_status,
  is_primary,
  created_by
)
SELECT
  np.id,
  np.created_by,
  'verified',
  true,
  np.created_by
FROM new_people np;

INSERT INTO public.person_account_links (
  person_id,
  user_id,
  verification_status,
  is_primary,
  created_by
)
SELECT
  pi.id,
  pi.created_by,
  'verified',
  true,
  pi.created_by
FROM public.person_identities pi
WHERE pi.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.person_account_links pal
    WHERE pal.person_id = pi.id
      AND pal.user_id = pi.created_by
  );

INSERT INTO public.person_profiles (
  person_id,
  profile_type,
  profile_id,
  created_by
)
SELECT
  pal.person_id,
  e.type,
  e.id,
  e.claimed_by
FROM public.entities e
JOIN public.person_account_links pal
  ON pal.user_id = e.claimed_by
WHERE e.claimed_by IS NOT NULL
  AND e.type IN ('organiser', 'teacher', 'dj')
ON CONFLICT (profile_type, profile_id) DO NOTHING;
