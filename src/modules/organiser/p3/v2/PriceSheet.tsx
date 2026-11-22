import { useRef, useState } from 'react';
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

export interface PriceTicket { id: string; name: string; pence: number }

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
      const r = (await p.onBack()) as { ok?: boolean; error?: string | null } | undefined;
      if (r && r.ok === false) setProblem(r.error ?? P.notSaved); else p.onClose();
    } catch { setProblem(P.notSaved); } finally { inFlight.current = false; setBusy(false); }
  };
  const goBack = (label: string) => (p.changed ? (
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
    // UNBUILT: no per-night ticket price write exists, so Done closes without saving (see the slice 14 handover).
    body = (
      <>
        {only}
        {p.tickets.map((t) => (t.pence <= 0
          ? <p key={t.id} className="txt" data-testid={`price-free-${t.id}`}><b>{t.name}</b>: {P.free}</p>
          : (
            <div key={t.id}>
              <label className="flab" htmlFor={`p-${t.id}`}>{P.ticketField(t.name)}</label>
              <input id={`p-${t.id}`} className="fld" type="number" min="0" step="0.5" inputMode="decimal" readOnly aria-readonly="true"
                value={raw[t.id] ?? String(t.pence / 100)} onChange={(e) => setRaw({ ...raw, [t.id]: e.target.value })} />
            </div>
          )))}
        {problem ? <p className="err" role="alert" data-testid="price-err">{problem}</p> : null}
        <button type="button" className="btn pri" data-testid="price-done" onClick={p.onClose}>{V2.done}</button>
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
      tickets={here.map((t) => ({ id: t.id, name: t.name, pence: t.pricePence }))} changed={changed}
      onSaveDoor={saveDoor} onBack={onBack} onGoTickets={onGoTickets} onLink={onLink} onClose={onClose} />
  );
}
