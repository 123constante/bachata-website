import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { flags } from '@/lib/featureFlags';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useProfileSheet } from '../../shell/profileSheet';
import { DANCER_HOME } from '../../shell/routes';
import { CARD_COPY } from './model';
import { useTicketCard } from './useTicketCard';

// Lazy: the QR generator must never land on a first load (it rides with the card only).
const TicketCard = lazyWithRetry(() => import('./TicketCard'));

export const FINISH_BAR = 'Finish your profile to unlock the rest';

/**
 * /app/tickets (Option A, flags.publicTicketing). Top: the QR card. Under it: one slim
 * amber bar, only for an unfinished profile. The rest: a blurred, view-only picture of Home;
 * tapping it opens the same "What are you?" sheet. Fits 390x844 with no scroll.
 */
export default function TicketsScreen() {
  // Flag first: with ticketing off nothing below runs (no order read, the stored id kept).
  if (!flags.publicTicketing) return <Navigate to={DANCER_HOME} replace />;
  return <TicketsBody />;
}

function TicketsBody() {
  const sheet = useProfileSheet();
  const { view, retry } = useTicketCard();
  return (
    <div className="dt-screen" data-testid="tickets-screen">
      <h1 className="sr-only">Tickets</h1>
      <Suspense fallback={<section className="dt-card dt-card-state" data-testid="tickets-card" data-state="loading"><p className="dt-state-line">{CARD_COPY.loading}</p></section>}>
        <TicketCard view={view} retry={retry} copy={CARD_COPY} />
      </Suspense>
      {sheet.incomplete && (
        <div className="dt-bar" data-testid="tickets-finish-bar">
          <span className="dt-bar-text">{FINISH_BAR}</span>
          <button type="button" className="dt-btn dt-btn-small" onClick={sheet.open} data-testid="tickets-finish-start">Start</button>
        </div>
      )}
      {sheet.incomplete && (
        <button type="button" className="dt-peek" onClick={sheet.open} aria-label="Home preview, locked: finish your profile to unlock" data-testid="tickets-home-peek">
          <span className="dt-blur" aria-hidden="true">
            <span className="dt-peek-line dt-w60" />
            <span className="dt-peek-grid"><span /><span /><span /></span>
            <span className="dt-peek-line dt-w80" />
            <span className="dt-peek-line dt-w40" />
            <span className="dt-peek-grid"><span /><span /><span /></span>
          </span>
          <span className="dt-peek-lock" aria-hidden="true"><Lock style={{ width: 16, height: 16 }} /> Home</span>
        </button>
      )}
    </div>
  );
}
