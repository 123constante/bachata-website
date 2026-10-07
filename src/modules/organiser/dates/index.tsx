import { useParams } from 'react-router-dom';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { EmptyState } from '../ui';

/** PLACEHOLDER (W0). Owner: W3. /account/o/events/:seriesId/dates/:occurrenceId (schedule, sessions, Line-up). */
export default function DatePage() {
  const { seriesId = '' } = useParams();
  return (
    <OrganiserShell title="Date" back={{ to: ORG_PATHS.event(seriesId), label: 'Event' }} testId="org-page-date">
      <EmptyState title="This date" body="The schedule for this date will show here." testId="org-placeholder-date" />
    </OrganiserShell>
  );
}
