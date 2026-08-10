// /api/og/card — RESOURCE ROUTE (loader only, no component). Live Open Graph
// preview image for social shares: a normalized 1200x630 JPEG so every shared
// link gets a preview that WhatsApp/Facebook/LinkedIn will actually render
// (they refuse WebP and large files). In steady state middleware.ts serves
// the pre-baked R2 URL (via api/og/bake); this endpoint is the always-current
// fallback for not-yet-baked entities — occurrence-aware (`occ`) and
// cover-versioned (`v`).
//
// Delivered as a framework resource route, NOT a /api/*.ts function: under the
// react-router preset + Build Output API, Vercel does not route the top-level
// /api functions (they fall through to the SSR handler — see
// app/routes/api.revalidate.tsx for the full diagnosis). This was previously
// api/og/card.ts, silently broken in prod (confirmed returning the SPA's HTML
// shell instead of an image).
//
// Query params: kind=event|festival|image, id, occ, v (cache-buster), src (kind=image)
import { createHash } from "node:crypto";
import {
  buildFallbackCard,
  buildImageCard,
  fetchEventCardData,
  fetchFestivalCardData,
  fetchImageBytes,
  resolveOgEventId,
  type OgCardData,
} from "../lib/ogCardRender";
import type { Route } from "./+types/api.og.card";

const SITE_URL = "https://www.bachatacalendar.co.uk";

function makeEtag(kind: string, idParam: string, src: string, occ = "", v = ""): string {
  const h = createHash("sha1").update(`${kind}:${idParam}:${src}:${occ}:${v}`).digest("base64url").slice(0, 24);
  return `"${h}"`;
}

// Degrade marker: a response that is not the card the URL asked for carries
// this header naming WHY, so a degraded pipeline is observable from the
// response alone -- in a Vercel log, in a curl, and in the OG guard
// (scripts/check-og-images.mjs), which fails on its presence.
//
// ONE KNOWN EXCEPTION, stated rather than glossed. fetchEventCardData falls
// back to the VENUE's photo when an event has no cover of its own
// (ogCardRender.ts), so that share shows the venue's exterior where the page
// shows something else -- unmarked, and measured at 1 live event on
// 2026-08-10. It predates this marker by months and marking it would red CI
// on that event immediately, so it is queued (finding 1h), not claimed.
//
// The blind spot it closes: a failing event_view_p5 makes fetchEventCardData
// return null and this endpoint serves an INLINE 200 generic branded card. No
// redirect, so the guard's cardRedirectFailure rule stays silent and every
// event share is a blank card while CI reads green. Absence of this header is
// now the guard's definition of a healthy card.
//
// Reasons on the REDIRECT path are diagnostic only: a client that follows the
// 302 reads the static asset's headers, not these. The guard already catches
// that shape structurally (response.redirected), so nothing is lost -- but do
// not read a marker on redirectToStatic() as something the guard consumes.
const FALLBACK_HEADER = "X-OG-Fallback";
type FallbackReason =
  | "image-missing-src" //        kind=image with no src param
  | "image-source-unfetchable" // kind=image, source fetch failed or was too big
  | "missing-id" //               no id param
  | "unresolvable-id" //          slug/uuid resolved to nothing
  | "card-data-unavailable" //    RPC failed or returned nothing -- GENERIC card
  | "cover-unfetchable" //        had a cover URL, could not fetch it
  | "cover-absent" //             no cover URL to fetch at render time
  | "render-error"; //            anything thrown in the loader

// A degraded artefact must never be cached for a year, but "degraded" is not
// one speed. Two tiers, chosen by whether the condition can clear on its own:
//
//   FAST (300s)  card-data-unavailable, and every redirect. An RPC blip clears
//                by itself, and until it does the card is GENERIC -- no title,
//                no date. Five minutes is how long one bad request may pin a
//                blank card to the edge (and through it to WhatsApp's
//                URL-keyed preview cache).
//   SLOW (1h)    the two cover reasons. The card still carries the real title,
//                date and venue, and the tier is chosen to BOUND RE-RENDER
//                COST, not because either self-heals. At 300s a dead cover
//                costs a 5s fetch timeout plus a full sharp re-render every
//                five minutes -- ~288 a day per entity -- to re-derive a
//                byte-identical card. cover-unfetchable additionally clears
//                for free when the cover changes, since that changes `v=`;
//                cover-absent does NOT (the endpoint cannot see the image the
//                page used, so no edit to it moves `v=`), which makes it
//                non-healing rather than slow-healing. 1h is a cost ceiling on
//                a wrong card, not a repair window -- the repair is the CI red.
const CACHE_OK = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const CACHE_DEGRADED_FAST = "public, max-age=300";
const CACHE_DEGRADED_SLOW = "public, max-age=3600";
const SLOW_HEALING: ReadonlySet<string> = new Set<FallbackReason>(["cover-unfetchable", "cover-absent"]);

