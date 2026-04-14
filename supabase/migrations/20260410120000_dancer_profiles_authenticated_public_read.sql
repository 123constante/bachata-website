-- Allow authenticated users to read all dancer profiles.
--
-- The anon role already has "dancer_profiles_public_read" (USING true), which
-- lets the public /dancers directory work for logged-out visitors.  But the
-- existing "dancer_profiles_select_own" policy for the authenticated role only
-- returns the caller's own row (WHERE id = auth.uid()), so logged-in users see
-- at most one dancer instead of the full directory.
--
-- This policy mirrors dancer_profiles_public_read for the authenticated role so
-- the directory renders correctly for everyone.

CREATE POLICY "dancer_profiles_authenticated_public_read"
  ON "public"."dancer_profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);
