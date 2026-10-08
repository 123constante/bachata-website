import { OrganiserShell } from '../shell';
import { EmptyState } from '../ui';
import { EventList, NewEventLink } from './EventList';

/** /account/o/events -- the organiser's events (W2). */
export default function EventsPage() {
  return (
    <OrganiserShell
      title="Events"
      testId="org-page-events"
      topBarEnd={<NewEventLink />}
      list={<EventList primaryNew />}
      detailPlaceholder={<EmptyState title="Pick an event" body="Choose an event on the left to edit it." />}
    />
  );
}
