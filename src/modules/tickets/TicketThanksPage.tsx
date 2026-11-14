import { Suspense, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { isOrderId, thanksCopy, type ThanksOrderState } from './ticketCheckoutModel';
import { useOrderStatus } from './useOrderStatus';
import { clearOrderId, readOrderId } from './orderStorage';
import { MY_TICKETS_PATH } from './myTicketsModel';
import { useAuth } from '@/hooks/useAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Lazy: the QR generator must never land on a first load.
const OrderQrBlock = lazyWithRetry(() => import('./OrderQrBlock'));

/**
 * /tickets/thanks (S4). Stripe returns here after payment; free orders come here
 * directly. Tickets are issued by the payment webhook, never by this redirect, so the
 * page only ever says they are being emailed.
 */

/**
 * Option A: with ticketing on, a signed-in buyer's thank-you page is the dancer app's Tickets
 * tab (/app/tickets?o=<order>), which shows the same order states and the door QRs. This
 * route stays as the redirect, so links in emails already sent still land. A guest (or
 * ticketing off) keeps the page below: /app is signed-in only. A stored id (no ?o) is read
 * by the Tickets tab itself.
 */
export const APP_TICKETS_PATH = '/app/tickets';

export function thanksRedirectTarget(search: string): string {
  const q = new URLSearchParams(search);
  const o = q.get('o');
  const out = new URLSearchParams();
  if (isOrderId(o)) {
    out.set('o', o);
    if (q.get('free') === '1') out.set('free', '1');
  }
  const s = out.toString();
  return s ? `${APP_TICKETS_PATH}?${s}` : APP_TICKETS_PATH;
}

export default function TicketThanksPage() {
  const [params] = useSearchParams();
  const { user, authStatus } = useAuth();
  // Wait for the session to restore before deciding: a signed-in buyer back from Stripe must not
  // mount the guest page first (it would clear the stored order id).
  if (flags.publicTicketing && authStatus === 'resolving') return null;
  if (flags.publicTicketing && user && !user.is_anonymous) return <Navigate to={thanksRedirectTarget(params.toString())} replace />;
  return <ThanksPageBody />;
}

function ThanksPageBody() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  useSeo({ title: 'Your tickets', description: 'Your Bachata Calendar ticket order.', noindex: true });
  const navigate = useNavigate();
  const [stored] = useState(() => {
    const s = typeof window === 'undefined' ? null : readOrderId();
    return isOrderId(s) ? s : null;
  });
  // Only an id shaped like the server's is an order; anything else (typed, garbled, empty)
  // falls back to the stored one, or to no order at all.
  const fromUrl = params.get('o');
  const urlOk = isOrderId(fromUrl);
  const orderId = urlOk ? fromUrl : stored;
  // Move the stored id into the URL (a refresh keeps the reference), then forget it so a
  // later visit never shows an old, abandoned order.
  useEffect(() => {
    if (!urlOk && stored) {
      const q = new URLSearchParams(params);
      q.set('o', stored);
      navigate(`?${q.toString()}`, { replace: true });
    }
    clearOrderId();
  }, [params, urlOk, stored, navigate]);
  // free=1 is only believed alongside a real order id (the block sends both together).
  const free = params.get('free') === '1' && urlOk;
  // The shared poll (useOrderStatus): only while the server says pending, at most MAX_ORDER_POLLS repeats.
  const { reading, gaveUp } = useOrderStatus(orderId);
  // Only the server's `paid` may say Confirmed; no reading, an error or `unknown` keep the
  // neutral 'checking' copy. A held order id is never 'confirmed' on its own.
  const state: ThanksOrderState = !orderId
    ? 'none'
    : reading?.status === 'paid'
      ? 'paid'
      : reading?.status === 'failed'
        ? 'failed'
        : gaveUp
          ? 'processing'
          : 'checking';
  const copy = thanksCopy(free, state, reading ?? {});
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('ticketsThanks')}>
      <div className="mx-auto w-full max-w-[430px] px-3 py-3">
        <section
          className="rounded-md p-3 text-[14px]"
          style={{
            background: 'hsl(var(--bento-surface-raised))',
            color: 'hsl(var(--bento-fg))',
            border: '1px solid var(--bento-hairline)',
          }}
          data-testid="tickets-thanks"
        >
          <h1 className="mb-2 text-[17px] font-semibold" style={{ color: 'hsl(var(--bento-accent))' }}>{copy.title}</h1>
          <p className="mb-2">{copy.body}</p>
          {orderId && (
            <p className="mb-2 text-[12px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
              Order reference: <span className="font-mono">{orderId.slice(0, 8)}</span>
            </p>
          )}
          {state === 'paid' && user && orderId && (
            <Suspense fallback={null}>
              <OrderQrBlock orderId={orderId} />
            </Suspense>
          )}
          {state === 'paid' && user && (
            <Link to={MY_TICKETS_PATH} className="mb-2 flex min-h-[44px] items-center font-semibold underline" data-testid="tickets-thanks-my-tickets">
              See your tickets
            </Link>
          )}
          {reading?.eventId && (state === 'paid' || state === 'failed' || state === 'processing') && (
            <Link to={`/event/${encodeURIComponent(reading.eventId)}`} className="flex min-h-[44px] items-center underline" data-testid="thanks-back-to-event">
              {state === 'failed' ? 'Back to the event to try again' : 'Back to the event'}
            </Link>
          )}
          <Link to="/" className="inline-flex min-h-[44px] items-center underline">
            {state === 'failed' || state === 'processing' ? 'Back' : 'Back to what\u2019s on'}
          </Link>
        </section>
      </div>
    </GlobalLayout>
  );
}
