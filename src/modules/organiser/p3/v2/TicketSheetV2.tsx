import { useRef, useState } from 'react';
import { fetchManagedTypes, removePriceStep, setPriceStep, setTicketStatus, upsertTicketType, type WriteResult } from '../../tickets/ticketsApi';
import { formatPence, reasonMessage, type TicketType } from '../../tickets/ticketModel';
import { stepReasonMessage, type PriceStep } from '../../tickets/priceSteps';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';
import { EarlyBirds, formOfStored, wantedOf, type Bird } from './EarlyBirds';

const T = V2.ticketSheet;

export interface TicketForm { name: string; free: boolean; price: string; qty: number; birds: Bird[] }

type Out = { ok: true; id: string | null; changed: boolean } | { ok: false; error: string; wrote?: boolean };
type Existing = Pick<TicketType, 'id' | 'name' | 'capacity' | 'occurrenceId' | 'salesOpenAt' | 'salesCloseAt'>;

const sameAt = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();
const refusal = (r: WriteResult, steps = false) => (steps ? stepReasonMessage(r.reason) : reasonMessage(r.reason));

/**
 * Save one ticket the way the old editor does: ticket_type_upsert_v1 for name / base price / places, then the
 * price steps (ticket_price_step_set_v1 / _remove_v1) so the sheet's early birds become base + steps.
 * Steps that went away are removed first; a step already live is never moved or removed (refused before any write).
 * An untouched ticket sends nothing.
 */
export async function writeTicket(a: { organiserId: string; seriesId: string; type: Existing | null; basePence: number; steps: readonly PriceStep[]; form: TicketForm }): Promise<Out> {
  const w = wantedOf(a.form.free, a.form.price, a.form.birds);
  if ('error' in w) return { ok: false, error: w.error };
  const name = a.form.name.trim() || 'Ticket';
  let wrote = false;
  const cur = [...a.steps];
  const keep = Math.min(cur.length, w.steps.length);
  const moves = w.steps.map((s, i) => ({ s, was: cur[i] as PriceStep | undefined })).filter((m) => !m.was || !sameAt(m.was.effectiveFrom, m.s.at) || m.was.pricePence !== m.s.pence);
  const gone = cur.slice(keep);
  if (moves.some((m) => m.was?.isLive) || gone.some((g) => g.isLive)) return { ok: false, error: T.birdLive };
  const baseSame = !!a.type && a.basePence === w.basePence && a.type.name === name && a.type.capacity === a.form.qty;
  if (a.type && baseSame && !moves.length && !gone.length) return { ok: true, id: a.type.id, changed: false };
  for (const g of [...gone].reverse()) {
    const r = await removePriceStep(g.id);
    if (!r.ok) return { ok: false, error: refusal(r, true), wrote };
    wrote = true;
  }
  let id = a.type?.id ?? null;
  if (!a.type || !baseSame) {
    const r = await upsertTicketType({
      id, organiserId: a.organiserId, seriesId: a.seriesId, occurrenceId: a.type?.occurrenceId ?? null, name, pricePence: w.basePence, capacity: a.form.qty,
      salesOpenAt: a.type?.salesOpenAt ?? null, salesCloseAt: a.type?.salesCloseAt ?? null,
    });
    if (!r.ok) return { ok: false, error: refusal(r), wrote };
    wrote = true;
    id = id ?? r.id ?? null;
  }
  if (!id) return { ok: false, error: T.notSaved, wrote };
  for (const m of moves) {
    const r = await setPriceStep({ p_ticket_type_id: id, p_step_id: m.was?.id ?? null, p_effective_from: m.s.at, p_price_pence: m.s.pence });
    if (!r.ok) return { ok: false, error: refusal(r, true), wrote };
    wrote = true;
  }
  if (!a.type) {
    const st = await setTicketStatus(id, 'on_sale');
    if (!st.ok) return { ok: false, error: refusal(st), wrote };
  }
  return { ok: true, id, changed: true };
}

export const formOfType = (t: Pick<TicketType, 'name' | 'pricePence' | 'capacity'>, steps: readonly PriceStep[], base = t.pricePence): TicketForm =>
  ({ name: t.name, free: base === 0 && !steps.length, qty: t.capacity, ...formOfStored(base, steps) });

export interface TicketSheetProps {
  organiserId: string;
  seriesId: string;
  /** null = a new ticket */
  type: (Existing & Pick<TicketType, 'pricePence' | 'status'>) | null;
  basePence: number;
  steps: readonly PriceStep[];
  oneOff: boolean;
  /** tickets sold (busiest-night count) and across all dates, with the pence taken */
  soldMax: number;
  soldAll: number;
  pence: number;
  onClose: () => void;
  /** a write landed (or the ticket was removed): the screen refreshes and shows the toast */
  onDone: (text: string, undo?: () => Promise<void>) => void;
  onFail: (text: string) => void;
}

