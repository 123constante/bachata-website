import { getSupabase } from '@/integrations/supabase/getSupabase';

export interface PublicOrganiserRef {
  id: string | null;
  slug: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST "function not in schema cache" / Postgres "undefined_function".
// The RPC ships in a separate admin migration; until it is applied on prod the
// resolver must keep today's behaviour instead of 500-ing every organiser page.
const MISSING_RPC_CODES = new Set(['PGRST202', '42883']);

type SbError = { code?: string; message?: string } | null;

function toError(error: NonNullable<SbError> | Error): Error {
  return error instanceof Error
    ? error
    : new Error((error as { message?: string }).message ?? JSON.stringify(error));
}

/**
 * Single source for the organiser-identity resolve. Calls
 * resolve_public_organiser_ref_v1, which takes a uuid, the CURRENT slug or an
 * OLD slug (organiser_profiles_slug_history) and returns the organiser's id plus
 * its CURRENT slug (merge tombstones forward to the survivor). It returns an empty
 * set when the organiser is not public (inactive, archived, rejected) or not
 * visible under the caller's RLS -- it IS the visibility gate.
 *
 * FALLBACK: while the RPC does not exist yet (Website ships before the admin
 * migration is applied), a missing-function error falls back to the previous
 * direct lookup (organiser_profiles by id or slug, RLS-gated), so nothing 404s
 * or 500s in the gap. Remove the fallback once the RPC is live on prod.
 *
 * The RPC returns a SET, so the call ends in .maybeSingle(). The {id, slug}
 * mapping and the ['entity-resolve','organiser_profiles','id',param] query key are
 * load-bearing for server-loader / client-hook hydration parity, so both call
 * sites (app/detailLoader, useEntitySlugOrId) route through this function.
 *
 * onError:
 *  - 'throw':   server loaders. A transient DB error must surface a retryable 500,
 *               not 404-deindex a live organiser on a blip.
 *  - 'swallow': the client hook. Non-throwing; null on error.
 */
export async function resolvePublicOrganiserRef(
  param: string,
  onError: 'throw' | 'swallow',
): Promise<PublicOrganiserRef | null> {
  const supabase = await getSupabase();
  let { data: row, error } = (await supabase
    .rpc('resolve_public_organiser_ref_v1' as never, { p_param: param } as never)
    .maybeSingle()) as { data: unknown; error: SbError };
  if (error && error.code && MISSING_RPC_CODES.has(error.code)) {
    ({ data: row, error } = (await supabase
      .from('organiser_profiles')
      .select('id, slug')
      .eq(UUID_RE.test(param) ? 'id' : 'slug', param)
      .maybeSingle()) as { data: unknown; error: SbError });
  }
  if (error) {
    if (onError === 'throw') throw toError(error);
    return null;
  }
  if (!row) return null;
  const r = row as { id: string | null; slug: string | null };
  return { id: r.id ?? null, slug: r.slug ?? null };
}
