/**
 * useEntitySlugOrId - resolve a URL param that may be a slug OR a uuid,
 * returning both the id (for entity queries) and the slug (for canonical URLs).
 *
 * Some tables (notably `venues`) use a separate `entity_id` for external URLs
 * instead of the PK. Pass `idColumn: 'entity_id'` to handle that.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { data, isLoading } = useQuery({
    queryKey: ['entity-resolve', table, idColumn, param],
    queryFn: async () => {
      if (!param) return null;
      const whereCol = arrivedViaUuid ? idColumn : 'slug';
      const selectCols = `${idColumn}, slug`;
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
    enabled: Boolean(param),
    staleTime: 5 * 60 * 1000,
  });

  return {
    id: data?.id ?? (arrivedViaUuid ? (param as string) : null),
    slug: data?.slug ?? (arrivedViaUuid ? null : (param as string)),
    isLoading,
    notFound: !isLoading && Boolean(param) && !data,
    arrivedViaUuid,
  };
}
