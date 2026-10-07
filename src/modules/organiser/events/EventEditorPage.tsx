import { OrganiserShell, ORG_PATHS } from '../shell';
import { EmptyState } from '../ui';
import { EventListPlaceholder } from './EventListPlaceholder';

/** PLACEHOLDER (W0). Owner: W2. /account/o/events/:seriesId (list + editor on wide screens). */
export default function EventEditorPage() {
  return (
    <OrganiserShell
      title="Edit event"
      back={{ to: ORG_PATHS.events, label: 'Events' }}
      testId="org-page-event-editor"
      list={<EventListPlaceholder />}
      detail={<EmptyState title="Event editor" body="The event editor will show here." testId="org-placeholder-event-editor" />}
    />
  );
}
