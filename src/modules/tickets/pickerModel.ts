/**
 * Ticket picker B1 (docs/briefs/ticket-buyer-picker.md): the pure parts. A basket is a
 * count per ticket type; the wire is the basket body (lines[] with expected prices).
 */
import { BOOKING_FEE_PENCE, MAX_PER_ORDER, THANKS_PATH, cancelReturnPath, formatPence, maxQuantity, type PublicTicketType } from './ticketCheckoutModel';
import type { BasketCheckoutBody, PriceChanged } from './priceSteps';

export type Basket = Record<string, number>;

export const CANCELLED_NOTE = 'Payment cancelled. You weren\u2019t charged.';
export const TRUST_LINE_BOLD = 'Secure payment by Stripe.';
export const TRUST_LINE_REST = 'We never see your card.';
export const CODE_LENGTH = 6;

/** The server caps the WHOLE order (all lines) at this many tickets, not each type. */
export const ORDER_CAP_NOTE = `${MAX_PER_ORDER} tickets is the most for one order.`;

/**
 * Counts clamped to what each buyable type allows AND to MAX_PER_ORDER for the whole order
 * (in list order); unknown or unbuyable ids are dropped.
 */
export function cleanBasket(basket: Basket, types: readonly PublicTicketType[], now: Date): Basket {
  const out: Basket = {};
  let left = MAX_PER_ORDER;
  for (const t of types) {
    const n = Math.min(Math.trunc(basket[t.id] ?? 0), maxQuantity(t, now), left);
    if (n > 0) { out[t.id] = n; left -= n; }
  }
  return out;
}

/** How many more of this type the buyer may add: its own limit and what is left of the order cap. */
export function roomFor(t: PublicTicketType, basket: Basket, now: Date): number {
  const count = Object.values(basket).reduce((s, n) => s + n, 0);
  return Math.max(0, Math.min(maxQuantity(t, now) - (basket[t.id] ?? 0), MAX_PER_ORDER - count));
}

/**
 * A price_changed refusal, held for the basket it was priced for: the server's new unit
 * prices and total. It is spent the moment the basket changes (a new key).
 */
export interface PickerHeld {
  key: string;
  units: Record<string, number>;
  totalPence: number;
}

export const basketKey = (b: Basket): string => JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));

/** Fold a parsed price_changed into the basket on screen. A line the reply does not name keeps its listed price. */
export function heldFrom(pc: PriceChanged, basket: Basket, types: readonly PublicTicketType[]): PickerHeld {
  const onScreen = types.filter((t) => (basket[t.id] ?? 0) > 0);
  const units: Record<string, number> = {};
  onScreen.forEach((t, i) => {
    const mine = pc.lines.find((l) => l.ticketTypeId === t.id) ?? pc.lines.find((l) => l.ticketTypeId === null && l.line === i);
    units[t.id] = mine ? mine.newUnitPricePence : t.pricePence;
  });
  return { key: basketKey(basket), units, totalPence: pc.newTotalPence };
}

interface AuthErrorLike { status?: number; code?: string; message?: string }
const rateLimited = (e: AuthErrorLike) => e.status === 429 || e.code === 'over_email_send_rate_limit' || e.code === 'over_request_rate_limit';

/** Resend wait: Supabase's default minimum gap between two codes to one address is 60 s. */
export const RESEND_SECONDS = 60;

/** signInWithOtp error -> copy. A rate limit asks the buyer to wait; anything else asks them to check the address. */
export function sendCodeError(e: AuthErrorLike): string {
  return rateLimited(e) ? 'Too many codes were asked for. Wait a minute, then try again.' : 'We could not send the code. Check the address and try again.';
}

/**
 * verifyOtp error -> copy. Supabase answers a wrong code and an expired one the same way
 * (code otp_expired, "Token has expired or is invalid"), so the copy never claims which.
 */
export function verifyCodeError(e: AuthErrorLike): string {
  return rateLimited(e) ? 'Too many tries. Wait a minute, then try again.' : 'That code is wrong or expired.';
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

export interface SummaryLine { id: string; name: string; quantity: number; free: boolean; priceLabel: string }

/** One line per picked type, in the picker's row order. Free lines say "Free", never "0". */
export function basketSummaryLines(basket: Basket, types: readonly PublicTicketType[]): SummaryLine[] {
  return types
    .filter((t) => (basket[t.id] ?? 0) > 0)
    .map((t) => ({ id: t.id, name: t.name, quantity: basket[t.id], free: t.pricePence <= 0, priceLabel: formatPence(t.pricePence * basket[t.id]) }));
}

/** A basket of only free tickets: no payment step. */
export function isFreeOnly(basket: Basket, types: readonly PublicTicketType[]): boolean {
  const b = basketTotals(basket, types);
  return b.count > 0 && b.totalPence === 0;
}

export function countLabel(count: number): string {
  return count === 0 ? 'No tickets yet' : `${count} ticket${count === 1 ? '' : 's'}`;
}

/** "Saturday 14 November, 9pm" -> "Saturday 14 November". The picker header shows the date only. */
export function dateOnly(dateLine: string | null): string | null {
  if (!dateLine) return null;
  // Also strips a 24-hour time ("at 19:15"), which the 12-hour pattern alone left in place.
  const s = dateLine.replace(/,?\s+(at\s+)?(\d{1,2}([:.]\d{2})?\s?(am|pm)|\d{1,2}[:.]\d{2})\b.*$/i, '').trim();
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
  /** After a price_changed the buyer confirmed: the server's new prices and total. */
  held?: PickerHeld | null;
  /** An applied promo code (as the preview priced it for this basket) and the total it gives. */
  promo?: { code: string; totalPence: number } | null;
}): BasketCheckoutBody {
  const held = f.held && f.held.key === basketKey(f.basket) ? f.held : null;
  const lines = f.types
    .filter((t) => (f.basket[t.id] ?? 0) > 0)
    .map((t) => ({ ticket_type_id: t.id, quantity: f.basket[t.id], expected_unit_price_pence: held?.units[t.id] ?? t.pricePence }));
  const search = f.occurrenceId ? withNight(f.search, f.occurrenceId) : f.search;
  return {
    buyer_email: f.email.trim(),
    success_url: `${f.origin}${THANKS_PATH}`,
    cancel_url: `${f.origin}${cancelReturnPath(f.pathname, search)}`,
    ...(f.occurrenceId ? { occurrence_id: f.occurrenceId } : {}),
    lines,
    // A held price_changed total already carries the code's discount (reserve v5 new_total_pence).
    expected_total_pence: held ? held.totalPence : f.promo ? f.promo.totalPence : basketTotals(f.basket, f.types).totalPence,
    ...(f.promo ? { promo_code: f.promo.code } : {}),
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
