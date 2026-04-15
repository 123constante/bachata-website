-- Ensure anonymous (unauthenticated) users can read the venues table.
--
-- The baseline migration declares GRANT SELECT TO anon and a USING(true) RLS
-- policy, but those may not have been applied to the live database if the
-- baseline was never explicitly run. This migration is additive and safe to
-- re-run.

-- ── GRANT ────────────────────────────────────────────────────────────────────
GRANT SELECT ON TABLE public.venues TO anon;
GRANT SELECT ON TABLE public.venues TO authenticated;

-- ── RLS policy ───────────────────────────────────────────────────────────────
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_venues" ON public.venues;
CREATE POLICY "public_read_venues"
  ON public.venues
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allow_service_role_all_venues" ON public.venues;
CREATE POLICY "allow_service_role_all_venues"
  ON public.venues
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
