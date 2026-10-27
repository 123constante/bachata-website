import { useState } from 'react';
import { refundOrder } from '../../tickets/ticketsApi';
import { NOT_SWITCHED_ON, dayWord, orderLine, orderTag, refundQuestion, type Order } from '../../tickets/ticketModel';
import { TONE_CLASS, p3Reason } from './model';
import { StackSheet } from './StackSheet';

/**
 * Confirm, then refund one whole order (ticket-refund edge function; owner / manager only).
 * Opens OVER the Tickets sheet; the order summary says WHICH order before the tap.
 */
export function RefundSheet({
  order,
  typeName,
  today,
  onClose,
  onDone,
}: {
  order: Order;
  /** The ticket type's name, or null when the event has one type. */
  typeName: string | null;
  today: string;
  onClose: () => void;
  onDone: (announcement: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const q = refundQuestion(order);
  const tag = orderTag(order.status);
  const day = dayWord(order.paidAt, today);
  const go = async () => {
    setBusy(true);
    setNote(null);
    const out = await refundOrder(order.id);
    setBusy(false);
    if (out.kind === 'ok') onDone('Refund started.');
    else setNote(out.kind === 'not_configured' ? NOT_SWITCHED_ON : p3Reason(out.reason));
  };
  return (
    <StackSheet
      title={q.title}
      onClose={() => {
        // A refund in flight answers here: closing now would lose a refusal and allow a second tap.
        if (!busy) onClose();
      }}
      testId="tix-refund-sheet"
      footer={
        <div className="p3-stack-s">
          <button type="button" className="p3-btn p3-btn-danger" onClick={() => void go()} disabled={busy} aria-busy={busy || undefined} data-testid="tix-refund-confirm">
            {busy ? 'Refunding\u2026' : q.confirm}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose} disabled={busy} data-sheet-autofocus data-testid="tix-refund-cancel">Keep the order</button>
        </div>
      }
    >
      <div className="p3-stack-s">
        <p className="p3-row-t p3-plain" data-testid="tix-refund-body">{q.body}</p>
        <div className="p3-card p3-inset" data-testid="tix-refund-order">
          <div className="p3-row-s">Order</div>
          <div className="p3-row-t">{orderLine({ ...order, paidAt: null }, today)}{typeName ? ` \u00B7 ${typeName}` : ''}</div>
          <div className="p3-row-tags">
            <span className={TONE_CLASS[tag.tone]} data-testid="tix-refund-order-tag">{tag.label}{day ? ` ${day}` : ''}</span>
          </div>
        </div>
        {note && <p role="alert" className="p3-warn" data-testid="tix-refund-note">{note}</p>}
      </div>
    </StackSheet>
  );
}
