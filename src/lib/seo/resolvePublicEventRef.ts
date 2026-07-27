import { supabase } from '@/integrations/supabase/client';

export interface PublicEventRef {
  id: string | null;
  slug: string | null;
}

/**
 * Single source for the P5 event-identity resolve. Calls
 * resolve_public_event_ref_v1, which reads the now-canonical event_series_p5.slug,
 * branches slug-vs-uuid internally (client UUID regex, not a ::uuid cast), and
 * returns SQL NULL -- never RAISE -- for a genuine miss OR a hidden/archived/draft
 * series (it IS the visibility gate). Returns {id, slug} where
 * id = COALESCE(legacy_event_id, series id), or null.
 *
 * The {id, slug} mapping and the ['entity-resolve','events','id',param] query key
 * are load-bearing for server-loader / client-hook hydration parity, so BOTH live
 * here -- the four call sites (app/detailLoader, app/routes/event, useEntitySlugOrId,
 * app/lib/ogCardRender) route through this instead of hand-copying the RPC + mapping.
 *
 * onError:
 *  - 'throw':   server loaders. A transient DB error must surface a retryable 500,
 *               not 404-deindex a live event on a blip.
 *  - 'swallow': the client hook and the OG renderer. Non-throwing; null on error.
 *
 * Callers must NOT re-inject the raw uuid when this returns null for the events
 * table: the resolver is the authority, so a null means hidden/absent -> 404.
 */
export async function resolvePublicEventRef(
  param: string,
  onError: 'throw' | 'swallow',
): Promise<PublicEventRef | null> {
  const { data: row, error } = await supabase.rpc(
    'resolve_public_event_ref_v1' as never,
    { p_param: param } as never,
  );
  if (error) {
    if (onError === 'throw') {
      throw error instanceof Error
        ? error
        : new Error((error as { message?: string }).message ?? JSON.stringify(error));
    }
    return null;
  }
  if (!row) return null;
  const r = row as { id: string | null; slug: string | null };
  return { id: r.id ?? null, slug: r.slug ?? null };
}
