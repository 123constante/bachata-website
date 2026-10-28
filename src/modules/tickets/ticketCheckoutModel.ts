/**
 * Buyer checkout (S4, docs/ticketing-buyer-journey.md): the ONE mapping for what a
 * ticket type shows, how many can be bought, the total lines, why Buy is disabled and
 * what each server refusal says. Pure; the block and the thank-you page only render it.
 */
import { BOOKING_FEE_PENCE } from '@/lib/ticketBookingFee';

/** Owner Q2: at most 20 tickets per order (the edge function's MAX_QUANTITY). */
export const MAX_PER_ORDER = 20;
/** Owner Q9: the booking fee per paid ticket, shown on its own line. The one shared constant;
 *  the server's value is env TICKET_BOOKING_FEE_PENCE (keep it unset = 50). */
export { BOOKING_FEE_PENCE };
/** The only origins the edge function accepts for success_url / cancel_url. */
export const CHECKOUT_ORIGINS: readonly string[] = [
  'https://bachatacalendar.co.uk',
  'https://www.bachatacalendar.co.uk',
];
export const THANKS_PATH = '/tickets/thanks';
export const CANCELLED_PARAM = 'tickets';
export const ORDER_STORAGE_KEY = 'bc.ticketOrderId';
/** Stripe's hosted checkout: the only place a reply may send the buyer. */
export const STRIPE_CHECKOUT_PREFIX = 'https://checkout.stripe.com/';

/** The edge function's own UUID check; an order id that fails it is no order. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrderId = (s: string | null | undefined): s is string => typeof s === 'string' && UUID.test(s);

export type PublicTypeStatus = 'on_sale' | 'sold_out';

export interface PublicTicketType {
  id: string;
  /** Null = series-wide; otherwise the one night (occurrence) it admits to. */
  occurrenceId: string | null;
  name: string;
  pricePence: number;
  status: PublicTypeStatus;
  remaining: number;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

/** ticket_types_public_v1 rows -> types. Unknown statuses and non-GBP rows are dropped (Q10). */
export function parsePublicTypes(data: unknown): PublicTicketType[] {
  if (!Array.isArray(data)) return [];
  const out: PublicTicketType[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const id = str(r?.id);
    const status = r?.status === 'on_sale' || r?.status === 'sold_out' ? r.status : null;
    const currency = str(r?.currency)?.toUpperCase() ?? 'GBP';
    if (!id || !status || currency !== 'GBP') continue;
    out.push({
      id,
      occurrenceId: str(r.occurrence_id),
      name: str(r.name) ?? 'Ticket',
      pricePence: int(r.price_pence),
      status,
      remaining: int(r.remaining),
      salesOpenAt: str(r.sales_open_at),
      salesCloseAt: str(r.sales_close_at),
    });
  }
  return out;
}

