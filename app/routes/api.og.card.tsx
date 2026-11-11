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
// Query params: kind=event|festival|image, id, occ, v (cache-buster), src (kind=image),
// layout=tall (kind=event ONLY; test-only, see buildTallCard; never baked),
// l=wf1&s=<W>x<H> (kind=event ONLY; the whole-flyer card at exactly that canvas,
// docs/design/whatsapp-whole-flyer.CONTRACT.md D4 b/b2). The layout comes from
// the URL, NEVER from OG_WHOLE_FLYER_MODE: every layout has its own URL, so no
// cache anywhere can hold one layout under the other's URL. l-less URLs are the
// legacy card, byte-identical to before (no new header, same Cache-Control).
import { createHash } from "node:crypto";
import {
  buildCoverCard,
  buildFallbackCard,
  buildImageCard,
  buildTallCard,
  buildWholeFlyerCard,
  buildWholeFlyerFallbackCard,
  type WholeFlyerCard,
  fetchEventCardData,
  fetchFestivalCardData,
  fetchImageBytes,
  OG_BRANDED_CARD_ENABLED,
  ogFactsTag,
  resolveOgEventId,
  type OgCardData,
} from "../lib/ogCardRender";
import { isAllowedOgImageSource } from "../lib/ogImageSourceAllowlist";
import { formatCanvas, parseLiveLayout, WF_LAYOUT, type CanvasSize } from "../lib/ogLayout";
import type { Route } from "./+types/api.og.card";

const SITE_URL = "https://www.bachatacalendar.co.uk";

// `facts` is "" unless OG_BRANDED_CARD_ENABLED, so with the flag off this
// etag is byte-identical to before ogFactsTag existed (see ogCardRender.ts).
// The ternary, not a bare `:${facts}` append, is load-bearing: an
// unconditional append changes the hashed STRING (an extra trailing colon)
// even when facts is "", which would change every ETag on this route the
// moment this ships regardless of the flag -- exactly the invariant this
// comment claims. Mirrors the same guard in api.og.bake.tsx's R2 key.
//
// `layout` follows the same rule: "" (every normal URL) leaves the hashed string
// byte-identical; only the test-only layout=tall appends a segment.
function makeEtag(kind: string, idParam: string, src: string, occ = "", v = "", facts = "", layout = ""): string {
  const h = createHash("sha1")
    .update(`${kind}:${idParam}:${src}:${occ}:${v}${facts ? `:${facts}` : ""}${layout ? `:layout=${layout}` : ""}`)
    .digest("base64url")
    .slice(0, 24);
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
  | "image-source-disallowed" //  kind=image, src not on the SSRF allow-list (never fetched)
  | "missing-id" //               no id param
  | "unresolvable-id" //          slug/uuid resolved to nothing
  | "card-data-unavailable" //    RPC failed or returned nothing -- GENERIC card
  | "cover-unfetchable" //        had a cover URL, could not fetch it
  | "cover-absent" //             no cover URL to fetch at render time
  | "render-error" //             anything thrown in the loader
  | "over-budget" //              l=wf1: even q58 is over 300 KB; same-size card (D6)
  | "wf-size-invalid"; //         l=wf1 with an s outside the D1 range: legacy card served

// A degraded artefact must never be cached for a year, but "degraded" is not
// one speed. Two tiers, chosen by whether the condition can clear on its own:
//
//   NONE         render-error (redirect, no-store -- see CACHE_RENDER_ERROR).
//   FAST (300s)  card-data-unavailable, and every other redirect. An RPC blip clears
//                by itself, and until it does the card is GENERIC -- no title,
//                no date. Five minutes is how long one bad request may pin a
//                blank card to the edge (and through it to WhatsApp's
//                URL-keyed preview cache).
//   SLOW (1h)    the two cover reasons. The card still carries the real title,
//                date and venue, and the tier is chosen to BOUND RE-RENDER
//                COST, not because either self-heals. At 300s a dead cover
//                costs up to a 5s fetch deadline plus a full sharp re-render every
//                five minutes -- ~288 a day per entity -- to re-derive a
//                byte-identical card. cover-unfetchable additionally clears
//                for free when the cover changes, since that changes `v=`;
//                cover-absent does NOT (the endpoint cannot see the image the
//                page used, so no edit to it moves `v=`), which makes it
//                non-healing rather than slow-healing. 1h is a cost ceiling on
//                a wrong card, not a repair window -- the repair is the CI red.
const CACHE_OK = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
// The same shared-cache lifetime, stated on the directive Vercel documents for
// its CDN, so a future edit to the browser header above cannot silently shorten
// the edge window. HEALTHY 200 only: degraded tiers, 302s, 304s and
// render-error never carry it (pinned in ./api.og.card.test.tsx). Rollback
// knob for docs/ops/vercel-cpu-cuts-2026-11-04.md slice 1.
const EDGE_CACHE_OK = "public, s-maxage=31536000, stale-while-revalidate=604800";
const CACHE_DEGRADED_FAST = "public, max-age=300";
const CACHE_DEGRADED_SLOW = "public, max-age=3600";
const SLOW_HEALING: ReadonlySet<string> = new Set<FallbackReason>(["cover-unfetchable", "cover-absent"]);

// layout=tall is a TEST-ONLY card whose renderer may still be tuned, and its
// URL carries no renderer version: a year-long edge entry would pin the first
// render for every retest. One hour, browser and edge alike, no CDN directive.
const CACHE_TALL_TEST = "public, max-age=3600";

function imageResponse(buf: Buffer, etag: string, fallback: FallbackReason | null = null, tallTest = false): Response {
  if (tallTest && !fallback) {
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": CACHE_TALL_TEST,
        ETag: etag,
      },
    });
  }
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
      ...(fallback ? { [FALLBACK_HEADER]: fallback } : { ETag: etag, "Vercel-CDN-Cache-Control": EDGE_CACHE_OK }),
    },
  });
}