function imageResponse(buf: Buffer, etag: string, fallback: FallbackReason | null = null): Response {
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": !fallback ? CACHE_OK : SLOW_HEALING.has(fallback) ? CACHE_DEGRADED_SLOW : CACHE_DEGRADED_FAST,
      // NO ETag on a degraded response, and the omission is load-bearing. The
      // etag is a pure function of the query params, so a degraded card and the
      // healthy card it replaced validate IDENTICALLY -- a client that stored
      // the blank card would revalidate, match, and be told 304 Not Modified
      // for as long as `v=` held, pinning the degrade forever and undoing the
      // short cache above. With no validator to store, revalidation is a real
      // request that re-renders. A client holding the HEALTHY etag still gets
      // its 304 (the short-circuit above runs before any fetch), which is the
      // safe direction: it keeps a good card rather than a bad one.
      ...(fallback ? { [FALLBACK_HEADER]: fallback } : { ETag: etag }),
    },
  });
}

function redirectToStatic(reason: FallbackReason): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": CACHE_DEGRADED_FAST,
      Location: `${SITE_URL}/og-image.jpg`,
      [FALLBACK_HEADER]: reason,
    },
  });
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  const kind = q.get("kind") ?? "event";
  const idParam = q.get("id") ?? "";
  const src = q.get("src") ?? "";
  const occ = q.get("occ") ?? "";
  const v = q.get("v") ?? "";

  const etag = makeEtag(kind, idParam, src, occ, v);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  try {
    if (kind === "image") {
      if (!src) return redirectToStatic("image-missing-src");
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic("image-source-unfetchable");
      return imageResponse(await buildImageCard(bytes), etag);
    }
    if (!idParam) return redirectToStatic("missing-id");
    const id = await resolveOgEventId(idParam);
    if (!id) return redirectToStatic("unresolvable-id");
    const cardData = kind === "festival" ? await fetchFestivalCardData(id) : await fetchEventCardData(id, occ || null);
    if (!cardData) return imageResponse(await buildFallbackCard(null, null, null), etag, "card-data-unavailable");
    // Hybrid: a flyer becomes the preview itself (no text/fonts); the branded
    // card is only the fallback for entities with no flyer.
    // Hoisted so the fetch and the reason below cannot drift apart. They are
    // the same question asked twice, and a flipped copy would label a card
    // that had no URL "unfetchable" -- routing the operator to storage for a
    // resolver bug, in the same cache tier, invisibly.
    const hasCoverUrl = Boolean(cardData.coverUrl);
    const coverBytes = hasCoverUrl ? await fetchImageBytes(cardData.coverUrl as string) : null;
    // BOTH cover paths are marked, and the no-cover one is the subtle case.
    // For a DIRECT hit on this endpoint it is the designed flyer-less output.
    // Through a real og:image it is a resolver disagreement: the page's cover
    // is `cover_image_url ?? hero_image_url` (useEventPageQuery) while this
    // endpoint's is `cover_image_url ?? venue.image_url` (ogCardRender), so a
    // hero-only event at a photo-less venue emits a card URL whose card has no
    // hero in it -- the page promises a picture, the share gets text. Measured
    // across all 67 live series on 2026-08-10: ZERO are in that shape, so this
    // reds nothing today and is a tripwire for the day one appears. The two
    // reasons stay distinct because they need different diagnoses: a dead URL
    // is a storage problem, an absent one a resolver problem.
    if (!coverBytes) {
      return imageResponse(
        await buildFallbackCard(cardData.title, cardData.dateLine, cardData.venueLine),
        etag,
        hasCoverUrl ? "cover-unfetchable" : "cover-absent",
      );
    }
    return imageResponse(await buildImageCard(coverBytes), etag);
  } catch (err) {
    console.error("[og/card] render_failed", err);
    return redirectToStatic("render-error");
  }
}
