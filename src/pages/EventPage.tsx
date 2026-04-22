import { useParams, useLocation } from 'react-router-dom';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { useRecordEventView } from '@/modules/event-page/useRecordEventView';
import { EventPageScreen } from '@/modules/event-page/EventPageScreen';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

const EventPageInner = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const requestedOccurrenceId = new URLSearchParams(location.search).get('occurrenceId');
  const { pageModel, festivalDetail, isFestival, eventSchedule, isRsvpPending, setRsvp } = useEventPage(id, requestedOccurrenceId);

  useRecordEventView(id, 'public_event_page');

  if (pageModel.page.state === 'loading') {
    return (
      <div className="relative min-h-screen pt-[84px] pb-24">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6 space-y-3 mt-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pageModel.page.state === 'not-found' || pageModel.page.state === 'error' || pageModel.page.state === 'unavailable') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 pt-[84px] text-center px-4">
        <h1 className="text-2xl font-bold">{pageModel.page.title}</h1>
        {pageModel.page.message && <p className="text-muted-foreground">{pageModel.page.message}</p>}
      </div>
    );
  }

  return (
    <EventPageScreen
      pageModel={pageModel}
      festivalDetail={isFestival ? festivalDetail : null}
      eventSchedule={eventSchedule}
      isRsvpPending={isRsvpPending}
      setRsvp={setRsvp}
    />
  );
};

const EventPage = () => (
  <PageErrorBoundary>
    <EventPageInner />
  </PageErrorBoundary>
);

export default EventPage;
