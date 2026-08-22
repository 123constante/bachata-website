import type { QueryClient } from "@tanstack/react-query";
import { data, redirect } from "react-router";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { SITE_ORIGIN, type EntityTable } from "@/lib/seo";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
// edgeCacheControl + EDGE_STORE_MARGIN_SECONDS live in the dependency-free
// leaf module app/edgeCacheControl.ts, NOT here -- middleware.ts (Edge
// runtime) imports the leaf directly, because this file pulls in
// react-router + @/integrations/supabase/getSupabase + @/lib/seo, none of
// which the Edge Function bundle can resolve (broke the Vercel build, #272).
// Re-exported below so existing importers of these two names from THIS file
// are unaffected.
import { edgeCacheControl, EDGE_STORE_MARGIN_SECONDS } from "./edgeCacheControl";
export { edgeCacheControl, EDGE_STORE_MARGIN_SECONDS };

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

  const supabase = await getSupabase();

  const resolved = await qc.fetchQuery({
    queryKey: ["entity-resolve", table, idColumn, param],
    queryFn: async () => {
      // Events resolve identity from P5 (event_series_p5.slug) via the shared
      // resolver, which is ALSO the visibility gate (hidden/archived -> null).
      // Other tables (venue/organiser/dancer) have no P5 resolver.
      if (table === "events") {
        return resolvePublicEventRef(param, "throw");
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
    // Events: the resolver is the authority (hidden/archived -> null), so NEVER
    // re-inject the raw uuid here, or an archived event fetched by uuid 200s
    // instead of 404-ing. Non-events resolution defers the 404 to the content
    // query, so it keeps the uuid passthrough.
    id: resolved?.id ?? (arrivedViaUuid && table !== "events" ? param : null),
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

// Browsers never pin a private stale copy the CDN purge can't reach; they
// revalidate against the (fast, edge-cached) response every time.
const BROWSER_NO_STORE = "public, max-age=0, must-revalidate";

// Loader -> headers() side channel for the TTL bound below. headers() cannot
// see loader DATA, but it does see loader HEADERS -- the same seam the cache
// tag already travels on. cacheHeaders() consumes it and does not re-emit it,
// so it never reaches the client.
const EDGE_TTL_BOUND_HEADER = "X-Edge-Ttl-Bound";

/**
 * Read the side channel: `undefined` = this route never asked for a bound,
 * `NaN` = it asked and the value did not survive (edgeCacheControl fails
 * closed), a number = the bound.
 *
 * EXPORTED AND PURE so the empty-string case is assertable. `Number("")` is 0
 * and 0 is FINITE, so without the explicit check an empty header slips past the
 * fail-closed branch and is read as a deliberate "do not cache". That happens
 * to emit the same header today -- which is exactly why it needs its own test:
 * through cacheHeaders the two paths are indistinguishable, so a gate written
 * there passes whether the check exists or not, and the day fail-closed stops
 * meaning zero the empty case silently follows the wrong branch. tsconfig's
 * `strict: false` means the parameter type does not stop a caller producing one.
 */
export function parseEdgeTtlBound(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  if (raw.trim() === "") return Number.NaN;
  const parsed = Number(raw);
  // A NON-FINITE parse is corrupt HERE, whatever it would mean from a caller.
  // Number() maps 'Infinity', '1e400' and '9e999' to POSITIVE_INFINITY, and
  // edgeCacheControl reads that as "no expiry" and restores the full 25-hour
  // policy -- the exact fail-open the branch above exists to prevent, reachable
  // by a single typo in a value a producer wrote as text. The escape hatch has
  // to sit on the side of the channel where someone genuinely means it, so
  // taggedData spells "no expiry" by OMITTING the header (byte-identical to
  // unbounded, since edgeCacheControl(Infinity) === edgeCacheControl()) and
  // nothing legitimate needs to smuggle it through the string.
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Route `headers()` body: forward the loader's Vercel-Cache-Tag and set the
 *  cache layers. A response with no tag (a thrown 404/500) is NOT edge-cached. */
export function cacheHeaders(loaderHeaders: Headers): Record<string, string> {
  const tag = loaderHeaders.get("Vercel-Cache-Tag");
  if (!tag) return { "Cache-Control": BROWSER_NO_STORE };
  return {
    "Cache-Control": BROWSER_NO_STORE,
    "Vercel-CDN-Cache-Control": edgeCacheControl(
      parseEdgeTtlBound(loaderHeaders.get(EDGE_TTL_BOUND_HEADER)),
    ),
    "Vercel-Cache-Tag": tag,
  };
}

/** Wrap a loader payload so the SSR document AND the client-nav `.data` response
 *  carry a Vercel-Cache-Tag (comma-separated tags). The component and meta()
 *  still receive the unwrapped payload.
 *
 *  `opts.edgeTtlBoundSeconds` caps how long the edge may serve this generation
 *  -- pass it whenever the payload contains a value that expires on its own. For
 *  a pinned day key that is `secondsUntilKeyRollsOver(key, tz)` from
 *  @/lib/londonDate. See edgeCacheControl for what the cap means.
 *
 *  NAMED, not a third positional number, because `taggedData(payload, tag,
 *  2400)` reads identically whether 2400 is seconds or milliseconds and nothing
 *  -- not a type, not a test -- would catch the confusion. Cheap to spell out
 *  when it had one caller; four route modules now pass it. */
export function taggedData<T>(
  payload: T,
  tag: string,
  opts?: { edgeTtlBoundSeconds?: number },
) {
  const headers: Record<string, string> = { "Vercel-Cache-Tag": tag };
  // Written whenever the caller supplied the key AT ALL, including with a
  // nonsense value: the header's presence is how cacheHeaders tells "asked for
  // a bound" from "never asked", and only the first may fail closed. Emitted
  // unnormalised -- edgeCacheControl is the single owner of the clamping rule,
  // and a second copy here would let the header and the directive drift apart.
  // PRESENT BUT NOT AN OPTIONS OBJECT -- `taggedData(payload, tag, 2400)`, the
  // seconds-or-milliseconds confusion the named option exists to prevent. tsc
  // rejects the call (TS2345) and that is the whole of the static protection:
  // NO workflow gates on general tsc output. typecheck.yml runs it but is
  // message-scoped to the WallClock/Instant brand, and CLAUDE.md records that
  // no workflow runs eslint either. So a positional number reaches production
  // on a green board.
  //
  // It has to be handled BEFORE the `in` below, which would throw a TypeError
  // on a primitive -- a hard 500 on every request to the route. But merely
  // skipping is the wrong exit, and was the first answer here: no header gets
  // written, cacheHeaders reads "never asked", and the route silently keeps the
  // 25-hour policy. That collapses "absent" into "corrupt" in the one direction
  // edgeCacheControl's own rule forbids, on the routes that declared they
  // cannot tolerate it. So it fails CLOSED and says so, like every other bound
  // that did not survive the trip.
  //
  // Written as NaN rather than String(opts) deliberately: '2400' would PARSE,
  // and honouring a positional number is precisely the ambiguity being refused.
  if (opts !== undefined && (typeof opts !== "object" || opts === null)) {
    console.warn(
      `[taggedData] third argument for "${tag}" is ${typeof opts} (${String(opts)}), not ` +
        `an { edgeTtlBoundSeconds } object -- failing the edge TTL closed, so this route ` +
        `will origin-render every request until the call site is fixed.`,
    );
    headers[EDGE_TTL_BOUND_HEADER] = String(Number.NaN);
    return data(payload, { headers });
  }
  if (typeof opts === "object" && opts !== null && "edgeTtlBoundSeconds" in opts) {
    const bound = opts.edgeTtlBoundSeconds;
    // "No expiry", spelled by omission. This is the ONE normalisation done here
    // rather than in edgeCacheControl, and it is not a clamp: an omitted header
    // and Infinity produce the identical directive already
    // (edgeCacheControl(Infinity) === edgeCacheControl()), so nothing about the
    // response changes. What it buys is that the string 'Infinity' never has to
    // be a legitimate side-channel value, which lets parseEdgeTtlBound fail
    // every non-finite parse closed instead of honouring the most permissive
    // policy on behalf of a producer that may simply be broken.
    if (bound === Number.POSITIVE_INFINITY) return data(payload, { headers });

    // Present but not a finite number -- `{ edgeTtlBoundSeconds: detail?.bound }`
    // where the optional chain gave up, overwhelmingly. Still written, because
    // failing closed is right: a caller who meant to compute a bound and did not
    // must not be handed the 25-hour policy. But it is written LOUDLY, because
    // the consequence is now severe and completely silent -- the header goes out
    // as the text 'undefined', the parse NaNs, and every request to that route
    // origin-renders forever with no throw, no red test, and a curl showing a
    // perfectly plausible `s-maxage=0, must-revalidate`. Before the fail-closed
    // rule this same slip cost only the stale tail; now it costs the whole
    // route, so it gets a log line rather than a shrug.
    if (typeof bound !== "number" || !Number.isFinite(bound)) {
      console.warn(
        `[taggedData] edgeTtlBoundSeconds for "${tag}" is ${String(bound)}, not a finite ` +
          `number -- failing the edge TTL closed, so this route will origin-render every ` +
          `request until the caller supplies a real bound or omits the option entirely.`,
      );
    }
    headers[EDGE_TTL_BOUND_HEADER] = String(bound);
  }
  return data(payload, { headers });
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
    const supabase = await getSupabase();
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
