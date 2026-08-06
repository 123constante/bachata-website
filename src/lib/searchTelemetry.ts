import { getSupabase } from '@/integrations/supabase/getSupabase';
import { getViewerSession } from './viewerSession';

interface RecordSearchQueryArgs {
  query: string;
  resultsCount?: number | null;
  cityId?: string | null;
  source?: string;
}

/**
 * Fire-and-forget. Logs a public-site search to the search_queries table via
 * the record_search_query_v1 RPC. Server-side filters bot UAs, dedupes by
 * (normalized_query, session, hour), and skips empty queries.
 *
 * Designed to be called once per debounced search (not per keystroke).
 */
export function recordSearchQuery({ query, resultsCount, cityId, source = 'unknown' }: RecordSearchQueryArgs): void {
  if (typeof window === 'undefined') return;
  const trimmed = (query ?? '').trim();
  if (trimmed.length === 0) return;

  const sessionId = getViewerSession() || null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  // Still fire-and-forget, now behind the lazy accessor: every rejection --
  // including a failure to LOAD the client chunk -- is swallowed, so telemetry
  // can never surface as an unhandled rejection on a search keystroke.
  void getSupabase()
    .then((supabase) =>
      supabase.rpc('record_search_query_v1', {
        p_query: trimmed,
        p_results_count: typeof resultsCount === 'number' ? resultsCount : null,
        p_city_id: cityId ?? null,
        p_session_id: sessionId,
        p_user_agent: userAgent,
        p_source: source,
      }),
    )
    .then(() => undefined, () => undefined);
}
