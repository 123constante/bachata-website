-- ============================================================================
-- Phase 2.7 (2026-05-08): optimise RLS auth.uid()/auth.jwt()/auth.role() calls.
--
-- Background: Postgres re-evaluates volatile functions in RLS predicates
-- once per row. Wrapping in a subselect — `(select auth.uid())` — lets
-- the planner cache the result for the entire query. The supabase advisor
-- flagged 84 policies on this lint.
--
-- Strategy: dynamic DO block. For every policy whose USING or WITH CHECK
-- expression contains a bare `auth.uid()` / `auth.jwt()` / `auth.role()`
-- (i.e. NOT already wrapped in `(select ...)`), drop and recreate it with
-- the wrapping applied. The DO block runs in a single transaction so any
-- failure rolls back the entire batch.
--
-- The regex `\mauth\.(uid|jwt|role)\s*\(\s*\)` matches the bare call;
-- the negative lookahead avoids re-wrapping already-optimised predicates.
-- ============================================================================

DO $rls_optimise$
DECLARE
  rec record;
  new_qual text;
  new_with_check text;
  policy_def text;
  rewrite_count integer := 0;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ '\mauth\.(uid|jwt|role)\s*\(\s*\)'
         AND qual !~ '\(\s*(select|SELECT)\s+auth\.(uid|jwt|role)')
        OR
        (with_check ~ '\mauth\.(uid|jwt|role)\s*\(\s*\)'
         AND with_check !~ '\(\s*(select|SELECT)\s+auth\.(uid|jwt|role)')
      )
  LOOP
    -- Wrap bare auth.<fn>() in (select auth.<fn>()) to cache per-query.
    new_qual := CASE
      WHEN rec.qual IS NULL THEN NULL
      ELSE regexp_replace(rec.qual, '\mauth\.(uid|jwt|role)\s*\(\s*\)', '(select auth.\1())', 'g')
    END;
    new_with_check := CASE
      WHEN rec.with_check IS NULL THEN NULL
      ELSE regexp_replace(rec.with_check, '\mauth\.(uid|jwt|role)\s*\(\s*\)', '(select auth.\1())', 'g')
    END;

    -- Drop the original.
    EXECUTE format('DROP POLICY %I ON %I.%I',
                   rec.policyname, rec.schemaname, rec.tablename);

    -- Rebuild. cmd is one of SELECT/INSERT/UPDATE/DELETE/ALL — all valid
    -- after FOR. roles is text[] (typically `{public}` or `{authenticated}`).
    policy_def := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      rec.policyname,
      rec.schemaname,
      rec.tablename,
      rec.permissive,
      rec.cmd,
      array_to_string(rec.roles, ', ')
    );
    IF new_qual IS NOT NULL THEN
      policy_def := policy_def || ' USING (' || new_qual || ')';
    END IF;
    IF new_with_check IS NOT NULL THEN
      policy_def := policy_def || ' WITH CHECK (' || new_with_check || ')';
    END IF;

    EXECUTE policy_def;
    rewrite_count := rewrite_count + 1;
  END LOOP;

  RAISE NOTICE 'phase2_optimise_rls_auth_uid_v1: rewrote % policies', rewrite_count;
END $rls_optimise$;

notify pgrst, 'reload schema';
