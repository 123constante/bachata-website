import { getSupabase } from '@/integrations/supabase/getSupabase';

export interface PublicOrganiserRef {
  id: string | null;
  slug: string | null;
}

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
  const { data: row, error } = (await supabase
    .rpc('resolve_public_organiser_ref_v1' as never, { p_param: param } as never)
    .maybeSingle()) as { data: unknown; error: SbError };
  if (error) {
    if (onError === 'throw') throw toError(error);
    return null;
  }
  if (!row) return null;
  const r = row as { id: string | null; slug: string | null };
  return { id: r.id ?? null, slug: r.slug ?? null };
}
