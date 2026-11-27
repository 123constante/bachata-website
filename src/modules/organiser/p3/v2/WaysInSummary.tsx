import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { V2 } from './copy';
import { formatPence, NOT_SWITCHED_ON } from '../../tickets/ticketModel';
import type { TicketRow } from './TicketsV2';

const W = V2.waysIn;
const S = V2.waysInSummary;
const T = V2.ticketsPay;

/** A ticket as the summary needs it: the list row plus its price, the next date step and the count tier. */
export interface SummaryTicket extends TicketRow {
  /** the price today, in pence (TicketRow.pence is money earned) */
  pricePence: number;
  /** a coming price step: the early-bird date line reads from it */
  nextStep?: { pricePence: number; effectiveFrom: string } | null;
  /** count early bird (t.early set): the early price and how many get it */
  earlyPence?: number | null;
  earlyFirst?: number | null;
}

type OnKey = 'ticket' | 'early' | 'newTicket' | 'door' | 'link' | 'free' | 'stripe' | 'skipDoor' | 'rerun';

export interface WaysInSummaryViewProps {
  name: string;
  oneOff: boolean;
  day: string;
  backTo: string;
  stripe: boolean;
  /** false while the Stripe account is still loading: the Connect state must not flash */
  stripeReady?: boolean;
  /** online was picked in the questions (so, with no Stripe yet, the Connect line shows) */
  online?: boolean;
  tickets: SummaryTicket[];
  door: boolean;
  free: boolean;
  link: string | null;
  festival: boolean;
  busy?: boolean;
  stripeWarn?: boolean;
  stripeBusy?: boolean;
  onCheckAgain?: () => void;
  stripeNote?: string | null;
  stripeOff?: boolean;
  /** day labels of the nights with no door ("Friday 5 December"); empty or missing: the default skip-door line */
  noDoorNights?: string[];
  note?: string | null;
  /** "now" for the early-bird date wording; tests pin it */
  now?: number;
  on?: Partial<Record<OnKey, (id?: string) => void>>;
}

/** "A", "A and B", "A, B and C". */
function joinNights(list: string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list.join('');
}

const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long' });
const DAY_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });

/** "Friday" within 6 days, "Friday 5 December" further out. */
export function untilWords(iso: string, now: number): string {
  const at = Date.parse(iso);
  const far = at - now > 6 * 86_400_000;
  return (far ? DAY_DATE : DAY).format(new Date(at)).replace(/,/g, '');
}

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, padding: '10px 14px', border: '1.5px solid #CFCFCF', borderRadius: 10, background: '#FFF' } as const;
const mutedStyle = { fontSize: 14, color: '#464646' } as const;
const btnStyle = { minWidth: 44, minHeight: 44, color: '#C2410C', fontWeight: 700, background: 'none', border: 0, padding: '0 8px' } as const;

function Line({ id, text, sub, action, label, disabled, onTap }: { id: string; text: ReactNode; sub?: string | null; action: string; label: string; disabled?: boolean; onTap?: () => void }) {
  return (
    <div style={rowStyle} data-testid={`ws-line-${id}`}>
      <span style={{ display: 'flex', flexDirection: 'column', overflowWrap: 'anywhere' }}>
        <span data-testid={`ws-text-${id}`}>{text}</span>
        {sub ? <span className="s" style={mutedStyle} data-testid={`ws-sold-${id}`}>{sub}</span> : null}
      </span>
      <button type="button" style={btnStyle} disabled={disabled} aria-label={`${action} ${label}`} data-testid={`ws-${id}`} onClick={onTap}>{action}</button>
    </div>
  );
}

