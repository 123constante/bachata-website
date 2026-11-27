import { instantToUntil } from './EarlyBirds';
import { savedLine, writeTicket } from './TicketSheetV2';
import { setTicketStatus } from '../../tickets/ticketsApi';
import { parsePayment, toSend, type PaymentMethod } from '../../events/paymentModel';
import type { EventWorkspace } from '../../events/eventModel';
import type { GuideResult } from './WaysInGuide';
import { V2 } from './copy';

/** The three codes the guide owns; every other stored code (cash, bank_transfer) is kept as it is. */
export const GUIDE_CODES: readonly PaymentMethod[] = ['door', 'ticket_link', 'free'];

type Change = (o: { part: string; label: string; payload?: Record<string, unknown>; before?: Record<string, unknown> }) => Promise<boolean>;

export interface GuideSaveDeps {
  ws: EventWorkspace;
  organiserId: string | undefined;
  /** tickets that exist now: the guide only ever creates the FIRST one */
  ticketCount: number;
  change: Change;
  say: (text: string) => void;
  refresh: () => void;
}

export type GuideSaveOut = { ok: true } | { ok: false; error: string };

/** True when the guide's answers differ from the stored door / link / free codes. */
export const methodsChanged = (ws: EventWorkspace, methods: readonly PaymentMethod[]): boolean => {
  const now = parsePayment(ws.series.payment_methods).filter((m) => GUIDE_CODES.includes(m));
  return now.length !== methods.length || methods.some((m) => !now.includes(m));
};

/**
 * The guide's one save sequence (Ways in rebuild W3): (1) payment_methods through the screen's `change` (with Undo),
 * (2) the first ticket through `writeTicket` (base price + count), (3) a date early bird through the same call (its birds path).
 * Only what changed is written. A failing step stops the sequence and returns its error line; what was written stays.
 */
export function useWaysInGuideSave(d: GuideSaveDeps) {
  return async (r: GuideResult): Promise<GuideSaveOut> => {
    const old = d.ws.series.payment_methods ?? null;
    if (methodsChanged(d.ws, r.methods)) {
      const keep = parsePayment(old).filter((m) => !GUIDE_CODES.includes(m));
      const ok = await d.change({ part: V2.ticketsPay.savedOne, label: V2.ticketsPay.savedOne, payload: { payment_methods: toSend(d.ws, [...keep, ...r.methods]) }, before: { payment_methods: old } });
      if (!ok) return { ok: false, error: V2.ticketsPay.notSaved };
    }
    if (r.ticket && d.ticketCount === 0 && d.organiserId) {
      const form = {
        name: '', free: false, price: (r.ticket.pence / 100).toFixed(2), qty: r.ticket.qty,
        birds: r.early ? [{ price: (r.early.pence / 100).toFixed(2), until: instantToUntil(r.early.until) }] : [],
      };
      const out = await writeTicket({ organiserId: d.organiserId, seriesId: d.ws.series.id, seriesLive: d.ws.series.lifecycle_status === 'live', type: null, basePence: 0, steps: [], form })
        .catch((): { ok: false; error: string; createdId?: string } => ({ ok: false, error: V2.ticketSheet.notSaved }));
      if ('error' in out) {
        // a half-made ticket would sell at the wrong price: close it, as the ticket sheet does
        if (out.createdId) { try { await setTicketStatus(out.createdId, 'closed'); } catch { /* the refresh shows the truth */ } }
        d.refresh();
        return { ok: false, error: out.error };
      }
      d.refresh();
      d.say(savedLine(out));
    }
    return { ok: true };
  };
}
