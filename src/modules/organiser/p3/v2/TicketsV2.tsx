import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
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
import { formatPence, NOT_SWITCHED_ON, type StripeState } from '../../tickets/ticketModel';
import type { ManagedType } from '../../tickets/priceSteps';
import { useManagedTypes, useSeriesTypes, useStartOnboarding, useStripe, useSummary } from '../tickets/data';
import { returnKindOf, useConnectReturn, type ReturnKind } from '../tickets/connectReturn';
import { WorkspaceGate } from '../screens/EventPage';
import { P3_PATHS } from '../shell/paths';
import { upcomingOf } from './editorModel';
import { payModeOf, doorPriceOf, type PayMode } from './payMode';
import { priceNow, SOLD_STEP_WINDOW_MS, TicketSheetV2 } from './TicketSheetV2';
import { earlyBirdOf, type EarlyBirdView } from '../tickets/earlyBird';
import { flags } from '@/lib/featureFlags';
import { WaysInLinkSheet, WaysInView, withMethod } from './WaysIn';
import { WaysInGuideView, type GuideAnswers, type GuideResult } from './WaysInGuide';
import { WaysInSummaryView, type SummaryTicket } from './WaysInSummary';
import { SkipDoorSheet } from './SkipDoorSheet';
import { GUIDE_CODES, useWaysInGuideSave } from './useWaysInGuideSave';
import { dateDetailQueryKey, fetchDateDetail } from '../../shared/selfServeApi';
import { parsePayment, type PaymentMethod } from '../../events/paymentModel';
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
  /** open early bird tier (flag ticketEarlyBird): pill + "£E now, £R after"; absent = row as today */
  early?: EarlyBirdView | null;
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
  /** 17e: "Check again" under the warn restarts the 30 s poll */
  onCheckAgain?: () => void;
  stripeNote?: string | null;
  stripeOff?: boolean;
  /** false while the Stripe account is still loading: the Connect screen must not flash (slice 13) */
  stripeReady?: boolean;
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
      {!p.stripe && p.stripeReady === false ? (
        <div className="grp"><p className="sent" data-testid="tk-loading">{V2.loading}</p></div>
      ) : !p.stripe ? (
        <div className="grp">
          <Btn cls="btn pri big" id="stripe" onTap={on.stripe} disabled={p.stripeBusy}>Sell tickets here</Btn>
          <p className="sent">Connect Stripe and get paid in seconds. No commission from Bachata Calendar.</p>
          {p.stripeOff ? <p className="warn" role="status" data-testid="tk-stripe-off">{NOT_SWITCHED_ON}</p> : null}
          {p.stripeNote ? <p className="err" role="alert" data-testid="tk-stripe-note">{p.stripeNote}</p> : null}
          {p.stripeWarn ? <p className="warn" data-testid="tk-warn">Dancers can&rsquo;t buy yet. Connect Stripe or choose pay at the door.</p> : null}
          {p.stripeWarn && p.onCheckAgain ? (
            <button type="button" className="btn sec" data-testid="tk-check-again" disabled={p.stripeBusy} onClick={p.onCheckAgain}>{V2.ticketsPay.checkAgain}</button>
          ) : null}
        </div>
      ) : p.mode === 'here' ? (
        <div className="grp">
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
  const coming = (m?.steps ?? []).filter((s) => !s.isLive && Date.parse(s.effectiveFrom) > now).sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom));
  // a step starting within 2 minutes already counts as the current price (a sold price change goes in 60 s ahead)
  let shown = pricePence;
  while (coming.length && Date.parse(coming[0].effectiveFrom) - now <= SOLD_STEP_WINDOW_MS) shown = coming.shift()!.pricePence;
  const next = coming[0];
  const cur = shown === 0 ? 'Free' : formatPence(shown);
  if (!next) return cur;
  return `${cur} until ${WHEN.format(new Date(next.effectiveFrom)).replace(/,/g, '')}, then ${formatPence(next.pricePence)}`;
}

let plainSeq = 1_000_000;

