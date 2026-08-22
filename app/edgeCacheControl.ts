// Dependency-free leaf module (mirrors app/cacheTags.ts): zero imports, by
// design. app/detailLoader.ts re-exports everything below so existing
// importers are unaffected, but middleware.ts (Edge runtime) imports THIS
// file directly. detailLoader.ts pulls in react-router + @/integrations/
// supabase/getSupabase + @/lib/seo, none of which the Edge middleware bundle
// can resolve -- a previous change routed middleware.ts's cache-control
// header through detailLoader's edgeCacheControl() and broke the Vercel
// deploy (#272): the Edge Function build failed with "referencing unsupported
// modules" for @/integrations/supabase/getSupabase, @/lib/seo, and
// @/lib/seo/resolvePublicEventRef, none of which middleware.ts ever touches
// itself -- they arrived purely through this transitive import. Round 1 of
// that fix verified the OUTPUT STRING was byte-identical and never checked
// the IMPORT GRAPH; that is the miss this module exists to prevent from
// recurring. Keep it import-free. If a future edit needs anything from
// react-router, @/integrations, or @/lib here, that is a sign the function
// belongs in detailLoader.ts instead, not a reason to relax this file.

// -- Phase 4a ISR -- edge caching -----------------------------------------
// Vercel STRIPS Vercel-CDN-Cache-Control + Vercel-Cache-Tag from the client
// response (they're internal edge directives); the edge caches on s-maxage and
// reports X-Vercel-Cache: HIT/MISS. A content edit purges by tag on demand
// (see api/revalidate.ts + the Supabase webhook). headers() can't see loader
// data, so the per-entity tag is attached in the loader via taggedData() and
// forwarded here. The tag id is the entity's public URL id (per
// useEntitySlugOrId) -- the same id the DB emit resolves.
const EDGE_S_MAXAGE = 3600;
const EDGE_SWR = 86400;

/** Slack between the loader measuring a bound (at T0) and the CDN actually
 *  storing the response (T0 + renderTime, after SSR streaming + transfer).
 *  Exported so a test asserts the real number rather than restating it.
 *
 *  The emitted TTL is sized as (deadline - T0) - MARGIN, so the entry expires
 *  at T0 + renderTime + [(deadline - T0) - MARGIN] = deadline + (renderTime -
 *  MARGIN). When renderTime <= MARGIN (the budgeted case), that expiry lands
 *  AT OR BEFORE the deadline -- the safe side, costing only an earlier
 *  revalidation than strictly necessary. A genuinely cold render CAN overrun
 *  MARGIN, and overrunning is the one direction that costs a stale claim: the
 *  entry then expires (renderTime - MARGIN) seconds PAST the deadline, and
 *  every request in that window is served content that has stopped being
 *  true. Sized generously against ordinary SSR latency for that reason, not
 *  because the direction is free. */
export const EDGE_STORE_MARGIN_SECONDS = 5;

