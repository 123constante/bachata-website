/**
 * useEntitySlugOrId - resolve a URL param that may be a slug OR a uuid,
 * returning both the id (for entity queries) and the slug (for canonical URLs).
 *
 * Some tables (notably `venues`) use a separate `entity_id` for external URLs
 * instead of the PK. Pass `idColumn: 'entity_id'` to handle that.
 */
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/integrations/supabase/getSupabase';
import { resolvePublicEventRef } from './resolvePublicEventRef';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Matches the UUID prefix pattern (8-4-4-4-) without the strict 12-char suffix.
// Used to detect malformed UUIDs that fail UUID_RE but would still cause
// "invalid input syntax for type uuid" if passed to a UUID column.
const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-/i;

export type EntityTable =
  | 'events'
  | 'venues'
  | 'organiser_profiles'
  | 'dancer_profiles';

interface Options {
  /** Which column the URL exposes as the entity's external ID. Defaults to 'id'. */
  idColumn?: 'id' | 'entity_id';
}

export interface ResolvedEntity {
  id: string | null;
  slug: string | null;
  isLoading: boolean;
  notFound: boolean;
  /** True iff the URL param was a UUID. Drives the canonical replaceState. */
  arrivedViaUuid: boolean;
}

export function useEntitySlugOrId(
  param: string | undefined,
  table: EntityTable,
  options: Options = {},
): ResolvedEntity {
  const idColumn = options.idColumn ?? 'id';
  const arrivedViaUuid = Boolean(param && UUID_RE.test(param));
  // Param looks like a UUID attempt (has UUID prefix) but fails strict check —
  // not a valid UUID and won't match any slug either; skip the DB round-trip.
  const isMalformedUuid = !arrivedViaUuid && Boolean(param && UUID_PREFIX_RE.test(param));

  const { data, isLoading } = useQuery({
    queryKey: ['entity-resolve', table, idColumn, param],
    queryFn: async () => {
      if (!param) return null;
      // Events resolve identity from P5, not legacy `events`: the SHARED
      // resolvePublicEventRef wraps resolve_public_event_ref_v1, which reads the
      // now-canonical event_series_p5.slug and returns {id, slug} (id =
      // COALESCE(legacy_event_id, series id)), branching slug-vs-uuid internally on
      // the client UUID regex, SQL NULL on a miss. SWALLOW errors here (unchanged)
      // -- app/detailLoader.ts is the throwing mirror. Sharing one definition is
      // what keeps the two byte-equal, so the dehydrated cache entry hydrates.
      // Other tables have no P5 resolver and stay on .from(table).
      if (table === 'events') {
        return resolvePublicEventRef(param, 'swallow');
      }
      const whereCol = arrivedViaUuid ? idColumn : 'slug';
      const selectCols = `${idColumn}, slug`;
      const supabase = await getSupabase();
      const { data: row, error } = await supabase
        .from(table)
        .select(selectCols)
        .eq(whereCol, param)
        .maybeSingle();
      if (error || !row) return null;
      const r = row as Record<string, unknown>;
      return {
        id: (r[idColumn] as string | null) ?? null,
        slug: (r.slug as string | null) ?? null,
      };
    },
    enabled: Boolean(param) && !isMalformedUuid,
    staleTime: 5 * 60 * 1000,
  });

  if (isMalformedUuid) {
    return { id: null, slug: null, isLoading: false, notFound: true, arrivedViaUuid: false };
  }

  return {
    // Events: the resolver is the authority AND the visibility gate
    // (hidden/archived/draft -> null), so NEVER re-inject the raw uuid here, or an
    // archived event opened by uuid renders instead of reporting notFound.
    // Non-events resolution defers not-found to the content query, so those keep
    // the uuid passthrough. Mirrors app/detailLoader.ts.
    id: data?.id ?? (arrivedViaUuid && table !== 'events' ? (param as string) : null),
    slug: data?.slug ?? (arrivedViaUuid ? null : (param as string)),
    isLoading,
    notFound: !isLoading && Boolean(param) && !data,
    arrivedViaUuid,
  };
}
