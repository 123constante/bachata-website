import { Link, useSearchParams } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { ORDER_STORAGE_KEY, thanksCopy } from './ticketCheckoutModel';

/**
 * /tickets/thanks (S4). Stripe returns here after payment; free orders come here
 * directly. Tickets are issued by the payment webhook, never by this redirect, so the
 * page only ever says they are being emailed.
 */
function storedOrderId(): string | null {
  try {
    return window.sessionStorage.getItem(ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function TicketThanksPage() {
  const [params] = useSearchParams();
  useSeo({ title: 'Your tickets', description: 'Your Bachata Calendar ticket order.', noindex: true });
  const orderId = params.get('o') ?? storedOrderId();
  const free = params.get('free') === '1';
  const copy = thanksCopy(free, Boolean(orderId));
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
            Back to what&rsquo;s on
          </Link>
        </section>
      </div>
    </GlobalLayout>
  );
}
