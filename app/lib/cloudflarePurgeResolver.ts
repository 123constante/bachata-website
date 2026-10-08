// Supabase lookups for ../cloudflarePurge (id -> canonical slug, active
// cities). Loaded with a dynamic import from api.revalidate's background task,
// so a break in this graph can never touch the Vercel purge response.
//
// Anon reads, mirroring the routes: events go through resolve_public_event_ref_v1;
// the other tables are read the way resolveEntityInLoader (../detailLoader)
// reads them.
//
// HIDDEN EVENTS. The public resolver is the visibility gate, so an archived /
// draft / pending_review series resolves to null -- exactly the case a takedown
// produces, and the one URL that MUST be purged is its /event/<slug> (2026-10-08:
// a taken-down series kept a Cloudflare HIT on its slug URL because only the
// uuid URL was purged). Anon cannot read event_series_p5 (RLS: admin only), so
// the fallback reads the slug with the server-only service-role key. The slug
// is used to build purge URLs and is never rendered. Without the key the
// fallback returns null and the old uuid-only behaviour stands.
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import type { CfPurgeResolver } from "../cloudflarePurge";
import { fetchHiddenSeries } from "./hiddenEventLookup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slug of the series whose public id (COALESCE(legacy_event_id, id)) is `id`,
 *  whatever its lifecycle. Service role, server only; null without the key. */
export async function hiddenEventSlug(
  id: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await fetchHiddenSeries<{ slug?: string | null }>(id, "slug", env, fetchImpl);
  // Two rows would mean the uuid is ambiguous; purge the uuid URL only.
  return rows && rows.length === 1 ? rows[0].slug ?? null : null;
}

export const supabaseCloudflareResolver: CfPurgeResolver = {
  async slugFor(table, id) {
    if (table === "events") {
      const pub = (await resolvePublicEventRef(id, "throw"))?.slug ?? null;
      return pub ?? (await hiddenEventSlug(id));
    }
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from(table).select("slug").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as { slug?: string | null } | null)?.slug ?? null;
  },
  async activeCitySlugs() {
    const supabase = await getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("cities").select("slug").eq("is_active", true).limit(50);
    if (error) throw error;
    return ((data ?? []) as { slug: string | null }[]).map((r) => r.slug).filter((s): s is string => !!s);
  },
};
