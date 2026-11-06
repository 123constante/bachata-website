import { useEffect, useId, useRef, useState } from 'react';
import { refundOrder } from '../../tickets/ticketsApi';
import {
  NOT_SWITCHED_ON,
  buyerNameOf,
  dayWord,
  newRefundRequestId,
  orderLine,
  orderTag,
  partialRefundDone,
  penceOf,
  reasonMessage,
  refundAmount,
  refundAmountError,
  refundPartQuestion,
  refundQuestion,
  type Order,
} from '../../tickets/ticketModel';
import { TONE_CLASS } from './model';
import { StackSheet } from './StackSheet';

type Mode = 'all' | 'part';

/**
 * Confirm, then refund one order (ticket-refund edge function; owner / manager only).
 * Opens OVER the Tickets sheet; the order summary says WHICH order before the tap.
 * "Refund all remaining" (the default) sends today's whole-refund body, no amount; "Refund part
 * of it" sends an amount with a per-press key (Q5: tickets stay valid, the order stays paid).
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
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('all');
  const [amount, setAmount] = useState('');
  const q = refundQuestion(order);
  const amountError = mode === 'part' ? refundAmountError(amount, order) : null;
  const pence = mode === 'part' && !amountError ? penceOf(amount) : null;
  const part = refundPartQuestion(order, pence);
  const tag = orderTag(order.status);
  const day = dayWord(order.paidAt, today);
  const alive = useRef(true);
  const noteRef = useRef<HTMLParagraphElement>(null);
  // The idempotency key of the last partial press and the amount it carried. A retry from this
  // sheet with the SAME amount reuses it (the server answers that press, never a second refund);
  // a changed amount is a new refund and gets a new key. A new opening of the sheet starts empty.
  const pressKey = useRef<{ key: string; pence: number } | null>(null);
  useEffect(() => () => { alive.current = false; }, []);
  // The refusal takes focus, so a keyboard or screen-reader user hears it inside the sheet.
  useEffect(() => { if (note) noteRef.current?.focus(); }, [note]);
  const go = async () => {
    if (mode === 'part' && pence === null) return;
    let opts: { amountPence: number; requestId: string } | undefined;
    if (mode === 'part' && pence !== null) {
      if (!pressKey.current || pressKey.current.pence !== pence) pressKey.current = { key: newRefundRequestId(), pence };
      opts = { amountPence: pence, requestId: pressKey.current.key };
    }
    setBusy(true);
    setNote(null);
    onStart();
    const out = await refundOrder(order.id, opts);
    onSettled();
    // Closed before the answer: another order's sheet may be open now, so never close it (review r1 F2),
    // and the late words name this order, so they never read as the open one's (review r2 R2).
    const whose = `${buyerNameOf(order)}'s order`;
    if (out.kind === 'ok') {
      if (!opts) return alive.current ? onDone('Refund started.') : onLate(`Refund started for ${whose}.`, true);
      const sent = out.value?.amountPence ?? opts.amountPence;
      const left = out.value?.remainingPence ?? Math.max(0, refundAmount(order) - sent);
      const done = partialRefundDone(sent, left);
      return alive.current ? onDone(done) : onLate(`${whose}: ${done}`, true);
    }
    const text = out.kind === 'not_configured' ? NOT_SWITCHED_ON : reasonMessage(out.reason);
    if (!alive.current) return onLate(`Refund for ${whose} did not start. ${text}`, false);
    setBusy(false);
    setNote(text);
  };
  const confirmBlocked = mode === 'part' && pence === null;
  return (
    <StackSheet
      title={q.title}
      onClose={onClose}
      testId="tix-refund-sheet"
      footer={
        <div className="p3-stack-s">
          <button
            type="button"
            className="p3-btn p3-btn-danger"
            onClick={() => void go()}
            disabled={busy || confirmBlocked}
            aria-busy={busy || undefined}
            aria-describedby={confirmBlocked ? `${id}-amount-err` : undefined}
            data-testid="tix-refund-confirm"
          >
            {busy ? 'Refunding\u2026' : mode === 'part' ? part.confirm : q.confirm}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose} data-sheet-autofocus data-testid="tix-refund-cancel">Keep the order</button>
        </div>
      }
    >
      <div className="p3-stack-s">
        <div className="p3-chips" role="group" aria-label="How much to refund" data-testid="tix-refund-mode">
          <button type="button" aria-pressed={mode === 'all'} disabled={busy} onClick={() => setMode('all')} data-testid="tix-refund-all">Refund all remaining</button>
          <button type="button" aria-pressed={mode === 'part'} disabled={busy} onClick={() => setMode('part')} data-testid="tix-refund-part">Refund part of it</button>
        </div>
        <p className="p3-row-t p3-plain" data-testid="tix-refund-body">{mode === 'part' ? part.body : q.body}</p>
        {mode === 'part' && (
          <>
            <label className="p3-field" htmlFor={`${id}-amount`}>Amount to refund (&pound;)</label>
            <input
              id={`${id}-amount`}
              className="p3-in"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amountError && amount.trim() !== '' ? true : undefined}
              aria-describedby={`${id}-amount-max${amountError ? ` ${id}-amount-err` : ''}`}
              data-testid="tix-refund-amount"
            />
            <p id={`${id}-amount-max`} className="p3-note" data-testid="tix-refund-max">{part.max}</p>
            {amountError && <p id={`${id}-amount-err`} className="p3-note p3-danger-t" data-testid="tix-refund-amount-err">{amountError}</p>}
          </>
        )}
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
