-- ============================================================================
-- Phase 3.6+3.7 (2026-05-13): drop 1 true-duplicate + 2 archive-table indexes.
--
-- Scope is deliberately narrow. pg_stat_user_indexes shows 127 indexes with
-- idx_scan = 0, but the vast majority fall into one of three categories:
--   (a) Phase 2.6 FK indexes (43) — just created, no traffic yet.
--   (b) Indexes on tables with few/no rows — stats never triggered.
--   (c) No creation-timestamp in pg_stat_user_indexes, so "cold since last
--       stats reset" cannot be distinguished from "genuinely unused for 30+d".
-- Only the items below are safe to drop without that disambiguation:
--
-- 1. idx_cities_name (true duplicate):
--    indexdef = "CREATE INDEX ... USING btree (lower(name))"
--    Identical to idx_cities_lower_name. Confirmed by comparing pg_indexes.
--    Keep idx_cities_lower_name (more descriptive name). This resolves the
--    remaining duplicate_index advisor finding on cities.
--
-- 2. idx_dancers_city_id, idx_dancers_country_code (archive table):
--    dancers_archive_april2026 is a frozen snapshot taken during the
--    April 2026 cleanup. It is never queried in production paths; all live
--    data lives in dancer_profiles. These plain indexes add write overhead
--    on the backup table and will never be scanned.
--
-- Broader unused-index cleanup deferred to Phase 4 after ~30 days of
-- production traffic on the Phase 2.6 FK indexes. Re-run pg_stat_user_indexes
-- at that point and cross-reference with pg_stat_reset_shared() to confirm
-- the stats window is representative.
-- ============================================================================

-- 1. Cities duplicate (keep idx_cities_lower_name, drop the alias)
DROP INDEX IF EXISTS public.idx_cities_name;

-- 2. Frozen archive table — these will never see a sequential or index scan
DROP INDEX IF EXISTS public.idx_dancers_city_id;
DROP INDEX IF EXISTS public.idx_dancers_country_code;
