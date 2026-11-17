/**
 * Ticket picker B1 (docs/briefs/ticket-buyer-picker.md): the pure parts. A basket is a
 * count per ticket type; the wire is the basket body (lines[] with expected prices).
 */
import { BOOKING_FEE_PENCE, THANKS_PATH, cancelReturnPath, formatPence, maxQuantity, type PublicTicketType } from './ticketCheckoutModel';
import type { BasketCheckoutBody } from './priceSteps';

export type Basket = Record<string, number>;

export const CANCELLED_NOTE = 'Payment cancelled. You weren’t charged.';
export const TRUST_LINE_BOLD = 'Secure payment by Stripe.';
export const TRUST_LINE_REST = 'We never see your card.';
export const CODE_LENGTH = 6;

/** Counts clamped to what each buyable type allows; unknown or unbuyable ids are dropped. */
export function cleanBasket(basket: Basket, types: readonly PublicTicketType[], now: Date): Basket {
  const out: Basket = {};
  for (const t of types) {
    const n = Math.min(Math.trunc(basket[t.id] ?? 0), maxQuantity(t, now));
    if (n > 0) out[t.id] = n;
  }
  return out;
}

export interface BasketTotals {
  count: number;
  subtotalPence: number;
  feePence: number;
  totalPence: number;
}

/** Same fee rule as the server: a flat fee per ticket on a paid order, none when it is free. */
export function basketTotals(basket: Basket, types: readonly PublicTicketType[]): BasketTotals {
  let count = 0;
  let subtotalPence = 0;
  for (const t of types) {
    const n = basket[t.id] ?? 0;
    count += n;
    subtotalPence += n * t.pricePence;
  }
  const feePence = subtotalPence > 0 ? BOOKING_FEE_PENCE * count : 0;
  return { count, subtotalPence, feePence, totalPence: subtotalPence + feePence };
}

export function countLabel(count: number): string {
  return count === 0 ? 'No tickets yet' : `${count} ticket${count === 1 ? '' : 's'}`;
}

/** "Saturday 14 November, 9pm" -> "Saturday 14 November". The picker header shows the date only. */
export function dateOnly(dateLine: string | null): string | null {
  if (!dateLine) return null;
  const s = dateLine.replace(/,?\s+(at\s+)?\d{1,2}([:.]\d{2})?\s?(am|pm)\b.*$/i, '').trim();
  return s || null;
}

export const isEmail = (v: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/** Per-class line from the data: price per class when a name says "<n> classes"; else nothing is invented. */
export function perLine(t: PublicTicketType): string | null {
  if (t.pricePence <= 0) return null;
  const m = /(\d+)\s*classes?\b/i.exec(t.name);
  const n = m ? Number(m[1]) : 0;
  if (n < 2) return null;
  return `${formatPence(Math.round(t.pricePence / n))} a class`;
}

export function buildPickerBody(f: {
  basket: Basket;
  types: readonly PublicTicketType[];
  email: string;
  occurrenceId: string | null;
  origin: string;
  pathname: string;
  search: string;
}): BasketCheckoutBody {
  const lines = f.types
    .filter((t) => (f.basket[t.id] ?? 0) > 0)
    .map((t) => ({ ticket_type_id: t.id, quantity: f.basket[t.id], expected_unit_price_pence: t.pricePence }));
  const search = f.occurrenceId ? withNight(f.search, f.occurrenceId) : f.search;
  return {
    buyer_email: f.email.trim(),
    success_url: `${f.origin}${THANKS_PATH}`,
    cancel_url: `${f.origin}${cancelReturnPath(f.pathname, search)}`,
    ...(f.occurrenceId ? { occurrence_id: f.occurrenceId } : {}),
    lines,
    expected_total_pence: basketTotals(f.basket, f.types).totalPence,
  };
}

function withNight(search: string, occurrenceId: string): string {
  const q = new URLSearchParams(search);
  q.set('occurrenceId', occurrenceId);
  return `?${q.toString()}`;
}

const key = (seriesId: string, occ: string | null) => `bc.pickerBasket.${seriesId}.${occ ?? ''}`;
export function saveBasket(seriesId: string, occ: string | null, b: Basket): void {
  try { sessionStorage.setItem(key(seriesId, occ), JSON.stringify(b)); } catch { /* storage blocked: basket just is not kept */ }
}
export function loadBasket(seriesId: string, occ: string | null): Basket {
  try {
    const raw = JSON.parse(sessionStorage.getItem(key(seriesId, occ)) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Basket = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && v > 0) out[k] = Math.trunc(v);
    return out;
  } catch { return {}; }
}
