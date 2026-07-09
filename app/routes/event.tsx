import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "react-router";
import { stampEvent } from "../cacheTags";
import { cacheHeaders, resolveOgCardImage, taggedData } from "../detailLoader";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { eventPageQueryKey, parseEventPageSnapshot } from "@/modules/event-page/useEventPageQuery";
import { festivalDetailQueryKey, parseFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import type { EventPageSnapshot, FestivalDetail } from "@/modules/event-page/types";
import { festivalEventQueryKey, fetchFestivalEventRow, sniffIsFestival } from "@/modules/event-page/festivalEventQuery";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { SITE_ORIGIN } from "@/lib/seo";
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

  // 1. Resolve slug → uuid (mirrors useEntitySlugOrId, idColumn 'id').
  const resolved = await qc.fetchQuery({
    queryKey: ["entity-resolve", "events", "id", routeParam],
    queryFn: async () => {
      const whereCol = isUuid ? "id" : "slug";
      const { data: row, error } = await supabase
        .from("events")
        .select("id, slug")
        .eq(whereCol, routeParam)
        .maybeSingle();
      // Distinguish a TRANSIENT error from a genuine miss: throwing surfaces a
      // retryable 500 rather than 404-ing (deindexing) a valid event on a blip.
      if (error) throw new Error((error as { message?: string }).message ?? JSON.stringify(error));
      if (!row) return null;
      const r = row as Record<string, unknown>;
      return { id: (r.id as string | null) ?? null, slug: (r.slug as string | null) ?? null };
    },
    staleTime: 5 * 60 * 1000,
  });

  const eventId = resolved?.id ?? (isUuid ? routeParam : null);
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
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_public_festival_detail", {
          p_event_id: eventId,
        });
        if (error) throw new Error((error as { message?: string }).message ?? JSON.stringify(error));
        return parseFestivalDetail(data);
      },
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
  const festivalPrefetch = sniffIsFestival(snap, festivalDetail)
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
      description: snap?.event?.description ?? null,
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

// Route-level SEO for the SSR document (humans + non-bot crawlers). Social/search
// BOT UAs are still served the branded OG card + DanceEvent JSON-LD by
// middleware.ts (its /event matcher is restored), so this is the fallback head,
// not the primary bot payload — though og:image is now the SAME normalized,
// R2-baked-or-/api/og/card URL middleware itself would serve (see
// resolveOgCardImage in ../detailLoader), so a crawler that reaches this
// document directly still gets a renderable preview. Emits a PER-PAGE
// canonical (root.tsx's static homepage canonical would otherwise
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
