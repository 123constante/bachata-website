import { OrganiserShell } from '../shell';
import { EmptyState } from '../ui';

/** PLACEHOLDER (W0). Owner: W4. /account/o/profile (organiser profile, incl. Instagram). */
export default function ProfilePage() {
  return (
    <OrganiserShell title="Profile" testId="org-page-profile">
      <EmptyState title="Profile" body="Your organiser profile will show here." testId="org-placeholder-profile" />
    </OrganiserShell>
  );
}
