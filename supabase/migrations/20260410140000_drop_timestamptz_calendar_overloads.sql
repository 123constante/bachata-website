-- Fix PGRST203: Drop stale timestamptz overloads of get_calendar_events.
--
-- Root cause: Baseline migration 20260405200000 re-introduced timestamptz
-- overloads that conflict with the canonical text-param version created in
-- 20260405120000. PostgREST cannot disambiguate when all arguments arrive
-- as JSON text strings, producing PGRST203 on every calendar query.
--
-- The text-param version is the canonical public reader. Its return shape
-- (instance_date, is_recurring, has_party, has_class, etc.) matches the
-- frontend CalendarEvent contract. The timestamptz versions are stale —
-- they hardcode has_party/has_class to false and lack instance_date.
--
-- This migration drops ONLY the conflicting timestamptz overloads.
-- The canonical text version (text, text, text) is left untouched.

-- Drop the 4-arg timestamptz overload first (the 3-arg calls into it).
DROP FUNCTION IF EXISTS public.get_calendar_events(
  timestamp with time zone,
  timestamp with time zone,
  text,
  uuid
);

-- Drop the 3-arg timestamptz overload.
DROP FUNCTION IF EXISTS public.get_calendar_events(
  timestamp with time zone,
  timestamp with time zone,
  text
);
