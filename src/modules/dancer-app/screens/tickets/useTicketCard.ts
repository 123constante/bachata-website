import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMyTickets, fetchOrderQr } from '@/modules/tickets/myTicketsApi';
import { groupTickets, type MyTicket } from '@/modules/tickets/myTicketsModel';
import { serverTodayKey } from './serverToday';
import { clearOrderId, readOrderId } from '@/modules/tickets/orderStorage';
import { isOrderId, type ThanksOrderState } from '@/modules/tickets/ticketCheckoutModel';
import { useOrderStatus } from './useOrderStatus';
import { orderCardView, type CardTicket, type CardView } from './model';

/** My tickets rows the card can show: upcoming (London today), with a QR. */
export function upcomingCardTickets(tickets: MyTicket[], todayKey: string): CardTicket[] {
  return groupTickets(tickets, todayKey)
    .upcoming.filter((t) => t.qrToken)
    .map((t) => ({ ticketId: t.ticketId, typeName: t.typeName ?? 'Ticket', qrToken: t.qrToken!, checkedIn: t.checkedIn, shortCode: t.shortCode, eventTitle: t.title, eventDate: t.date }));
}

/**
 * The card's state, folded in from the thank-you page (same order id rules, same poll):
 * ?o= (or the id kept across the Stripe redirect) -> the order states, then that order's QRs;
 * no order -> the person's upcoming tickets; none -> "no order on this device". The qr_token
 * lives only in this state and TicketQrCode: never logged, never in a URL.
 */
export function useTicketCard(): { view: CardView; retry: () => void } {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [stored] = useState(() => {
    const s = typeof window === 'undefined' ? null : readOrderId();
    return isOrderId(s) ? s : null;
  });
  const fromUrl = params.get('o');
  const urlOk = isOrderId(fromUrl);
  const orderId = urlOk ? fromUrl : stored;
  useEffect(() => {
    if (!urlOk && stored) {
      const q = new URLSearchParams(params);
      q.set('o', stored);
      navigate(`?${q.toString()}`, { replace: true });
    }
    clearOrderId();
  }, [params, urlOk, stored, navigate]);

  const { reading, gaveUp } = useOrderStatus(orderId);
  const state: ThanksOrderState = !orderId
    ? 'none'
    : reading?.status === 'paid'
      ? 'paid'
      : reading?.status === 'failed'
        ? 'failed'
        : gaveUp || (reading?.status === 'unknown' && !reading.retryLater)
          ? 'processing'
          : 'checking';
  // free=1 is only believed alongside a real order id in the URL (as on the thank-you page).
  const free = urlOk && params.get('free') === '1';
  const step: CardView | 'read_qr' = orderId && !reading ? { kind: 'loading' } : orderCardView(state, reading?.eventId ?? null, free);
  const needsRead = step === 'read_qr' || step.kind === 'none';

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<CardView | null>(null);
  useEffect(() => {
    if (!needsRead) return;
    let live = true;
    setLoaded(null);
    const title = reading?.eventTitle ?? null;
    const date = reading?.eventDate ?? null;
    // The person's own upcoming tickets (server-clock "today"): the answer when there is no usable
    // order id, and the fallback when the order in the link cannot be read for this account.
    const ownUpcoming = async (): Promise<CardView | 'signed_out' | 'error'> => {
      const [r, today] = await Promise.all([fetchMyTickets(), serverTodayKey()]);
      if (r.kind === 'ok') {
        const tickets = upcomingCardTickets(r.reply.tickets, today);
        return tickets.length ? { kind: 'tickets', tickets } : { kind: 'none' };
      }
      return r.kind === 'signed_out' ? 'signed_out' : 'error';
    };
    if (orderId) {
      void fetchOrderQr(orderId).then(async (r) => {
        if (!live) return;
        // Paid but no QR rows for this account (a guest order, or tickets not issued yet): the email is certain.
        if (r.kind === 'ok') {
          setLoaded(r.tickets.length ? { kind: 'tickets', tickets: r.tickets.map((t) => ({ ...t, eventTitle: title, eventDate: date })) } : { kind: 'paid_email' });
          return;
        }
        if (r.kind === 'signed_out') { setLoaded({ kind: 'paid_email' }); return; }
        // A foreign or unreadable ?o=: never an error while the person has tickets of their own.
        const own = await ownUpcoming();
        if (!live) return;
        setLoaded(typeof own === 'object' && own.kind === 'tickets' ? own : { kind: 'qr_error' });
      });
    } else {
      void ownUpcoming().then((own) => {
        if (!live) return;
        setLoaded(own === 'signed_out' ? { kind: 'none' } : own === 'error' ? { kind: 'qr_error' } : own);
      });
    }
    return () => {
      live = false;
    };
    // reading's title/date are read once the order is paid; a later poll never re-reads the QRs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRead, orderId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (!needsRead) return { view: step as CardView, retry };
  return { view: loaded ?? { kind: 'loading' }, retry };
}
