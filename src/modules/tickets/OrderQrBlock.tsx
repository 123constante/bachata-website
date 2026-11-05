import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrderQr } from './myTicketsApi';
import { MY_TICKETS_PATH, type OrderQrTicket } from './myTicketsModel';
import QrCode from './TicketQrCode';

/**
 * The buyer's door QRs on the paid thank-you page (signed in, real order id). One call per
 * mount. Empty, signed-out and error replies all read "in your email, and in My tickets" and
 * never say the order is missing. The qr_token lives only in this state and TicketQrCode.
 */
export const ORDER_QR_CAP = 8;

type View = { kind: 'loading' } | { kind: 'cards'; tickets: OrderQrTicket[] } | { kind: 'email' };

const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;

export default function OrderQrBlock({ orderId }: { orderId: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    void fetchOrderQr(orderId).then((r) => {
      if (!live) return;
      setView(r.kind === 'ok' && r.tickets.length > 0 ? { kind: 'cards', tickets: r.tickets } : { kind: 'email' });
    });
    return () => {
      live = false;
    };
  }, [orderId]);

  if (view.kind === 'loading') {
    return <p className="mb-2 text-[13px]" style={muted} data-testid="order-qr-loading">Getting your door codes&hellip;</p>;
  }
  if (view.kind === 'email') {
    return <p className="mb-2 text-[13px]" style={muted} data-testid="order-qr-email">Your tickets are in your email, and in My tickets.</p>;
  }
  const shown = view.tickets.slice(0, ORDER_QR_CAP);
  const more = view.tickets.length - shown.length;
  return (
    <div className="mb-2" data-testid="order-qr-block">
      <ul className="space-y-2">
        {shown.map((t) => (
          <li key={t.ticketId} className="rounded-md p-2 text-[13px]" style={{ border: '1px solid var(--bento-hairline)' }} data-testid="order-qr-card">
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="font-semibold">{t.typeName}</span>
              {t.checkedIn && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: 'hsl(var(--bento-accent) / 0.18)' }}>
                  Checked in
                </span>
              )}
            </div>
            <div className="rounded-md bg-white p-2" data-testid="order-qr-box">
              <QrCode token={t.qrToken} />
            </div>
          </li>
        ))}
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
