-- =============================================================================
-- Migration: 20260422140000_event_views_tracking_and_admin_top_rpc.sql
-- Date:      2026-04-22
-- Purpose:   Wire event-view tracking end-to-end.
--
--   1. Extend public.event_views with viewer_session_id + user_agent so writes
--      can be de-duplicated per session-per-day, and so bot-shaped traffic can
--      be filtered out of reads later without a schema change.
--   2. Unique partial index enforces one row per (event_id, session, day) when
--      viewer_session_id is present. Legacy rows (NULL session) stay exempt.
--   3. record_event_view_v1: SECURITY DEFINER RPC that anon+authenticated call
--      from the public site. Validates event_id FK, drops common bot UAs,
--      skips admin sessions, and ON CONFLICT DO NOTHING handles repeat hits
--      within the same day.
--   4. admin_event_views_top_v1: is_admin()-guarded read for the admin tile.
--
-- IDEMPOTENCY
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT
--   EXISTS + CREATE OR REPLACE FUNCTION. Safe to re-run.
--
-- PRECONDITIONS
--   • public.event_views exists (202604040059_create_event_views.sql)
--   • public.events has archived_at, poster_url, name columns
--   • public.is_admin() exists with signature () -> boolean
--
-- NOTE ON INDEX EXPRESSION
--   date_trunc('day', <timestamptz>) is STABLE (depends on session TimeZone)
--   and cannot be used directly in a unique index. Forcing the conversion via
--   AT TIME ZONE 'UTC' yields a timestamp-without-timezone, after which
--   date_trunc is IMMUTABLE. Dedup window is therefore a fixed UTC day.
-- =============================================================================

BEGIN;

-- ── 1. Schema additions ──────────────────────────────────────────────────────
ALTER TABLE public.event_views ADD COLUMN IF NOT EXISTS viewer_session_id text;
ALTER TABLE public.event_views ADD COLUMN IF NOT EXISTS user_agent        text;

-- ── 2. Dedup index: one row per (event_id, viewer_session_id, UTC day) ───────
CREATE UNIQUE INDEX IF NOT EXISTS event_views_session_day_unique
  ON public.event_views (
    event_id,
    viewer_session_id,
    (date_trunc('day', viewed_at AT TIME ZONE 'UTC'))
  )
  WHERE viewer_session_id IS NOT NULL;

-- ── 3. Public write RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_event_view_v1(
  p_event_id   uuid,
  p_session_id text,
  p_source     text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Unknown event: drop silently (don't leak existence/non-existence via errors).
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RETURN;
  END IF;

  -- Drop known bot/crawler UAs. Pragmatic first-line defence; sophisticated
  -- bots spoof UAs and will need rate-limiting at a higher layer if abuse
  -- emerges.
  IF p_user_agent IS NOT NULL AND p_user_agent ILIKE ANY (ARRAY[
    '%bot%',
    '%crawler%',
    '%spider%',
    '%facebookexternalhit%',
    '%twitterbot%',
    '%slackbot%',
    '%whatsapp%',
    '%telegrambot%',
    '%discordbot%',
    '%linkedinbot%',
    '%googlebot%',
    '%bingbot%',
    '%applebot%'
  ]) THEN
    RETURN;
  END IF;

  -- Skip admin sessions so staff QA traffic doesn't pollute view counts.
  IF auth.uid() IS NOT NULL AND public.is_admin() THEN
    RETURN;
  END IF;

  INSERT INTO public.event_views (event_id, viewer_session_id, source, user_agent)
  VALUES (p_event_id, p_session_id, p_source, p_user_agent)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL    ON FUNCTION public.record_event_view_v1(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_event_view_v1(uuid, text, text, text) TO anon, authenticated;

-- ── 4. Admin top-views RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_event_views_top_v1(
  p_window interval DEFAULT interval '30 days',
  p_limit  int      DEFAULT 10
)
RETURNS TABLE (
  event_id   uuid,
  event_name text,
  poster_url text,
  views      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    e.id         AS event_id,
    e.name       AS event_name,
    e.poster_url AS poster_url,
    COUNT(ev.id) AS views
  FROM public.event_views ev
  JOIN public.events      e ON e.id = ev.event_id
  WHERE ev.viewed_at >= now() - p_window
    AND e.archived_at IS NULL
  GROUP BY e.id, e.name, e.poster_url
  ORDER BY views DESC, e.name ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL    ON FUNCTION public.admin_event_views_top_v1(interval, int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_event_views_top_v1(interval, int) TO authenticated;

COMMIT;

-- ── PostgREST schema reload (outside the transaction) ────────────────────────
NOTIFY pgrst, 'reload schema';
