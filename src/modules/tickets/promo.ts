import { feeLabel } from './ticketCheckoutModel';

/**
 * Ticket promo codes, buyer half (docs/briefs/ticket-promo-codes-web.md). The ONE shared
 * mapping from a promo state or refusal reason to what the buyer sees and can do next.
 * The server is the authority: ticket_promo_preview_v1 prices the order (whole-order pence,
 * percent rounded down per ticket, fixed never below 0) and ticket-checkout re-validates.
 */

/** Codes are 3..32 of A-Z 0-9 _ - (stored upper-case); the edge accepts up to 64 chars. */
export const PROMO_MAX_LENGTH = 64;
export const PROMO_PARAM = 'code';

/** Upper-case and trim; anything past the edge limit is cut, never sent. */
export const normaliseCode = (raw: string | null | undefined): string =>
  (raw ?? '').trim().toUpperCase().slice(0, PROMO_MAX_LENGTH);

/** `?code=` on the event link pre-fills the field (it is never applied on its own). */
export function codeFromSearch(search: string): string {
  try {
    return normaliseCode(new URLSearchParams(search).get(PROMO_PARAM));
  } catch {
    return '';
  }
}

/** The code refusals both the preview RPC and ticket-checkout (HTTP 409) can send. */
export const CODE_REASONS = [
  'unknown_code',
  'inactive',
  'expired',
  'used_up',
  'not_for_this_event',
  'no_discount',
  'below_minimum',
] as const;
export type CodeReason = (typeof CODE_REASONS)[number];

export const isCodeReason = (r: string): r is CodeReason => (CODE_REASONS as readonly string[]).includes(r);

/**
 * Buyer copy per reason (admin handover table, British English, no jargon). Preview-only
 * reasons follow: the rate limiter, the wire failing, and the RPC not knowing the ticket.
 */
export const PROMO_REASON_COPY: Readonly<Record<string, string>> = {
  unknown_code: "That code isn't recognised. Check the spelling and try again.",
  inactive: 'That code is no longer active.',
  expired: 'That code has expired.',
  used_up: 'That code has been fully used.',
  not_for_this_event: "That code isn't valid for this event.",
  no_discount: "That code doesn't take anything off this ticket.",
  below_minimum: "With this code the total would be under 30p, which we can't charge. Please contact the organiser.",
  empty: 'Type a code first, then tap Apply.',
  rate_limited: 'Too many attempts. Please wait a while and try again.',
  network: 'Could not check the code. Check your connection, then tap Apply again.',
  timeout: 'Checking the code took too long. Tap Apply again.',
  not_found: 'This ticket is no longer available, so the code could not be checked. Pick another ticket.',
  invalid_quantity: 'Choose between 1 and 20 tickets, then tap Apply again.',
};

/** Own keys only, so "toString" or "__proto__" from a reply is the safe generic. */
export function promoReasonCopy(reason: string): string {
  return Object.prototype.hasOwnProperty.call(PROMO_REASON_COPY, reason)
    ? PROMO_REASON_COPY[reason]
    : 'That code could not be checked. Try again, or remove it to pay the full price.';
}

/** What the preview RPC answered, in the shape the block uses. */
/** Flat on purpose: the app's tsconfig does not narrow a union on `ok`. */
export interface PromoPreview {
  ok: boolean;
  discountPence: number;
  totalPence: number;
  /** '' when ok. */
  reason: string;
}

export const refusePreview = (reason: string): PromoPreview => ({ ok: false, discountPence: 0, totalPence: 0, reason });

const pence = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

export function parsePromoPreview(data: unknown): PromoPreview {
  const b = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (b.ok === true) {
    const discount = pence(b.discount);
    const total = pence(b.total);
    // A "valid" reply without numbers we can show is not something to charge against.
    if (discount === null || total === null) return refusePreview('internal_error');
    return { ok: true, discountPence: discount, totalPence: total, reason: '' };
  }
  return refusePreview(typeof b.reason === 'string' && b.reason ? b.reason : 'internal_error');
}

/**
 * Every state of the promo field. `key` ties an applied price to the ticket and count it
 * was priced for: a change re-prices before Buy is allowed again.
 */
export type PromoState =
  | { status: 'idle' }
  | { status: 'checking'; code: string }
  | { status: 'applied'; code: string; key: string; discountPence: number; totalPence: number }
  | { status: 'refused'; code: string; key: string | null; reason: string };

export const promoKey = (typeId: string, quantity: number) => `${typeId}:${quantity}`;

export interface PromoView {
  /** Line under the field (null = nothing to say). */
  note: string | null;
  tone: 'muted' | 'good' | 'bad';
  /** Null = Apply can be tapped; otherwise why not (shown as the button's description). */
  applyBlocked: string | null;
  /** Null = the code does not hold Buy back; otherwise the reason under Buy. */
  buyBlocked: string | null;
  /** The code checkout sends; null = no promo_code in the body at all. */
  sendCode: string | null;
  /** The priced total to show instead of the list price, or null. */
  appliedTotalPence: number | null;
  appliedDiscountPence: number | null;
}

/** Refusals where the same code may well work on another tap (the wire, the limiter, the server). */
const RETRYABLE = new Set(['network', 'timeout', 'rate_limited', 'internal_error']);

/** The one mapping every screen and test reads. `input` is the field as typed. */
export function promoView(state: PromoState, input: string, key: string | null): PromoView {
  const code = normaliseCode(input);
  const base: PromoView = { note: null, tone: 'muted', applyBlocked: null, buyBlocked: null, sendCode: null, appliedTotalPence: null, appliedDiscountPence: null };
  if (state.status === 'checking') {
    return { ...base, note: 'Checking the code\u2026', applyBlocked: 'Checking the code\u2026', buyBlocked: 'Wait while the promo code is checked.' };
  }
  if (!code) {
    // Apply stays tappable with an empty field (most buyers have no code: no clutter for them).
    return state.status === 'refused' && state.reason === 'empty' ? { ...base, note: promoReasonCopy('empty'), tone: 'bad' } : base;
  }
  if (state.status === 'applied' && state.code === code) {
    // Priced for another ticket or count (the list re-read, or a re-price lost): ask again.
    if (state.key !== key) {
      return { ...base, note: 'Your choice changed. Tap Apply to update the saving.', buyBlocked: 'Tap Apply to update the promo code saving, or clear it.' };
    }
    return {
      ...base,
      note: state.totalPence === 0 ? `Code ${code} applied. Your tickets are free.` : `Code ${code} applied. You save ${feeLabel(state.discountPence)}.`,
      tone: 'good',
      applyBlocked: 'This code is applied.',
      sendCode: code,
      appliedTotalPence: state.totalPence,
      appliedDiscountPence: state.discountPence,
    };
  }
  if (state.status === 'refused' && state.code === code && state.key === key) {
    return {
      ...base,
      note: promoReasonCopy(state.reason),
      tone: 'bad',
      // The same code would be refused again (rate limit aside, where waiting is the way).
      applyBlocked: RETRYABLE.has(state.reason) ? null : 'Change the code to try again.',
      buyBlocked: 'Remove the promo code or try a different one.',
    };
  }
  return { ...base, buyBlocked: 'Tap Apply to check your promo code, or clear it.' };
}