/** The Tickets summary (Ways in rebuild W2, prototype B screens 2 and 3). Pure view: every state is a prop. */
export function WaysInSummaryView(p: WaysInSummaryViewProps) {
  const on = p.on ?? {};
  const now = p.now ?? Date.now();
  const ready = p.stripeReady !== false;
  const several = p.tickets.length > 1;
  const noDoor = p.noDoorNights ?? [];
  return (
    <div className="ev2 ev2-page v2-page wi-page" data-testid="ways-in-summary">
      <Link to={p.backTo} className="back" data-testid="ws-back">&larr; {p.name}</Link>
      <h1 className="ttl" data-testid="ws-title">Tickets</h1>
      <div className="sub" data-testid="ws-sub">What dancers see.</div>
      {!p.oneOff && <div className="sub" data-testid="ws-weekly-sub">The usual prices, for every {p.day}.</div>}
      {p.note ? <p className="ok" role="status" data-testid="ws-note" style={{ color: '#166534' }}>{p.note}</p> : null}

      {!p.stripe && !ready ? <p className="sent" data-testid="ws-loading">{V2.loading}</p> : null}
      {!p.stripe && ready && p.online ? (
        <>
          <Line id="stripe" text={S.online} action={S.connect} label="online" disabled={p.stripeBusy} onTap={() => on.stripe?.()} />
          {p.stripeOff ? <p className="warn" role="status" data-testid="ws-stripe-off">{NOT_SWITCHED_ON}</p> : null}
          {p.stripeNote ? <p className="err" role="alert" data-testid="ws-stripe-note">{p.stripeNote}</p> : null}
          {p.stripeWarn ? <p className="warn" data-testid="ws-warn">{W.stripeWarn}</p> : null}
          {p.stripeWarn && p.onCheckAgain ? (
            <button type="button" className="btn sec" data-testid="ws-check-again" disabled={p.stripeBusy} onClick={p.onCheckAgain}>{T.checkAgain}</button>
          ) : null}
        </>
      ) : null}
      {p.stripe && !p.tickets.length ? <Line id="add" text={S.onlineAdd} action={S.add} label="your price" onTap={() => on.newTicket?.()} /> : null}

      {p.stripe && p.tickets.map((t) => {
        const price = t.pricePence === 0 ? 'Free' : formatPence(t.pricePence);
        const step = t.nextStep && Date.parse(t.nextStep.effectiveFrom) > now ? t.nextStep : null;
        return (
          <div key={t.id} style={{ display: 'contents' }}>
            <Line id={`ticket-${t.id}`} text={S.ticketLine(price, t.qty, p.oneOff, several ? t.name : null)} sub={t.sold > 0 ? S.sold(t.sold) : null} action={S.change} label={t.name} onTap={() => on.ticket?.(t.id)} />
            {t.early && t.earlyPence != null && t.earlyFirst != null ? (
              <Line id={`early-${t.id}`} text={S.earlyCount(formatPence(t.earlyPence), t.earlyFirst)} action={S.change} label={`early price for ${t.name}`} onTap={() => on.early?.(t.id)} />
            ) : step ? (
              <Line id={`early-${t.id}`} text={S.earlyDate(formatPence(step.pricePence), untilWords(step.effectiveFrom, now))} action={S.change} label={`early price for ${t.name}`} onTap={() => on.early?.(t.id)} />
            ) : null}
          </div>
        );
      })}

      {p.stripe && p.tickets.length ? (
        <button type="button" data-testid="ws-another" disabled={p.busy} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '0 16px', border: '1.5px dashed #C2410C', borderRadius: 999, color: '#C2410C', background: 'none', fontWeight: 700 }} onClick={() => on.newTicket?.()}>{S.another}</button>
      ) : null}

      {!p.festival && p.door ? <Line id="door" text={S.door} action={S.change} label="pay at the door" disabled={p.busy} onTap={() => on.door?.()} /> : null}
      {p.link ? <Line id="link" text={S.yourSite(p.link)} action={S.change} label="ticket site" disabled={p.busy} onTap={() => on.link?.()} /> : null}
      {!p.festival && p.free ? <Line id="free" text={S.free} action={S.change} label="free entry" disabled={p.busy} onTap={() => on.free?.()} /> : null}

      {!p.festival && p.door && !p.tickets.length && !p.stripe && ready ? (
        <button type="button" className="lnk" data-testid="ws-stripe-nudge" disabled={p.stripeBusy} style={{ textAlign: 'left', fontSize: 15, minHeight: 44, padding: 0, background: 'none', border: 0, color: '#C2410C', fontWeight: 600, textDecoration: 'underline', alignSelf: 'flex-start' }} onClick={() => on.stripe?.()}>{W.stripeNudge}</button>
      ) : null}

      {!p.festival && !p.oneOff && p.door ? <Line id="skip-door" text={noDoor.length ? S.noDoorOn(joinNights(noDoor)) : S.skipDoor} action={noDoor.length ? S.change : S.choose} label="the night to skip the door" onTap={() => on.skipDoor?.()} /> : null}
      <Line id="rerun" text={S.rerun} action={S.start} label="the questions" onTap={() => on.rerun?.()} />
    </div>
  );
}
