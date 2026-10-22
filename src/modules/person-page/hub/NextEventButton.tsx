import { Link } from 'react-router-dom';
import { hrefFor } from '@/lib/searchEntities';
import { CHIP, FOCUS_RING, HUB } from '../wall/tokens';
import type { NextGig } from './model';

/** Only for a DJ with an upcoming gig (the one role with a date today). No gig = nothing rendered. */
export function NextEventButton({ gig }: { gig: NextGig | null }) {
  if (!gig) return null;
  return (
    <Link
      to={hrefFor('event', gig.eventId)}
      data-testid="hub-next-event"
      className={`mt-4 flex items-center justify-center text-center ${FOCUS_RING}`}
      style={{
        minHeight: HUB.ctaMinHeight, borderRadius: HUB.ctaRadius, background: CHIP.dj.bg, color: CHIP.dj.text,
        fontSize: HUB.ctaText, fontWeight: 800, padding: '0 14px',
      }}
    >
      Go to their next event &middot; {gig.dateLabel}
    </Link>
  );
}
