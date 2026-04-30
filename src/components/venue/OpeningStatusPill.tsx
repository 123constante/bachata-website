import { Clock } from 'lucide-react';
import type { VenueOpenStatus } from '@/lib/venueOpenStatus';

/**
 * OpeningStatusPill — colour-keyed live "Open now / Closing soon /
 * Opens at … / Closed" chip for the venue at-a-glance strip.
 *
 * Renders nothing for `unknown` so rows with no opening_hours data
 * don't pretend to know — Ricky's rule: never fake content.
 *
 * Latin Warm tokens: ember for live/positive states, brass for
 * neutral/closed states. Sits flush in a chip row so heights match
 * sibling chips (h-7 px-2.5 text-xs).
 */
export const OpeningStatusPill = ({ status }: { status: VenueOpenStatus }) => {
  if (status.status === 'unknown') return null;

  const tone =
    status.status === 'open'
      ? 'bg-venue-ember/15 text-venue-ember border-venue-ember/30'
      : status.status === 'closing-soon'
      ? 'bg-venue-cumin/15 text-venue-cumin border-venue-cumin/30'
      : status.status === 'opens-soon'
      ? 'bg-venue-brass/15 text-venue-brass border-venue-brass/30'
      : 'bg-venue-line text-venue-cream-mut border-venue-line';

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      {status.label}
    </span>
  );
};

export default OpeningStatusPill;
