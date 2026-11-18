import { BOOKING_FEE_PENCE, type PublicTicketType } from './ticketCheckoutModel';
import { refusePreview, type PromoPreview } from './promo';
import { basketKey, type Basket, type BasketTotals } from './pickerModel';

/**
 * Promo codes on the B1 basket picker. No new RPC: each paid basket line is priced by the
 * same ticket_promo_preview_v2 call the classic page uses (type, quantity, code, night),
 * and the discounts are summed. ticket_checkout_reserve_v5 prices a basket code the same
 * way (per-ticket discount of each line times its quantity, summed; the fee only on a
 * net above 0), and re-validates the code at checkout.
 */
export interface PromoLine { typeId: string; quantity: number }

/** The lines a code can take anything off: picked and not free. */
export const promoLines = (basket: Basket, types: readonly PublicTicketType[]): PromoLine[] =>
  types.filter((t) => t.pricePence > 0 && (basket[t.id] ?? 0) > 0).map((t) => ({ typeId: t.id, quantity: basket[t.id] }));

/** The preview holds only for the basket and night it was priced for. */
export const pickerPromoKey = (basket: Basket, occurrenceId: string | null): string => `${basketKey(basket)}@${occurrenceId ?? ''}`;

/** Refusal when nothing priced is picked (no RPC call). */
export const NO_PAID_LINES = 'no_paid_lines';
export const NO_PAID_LINES_COPY = 'Pick a ticket first, then tap Apply.';

export type LinePreview = (typeId: string, quantity: number, code: string) => Promise<PromoPreview>;

/** One preview per line, in parallel; the first refusal (basket order) speaks for the code. */
export async function previewBasketPromo(lines: readonly PromoLine[], code: string, preview: LinePreview): Promise<PromoPreview> {
  if (lines.length === 0) return refusePreview(NO_PAID_LINES);
  const rs = await Promise.all(lines.map((l) => preview(l.typeId, l.quantity, code)));
  const bad = rs.find((r) => !r.ok);
  if (bad) return bad;
  return {
    ok: true,
    discountPence: rs.reduce((n, r) => n + r.discountPence, 0),
    totalPence: rs.reduce((n, r) => n + r.totalPence, 0),
    reason: '',
  };
}

/** What the buyer pays with a discount: net never below 0, fee per ticket only on a net above 0 (reserve v5). */
export function discountedTotal(sum: BasketTotals, discountPence: number, feePerTicket: number = BOOKING_FEE_PENCE): number {
  const net = Math.max(0, sum.subtotalPence - discountPence);
  return net + (net > 0 ? feePerTicket * sum.count : 0);
}
