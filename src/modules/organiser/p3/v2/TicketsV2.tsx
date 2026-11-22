import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ownerPassesFromStored, PRICE_RE, upsertCommand } from '../../shared/seriesCommands';
import { setTicketStatus, ticketKeys } from '../../tickets/ticketsApi';
import { V2 } from './copy';
import type { WriteStep } from './editorModel';
import { UNDO_FAILED_TEXT, undoPlan, useSaveNow } from './saveNow';
import { V2Toast, type V2ToastState } from './V2Toast';
import { DoorSheet, HowPaySheet, LinkSheet, SwitchPaySheet } from './PaySheets';
import type { EventWorkspace } from '../../events/eventModel';
import { weekdayName } from '../../events/eventModel';
import { fullDate } from '../../shared/dateWords';
import { londonTodayKey } from '@/lib/londonDate';
import { formatPence, NOT_SWITCHED_ON, stripeStateOf, type StripeState } from '../../tickets/ticketModel';
import type { ManagedType } from '../../tickets/priceSteps';
import { useManagedTypes, useSeriesTypes, useStartOnboarding, useStripe, useSummary } from '../tickets/data';
import { returnKindOf } from '../tickets/connectReturn';
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
  /** 12d sets this when the person comes back from Stripe and the account is still not connected (SH-STRIPE-03) */
  stripeWarn?: boolean;
  /** 12d: the real Stripe redirect is under way / refused / payments not switched on */
  stripeBusy?: boolean;
  stripeNote?: string | null;
  stripeOff?: boolean;
  /** Buttons render fully; a tap does nothing until the slice that owns the sheet gives a handler. */
  on?: Partial<Record<'stripe' | 'ticket' | 'newTicket' | 'sellHere' | 'payDoor' | 'link' | 'doorUsual' | 'howPay', (id?: string) => void>>;
}

