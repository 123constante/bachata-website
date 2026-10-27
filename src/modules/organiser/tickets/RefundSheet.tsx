import { useState } from 'react';
import { GhostButton, PrimaryButton, SheetView } from '../ui';
import { refundOrder } from './ticketsApi';
import { NOT_SWITCHED_ON, reasonMessage, refundQuestion, type Order } from './ticketModel';

/** Confirm, then refund one whole order through the ticket-refund edge function (owner / manager only). */
export function RefundSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: (announcement: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const q = refundQuestion(order);
  const go = async () => {
    setBusy(true);
    setNote(null);
    const out = await refundOrder(order.id);
    setBusy(false);
    if (out.kind === 'ok') onDone('Refund started.');
    else setNote(out.kind === 'not_configured' ? NOT_SWITCHED_ON : reasonMessage(out.reason));
  };
  return (
    <SheetView
      open
      onOpenChange={(o) => !o && onClose()}
      title={q.title}
      testId="tix-refund-sheet"
      footer={
        <div className="grid grid-cols-2 gap-[8px]">
          <GhostButton block testId="tix-refund-cancel" onClick={onClose}>
            Keep the order
          </GhostButton>
          <PrimaryButton block testId="tix-refund-confirm" loading={busy} loadingLabel="Refunding" onClick={() => void go()}>
            Refund
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-[8px]">
        <p className="text-[15px]" data-testid="tix-refund-body">{q.body}</p>
        {note && (
          <p role="alert" className="text-[13px] text-[var(--fg)]" data-testid="tix-refund-note">
            {note}
          </p>
        )}
      </div>
    </SheetView>
  );
}
