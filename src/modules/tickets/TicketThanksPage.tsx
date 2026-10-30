import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { MAX_ORDER_POLLS, isOrderId, pollDelayMs, thanksCopy, type OrderStatusReading, type ThanksOrderState } from './ticketCheckoutModel';
import { readOrderStatus } from './ticketCheckoutApi';
import { clearOrderId, readOrderId } from './orderStorage';

/**
 * /tickets/thanks (S4). Stripe returns here after payment; free orders come here
 * directly. Tickets are issued by the payment webhook, never by this redirect, so the
 * page only ever says they are being emailed.
 */

export default function TicketThanksPage() {
  const [params] = useSearchParams();
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
  // Read the order from the server: first read now, then 2, 4, 8 s and every 15 s, at most
  // MAX_ORDER_POLLS repeats, and only while the server says pending. Stopped on unmount.
  const [reading, setReading] = useState<OrderStatusReading | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!orderId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (poll: number) => {
      const r = await readOrderStatus(orderId);
      if (!live) return;
      setReading(r);
      // retry_later is the server asking us to wait: the same as pending.
      if (r.status !== 'pending' && !(r.retryLater && r.status === 'unknown')) return;
      if (poll >= MAX_ORDER_POLLS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(() => void read(poll + 1), pollDelayMs(poll));
    };
    void read(0);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);
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
          <Link to="/" className="inline-flex min-h-[44px] items-center underline">
            {state === 'failed' || state === 'processing' ? 'Back' : 'Back to what\u2019s on'}
          </Link>
        </section>
      </div>
    </GlobalLayout>
  );
}
