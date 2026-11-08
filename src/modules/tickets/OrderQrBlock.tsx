import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrderQr } from './myTicketsApi';
import { ticketDoorCode } from '@/modules/organiser/p3/door/doorFlags';
import { MY_TICKETS_PATH, TICKET_WHERE, doorCodeText, type OrderQrTicket } from './myTicketsModel';
import DoorCodeLine from './DoorCodeLine';
import QrCode from './TicketQrCode';

/**
 * The buyer's door QRs on the paid thank-you page (signed in, real order id). One call per
 * mount. An empty reply says "in your email" only (a guest order is never linked to My tickets);
 * an error says email, with a My tickets link as a retry. Neither says the order is missing. The qr_token lives only in this state and TicketQrCode.
 */
export const ORDER_QR_CAP = 8;

type View = { kind: 'loading' } | { kind: 'cards'; tickets: OrderQrTicket[] } | { kind: 'empty' } | { kind: 'error' };

const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;

export default function OrderQrBlock({ orderId }: { orderId: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    void fetchOrderQr(orderId).then((r) => {
      if (!live) return;
      if (r.kind === 'ok') setView(r.tickets.length > 0 ? { kind: 'cards', tickets: r.tickets } : { kind: 'empty' });
      else setView(r.kind === 'signed_out' ? { kind: 'empty' } : { kind: 'error' });
    });
    return () => {
      live = false;
    };
  }, [orderId]);

  if (view.kind === 'loading') {
    return <p className="mb-2 text-[13px]" style={muted} data-testid="order-qr-loading">Getting your door codes&hellip;</p>;
  }
  if (view.kind === 'empty') {
    return <p className="mb-2 text-[13px]" style={muted} data-testid="order-qr-email">{TICKET_WHERE.empty}</p>;
  }
  if (view.kind === 'error') {
    return (
      <p className="mb-2 text-[13px]" style={muted} data-testid="order-qr-email">
        {TICKET_WHERE.error}{' '}
        <Link to={MY_TICKETS_PATH} className="inline-flex min-h-[44px] items-center underline">{TICKET_WHERE.errorLink}</Link>{' '}
        {TICKET_WHERE.errorTail}
      </p>
    );
  }
  const shown = view.tickets.slice(0, ORDER_QR_CAP);
  const more = view.tickets.length - shown.length;
  return (
    <div className="mb-2" data-testid="order-qr-block">
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto" data-testid="order-qr-swipe" aria-label="Your tickets, swipe for the next one">
        {shown.map((t, i) => {
          const code = doorCodeText(t.shortCode, ticketDoorCode);
          return (
            <li key={t.ticketId} className="w-full min-w-full shrink-0 snap-center rounded-md p-2 text-[13px]" style={{ border: '1px solid var(--bento-hairline)' }} data-testid="order-qr-card">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-semibold">{t.typeName}{shown.length > 1 && <span className="font-normal" style={muted} data-testid="order-qr-count"> &middot; {i + 1} of {shown.length}</span>}</span>
                {t.checkedIn && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: 'hsl(var(--bento-accent) / 0.18)' }}>
                    Checked in
                  </span>
                )}
              </div>
              <div className="rounded-md bg-white p-2" data-testid="order-qr-box">
                <QrCode token={t.qrToken} />
              </div>
              {code && <DoorCodeLine code={code} checkedIn={t.checkedIn} testId="order-qr-short-code" />}
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <p className="mt-2 text-[13px]" data-testid="order-qr-more">
          and {more} more in{' '}
          <Link to={MY_TICKETS_PATH} className="inline-flex min-h-[44px] items-center underline">My tickets</Link>
        </p>
      )}
    </div>
  );
}