// render-error is the one reason that says nothing about the entity: the card
// threw (2026-11-04: a font fetch timing out on cold start), so the very next
// request may well render. Caching that 302 for five minutes pinned the generic
// /og-image.jpg to the edge and, through it, to WhatsApp's URL-keyed preview
// cache. no-store: a crawler that retries gets a fresh render attempt.
const CACHE_RENDER_ERROR = "no-store";

function redirectToStatic(reason: FallbackReason): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": reason === "render-error" ? CACHE_RENDER_ERROR : CACHE_DEGRADED_FAST,
      Location: `${SITE_URL}/og-image.jpg`,
      [FALLBACK_HEADER]: reason,
    },
  });
}

// ── Whole-flyer (l=wf1) responses ──────────────────────────────────────────
// Every response under an l=wf1 URL names its layout (X-OG-Layout: wf1, the
// header the guard reads; l-less responses never carry it). Cache-Control is at
// most one hour while the mode is not on everywhere (contract D5); the long
// cache returns only in a later named slice, so there is no CDN directive here.
// Every 200 is drawn at the URL's s= canvas, degraded ones included (r3 R4),
// and keeps its X-OG-Fallback marker; a render error stays a no-store 302.
const LAYOUT_HEADER = "X-OG-Layout";
const CACHE_WF_OK = "public, max-age=3600";

function wholeFlyerImageResponse(card: WholeFlyerCard, etag: string, fallback: FallbackReason | null): Response {
  return new Response(new Uint8Array(card.buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(card.buf.length),
      "X-Content-Type-Options": "nosniff",
      [LAYOUT_HEADER]: WF_LAYOUT,
      "Cache-Control": !fallback
        ? CACHE_WF_OK
        : SLOW_HEALING.has(fallback) || fallback === "over-budget" ? CACHE_DEGRADED_SLOW : CACHE_DEGRADED_FAST,
      // Same "NO ETag on a degraded response" rule as imageResponse.
      ...(fallback ? { [FALLBACK_HEADER]: fallback } : { ETag: etag }),
    },
  });
}

function wholeFlyerRedirect(reason: FallbackReason): Response {
  const res = redirectToStatic(reason);
  res.headers.set(LAYOUT_HEADER, WF_LAYOUT);
  return res;
}

