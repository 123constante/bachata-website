import { OrganiserShell } from '../shell';
import { EmptyState, SectionLabel } from '../ui';

/** PLACEHOLDER (W0). Owner: W1. Home: 'Next dates', big New event button, strips only when needed. */
export default function HomePage() {
  return (
    <OrganiserShell title="Home" testId="org-page-home">
      <SectionLabel>Next dates</SectionLabel>
      <EmptyState title="Home" body="Next dates, a New event button and reminders will show here." testId="org-placeholder-home" />
    </OrganiserShell>
  );
}
