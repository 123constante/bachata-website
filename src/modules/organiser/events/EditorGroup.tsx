import { useId, type ReactNode } from 'react';

/**
 * One group of the event editor (owner-approved order: What it is, When, Where,
 * What people see, Programme, Tickets and links, Who runs it, Status): a small
 * heading over its fields, one column. Render a group only when it has
 * something to show, so a heading never sits over an empty box.
 */
export function EditorGroup({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-[12px]" data-testid={`org-group-${id}`}>
      <h2 id={headingId} className="px-[4px] text-[15px] font-semibold text-[var(--fg)]">{heading}</h2>
      {children}
    </section>
  );
}
