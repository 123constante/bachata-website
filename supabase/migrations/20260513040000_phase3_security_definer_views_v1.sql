-- ============================================================================
-- Phase 3.1 (2026-05-13): switch 5 SECURITY DEFINER views to security_invoker.
--
-- SECURITY DEFINER views execute with the owner's privileges, bypassing RLS
-- on every underlying table. Postgres 15+ supports security_invoker = true,
-- which makes the view respect the calling role's RLS instead.
--
-- Per-view safety analysis:
--
-- dj_profiles, teacher_profiles
--   Stub views (SELECT NULL ... WHERE false). Never return rows. Trivially safe.
--
-- member_profiles_directory
--   Reads: member_profiles, profiles, entities, cities.
--   Has WHERE is_admin() guard — non-admins already get zero rows.
--   Under security_invoker: admin callers satisfy member_profiles_admin_select
--   (authenticated + is_admin()), profiles "Public profiles are viewable by
--   everyone" (true), entities "Entities are publicly viewable" (true),
--   cities "Public read" (true). Behaviour unchanged for all callers.
--
-- event_profile_links
--   Reads: event_profile_connections.
--   Under security_definer: RLS is bypassed, so dancer-type links are exposed
--   to anon — a subtle privacy leak. The table policy "Public can read
--   non-dancer links" (public, person_type <> 'dancer' OR auth.uid() IS NOT
--   NULL) is the correct gate. Flipping to security_invoker closes the leak:
--   anon now sees only non-dancer links; authenticated sees all. Improvement.
--
-- organiser_admin_dashboard_v2
--   Reads: entities, cities, organiser_team_members, member_profiles.
--   Has WHERE is_admin() guard — non-admins get zero rows.
--   Under security_invoker: entities/cities/organiser_team_members are
--   publicly readable (true policies); member_profiles accessible via
--   member_profiles_admin_select for admin callers. Behaviour unchanged.
-- ============================================================================

ALTER VIEW public.dj_profiles              SET (security_invoker = true);
ALTER VIEW public.teacher_profiles         SET (security_invoker = true);
ALTER VIEW public.member_profiles_directory SET (security_invoker = true);
ALTER VIEW public.event_profile_links      SET (security_invoker = true);
ALTER VIEW public.organiser_admin_dashboard_v2 SET (security_invoker = true);

notify pgrst, 'reload schema';