async function wholeFlyerLoader(
  idParam: string, occ: string, v: string, canvas: CanvasSize, ifNoneMatch: string | null,
): Promise<Response> {
  // Params-only etag: the whole-flyer card draws no facts (D8), so the free 304
  // holds whatever OG_BRANDED_CARD_ENABLED says. l and s are both in it.
  const etag = makeEtag("event", idParam, "", occ, v, "", `${WF_LAYOUT}:s=${formatCanvas(canvas)}`);
  try {
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { [LAYOUT_HEADER]: WF_LAYOUT } });
    }
    if (!idParam) return wholeFlyerRedirect("missing-id");
    const id = await resolveOgEventId(idParam);
    if (!id) return wholeFlyerRedirect("unresolvable-id");
    const cardData = await fetchEventCardData(id, occ || null);
    if (!cardData) {
      return wholeFlyerImageResponse(await buildWholeFlyerFallbackCard(null, null, null, canvas), "", "card-data-unavailable");
    }
    const hasCoverUrl = Boolean(cardData.coverUrl);
    const coverBytes = hasCoverUrl ? await fetchImageBytes(cardData.coverUrl as string) : null;
    if (!coverBytes) {
      return wholeFlyerImageResponse(
        await buildWholeFlyerFallbackCard(cardData.title, cardData.dateLine, cardData.venueLine, canvas),
        etag,
        hasCoverUrl ? "cover-unfetchable" : "cover-absent",
      );
    }
    // Exactly the URL's canvas, whatever the CURRENT cover's ratio: an old URL
    // can only show newer content, never a different size (D4 b2).
    const card = await buildWholeFlyerCard(coverBytes, canvas);
    return wholeFlyerImageResponse(card, etag, card.overBudget ? "over-budget" : null);
  } catch (err) {
    console.error("[og/card] render_failed", err);
    return wholeFlyerRedirect("render-error");
  }
}

/** l=wf1 with an s outside the D1 range: answered through the legacy-fallback
 *  path -- the l-less card, never a guessed whole-flyer size -- and marked so
 *  it can never pass the guard or sit in a cache as healthy. */
