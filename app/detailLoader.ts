import type { QueryClient } from "@tanstack/react-query";
import { data, redirect } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import type { EntityTable } from "@/lib/seo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-/i;

export interface ResolvedRef {
  id: string | null;
  slug: string | null;
  arrivedViaUuid: boolean;
}

// Server-side mirror of useEntitySlugOrId (src/lib/seo/useEntitySlugOrId.ts):
// resolve a slug-or-uuid param to {id, slug} and dehydrate the SAME
// ['entity-resolve', table, idColumn, param] cache entry the hook reads, so the
// client hydrates without re-resolving. Keep in sync with that hook.
export async function resolveEntityInLoader(
  qc: QueryClient,
  table: EntityTable,
  param: string,
  idColumn: "id" | "entity_id" = "id",
): Promise<ResolvedRef> {
  const arrivedViaUuid = UUID_RE.test(param);
  const isMalformedUuid = !arrivedViaUuid && UUID_PREFIX_RE.test(param);
  if (isMalformedUuid) return { id: null, slug: null, arrivedViaUuid: false };

  const resolved = await qc.fetchQuery({
    queryKey: ["entity-resolve", table, idColumn, param],
    queryFn: async () => {
      const whereCol = arrivedViaUuid ? idColumn : "slug";
      const { data: row, error } = await supabase
        .from(table)
        .select(`${idColumn}, slug`)
        .eq(whereCol, param)
        .maybeSingle();
      // Distinguish a TRANSIENT error from a genuine miss: rethrow so the loader
      // surfaces a retryable 500 rather than 404+noindex-ing a valid entity on a
      // DB blip (mirrors app/routes/event.tsx). `null` = genuine not-found.
      if (error) throw error;
      if (!row) return null;
      const r = row as Record<string, unknown>;
      return { id: (r[idColumn] as string | null) ?? null, slug: (r.slug as string | null) ?? null };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    id: resolved?.id ?? (arrivedViaUuid ? param : null),
    slug: resolved?.slug ?? (arrivedViaUuid ? null : param),
    arrivedViaUuid,
  };
}

// Genuinely-unresolvable detail param → 404 + noindex (mirrors middleware's
// NOINDEX_404 stub, so a bad slug/uuid never gets indexed).
export function throwDetailNotFound(label: string): never {
  throw new Response(`${label} not found`, {
    status: 404,
    headers: { "X-Robots-Tag": "noindex" },
  });
}

// ── Phase 4a ISR — edge caching ─────────────────────────────────────────────
// Vercel STRIPS Vercel-CDN-Cache-Control + Vercel-Cache-Tag from the client
// response (they're internal edge directives); the edge caches on s-maxage and
// reports X-Vercel-Cache: HIT/MISS. A content edit purges by tag on demand
// (see api/revalidate.ts + the Supabase webhook). headers() can't see loader
// data, so the per-entity tag is attached in the loader via taggedData() and
// forwarded here. The tag id is the entity's public URL id (per
// useEntitySlugOrId) — the same id the DB emit resolves.
const EDGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
// Browsers never pin a private stale copy the CDN purge can't reach; they
// revalidate against the (fast, edge-cached) response every time.
const BROWSER_NO_STORE = "public, max-age=0, must-revalidate";

/** Route `headers()` body: forward the loader's Vercel-Cache-Tag and set the
 *  cache layers. A response with no tag (a thrown 404/500) is NOT edge-cached. */
export function cacheHeaders(loaderHeaders: Headers): Record<string, string> {
  const tag = loaderHeaders.get("Vercel-Cache-Tag");
  if (!tag) return { "Cache-Control": BROWSER_NO_STORE };
  return {
    "Cache-Control": BROWSER_NO_STORE,
    "Vercel-CDN-Cache-Control": EDGE_CACHE,
    "Vercel-Cache-Tag": tag,
  };
}

/** Wrap a loader payload so the SSR document AND the client-nav `.data` response
 *  carry a Vercel-Cache-Tag (comma-separated tags). The component and meta()
 *  still receive the unwrapped payload. */
export function taggedData<T>(payload: T, tag: string) {
  return data(payload, { headers: { "Vercel-Cache-Tag": tag } });
}

/** If the URL arrived as a UUID but the entity has a canonical slug, 301 to the
 *  slug URL (query string preserved). Collapses the two cache entries
 *  (/kind/<uuid> and /kind/<slug>) into one and consolidates SEO onto the slug.
 *  Call in the loader after resolving + the not-found check, before the content
 *  fetch. `resolveEntityInLoader` only returns a slug when the row was found, so
 *  a non-null ref.slug means the entity exists. */
export function redirectUuidToSlug(ref: ResolvedRef, request: Request, basePath: string): void {
  if (ref.arrivedViaUuid && ref.slug) {
    throw redirect(`${basePath}/${ref.slug}${new URL(request.url).search}`, 301);
  }
}
