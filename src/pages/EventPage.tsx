import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEventPage } from '@/modules/event-page/useEventPage';
import { EventPageScreen } from '@/modules/event-page/EventPageScreen';

const EventPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const requestedOccurrenceId = new URLSearchParams(location.search).get('occurrenceId');
  const { pageModel, festivalDetail, isFestival, isRsvpPending, toggleRsvp } = useEventPage(id, requestedOccurrenceId);

  const handleBack = () => navigate(-1);
  const handleToggleRsvp = () => {
    const isCurrentlyGoing = pageModel.attendance.ctaLabel === "You're Going";
    toggleRsvp(!isCurrentlyGoing);
  };

  if (pageModel.page.state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[84px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      isRsvpPending={isRsvpPending}
      onBack={handleBack}
      onToggleRsvp={handleToggleRsvp}
    />
  );
};

export default EventPage;
