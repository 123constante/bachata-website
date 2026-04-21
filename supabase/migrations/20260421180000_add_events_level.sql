-- =============================================================================
-- Migration: add events.level column
-- Date: 2026-04-21
--
-- Adds a nullable classification column used by the public event page.
-- Allowed values: 'beginner' | 'intermediate' | 'advanced' | 'all_levels'.
-- NULL means "unspecified" (no pill shown on the public page).
--
-- Paired with 20260421180100_admin_save_event_v2_with_level.sql which wires
-- the admin save path to persist this column from the payload.
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN level text
  CHECK (level IN ('beginner','intermediate','advanced','all_levels'));

COMMIT;

NOTIFY pgrst, 'reload schema';
