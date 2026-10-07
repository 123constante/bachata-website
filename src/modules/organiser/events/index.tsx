import { OrganiserShell } from '../shell';
import { EmptyState } from '../ui';
import { EventListPlaceholder } from './EventListPlaceholder';

/** PLACEHOLDER (W0). Owner: W2. /account/o/events */
export default function EventsPage() {
  return (
    <OrganiserShell
      title="Events"
      testId="org-page-events"
      list={<EventListPlaceholder />}
      detailPlaceholder={<EmptyState title="Pick an event" body="Choose an event on the left to edit it." />}
    />
  );
}
