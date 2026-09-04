import { Suspense } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoPage } from '@/modules/event-page/bento/BentoPage';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Festivals hit /event/:slugOrId when linked from calendars that don't know the type.
// Render the dedicated FestivalDetail page in that case — lazy so standard
// events don't pay for the festival bundle.
const importFestivalDetail = () => import('@/pages/FestivalDetail');
const FestivalDetail = lazyWithRetry(importFestivalDetail);

// Pre-hydration chunk warm-up. When the server rendered festival content at
// /event/<slug> (SSR resolves the lazy import in-process), client hydration
// suspends on this chunk and the nested Suspense boundary stays dehydrated for
// a full network round-trip -- any state update landing in that window makes
// React bail to client rendering (#421: content -> skeleton -> content flash,
// plus a [hydration] Sentry event per view). Route modules evaluate before
// hydrateRoot, so sniffing the SSR'd DOM here and firing the import shrinks
// that window to a microtask. `.cinematic-festival` is FestivalDetail's scoped
// CSS root -- present iff the server rendered the festival page.
if (typeof document !== 'undefined' && document.querySelector('.cinematic-festival')) {
  void importFestivalDetail();
}

const FestivalFallback = () => (
  <div className="mx-auto w-full max-w-6xl space-y-3 px-3 pt-[84px] pb-24">
    <Skeleton className="h-64 w-full rounded-2xl" />
    <Skeleton className="h-32 w-full rounded-2xl" />
  </div>
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EventPageInner = () => {
  const { id: routeParam } = useParams<{ id: string }>();
  const location = useLocation();
  const rawOccurrenceId = new URLSearchParams(location.search).get('occurrenceId');
  const requestedOccurrenceId = rawOccurrenceId && UUID_RE.test(rawOccurrenceId) ? rawOccurrenceId : null;

  // Slug-or-id: if URL param is a UUID, use as-is and look up the slug for
  // canonical. If it's a slug, look up the UUID before issuing entity queries.
  const { id: validId, slug, isLoading: resolving, notFound, arrivedViaUuid } =
    useEntitySlugOrId(routeParam, 'events');

  // When loaded via UUID, swap the address bar to the slug URL silently.
  useCanonicalReplaceState({
    arrivedViaUuid,
    slug,
    buildPath: (s) => `/event/${s}`,
  });

  // isFestival resolution lives inside useEventPage (festival detail RPC +
  // dayed-schedule / passes check). Calling it at this level means both
  // branches share the same query cache.
  const { isFestival, snapshot } = useEventPage(validId, requestedOccurrenceId);

  // No useSeo() noindex here any more. The route loader resolves the param
  // server-side and throws 404 + X-Robots-Tag: noindex before this component
  // renders (app/routes/event.tsx), so /event/garbage-string never reaches the
  // branch below -- and useSeo() is inert on a framework route regardless
  // (RouteOwnsHeadContext; arc W17). The fallback render stays for the case
  // where the client resolve later contradicts the loader.

  if (resolving && !validId) {
    return <FestivalFallback />;
  }

  if (notFound || !validId) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-24 pb-24 text-center">
        <p className="text-lg font-semibold text-foreground mb-2">Event not found</p>
        <p className="text-sm text-muted-foreground">The event you're looking for doesn't exist or the link may be broken.</p>
      </div>
    );
  }

  if (isFestival) {
    return (
      <Suspense fallback={<FestivalFallback />}>
        <FestivalDetail snapshot={snapshot} />
      </Suspense>
    );
  }

  return <BentoPage eventId={validId} occurrenceId={requestedOccurrenceId} eventSlug={slug} />;
};

const EventPage = () => (
  <PageErrorBoundary>
    <EventPageInner />
  </PageErrorBoundary>
);

export default EventPage;
