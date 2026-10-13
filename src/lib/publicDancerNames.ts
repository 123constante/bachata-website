import { supabase } from "@/integrations/supabase/client";

/**
 * publicDancerNames -- the ONE place a dancer's public name is read.
 *
 * "Hide my surname from the public" (dancer_profiles.hide_surname_publicly) is
 * enforced server side by get_public_dancer_names_v1, which returns the masked
 * `surname`, `display_name` and `public_name` for every VISIBLE dancer id (first
 * 500 ids per call). Selecting `surname` / `display_name` straight off
 * dancer_profiles bypasses the mask, so no public reader does that any more:
 * they select the other columns, then merge the names in with `withPublicNames`.
 *
 * Fail closed: a row the RPC did not return (not visible, hidden, or the RPC
 * failed) gets a null surname and display_name, never the raw column; its first
 * name is still shown.
 */

export type PublicDancerName = {
  surname: string | null;
  display_name: string | null;
  public_name: string | null;
};

/** The RPC caps one call at 500 ids; longer lists are sent in chunks. */
export const PUBLIC_NAMES_BATCH = 500;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Pure: unique, non-empty ids split into RPC-sized chunks. Exported for tests. */
export const chunkIds = (ids: ReadonlyArray<string | null | undefined>): string[][] => {
  const unique = Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += PUBLIC_NAMES_BATCH) chunks.push(unique.slice(i, i + PUBLIC_NAMES_BATCH));
  return chunks;
};

/** Pure: RPC rows -> map keyed by id. Null-safe on every field. */
export const indexPublicNames = (rows: unknown): Map<string, PublicDancerName> => {
  const map = new Map<string, PublicDancerName>();
  if (!Array.isArray(rows)) return map;
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = str(r.id) ?? str(r.dancer_id);
    if (!id) continue;
    map.set(id, { surname: str(r.surname), display_name: str(r.display_name), public_name: str(r.public_name) });
  }
  return map;
};

/** Stable code for the one warn line a failed names read logs. */
export const PUBLIC_NAMES_FAILED_CODE = "PUBLIC_DANCER_NAMES_UNAVAILABLE";

let warned = false;
/** Test hook: the warning is logged once per process. */
export const resetPublicNamesWarning = () => {
  warned = false;
};
const warnOnce = (reason: unknown) => {
  if (warned) return;
  warned = true;
  const r = reason as { code?: unknown; message?: unknown } | null;
  console.warn(`[${PUBLIC_NAMES_FAILED_CODE}] get_public_dancer_names_v1 failed; showing first names only`, {
    code: typeof r?.code === "string" ? r.code : undefined,
    message: typeof r?.message === "string" ? r.message : undefined,
  });
};

/**
 * FAIL CLOSED, NEVER THROWS. Any failure of get_public_dancer_names_v1 (function
 * not deployed yet -- PGRST202 / 404 --, network, malformed answer) yields no
 * entry for the affected ids; callers then render the first name only. There is
 * deliberately no fallback to selecting `surname` / `display_name`.
 */
export const fetchPublicDancerNames = async (
  ids: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, PublicDancerName>> => {
  const out = new Map<string, PublicDancerName>();
  try {
    const results = await Promise.all(
      chunkIds(ids).map(async (chunk) => {
        try {
          const { data, error } = await (supabase as any).rpc("get_public_dancer_names_v1", { p_ids: chunk });
          if (error) throw error;
          return data;
        } catch (e) {
          warnOnce(e);
          return null;
        }
      }),
    );
    for (const data of results) for (const [k, v] of indexPublicNames(data)) out.set(k, v);
  } catch (e) {
    warnOnce(e);
  }
  return out;
};

type Named = { id: string };

/** Pure merge (exported for tests): masked names win; unknown rows fail closed. */
export const mergePublicNames = <T extends Named>(
  rows: ReadonlyArray<T>,
  names: Map<string, PublicDancerName>,
): Array<Omit<T, "surname" | "display_name"> & PublicDancerName> =>
  rows.map((row) => {
    const n = names.get(row.id);
    const { surname: _s, display_name: _d, ...rest } = row as T & { surname?: unknown; display_name?: unknown };
    return { ...(rest as Omit<T, "surname" | "display_name">), surname: n?.surname ?? null, display_name: n?.display_name ?? null, public_name: n?.public_name ?? null };
  });

export const withPublicNames = async <T extends Named>(rows: ReadonlyArray<T>) =>
  mergePublicNames(rows, await fetchPublicDancerNames(rows.map((r) => r.id)));
