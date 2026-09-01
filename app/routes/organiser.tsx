import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { createQueryClient } from "@/App";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { resolvePublicName, type PublicNameSource } from "@/lib/publicName";
import {
  fetchOrganiserEntity,
  fetchOrganiserEvents,
  fetchOrganiserFutureOccEvents,
  fetchOrganiserPastOccEvents,
  organiserEntityQueryKey,
  organiserEventsQueryKey,
  organiserOccEventsQueryKey,
  organiserOccEventsPastQueryKey,
} from "@/modules/profile/organiserPublicProfile";
import OrganiserProfile from "@/pages/OrganiserProfile";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { stampOrganiser, ORGANISERS } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import { truncate } from "../truncate";
import type { Route } from "./+types/organiser";

// -- Why this loader exists --------------------------------------------------
// This route was promoted to a framework route WITHOUT a loader, which is the
// worst of both routing systems: SSR runs, with no data. During SSR
// OrganiserProfile's entity query is `enabled: false`, and a disabled React
// Query v5 query is `pending` + `idle` -- so `isLoading` is FALSE, the skeleton
// branch is skipped, and control falls straight into `error || !entity`. All 34
// organiser pages therefore server-rendered `<h1>Organiser not found</h1>` with
// HTTP 200 on valid, published organisers. Google's URL Inspection API returned
// the verdict "Soft 404".
//
// Mirrors app/routes/dancers.tsx / venue-entity.tsx: resolve -> 404 on a genuine
// miss -> dehydrate the SAME query keys the page reads, so the server renders
// the real profile and the client hydrates without refetching.
//
// The entity fetch and the three feed prefetches below all come from
// @/modules/profile/organiserPublicProfile -- the single definition
// OrganiserProfile.tsx's own client queries also call. See that module's
// header comment for why (this used to be four hand-copied implementations).

export async function loader({ params, request }: Route.LoaderArgs) {
  // Locked: flag-derived, identical for every id, busts on the next deploy.
  // Coarse group tag only (mirrors venue-entity).
  if (!flags.organiserDetail) return taggedData({ locked: true as const }, ORGANISERS);

  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "organiser_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Organiser");
  redirectUuidToSlug(ref, request, "/organisers");

  // A thunk, not an eager promise: `ref.slug` is populated ONLY when
  // resolveEntityInLoader's own row lookup actually matched a row (see that
  // function) -- a syntactically-valid but nonexistent uuid falls back to
  // `id: param` with `slug: null`, so firing these unconditionally burned 3
  // wasted RPC round trips on every hit to a random/expired/deactivated
  // organiser id, repeated on every request (no cache tag on a 404). Gating
  // on ref.slug fires them CONCURRENTLY with the entity fetch below for the
  // confirmed-to-exist case (the overwhelming majority of real traffic --
  // every canonical slug URL and every uuid that already resolved), and
  // otherwise defers to right after the entity check, matching the original
  // sequential order so a genuine miss never pays for prefetches at all.
  //
  // Prefetch the events the page shows, or the fix trades one thin page for
  // another: an organiser with a real <h1> and no content is still a soft 404 to
  // Google. prefetchQuery, not fetchQuery -- the page treats each as optional
  // (`= []` defaults, errors swallowed to empty), so a failure here must degrade
  // to a client fetch rather than 500 a page whose primary entity loaded.
  //
  // The past feed is included even though it sits below the fold in an
  // accordion, because WITHOUT it the crawled document states "0 Past events"
  // and "-- Since" about organisers that have years of history -- thin AND
  // wrong. It costs nothing in wall-clock: measured against prod 2026-09-01 it
  // returns in ~550ms against the future feed's ~1210ms, and these run
  // concurrently, so it finishes well inside a request that was already waiting.
  // Re-measure before assuming that still holds. The team roster stays
  // client-side: two sequential round trips for content no crawler ranks on.
  //
  // Promise.all, not allSettled: every queryFn below already swallows its own
  // error to `[]`, so prefetchQuery never rejects -- allSettled's per-item
  // status was dead weight nothing read.
  const startFeeds = () =>
    Promise.all([
      qc.prefetchQuery({
        queryKey: organiserEventsQueryKey(ref.id as string),
        queryFn: () => fetchOrganiserEvents(ref.id as string),
        staleTime: 5 * 60 * 1000,
      }),
      qc.prefetchQuery({
        queryKey: organiserOccEventsQueryKey(ref.id as string),
        queryFn: () => fetchOrganiserFutureOccEvents(ref.id as string),
        staleTime: 5 * 60 * 1000,
      }),
      qc.prefetchQuery({
        // Same key AND same 10-year window as OrganiserProfile's own past query
        // -- guaranteed now, not hand-synced: fetchOrganiserPastOccEvents computes
        // the window itself, once, for both callers.
        queryKey: organiserOccEventsPastQueryKey(ref.id as string),
        queryFn: () => fetchOrganiserPastOccEvents(ref.id as string),
        staleTime: 5 * 60 * 1000,
      }),
    ]);
  const feeds = ref.slug ? startFeeds() : null;

  const entity = await qc.fetchQuery({
    queryKey: organiserEntityQueryKey(ref.id as string),
    queryFn: () => fetchOrganiserEntity(ref.id as string),
    staleTime: 5 * 60 * 1000,
  });
  if (!entity) throwDetailNotFound("Organiser");

  await (feeds ?? startFeeds());

  const row = entity as Record<string, unknown>;
  return taggedData(
    {
      locked: false as const,
      dehydratedState: dehydrate(qc),
      // resolvePublicName, not `row.name`: it returns null rather than an id or a
      // placeholder, and buildSeoForRoute noindexes a .detail route on a falsy
      // entityName. A nameless organiser therefore gets 200 + noindex instead of
      // an indexed "Organiser - Bachata Organiser, London" duplicate.
      entityName: resolvePublicName(row as PublicNameSource) ?? undefined,
      // The SLUG, never params.id -- a uuid-shaped canonical splits the page's
      // ranking signals across two URLs. redirectUuidToSlug above means a request
      // that arrived by uuid has already 301'd, so ref.slug is normally set.
      entitySlug: ref.slug ?? params.id,
      cityDisplay: (row.cities as { name?: string } | null)?.name ?? undefined,
      // The organiser's own bio, exactly as middleware.ts's fetchOrganiserMeta
      // serves it to bots today. Without this the matcher retirement would be a
      // DOWNGRADE for every organiser who wrote one: they would trade a real
      // description for the generic "<name> runs bachata events in <city>".
      bioDescription: truncate(row.bio as string | null, 160) || undefined,
      ogImage: normalizeOgImage({
        rawUrl: row.avatar_url as string | null,
        request,
        fallbackImage: DEFAULT_OG_IMAGE,
      }),
    },
    stampOrganiser(ref.id),
    // Zero edge TTL, deliberately. Nothing purges an organiser tag: there is no
    // 'organiser' entity type in the admin's _emit_cache_revalidation_v1 (see
    // app/cacheTags.ts), AND this page writes organiser_profiles directly from
    // the client on claim/edit, which bypasses the revalidation webhook entirely.
    // With the default policy an organiser's own edit would stay invisible to
    // them for up to 25 hours. SSR-fresh-every-request is the honest setting
    // until an emit exists; raise it in the same change that adds one.
    { edgeTtlBoundSeconds: 0 },
  );
}

