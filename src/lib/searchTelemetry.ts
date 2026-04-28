import { supabase } from '@/integrations/supabase/client';
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

  void supabase
    .rpc('record_search_query_v1' as any, {
      p_query: trimmed,
      p_results_count: typeof resultsCount === 'number' ? resultsCount : null,
      p_city_id: cityId ?? null,
      p_session_id: sessionId,
      p_user_agent: userAgent,
      p_source: source,
    })
    .then(() => undefined, () => undefined);
}
