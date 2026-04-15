-- Fix: Ensure all public profile tables allow anonymous (unauthenticated) read access.
--
-- Root cause: The live DB's "Enable read access for all users" policy on
-- teacher_profiles and dj_profiles may have been altered to TO authenticated
-- (or dropped) after a manual policy edit via the dashboard.  These explicit
-- TO anon policies are additive (PERMISSIVE / OR logic) and are safe to create
-- even if a broader policy already exists.
--
-- Also covers dancer_profiles, vendors, and videographers for completeness.

-- ── teacher_profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_anon_read_teacher_profiles" ON public.teacher_profiles;
CREATE POLICY "public_anon_read_teacher_profiles"
  ON public.teacher_profiles
  FOR SELECT
  TO anon
  USING (true);

-- ── dj_profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_anon_read_dj_profiles" ON public.dj_profiles;
CREATE POLICY "public_anon_read_dj_profiles"
  ON public.dj_profiles
  FOR SELECT
  TO anon
  USING (true);

-- ── dancer_profiles ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_anon_read_dancer_profiles" ON public.dancer_profiles;
CREATE POLICY "public_anon_read_dancer_profiles"
  ON public.dancer_profiles
  FOR SELECT
  TO anon
  USING (true);

-- ── vendors ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_anon_read_vendors" ON public.vendors;
CREATE POLICY "public_anon_read_vendors"
  ON public.vendors
  FOR SELECT
  TO anon
  USING (true);

-- ── videographers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_anon_read_videographers" ON public.videographers;
CREATE POLICY "public_anon_read_videographers"
  ON public.videographers
  FOR SELECT
  TO anon
  USING (true);

-- Reload PostgREST schema cache so the new policies take effect immediately
-- (Supabase runs this automatically on migration apply; included for manual runs)
NOTIFY pgrst, 'reload schema';