// A zero stale window is spelled by OMITTING the directive, never by
// `stale-while-revalidate=0`, so that a layer keying off the directive's
// PRESENCE rather than its value cannot read an explicit zero as "stale serving
// enabled". Note what this does and does not buy, and it is LESS than the
// omission-vs-explicit-zero distinction implies. Scope this to ORIGIN-ERROR
// staleness specifically -- ordinary stale-while-revalidate serving (the
// bounded/unbounded case below, where swr > 0) is NOT affected by any of this
// and is exactly what edgeCacheControl()'s own doc describes: the first
// request after s-maxage IS served the stale copy, by design. What RFC 9111
// 5.2.2.10 (folds `proxy-revalidate` into `s-maxage`) and 5.2.2.8 (a shared
// cache MUST NOT serve a stale response without revalidating, once that
// applies) forecloses is narrower: reusing a stale entry to survive an ORIGIN
// ERROR, which every string this module emits already can't do, `must-
// revalidate` present or not. So an old festival page beating a 500 while
// Supabase is down is NOT a latitude this omission grants; the directive that
// would actually grant it is `stale-if-error`, which nothing here sets.
// Vercel honours the value either way; this is belt to a buckle that was
// never fastened, not the value's braces.
const cacheControl = (sMaxAge: number, swr: number): string => {
  if (swr > 0) return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
  // s-maxage=0 with no stale window is the "not servable from cache" spelling,
  // and omission alone does not get there. By the note above, RFC 9111 already
  // forbids a shared cache from serving this stale on origin error, with or
  // without `must-revalidate` -- so this directive is not withdrawing a latitude
  // the module otherwise relies on; there was none to withdraw. Set anyway
  // because it costs nothing and states the intent explicitly: reaching zero
  // means either the pinned day is already over or the bound did not survive the
  // trip, so the premise is that we do NOT know this document is true, and
  // nothing here should be read as licence to add `stale-if-error` later without
  // re-deriving whether that is actually wanted.
  //
  // BELT, AND UNVERIFIED AT THE EDGE. Be honest about the strength of that ask:
  // Vercel documents its CDN-Cache-Control handling for max-age / s-maxage /
  // stale-while-revalidate / stale-if-error, and `must-revalidate` is not among
  // the directives it states it honours. Nor is there an obvious way for it to
  // matter -- at s-maxage=0 the edge has no stored entry to serve stale in the
  // first place. So this is a directive we emit and assert against our own
  // string builder; it has never been observed changing behaviour on a real
  // deploy. Treat it as defence that costs nothing, NOT as a proven outage
  // guarantee, and do not build a second mechanism on top of it without
  // measuring the edge first.
  if (sMaxAge === 0) return 'public, s-maxage=0, must-revalidate';
  return `public, s-maxage=${sMaxAge}`;
};

/**
 * The edge cache-control for a document, optionally bounded by how long its
 * CONTENT stays true.
 *
 * WHY A BOUND EXISTS. Some loaders bake a clock-read answer into the HTML --
 * /festival/:id pins "today" on the festival's calendar so the hero's timing
 * line ("Tomorrow", "In 3 days", "Happening now") ships in the crawled markup
 * instead of appearing only after hydration. The default 3600 + 86400 lets the
 * edge serve one generation for up to 25 HOURS, so a document rendered at 23:20
 * on a festival's last day can be served, stale, at 00:40 the next morning --
 * to a reader or to Googlebot -- still claiming "Happening now" about an event
 * that has finished. Time passing is not a content edit, so the tag purge never
 * fires. A JS client self-corrects a tick after hydration; the crawled document
 * and the pre-hydration paint do not.
 *
 * WHAT THE BOUND DOES. `boundSeconds` caps TOTAL servability (s-maxage + SWR),
 * not just the fresh window: under stale-while-revalidate the FIRST request
 * after s-maxage is served the stale copy, and that request is exactly the one
 * that matters for a crawler. Collapsing SWR to zero at the boundary makes that
 * request revalidate synchronously and receive a correctly re-derived document.
 *
 * WHAT IT COSTS, HONESTLY. The 3600s fresh window is untouched, but total
 * servability falls from a flat 90000s to whatever is left of the pinned day.
 * A low-traffic page -- which a single festival page is -- previously landed
 * inside the 24h stale window on nearly every hit: an instant HIT with
 * revalidation running behind it. Now the entry is guaranteed dead at that
 * page's midnight, so the first visitor of each day takes a full MISS and
 * blocks on a cold render. A deliberate correctness-over-latency trade, not a
 * free one.
 *
 * THE BUSY-ROUTE RE-WEIGH, DONE. This paragraph used to end "worth re-weighing
 * before adopting the bound on a busy route", and /city/:slug has since adopted
 * it -- so the sentence is spent and must not be inherited a sixth time. Two
 * things changed with that adoption. The bound there is not the day but the
 * next ON-NOW transition, so its expiries are many per evening rather than one
 * per day, and they cluster in the busiest hours; and the miss it forces is on
 * the site's most-requested document rather than a crawler tail. What did NOT
 * change is the direction of the trade: a document asserting an event is on
 * after it finished is worse than a cold render. A future adopter should size
 * BOTH -- boundary density and request volume -- rather than reading either of
 * these two precedents as the general answer.
 *
 * An absent bound keeps the previous behaviour exactly, so untouched routes are
 * byte-identical.
 */
