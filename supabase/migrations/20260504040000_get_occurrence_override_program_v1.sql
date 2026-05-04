-- =============================================================================
-- Migration: 20260504040000_get_occurrence_override_program_v1.sql
-- Date:      2026-05-04
-- Purpose:
--   Expose override_payload.program from a single occurrence to anon callers.
--   Called by the event page when an occurrence_id is in the URL, so the
--   public site can show the per-occurrence teacher/session schedule instead
--   of the parent event's event_program_items.
--
-- Function: get_occurrence_override_program_v1(p_occurrence_id uuid)
--   Returns: jsonb array of session objects, or NULL if no program override.
--
-- IDEMPOTENT: CREATE OR REPLACE. Safe to re-run.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_occurrence_override_program_v1(
    p_occurrence_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        CASE
            WHEN co.override_payload ? 'program'
             AND jsonb_typeof(co.override_payload -> 'program') = 'array'
            THEN co.override_payload -> 'program'
            ELSE NULL
        END
    FROM public.calendar_occurrences co
    WHERE co.id = p_occurrence_id
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_occurrence_override_program_v1(uuid) IS
    'v1 (2026-05-04): Returns override_payload.program for a given occurrence, '
    'or NULL when no program override is set. Used by the public event page to '
    'display the per-occurrence session schedule instead of event_program_items.';

REVOKE ALL     ON FUNCTION public.get_occurrence_override_program_v1(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_occurrence_override_program_v1(uuid)
    TO anon, authenticated, service_role;

COMMIT;
