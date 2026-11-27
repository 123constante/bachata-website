import { useRef, useState } from 'react';
import { fetchManagedTypes, removePriceStep, setEarlyBird, setPriceStep, setTicketStatus, upsertTicketType, type WriteResult } from '../../tickets/ticketsApi';
import { formatPence, isoToLondonInput, penceOf, reasonMessage, type TicketType } from '../../tickets/ticketModel';
import {
  EARLY_COUNT_LABEL, EARLY_PRICE_LABEL, earlyCommand, earlyFormOf, earlyInvalid, earlyNote, earlyReasonMessage, stepReasonMessage,
  type EarlyForm, type ManagedType, type PriceStep,
} from '../../tickets/priceSteps';
import { flags } from '@/lib/featureFlags';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';
import { EarlyBirds, formOfStored, wantedOf, type Bird } from './EarlyBirds';

const T = V2.ticketSheet;

export interface TicketForm { name: string; free: boolean; price: string; qty: number; birds: Bird[] }

type Out = { ok: true; id: string | null; changed: boolean } | { ok: false; error: string; wrote?: boolean; createdId?: string };
type Existing = Pick<TicketType, 'id' | 'name' | 'capacity' | 'occurrenceId' | 'salesOpenAt' | 'salesCloseAt' | 'pricePence'>;

/** A step starting this soon counts as the current price (a sold price change goes in 60 s ahead). */
export const SOLD_STEP_WINDOW_MS = 120_000;
const sameAt = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();
/** The price that counts now: the base, or the latest step that has already started (isLive). */
export const priceNow = (base: number, steps: readonly Pick<PriceStep, 'effectiveFrom' | 'pricePence' | 'isLive'>[]): number => {
  let at = -Infinity;
  let price = base;
  for (const s of steps) {
    const t = new Date(s.effectiveFrom).getTime();
    if (s.isLive && t >= at) { at = t; price = s.pricePence; }
  }
  return price;
};
const refusal = (r: WriteResult, steps = false) => (steps ? stepReasonMessage(r.reason) : reasonMessage(r.reason));

/**
 * Save one ticket the way the old editor does: ticket_type_upsert_v1 for name / base price / places, then the
 * price steps (ticket_price_step_set_v1 / _remove_v1) so the sheet's early birds become base + steps.
 * Steps that went away are removed first; a step already live is never moved or removed (refused before any write).
 * An untouched ticket sends nothing.
 */
export async function writeTicket(a: { organiserId: string; seriesId: string; type: Existing | null; basePence: number; steps: readonly PriceStep[]; form: TicketForm; sold?: number; force?: boolean }): Promise<Out> {
  const w = wantedOf(a.form.free, a.form.price, a.form.birds);
  if ('error' in w) return { ok: false, error: w.error };
  const name = a.form.name.trim() || 'Ticket';
  let wrote = false;
  // a sold type keeps its started steps as history: the form shows the price counting now plus the coming steps only (formOfType)
  const soldType = !!a.type && (a.sold ?? 0) > 0;
  const nowPence = soldType ? priceNow(a.basePence, a.steps) : a.basePence;
  const cur = soldType ? a.steps.filter((s) => !s.isLive) : [...a.steps];
  const keep = Math.min(cur.length, w.steps.length);
  // a stored step at another time of day is the same step while its London day is unchanged: keep its instant
  const sameDay = (a: string, b: string) => isoToLondonInput(a).slice(0, 10) === isoToLondonInput(b).slice(0, 10);
  const moves = w.steps
    .map((s, i) => {
      const was = cur[i] as PriceStep | undefined;
      return { s: was && sameDay(was.effectiveFrom, s.at) ? { ...s, at: was.effectiveFrom } : s, was };
    })
    .filter((m) => !m.was || !sameAt(m.was.effectiveFrom, m.s.at) || m.was.pricePence !== m.s.pence);
  const gone = cur.slice(keep);
  if (moves.some((m) => m.was?.isLive) || gone.some((g) => g.isLive)) return { ok: false, error: T.birdLive };
  // a sold type refuses a base price change in the upsert: its new price goes in as a step that counts from now on
  // compare with the price that counts NOW (base, or the latest step already started), not the stored base
  const soldPrice = soldType && w.basePence !== nowPence;
  const baseSame = !a.force && !!a.type && (soldPrice || nowPence === w.basePence) && a.type.name === name && a.type.capacity === a.form.qty;
  if (!a.force && a.type && baseSame && !soldPrice && !moves.length && !gone.length) return { ok: true, id: a.type.id, changed: false };
  for (const g of [...gone].reverse()) {
    const r = await removePriceStep(g.id);
    if (!r.ok) return { ok: false, error: refusal(r, true), wrote };
    wrote = true;
  }
  let id = a.type?.id ?? null;
  if (!a.type || !baseSame) {
    const r = await upsertTicketType({
      id, organiserId: a.organiserId, seriesId: a.seriesId, occurrenceId: a.type?.occurrenceId ?? null, name, pricePence: soldType && a.type ? a.type.pricePence : w.basePence, capacity: a.form.qty,
      salesOpenAt: a.type?.salesOpenAt ?? null, salesCloseAt: a.type?.salesCloseAt ?? null,
    });
    if (!r.ok) return { ok: false, error: refusal(r), wrote };
    wrote = true;
    id = id ?? r.id ?? null;
  }
  if (!id) return { ok: false, error: T.notSaved, wrote };
  const createdId = a.type ? undefined : id;
  if (soldPrice) {
    // a sold-price step still about to start (within 2 minutes) is replaced, not piled onto
    const soon = Date.now() + SOLD_STEP_WINDOW_MS;
    const prior = [...cur].reverse().find((s) => !s.isLive);
    const replace = prior && Date.parse(prior.effectiveFrom) <= soon ? prior : undefined;
    const r = await setPriceStep({ p_ticket_type_id: id, p_step_id: replace?.id ?? null, p_effective_from: new Date(Date.now() + 60_000).toISOString(), p_price_pence: w.basePence });
    if (!r.ok) return { ok: false, error: refusal(r, true), wrote, createdId };
    wrote = true;
  }
  for (const m of moves) {
    const r = await setPriceStep({ p_ticket_type_id: id, p_step_id: m.was?.id ?? null, p_effective_from: m.s.at, p_price_pence: m.s.pence });
    if (!r.ok) return { ok: false, error: refusal(r, true), wrote, createdId };
    wrote = true;
  }
  if (!a.type) {
    const st = await setTicketStatus(id, 'on_sale');
    if (!st.ok) return { ok: false, error: refusal(st), wrote, createdId };
  }
  return { ok: true, id, changed: true };
}

