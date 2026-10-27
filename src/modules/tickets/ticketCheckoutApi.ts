import { supabase } from '@/integrations/supabase/client';
import {
  parseCheckoutReply,
  parsePublicTypes,
  type CheckoutBody,
  type CheckoutResult,
  type PublicTicketType,
} from './ticketCheckoutModel';

/**
 * The buyer wire (S4). ticket_types_public_v1 is not in the generated types.ts yet,
 * so it goes through an untyped rpc boundary. ticket-checkout is called with fetch
 * (not functions.invoke) so a refusal's JSON body -- its `reason` -- is always read.
 * No Stripe key lives here or anywhere in the Website: the edge function holds it.
 */
type Untyped = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export const publicTicketKeys = {
  types: (seriesId: string | null) => ['public-ticket-types', seriesId] as const,
};

export async function fetchPublicTicketTypes(seriesId: string): Promise<PublicTicketType[]> {
  const { data, error } = await (supabase as unknown as Untyped).rpc('ticket_types_public_v1', {
    p_event_series_id: seriesId,
  });
  if (error) throw new Error(error.message);
  return parsePublicTypes(data);
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
