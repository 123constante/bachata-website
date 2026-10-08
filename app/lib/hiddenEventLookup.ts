// Server-only reads of an event series the PUBLIC resolver hides
// (resolve_public_event_ref_v1 returns null for archived / draft /
// pending_review, and for paused without a past public date). Anon cannot read
// event_series_p5 (RLS: admin only), so these use the service-role key from the
// server environment. Nothing read here is rendered: callers use the slug to
// build purge URLs (cloudflarePurgeResolver) and the lifecycle to pick 404 vs
// 410 (routes/event.tsx, via eventPageSeoPolicy). Without the key every read
// returns null and callers keep their pre-lookup behaviour (uuid-only purge;
// 404).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Slugs are lowercase kebab; anything else never reaches the query string.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/i;

type Env = Record<string, string | undefined>;

/** Rows of the series whose public id (COALESCE(legacy_event_id, id)) or slug
 *  is `param`, whatever its lifecycle. At most two (two means ambiguous).
 *  Null without the service key or for a param that is neither. Throws on HTTP
 *  error. */
export async function fetchHiddenSeries<T>(
  param: string,
  select: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<T[] | null> {
  const base = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY ?? "";
  if (!base || !key) return null;
  let filter: string;
  if (UUID_RE.test(param)) filter = `or=(legacy_event_id.eq.${param},and(legacy_event_id.is.null,id.eq.${param}))`;
  else if (SLUG_RE.test(param)) filter = `slug=eq.${encodeURIComponent(param)}`;
  else return null;
  const res = await fetchImpl(`${base}/rest/v1/event_series_p5?select=${select}&${filter}&limit=2`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`event_series_p5 lookup HTTP ${res.status}`);
  return (await res.json()) as T[];
}

/** lifecycle_status of the series at /event/<param> (slug or uuid), or null
 *  when there is no single such series or no key. */
export async function hiddenEventLifecycle(
  param: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const rows = await fetchHiddenSeries<{ lifecycle_status?: string | null }>(param, "lifecycle_status", env, fetchImpl);
  return rows && rows.length === 1 ? rows[0].lifecycle_status ?? null : null;
}