/** SH-TICKET: add or change one ticket. Done saves, Remove closes the ticket; both toast with Undo. */
export function TicketSheetV2(p: TicketSheetProps) {
  const isNew = !p.type;
  const first = p.type ? formOfType(p.type, p.steps, p.basePence) : { name: '', free: false, price: '', qty: 50, birds: [] as Bird[] };
  const [name, setName] = useState(first.name);
  const [free, setFree] = useState(first.free);
  const [price, setPrice] = useState(first.price);
  const [qty, setQty] = useState(String(first.qty));
  const [birds, setBirds] = useState<Bird[]>(first.birds);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const sold = p.soldAll;
  const current = (): TicketForm => ({ name, free, price, qty: Math.round(Number(qty)), birds });

  const run = async (job: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setErr('');
    try { await job(); } finally { inFlight.current = false; setBusy(false); }
  };

  const restore = async (back: TicketForm, type: Existing) => {
    const fresh = await fetchManagedTypes(p.seriesId);
    const row = fresh.types.find((m) => m.id === type.id);
    const r = await writeTicket({ organiserId: p.organiserId, seriesId: p.seriesId, type, basePence: row?.basePricePence ?? 0, steps: row?.steps ?? [], form: back });
    if ('error' in r) throw new Error(r.error);
  };

  const done = () => run(async () => {
    const f = current();
    if (!Number.isFinite(f.qty) || f.qty < 0) { setErr(T.qtyBad); return; }
    if (f.qty < p.soldMax) { setErr(T.qtyLow(p.soldMax)); return; }
    const back = p.type ? formOfType(p.type, p.steps, p.basePence) : null;
    const out: Out = await writeTicket({ organiserId: p.organiserId, seriesId: p.seriesId, type: p.type, basePence: p.basePence, steps: p.steps, form: f })
      .catch((): Out => ({ ok: false, error: T.notSaved, wrote: true }));
    if ('error' in out) {
      // a write may have landed before the failure: put the old ticket back, best effort
      if (p.type && back && out.wrote === true) { try { await restore(back, p.type); } catch { /* the refresh shows the truth */ } }
      setErr(out.error); p.onFail(out.error);
      return;
    }
    if (!out.changed) { p.onClose(); return; }
    const type = p.type;
    const id = out.id;
    p.onClose();
    p.onDone(T.saved, type && back ? () => restore(back, type) : id ? async () => { const r = await setTicketStatus(id, 'closed'); if (!r.ok) throw new Error('undo'); } : undefined);
  });

  const remove = () => run(async () => {
    const t = p.type;
    if (!t || sold > 0) return;
    let r: WriteResult;
    try { r = await setTicketStatus(t.id, 'closed'); } catch { r = { ok: false, reason: null }; }
    if (!r.ok) { setErr(reasonMessage(r.reason)); p.onFail(reasonMessage(r.reason)); return; }
    p.onClose();
    p.onDone(T.removed, async () => { const u = await setTicketStatus(t.id, t.status); if (!u.ok) throw new Error('undo'); });
  });

  return (
    <V2Sheet open title={isNew ? T.titleNew : T.title} onClose={p.onClose}>
      <div className="grp" data-testid="ticket-sheet">
        <label className="flab" htmlFor="t-name">{T.nameLabel}</label>
        <input id="t-name" data-testid="t-name" className="fld" type="text" placeholder={T.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="swrow" data-testid="t-free" role="switch" aria-checked={free} onClick={() => setFree(!free)}>
          <span>{T.free}</span><span className={`sw${free ? ' on' : ''}`} />
        </button>
        {free ? <p className="hint" data-testid="t-free-hint">{T.freeHint}</p> : (
          <>
            <label className="flab" htmlFor="t-price">{birds.length ? T.priceAfterBird : T.priceLabel}</label>
            <input id="t-price" data-testid="t-price" className="fld" type="number" min="0" step="0.5" inputMode="decimal" placeholder={T.pricePlaceholder} value={price} onChange={(e) => setPrice(e.target.value)} />
          </>
        )}
        <label className="flab" htmlFor="t-qty">{T.qtyLabel}</label>
        <input id="t-qty" data-testid="t-qty" className="fld" type="number" min="0" step="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        {p.soldMax ? <p className="hint" data-testid="t-busiest">{T.soldBusiest(p.soldMax)}</p> : null}
        {err ? <p className="err" role="alert" data-testid="t-err">{err}</p> : null}
        {free ? null : <EarlyBirds price={price} birds={birds} oneOff={p.oneOff} disabled={busy} onChange={setBirds} />}
        {isNew ? null : <p className="txt" data-testid="t-sold">{T.soldLine(sold, formatPence(p.pence))}</p>}
        <button type="button" className="btn pri" data-testid="t-done" disabled={busy} aria-busy={busy} onClick={() => { void done(); }}>{T.done}</button>
        {isNew ? null : (
          <>
            <button type="button" className="btn dan" data-testid="t-remove" disabled={busy || sold > 0} aria-busy={busy} onClick={() => { void remove(); }}>{T.remove}</button>
            {sold > 0 ? <p className="hint" data-testid="t-remove-hint">{T.removeSold}</p> : null}
          </>
        )}
      </div>
    </V2Sheet>
  );
}
