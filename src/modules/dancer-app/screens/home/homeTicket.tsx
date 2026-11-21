import { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { CARD_COPY } from '../tickets/model';
import { useTicketCard } from '../tickets/useTicketCard';

// Lazy like on the Tickets tab: the QR generator rides with the card only.
const TicketCard = lazyWithRetry(() => import('../tickets/TicketCard'));

/**
 * Layout C "Your ticket" (brief dancer-layout-c-s1): the Tickets tab's OWN card and hook
 * (useTicketCard + TicketCard), reused, never copied. HomeScreen lazy-loads this file only
 * while ticketing is on, so the ticket reads stay off the /app/* first load (the homeGoing
 * pattern). It imports nothing from the dancer-app chunk.
 */
const HomeTicket = () => {
  const { view, retry } = useTicketCard();
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
