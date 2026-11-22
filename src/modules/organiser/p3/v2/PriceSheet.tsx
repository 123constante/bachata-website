import { useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNightPrices, setNightPrice, ticketKeys } from '../../tickets/ticketsApi';
import { V2Toast } from './V2Toast';
import { UNDONE_TEXT, UNDO_FAILED_TEXT } from './saveNow';
import { ownerPassesFromStored, PRICE_RE } from '../../shared/seriesCommands';
import type { EventWorkspace } from '../../events/eventModel';
import type { DateDetail, WorkspaceDate } from '../../shared/seriesModel';
import { useSeriesTypes, useStripe } from '../tickets/data';
import type { StripeState } from '../../tickets/ticketModel';
import type { OnSave } from './WhenSheet';
import type { WriteStep } from './editorModel';
import { payModeOf, doorPriceOf } from './payMode';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';

const P = V2.priceSheet;

export type PriceState = 'door' | 'link' | 'noStripe' | 'noTickets' | 'tickets' | 'loading';

/**
 * `pence` is what the field shows (night price, else usual). `canChange` is true only when the per-night read said so;
 * a ticket that is not changeable is read-only (loading, failed read, manager, night gone). `nightPence` null = no override.
 */
export interface PriceTicket { id: string; name: string; pence: number; nightPence?: number | null; canChange?: boolean }

export interface TicketChange { id: string; pence: number }
type Outcome = { ok: boolean; error: string | null };

// The toast has to outlive the sheet (NightCard unmounts it on close), so it lives in its own root on the body.
let toastRoot: Root | null = null;
let toastSeq = 0;
const toastDone = (n: number) => { if (n === toastSeq) toastRoot?.render(<V2Toast toast={null} onDone={toastDone} />); };
function showToast(text: string, onUndo?: () => void) {
  if (typeof document === 'undefined') return;
  if (!toastRoot) { const el = document.createElement('div'); document.body.appendChild(el); toastRoot = createRoot(el); }
  toastSeq += 1;
  toastRoot.render(<V2Toast toast={{ seq: toastSeq, text, onUndo }} onDone={toastDone} />);
}
/** Tests: drop the toast between cases. */
export function clearNightPriceToast() { toastSeq += 1; toastRoot?.render(<V2Toast toast={null} onDone={toastDone} />); }

/** Server refusal word to the one plain line. */
export const nightPriceLine = (reason: string | null): string =>
  reason === 'night_past' || reason === 'night_cancelled' ? P.gone : reason === 'not_owner_or_admin' ? P.locked : P.notSaved;

export interface PriceSheetProps {
  state: PriceState;
  /** weekly: the bold long date + the "this night only" line */
  weekly: boolean;
  /** "Thursday 26 November" */
  long: string;
  /** weekday name for the weekly links ("Thursday") */
  day: string;
  /** the price now (door mode): the night's own, else the usual */
  doorPrice: number | null;
  link: string | null;
  tickets: PriceTicket[];
  /** tickets state: the per-night read answered ok (until then the fields are read-only and Done only closes) */
  ticketsKnown?: boolean;
  /** tickets state: Done with changed fields. Resolves with the result; never called for an empty or unchanged field. */
  onSaveTickets?: (changes: TicketChange[]) => Promise<Outcome>;
  /** tickets state: remove every ticket's night price */
  onBackTickets?: () => Promise<Outcome>;
  /** the night owns a price: shows "Back to the usual price(s)" */
  changed: boolean;
  /** door Done: the new price; resolves with the save result. Never called for an empty or unchanged field. */
  onSaveDoor: (price: number) => Promise<{ ok: boolean; error: string | null }>;
  onBack: () => void | Promise<unknown>;
  /** sheet closes, tab "Every <day>", Tickets screen (tap 55) */
  onGoTickets: () => void;
  /** one-off, link mode: the Link to buy tickets sheet (tap 56) */
  onLink: () => void;
  onClose: () => void;
}