export function formatPence(pence: number): string {
  if (pence === 0) return 'Free';
  const digits = pence % 100 === 0 ? 0 : 2;
  return `\u00a3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "50p" under a pound, else as formatPence: how the fee line and the terms name the fee. */
export const feeLabel = (pence: number): string => (pence < 100 ? `${pence}p` : formatPence(pence));
export const BOOKING_FEE_LABEL = feeLabel(BOOKING_FEE_PENCE);

export type Availability =
  | { kind: 'buyable'; label: string }
  | { kind: 'sold_out'; label: string }
  | { kind: 'not_yet'; label: string }
  | { kind: 'closed'; label: string };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** What one row says and whether it can be picked. `now` is injected for tests. */
export function availability(t: PublicTicketType, now: Date): Availability {
  if (t.status === 'sold_out' || t.remaining <= 0) return { kind: 'sold_out', label: 'Sold out' };
  if (t.salesOpenAt && new Date(t.salesOpenAt) > now) {
    return { kind: 'not_yet', label: `On sale ${shortDate(t.salesOpenAt)}` };
  }
  if (t.salesCloseAt && new Date(t.salesCloseAt) <= now) return { kind: 'closed', label: 'Sales closed' };
  return { kind: 'buyable', label: t.remaining <= 20 ? `${t.remaining} left` : 'On sale' };
}

/** Types for the night on screen: series-wide ones plus those for this occurrence. */
export function typesForNight(types: PublicTicketType[], occurrenceId: string | null): PublicTicketType[] {
  return types.filter((t) => t.occurrenceId === null || t.occurrenceId === occurrenceId);
}

/** The stepper's ceiling: 20 per order and never more than remain. 0 = cannot buy. */
export function maxQuantity(t: PublicTicketType, now: Date): number {
  return availability(t, now).kind === 'buyable' ? Math.min(MAX_PER_ORDER, t.remaining) : 0;
}

export function clampQuantity(q: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(max, Math.max(1, Math.trunc(q) || 1));
}

export interface Totals {
  free: boolean;
  subtotalPence: number;
  feePence: number;
  totalPence: number;
}

export function totals(t: PublicTicketType, quantity: number): Totals {
  const free = t.pricePence === 0;
  const subtotalPence = t.pricePence * quantity;
  const feePence = free ? 0 : BOOKING_FEE_PENCE * quantity;
  return { free, subtotalPence, feePence, totalPence: subtotalPence + feePence };
}

/** Same shape the edge function checks (it is the authority; this only avoids a round trip). */
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim()) && s.trim().length <= 254;

/**
 * A Vercel PREVIEW build may also check out from one named origin (the stable walk alias), so the
 * ticketing flow can be tested end to end before the live switch. It needs BOTH VERCEL_ENV=preview
 * and VITE_TICKET_PREVIEW_ORIGIN set to a bare https origin; production builds fold it to ''.
 * The edge function must accept the same origin (its TICKET_PREVIEW_ORIGIN secret).
 */
export const previewCheckoutOrigin = (vercelEnv: string | null | undefined, raw: string | null | undefined): string => {
  const v = (raw ?? '').trim();
  if (vercelEnv !== 'preview' || !v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.origin === v ? v : '';
  } catch {
    return '';
  }
};

const PREVIEW_ORIGIN = previewCheckoutOrigin(
  import.meta.env?.VITE_VERCEL_ENV,
  import.meta.env?.VITE_TICKET_PREVIEW_ORIGIN,
);

export const checkoutOriginOk = (origin: string, previewOrigin: string = PREVIEW_ORIGIN) =>
  CHECKOUT_ORIGINS.includes(origin) || (previewOrigin !== '' && origin === previewOrigin);

export interface FormState {
  type: PublicTicketType | null;
  quantity: number;
  email: string;
  termsAccepted: boolean;
  origin: string;
  submitting: boolean;
}

/** Null = Buy is enabled; otherwise the reason shown under the disabled button. */
export function disabledReason(f: FormState, now: Date): string | null {
  if (!f.type) return 'Pick a ticket first.';
  // Before any field: a preview can never complete checkout, so do not ask for an email first.
  if (!checkoutOriginOk(f.origin)) return 'Checkout only works on bachatacalendar.co.uk, not on this preview.';
  const max = maxQuantity(f.type, now);
  if (max === 0) return `${f.type.name} cannot be bought right now (${availability(f.type, now).label.toLowerCase()}).`;
  if (f.quantity < 1 || f.quantity > max) return `Choose between 1 and ${max} tickets.`;
  if (!f.email.trim()) return 'Enter your email so we can send your tickets.';
  if (!isEmail(f.email)) return 'That email does not look right.';
  if (!f.termsAccepted) return 'Tick the box to accept the terms of sale.';
  if (f.submitting) return 'Working on it\u2026';
  return null;
}

export const buyLabel = (t: PublicTicketType | null) => (t && t.pricePence === 0 ? 'Get free ticket' : 'Buy tickets');

export interface CheckoutBody {
  ticket_type_id: string;
  quantity: number;
  buyer_email: string;
  buyer_name?: string;
  success_url: string;
  cancel_url: string;
}

/** The event page to come back to on cancel: same path and night (?occurrenceId), plus tickets=cancelled. */
export function cancelReturnPath(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  q.set(CANCELLED_PARAM, 'cancelled');
  return `${pathname}?${q.toString()}`;
}

export function buildCheckoutBody(
  f: { typeId: string; quantity: number; email: string; name: string },
  origin: string,
  cancelPath: string,
): CheckoutBody {
  const name = f.name.trim();
  return {
    ticket_type_id: f.typeId,
    quantity: f.quantity,
    buyer_email: f.email.trim(),
    ...(name ? { buyer_name: name.slice(0, 200) } : {}),
    success_url: `${origin}${THANKS_PATH}`,
    cancel_url: `${origin}${cancelPath}`,
  };
}

export type CheckoutResult =
  | { kind: 'redirect'; orderId: string; url: string }
  | { kind: 'free'; orderId: string }
  | { kind: 'error'; reason: string; message: string | null };

export function parseCheckoutReply(body: unknown, httpStatus: number): CheckoutResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const orderId = str(b.order_id);
  if (b.ok === true && orderId && b.free === true) return { kind: 'free', orderId };
  const url = str(b.checkout_url);
  if (b.ok === true && orderId && url && url.startsWith(STRIPE_CHECKOUT_PREFIX)) return { kind: 'redirect', orderId, url };
  const reason =
    str(b.reason) ??
    (httpStatus === 404 || httpStatus === 503 ? 'not_configured' : httpStatus === 401 ? 'unauthorised' : 'internal_error');
  return { kind: 'error', reason, message: str(b.message) };
}

export type WayForward = 'retry' | 'pick_another' | 'contact_organiser' | 'fix_form';

export interface ReasonCopy {
  text: string;
  way: WayForward;
}

/** A cancelled or abandoned Stripe session keeps its tickets until it expires (32 min). */
const RATE_HELD = 'If you cancelled a checkout just now, those tickets are held for about 30 minutes.';

/** Every refusal the edge function can send, in plain English, each with a way forward. */
export const REASON_COPY: Readonly<Record<string, ReasonCopy>> = {
  invalid_request: { text: 'Something in the form was not accepted. Check your email and the number of tickets, then try again.', way: 'fix_form' },
  invalid_quantity: { text: 'That number of tickets was not accepted. Choose between 1 and 20, then try again.', way: 'fix_form' },
  invalid_email: { text: 'That email was not accepted. Check it, then try again.', way: 'fix_form' },
  invalid_fee: { text: 'The booking could not be priced. You have not been charged. Try again; if it keeps happening, contact the organiser.', way: 'retry' },
  refused: { text: 'Your tickets could not be reserved. You have not been charged. Try again.', way: 'retry' },
  rate_limited: { text: `Too many ticket requests. Please wait a while and try again. ${RATE_HELD}`, way: 'retry' },
  not_found: { text: 'This ticket is no longer available. Pick another ticket.', way: 'pick_another' },
  not_on_sale: { text: 'This ticket is not on sale right now. Pick another ticket.', way: 'pick_another' },
  outside_sales_window: { text: 'Sales for this ticket are not open right now. Pick another ticket or come back later.', way: 'pick_another' },
  sold_out: { text: 'Not enough of this ticket left. Pick fewer or another ticket.', way: 'pick_another' },
  organiser_not_onboarded: { text: 'The organiser cannot take payments yet. Contact the organiser for tickets.', way: 'contact_organiser' },
  stripe_error: { text: 'The payment page could not be opened. You have not been charged. Try again.', way: 'retry' },
  internal_error: { text: 'Something went wrong on our side. You have not been charged. Try again.', way: 'retry' },
  // Free orders: the server closed the order as failed, so a fresh try is the way forward.
  free_issue_failed: { text: 'Your free tickets could not be issued. Nothing was booked. Try again.', way: 'retry' },
  not_free: { text: 'This ticket could not be booked as a free ticket. Nothing was booked. Try again.', way: 'retry' },
  not_pending: { text: 'That booking ran out of time before it finished. Nothing was booked. Try again.', way: 'retry' },
  stale: { text: 'That booking ran out of time before it finished. Nothing was booked. Try again.', way: 'retry' },
  method_not_allowed: { text: 'The ticket service did not accept this request. You have not been charged. Refresh the page and try again.', way: 'retry' },
  not_configured: { text: 'Online tickets are not switched on yet. Contact the organiser for tickets.', way: 'contact_organiser' },
  unauthorised: { text: 'The ticket service did not accept this request. Refresh the page and try again; if it keeps happening, contact the organiser.', way: 'retry' },
  network: { text: 'Could not reach the ticket service. Check your connection and try again.', way: 'retry' },
  // The POST gave up after CHECKOUT_TIMEOUT_MS: the buyer never reached Stripe.
  timeout: { text: 'The ticket service took too long to answer. You have not been charged. Try again.', way: 'retry' },
};

/** The one lookup: an own key only, so "toString" or "__proto__" from a reply is unmapped. */
export function reasonCopy(reason: string, message: string | null = null): ReasonCopy {
  const known = Object.prototype.hasOwnProperty.call(REASON_COPY, reason) ? REASON_COPY[reason] : undefined;
  if (known) return reason === 'rate_limited' && message ? { ...known, text: `${message} ${RATE_HELD}` } : known;
  return { text: 'Your tickets could not be booked. You have not been charged. Try again.', way: 'retry' };
}

export const WAY_LABEL: Readonly<Record<WayForward, string>> = {
  retry: 'Try again',
  pick_another: 'Pick another ticket',
  contact_organiser: 'Contact the organiser',
  fix_form: 'Check the form',
};

/**
 * What the thank-you page knows about the order. 'confirmed' = the server said it is paid;
 * 'checking' = we hold a well-formed order id but no server word on it (the Website has no
 * public order read yet, so a paid return is always this); 'none' = no order id at all.
 */
export type ThanksOrderState = 'confirmed' | 'checking' | 'none' | 'paid' | 'failed' | 'processing';

/** What ticket_order_public_status_v1 says about an order. `unknown` is also every odd reply. */
export type OrderStatus = 'paid' | 'pending' | 'failed' | 'unknown';
export interface OrderStatusReading {
  status: OrderStatus;
  ticketCount: number | null;
  eventTitle: string | null;
  eventDate: string | null;
  retryLater: boolean;
}
export const UNKNOWN_READING: OrderStatusReading = {
  status: 'unknown', ticketCount: null, eventTitle: null, eventDate: null, retryLater: false,
};

/** Defensive parse: anything that is not the documented shape reads as `unknown`, never as `paid`. */
export function parseOrderStatus(raw: unknown): OrderStatusReading {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return UNKNOWN_READING;
  const o = raw as Record<string, unknown>;
  const status: OrderStatus =
    o.status === 'paid' || o.status === 'pending' || o.status === 'failed' ? o.status : 'unknown';
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const n = typeof o.ticket_count === 'number' && Number.isInteger(o.ticket_count) && o.ticket_count > 0 ? o.ticket_count : null;
  return {
    status,
    ticketCount: status === 'paid' ? n : null,
    eventTitle: status === 'paid' || status === 'failed' ? str(o.event_title) : null,
    eventDate: status === 'paid' ? str(o.event_date) : null,
    retryLater: o.retry_later === true,
  };
}

/** Polls wait 2, 4, 8 s, then 15 s; at most 8 (the RPC allows 120 calls per IP per hour). */
export const MAX_ORDER_POLLS = 8;
export const pollDelayMs = (pollIndex: number): number => [2000, 4000, 8000][pollIndex] ?? 15000;

export interface ThanksDetail {
  ticketCount?: number | null;
  eventTitle?: string | null;
  eventDate?: string | null;
}

/** The thank-you page's words. Tickets are issued by the webhook, never by the redirect. */
export function thanksCopy(
  free: boolean,
  state: ThanksOrderState,
  detail: ThanksDetail = {},
): { title: string; body: string } {
  // Server word first. Only `paid` may say Confirmed.
  if (state === 'paid') {
    const n = detail.ticketCount;
    const what = [n ? `${n} ${n === 1 ? 'ticket' : 'tickets'}` : null, detail.eventTitle ? `for ${detail.eventTitle}` : null]
      .filter(Boolean)
      .join(' ');
    const parts = [what || null, detail.eventDate ?? null].filter(Boolean);
    return {
      title: 'Confirmed. Your tickets are in your email.',
      body: `${parts.length ? `${parts.join(', ')}. ` : ''}Each ticket has a code to show at the door. If nothing arrives within an hour, check your spam folder, then contact the organiser.`,
    };
  }
  if (state === 'failed') {
    return {
      title: "Payment didn't go through",
      body: `No tickets were issued${detail.eventTitle ? ` for ${detail.eventTitle}` : ''}. You can go back and try again.`,
    };
  }
  if (state === 'processing') {
    return {
      title: 'Still processing',
      body: 'Your order is still processing. Check your email in a few minutes. If nothing arrives within an hour, check your spam folder, then contact the organiser.',
    };
  }
  if (free) {
    return {
      title: 'Your free tickets are on their way',
      body: 'We are emailing your tickets now. Each ticket has a code to show at the door.',
    };
  }
  if (state === 'confirmed') {
    return {
      title: 'Payment received, your tickets are being emailed',
      body: 'Your tickets will arrive by email in a few minutes, each with a code to show at the door. If nothing arrives within an hour, check your spam folder, then contact the organiser.',
    };
  }
  // No server word on a payment: the page must not claim one.
  return {
    title: 'Checking your order',
    body:
      state === 'checking'
        ? 'If your payment went through, your tickets will arrive by email in a few minutes, each with a code to show at the door. If nothing arrives within an hour, check your spam folder, then contact the organiser.'
        : 'If you completed payment, your tickets will arrive by email in a few minutes. If nothing arrives within an hour, check your spam folder, then contact the organiser.',
  };
}
