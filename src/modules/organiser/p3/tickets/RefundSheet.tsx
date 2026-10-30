import { useEffect, useRef, useState } from 'react';
import { refundOrder } from '../../tickets/ticketsApi';
import { NOT_SWITCHED_ON, buyerNameOf, dayWord, orderLine, orderTag, reasonMessage, refundQuestion, type Order } from '../../tickets/ticketModel';
import { TONE_CLASS } from './model';
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
  /** An answer that arrives after the sheet was closed (landed = refund started): the parent shows it. */
  onLate: (text: string, landed: boolean) => void;
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
    // Closed before the answer: another order's sheet may be open now, so never close it (review r1 F2),
    // and the late words name this order, so they never read as the open one's (review r2 R2).
    const whose = `${buyerNameOf(order)}'s order`;
    if (out.kind === 'ok') return alive.current ? onDone('Refund started.') : onLate(`Refund started for ${whose}.`, true);
    const text = out.kind === 'not_configured' ? NOT_SWITCHED_ON : reasonMessage(out.reason);
    if (!alive.current) return onLate(`Refund for ${whose} did not start. ${text}`, false);
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
