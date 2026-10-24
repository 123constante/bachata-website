import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { keepReturnTo } from '@/modules/organiser/flows/doneState';
import { Chip } from '../ui';
import { EventConflict, EventStepShell, SendButton, StepError, useEventSend } from '@/modules/organiser/flows/event';
import { ORG_PATHS } from '../shell';
import type { EventWorkspace } from './eventModel';
import {
  FESTIVAL_PAYMENT_HELP, PAYMENT_HELP, PAYMENT_LABEL, parsePayment, paymentChanged, paymentChoices, paymentCommand, togglePayment,
  type PaymentMethod,
} from './paymentModel';

/** /details?edit=payment (W2 walk fix 5): How to pay as chips. One Save, one series.upsert; an untouched Save sends nothing. */
export function PaymentEdit({ ws }: { ws: EventWorkspace }) {
  const seriesId = ws.series.id;
  const { search } = useLocation();
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const [picked, setPicked] = useState<PaymentMethod[]>(() => parsePayment(ws.series.payment_methods));
  const changed = paymentChanged(ws, picked);
  const choices = paymentChoices(ws);
  const save = () => {
    const command = paymentCommand(ws, picked);
    if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
  };
  return (
    <EventStepShell seriesId={seriesId} title="How to pay" back={keepReturnTo(ORG_PATHS.eventDetails(seriesId), search)}>
      {conflict ? <EventConflict seriesId={seriesId} /> : (
        <>
          <p className="text-[14px] text-[var(--mut)]" data-testid="org-payment-help">{choices.length === 1 ? FESTIVAL_PAYMENT_HELP : PAYMENT_HELP}</p>
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="How to pay" data-testid="org-payment-chips">
            {choices.map((m) => (
              <Chip key={m} selected={picked.includes(m)} onToggle={() => setPicked((p) => togglePayment(p, m))} testId="org-payment-chip">{PAYMENT_LABEL[m]}</Chip>
            ))}
          </div>
          <SendButton label="Save" testId="org-detail-save" reason={changed ? null : 'Nothing changed yet'} busy={busy} onSend={save} />
          <StepError text={error} />
        </>
      )}
    </EventStepShell>
  );
}
