import { OrganiserShell, ORG_PATHS } from '../shell';
import { EventList } from './EventList';

/** /account/o/events -- My events (C33). */
export default function EventsPage() {
  return (
    <OrganiserShell title="My events" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-events">
      <div className="p-3"><EventList /></div>
    </OrganiserShell>
  );
}
