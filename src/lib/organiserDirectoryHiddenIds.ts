import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The ONE source of the organiser-directory visibility rule D3: a LIVE organiser
 * page that was self-started and is not yet visible (no published event, not
 * Trusted) is left out of every public directory read. The rule itself lives in
 * the admin RPC organiser_directory_hidden_ids_v1(), which returns uuid[] (never
 * NULL; {} when none) and anon may execute.
 *
 * Call sites -- ALL of them, each calling this ONCE per read, never per id:
 *   - src/lib/organiserDirectoryList.ts  /organisers list (filters rows in JS)
 *   - src/hooks/useDirectoryCounts.ts    homepage head-only count (hiddenIdsNotFilter)
 *   - app/routes/sitemap.tsx             /organisers/:id URLs (filters rows in JS)
 *
 * An RPC error THROWS, like the neighbouring queries: a directory that silently
 * failed open would list pages that are meant to be hidden.
 */

const HIDDEN_IDS_RPC = 'organiser_directory_hidden_ids_v1';

// The RPC is not in the generated types; this is the only place it is cast.
type HiddenIdsRpc = {
  rpc: (fn: typeof HIDDEN_IDS_RPC) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function fetchOrganiserDirectoryHiddenIds(
  client: Pick<SupabaseClient, 'rpc'>,
): Promise<string[]> {
  const { data, error } = await (client as unknown as HiddenIdsRpc).rpc(HIDDEN_IDS_RPC);
  if (error) throw error;
  // A successful call with null data is treated as "none hidden".
  if (data == null) return [];
  if (!Array.isArray(data)) throw new Error(`${HIDDEN_IDS_RPC} returned a non-array payload`);
  return data as string[];
}

/**
 * `.not(...)` arguments that exclude the hidden ids from a query, or null when
 * there are none (an empty list adds no filter at all).
 */
export function hiddenIdsNotFilter(hiddenIds: readonly string[]): ['id', 'in', string] | null {
  return hiddenIds.length === 0 ? null : ['id', 'in', `(${hiddenIds.join(',')})`];
}

export function withoutHiddenOrganisers<T extends { id: string }>(rows: T[], hiddenIds: readonly string[]): T[] {
  if (hiddenIds.length === 0) return rows;
  const hidden = new Set(hiddenIds);
  return rows.filter((row) => !hidden.has(row.id));
}
