import { supabase } from '@/integrations/supabase/client';
import {
  parseCheckoutReply,
  parseOrderStatus,
  UNKNOWN_READING,
  type OrderStatusReading,
  parsePublicTypes,
  availability,
  typesForNight,
  type CheckoutBody,
  type CheckoutResult,
  type PublicTicketType,
} from './ticketCheckoutModel';
import { parsePromoPreview, refusePreview, type PromoPreview } from './promo';

/**
 * The buyer wire (S4; night-aware since S1a). ticket_types_public_v2 is not in the generated types.ts yet,
 * so it goes through an untyped rpc boundary. ticket-checkout is called with fetch
 * (not functions.invoke) so a refusal's JSON body -- its `reason` -- is always read.
 * No Stripe key lives here or anywhere in the Website: the edge function holds it.
 */
type Untyped = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export const publicTicketKeys = {
  /** Keyed on the night too: a series-wide type's stock and close differ per night. */
  types: (seriesId: string | null, occurrenceId: string | null) => ['public-ticket-types', seriesId, occurrenceId] as const,
};

/**
 * Public read of one order (thank-you page). A normal POST rpc: the function is VOLATILE,
 * never a GET/head call. Any error (including the RPC not being applied yet) or odd reply
 * reads as `unknown`, so the page keeps its neutral copy. The id goes nowhere else.
 */
export async function readOrderStatus(orderId: string): Promise<OrderStatusReading> {
  try {
    const { data, error } = await (supabase as unknown as Untyped).rpc('ticket_order_public_status_v1', { p_ref: orderId });
    if (error) return UNKNOWN_READING;
    return parseOrderStatus(data);
  } catch {
    return UNKNOWN_READING;
  }
}

/**
 * Types for the night on screen (S1a). With a night, per-night types carry that night's
 * remaining / sold_out / effective close, and nights the server refuses (past, cancelled)
 * answer no rows. With NO night, per-night types answer remaining NULL (parsed needsNight).
 * ticket_types_public_v1 stays callable server-side; the buyer pages no longer call it.
 */
export async function fetchPublicTicketTypes(seriesId: string, occurrenceId: string | null): Promise<PublicTicketType[]> {
  const { data, error } = await (supabase as unknown as Untyped).rpc('ticket_types_public_v2', {
    p_event_series_id: seriesId,
    p_occurrence_id: occurrenceId,
  });
  if (error) throw new Error(error.message);
  return parsePublicTypes(data);
}

/**
 * Price an order with a promo code (anon, uses nothing up; checkout re-validates).
 * p_series takes the series id or the public event id. The wire failing reads as
 * `network`, so the field says to check the connection; it never throws.
 */
export async function previewPromo(seriesId: string, typeId: string, quantity: number, code: string, occurrenceId: string | null): Promise<PromoPreview> {
  try {
    const { data, error } = await (supabase as unknown as Untyped).rpc('ticket_promo_preview_v2', {
      p_series: seriesId,
      p_ticket_type: typeId,
      p_quantity: quantity,
      p_code: code,
      p_occurrence_id: occurrenceId,
    });
    if (error) return refusePreview('network');
    return parsePromoPreview(data);
  } catch {
    return refusePreview('network');
  }
}

/** A stalled phone connection must not hold "Working on it" forever. */
export const CHECKOUT_TIMEOUT_MS = 20_000;

/** AbortSignal.timeout where the browser has it (Safari < 16 does not), else the same by hand. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException('timed out', 'TimeoutError')), ms);
  return c.signal;
}

export async function postTicketCheckout(body: CheckoutBody): Promise<CheckoutResult> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return { kind: 'error', reason: 'not_configured', message: null };
  let token = key;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? key;
  } catch {
    /* signed out or storage blocked: the publishable key is the documented fallback */
  }
  const send = (bearer: string) =>
    fetch(`${url}/functions/v1/ticket-checkout`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeoutSignal(CHECKOUT_TIMEOUT_MS),
    });
  let resp: Response;
  try {
    resp = await send(token);
    // A stale session token is refused by the verify_jwt gateway (401, no reason) BEFORE
    // the function runs, so no order exists yet: buying needs no sign-in, so retry once
    // as a guest with the publishable key. The function itself never answers 401.
    if (resp.status === 401 && token !== key) resp = await send(key);
  } catch (e) {
    // The timeout above fired (TimeoutError, or AbortError from the fallback), or offline.
    // Never resent here: a retry is the buyer's own tap, one POST each, and an order the
    // server made in the meantime expires on its own.
    const name = (e as { name?: unknown } | null)?.name;
    return { kind: 'error', reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network', message: null };
  }
  const json = await resp.json().catch(() => null);
  return parseCheckoutReply(json, resp.status);
}

/**
 * TICKET_LEAD_IN_SITE: the one answer to "does this event sell tickets in-site right now?".
 * True when at least one type for the night is buyable (on sale, in its window, stock left).
 * The sticky bar and the buy block both read this, so they cannot disagree. Sold out,
 * not-yet and closed types do not count: nothing could be bought, so the external link
 * stays the way in.
 */
export type SiteBarState = 'buy' | 'quiet' | 'none';

/** Sticky bar state: Buy tickets, a quiet disabled bar (types exist, none buyable), or nothing. */
export function siteBarState(types: PublicTicketType[] | undefined | null, now: Date = new Date()): SiteBarState {
  if (!types || types.length === 0) return 'none';
  return sellsInSite(types, now) ? 'buy' : 'quiet';
}

/**
 * TICKET_LEAD_IN_SITE: "ticketing is live for this night" = our Buy is buyable right now.
 * While true, surfaces hide the organiser's external link (ours leads). `quiet` (sold out,
 * closed, not yet open) and `none` are NOT live, so the external link shows. Decided per
 * night: pass that night's types (the probe already does).
 */
export function ticketingLive(types: PublicTicketType[] | undefined | null, now: Date = new Date()): boolean {
  return siteBarState(types, now) === 'buy';
}

/** Button word for the quiet bar: "Sold out" when every type is gone, else the quiet-bar word. */
export function quietBarButton(types: PublicTicketType[], now: Date = new Date()): string {
  const kinds = types.map((t) => availability(t, now).kind);
  if (kinds.every((k) => k === 'sold_out')) return 'Sold out';
  if (kinds.includes('needs_night')) return 'Choose a night';
  if (kinds.includes('not_yet')) return 'Not yet';
  return 'Closed';
}

/** One in-site type that is buyable right now, as the JSON-LD offer needs it. Price in pounds (types are GBP-only). */
export interface LiveOffer { name: string; price: string }

/** The buyable types for this night. Prices are the wire's own (pence / 100), never a guess. */
export function liveOffers(types: PublicTicketType[] | undefined | null, occurrenceId: string | null, now: Date = new Date()): LiveOffer[] {
  return typesForNight(types ?? [], occurrenceId)
    .filter((t) => availability(t, now).kind === 'buyable')
    .map((t) => ({ name: t.name, price: (t.pricePence / 100).toFixed(2) }));
}

export function sellsInSite(types: PublicTicketType[] | undefined | null, now: Date = new Date(), occurrenceId?: string | null): boolean {
  const list = occurrenceId === undefined ? (types ?? []) : typesForNight(types ?? [], occurrenceId);
  return list.some((t) => availability(t, now).kind === 'buyable');
}
