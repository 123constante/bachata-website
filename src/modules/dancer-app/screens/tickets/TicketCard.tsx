import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import DoorCodeLine from '@/modules/tickets/DoorCodeLine';
import QrCode from '@/modules/tickets/TicketQrCode';
import { doorCodeText } from '@/modules/tickets/myTicketsModel';
import { ticketDoorCode } from '@/modules/organiser/p3/door/doorFlags';
import { doorDate, stepTicket, ticketCountLine } from './cardKit';
import type { CARD_COPY as CardCopy, CardTicket, CardView } from './model';

// The copy arrives as a prop (type-only import above): importing the value would pull ./model into this lazy chunk.
type Copy = typeof CardCopy;

/**
 * The QR card at the top of the Tickets tab (its own lazy chunk: the QR generator never lands
 * on a first load). One QR at a time, arrows and "Ticket k of N" for ALL N. Tap the QR for the
 * full-screen door view, the only place the event name and date show. No buyer name or email.
 */
export default function TicketCard({ view, retry, copy }: { view: CardView; retry: () => void; copy: Copy }) {
  if (view.kind !== 'tickets') return <CardState view={view} retry={retry} copy={copy} />;
  return <TicketCarousel tickets={view.tickets} />;
}

function CardState({ view, retry, copy: CARD_COPY }: { view: Exclude<CardView, { kind: 'tickets' }>; retry: () => void; copy: Copy }) {
  const line =
    view.kind === 'loading' ? CARD_COPY.loading
      : view.kind === 'pending' ? (view.free ? CARD_COPY.pendingFree : CARD_COPY.pending)
        : view.kind === 'paid_email' ? CARD_COPY.paidEmail
        : view.kind === 'processing' ? CARD_COPY.processing
          : view.kind === 'failed' ? (view.free ? CARD_COPY.failedFree : CARD_COPY.failed)
            : view.kind === 'qr_error' ? CARD_COPY.qrError
              : CARD_COPY.none;
  return (
    <section className="dt-card dt-card-state" data-testid="tickets-card" data-state={view.kind} aria-busy={view.kind === 'loading' || view.kind === 'pending'}>
      <p className="dt-state-line" role="status">{line}</p>
      {view.kind === 'qr_error' && (
        <button type="button" className="dt-btn" onClick={retry} data-testid="tickets-card-retry">{CARD_COPY.retry}</button>
      )}
      {view.kind === 'failed' && view.eventId && (
        <Link to={`/event/${encodeURIComponent(view.eventId)}`} className="dt-btn" data-testid="tickets-card-back-to-event">{CARD_COPY.failedLink}</Link>
      )}
    </section>
  );
}

function TicketCarousel({ tickets }: { tickets: CardTicket[] }) {
  const [index, setIndex] = useState(0);
  const [door, setDoor] = useState(false);
  const n = tickets.length;
  const at = Math.min(index, n - 1);
  const t = tickets[at];
  const code = doorCodeText(t.shortCode, ticketDoorCode);
  return (
    <section className="dt-card" data-testid="tickets-card" data-state="tickets">
      <div className="dt-card-top">
        <span className="dt-type" data-testid="tickets-card-type">{t.typeName}</span>
        {t.checkedIn && <span className="dt-checked">Checked in</span>}
      </div>
      <button type="button" className="dt-qr" onClick={() => setDoor(true)} aria-label="Open the full-screen door view" data-testid="tickets-card-qr">
        <QrCode token={t.qrToken} />
      </button>
      {code && <DoorCodeLine code={code} checkedIn={t.checkedIn} testId="tickets-card-code" />}
      {n > 1 && (
        <div className="dt-steps">
          <button type="button" className="dt-icon-btn" onClick={() => setIndex((i) => stepTicket(i, -1, n))} aria-label="Previous ticket" data-testid="tickets-card-prev">
            <ChevronLeft aria-hidden="true" style={{ width: 20, height: 20 }} />
          </button>
          <span className="dt-count" aria-live="polite" data-testid="tickets-card-count">{ticketCountLine(at, n)}</span>
          <button type="button" className="dt-icon-btn" onClick={() => setIndex((i) => stepTicket(i, 1, n))} aria-label="Next ticket" data-testid="tickets-card-next">
            <ChevronRight aria-hidden="true" style={{ width: 20, height: 20 }} />
          </button>
        </div>
      )}
      {door && <DoorView ticket={t} code={code} onClose={() => setDoor(false)} />}
    </section>
  );
}

function DoorView({ ticket, code, onClose }: { ticket: CardTicket; code: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const date = doorDate(ticket.eventDate);
  return (
    <div className="dt-door" role="dialog" aria-modal="true" aria-label="Door view" data-testid="tickets-door-view">
      <button type="button" className="dt-door-close" onClick={onClose} aria-label="Close the door view" data-testid="tickets-door-close">
        <X aria-hidden="true" style={{ width: 22, height: 22 }} />
      </button>
      {ticket.eventTitle && <p className="dt-door-title" data-testid="tickets-door-title">{ticket.eventTitle}</p>}
      {date && <p className="dt-door-date" data-testid="tickets-door-date">{date}</p>}
      <p className="dt-door-type">{ticket.typeName}</p>
      <div className="dt-door-qr"><QrCode token={ticket.qrToken} /></div>
      {code && <DoorCodeLine code={code} checkedIn={ticket.checkedIn} testId="tickets-door-code" />}
    </div>
  );
}