/** SH-PRICE: the price of this one night, in the prototype's five states. */
export function PriceSheet(p: PriceSheetProps) {
  const [door, setDoor] = useState(p.doorPrice != null ? String(p.doorPrice) : '');
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const only = p.weekly ? (
    <>
      <p className="txt" data-testid="price-date"><b>{p.long}</b></p>
      <p className="txt">{P.onlyThisNight}</p>
    </>
  ) : null;
  const usual = (
    <button type="button" className="lnk" data-testid="price-usual-link" onClick={p.onGoTickets}>{p.weekly ? P.changeUsual : P.allSettings}</button>
  );
  const goBackNow = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setProblem(null);
    try {
      const r = (p.state === 'tickets' && p.onBackTickets ? await p.onBackTickets() : await p.onBack()) as { ok?: boolean; error?: string | null } | undefined;
      if (r && r.ok === false) setProblem(r.error ?? P.notSaved); else p.onClose();
    } catch { setProblem(P.notSaved); } finally { inFlight.current = false; setBusy(false); }
  };
  const hasNightPrice = p.state === 'tickets' && !!p.ticketsKnown && p.tickets.some((t) => t.nightPence != null);
  const goBack = (label: string) => (p.changed || hasNightPrice ? (
    <button type="button" className="btn sec" data-testid="price-back" disabled={busy} onClick={() => { void goBackNow(); }}>{label}</button>
  ) : null);

  const doneDoor = async () => {
    const text = door.trim();
    if (text === '') { p.onClose(); return; }
    if (!PRICE_RE.test(text)) { setProblem(P.bad); return; }
    const nv = Number(text);
    if (p.doorPrice != null && nv === p.doorPrice) { p.onClose(); return; }
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setProblem(null);
    try {
      const r = await p.onSaveDoor(nv);
      if (r.ok) p.onClose(); else setProblem(r.error ?? P.notSaved);
    } catch {
      setProblem(P.notSaved);
    } finally { inFlight.current = false; setBusy(false); }
  };

  const doneTickets = async () => {
    if (!p.ticketsKnown || !p.onSaveTickets) { p.onClose(); return; }
    const changes: TicketChange[] = [];
    for (const t of p.tickets) {
      if (t.pence <= 0 || !t.canChange) continue;
      const text = (raw[t.id] ?? '').trim();
      if (text === '') continue;
      if (!PRICE_RE.test(text)) { setProblem(P.bad); return; }
      const pence = Math.round(Number(text) * 100);
      if (pence < 1 || pence > 1000000) { setProblem(P.bad); return; }
      if (pence !== t.pence) changes.push({ id: t.id, pence });
    }
    if (!changes.length) { p.onClose(); return; }
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setProblem(null);
    try {
      const r = await p.onSaveTickets(changes);
      if (r.ok) p.onClose(); else setProblem(r.error ?? P.notSaved);
    } catch { setProblem(P.notSaved); } finally { inFlight.current = false; setBusy(false); }
  };

  let body;
  if (p.state === 'loading') {
    body = <p className="txt" data-testid="price-loading">{P.loading}</p>;
  } else if (p.state === 'door') {
    body = (
      <>
        {only}
        <label className="flab" htmlFor="p-door">{P.doorField}</label>
        <input id="p-door" className="fld" type="number" min="0" step="0.5" inputMode="decimal" value={door} onChange={(e) => { setDoor(e.target.value); setProblem(null); }} />
        {problem ? <p className="err" role="alert" data-testid="price-err">{problem}</p> : null}
        <button type="button" className="btn pri" data-testid="price-done" disabled={busy} aria-busy={busy} onClick={() => { void doneDoor(); }}>{V2.done}</button>
        {goBack(P.backDoor)}
        {usual}
      </>
    );
  } else if (p.state === 'link') {
    body = (
      <>
        <p className="txt" data-testid="price-link-text">{P.buyAt(p.link || P.yourLink)}</p>
        {p.weekly ? (
          <button type="button" className="lnk" data-testid="price-usual-link" onClick={p.onGoTickets}>{P.changeEvery(p.day)}</button>
        ) : (
          <>
            <button type="button" className="btn sec" data-testid="price-change-link" onClick={p.onLink}>{P.changeLink}</button>
            <button type="button" className="lnk" data-testid="price-usual-link" onClick={p.onGoTickets}>{P.allSettings}</button>
          </>
        )}
      </>
    );
  } else if (p.state === 'noStripe') {
    body = (
      <>
        <p className="txt" data-testid="price-nostripe">{P.cantBuy}</p>
        <button type="button" className="btn pri" data-testid="price-setup" onClick={p.onGoTickets}>{P.setUp}</button>
      </>
    );
  } else if (p.state === 'noTickets') {
    body = (
      <>
        <p className="txt" data-testid="price-notickets">{P.noTickets}</p>
        <button type="button" className="btn pri" data-testid="price-add" onClick={p.onGoTickets}>{P.addFirst}</button>
      </>
    );
  } else {
    body = (
      <>
        {only}
        {p.tickets.map((t) => (t.pence <= 0
          ? <p key={t.id} className="txt" data-testid={`price-free-${t.id}`}><b>{t.name}</b>: {P.free}</p>
          : (
            <div key={t.id}>
              <label className="flab" htmlFor={`p-${t.id}`}>{P.ticketField(t.name)}</label>
              <input id={`p-${t.id}`} className="fld" type="number" min="0" step="0.5" inputMode="decimal" readOnly={!t.canChange} aria-readonly={!t.canChange}
                value={raw[t.id] ?? String(t.pence / 100)} onChange={(e) => { setRaw({ ...raw, [t.id]: e.target.value }); setProblem(null); }} />
            </div>
          )))}
        {problem ? <p className="err" role="alert" data-testid="price-err">{problem}</p> : null}
        <button type="button" className="btn pri" data-testid="price-done" disabled={busy} aria-busy={busy} onClick={() => { void doneTickets(); }}>{V2.done}</button>
        {goBack(P.backTickets)}
        {usual}
      </>
    );
  }
  return (
    <V2Sheet open title={V2.price} onClose={p.onClose}>
      <div className="grp" data-testid="price-sheet" data-state={p.state}>{body}</div>
    </V2Sheet>
  );
}

