import { Link } from 'react-router-dom';
import { hrefFor } from '@/lib/searchEntities';
import { CHIP, FOCUS_RING, HUB } from '../wall/tokens';
import type { NextGig } from './model';

const BOX = {
  minHeight: HUB.ctaMinHeight, borderRadius: HUB.ctaRadius, background: CHIP.dj.bg, color: CHIP.dj.text,
  fontSize: HUB.ctaText, fontWeight: 800, padding: '0 14px',
} as const;

/**
 * Only for a DJ with an upcoming gig (the one role with a date today). No gig = nothing rendered.
 * No event id yet (the wall knew the date, the timeline is still loading) = the same box, not yet a
 * link, so the button keeps its place and never points at a missing page.
 */
export function NextEventButton({ gig }: { gig: NextGig | null }) {
  if (!gig) return null;
  const label = <>Go to their next event &middot; {gig.dateLabel}</>;
  if (!gig.eventId) {
    return (
      <div data-testid="hub-next-event" aria-busy="true" className="mt-4 flex items-center justify-center text-center" style={BOX}>
        {label}
      </div>
    );
  }
  return (
    <Link
      to={hrefFor('event', gig.eventId)}
      data-testid="hub-next-event"
      className={`mt-4 flex items-center justify-center text-center ${FOCUS_RING}`}
      style={BOX}
    >
      {label}
    </Link>
  );
}
