// Supabase lookups for ../cloudflarePurge (id -> canonical slug, active
// cities). Loaded with a dynamic import from api.revalidate's background task,
// so a break in this graph can never touch the Vercel purge response.
//
// Anon reads, mirroring the routes: events go through resolve_public_event_ref_v1
// (the visibility gate: a hidden/archived series returns null, and only its
// uuid URL is purged -- see docs/ops/cloudflare-purge.md); the other tables
// are read the way resolveEntityInLoader (../detailLoader) reads them.
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import type { CfPurgeResolver } from "../cloudflarePurge";

export const supabaseCloudflareResolver: CfPurgeResolver = {
  async slugFor(table, id) {
    if (table === "events") return (await resolvePublicEventRef(id, "throw"))?.slug ?? null;
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
