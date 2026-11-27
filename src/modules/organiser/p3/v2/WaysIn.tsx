import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';
import { formatPence, NOT_SWITCHED_ON } from '../../tickets/ticketModel';
import { parsePayment, togglePayment, toSend, type PaymentMethod } from '../../events/paymentModel';
import type { EventWorkspace } from '../../events/eventModel';
import type { TicketRow } from './TicketsV2';

const W = V2.waysIn;
const T = V2.ticketsPay;

/** The stored payment list with ONE code switched on or off; every other stored code (cash, bank_transfer) is kept. */
export function withMethod(ws: EventWorkspace, code: PaymentMethod, on: boolean): string {
  const picked = parsePayment(ws.series.payment_methods);
  return toSend(ws, picked.includes(code) === on ? picked : togglePayment(picked, code));
}

export interface WaysInViewProps {
  name: string;
  oneOff: boolean;
  day: string;
  backTo: string;
  stripe: boolean;
  /** false while the Stripe account is still loading: the Connect state must not flash */
  stripeReady?: boolean;
  tickets: TicketRow[];
  dates: string[];
  door: boolean;
  free: boolean;
  link: string | null;
  /** a festival sells through its link: no door, no free */
  festival: boolean;
  busy?: boolean;
  stripeWarn?: boolean;
  stripeBusy?: boolean;
  onCheckAgain?: () => void;
  stripeNote?: string | null;
  stripeOff?: boolean;
  on?: Partial<Record<'stripe' | 'ticket' | 'newTicket' | 'door' | 'link' | 'free', (id?: string) => void>>;
}

const Btn = ({ cls, id, onTap, children, ticketId, disabled }: { cls: string; id: string; onTap?: (id?: string) => void; children: ReactNode; ticketId?: string; disabled?: boolean }) => (
  <button type="button" disabled={disabled} className={cls} data-testid={`tk-${id}${ticketId ? `-${ticketId}` : ''}`} onClick={() => onTap?.(ticketId)}>{children}</button>
);

const rowStyle = { width: '100%', minHeight: 48, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1.5px solid #CFCFCF', borderRadius: 10, background: '#FFF' } as const;

function Tick({ id, label, sub, on, disabled, onTap }: { id: string; label: string; sub: string | null; on: boolean; disabled?: boolean; onTap?: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} disabled={disabled} data-testid={id} style={rowStyle} onClick={onTap}>
      <span aria-hidden="true" style={{ width: 22, height: 22, flex: 'none', borderRadius: 6, border: '2px solid #464646', background: on ? '#C2410C' : '#FFF', color: '#FFF', textAlign: 'center', lineHeight: '18px', fontSize: 15 }}>{on ? '✓' : ''}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}><b>{label}</b>{sub ? <span className="s" style={{ fontSize: 14, color: '#464646' }}>{sub}</span> : null}</span>
    </button>
  );
}

