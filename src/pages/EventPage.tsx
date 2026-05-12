import { lazy, Suspense } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoPage } from '@/modules/event-page/bento/BentoPage';
import { useEventPage } from '@/modules/event-page/useEventPage';

// Festivals hit /event/:id when linked from calendars that don't know the type.
// Render the dedicated FestivalDetail page in that case — lazy so standard
// events don't pay for the festival bundle.
const FestivalDetail = lazy(() => import('@/pages/FestivalDetail'));

const FestivalFallback = () => (
  <div className="mx-auto w-full max-w-6xl space-y-3 px-3 pt-[84px] pb-24">
    <Skeleton className="h-64 w-full rounded-2xl" />
    <Skeleton className="h-32 w-full rounded-2xl" />
  </div>
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EventPageInner = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const requestedOccurrenceId = new URLSearchParams(location.search).get('occurrenceId');

  // Guard: non-UUID IDs (e.g. /event/fdfdg) would cause Postgres to throw
  // "invalid input syntax for type uuid". Disable all queries and show not-found.
  const validId = id && UUID_RE.test(id) ? id : null;

  // isFestival resolution lives inside useEventPage (festival detail RPC +
  // dayed-schedule / passes check). Calling it at this level means both
  // branches share the same query cache.
  const { isFestival } = useEventPage(validId, requestedOccurrenceId);

  if (!validId) {
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
        <FestivalDetail />
      </Suspense>
    );
  }

  return <BentoPage eventId={validId} occurrenceId={requestedOccurrenceId} />;
};

const EventPage = () => (
  <PageErrorBoundary>
    <EventPageInner />
  </PageErrorBoundary>
);

export default EventPage;