const Btn = ({ cls, id, onTap, children, ticketId, disabled }: { cls: string; id: string; onTap?: (id?: string) => void; children: ReactNode; ticketId?: string; disabled?: boolean }) => (
  <button type="button" disabled={disabled} className={cls} data-testid={`tk-${id}${ticketId ? `-${ticketId}` : ''}`} onClick={() => onTap?.(ticketId)}>{children}</button>
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
          <Btn cls="btn pri big" id="stripe" onTap={on.stripe} disabled={p.stripeBusy}>Sell tickets here</Btn>
          <p className="sent">Connect Stripe and get paid in seconds. No commission from Bachata Calendar. Stripe card fees apply.</p>
          {p.stripeOff ? <p className="warn" role="status" data-testid="tk-stripe-off">{NOT_SWITCHED_ON}</p> : null}
          {p.stripeNote ? <p className="err" role="alert" data-testid="tk-stripe-note">{p.stripeNote}</p> : null}
          {p.stripeWarn ? <p className="warn" data-testid="tk-warn">Dancers can&rsquo;t buy yet. Connect Stripe or choose pay at the door.</p> : null}
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

let plainSeq = 1_000_000;

function TicketsLoaded({ ws }: { ws: EventWorkspace }) {
  const s = ws.series;
  const orgId = ws.organiserIds?.[0];
  const oneOff = s.format === 'one_off';
  const qc = useQueryClient();
  const stripe = useStripe(orgId);
  const types = useSeriesTypes(orgId, s.id, true);
  const summary = useSummary(orgId, true);
  const managed = useManagedTypes(s.id, true);
  const { saveNow, toast, onToastDone } = useSaveNow(s.id, s.version);
  const [plain, setPlain] = useState<V2ToastState | null>(null);
  const [sheet, setSheet] = useState<'door' | 'link' | 'how' | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sellingHere, setSellingHere] = useState(false);
  const [switchTo, setSwitchTo] = useState<'door' | 'link' | null>(null);
  const [stripeWarn, setStripeWarn] = useState(false);
  const onboard = useStartOnboarding(orgId ?? '', undefined, `${P3_PATHS.event(s.id)}/tickets`);
  const [params, setParams] = useSearchParams();
  const back = useRef(returnKindOf(params.get('stripe')));
  const list = types.data ?? [];
  const connected = (stripe.state as StripeState | null) === 'connected';
  const payMode = payModeOf({ ticketTypes: list, defaultTicketUrl: s.default_ticket_url, stripeConnected: connected });
  const mode: PayMode = sellingHere && list.length === 0 ? 'here' : payMode;
  const coming = oneOff ? [] : upcomingOf(ws.dates ?? [], londonTodayKey()).slice(0, 6);
  const day = coming[0] ? weekdayName(coming[0].occurrence_date) : '';
  const sales = new Map((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const soldKnown = !!summary.data?.ok;
  const soldTotal = list.reduce((n, t) => n + (sales.get(t.id)?.ticketsSold ?? 0), 0);
  const rows: TicketRow[] = list.filter((t) => t.status !== 'closed').map((t) => {
    const sold = sales.get(t.id)?.ticketsSold ?? 0;
    return {
      id: t.id, name: t.name, qty: t.capacity, sold,
      line: ticketLine(t.pricePence, managed.data?.types.find((m) => m.id === t.id)),
      pence: sales.get(t.id)?.grossPence ?? 0,
      perDate: coming.map((d) => (t.occurrenceId === d.id ? sold : 0)),
    };
  });
  const T = V2.ticketsPay;
  const say = (text: string, onUndo?: () => void) => { plainSeq += 1; setPlain({ seq: plainSeq, text, onUndo }); };
  const refresh = () => { void qc.invalidateQueries({ queryKey: ticketKeys.all }); };
  /** Back from Stripe: drop the param, read the account once, then say what happened (SH-STRIPE-02 / 03). */
  useEffect(() => {
    if (!back.current || !orgId) return;
    back.current = null;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
    void (async () => {
      const r = await stripe.query?.refetch();
      if (r && stripeStateOf(r.data as never) === 'connected') say(T.stripeConnected);
      else setStripeWarn(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setStatuses = async (ids: string[], status: 'paused' | 'on_sale') => {
    for (const id of ids) {
      const r = await setTicketStatus(id, status);
      if (!r.ok) throw new Error(r.reason ?? 'failed');
    }
  };
  const seriesStep = (part: string, payload: Record<string, unknown>): WriteStep =>
    ({ part, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', ...payload }), order: 1 });

  /** One pay change: an optional series write, plus ticket types paused / re-opened. Undo puts all of it back. */
  const change = async (o: { part: string; label: string; payload?: Record<string, unknown>; before?: Record<string, unknown>; pause?: string[]; reopen?: string[]; flag?: boolean }): Promise<boolean> => {
    const pause = o.pause ?? [];
    const reopen = o.reopen ?? [];
    const steps = o.payload ? [seriesStep(o.part, o.payload)] : [];
    const before = o.before ? [{ name: s.name ?? '', ...o.before }] : [];
    const touchesTypes = pause.length + reopen.length > 0 || o.flag !== undefined;
    setSheetError(null);
    try {
      setPlain(null);
      if (!touchesTypes) {
        const r = await saveNow(steps, before, o.label);
        if (!r.ok) { setSheetError(r.error ?? T.notSaved); return false; }
        return true;
      }
      if (steps.length) {
        const r = await saveNow(steps, before, o.label, { noUndo: true });
        if (!r.ok) { setSheetError(r.error ?? T.notSaved); return false; }
      }
      await setStatuses(pause, 'paused');
      await setStatuses(reopen, 'on_sale');
      if (o.flag !== undefined) setSellingHere(o.flag);
      refresh();
    } catch {
      refresh();
      setSheetError(T.notSaved);
      say(T.notSaved);
      return false;
    }
    const inverse = steps.length ? undoPlan(steps, before) : [];
    say(o.label, inverse ? () => {
      void (async () => {
        try {
          if (inverse.length) { const r = await saveNow(inverse, [], T.undone, { noUndo: true }); if (!r.ok) throw new Error('undo'); }
          await setStatuses(reopen, 'paused');
          await setStatuses(pause, 'on_sale');
          if (o.flag !== undefined) setSellingHere(!o.flag);
          refresh();
          say(T.undone);
        } catch { refresh(); say(UNDO_FAILED_TEXT); }
      })();
    } : undefined);
    return true;
  };

  const oldUrl = s.default_ticket_url ?? null;
  const onSale = list.filter((t) => t.status === 'on_sale').map((t) => t.id);
  const paused = list.filter((t) => t.status === 'paused').map((t) => t.id);
  /** Selling here with sales: leaving needs the Switch sheet. Sales not read yet: unknown, so never switch blind. */
  const needsSwitch = mode === 'here' && soldKnown && soldTotal > 0;
  const blind = mode === 'here' && !soldKnown;

  const payDoor = async () => {
    if (blind) return;
    if (needsSwitch) { setSheet(null); setSwitchTo('door'); return; }
    const ok = await change({ part: T.toastDoor, label: T.toastDoor, payload: oldUrl ? { default_ticket_url: null } : undefined, before: { default_ticket_url: oldUrl }, pause: onSale });
    if (ok) setSheet(null);
  };
  const sellHere = async () => {
    await change({ part: T.toastSell, label: T.toastSell, reopen: paused, flag: list.length === 0 ? true : undefined });
  };
  const openLink = () => {
    if (blind) return;
    if (needsSwitch) { setSheet(null); setSwitchTo('link'); return; }
    setSheetError(null); setSheet('link');
  };
  const doSwitch = async () => {
    const to = switchTo;
    setSwitchTo(null);
    if (to === 'door') await change({ part: T.toastDoor, label: T.toastDoor, payload: oldUrl ? { default_ticket_url: null } : undefined, before: { default_ticket_url: oldUrl }, pause: onSale });
    else if (to === 'link') { setSheetError(null); setSheet('link'); }
  };
  const saveLink = async (url: string) => {
    const ok = await change({ part: T.toastLink, label: T.toastLink, payload: { default_ticket_url: url }, before: { default_ticket_url: oldUrl }, pause: mode === 'here' ? onSale : [] });
    if (ok) setSheet(null);
  };
  const saveDoor = async (raw: string) => {
    const text = raw.trim();
    const cur = doorPriceOf(s.passes);
    if (text === '' || (cur != null && Number(text) === cur && PRICE_RE.test(text))) { setSheet(null); return; }
    if (!PRICE_RE.test(text)) { setSheetError(T.doorBad); return; }
    const price = Number(text);
    const stored = ownerPassesFromStored(s.passes);
    if (!stored) { setSheetError(T.doorLocked); return; }
    const next = stored.length
      ? stored.map((p, i) => (i === 0 ? { ...p, price } : p))
      : [{ id: crypto.randomUUID(), name: 'Entry', price }];
    const label = oneOff ? T.savedOne : T.savedEvery(day);
    const ok = await change({ part: label, label, payload: { default_passes: next }, before: { default_passes: s.passes ?? [] } });
    if (ok) setSheet(null);
  };

  return (
    <>
      <TicketsView name={s.name ?? ''} oneOff={oneOff} day={day} backTo={P3_PATHS.event(s.id)}
        stripe={connected} mode={mode} tickets={rows} dates={coming.map((d) => fullDate(d.occurrence_date).replace(/ \d{4}$/, ''))}
        doorPrice={doorPriceOf(s.passes)} link={s.default_ticket_url ?? null}
        stripeWarn={stripeWarn} stripeBusy={onboard.busy} stripeNote={onboard.note} stripeOff={onboard.switchedOff}
        on={{ stripe: () => { void onboard.go(); }, sellHere: () => { void sellHere(); }, payDoor: () => { void payDoor(); }, link: openLink, doorUsual: () => { setSheetError(null); setSheet('door'); }, howPay: () => setSheet('how') }} />
      {sheet === 'door' && <DoorSheet price={doorPriceOf(s.passes)} day={oneOff ? null : day} error={sheetError} onDone={(r) => { void saveDoor(r); }} onClose={() => setSheet(null)} />}
      {sheet === 'link' && <LinkSheet link={oldUrl ?? ''} error={sheetError} onDone={(u) => { void saveLink(u); }} onClose={() => setSheet(null)} />}
      {sheet === 'how' && <HowPaySheet door={mode === 'door'} hasLink={!!oldUrl} onDoor={() => { void payDoor(); }} onLink={openLink} onClose={() => setSheet(null)} />}
      {switchTo && <SwitchPaySheet sold={soldTotal} onSwitch={() => { void doSwitch(); }} onKeep={() => setSwitchTo(null)} />}
      <V2Toast toast={plain ?? toast} onDone={(q) => { setPlain(null); onToastDone(q); }} />
    </>
  );
}

/** Route element for /app/events/:seriesId/tickets (flag organiserEditorV2). */
export function TicketsV2() {
  return <WorkspaceGate>{(ws) => <TicketsLoaded ws={ws} />}</WorkspaceGate>;
}
