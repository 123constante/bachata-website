import { Suspense } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoPage } from '@/modules/event-page/bento/BentoPage';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { useSeo, useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Festivals hit /event/:slugOrId when linked from calendars that don't know the type.
// Render the dedicated FestivalDetail page in that case — lazy so standard
// events don't pay for the festival bundle.
const FestivalDetail = lazyWithRetry(() => import('@/pages/FestivalDetail'));

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

  // Emit noindex SEO when the URL param can't resolve to a real event (after
  // the resolve query has settled). Avoids indexing /event/garbage-string.
  useSeo(
    notFound
      ? { title: 'Event not found', description: 'This event link is invalid or has been removed.', noindex: true }
      : null,
  );

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
