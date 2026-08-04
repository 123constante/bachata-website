import { supabase } from '@/integrations/supabase/client';
import { getViewerSession } from './viewerSession';
import type { SearchKind } from './searchEntities';

// Fire-and-forget result-click logger for popularity ranking (search_public_v5).
// Mirrors searchTelemetry.ts. Calls record_search_result_click_v1, which
// server-side filters bot UAs, dedupes per (normalized_query, entity, session,
// hour) and rejects empty/unknown rows. The SearchKind values are exactly the
// RPC's entity_type whitelist, so kind maps straight through. Never blocks nav.
interface RecordSearchClickArgs {
  query: string;
  kind: SearchKind;
  id: string;
  position?: number | null;
  source?: string;
}

export function recordSearchResultClick({ query, kind, id, position, source = 'search' }: RecordSearchClickArgs): void {
  if (typeof window === 'undefined') return;
  const trimmed = (query ?? '').trim();
  if (trimmed.length === 0 || !id) return;

  const sessionId = getViewerSession() || null;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  void supabase
    .rpc('record_search_result_click_v1', {
      p_query: trimmed,
      p_entity_type: kind,
      p_entity_id: id,
      p_position: typeof position === 'number' ? position : null,
      p_session_id: sessionId,
      p_user_agent: userAgent,
      p_source: source,
    })
    .then(() => undefined, () => undefined);
}