function markInvalidWholeFlyerSize(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set(LAYOUT_HEADER, "legacy-fallback");
  headers.set(FALLBACK_HEADER, "wf-size-invalid");
  headers.delete("ETag");
  headers.delete("Vercel-CDN-Cache-Control");
  if (headers.get("Cache-Control") !== CACHE_RENDER_ERROR) headers.set("Cache-Control", CACHE_DEGRADED_FAST);
  return new Response(res.body, { status: res.status, headers });
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  const kind = q.get("kind") ?? "event";
  const idParam = q.get("id") ?? "";
  const src = q.get("src") ?? "";
  const occ = q.get("occ") ?? "";
  const v = q.get("v") ?? "";
  const wf = parseLiveLayout(kind, q);
  if (wf.layout === "wf1") return wholeFlyerLoader(idParam, occ, v, wf.size, request.headers.get("if-none-match"));
  if (wf.layout === "wf1-invalid") {
    const legacyUrl = new URL(url);
    legacyUrl.searchParams.delete("l");
    legacyUrl.searchParams.delete("s");
    // No conditional headers: a 304 would answer for a different URL's bytes.
    const legacy = await loader({ request: new Request(legacyUrl) } as Route.LoaderArgs);
    return markInvalidWholeFlyerSize(legacy);
  }
  // Test-only switch (docs/briefs/og-tall-card-test.md): honoured for events
  // only, ignored for any other value or kind, and part of the etag.
  const layout = kind === "event" && q.get("layout") === "tall" ? "tall" : "";
  const ifNoneMatch = request.headers.get("if-none-match");

  try {
    if (kind === "image") {
      // No entity here, so no facts to fold in -- the etag is a pure
      // function of the query params and the 304 short-circuit stays free
      // of any RPC read, per the cache-key redo's rule that this route must
      // not gain an unconditional early read (queued_og_branded_card_etag_
      // cache_key_work.md).
      const etag = makeEtag(kind, idParam, src, occ, v);
      if (ifNoneMatch === etag) return new Response(null, { status: 304 });
      if (!src) return redirectToStatic("image-missing-src");
      // Checked here as well as inside fetchImageBytes only to NAME the
      // refusal: a refused src must read as a policy decision, not as a dead
      // origin. fetchImageBytes refuses it regardless.
      if (!isAllowedOgImageSource(src)) return redirectToStatic("image-source-disallowed");
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic("image-source-unfetchable");
      return imageResponse(await buildImageCard(bytes), etag);
    }
    if (!idParam) return redirectToStatic("missing-id");

    // While the flag is off, ogFactsTag always returns "" (its own guard),
    // so this params-only etag IS the eventual full etag -- check it before
    // any RPC and restore the original free 304 fast path exactly, for the
    // state this ships in. Doing this ALSO means a transient RPC blip on a
    // conditional GET cannot clobber a client's valid cached etag with a
    // blank fallback card while the flag is off (see the card-data-unavailable
    // branch below, which has no such protection once the flag is on and
    // this check can no longer run early). `etag` is declared here, not
    // recomputed below, so the flag-off state never hashes the same string
    // twice for one request.
    let etag = makeEtag(kind, idParam, src, occ, v, "", layout);
    if (!OG_BRANDED_CARD_ENABLED && ifNoneMatch === etag) return new Response(null, { status: 304 });

    const id = await resolveOgEventId(idParam);
    if (!id) return redirectToStatic("unresolvable-id");
    const cardData = kind === "festival" ? await fetchFestivalCardData(id) : await fetchEventCardData(id, occ || null);
    if (!cardData) {
      // No etag arg here on purpose: imageResponse ignores it whenever a
      // fallback reason is passed (see its "NO ETag" comment), so the params-
      // only `etag` above -- already computed, never a fresh hash -- is
      // simply discarded.
      return imageResponse(await buildFallbackCard(null, null, null), "", "card-data-unavailable");
    }

    // Facts are known only now, so the conditional check moves here for
    // entity kinds with the flag ON: an earlier, params-only etag would let
    // a title/date/venue/type edit 304 forever against a crawler's cached
    // preview whenever the cover (and so `v=`) had not also changed. The
    // cost is a guaranteed RPC read on every conditional GET once the flag
    // is on, traded deliberately for that correctness; the flag-off fast
    // path above is what keeps that cost from applying today. A degraded
    // response below never carries this etag anyway (see imageResponse's
    // "NO ETag" comment), so nothing here weakens that invariant. Recomputed
    // (not reused) ONLY when the flag is on, since `facts` is unknown until
    // cardData exists -- while the flag is off this is a no-op re-hash of
    // the same string, which the branch above already returned on.
    if (OG_BRANDED_CARD_ENABLED) {
      const facts = ogFactsTag(cardData);
      etag = makeEtag(kind, idParam, src, occ, v, facts, layout);
      if (ifNoneMatch === etag) return new Response(null, { status: 304 });
    }
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
    // Through a real og:image it is a resolver disagreement. Both sides now
    // pick the cover with pickEventCoverSource(cover ?? hero, photo_urls)
    // (useEventPageQuery and ogCardRender), this endpoint then falling back to
    // venue.image_url, so a page that promises a picture should never get a
    // card without one. Kept as a tripwire for the day the two resolvers drift
    // apart again (they did until 2026-10-20: hero and gallery were page-only).
    // The two
    // reasons stay distinct because they need different diagnoses: a dead URL
    // is a storage problem, an absent one a resolver problem.
    if (!coverBytes) {
      return imageResponse(
        await buildFallbackCard(cardData.title, cardData.dateLine, cardData.venueLine),
        etag,
        hasCoverUrl ? "cover-unfetchable" : "cover-absent",
      );
    }
    // Branded card or raw letterbox -- buildCoverCard owns that choice for both
    // this route and the bake. kind=image above keeps buildImageCard: it has a
    // source URL and no entity, so there are no facts to draw on the card.
    if (layout === "tall") return imageResponse(await buildTallCard(coverBytes, cardData), etag, null, true);
    return imageResponse(await buildCoverCard(coverBytes, cardData), etag);
  } catch (err) {
    console.error("[og/card] render_failed", err);
    return redirectToStatic("render-error");
  }
}
