-- ============================================================================
-- Phase 2.8 (2026-05-08): drop 11 duplicate indexes and constraint pairs.
--
-- Each pair has identical (table, columns, access method). For each, the
-- authoritative one (PK > unique constraint > plain unique > plain index) is
-- kept and the duplicate is dropped. No FK references the dropped objects
-- (verified via pg_constraint).
--
-- The 91 advisor-flagged "unused indexes" are NOT dropped in this migration.
-- The vast majority were just created in Phase 2.6 and have idx_scan = 0
-- because they have not seen production traffic yet, not because they are
-- genuinely useless. A future phase should re-run pg_stat_user_indexes after
-- ~30 days of prod traffic and drop only the persistently-cold long tail.
-- ============================================================================

-- 1. venues (entity_id): keep uq_venues_entity_id (UNIQUE constraint).
DROP INDEX IF EXISTS public.idx_venues_entity_id;

-- 2. event_entities (entity_id): keep idx_event_entities_entity_id (canonical naming).
DROP INDEX IF EXISTS public.event_entities_entity_id_idx;

-- 3. event_entities (event_id, role): keep idx_event_entities_event_role.
DROP INDEX IF EXISTS public.event_entities_event_id_role_idx;

-- 4. cities (slug): keep cities_slug_key (UNIQUE constraint, referenced by FKs).
DROP INDEX IF EXISTS public.cities_slug_unique_idx;

-- 5. person_profiles (profile_type, profile_id): keep
--    person_profiles_profile_type_profile_id_key (UNIQUE constraint).
DROP INDEX IF EXISTS public.idx_person_profiles_profile;

-- 6. calendar_occurrences (event_id): keep idx_calendar_occurrences_event_id.
DROP INDEX IF EXISTS public.idx_calendar_occurrences_event;

-- 7-8. calendar_occurrences (event_id, instance_start): keep
--      uq_calendar_occurrences_event_start (UNIQUE constraint). Drop both
--      plain duplicates.
DROP INDEX IF EXISTS public.idx_calendar_occurrences_event_id_start;
DROP INDEX IF EXISTS public.idx_calendar_occurrences_event_start;

-- 9. event_attendees (event_id, dancer_id): keep event_attendees_pkey (PK).
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_unique;

-- 10. event_entities (event_id, entity_id, role): keep event_entities_pkey (PK).
ALTER TABLE public.event_entities DROP CONSTRAINT IF EXISTS event_entities_event_entity_role_uq;

-- 11. event_attendance (occurrence_id, user_id): keep
--     event_attendance_occurrence_id_user_id_key (UNIQUE constraint).
ALTER TABLE public.event_attendance DROP CONSTRAINT IF EXISTS uniq_event_attendance_occurrence_user;
