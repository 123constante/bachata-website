import { Suspense } from 'react';
import { Ticket } from 'lucide-react';
import { flags } from '@/lib/featureFlags';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { CARD_COPY, type CardView } from '../tickets/model';
import { DANCER_TICKETS } from '../../shell/routes';
import { GRow } from './homeOptionB';
import { useTicketCard } from '../tickets/useTicketCard';

// Lazy like on the Tickets tab: the QR generator rides with the card only.
const TicketCard = lazyWithRetry(() => import('../tickets/TicketCard'));

/** Golden home: the one-line words per non-QR state (CARD_COPY, shortened to one line). */
const rowLine = (v: Exclude<CardView, { kind: 'tickets' }>): string => {
  switch (v.kind) {
    case 'loading': return CARD_COPY.loading;
    case 'none': return 'No order found yet';
    case 'qr_error': return 'Could not load your ticket';
    case 'pending': return 'Confirming your payment\u2026';
    case 'processing': return 'Your order is being processed';
    case 'paid_email': return 'Your tickets are in your email';
    default: return 'This order didn\u2019t go through';
  }
};

/**
 * Layout C "Your ticket" (brief dancer-layout-c-s1): the Tickets tab's OWN card and hook
 * (useTicketCard + TicketCard), reused, never copied. HomeScreen lazy-loads this file only
 * while ticketing is on, so the ticket reads stay off the /app/* first load (the homeGoing
 * pattern). It imports nothing from the dancer-app chunk.
 */
const HomeTicket = () => {
  const { view, retry } = useTicketCard();
  if (flags.homeGoldenLook && view.kind !== 'tickets') {
    const err = view.kind === 'qr_error';
    return (
      <section data-testid="home-c-ticket">
        <GRow testId="home-c-ticket-row" to={err ? undefined : DANCER_TICKETS} onClick={err ? retry : undefined} tone={1} icon={<Ticket aria-hidden="true" className="h-[20px] w-[20px]" />}
          title="Your ticket" line={rowLine(view)} go={err ? 'Try again' : 'Open'} />
      </section>
    );
  }
  return (
    <section data-testid="home-c-ticket" style={{ display: 'grid', gap: 8 }}>
      <b style={{ fontSize: 16 }}>Your ticket</b>
      <Suspense fallback={<section className="dt-card dt-card-state" data-testid="tickets-card" data-state="loading"><p className="dt-state-line">{CARD_COPY.loading}</p></section>}>
        <TicketCard view={view} retry={retry} copy={CARD_COPY} />
      </Suspense>
    </section>
  );
};

export default HomeTicket;
