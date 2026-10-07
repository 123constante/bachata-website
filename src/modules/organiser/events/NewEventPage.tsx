import { OrganiserShell, ORG_PATHS } from '../shell';
import { EmptyState } from '../ui';

/** PLACEHOLDER (W0). Owner: W2. /account/o/events/new */
export default function NewEventPage() {
  return (
    <OrganiserShell title="New event" back={{ to: ORG_PATHS.events, label: 'Events' }} testId="org-page-new-event">
      <EmptyState title="New event" body="Creating an event will happen here." testId="org-placeholder-new-event" />
    </OrganiserShell>
  );
}
