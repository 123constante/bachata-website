-- ============================================================================
-- Phase 3.8 (2026-05-13): drop 5 provably-redundant permissive policies.
--
-- Postgres OR-evaluates permissive policies per (table, cmd, role). A policy
-- is redundant when every row it permits is already permitted by a sibling
-- policy on the same (table, cmd, role), so removing it cannot change
-- visible row sets.
--
-- organiser_team_members (SELECT):
--   "public_read_organiser_team" (role=public, qual=true) already allows
--   every caller to read every row. Three authenticated-role SELECT policies
--   are therefore fully subsumed for authenticated users:
--     - "Admin read"                         qual = is_admin()
--     - "organiser_team_members_admin_select" qual = is_admin()
--     - "organiser_team_members_auth_read"   qual = is_admin() OR member=uid OR owner=uid
--   All three are covered by the public true policy. Drop all three.
--
-- admin_super_users (SELECT):
--   "admin_super_users_read" (authenticated):
--     qual = user_id = auth.uid() OR is_super_admin(auth.uid())
--   "super_users_self_read" (authenticated):
--     qual = user_id = auth.uid()
--   The self_read predicate is a strict subset of admin_super_users_read.
--   Drop super_users_self_read.
--
-- person_roles (SELECT):
--   "person_roles_public_select" (role=public, qual=true) allows everyone
--   to read all rows. "person_roles_self_select" (authenticated,
--   qual = person_id = auth.uid()) is fully subsumed. Drop it.
-- ============================================================================

-- organiser_team_members: drop 3 authenticated SELECT policies
-- subsumed by public_read_organiser_team (public, true)
DROP POLICY IF EXISTS "Admin read"                          ON public.organiser_team_members;
DROP POLICY IF EXISTS organiser_team_members_admin_select   ON public.organiser_team_members;
DROP POLICY IF EXISTS organiser_team_members_auth_read      ON public.organiser_team_members;

-- admin_super_users: drop self_read, subsumed by admin_super_users_read
DROP POLICY IF EXISTS super_users_self_read ON public.admin_super_users;

-- person_roles: drop self_select, subsumed by person_roles_public_select (true)
DROP POLICY IF EXISTS person_roles_self_select ON public.person_roles;

notify pgrst, 'reload schema';
