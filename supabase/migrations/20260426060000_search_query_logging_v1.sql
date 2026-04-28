-- ============================================================================
-- Search query logging v1
-- ============================================================================
-- Logs user search queries from the public site so the admin analytics page
-- can answer "where are users trying to look?" — the strongest expansion
-- signal we can collect (e.g., a spike of "Camden" or "Madrid" searches that
-- returned 0 results = a city worth investing in).
--
-- Privacy & abuse posture:
--   - RLS deny on the table; only the SECURITY DEFINER RPC can insert.
--   - Bot user-agents are filtered out at the RPC level.
--   - Dedup at (normalized_query, viewer_session_id, hour bucket) so a user
--     typing "lon" -> "lond" -> "london" only counts once per hour.
--   - No IP, no geo, no user_id linkage — just the query text + a session
--     identifier supplied by the caller (cookie/localStorage).
-- ============================================================================

-- ── 1. table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_queries (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    query                 text        NOT NULL,
    normalized_query      text        GENERATED ALWAYS AS (lower(btrim(query))) STORED,
    results_count         integer,
    city_id               uuid        REFERENCES public.cities(id),
    viewer_session_id     text,
    user_agent            text,
    source                text        NOT NULL DEFAULT 'unknown',
    searched_at           timestamptz NOT NULL DEFAULT now(),
    -- Hour bucket in UTC for dedup. Cast via AT TIME ZONE 'UTC' produces a
    -- plain `timestamp` value; date_trunc('hour', timestamp) is IMMUTABLE,
    -- which Postgres requires for generated columns. The timestamptz form
    -- is only STABLE because it depends on the session timezone.
    searched_hour_bucket  timestamp   GENERATED ALWAYS AS (date_trunc('hour', searched_at AT TIME ZONE 'UTC')) STORED
);

COMMENT ON TABLE public.search_queries IS
    'Public-site search query log. Used by admin analytics to surface expansion signals. Anon-writable only via record_search_query_v1.';

-- Lookup index for analytics window queries
CREATE INDEX IF NOT EXISTS search_queries_searched_at_idx
    ON public.search_queries (searched_at DESC);

-- Aggregations by normalized text
CREATE INDEX IF NOT EXISTS search_queries_normalized_idx
    ON public.search_queries (normalized_query);

-- Optional city filter
CREATE INDEX IF NOT EXISTS search_queries_city_idx
    ON public.search_queries (city_id) WHERE city_id IS NOT NULL;

-- Dedup: one row per (normalized_query, session, hour). Partial so rows
-- without a session_id (rare; logged but not deduped) don't violate.
CREATE UNIQUE INDEX IF NOT EXISTS search_queries_session_hour_dedup_idx
    ON public.search_queries (normalized_query, viewer_session_id, searched_hour_bucket)
    WHERE viewer_session_id IS NOT NULL;

-- ── 2. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- No direct access from anon/auth roles. All writes go through the RPC.
-- (No SELECT policy = no read access for non-service roles.)

-- ── 3. write RPC (anon-callable, SECURITY DEFINER) ───────────────────────
CREATE OR REPLACE FUNCTION public.record_search_query_v1(
    p_query        text,
    p_results_count integer DEFAULT NULL,
    p_city_id      uuid    DEFAULT NULL,
    p_session_id   text    DEFAULT NULL,
    p_user_agent   text    DEFAULT NULL,
    p_source       text    DEFAULT 'unknown'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_query_clean text;
BEGIN
    v_query_clean := btrim(coalesce(p_query, ''));

    -- Skip empty queries
    IF length(v_query_clean) = 0 THEN
        RETURN;
    END IF;

    -- Skip overly long queries (abuse / accidental paste)
    IF length(v_query_clean) > 200 THEN
        RETURN;
    END IF;

    -- Skip obvious bot UAs
    IF p_user_agent IS NOT NULL AND p_user_agent ~* '(bot|crawl|spider|slurp|facebook|preview|httpclient)' THEN
        RETURN;
    END IF;

    INSERT INTO public.search_queries (
        query, results_count, city_id, viewer_session_id, user_agent, source
    ) VALUES (
        v_query_clean, p_results_count, p_city_id, p_session_id, p_user_agent, coalesce(p_source, 'unknown')
    )
    ON CONFLICT (normalized_query, viewer_session_id, searched_hour_bucket)
       WHERE viewer_session_id IS NOT NULL
       DO NOTHING;
EXCEPTION
    WHEN unique_violation THEN
        -- Belt-and-braces: if any other unique index ever exists, swallow.
        NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_search_query_v1(text, integer, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_search_query_v1(text, integer, uuid, text, text, text)
    TO anon, authenticated;

COMMENT ON FUNCTION public.record_search_query_v1 IS
    'Anon-callable. Records a public-site search query for analytics. Bot UAs filtered, queries deduped per (normalized_query, session, hour).';

-- ── 4. read RPC for admin analytics ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_search_queries_top_v1(
    p_window     interval DEFAULT '30 days',
    p_limit      integer  DEFAULT 50,
    p_zero_only  boolean  DEFAULT FALSE
) RETURNS TABLE (
    normalized_query  text,
    total_searches    bigint,
    unique_sessions   bigint,
    avg_results       numeric,
    last_searched_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        sq.normalized_query,
        count(*)                            AS total_searches,
        count(DISTINCT sq.viewer_session_id) AS unique_sessions,
        round(avg(coalesce(sq.results_count, 0))::numeric, 2) AS avg_results,
        max(sq.searched_at)                 AS last_searched_at
    FROM public.search_queries sq
    WHERE sq.searched_at >= now() - p_window
      AND (NOT p_zero_only OR coalesce(sq.results_count, 0) = 0)
    GROUP BY sq.normalized_query
    ORDER BY total_searches DESC
    LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_search_queries_top_v1(interval, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_queries_top_v1(interval, integer, boolean)
    TO authenticated;

COMMENT ON FUNCTION public.a