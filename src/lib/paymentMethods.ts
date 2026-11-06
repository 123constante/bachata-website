// How to pay: the pure half of the payment mapping, shared by the organiser
// Prices screen and the public event page so both read the same labels.
// event_series_p5.payment_methods is a comma list of these codes.
export const PAYMENT_METHODS = ['ticket_link', 'door', 'bank_transfer', 'cash', 'free'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  ticket_link: 'Ticket link',
  door: 'Pay at the door',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  free: 'Free',
};

const isMethod = (v: string): v is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(v);

/** The stored list as codes, in screen order; unknown or repeated parts are dropped. */
export function parsePayment(stored: string | null | undefined): PaymentMethod[] {
  const parts = new Set((stored ?? '').split(',').map((p) => p.trim()).filter(isMethod));
  return PAYMENT_METHODS.filter((m) => parts.has(m));
}

export const paymentText = (picked: readonly PaymentMethod[]): string => picked.map((m) => PAYMENT_LABEL[m]).join(', ');

/** Dancer-facing words for the stored list: 'Free' (wins over any other code), the saved methods in screen order, or null. */
export function howToPayText(stored: string | null | undefined): string | null {
  const picked = parsePayment(stored);
  if (picked.length === 0) return null;
  return picked.includes('free') ? PAYMENT_LABEL.free : paymentText(picked);
}
