import { Suspense } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import { ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { POSTPAY_TICKETS_TAB_ENABLED } from '@/lib/postpayTicketsTabFlag';
import { flags } from '@/lib/featureFlags';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useProfileSheet } from '../../shell/profileSheet';
import { DANCER_HOME } from '../../shell/routes';
import { AccountLinkPanel } from './AccountLinkPanel';
import { CARD_COPY } from './model';
import { useTicketCard } from './useTicketCard';

// Lazy: the QR generator must never land on a first load (it rides with the card only).
const TicketCard = lazyWithRetry(() => import('./TicketCard'));

export const FINISH_BAR = 'Finish your profile to unlock the rest';
export const BOOKED_BAR = 'You\u2019re booked';
export const BOOKED_PROCESSING = 'Confirming your booking\u2026';
export const ORGANISER_CARD = 'Set up your organiser page';

/**
 * Buyer onboarding B: the person picked Organiser in "What are you?" and has no organiser
 * page yet (other_roles has no 'organising'). The card is a link to the EXISTING organiser
 * flow, nothing else. `person` is null with the flag OFF, so it never shows then.
 */
export const showOrganiserCard = (person: { buyer_roles: readonly string[]; other_roles: readonly string[] } | null): boolean =>
  Boolean(person && person.buyer_roles.includes('organiser') && !person.other_roles.includes('organising'));

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
  const [params] = useSearchParams();
  return (
    <div className="dt-screen" data-testid="tickets-screen">
      <h1 className="sr-only">Tickets</h1>
      {POSTPAY_TICKETS_TAB_ENABLED && params.has('o') && <BookedBar kind={view.kind} title={view.kind === 'tickets' ? view.tickets[0]?.eventTitle ?? null : null} />}
      <Suspense fallback={<section className="dt-card dt-card-state" data-testid="tickets-card" data-state="loading"><p className="dt-state-line">{CARD_COPY.loading}</p></section>}>
        <TicketCard view={view} retry={retry} copy={CARD_COPY} />
      </Suspense>
      {showOrganiserCard(sheet.person) && (
        <Link to={ORGANISER_HOME_PATH} className="dt-org-card" data-testid="tickets-organiser-card">
          <span>{ORGANISER_CARD}</span>
          <ChevronRight aria-hidden="true" style={{ width: 16, height: 16 }} />
        </Link>
      )}
      {/* Duplicate-account linking: build flag first (no RPC at all when off), then the DB flag inside. */}
      {BUYER_ONBOARDING_ENABLED && !POSTPAY_TICKETS_TAB_ENABLED && <AccountLinkPanel onLinked={retry} orderInView={params.has('o')} />}
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

/** Spec A, top bar: "You're booked" once tickets are in; spinner + wait line while the order is still confirming. */
export function BookedBar({ kind, title }: { kind: string; title: string | null }) {
  if (kind === 'tickets' || kind === 'paid_email') {
    return (
      <div className="dt-bar" role="status" data-testid="tickets-booked-bar" data-state="booked">
        <span className="dt-bar-text">{BOOKED_BAR}{title ? ` \u2014 ${title}` : ''}</span>
      </div>
    );
  }
  if (kind === 'pending' || kind === 'processing' || kind === 'loading') {
    return (
      <div className="dt-bar" role="status" aria-busy="true" data-testid="tickets-booked-bar" data-state="processing">
        <span className="dt-spin" aria-hidden="true" />
        <span className="dt-bar-text">{BOOKED_PROCESSING}</span>
      </div>
    );
  }
  return null;
}
