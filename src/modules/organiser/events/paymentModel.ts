// How to pay (W2 walk fix 5): the go-live code `no_payment` had no screen that
// fixes it. event_series_p5.payment_methods is a comma list of these codes,
// each once (_payment_methods_problem_v1); a festival takes ticket_link only
// (_cmd_series_upsert_p5). One series.upsert; an untouched Save sends nothing.
import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { EventWorkspace } from './eventModel';

export const PAYMENT_METHODS = ['ticket_link', 'door', 'bank_transfer', 'cash', 'free'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  ticket_link: 'Ticket link',
  door: 'Pay at the door',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  free: 'Free',
};

export const PAYMENT_HELP = 'Pick every way dancers can pay. Tap again to take one off.';
export const FESTIVAL_PAYMENT_HELP = 'A festival sells through its ticket link.';

const isMethod = (v: string): v is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(v);

/** The stored list as codes, in screen order; unknown or repeated parts are dropped. */
export function parsePayment(stored: string | null | undefined): PaymentMethod[] {
  const parts = new Set((stored ?? '').split(',').map((p) => p.trim()).filter(isMethod));
  return PAYMENT_METHODS.filter((m) => parts.has(m));
}

/** The methods this event may offer: a festival only its ticket link. */
export const paymentChoices = (ws: EventWorkspace): readonly PaymentMethod[] =>
  ws.series.format === 'festival' ? ['ticket_link'] : PAYMENT_METHODS;

export const togglePayment = (picked: readonly PaymentMethod[], m: PaymentMethod): PaymentMethod[] =>
  picked.includes(m) ? picked.filter((p) => p !== m) : PAYMENT_METHODS.filter((p) => p === m || picked.includes(p));

export const paymentText = (picked: readonly PaymentMethod[]): string => picked.map((m) => PAYMENT_LABEL[m]).join(', ');

export function paymentChanged(ws: EventWorkspace, picked: readonly PaymentMethod[]): boolean {
  return parsePayment(ws.series.payment_methods).join(',') !== PAYMENT_METHODS.filter((m) => picked.includes(m)).join(',');
}

/** ONE series.upsert with `name` (the handler needs it) and the list; null when nothing changed. Blank clears. */
export function paymentCommand(ws: EventWorkspace, picked: readonly PaymentMethod[]): OwnerCommand | null {
  if (!paymentChanged(ws, picked)) return null;
  return upsertCommand({ name: ws.series.name, payment_methods: PAYMENT_METHODS.filter((m) => picked.includes(m)).join(',') });
}
