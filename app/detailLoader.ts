import type { QueryClient } from "@tanstack/react-query";
import { data, redirect } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { SITE_ORIGIN, type EntityTable } from "@/lib/seo";

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
      // Events resolve identity from P5, not legacy `events`: resolve_public_event_ref_v1
      // reads event_series_p5.slug (now canonical) and returns {id, slug} — id =
      // COALESCE(legacy_event_id, series id). It takes ONE param and branches
      // slug-vs-uuid internally (client UUID regex, not a ::uuid cast), returning
      // SQL NULL (never RAISE) on a miss. Other tables (venue/organiser/dancer)
      // have no P5 resolver and stay on .from(table).
      if (table === "events") {
        const { data: row, error } = await supabase.rpc(
          "resolve_public_event_ref_v1" as never,
          { p_param: param } as never,
        );
        // TRANSIENT error → rethrow (retryable 500); `null` = genuine not-found.
        if (error) throw error;
        if (!row) return null;
        const r = row as { id: string | null; slug: string | null };
        return { id: r.id ?? null, slug: r.slug ?? null };
      }
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

// ── Phase 5 — social-preview og:image normalization ─────────────────────────
// ~60% of event/festival covers are WebP, which WhatsApp/Facebook/LinkedIn
// refuse to render as link-preview cards (no card appears at all) — mirrors
// middleware.ts's ogCardUrl()/fetchBakedOgImage()/sameHostImage(), the one
// piece of middleware's bot-only OG generation the SSR routes don't yet
// replicate (JSON-LD/venue/organizer/performers are already emitted by the
// page components themselves — see src/lib/buildEventJsonLd.ts). This is
// ONLY for the og:image/twitter:image meta tags; the schema.org JSON-LD
// `image` field (parsed by Google, not by social-card unfurlers) is fine with
// the raw cover URL as-is and is left untouched.

/** A stable per-cover cache-buster: the cover's filename (R2 names are unique
 *  per upload). Changes when the cover changes, busting both the CDN edge
 *  cache and WhatsApp's URL-keyed preview cache. */
export function coverVersionToken(coverUrl: string | null | undefined): string | null {
  if (!coverUrl) return null;
  const seg = String(coverUrl).split("?")[0].split("/").pop() ?? "";
  return seg ? seg.slice(0, 64) : null;
}

/** Prefer a pre-baked, immutable R2 OG image (rendered once on cover change)
 *  over a live /api/og/card render. Returns null on any miss/error so the
 *  caller always has a live fallback — a preview is never broken or stale. */
async function fetchBakedOgImage(
  entityType: "event" | "festival",
  entityId: string,
  occId: string | null,
  coverToken: string | null,
): Promise<string | null> {
  try {
    const { data: url, error } = await supabase.rpc("get_og_image_v1" as never, {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_occurrence_id: occId,
      p_cover_token: coverToken,
    } as never);
    if (error) return null;
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** og:image MUST be an absolute URL on the host the crawler actually fetched —
 *  otherwise WhatsApp/Facebook silently drop the preview card (they don't
 *  follow redirects on og:image, and a relative URL isn't valid at all). */
function sameHostImage(imageUrl: string, requestOrigin: string): string {
  try {
    const ro = new URL(requestOrigin);
    const img = new URL(imageUrl, ro);
    if (img.hostname === ro.hostname || /(^|\.)bachatacalendar\.co\.uk$/i.test(img.hostname)) {
      img.protocol = ro.protocol;
      img.host = ro.host;
      return img.toString();
    }
  } catch {
    /* unparseable even with a base — leave as-is */
  }
  return imageUrl;
}

/** Resolve the og:image/twitter:image URL for an event or festival: prefer the
 *  R2-baked card, else a live /api/og/card render, normalized to the request's
 *  host. Call from the route loader (not the component) — needs the raw cover
 *  URL and the request for its origin. Falls back to `fallbackImage` (the
 *  static branded og-image.jpg) when there's no cover at all. */
export async function resolveOgCardImage(opts: {
  entityType: "event" | "festival";
  entityId: string;
  occId?: string | null;
  coverUrl: string | null | undefined;
  request: Request;
  fallbackImage: string;
}): Promise<string> {
  const { entityType, entityId, occId = null, coverUrl, request, fallbackImage } = opts;
  const requestOrigin = new URL(request.url).origin;
  const coverToken = coverVersionToken(coverUrl);
  if (!coverToken) return fallbackImage;

  const baked = await fetchBakedOgImage(entityType, entityId, occId, coverToken);
  const params = new URLSearchParams({ kind: entityType, id: entityId });
  if (occId) params.set("occ", occId);
  params.set("v", coverToken);
  const live = `${SITE_ORIGIN.replace(/\/$/, "")}/api/og/card?${params.toString()}`;

  return sameHostImage(baked ?? live, requestOrigin);
}

/** Absolute-ise a possibly-relative image URL against SITE_ORIGIN (mirrors
 *  middleware.ts's absoluteUrl). */
function absoluteImageUrl(maybeUrl: string | null | undefined): string | null {
  if (!maybeUrl) return null;
  const v = String(maybeUrl).trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `${SITE_ORIGIN.replace(/\/$/, "")}/${v.replace(/^\//, "")}`;
}

/** og:image/twitter:image for the non-event/festival entities (venue, teacher,
 *  dj, dancer): route the raw cover through /api/og/card?kind=image — a
 *  letterboxed 1200x630 JPEG — so WebP/oversized covers still render as
 *  link-preview cards, host-normalized to the request origin. Mirrors
 *  middleware.ts's ogNormalizedImage() + sameHostImage() (these entities get the
 *  simple normalize, NOT the branded ogCardUrl()/R2-bake path events/festivals
 *  use). Synchronous — no RPC. Falls back to `fallbackImage` with no cover. */
export function normalizeOgImage(opts: {
  rawUrl: string | null | undefined;
  request: Request;
  fallbackImage: string;
}): string {
  const abs = absoluteImageUrl(opts.rawUrl);
  if (!abs) return opts.fallbackImage;
  const requestOrigin = new URL(opts.request.url).origin;
  const normalized = `${SITE_ORIGIN.replace(/\/$/, "")}/api/og/card?kind=image&src=${encodeURIComponent(abs)}`;
  return sameHostImage(normalized, requestOrigin);
}
