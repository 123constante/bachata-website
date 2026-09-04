import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "react-router";
import { stampEvent } from "../cacheTags";
import { cacheHeaders, resolveOgCardImage, taggedData } from "../detailLoader";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { eventPageQueryKey, parseEventPageSnapshot } from "@/modules/event-page/useEventPageQuery";
import { festivalDetailQueryKey, fetchFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import type { EventPageSnapshot, FestivalDetail } from "@/modules/event-page/types";
import { festivalEventQueryKey, fetchFestivalEventRow, sniffIsFestival } from "@/modules/event-page/festivalEventQuery";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { HEAD_DESCRIPTION_MAX, truncate } from "../truncate";
import { SITE_ORIGIN } from "@/lib/seo";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import { buildEventShareDescription } from "@/modules/event-page/endedShareDescription";
import EventPage from "@/pages/EventPage";
import type { Route } from "./+types/event";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Matches a UUID prefix without the strict 12-char suffix — a malformed-UUID
// attempt that can't be a slug either. Mirrors useEntitySlugOrId's short-circuit
// so we skip a pointless slug DB query. (Keep in sync with that hook.)
const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-/i;
const OG_FALLBACK = `${SITE_ORIGIN}/og-image.jpg`;

// SPIKE — the /event/:id server loader. Folds the client-side slug→uuid resolve
// (useEntitySlugOrId) + snapshot fetch (useEventPageQuery) onto the server, then
// dehydrates the React Query cache so the client hydrates without refetching.
// Both queryFns MIRROR the hooks byte-for-byte (same keys, same parser) so the
// cache entries are identical. Phase 3 extracts these into a shared fetcher; the
// spike duplicates them to keep the change surface small.
export async function loader({ params, request }: Route.LoaderArgs) {
  const routeParam = params.id;
  const isUuid = UUID_RE.test(routeParam);

  // Malformed-UUID attempt (UUID-shaped prefix, invalid length): can't match a
  // slug either — skip the DB round-trip and 404, mirroring useEntitySlugOrId.
  if (!isUuid && UUID_PREFIX_RE.test(routeParam)) {
    throw new Response("Event not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }

  const qc = createQueryClient();

  // 1. Resolve slug -> uuid (mirrors useEntitySlugOrId, idColumn 'id'). Identity
  //    comes from P5 via the SHARED resolvePublicEventRef (src/lib/seo), which
  //    wraps resolve_public_event_ref_v1: it reads the canonical
  //    event_series_p5.slug, branches slug-vs-uuid internally on the client UUID
  //    regex, and returns {id, slug} where id = COALESCE(legacy_event_id, series
  //    id) -- or SQL NULL, never RAISE. 'throw' distinguishes a TRANSIENT DB error
  //    from a genuine miss, surfacing a retryable 500 rather than 404-ing
  //    (deindexing) a valid event on a blip. One definition, so this stays
  //    byte-parity with the client hook's events branch and the dehydrated
  //    ["entity-resolve","events","id",param] entry matches what the client reads.
  const resolved = await qc.fetchQuery({
    queryKey: ["entity-resolve", "events", "id", routeParam],
    queryFn: () => resolvePublicEventRef(routeParam, "throw"),
    staleTime: 5 * 60 * 1000,
  });

  // The resolver is the authority AND the visibility gate (hidden/archived/draft
  // -> null), so NEVER re-inject the raw uuid: an archived event fetched by its
  // uuid must 404, not 200. Mirrors app/detailLoader.ts.
  const eventId = resolved?.id ?? null;
  const slug = resolved?.slug ?? (isUuid ? null : routeParam);

  if (!eventId) {
    // Genuinely unresolvable → 404 + noindex (mirrors middleware's NOINDEX_404).
    throw new Response("Event not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }

  const url = new URL(request.url);
  const rawOcc = url.searchParams.get("occurrenceId");
  const occurrenceId = rawOcc && UUID_RE.test(rawOcc) ? rawOcc : null;

  // UUID→slug 301 (query preserved, incl. ?occurrenceId): collapse the
  // /event/<uuid> and /event/<slug> cache entries into one canonical slug URL.
  if (isUuid && slug) {
    throw redirect(`/event/${slug}${url.search}`, 301);
  }

  // 2. Prefetch BOTH RPCs the page mounts — in parallel, since each depends only
  //    on eventId. (a) the snapshot (mirrors useEventPageQuery); (b) festival
  //    detail (mirrors useFestivalDetailQuery) — useEventPage fires it for EVERY
  //    event to content-sniff isFestival, so omitting it made the server render a
  //    BentoPage while the client could hydrate into FestivalDetail (structural
  //    mismatch) and always cost a post-hydration round-trip.
  await Promise.all([
    qc.prefetchQuery({
      queryKey: eventPageQueryKey(eventId, occurrenceId),
      queryFn: async () => {
        const { data, error } = await supabase.rpc("event_view_p5" as never, {
          p_target: {
            series_id: eventId,
            ...(occurrenceId ? { occurrence_id: occurrenceId } : {}),
          },
          p_viewer: { role: "anon", shape: "snapshot_compat" },
        } as never);
        if (error) throw new Error((error as { message?: string }).message ?? JSON.stringify(error));
        return parseEventPageSnapshot(data);
      },
      staleTime: 1000 * 30,
    }),
    qc.prefetchQuery({
      queryKey: festivalDetailQueryKey(eventId),
      // Shared fetcher = same RPC (_v2) + same parse as the client hook, so the
      // dehydrated entry matches what the client would fetch byte-for-byte.
      queryFn: async () => fetchFestivalDetail(eventId),
      staleTime: 1000 * 60,
    }),
  ]);

  const snap = qc.getQueryData(eventPageQueryKey(eventId, occurrenceId)) as EventPageSnapshot | null;
  const festivalDetail = qc.getQueryData(festivalDetailQueryKey(eventId)) as FestivalDetail | null;

  // Festival-format events render FestivalDetail at /event/<slug> too, and it
  // mounts a third query (["festival-event", id]) the two prefetches above do
  // not cover. Without it, isFestivalLoading stays true during SSR and the page
  // early-returns a skeleton -- no h1, no JSON-LD in the crawled HTML at the
  // festival's sitemap-canonical URL. Sniff with the same helper the client
  // uses (useEventPage) and prefetch, in parallel with the og:image resolve.
  //
  // It used to feed buildEventShareDescription too, gating the ended share copy
  // shut for anything that routed to FestivalDetail. That gate is GONE (arc
  // W14): FestivalDetail now renders the ended record and suppresses its passes
  // grid, ticket CTAs, promo codes and offers node, so the share copy and the
  // page agree whichever way the sniff goes. Its only remaining job here is the
  // festival-event prefetch below.
  const isFestival = sniffIsFestival(snap, festivalDetail);
  const festivalPrefetch = isFestival
    ? qc.prefetchQuery({
        queryKey: festivalEventQueryKey(eventId),
        queryFn: () => fetchFestivalEventRow(eventId),
      })
    : Promise.resolve();

  // Phase 5 — normalize og:image/twitter:image (prefer the R2-baked card, else
  // a live /api/og/card render) so WhatsApp/Facebook/Twitter/LinkedIn always
  // get a renderable JPEG instead of a raw (often WebP) cover URL. The
  // schema.org JSON-LD `image` field (buildEventJsonLd, rendered by BentoPage)
  // is unaffected — Google's structured-data parser handles WebP fine.
  const [ogImage] = await Promise.all([
    resolveOgCardImage({
      entityType: "event",
      entityId: eventId,
      occId: occurrenceId,
      coverUrl: snap?.event?.imageUrl,
      request,
      fallbackImage: OG_FALLBACK,
    }),
    festivalPrefetch,
  ]);

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      title: snap?.event?.name ?? null,
      // Clipped HERE, at the input, rather than inside seoInputToMeta or the
      // meta() below. The stored description is long-form marketing prose --
      // it is written to SELL the run, and one live event ships 5,536
      // characters of it -- and buildEventShareDescription returns it raw.
      // seoMeta's helper is shared by every route and should keep emitting
      // what it is handed, so the route that knows the copy is unbounded is
      // the one that bounds it. One clip covers both tags meta() emits below.
      //
      // `|| null` because truncate() returns '' for blank input and meta()
      // falls back with `??`, which does not fire on '': without it a
      // description-less event would ship an EMPTY description tag instead of
      // the generic sentence. The ended-run sentence is unaffected either way
      // -- measured at 142 characters worst-case, see HEAD_DESCRIPTION_MAX.
      description: truncate(buildEventShareDescription(snap), HEAD_DESCRIPTION_MAX) || null,
      ogImage,
      slug,
    },
    // The tag id is the public URL id — events.id for bridged events, the series
    // id for P5-native events — matching the DB emit's COALESCE(legacy_event_id, id).
    stampEvent(eventId),
  );
}

// Phase 4a ISR — edge-cache the SSR response + forward the loader's cache tag
// (see ../detailLoader). A thrown 404/500 carries no tag and stays uncached.
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

// Route-level SEO for the SSR document -- for EVERY visitor, bots included. The
// note that used to stand here said middleware.ts still intercepted bot UAs for
// /event and that this was only a fallback head; that is false and was false when
// written. middleware.ts's matcher is ['/teachers/:path*', '/city/:path*'] -- /event
// was retired from it in Phase 5 (2026-07-06), once this route's own JSON-LD
// (BentoPage's buildEventJsonLd) and og:image normalization (resolveOgCardImage in
// ../detailLoader) were verified byte-identical to what middleware emitted. So this
// head IS what WhatsApp, Facebook and Googlebot read, which is why the ended-series
// share copy (buildEventShareDescription, called from the loader) is computed
// server-side rather than anywhere in the client render.
//
// Emits a PER-PAGE canonical (root.tsx's static homepage canonical would otherwise
// self-canonicalize every event to "/").
export const meta: Route.MetaFunction = ({ data }) => {
  const canonical = data?.slug ? `${SITE_ORIGIN}/event/${data.slug}` : SITE_ORIGIN;
  const name = data?.title;
  if (!name) {
    return [
      { title: "Event — Bachata Calendar" },
      { tagName: "link", rel: "canonical", href: canonical },
    ];
  }
  const description =
    data?.description ?? "Bachata event details, line-up and tickets on Bachata Calendar.";
  const ogImage = data?.ogImage ?? OG_FALLBACK;
  return [
    { title: `${name} — Bachata Calendar` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:type", content: "website" },
    { property: "og:title", content: name },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: ogImage },
    // The og:image is always a 1200x630 JPEG (R2-baked card or live /api/og/card;
    // see app/lib/ogCardRender). Declare its dimensions + type so WhatsApp and
    // other crawlers render the link preview at the right size — omitting these
    // on the dynamic-card path degraded event previews (the most-shared surface).
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/jpeg" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
  ];
};

export default function EventRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      {/* key={params.id} reproduces today's full-remount on /event/a → /event/b
          (AnimatedRoutes keyed <Routes> on location.pathname) so param-only
          navigations reset per-event component state (e.g. BentoPage popovers). */}
      <InitialVisiblePageTransition key={params.id}>
        <EventPage />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