/** A sold type shows the price counting now and only the steps still to come (a started step is history, see writeTicket). */
export const formOfType = (t: Pick<TicketType, 'name' | 'pricePence' | 'capacity'>, steps: readonly PriceStep[], base = t.pricePence, sold = false): TicketForm => {
  const s = sold ? steps.filter((x) => !x.isLive) : steps;
  const b = sold ? priceNow(base, steps) : base;
  return { name: t.name, free: b === 0 && !s.length, qty: t.capacity, ...formOfStored(b, s) };
};

export const EARLY_OFF_FIRST = 'A free ticket cannot have an early bird price. Turn Free off, turn Cheaper first tickets off, then save.';

export interface TicketSheetProps {
  organiserId: string;
  seriesId: string;
  /** null = a new ticket */
  type: (Existing & Pick<TicketType, 'pricePence' | 'status'>) | null;
  basePence: number;
  steps: readonly PriceStep[];
  /** the managed row (early tier fields); read only behind flag ticketEarlyBird */
  managed?: ManagedType;
  oneOff: boolean;
  /** tickets sold (busiest-night count) and across all dates, with the pence taken */
  soldMax: number;
  soldAll: number;
  /** false while the sales summary is loading or failed: sold-count guards then refuse (never read as 0) */
  soldKnown?: boolean;
  pence: number;
  onClose: () => void;
  /** a write landed (or the ticket was removed): the screen refreshes and shows the toast */
  onDone: (text: string, undo?: () => Promise<void>) => void;
  onFail: (text: string) => void;
}

