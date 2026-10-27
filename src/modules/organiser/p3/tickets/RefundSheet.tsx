import { useEffect, useRef, useState } from 'react';
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
  onLate,
  onStart,
  onSettled,
}: {
  order: Order;
  /** The ticket type's name, or null when the event has one type. */
  typeName: string | null;
  today: string;
  onClose: () => void;
  onDone: (announcement: string) => void;
  /** A refusal that arrives after the sheet was closed: the parent shows it. */
  onLate: (text: string) => void;
  /** The order's refund started (the parent locks its Refund button until the answer). */
  onStart: () => void;
  onSettled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const q = refundQuestion(order);
  const tag = orderTag(order.status);
  const day = dayWord(order.paidAt, today);
  const alive = useRef(true);
  const noteRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => { alive.current = false; }, []);
  // The refusal takes focus, so a keyboard or screen-reader user hears it inside the sheet.
  useEffect(() => { if (note) noteRef.current?.focus(); }, [note]);
  const go = async () => {
    setBusy(true);
    setNote(null);
    onStart();
    const out = await refundOrder(order.id);
    onSettled();
    if (out.kind === 'ok') return onDone('Refund started.');
    const text = out.kind === 'not_configured' ? NOT_SWITCHED_ON : p3Reason(out.reason);
    if (!alive.current) return onLate(text);
    setBusy(false);
    setNote(text);
  };
  return (
    <StackSheet
      title={q.title}
      onClose={onClose}
      testId="tix-refund-sheet"
      footer={
        <div className="p3-stack-s">
          <button type="button" className="p3-btn p3-btn-danger" onClick={() => void go()} disabled={busy} aria-busy={busy || undefined} data-testid="tix-refund-confirm">
            {busy ? 'Refunding\u2026' : q.confirm}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose} data-sheet-autofocus data-testid="tix-refund-cancel">Keep the order</button>
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
        {note && <p ref={noteRef} tabIndex={-1} role="alert" className="p3-warn" data-testid="tix-refund-note">{note}</p>}
      </div>
    </StackSheet>
  );
}
