import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { weekdayName } from '../../events/eventModel';
import { fullDate } from '../../shared/dateWords';
import { londonTodayKey } from '@/lib/londonDate';
import { formatPence, type StripeState } from '../../tickets/ticketModel';
import type { ManagedType } from '../../tickets/priceSteps';
import { useManagedTypes, useSeriesTypes, useStripe, useSummary } from '../tickets/data';
import { WorkspaceGate } from '../screens/EventPage';
import { P3_PATHS } from '../shell/paths';
import { upcomingOf } from './editorModel';
import { payModeOf, doorPriceOf, type PayMode } from './payMode';
import './v2.css';

export interface TicketRow {
  id: string;
  name: string;
  /** "£10 until Tuesday 1 December, then £12", "£8" or "Free" (T-10) */
  line: string;
  sold: number;
  /** pence earned across all dates; 0 when the read has no money (a manager) */
  pence: number;
  qty: number;
  /** sold per coming date, in date order (weekly only) */
  perDate: number[];
}

export interface TicketsViewProps {
  name: string;
  oneOff: boolean;
  day: string;
  backTo: string;
  stripe: boolean;
  mode: PayMode;
  tickets: TicketRow[];
  /** the coming dates, already worded ("Thursday 26 November") */
  dates: string[];
  doorPrice: number | null;
  link: string | null;
  /** 12b sets this after "Not now"; the box shows only while selling here without Stripe */
  stripeWarn?: boolean;
  /** Buttons render fully; a tap does nothing until the slice that owns the sheet gives a handler. */
  on?: Partial<Record<'stripe' | 'ticket' | 'newTicket' | 'sellHere' | 'payDoor' | 'link' | 'doorUsual' | 'howPay', (id?: string) => void>>;
}

const Btn = ({ cls, id, onTap, children, ticketId }: { cls: string; id: string; onTap?: (id?: string) => void; children: ReactNode; ticketId?: string }) => (
  <button type="button" className={cls} data-testid={`tk-${id}${ticketId ? `-${ticketId}` : ''}`} onClick={() => onTap?.(ticketId)}>{children}</button>
);

/** The Tickets screen (prototype scrTickets). Pure view: every state is a prop so each can be rendered and tested. */
export function TicketsView(p: TicketsViewProps) {
  const on = p.on ?? {};
  const doorLine = p.doorPrice != null ? formatPence(Math.round(p.doorPrice * 100)) : null;
  return (
    <div className="ev2 ev2-page v2-page" data-testid="tickets-v2">
      <Link to={p.backTo} className="back" data-testid="tk-back">&larr; {p.name}</Link>
      <h1 className="ttl" data-testid="tk-title">Tickets</h1>
      {!p.oneOff && <div className="sub" data-testid="tk-weekly-sub">The usual prices, for every {p.day}.</div>}
      {!p.stripe ? (
        <div className="grp">
          <Btn cls="btn pri big" id="stripe" onTap={on.stripe}>Sell tickets here</Btn>
          <p className="sent">Connect Stripe and get paid in seconds. No commission from Bachata Calendar. Stripe card fees apply.</p>
          {p.stripeWarn && p.mode === 'here' ? <p className="warn" data-testid="tk-warn">Dancers can&rsquo;t buy yet. Connect Stripe or choose pay at the door.</p> : null}
        </div>
      ) : p.mode === 'here' ? (
        <div className="grp">
          <div className="sub" data-testid="tk-hint">{p.tickets.length ? 'Tap a ticket to change it.' : 'No tickets yet. Add your first ticket.'}</div>
          {p.tickets.map((t) => (
            <Btn key={t.id} cls="tcard" id="ticket" ticketId={t.id} onTap={on.ticket}>
              <b>{t.name}</b>
              <span className="s">{t.line}</span>
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
        </div>
      ) : (
        <div className="grp"><Btn cls="btn pri big" id="sellHere" onTap={on.sellHere}>Sell tickets here</Btn></div>
      )}
      {p.mode === 'here' ? (
        <p className="sent" data-testid="tk-foot">Not selling here? <Btn cls="inl" id="payDoor" onTap={on.payDoor}>Pay at the door</Btn> or <Btn cls="inl" id="link" onTap={on.link}>add a link</Btn> instead.</p>
      ) : p.mode === 'door' ? (
        <>
          <p className="sent" data-testid="tk-foot">Dancers pay {doorLine ?? 'at the door'}{doorLine ? ' at the door' : ''}. <Btn cls="inl" id="doorUsual" onTap={on.doorUsual}>Change the usual price</Btn></p>
          <p className="sent"><Btn cls="inl" id="howPay" onTap={on.howPay}>Change how dancers pay</Btn></p>
        </>
      ) : (
        <p className="sent" data-testid="tk-foot">Dancers buy at {p.link || 'your link'}. <Btn cls="inl" id="howPay" onTap={on.howPay}>Change</Btn></p>
      )}
    </div>
  );
}

const WHEN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });

/** "£10 until Tuesday 1 December, then £12" when a price change is coming; else the plain price. */
export function ticketLine(pricePence: number, m: Pick<ManagedType, 'steps'> | undefined, now = Date.now()): string {
  const next = (m?.steps ?? []).filter((s) => !s.isLive && Date.parse(s.effectiveFrom) > now).sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom))[0];
  const cur = pricePence === 0 ? 'Free' : formatPence(pricePence);
  if (!next) return cur;
  return `${cur} until ${WHEN.format(new Date(next.effectiveFrom)).replace(/,/g, '')}, then ${formatPence(next.pricePence)}`;
}

function TicketsLoaded({ ws }: { ws: EventWorkspace }) {
  const s = ws.series;
  const orgId = ws.organiserIds?.[0];
  const oneOff = s.format === 'one_off';
  const stripe = useStripe(orgId);
  const types = useSeriesTypes(orgId, s.id, true);
  const summary = useSummary(orgId, true);
  const managed = useManagedTypes(s.id, true);
  const list = types.data ?? [];
  const connected = (stripe.state as StripeState | null) === 'connected';
  const mode = payModeOf({ ticketTypes: list, defaultTicketUrl: s.default_ticket_url, stripeConnected: connected });
  const coming = oneOff ? [] : upcomingOf(ws.dates ?? [], londonTodayKey()).slice(0, 6);
  const sales = new Map((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const rows: TicketRow[] = list.filter((t) => t.status !== 'closed').map((t) => {
    const sold = sales.get(t.id)?.ticketsSold ?? 0;
    return {
      id: t.id, name: t.name, qty: t.capacity, sold,
      line: ticketLine(t.pricePence, managed.data?.types.find((m) => m.id === t.id)),
      pence: sales.get(t.id)?.grossPence ?? 0,
      perDate: coming.map((d) => (t.occurrenceId === d.id ? sold : 0)),
    };
  });
  return (
    <TicketsView name={s.name ?? ''} oneOff={oneOff} day={coming[0] ? weekdayName(coming[0].occurrence_date) : ''} backTo={P3_PATHS.event(s.id)}
      stripe={connected} mode={mode} tickets={rows} dates={coming.map((d) => fullDate(d.occurrence_date).replace(/ \d{4}$/, ''))}
      doorPrice={doorPriceOf(s.passes)} link={s.default_ticket_url ?? null} />
  );
}

/** Route element for /app/events/:seriesId/tickets (flag organiserEditorV2). */
export function TicketsV2() {
  return <WorkspaceGate>{(ws) => <TicketsLoaded ws={ws} />}</WorkspaceGate>;
}