/** SH-TICKET: add or change one ticket. Done saves, Remove closes the ticket; both toast with Undo. */
export function TicketSheetV2(p: TicketSheetProps) {
  const isNew = !p.type;
  const first = p.type ? formOfType(p.type, p.steps, p.basePence, p.soldAll > 0) : { name: '', free: false, price: '', qty: 50, birds: [] as Bird[] };
  const [name, setName] = useState(first.name);
  const [free, setFree] = useState(first.free);
  const [price, setPrice] = useState(first.price);
  const [qty, setQty] = useState(String(first.qty));
  const [birds, setBirds] = useState<Bird[]>(first.birds);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Early bird count tier (flag ticketEarlyBird): not with date early birds, not on a free ticket.
  const [early, setEarlyForm] = useState<EarlyForm>(() => earlyFormOf(p.managed));
  const earlyShown = flags.ticketEarlyBird && !free && birds.length === 0;
  const earlyOn = earlyShown && early.on;
  const setEarly = (x: Partial<EarlyForm>) => { setErr(''); setEarlyForm({ ...early, ...x }); };
  /** a new ticket whose early write was refused: the ticket exists, a retry must not make a second one */
  const savedId = useRef<string | null>(null);
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
    const r = await writeTicket({ organiserId: p.organiserId, seriesId: p.seriesId, type, basePence: row?.basePricePence ?? 0, steps: row?.steps ?? [], form: back, sold, force: true });
    if ('error' in r) throw new Error(r.error);
  };

  const done = () => run(async () => {
    const f = current();
    if (!isNew && p.soldKnown === false) { setErr(T.notSaved); return; }
    if (!Number.isFinite(f.qty) || f.qty < 0) { setErr(T.qtyBad); return; }
    if (f.qty < p.soldMax) { setErr(T.qtyLow(p.soldMax)); return; }
    const back = p.type ? formOfType(p.type, p.steps, p.basePence, sold > 0) : null;
    const earlyBad = earlyShown ? earlyInvalid(early) : null;
    if (earlyBad) { setErr(earlyReasonMessage(earlyBad)); return; }
    // A saved early tier cannot ride on a free ticket (the early price would still be charged): refuse before any write.
    if (flags.ticketEarlyBird && f.free && p.managed?.earlyPricePence != null) { setErr(EARLY_OFF_FIRST); return; }
    const out: Out = savedId.current
      ? { ok: true, id: savedId.current, changed: false }
      : await writeTicket({ organiserId: p.organiserId, seriesId: p.seriesId, type: p.type, basePence: p.basePence, steps: p.steps, form: f, sold })
        .catch((): Out => ({ ok: false, error: T.notSaved, wrote: true }));
    if ('error' in out) {
      // a write may have landed before the failure: put the old ticket back, best effort
      if (p.type && back && out.wrote === true) { try { await restore(back, p.type); } catch { /* the refresh shows the truth */ } }
      // a new ticket whose later step failed: close the half-made row so a retry cannot make a second one
      if (!p.type && out.createdId) { try { await setTicketStatus(out.createdId, 'closed'); } catch { /* the refresh shows the truth */ } }
      setErr(out.error); p.onFail(out.error);
      return;
    }
    const type = p.type;
    const id = out.id;
    const row = earlyShown && id ? (p.managed && p.managed.id === id ? p.managed : ({ id, earlyPricePence: null, earlyCapacity: null } as unknown as ManagedType)) : undefined;
    const cmd = row ? earlyCommand(early, row) : null;
    if (cmd) {
      let refusal: string | null = null;
      try { const e = await setEarlyBird(cmd); if (!e.ok) refusal = earlyReasonMessage(e.reason); } catch { refusal = earlyReasonMessage(null); }
      if (refusal) {
        if (!type) savedId.current = id;
        setErr(refusal); p.onFail(refusal);
        return;
      }
    }
    if (!out.changed && !cmd) { p.onClose(); return; }
    p.onClose();
    p.onDone(T.saved, cmd && type ? undefined : type && back ? () => restore(back, type) : id ? async () => { const r = await setTicketStatus(id, 'closed'); if (!r.ok) throw new Error('undo'); } : undefined);
  });

  const remove = () => run(async () => {
    const t = p.type;
    if (!t || sold > 0 || p.soldKnown === false) return;
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
            {flags.waysInV2 && sold > 0 ? <p className="hint" data-testid="t-price-from-now">{T.priceFromNow}</p> : null}
            {earlyShown ? (
              <>
                <button type="button" className="swrow" data-testid="t-early" role="switch" aria-checked={early.on} disabled={busy} onClick={() => setEarly({ on: !early.on })}>
                  <span>Cheaper first tickets</span><span className={`sw${early.on ? ' on' : ''}`} />
                </button>
                {early.on ? (
                  <>
                    <label className="flab" htmlFor="t-early-price">{EARLY_PRICE_LABEL}</label>
                    <input id="t-early-price" data-testid="t-early-price" className="fld" type="text" inputMode="decimal" placeholder="0.00" value={early.price} onChange={(e) => setEarly({ price: e.target.value })} />
                    <label className="flab" htmlFor="t-early-count">{EARLY_COUNT_LABEL}</label>
                    <input id="t-early-count" data-testid="t-early-count" className="fld" type="text" inputMode="numeric" value={early.count} onChange={(e) => setEarly({ count: e.target.value })} />
                    <p className="hint" data-testid="t-early-note">{earlyNote(early.count, penceOf(price))}</p>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
        <label className="flab" htmlFor="t-qty">{T.qtyLabel}</label>
        <input id="t-qty" data-testid="t-qty" className="fld" type="number" min="0" step="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        {p.soldMax ? <p className="hint" data-testid="t-busiest">{T.soldBusiest(p.soldMax)}</p> : null}
        {err ? <p className="err" role="alert" data-testid="t-err">{err}</p> : null}
        {free || earlyOn ? null : <EarlyBirds price={price} birds={birds} oneOff={p.oneOff} disabled={busy} onChange={setBirds} />}
        {isNew ? null : <p className="txt" data-testid="t-sold">{T.soldLine(sold, formatPence(p.pence))}</p>}
        <button type="button" className="btn pri" data-testid="t-done" disabled={busy} aria-busy={busy} onClick={() => { void done(); }}>{T.done}</button>
        {isNew ? null : (
          <>
            <button type="button" className="btn dan" data-testid="t-remove" disabled={busy || sold > 0 || p.soldKnown === false} aria-busy={busy} onClick={() => { void remove(); }}>{T.remove}</button>
            {sold > 0 ? <p className="hint" data-testid="t-remove-hint">{T.removeSold}</p> : null}
          </>
        )}
      </div>
    </V2Sheet>
  );
}