export function edgeCacheControl(boundSeconds?: number): string {
  // No bound asked for: an untouched route, byte-identical to the old policy.
  if (boundSeconds === undefined) return cacheControl(EDGE_S_MAXAGE, EDGE_SWR);
  // Asked for a bound and it did not survive the trip. FAIL CLOSED to NO edge
  // caching -- "absent" and "corrupt" must not collapse into the same case, or a
  // single typo in the side channel silently restores the 25-hour policy on the
  // one route that declared it cannot tolerate it. Keeping the fresh hour was
  // the first instinct and it is wrong: an hour IS the defect window. The
  // motivating example twenty lines up is a document rendered at 23:20 served at
  // 00:40, and a corrupt bound near midnight reproduces it exactly. A broken
  // bound means we do not know how long this content is true, so we cache none
  // of it.
  //
  // SIZE THE FAILURE MODE HONESTLY, AND RE-SIZE IT WHEN ROUTES ADOPT THE BOUND.
  // This read "only /festival is bounded today, so the cost is one origin render
  // per request on one route, not a site-wide storm" while that was true. It no
  // longer is: FIVE route modules are bounded, covering ten URLs (/festival/:id,
  // /london-bachata-guide, /learn-bachata-london, the seven
  // /bachata-london-{weekday} pages, and now /city/:slug), and the landing pages
  // are precisely the ones whose crawl budget and TTFB the SSR arc was built
  // for. So a side channel that breaks now takes all of them to 100% origin
  // render at once -- INCLUDING the homepage, which is no longer a tail of
  // crawler traffic but the document most human visitors load first.
  // The trade still holds -- an hour of a false "Happening now" served to
  // Googlebot is worse than an hour of slow-but-correct pages, and the channel
  // is an internal header between two functions in this file, not user input --
  // but it is now a real cost rather than a rounding error, and the next route
  // to adopt the bound should re-weigh it rather than inherit this sentence.
  //
  // Infinity is the natural spelling of "this content has no expiry", and it is
  // NOT the corrupt case -- it is a caller asking for the MOST permissive policy
  // available. Falling into the branch below would hand it the least permissive
  // one, which is the sort of inversion nothing at the call site would reveal.
  // Answered with the unbounded default rather than a literal forever, because
  // s-maxage is capped by EDGE_S_MAXAGE either way.
  //
  // Reachable ONLY from a direct caller, never from the side channel:
  // parseEdgeTtlBound fails a non-finite parse closed, so a broken producer
  // writing 'Infinity' or '9e999' into the header cannot use this branch to
  // hand itself back the 25-hour policy. "No expiry" is a thing a caller means,
  // not a thing a corrupt string gets to claim.
  if (boundSeconds === Number.POSITIVE_INFINITY) return cacheControl(EDGE_S_MAXAGE, EDGE_SWR);
  if (!Number.isFinite(boundSeconds)) return cacheControl(0, 0);
  // The bound was measured inside the loader; Vercel starts the s-maxage clock
  // when it STORES the response, after React has streamed the whole tree to the
  // edge. That gap is unmeasurable from here and always runs one way, so every
  // entry would outlive its day by the render time. Floor and subtract.
  const bound = Math.min(
    EDGE_S_MAXAGE + EDGE_SWR,
    Math.max(0, Math.floor(boundSeconds) - EDGE_STORE_MARGIN_SECONDS),
  );
  const sMaxAge = Math.min(EDGE_S_MAXAGE, bound);
  return cacheControl(sMaxAge, bound - sMaxAge);
}
