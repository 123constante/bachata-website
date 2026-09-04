import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { pinDayAndBound } from "@/lib/londonDate";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { festivalDetailQueryKey, fetchFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import { festivalEventQueryKey, fetchFestivalEventRow } from "@/modules/event-page/festivalEventQuery";
import { endedRunSentence } from "@/modules/event-page/endedShareDescription";
// Aliased: the page component below is also called FestivalDetail.
import type { FestivalDetail as FestivalDetailData } from "@/modules/event-page/types";
import FestivalDetail from "@/pages/FestivalDetail";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  resolveOgCardImage,
} from "../detailLoader";
import { stampFestival } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import { HEAD_DESCRIPTION_MAX, truncate } from "../truncate";
import type { Route } from "./+types/festival";

// /festival/:id — resolves events slug→uuid then prefetches the three queries
// FestivalDetail mounts (festival-event basic row, festival-snapshot event_view_p5,
// and the parsed festival-detail via the shared exported key + parser), so the
// cinematic page SSRs with content. 404+noindex when the id isn't a live festival.
export async function loader({ params, request }: Route.LoaderArgs) {
  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "events", params.id);
  if (!ref.id) throwDetailNotFound("Festival");
  redirectUuidToSlug(ref, request, "/festival");
  const eventId = ref.id as string;

  // festival-event is the GATING query (drives the 404). Use fetchQuery (not
  // prefetchQuery, which swallows errors) so a TRANSIENT supabase error
  // propagates → retryable 500, not a 404+noindex of a live festival. null =
  // genuine miss / not-a-festival → 404. See app/routes/event.tsx.
  const [festival] = await Promise.all([
    qc.fetchQuery({
      queryKey: festivalEventQueryKey(eventId),
      queryFn: () => fetchFestivalEventRow(eventId),
    }),
    qc.prefetchQuery({
      queryKey: ["festival-snapshot", eventId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("event_view_p5" as never, {
          p_target: { series_id: eventId },
          p_viewer: { role: "anon", shape: "snapshot_compat" },
        } as never);
        if (error) throw error;
        return data as Record<string, unknown> | null;
      },
    }),
    qc.prefetchQuery({
      queryKey: festivalDetailQueryKey(eventId),
      // Shared fetcher = same RPC (_v2) + same parse as the client hook, so the
      // dehydrated entry matches what the client would fetch byte-for-byte.
      queryFn: async () => fetchFestivalDetail(eventId),
      staleTime: 1000 * 60,
    }),
  ]);

  if (!festival) throwDetailNotFound("Festival");

  // The FESTIVAL's own calendar -- the one "today" has to be answered on, since
  // the hero's label is about the festival and not about London.
  //
  // Read back off the prefetch above, so it costs no extra request. The
  // `?? "Europe/London"` mirrors FestivalDetail's own eventTz default EXACTLY:
  // if the two ever disagree, server and client derive different keys and the
  // pin becomes the bug it exists to prevent. (dateKeyInTz also degrades to
  // London on a missing/invalid zone.)
  //
  // But `prefetchQuery` SWALLOWS errors, so `undefined` here means that fetch
  // FAILED -- which is not the same as a festival carrying no timezone. On that
  // path the client's own query refetches and succeeds, so it holds the real
  // zone while this document was pinned on London's: for an Asia/Tokyo festival
  // the two calendars sit 9 hours apart and the crawled hero reads "In 1 day"
  // where it should read "Today". Rendering on the fallback is still right --
  // the detail prefetch is deliberately non-gating, a blip must not 500 the page
  // -- but a GUESSED calendar must not also earn a cache TTL, so `zoneResolved`
  // fails the bound closed below.
  const detail = qc.getQueryData(festivalDetailQueryKey(eventId)) as
    | FestivalDetailData
    | null
    | undefined;
  const zoneResolved = detail !== undefined;
  const festivalTz = detail?.dates?.timezone ?? "Europe/London";

  // Phase 5 — normalize og:image/twitter:image (prefer the R2-baked festival card,
  // else a live /api/og/card render) so WhatsApp/Facebook/Twitter/LinkedIn always
  // get a renderable JPEG instead of a raw (often WebP) poster URL. The schema.org
  // JSON-LD `image` (buildEventJsonLd, rendered by FestivalDetail) is unaffected —
  // Google's structured-data parser handles WebP fine. Mirrors app/routes/event.tsx
  // and lets middleware.ts's /festival matcher be retired.
  const ogImage = await resolveOgCardImage({
    entityType: "festival",
    entityId: eventId,
    coverUrl: (festival.poster_url as string | null) ?? undefined,
    request,
    fallbackImage: DEFAULT_OG_IMAGE,
  });

  // "Today" on that calendar, for the hero's days-away label. Derived in the
  // LOADER rather than the component because the label is clock-read: rendered
  // client-side only it can never appear in the crawled HTML, and rendered
  // without a pinned key it straddles midnight between server and hydration
  // (#418).
  //
  // And derived HERE, below every await. resolveOgCardImage can take seconds,
  // and a loader that entered at 23:59:50 leaves after the festival's midnight.
  // Deriving the key on the way IN pinned yesterday into a document emitted
  // today: the hero then renders "Happening now" for a festival that has
  // finished, and the reader -- or Googlebot, whose single crawl is the audience
  // this whole mechanism exists for -- is served that claim. Declining to CACHE
  // it, which is all the bound can do, does not unsay it. Nothing between here
  // and the loader's entry reads the key, so late is free.
  //
  // Key and bound together, so the gap between the two clock reads cannot leave
  // a stale key in the emitted document -- see pinDayAndBound.
  const { dayKey: todayKey, boundSeconds } = pinDayAndBound(festivalTz);

  // Series-termination arc W14 -- the ended share copy, for THIS url too.
  //
  // /event/<slug> and /festival/<slug> both serve this page, and only the first
  // had ended-aware share copy: this route takes its description from the
  // festival.detail SEO template, which ends "...dates, line-up, location and
  // tickets". On a finished festival that is the same defect W14 names, one URL
  // over -- and /festival is the surface the festival.detail spec calls
  // canonical, so it is the one a share is most likely to carry.
  //
  // READ RAW, at the SAME strictness the component uses, and that is the whole
  // point of these lines rather than an implementation detail. The first version
  // ran the payload through parseEventPageSnapshot -- the CLIENT'S contract
  // check, which THROWS on a payload missing any required key (event_id,
  // event.actions, location_default, attendance). Two things went wrong with
  // that. Unguarded it turned a swallowed prefetch failure into a 500 on a live
  // festival page, to decide one line of copy (caught by
  // tests/festivalLoaderEdgeTtl). And once guarded with try/catch it produced a
  // subtler bug: FestivalDetailInner reads `lifecycle_status` straight off the
  // raw payload, so an ended payload missing a key the PARSER wants -- but not
  // one this decision needs -- rendered the tombstone while the document shipped
  // "...dates, line-up, location and tickets". That is exactly the page/preview
  // contradiction W14 exists to remove, re-created in the other direction.
  //
  // One reader, one strictness. endedRunSentence owns the sentence (the /event
  // route reaches it through buildEventShareDescription), so both URLs still
  // emit the same string, and this cannot throw on any payload shape. Null on
  // every other lifecycle: the template below is right for a live festival.
  const shareSnap = qc.getQueryData(["festival-snapshot", eventId]) as
    | { event?: Record<string, unknown> | null }
    | undefined;
  const shareEvent = shareSnap?.event ?? null;
  const asText = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
  const endedDescription =
    shareEvent?.lifecycle_status === "ended"
      ? endedRunSentence({
          format: asText(shareEvent.format),
          type: asText(shareEvent.type),
          category: asText(shareEvent.category),
          ranFrom: asText(shareEvent.ran_from),
          endedOn: asText(shareEvent.ended_on),
        })
      : null;

  // `zoneResolved` overrides the bound entirely: with the detail prefetch failed
  // the pin rests on a GUESSED calendar, and edgeCacheControl's own rule is that
  // not knowing how long the content stays true means caching none of it. The
  // document still renders on the London fallback; it just may not be stored.
  const edgeTtlBoundSeconds = zoneResolved ? boundSeconds : 0;

  return taggedData(
    {
      dehydratedState: dehydrate(qc),
      entityName: (festival.name as string | null) ?? undefined,
      entitySlug: ref.slug ?? params.id,
      cityDisplay: (festival.city as string | null) ?? undefined,
      ogImage,
      todayKey,
      endedDescription,
    },
    // The same events.id is reachable at /event/:id AND /festival/:id, so tag
    // both surfaces — a single edit to that row purges both pages.
    stampFestival(eventId),
    // ...and this document may not outlive the day it just pinned.
    //
    // `todayKey` is baked into edge-cached HTML and the hero renders a CLAIM
    // off it -- "Happening now" mid-run. The default edge policy (s-maxage
    // 3600 + SWR 86400) lets ONE generation be served for 25 hours: a document
    // rendered at 23:20 on a multi-day festival's last day, served stale at
    // 00:40 the next morning, tells a reader -- or Googlebot, which indexes the
    // raw HTML -- that a finished festival is running. Nothing evicts it: time
    // passing is not a content edit, so the tag purge never fires, and the
    // 04:30 UTC daily redeploy leaves the whole midnight-to-04:30 window open.
    // Bounding the TTL at the festival's own rollover makes the first request
    // of the new day revalidate and re-derive. Same fix covers the softer
    // errors: an "In 3 days" countdown off by one, and a schedule "today"
    // badge sitting on yesterday's tab.
    //
    { edgeTtlBoundSeconds },
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export const meta: Route.MetaFunction = ({ data }) => {
  const seo = buildSeoForRoute("festival.detail", {
    entityName: data?.entityName,
    entitySlug: data?.entitySlug,
    cityDisplay: data?.cityDisplay,
    ogImage: data?.ogImage,
  });
  // W14: an ended run replaces the description outright rather than prefixing
  // it, for the reason endedShareDescription's own docblock gives -- appending
  // would leave the sell ("...location and tickets") in the preview, which is
  // the whole defect. Title, canonical and og:image are unaffected.
  const input = data?.endedDescription
    ? { ...seo, description: data.endedDescription }
    : seo;
  // Clipped at the input, matching /event (app/routes/event.tsx) -- and clipped
  // in meta() rather than the loader because BOTH candidate strings have to
  // pass through it and only one of them comes from the loader.
  //
  // Neither is stored copy: unlike /event this route never emits the raw
  // description, so there is no 5,536-character string to catch here. What it
  // does emit is a template, `<name> - dates, line-up, location and tickets.`,
  // whose 40-character suffix leaves a 120-character budget for the festival
  // name -- and the ended sentence, measured at 142 worst-case. So this clip is
  // a no-op for every festival with a name under 120 characters, which today is
  // all of them. It is here so the bound is a property of the head rather than
  // of the current data, since the name is organiser-entered and unbounded.
  return seoInputToMeta({
    ...input,
    description: truncate(input.description, HEAD_DESCRIPTION_MAX),
  });
};

export default function FestivalRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      <InitialVisiblePageTransition key={params.id}>
        <FestivalDetail serverTodayKey={loaderData.todayKey} />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
