import { EmptyState, SectionLabel } from '../ui';

/** PLACEHOLDER (W0). Owner: W2. The events list (left column on wide screens). */
export function EventListPlaceholder() {
  return (
    <>
      <SectionLabel>Your events</SectionLabel>
      <EmptyState title="Events" body="Your events will be listed here." testId="org-placeholder-events" />
    </>
  );
}
