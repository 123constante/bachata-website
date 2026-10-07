import { OrganiserShell } from '../shell';
import { EmptyState } from '../ui';

/** PLACEHOLDER (W0). Owner: W4. /account/o/team */
export default function TeamPage() {
  return (
    <OrganiserShell title="Team" testId="org-page-team">
      <EmptyState title="Team" body="The people who run your events will show here." testId="org-placeholder-team" />
    </OrganiserShell>
  );
}