/** The Ways in list (flag waysInV2). Pure view: every state is a prop so each can be rendered and tested. */
export function WaysInView(p: WaysInViewProps) {
  const on = p.on ?? {};
  return (
    <div className="ev2 ev2-page v2-page" data-testid="ways-in-v2">
      <Link to={p.backTo} className="back" data-testid="tk-back">&larr; {p.name}</Link>
      <h1 className="ttl" data-testid="wi-title">{W.title}</h1>
      <div className="sub" data-testid="wi-sub">{W.sub}</div>
      {!p.oneOff && <div className="sub" data-testid="tk-weekly-sub">The usual prices, for every {p.day}.</div>}
      <div className="grp" data-testid="wi-online" style={{ border: '2px solid #C2410C', borderRadius: 12, padding: 14 }}>
        <b style={{ fontSize: 17 }}>{W.onlineTitle}</b>
        <span className="s" style={{ fontSize: 14, color: '#464646' }}>{W.onlineSub}</span>
        {!p.stripe && p.stripeReady === false ? (
          <p className="sent" data-testid="tk-loading">{V2.loading}</p>
        ) : !p.stripe ? (
          <>
            <Btn cls="btn pri big" id="stripe" onTap={on.stripe} disabled={p.stripeBusy}>Sell tickets here</Btn>
            <p className="sent">Connect Stripe and get paid in seconds. No commission from Bachata Calendar.</p>
            {p.stripeOff ? <p className="warn" role="status" data-testid="tk-stripe-off">{NOT_SWITCHED_ON}</p> : null}
            {p.stripeNote ? <p className="err" role="alert" data-testid="tk-stripe-note">{p.stripeNote}</p> : null}
            {p.stripeWarn ? <p className="warn" data-testid="tk-warn">{W.stripeWarn}</p> : null}
            {p.stripeWarn && p.onCheckAgain ? (
              <button type="button" className="btn sec" data-testid="tk-check-again" disabled={p.stripeBusy} onClick={p.onCheckAgain}>{T.checkAgain}</button>
            ) : null}
          </>
        ) : (
          <>
            <div className="sub" data-testid="tk-hint">{p.tickets.length ? 'Tap a ticket to change it.' : 'No tickets yet. Add your first ticket.'}</div>
            {p.tickets.map((t) => (
              <Btn key={t.id} cls="tcard" id="ticket" ticketId={t.id} onTap={on.ticket}>
                <b>{t.name}{t.early ? <> <span className="v2-tag" data-testid="tk-early-pill">{t.early.pill}</span></> : null}</b>
                <span className="s">{t.early ? t.early.price : t.line}</span>
                <span className="s">{t.sold} sold across all dates, {formatPence(t.pence)}</span>
                {!p.oneOff ? (
                  <span className="plist">
                    {p.dates.map((d, i) => (
                      <span key={d} style={{ display: 'contents' }}><span>{d}</span><span>{t.perDate[i] ?? 0} of {t.qty}</span></span>
                    ))}
                  </span>
                ) : null}
              </Btn>
            ))}
            <Btn cls="btn sec" id="new" onTap={on.newTicket}>Add a ticket</Btn>
          </>
        )}
      </div>
      {p.festival ? null : <Tick id="wi-door" label={W.doorLabel} sub={p.door ? W.doorSub : null} on={p.door} disabled={p.busy} onTap={() => on.door?.()} />}
      <button type="button" data-testid="wi-link" disabled={p.busy} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 0 }} onClick={() => on.link?.()}>
        <b>{W.linkLabel}</b>
        <span className="s" style={{ fontSize: 14, color: '#464646', overflowWrap: 'anywhere' }}>{p.link || W.linkAdd}</span>
      </button>
      {!p.festival && p.door && !p.tickets.length && !p.stripe && p.stripeReady !== false ? (
        <button type="button" className="lnk" data-testid="wi-stripe-nudge" disabled={p.stripeBusy} style={{ textAlign: 'left', fontSize: 14 }} onClick={() => on.stripe?.()}>{W.stripeNudge}</button>
      ) : null}
      {p.festival ? null : <Tick id="wi-free" label={W.freeLabel} sub={p.free ? W.freeSub : null} on={p.free} disabled={p.busy} onTap={() => on.free?.()} />}
    </div>
  );
}

/** The link sheet for Ways in: save writes the url AND the ticket_link code; with a saved link, Remove clears both. */
export function WaysInLinkSheet({ link, error, busy, onDone, onRemove, onClose }: { link: string; error?: string | null; busy?: boolean; onDone: (url: string) => void; onRemove: () => void; onClose: () => void }) {
  const [raw, setRaw] = useState(link);
  const [empty, setEmpty] = useState(false);
  return (
    <V2Sheet open title={T.linkTitle} onClose={onClose}>
      <div className="grp">
        <label className="flab" htmlFor="f-link-in">{T.linkField}</label>
        <input id="f-link-in" className="fld" type="url" placeholder="https://" value={raw} onChange={(e) => { setRaw(e.target.value); setEmpty(false); }} />
        {empty ? <p className="err" role="alert" data-testid="link-err">{T.linkEmpty}</p> : null}
        {!empty && error ? <p className="err" role="alert" data-testid="link-save-err">{error}</p> : null}
        <button type="button" className="btn pri" data-testid="link-done" disabled={busy} aria-busy={busy} onClick={() => { if (!raw.trim()) { setEmpty(true); return; } onDone(raw.trim()); }}>{V2.done}</button>
        {link ? <button type="button" className="btn sec" data-testid="wi-link-remove" disabled={busy} onClick={onRemove}>{W.linkRemove}</button> : null}
      </div>
    </V2Sheet>
  );
}
