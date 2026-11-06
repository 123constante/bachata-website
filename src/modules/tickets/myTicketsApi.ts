import { supabase } from '@/integrations/supabase/client';
import { parseMyTickets, parseOrderQr, type MyTicketsReply, type OrderQrTicket } from './myTicketsModel';

/**
 * The one read: my_tickets_v1() (authenticated only, no args). Not in the generated types yet,
 * so an untyped rpc boundary like ticketCheckoutApi. The reply carries qr_tokens: nothing here
 * logs the reply or the error body.
 */
type Untyped = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> };

export type MyTicketsResult =
  | { kind: 'ok'; reply: MyTicketsReply }
  | { kind: 'signed_out' }
  | { kind: 'error' };

export async function fetchMyTickets(): Promise<MyTicketsResult> {
  try {
    const { data, error } = await (supabase as unknown as Untyped).rpc('my_tickets_v1');
    if (error) return error.code === '42501' ? { kind: 'signed_out' } : { kind: 'error' };
    const reply = parseMyTickets(data);
    return reply ? { kind: 'ok', reply } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

export type OrderQrResult =
  | { kind: 'ok'; tickets: OrderQrTicket[] }
  | { kind: 'signed_out' }
  | { kind: 'error' };

/** my_ticket_order_qr_v1(p_order_id): the buyer's door codes for one just-paid order. Never logs the reply or error body. */
export async function fetchOrderQr(orderId: string): Promise<OrderQrResult> {
  try {
    const { data, error } = await (supabase as unknown as Untyped).rpc('my_ticket_order_qr_v1', { p_order_id: orderId });
    if (error) return error.code === '42501' ? { kind: 'signed_out' } : { kind: 'error' };
    const tickets = parseOrderQr(data);
    return tickets ? { kind: 'ok', tickets } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}
