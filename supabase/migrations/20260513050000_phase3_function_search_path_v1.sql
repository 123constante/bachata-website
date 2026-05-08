-- ============================================================================
-- Phase 3.2 (2026-05-13): set fixed search_path on all public functions.
--
-- Functions without SET search_path in their configuration inherit the
-- caller's search_path at runtime. An attacker with CREATE privilege in a
-- schema earlier in the path could shadow public objects. The Supabase
-- advisor flagged 90 functions under function_search_path_mutable.
--
-- Strategy: dynamic DO block — for every function/procedure in the public
-- schema that lacks a search_path config, run:
--   ALTER FUNCTION ... SET search_path = public, pg_catalog, pg_temp
-- Aggregate (prokind='a') and window (prokind='w') definitions are excluded
-- as they cannot be altered this way (their support functions are caught by
-- prokind='f').
--
-- Idempotent: setting search_path to the same value is a no-op on re-run.
-- ============================================================================

DO $search_path_fix$
DECLARE
  rec        record;
  alter_sql  text;
  fix_count  integer := 0;
BEGIN
  FOR rec IN
    SELECT n.nspname                                   AS schema_name,
           p.proname                                   AS func_name,
           pg_get_function_identity_arguments(p.oid)  AS func_args
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.prokind IN ('f', 'p')
      -- Exclude functions installed by extensions (unaccent, pg_trgm, etc.)
      AND  NOT EXISTS (
             SELECT 1 FROM pg_depend d
             WHERE d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
           )
      AND  (
             p.proconfig IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM unnest(p.proconfig) cfg
               WHERE cfg LIKE 'search_path=%'
             )
           )
  LOOP
    alter_sql := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_catalog, pg_temp',
      rec.schema_name, rec.func_name, rec.func_args
    );
    EXECUTE alter_sql;
    fix_count := fix_count + 1;
  END LOOP;

  RAISE NOTICE 'phase3_function_search_path_v1: set search_path on % functions/procedures',
               fix_count;
END $search_path_fix$;

notify pgrst, 'reload schema';
