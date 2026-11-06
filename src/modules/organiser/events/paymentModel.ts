// How to pay (W2 walk fix 5): the go-live code `no_payment` had no screen that
// fixes it. event_series_p5.payment_methods is a comma list of these codes,
// each once (_payment_methods_problem_v1); a festival takes ticket_link only
// (_cmd_series_upsert_p5). One series.upsert; an untouched Save sends nothing.
import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { EventWorkspace } from './eventModel';

import { PAYMENT_METHODS, PAYMENT_LABEL, parsePayment, paymentText, type PaymentMethod } from '@/lib/paymentMethods';
export { PAYMENT_METHODS, PAYMENT_LABEL, parsePayment, paymentText };
export type { PaymentMethod };

export const PAYMENT_HELP = 'Pick every way dancers can pay. Tap again to take one off.';
export const FESTIVAL_PAYMENT_HELP = 'A festival sells through its ticket link.';

/** The methods this event may offer: a festival only its ticket link. */
export const paymentChoices = (ws: EventWorkspace): readonly PaymentMethod[] =>
  ws.series.format === 'festival' ? ['ticket_link'] : PAYMENT_METHODS;

export const togglePayment = (picked: readonly PaymentMethod[], m: PaymentMethod): PaymentMethod[] =>
  picked.includes(m) ? picked.filter((p) => p !== m) : PAYMENT_METHODS.filter((p) => p === m || picked.includes(p));

/** What a save sends: the picked methods this event may offer, in screen order (a festival's stored "door" is dropped, never resent). */
/** The codes as sent: only the ones this event may offer, in list order (P3 W3a compares drafts with it). */
export const toSend = (ws: EventWorkspace, picked: readonly PaymentMethod[]): string =>
  paymentChoices(ws).filter((m) => picked.includes(m)).join(',');

export function paymentChanged(ws: EventWorkspace, picked: readonly PaymentMethod[]): boolean {
  return parsePayment(ws.series.payment_methods).join(',') !== toSend(ws, picked);
}

/** ONE series.upsert with `name` (the handler needs it) and the list; null when nothing changed. Blank clears. */
export function paymentCommand(ws: EventWorkspace, picked: readonly PaymentMethod[]): OwnerCommand | null {
  if (!paymentChanged(ws, picked)) return null;
  return upsertCommand({ name: ws.series.name, payment_methods: toSend(ws, picked) });
}
