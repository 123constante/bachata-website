-- ============================================================================
-- Phase 2.9 (2026-05-08): consolidate clearly-duplicate permissive policies.
--
-- Postgres OR-evaluates permissive policies per role/cmd, so multiple
-- equivalent policies cost planner time without changing semantics. This
-- migration drops only policies whose qual + with_check are functionally
-- identical to a sibling policy on the same (table, cmd, role) and that
-- preserve current behaviour exactly.
--
-- Out of scope (deferred to a future phase): consolidating policies on
-- entities, events, event_program_items, venues. These have non-trivial
-- role/predicate variations where consolidation would change semantics.
-- The advisor will continue to flag them; that's fine.
-- ============================================================================

-- ─── cities (SELECT, public) ───────────────────────────────────────────────
-- Three permissive SELECTs ANY of which evaluate true → effective predicate
-- is `true`. Keep "Public read" (the simplest `true`); drop the other two.
DROP POLICY IF EXISTS "Allow public read cities" ON public.cities;
DROP POLICY IF EXISTS "Public can read active cities" ON public.cities;

-- ─── countries (SELECT, public) ────────────────────────────────────────────
-- Two identical `true` policies. Keep canonical-named countries_public_read.
DROP POLICY IF EXISTS "Public can read countries" ON public.countries;

-- ─── city_aliases (SELECT, public) ─────────────────────────────────────────
-- Two identical `true` policies. Keep city_aliases_public_read.
DROP POLICY IF EXISTS "Public can read city aliases" ON public.city_aliases;

-- ─── profiles (UPDATE, public) ─────────────────────────────────────────────
-- Two policies with the same `id = auth.uid()` predicate. The kept one has
-- both USING and WITH CHECK; the dropped one has only USING (which would
-- have allowed UPDATEs to clobber id had the predicates ever diverged).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- ─── profile_claims (SELECT) ───────────────────────────────────────────────
-- "Admin can read profile_claims" (role=authenticated) is fully covered by
-- "Admins can view all claims" (role=public, same predicate). Drop the
-- narrower-role duplicate.
DROP POLICY IF EXISTS "Admin can read profile_claims" ON public.profile_claims;

-- ─── member_profiles (SELECT/UPDATE/INSERT, public) ───────────────────────
-- Three pairs of own/self duplicates with reversed predicate ordering.
-- Keep the canonical with-WITH-CHECK variants where applicable.
DROP POLICY IF EXISTS member_profiles_select_self ON public.member_profiles;
-- Keep _update_self (has WITH CHECK), drop _update_own (USING only).
DROP POLICY IF EXISTS member_profiles_update_own ON public.member_profiles;
-- _insert_own (role=authenticated) is fully covered by _insert_self (role=public).
DROP POLICY IF EXISTS member_profiles_insert_own ON public.member_profiles;

notify pgrst, 'reload schema';