/** Ticket types THIS screen paused when the person switched away from selling here (never a type paused by hand). */
const pausedKey = (seriesId: string) => `v2-paused-by-switch:${seriesId}`;
const readPausedBySwitch = (seriesId: string): Set<string> => {
  try { const v = JSON.parse(sessionStorage.getItem(pausedKey(seriesId)) ?? '[]') as unknown; return new Set(Array.isArray(v) ? (v as string[]) : []); } catch { return new Set(); }
};
const writePausedBySwitch = (seriesId: string, ids: Set<string>) => {
  try { sessionStorage.setItem(pausedKey(seriesId), JSON.stringify([...ids])); } catch { /* storage blocked: the list lives for this visit only */ }
};
type StatusMove = { id: string; from: string; to: 'paused' | 'on_sale' };

interface ChangeOpts { part: string; label: string; payload?: Record<string, unknown>; before?: Record<string, unknown>; pause?: string[]; reopen?: string[]; flag?: boolean }

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
  const [switchSold, setSwitchSold] = useState(0);
  const [busy, setBusy] = useState(false);
  /** taps 91 / 92: which ticket the sheet is open on (id), or 'new'; null = closed */
  const [ticketOpen, setTicketOpen] = useState<string | null>(null);
  const inFlight = useRef(false);
  const checking = useRef(false);
  const onboard = useStartOnboarding(orgId ?? '', undefined, `${P3_PATHS.event(s.id)}/tickets`);
  const [params, setParams] = useSearchParams();
  const [backKind, setBackKind] = useState<ReturnKind>(() => returnKindOf(params.get('stripe')));
  const handled = useRef(false);
  const list = types.data ?? [];
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; });
  const connected = (stripe.state as StripeState | null) === 'connected';
  const payMode = payModeOf({ ticketTypes: list, defaultTicketUrl: s.default_ticket_url, stripeConnected: connected });
  const mode: PayMode = sellingHere && list.length === 0 ? 'here' : payMode;
  const coming = oneOff ? [] : upcomingOf(ws.dates ?? [], londonTodayKey()).slice(0, 6);
  const day = coming[0] ? weekdayName(coming[0].occurrence_date) : '';
  const sales = new Map((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const rows: TicketRow[] = list.filter((t) => t.status !== 'closed').map((t) => {
    const sold = sales.get(t.id)?.ticketsSold ?? 0;
    return {
      id: t.id, name: t.name, qty: t.capacity, sold,
      line: ticketLine(t.pricePence, managed.data?.types.find((m) => m.id === t.id)),
      early: earlyBirdOf(managed.data?.types.find((m) => m.id === t.id), flags.ticketEarlyBird),
      pence: sales.get(t.id)?.grossPence ?? 0,
      // night-bound: its own night; series-wide: that type's per-night count from the summary, else 0 (never invented)
      perDate: coming.map((d) => (t.occurrenceId
        ? (t.occurrenceId === d.id ? sold : 0)
        : (sales.get(t.id)?.nights ?? []).find((n) => n.occurrenceId === d.id)?.ticketsSold ?? 0)),
    };
  });
  const T = V2.ticketsPay;
  /** Latest saveNow toast: `say` can run from an async save started renders ago (the guide), so it must not read a stale `toast`. */
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const say = (text: string, onUndo?: () => void) => { const old = toastRef.current; if (old) onToastDone(old.seq); plainSeq += 1; setPlain({ seq: plainSeq, text, onUndo }); };
  const refresh = () => { void qc.invalidateQueries({ queryKey: ticketKeys.all }); };
  /** Back from Stripe: once the organiser is known, drop the param. `refresh` (expired link) restarts sign-up; `return` is polled below. */
  useEffect(() => {
    if (!backKind || !orgId || handled.current) return;
    handled.current = true;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
    if (backKind === 'refresh') void onboard.go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backKind, orgId]);
  const ret = useConnectReturn(backKind === 'return' && !!orgId, connected, () => stripe.query?.refetch());
  /** Only a return that polled to the end still not connected warns; it clears the moment `connected` turns true. */
  const stripeWarn = backKind === 'return' && ret.phase === 'timeout' && !connected;
  useEffect(() => {
    if (backKind === 'return' && connected && handled.current) { setBackKind(null); say(T.stripeConnected); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backKind, connected]);
  const seriesStep = (part: string, payload: Record<string, unknown>): WriteStep =>
    ({ part, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', ...payload }), order: 1 });
  const move = async (m: StatusMove) => {
    const r = await setTicketStatus(m.id, m.to);
    if (!r.ok) throw new Error(r.reason ?? 'failed');
  };
  const trackSwitch = (moves: StatusMove[], undo: boolean) => {
    const ids = readPausedBySwitch(s.id);
    for (const m of moves) {
      const paused = undo ? m.to === 'on_sale' : m.to === 'paused';
      if (paused) ids.add(m.id); else ids.delete(m.id);
    }
    writePausedBySwitch(s.id, ids);
  };

  /** One pay change at a time: a second tap while one runs is ignored. */
  const change = async (o: ChangeOpts): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true);
    try { return await changeOnce(o); } finally { inFlight.current = false; setBusy(false); }
  };

  /**
   * One pay change: ticket types paused / re-opened FIRST, the series write LAST, so a failure leaves nothing
   * half-switched (finished type moves are rolled back). Undo puts back each type's own prior status.
   */
  const changeOnce = async (o: ChangeOpts): Promise<boolean> => {
    const now = new Map(listRef.current.map((t) => [t.id, t.status]));
    const moves: StatusMove[] = [
      ...(o.pause ?? []).map((id): StatusMove => ({ id, from: now.get(id) ?? 'on_sale', to: 'paused' })),
      ...(o.reopen ?? []).map((id): StatusMove => ({ id, from: now.get(id) ?? 'paused', to: 'on_sale' })),
    ];
    const steps = o.payload ? [seriesStep(o.part, o.payload)] : [];
    const before = o.before ? [{ name: s.name ?? '', ...o.before }] : [];
    const touchesTypes = moves.length > 0 || o.flag !== undefined;
    setSheetError(null);
    const done: StatusMove[] = [];
    const rollBack = async () => {
      for (const m of [...done].reverse()) { try { await setTicketStatus(m.id, m.from); } catch { /* best effort; the refresh shows the truth */ } }
    };
    try {
      setPlain(null);
      if (!touchesTypes && !steps.length) { say(o.label); return true; } // nothing to write: say so, no Undo that would do nothing
      if (!touchesTypes) {
        const r = await saveNow(steps, before, o.label);
        if (!r.ok) { setSheetError(r.error ?? T.notSaved); return false; }
        return true;
      }
      for (const m of moves) { await move(m); done.push(m); }
      if (steps.length) {
        const r = await saveNow(steps, before, o.label, { noUndo: true });
        if (!r.ok) throw new Error(r.error ?? 'save');
      }
      if (o.flag !== undefined) setSellingHere(o.flag);
      trackSwitch(done, false);
      refresh();
    } catch {
      await rollBack();
      refresh();
      setSheetError(T.notSaved);
      say(T.notSaved);
      return false;
    }
    const inverse = steps.length ? undoPlan(steps, before) : [];
    const changed = steps.length > 0 || done.length > 0 || o.flag !== undefined;
    say(o.label, inverse && changed ? () => {
      void (async () => {
        try {
          for (const m of [...done].reverse()) {
            const cur = listRef.current.find((t) => t.id === m.id)?.status;
            if (cur !== m.to && cur !== m.from) continue; // changed since: leave it alone
            await move({ id: m.id, from: m.to, to: m.from as StatusMove['to'] });
          }
          if (inverse.length) { const r = await saveNow(inverse, [], T.undone, { noUndo: true }); if (!r.ok) throw new Error('undo'); }
          trackSwitch(done, true);
          if (o.flag !== undefined) setSellingHere(!o.flag);
          refresh();
          say(T.undone);
        } catch { refresh(); say(UNDO_FAILED_TEXT); }
      })();
    } : undefined);
    return true;
  };

  /** A fresh read of what is sold; null when it cannot be read (never decide on a stale count). */
  const freshSold = async (): Promise<number | null> => {
    try {
      const d = (await summary.refetch()).data;
      if (!d?.ok) return null;
      return listRef.current.reduce((n, t) => n + (d.types.find((x) => x.id === t.id)?.ticketsSold ?? 0), 0);
    } catch { return null; }
  };
  /** While selling here: re-read sales, then run `ok(sold)`. A failed read says so and acts on nothing. */
  const guardSold = async (ok: (sold: number) => void | Promise<void>) => {
    if (mode !== 'here') { await ok(0); return; }
    if (checking.current || inFlight.current) return;
    checking.current = true; setBusy(true);
    let n: number | null;
    try { n = await freshSold(); } finally { checking.current = false; setBusy(false); }
    if (n === null) { say(T.notSaved); return; }
    await ok(n);
  };

  const oldUrl = s.default_ticket_url ?? null;
  const onSale = list.filter((t) => t.status === 'on_sale').map((t) => t.id);
  const paused = list.filter((t) => t.status === 'paused').map((t) => t.id);
  const toDoor = () => change({ part: T.toastDoor, label: T.toastDoor, payload: oldUrl ? { default_ticket_url: null } : undefined, before: { default_ticket_url: oldUrl }, pause: onSale });

  const payDoor = async () => {
    await guardSold(async (n) => {
      if (n > 0) { setSheet(null); setSwitchSold(n); setSwitchTo('door'); return; }
      if (await toDoor()) setSheet(null);
    });
  };
  const sellHere = async () => {
    const mine = readPausedBySwitch(s.id);
    // paused types this screen cannot prove it paused (storage lost on reload): never claim they reopened
    if (list.length > 0 && paused.length > 0 && !paused.some((id) => mine.has(id)) && !onSale.length) { say(T.notSaved); return; }
    await change({ part: T.toastSell, label: T.toastSell, reopen: paused.filter((id) => mine.has(id)), flag: list.length === 0 ? true : undefined });
  };
  const openLink = () => {
    void guardSold((n) => {
      if (n > 0) { setSheet(null); setSwitchSold(n); setSwitchTo('link'); return; }
      setSheetError(null); setSheet('link');
    });
  };
  const openTicket = (id?: string) => {
    if (id && (!managed.data?.types.some((m) => m.id === id) || !summary.data?.ok)) { say(T.notSaved); return; } // steps not read yet: never open on a guess
    setTicketOpen(id ?? 'new');
  };
  const sheetType = ticketOpen && ticketOpen !== 'new' ? list.find((t) => t.id === ticketOpen) ?? null : null;
  const sheetManaged = sheetType ? managed.data?.types.find((m) => m.id === sheetType.id) : undefined;
  const sheetSales = sheetType ? sales.get(sheetType.id) : undefined;
  const sheetSold = sheetSales?.ticketsSold ?? 0;
  const doSwitch = async () => {
    const to = switchTo;
    setSwitchTo(null);
    if (to === 'door') await toDoor();
    else if (to === 'link') { setSheetError(null); setSheet('link'); }
  };
  const saveLink = async (url: string) => {
    const ok = await change({ part: T.toastLink, label: T.toastLink, payload: { default_ticket_url: url }, before: { default_ticket_url: oldUrl }, pause: mode === 'here' ? onSale : [] });
    if (ok) setSheet(null);
  };
  /** Ways in (flag waysInV2): one tick row = one payment_methods write; Undo restores the prior list. */
  const oldMethods = s.payment_methods ?? null;
  const toggleWay = async (code: PaymentMethod, label: (on: boolean) => string) => {
    const on = !parsePayment(oldMethods).includes(code);
    await change({ part: label(on), label: label(on), payload: { payment_methods: withMethod(ws, code, on) }, before: { payment_methods: oldMethods } });
  };
  const openWaysLink = () => { setSheetError(null); setSheet('link'); };
  const saveWaysLink = async (url: string) => {
    const ok = await change({ part: T.toastLink, label: T.toastLink, payload: { default_ticket_url: url, payment_methods: withMethod(ws, 'ticket_link', true) }, before: { default_ticket_url: oldUrl, payment_methods: oldMethods } });
    if (ok) setSheet(null);
  };
  const removeWaysLink = async () => {
    const ok = await change({ part: V2.waysIn.toastLinkRemoved, label: V2.waysIn.toastLinkRemoved, payload: { default_ticket_url: null, payment_methods: withMethod(ws, 'ticket_link', false) }, before: { default_ticket_url: oldUrl, payment_methods: oldMethods } });
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

  /** Ways in rebuild (flag waysInRebuild + waysInV2): the guide when nothing is set up, else the summary. */
  const rebuild = flags.waysInRebuild && flags.waysInV2;
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideDone, setGuideDone] = useState(false);
  const [guideOnline, setGuideOnline] = useState(false);
  const [guideInitial, setGuideInitial] = useState<Partial<GuideAnswers> | undefined>(undefined);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const saveGuide = useWaysInGuideSave({ ws, organiserId: orgId, ticketCount: rows.length, change, say, refresh });
  const nights = useQueries({ queries: coming.map((d) => ({ queryKey: dateDetailQueryKey(d.id), queryFn: () => fetchDateDetail(d.id), enabled: rebuild && (skipOpen || (parsePayment(oldMethods).includes('door') && !oneOff && s.format !== 'festival')), staleTime: 30_000 })) });
  const nightsFailed = rebuild && skipOpen && nights.some((q) => q.isError && !q.isFetching);
  useEffect(() => { if (nightsFailed) { setSkipOpen(false); say(V2.waysInSummary.nightsLoadFail); } }, [nightsFailed]); // eslint-disable-line react-hooks/exhaustive-deps
  const nothingSet = types.data !== undefined && rows.length === 0 && parsePayment(oldMethods).length === 0 && !oldUrl;
  const showGuide = rebuild && (guideOpen || (nothingSet && !guideDone));
  const firstDate = upcomingOf(ws.dates ?? [], londonTodayKey())[0]?.occurrence_date ?? null;
  const dayWords = (iso: string) => fullDate(iso).replace(/ \d{4}$/, '');
  const noDoorNights = coming.filter((d, i) => nights[i]?.data?.noDoor === true).map((d) => dayWords(d.occurrence_date));
  /** the guide opened from the summary starts from the current answers */
  const openGuide = () => {
    const first = rows[0] ? list.find((t) => t.id === rows[0].id) : undefined;
    setGuideErr(null);
    setGuideInitial({
      online: rows.length > 0 || connected,
      methods: parsePayment(oldMethods).filter((m) => GUIDE_CODES.includes(m)),
      ...(first ? { price: (first.pricePence / 100).toFixed(2), qty: String(first.capacity) } : {}),
    });
    setGuideOpen(true);
  };
  /** A ticket site needs its address: a newly picked one is saved by the link sheet (method + address together), never bare. */
  const needsLink = (r: GuideResult) => r.methods.includes('ticket_link') && !oldUrl;
  const saveAnswers = async (r: GuideResult): Promise<boolean> => {
    const link = needsLink(r);
    const out = await saveGuide(link ? { ...r, methods: r.methods.filter((m) => m !== 'ticket_link') } : r);
    if ('error' in out) { setGuideErr(out.error); return false; }
    if (link) openWaysLink();
    return true;
  };
  const finishGuide = async (r: GuideResult) => {
    setGuideOpen(false); setGuideDone(true); setGuideErr(null);
    if (r.ticket) setGuideOnline(true);
    if (!(await saveAnswers(r))) return;
    // the guide only makes the FIRST ticket; a changed price or count on an existing one goes to its own sheet (price steps live there)
    const first = rows[0] ? list.find((t) => t.id === rows[0].id) : undefined;
    if (r.ticket && first && (r.ticket.pence !== first.pricePence || r.ticket.qty !== first.capacity)) openTicket(first.id);
  };
  const connectFromGuide = async (r: GuideResult) => {
    setGuideOpen(false); setGuideDone(true); setGuideErr(null); setGuideOnline(true);
    if (await saveAnswers(r) && !needsLink(r)) void onboard.go();
  };
  const nowMs = Date.now();
  const sumTickets: SummaryTicket[] = rows.map((r) => {
    const t = list.find((x) => x.id === r.id);
    const m = managed.data?.types.find((x) => x.id === r.id);
    const next = [...(m?.steps ?? [])].filter((st) => !st.isLive && Date.parse(st.effectiveFrom) > nowMs).sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom))[0];
    return {
      ...r, pricePence: priceNow(m?.basePricePence ?? t?.pricePence ?? 0, m?.steps ?? []),
      nextStep: next ? { pricePence: next.pricePence, effectiveFrom: next.effectiveFrom } : null,
      earlyPence: m?.earlyPricePence ?? null, earlyFirst: m?.earlyCapacity ?? null,
    };
  });
  const rebuildView = showGuide ? (
    <WaysInGuideView oneOff={oneOff} festival={s.format === 'festival'} stripe={connected} firstDate={firstDate} today={londonTodayKey()} initial={guideInitial}
      onDone={(r) => { void finishGuide(r); }} onConnect={(r) => { void connectFromGuide(r); }} onClose={() => { setGuideOpen(false); setGuideDone(true); }} />
  ) : (
    <>
      <WaysInSummaryView name={s.name ?? ''} oneOff={oneOff} day={day} backTo={P3_PATHS.event(s.id)}
        stripe={connected} stripeReady={stripe.state !== null} online={guideOnline || rows.length > 0} tickets={sumTickets}
        door={parsePayment(oldMethods).includes('door')} free={parsePayment(oldMethods).includes('free')} link={oldUrl} festival={s.format === 'festival'} busy={busy}
        stripeWarn={stripeWarn} onCheckAgain={ret.again} stripeBusy={onboard.busy} stripeNote={onboard.note} stripeOff={onboard.switchedOff}
        noDoorNights={noDoorNights}
        on={{ ticket: openTicket, early: openTicket, newTicket: () => openTicket(), stripe: () => { void onboard.go(); }, door: openGuide, free: openGuide, link: openWaysLink, rerun: openGuide, skipDoor: () => { const redo = coming.filter((d) => qc.getQueryState(dateDetailQueryKey(d.id))?.status === 'error').map((d) => qc.resetQueries({ queryKey: dateDetailQueryKey(d.id), exact: true })); if (redo.length) void Promise.all(redo).then(() => setSkipOpen(true)); else setSkipOpen(true); } }} />
      {guideErr ? <p className="err" role="alert" data-testid="ways-guide-err">{guideErr}</p> : null}
    </>
  );

  return (
    <>
      {rebuild ? rebuildView : flags.waysInV2 ? (
        <WaysInView name={s.name ?? ''} oneOff={oneOff} day={day} backTo={P3_PATHS.event(s.id)}
          stripe={connected} stripeReady={stripe.state !== null} tickets={rows} dates={coming.map((d) => fullDate(d.occurrence_date).replace(/ \d{4}$/, ''))}
          door={parsePayment(oldMethods).includes('door')} free={parsePayment(oldMethods).includes('free')} link={oldUrl} festival={s.format === 'festival'} busy={busy}
          stripeWarn={stripeWarn} onCheckAgain={ret.again} stripeBusy={onboard.busy} stripeNote={onboard.note} stripeOff={onboard.switchedOff}
          on={{ ticket: openTicket, newTicket: () => openTicket(), stripe: () => { void onboard.go(); }, door: () => { void toggleWay('door', (on) => (on ? V2.waysIn.toastDoorOn : V2.waysIn.toastDoorOff)); }, free: () => { void toggleWay('free', (on) => (on ? V2.waysIn.toastFreeOn : V2.waysIn.toastFreeOff)); }, link: openWaysLink }} />
      ) : (
      <TicketsView name={s.name ?? ''} oneOff={oneOff} day={day} backTo={P3_PATHS.event(s.id)}
        stripe={connected} mode={mode} tickets={rows} dates={coming.map((d) => fullDate(d.occurrence_date).replace(/ \d{4}$/, ''))}
        doorPrice={doorPriceOf(s.passes)} link={s.default_ticket_url ?? null}
        stripeReady={stripe.state !== null}
        stripeWarn={stripeWarn} onCheckAgain={ret.again} stripeBusy={onboard.busy} stripeNote={onboard.note} stripeOff={onboard.switchedOff}
        on={{ ticket: openTicket, newTicket: () => openTicket(), stripe: () => { void onboard.go(); }, sellHere: () => { void sellHere(); }, payDoor: () => { void payDoor(); }, link: openLink, doorUsual: () => { setSheetError(null); setSheet('door'); }, howPay: () => setSheet('how') }} />
      )}
      {!flags.waysInV2 && sheet === 'door' && <DoorSheet busy={busy} price={doorPriceOf(s.passes)} day={oneOff ? null : day} error={sheetError} onDone={(r) => { void saveDoor(r); }} onClose={() => setSheet(null)} />}
      {flags.waysInV2 && sheet === 'link' && <WaysInLinkSheet link={oldUrl ?? ''} busy={busy} error={sheetError} onDone={(u) => { void saveWaysLink(u); }} onRemove={() => { void removeWaysLink(); }} onClose={() => setSheet(null)} />}
      {!flags.waysInV2 && sheet === 'link' && <LinkSheet link={oldUrl ?? ''} busy={busy} error={sheetError} onDone={(u) => { void saveLink(u); }} onClose={() => setSheet(null)} />}
      {!flags.waysInV2 && sheet === 'how' && <HowPaySheet busy={busy} door={mode === 'door'} hasLink={!!oldUrl} onDoor={() => { void payDoor(); }} onLink={openLink} onClose={() => setSheet(null)} />}
      {ticketOpen && orgId && (ticketOpen === 'new' || (sheetType && sheetManaged)) && (
        <TicketSheetV2 key={`${ticketOpen}:${summary.data?.ok ? String(sheetSold > 0) : 'loading'}`} organiserId={orgId} seriesId={s.id} type={ticketOpen === 'new' ? null : sheetType} basePence={sheetManaged?.basePricePence ?? 0} steps={sheetManaged?.steps ?? []} managed={sheetManaged}
          soldKnown={!!summary.data?.ok} oneOff={oneOff} soldMax={sheetType && !sheetType.occurrenceId ? Math.min(sheetSold, sheetType.capacity) : sheetSold} soldAll={sheetSold} pence={sheetSales?.grossPence ?? 0}
          onClose={() => setTicketOpen(null)} onFail={() => refresh()}
          onDone={(text, undo) => {
            refresh();
            say(text, undo ? () => { void undo().then(() => { refresh(); say(T.undone); }, () => { refresh(); say(UNDO_FAILED_TEXT); }); } : undefined);
          }} />
      )}
      {!flags.waysInV2 && switchTo && <SwitchPaySheet busy={busy} sold={switchSold} onSwitch={() => { void doSwitch(); }} onKeep={() => setSwitchTo(null)} />}
      {rebuild && skipOpen && nights.every((q) => q.isSuccess) && (
        <SkipDoorSheet dates={coming.map((d, i) => ({ id: d.id, label: dayWords(d.occurrence_date), noDoor: nights[i].data?.noDoor === true }))}
          onClose={() => setSkipOpen(false)} onSaved={() => { coming.forEach((d) => { void qc.invalidateQueries({ queryKey: dateDetailQueryKey(d.id) }); }); say(T.savedOne); }} />
      )}
      <V2Toast toast={plain ?? toast} onDone={(q) => { setPlain(null); onToastDone(q); }} />
    </>
  );
}

/** Route element for /app/events/:seriesId/tickets (flag organiserEditorV2). */
export function TicketsV2() {
  return <WorkspaceGate>{(ws) => <TicketsLoaded ws={ws} />}</WorkspaceGate>;
}
