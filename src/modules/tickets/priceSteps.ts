/**
 * T4 buyer (design-ticketing-organisers s.3a-3d): the basket wire with expected prices,
 * the "price rises on <date>" card line, and the price_changed confirm state.
 * Everything here runs only behind flags.ticketPriceSteps; OFF, the block posts the old body.
 */
import { BOOKING_FEE_PENCE, formatPence, type CheckoutBody, type PublicTicketType, type ReasonCopy } from './ticketCheckoutModel';

/** Fee rule shared with the server (v3/v4/v5): no fee when the post-discount amount is 0. */
export function checkoutFee(netPence: number, quantity: number, feePerTicket: number = BOOKING_FEE_PENCE): number {
  return netPence > 0 ? feePerTicket * quantity : 0;
}

/** The pay-button total: unit x qty, minus the applied discount (never below 0), plus the fee on that net. */
export function expectedTotal(unitPence: number, quantity: number, discountPence: number | null, feePerTicket: number = BOOKING_FEE_PENCE): number {
  const net = Math.max(0, unitPence * quantity - (discountPence ?? 0));
  return net + checkoutFee(net, quantity, feePerTicket);
}

export interface BasketLine {
  ticket_type_id: string;
  quantity: number;
  expected_unit_price_pence: number;
}

/** The v5 body: the old body's buyer fields, with the type and quantity moved into lines[]. */
export interface BasketCheckoutBody extends Omit<CheckoutBody, 'ticket_type_id' | 'quantity'> {
  lines: BasketLine[];
  expected_total_pence: number;
}

/** Old body -> basket body. Integers only: a non-integer here is a bug, so it fails loudly. */
export function toBasketBody(body: CheckoutBody, unitPence: number, totalPence: number): BasketCheckoutBody {
  if (!Number.isInteger(unitPence) || !Number.isInteger(totalPence)) throw new Error('expected prices must be integers');
  const { ticket_type_id, quantity, ...rest } = body;
  return {
    ...rest,
    lines: [{ ticket_type_id, quantity, expected_unit_price_pence: unitPence }],
    expected_total_pence: totalPence,
  };
}

export interface PriceChanged {
  lines: { line: number; ticketTypeId: string | null; newUnitPricePence: number }[];
  newTotalPence: number;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** A price_changed reply -> its new values; null when the reply is not usable (no integer total). */
export function parsePriceChanged(body: unknown): PriceChanged | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (b.reason !== 'price_changed' || !isInt(b.new_total_pence)) return null;
  const lines: PriceChanged['lines'] = [];
  for (const l of Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : []) {
    if (!l || !isInt(l.new_unit_price_pence)) continue;
    lines.push({
      line: isInt(l.line) ? l.line : 0,
      ticketTypeId: typeof l.ticket_type_id === 'string' ? l.ticket_type_id : null,
      newUnitPricePence: l.new_unit_price_pence,
    });
  }
  return { lines, newTotalPence: b.new_total_pence };
}

/** The confirm state held after a price_changed: what the next tap sends. */
export interface PriceConfirm {
  typeId: string;
  quantity: number;
  code: string | null;
  unitPence: number;
  totalPence: number;
}

/** Fold a price_changed into the basket on screen (one line, index 0). A total-only reply keeps the unit. */
export function confirmFrom(pc: PriceChanged, typeId: string, quantity: number, code: string | null, currentUnit: number): PriceConfirm {
  const mine = pc.lines.find((l) => l.ticketTypeId === typeId) ?? pc.lines.find((l) => l.line === 0);
  return { typeId, quantity, code, unitPence: mine ? mine.newUnitPricePence : currentUnit, totalPence: pc.newTotalPence };
}

export const PRICE_CONFIRM_LABEL = 'Price changed, confirm';

/** Copy for the two T4 reasons. Old tabs reach expected_price_required only after T2b. */
export function stepReasonCopy(reason: string, confirm: PriceConfirm | null): ReasonCopy | null {
  if (reason === 'price_changed' && confirm) {
    return { text: `The price changed while this page was open. New total: ${confirm.totalPence === 0 ? 'Free' : formatPence(confirm.totalPence)}. Check and pay again.`, way: 'retry' };
  }
  if (reason === 'expected_price_required') return { text: 'Please reload the page and try again.', way: 'retry' };
  return null;
}

const STEP_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "Price rises on Sat 25 Oct, 00:30" (UK time), "changes" when it drops; null with no future step. */
export function stepLine(t: PublicTicketType, now: Date): string | null {
  if (t.nextPricePence == null || !t.nextPriceAt) return null;
  const at = new Date(t.nextPriceAt);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime() || t.nextPricePence === t.pricePence) return null;
  const word = t.nextPricePence > t.pricePence ? 'rises' : 'changes';
  return `Price ${word} on ${STEP_FMT.format(at)}`;
}