/**
 * Reads the pay mode, Stripe and ticket list for this night, then shows the sheet. Mounted only while the sheet is
 * open, so the Night card itself makes no ticket reads. Door Done writes the one-night `passes` override.
 */
export function NightPriceSheet({ ws, date, detail, weekly, long, day, dateWords, oneOff, changed, onSave, onBack, onGoTickets, onLink, onClose }: {
  ws: EventWorkspace; date: WorkspaceDate; detail: DateDetail | undefined; weekly: boolean; long: string; day: string;
  dateWords: string; oneOff: boolean; changed: boolean; onSave: OnSave;
  onBack: () => void | Promise<unknown>; onGoTickets: () => void; onLink: () => void; onClose: () => void;
}) {
  const s = ws.series;
  const orgId = ws.organiserIds?.[0];
  const stripe = useStripe(orgId);
  const types = useSeriesTypes(orgId, s.id, false);
  const link = (detail?.ticketUrl ?? s.default_ticket_url ?? '').trim() || null;
  const list = types.data;
  const connected = (stripe.state as StripeState | null) === 'connected';
  const mode = list ? payModeOf({ ticketTypes: list, defaultTicketUrl: link, stripeConnected: connected }) : null;
  const here = (list ?? []).filter((t) => t.status === 'on_sale' && (!t.occurrenceId || t.occurrenceId === date.id));
  const passes = detail?.passesOverride ?? s.passes;
  let state: PriceState = 'loading';
  if (mode === 'door') state = 'door';
  else if (mode === 'link') state = 'link';
  else if (mode === 'here') {
    if (stripe.state === null) state = 'loading';
    else if (!connected) state = 'noStripe';
    else state = here.length ? 'tickets' : 'noTickets';
  }
  const qc = useQueryClient();
  const wantNight = state === 'tickets';
  const np = useQuery({ queryKey: ticketKeys.nightPrices(date.id), queryFn: () => fetchNightPrices(date.id), enabled: wantNight, retry: 1 });
  const known = wantNight && np.data?.ok === true;
  const byId = new Map((known ? np.data!.tickets : []).map((t) => [t.ticketTypeId, t]));
  const ticketRows = here.map((t) => {
    const n = known ? byId.get(t.id) : undefined;
    return n
      ? { id: t.id, name: t.name, pence: n.nightPence ?? n.usualPence, nightPence: n.nightPence, canChange: n.canChange }
      : { id: t.id, name: t.name, pence: t.pricePence, nightPence: null, canChange: false };
  });
  const refreshNight = () => { void qc.invalidateQueries({ queryKey: ticketKeys.all }); };
  /** One at a time. On the first failure the ones already written go back; the reason becomes one plain line. */
  const writeAll = async (changes: { id: string; pence: number | null; before: number | null }[]): Promise<Outcome> => {
    const done: { id: string; before: number | null }[] = [];
    for (const c of changes) {
      let reason: string | null = 'unknown';
      try { const r = await setNightPrice(c.id, date.id, c.pence); if (r.ok) reason = null; else reason = r.reason; } catch { reason = 'unknown'; }
      if (reason !== null) {
        for (const d of done.reverse()) { try { await setNightPrice(d.id, date.id, d.before); } catch { /* best effort; the read refetches below */ } }
        refreshNight();
        return { ok: false, error: nightPriceLine(reason) };
      }
      done.push({ id: c.id, before: c.before });
    }
    refreshNight();
    return { ok: true, error: null };
  };
  const toastWithUndo = (text: string, restore: { id: string; pence: number | null; before: number | null }[]) => {
    showToast(text, () => {
      void (async () => {
        const r = await writeAll(restore);
        showToast(r.ok ? UNDONE_TEXT : UNDO_FAILED_TEXT);
      })();
    });
  };
  const saveTickets = async (changes: TicketChange[]): Promise<Outcome> => {
    const withBefore = changes.map((c) => ({ id: c.id, pence: c.pence as number | null, before: byId.get(c.id)?.nightPence ?? null }));
    const r = await writeAll(withBefore);
    if (r.ok) toastWithUndo(oneOff ? P.savedOne : V2.session.savedNight(dateWords), withBefore.map((c) => ({ id: c.id, pence: c.before, before: c.pence })));
    return r;
  };
  const backTickets = async (): Promise<Outcome> => {
    const had = [...byId.values()].filter((t) => t.nightPence != null);
    if (had.length) {
      const r = await writeAll(had.map((t) => ({ id: t.ticketTypeId, pence: null, before: t.nightPence })));
      if (!r.ok) return r;
      if (!changed) toastWithUndo(V2.backToUsualFor(dateWords), had.map((t) => ({ id: t.ticketTypeId, pence: t.nightPence, before: null })));
    }
    if (changed) {
      let failure: Outcome | null = null;
      try {
        const o = (await onBack()) as Outcome | undefined;
        if (o && o.ok === false) failure = { ok: false, error: o.error ?? P.notSaved };
      } catch { failure = { ok: false, error: P.notSaved }; }
      if (failure) {
        if (had.length) await writeAll(had.map((t) => ({ id: t.ticketTypeId, pence: t.nightPence, before: null })));
        return failure;
      }
    }
    return { ok: true, error: null };
  };
  const saveDoor = async (price: number) => {
    const stored = ownerPassesFromStored(passes);
    if (!stored) return { ok: false, error: P.locked };
    const next = stored.length
      ? stored.map((p, i) => (i === 0 ? { ...p, price } : p))
      : [{ id: crypto.randomUUID(), name: 'Entry', price }];
    const step: WriteStep = { part: V2.price, target: 'occurrence', id: date.id, version: date.version, command: { kind: 'occurrence.set_override', payload: { passes: next } }, order: 1 };
    const label = oneOff ? V2.priceSheet.savedOne : V2.session.savedNight(dateWords);
    return onSave([step], [{ passes: detail?.passesOverride ?? null }], label);
  };
  return (
    <PriceSheet state={state} weekly={weekly} long={long} day={day} doorPrice={doorPriceOf(passes)} link={link}
      tickets={ticketRows} ticketsKnown={known} onSaveTickets={saveTickets} onBackTickets={backTickets} changed={changed}
      onSaveDoor={saveDoor} onBack={onBack} onGoTickets={onGoTickets} onLink={onLink} onClose={onClose} />
  );
}
