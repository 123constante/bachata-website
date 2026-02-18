
-- ============================================================
-- 1. DANCERS TABLE: Enable RLS and clean up overly permissive policies
-- ============================================================

ALTER TABLE public.dancers ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies that allow unrestricted access
DROP POLICY IF EXISTS "Admin Full Access" ON public.dancers;
DROP POLICY IF EXISTS "Dancer can view all" ON public.dancers;
DROP POLICY IF EXISTS "Dancers viewable by everyone" ON public.dancers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.dancers;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.dancers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.dancers;
DROP POLICY IF EXISTS "Public Read" ON public.dancers;
DROP POLICY IF EXISTS "Service role full access" ON public.dancers;
DROP POLICY IF EXISTS "Allow public dancer profile creation" ON public.dancers;

-- Add proper public visibility (only public profiles visible to everyone)
CREATE POLICY "Public can view public dancers"
ON public.dancers FOR SELECT
USING (is_public = true);

-- Users can always view their own full profile
CREATE POLICY "Users can view own dancer profile"
ON public.dancers FOR SELECT
USING (auth.uid() = user_id);

-- ============================================================
-- 2. SERVER-SIDE CLAIM RPCs (replaces client-side direct UPDATE)
-- ============================================================

-- Claim dancer profile
CREATE OR REPLACE FUNCTION public.claim_dancer_profile(p_dancer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.dancers
  SET user_id = v_user_id
  WHERE id = p_dancer_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_dancer_profile(uuid) TO authenticated;

-- Claim organiser profile
CREATE OR REPLACE FUNCTION public.claim_organiser_profile(p_organiser_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.organisers
  SET user_id = v_user_id
  WHERE id = p_organiser_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_organiser_profile(uuid) TO authenticated;

-- Claim teacher profile
CREATE OR REPLACE FUNCTION public.claim_teacher_profile(p_teacher_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.teacher_profiles
  SET user_id = v_user_id
  WHERE id = p_teacher_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_teacher_profile(uuid) TO authenticated;

-- Claim DJ profile
CREATE OR REPLACE FUNCTION public.claim_dj_profile(p_dj_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.dj_profiles
  SET user_id = v_user_id
  WHERE id = p_dj_id
    AND user_id IS NULL
  RETURNING id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found or already claimed';
  END IF;

  RETURN v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_dj_profile(uuid) TO authenticated;