// Phase 4a ISR -- forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export const meta: Route.MetaFunction = ({ data }) => {
  // When the flag is OFF, ComingSoonGate renders the placeholder and meta()
  // emits noindex in the raw SSR HTML (the gate's own noindex is a client-only
  // useEffect that never runs on the server).
  // Narrowed with `in`, not `data.locked`: under this repo's non-strict tsconfig
  // the boolean discriminant does not narrow the loader's return union, so
  // `data.locked` leaves every field below a type error (the same five errors
  // app/routes/teachers.tsx and venue-entity.tsx still carry). Do not "tidy" this
  // back to the flag without re-running `npm run typecheck`.
  //
  // The key is `dehydratedState`, NOT `entityName`: entityName is deliberately
  // `undefined` for a nameless organiser, so narrowing on it would make the
  // correct head depend on an undefined-valued key surviving serialization -- and
  // if it ever did not, a real organiser would be titled "Coming soon".
  // dehydratedState is always present and never undefined in that branch.
  if (!data || !("dehydratedState" in data)) {
    return [
      { title: "Coming soon - Organiser - Bachata Calendar" },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }
  // Was a hand-written, canned title/description/canonical block -- the same
  // per-route head duplication middleware.ts exists to paper over. Now derived
  // from loader data like every other detail route, which is what lets the
  // /organisers matcher be retired from middleware.ts (separate commit).
  const seo = buildSeoForRoute("organiser.detail", {
    entityName: data.entityName,
    entitySlug: data.entitySlug,
    cityDisplay: data.cityDisplay,
    ogImage: data.ogImage,
  });
  // Prefer the organiser's own words over the route template, but keep every
  // other field (title, canonical, og:*, and crucially the noindex derived from
  // a falsy entityName) coming from buildSeoForRoute.
  return seoInputToMeta({ ...seo, description: data.bioDescription ?? seo.description });
};

export default function OrganiserRoute({ loaderData, params }: Route.ComponentProps) {
  const gate = (
    <ComingSoonGate enabled={flags.organiserDetail} title="Organiser" section="organiser_detail">
      {/* key={params.id} resets per-organiser state on param-only navigation. */}
      <InitialVisiblePageTransition key={params.id}>
        <OrganiserProfile />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
  // Same `in` narrowing as meta() above, for the same reason.
  if (!loaderData || !("dehydratedState" in loaderData)) return gate;
  return <HydrationBoundary state={loaderData.dehydratedState}>{gate}</HydrationBoundary>;
}
