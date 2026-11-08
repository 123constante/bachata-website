import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import { setTicketStatus, ticketKeys } from '../../tickets/ticketsApi';
import {
  NOT_MANAGER,
  NOT_MANAGER_REFUND,
  PAYMENTS_WHERE,
  SWITCH_LABEL,
  buyerNameOf,
  buyerRulesLine,
  canManage,
  connectBlock,
  OPEN_STRIPE_LABEL,
  connectReturnBanner,
  CONNECT_START_ERROR_SHOWN,
  countsLine,
  eventStartOf,
  leftOf,
  moveBlock,
  orderLine,
  orderTag,
  priceLabel,
  reasonMessage,
  refundable,
  withPendingRefund,
  type PendingRefund,
  switchMove,
  type MoveContext,
  type Order,
  type TicketStatus,
  type TicketType,
  type TypeSales,
} from '../../tickets/ticketModel';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import type { HomeSeriesFull } from '../../shared/homeModel';
import { organiserOfSeries, useP3Home, useSeriesOrders, useSeriesTypes, useStartOnboarding, useStripe, useSummary } from './data';
import { CONNECT_RETURN_EVERY_MS, CONNECT_RETURN_FOR_MS, useConnectReturn } from './connectReturn';
import { P3_TICKET_PATHS } from './paths';
import {
  PREVIEW_ORDERS,
  TONE_CLASS,
  addWhy,
  draftFor,
  eventDateLine,
  hasOrdersOf,
  noOrdersText,
  seeAllLabel,
  shownOrders,
  ticketsRowOf,
  type TypeDraft,
} from './model';
import { RefundSheet } from './RefundSheet';
import { StackSheet, refocusTop } from './StackSheet';
import { ReasonText, SellingElsewhere, TypeSheet } from './TypeSheet';
import { useGatedCopy } from '../onboarding/gate';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Promo codes ride in their own chunk: nothing added to the Tickets sheet's first load.
const PromoSection = lazyWithRetry(() => import('./promo/PromoSection'));

const SalesReport = lazyWithRetry(() => import('./SalesReport').then((m) => ({ default: m.SalesReport })));

/**
 * The event page's Tickets entry (W-T, mockup C): a row under Status that opens ONE tall
 * sheet (ticket types, then the latest two orders with See all; the orders view has Back).
 * The add / edit sheet and the Refund sheet open OVER it. The add / edit draft is held
 * here, above every sheet, so a re-render or a refetch never resets it.
 */
export function TicketsEntry({ seriesId }: { seriesId: string }) {
  const home = useP3Home();
  const found = organiserOfSeries(home.data, seriesId);
  if (home.isPending) {
    return (
      <div className="p3-card p3-status-row" data-testid="tix-row-loading">
        <span className="p3-grow"><span className="p3-row-t">Tickets</span><span className="p3-row-s"> &middot; Loading&hellip;</span></span>
      </div>
    );
  }
  // Not one of the person's pages (home_v1 lists owner / manager pages): no ticket entry to offer.
  if (!found) return null;
  return <Entry org={found.org} series={found.series} />;
}

type View = 'list' | 'orders';

/** After Stripe sends the person back: refetch every 3 s, for at most 30 s. */
export { CONNECT_RETURN_EVERY_MS, CONNECT_RETURN_FOR_MS };

function Entry({ org, series }: { org: HomeOrganiser; series: HomeSeriesFull }) {
  const queryClient = useQueryClient();
  const today = londonTodayKey();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<{ type: TicketType | null } | null>(null);
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  // Per order AND its refunded amount: partial-refund keys still waiting for a definite answer
  // (amount -> request_id), kept across the Refund sheet closing so a retry after a network failure
  // is the same press. Once the webhook moves refunded_pence, the old keys no longer apply.
  const refundKeys = useRef(new Map<string, Map<number, string>>());
  const NO_KEYS: ReadonlyMap<number, string> = new Map();
  const keysOf = (scope: string): ReadonlyMap<number, string> => refundKeys.current.get(scope) ?? NO_KEYS;
  const holdKey = (scope: string, pence: number, key: string | null) => {
    if (key === null) {
      refundKeys.current.get(scope)?.delete(pence);
      return;
    }
    // The Map is made on the first press, never while rendering.
    const m = refundKeys.current.get(scope) ?? new Map<number, string>();
    m.set(pence, key);
    refundKeys.current.set(scope, m);
  };
  // refunded_pence lags the webhook: pence sent and not yet on the order row, per order, counted only
  // while the row still shows the figure it had when they were sent (so it clears when the row moves).
  const [pendingRefund, setPendingRefund] = useState<ReadonlyMap<string, PendingRefund>>(new Map());
  const noteSent = (o: Order, pence: number) =>
    setPendingRefund((m) => {
      const n = new Map(m);
      const prev = n.get(o.id);
      n.set(o.id, { base: o.refundedPence, pence: (prev && prev.base === o.refundedPence ? prev.pence : 0) + pence });
      return n;
    });
  // Orders whose refund is on its way: their Refund button waits for the answer (never a second request).
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());
  const flight = (id: string, on: boolean) =>
    setInFlight((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  // Per ticket type: two switches tapped in quick succession each keep their own busy and error.
  const [moving, setMoving] = useState<ReadonlySet<string>>(new Set());
  const [moveError, setMoveError] = useState<ReadonlyMap<string, string>>(new Map());
  const gated = useGatedCopy();
  // A refusal that lands after its sheet closed is an alert that stays until dismissed (review r1 F3).
  // Alerts are their own queue: a status toast never clears one, and two stay readable (review r2 R1).
  // Each toast carries a fresh id: the same words said twice are a new node with a new timer.
  const [status, setStatus] = useState<{ id: number; text: string } | null>(null);
  const [alerts, setAlerts] = useState<ReadonlyArray<{ id: number; text: string }>>([]);
  const toastSeq = useRef(0);
  const say = useCallback((text: string) => setStatus({ id: ++toastSeq.current, text }), [setStatus]);
  const closeStatus = useCallback(() => setStatus(null), [setStatus]);
  const dismiss = (id: number) => setAlerts((a) => a.filter((x) => x.id !== id));

  const types = useSeriesTypes(org.id, series.id);
  const list = types.data ?? [];
  const orders = useSeriesOrders(org.id, series.id, list.map((t) => t.id), types.isSuccess);
  const summary = useSummary(org.id);
  const { state: stripe, query: stripeQuery } = useStripe(org.id);
  // The one Connect payments press: Stripe sends the person back to THIS event's Tickets sheet.
  const onboard = useStartOnboarding(org.id, undefined, P3_TICKET_PATHS.eventTickets(series.id));
  // On arrival (`tickets=1`, and `stripe=return|refresh` from Stripe): open the sheet, refetch the Stripe
  // state after a return, and drop the params so a reload or a Back does not do it again.
  const [params, setParams] = useSearchParams();
  const arrived = useRef(false);
  // Remembered before the effect below drops the URL params: the banner and its poll hang off this.
  const [arrivedFromStripe, setArrivedFromStripe] = useState(() => params.get('stripe') === 'return');
  const [connectReturnOn, setConnectReturnOn] = useState(() => params.get('stripe') === 'return');
  const [arrivedRefresh, setArrivedRefresh] = useState(() => params.get('stripe') === 'refresh');
  const stripeConnected = stripe === 'connected';
  // The shared return handler (connectReturn.ts): refetch, then every 3 s for 30 s, or until connected.
  const { phase: returnPhase } = useConnectReturn(connectReturnOn, stripeConnected, () => stripeQuery.refetch());
  const connectReturnPoll = returnPhase === 'checking';
  useEffect(() => {
    if (arrived.current) return;
    const asked = params.get('tickets') === '1';
    const back = params.get('stripe');
    if (!asked && !back) return;
    arrived.current = true;
    if (asked) {
      setView('list');
      setOpen(true);
    }
    if (back === 'refresh') setArrivedRefresh(true);
    if (back === 'return') {
      setArrivedFromStripe(true);
      setConnectReturnOn(true);
    }
    const next = new URLSearchParams(params);
    next.delete('tickets');
    next.delete('stripe');
    setParams(next, { replace: true });
  }, [params, setParams, stripeQuery]);

  const manager = canManage(org.role);
  const seriesLive = series.lifecycle_status === 'live';
  const ctx: MoveContext = { role: org.role, stripe: stripe ?? 'unknown', seriesLive };
  const sales = new Map<string, TypeSales>((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const sold = summary.data?.ok ? new Map([...sales].map(([k, v]) => [k, v.ticketsSold])) : null;
  const why = addWhy(org.role, seriesLive);
  /** This event's types and orders, and this page's sales summary: what a write here can change. */
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketKeys.types(org.id, series.id) }),
      queryClient.invalidateQueries({ queryKey: ticketKeys.orders(org.id, series.id) }),
      queryClient.invalidateQueries({ queryKey: ticketKeys.summary(org.id) }),
    ]);
  const shown = shownOrders(orders.data ?? []);
  const eventStart = eventStartOf(series);
  const typeName = new Map(list.map((t) => [t.id, t.name]));
  const many = list.length > 1;

  const row = types.isSuccess ? ticketsRowOf(list, sold, why) : null;
  const detail = types.isError ? 'Could not load' : row ? row.detail : 'Loading\u2026';

  /**
   * An outcome that lands after its sheet closed (review r1 F1, F2): it never touches the sheet
   * or draft open NOW. A success says so and refreshes; a refusal stays on screen as an alert.
   * The sheet names its subject in the late text (review r2 R2), so it never reads as the open one's.
   */
  const late = (text: string, landed: boolean, savedTypeId?: string) => {
    if (savedTypeId) setMoveError((m) => without(m, savedTypeId));
    if (!landed) {
      const id = ++toastSeq.current;
      setAlerts((a) => [...a, { id, text }]);
      return;
    }
    say(text);
    void refresh().then(refocusTop);
  };

  const openEditor = (type: TicketType | null) => {
    setDraft((held) => draftFor(held, type, eventStart, series));
    setEditing({ type });
  };
  const closeEditor = () => setEditing(null);

  const move = async (t: TicketType, to: TicketStatus) => {
    const with_ = <T,>(m: ReadonlyMap<string, T>, v: T | null) => {
      const n = new Map(m);
      if (v === null) n.delete(t.id);
      else n.set(t.id, v);
      return n;
    };
    setMoving((s) => new Set(s).add(t.id));
    setMoveError((m) => with_(m, null));
    try {
      const out = await setTicketStatus(t.id, to);
      if (out.ok) {
        say(`${t.name}: ${SWITCH_LABEL[to]}`);
        setMoveError((m) => with_(m, null));
        await refresh();
      } else setMoveError((m) => with_(m, reasonMessage(out.reason)));
    } catch (e) {
      // F-11: a refused Selling (onboarding) opens the shared gate sheet and leaves no row error
      setMoveError((m) => with_(m, gated(e, () => reasonMessage(null))));
    } finally {
      setMoving((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
  };

  const banner = types.isSuccess
    ? connectReturnBanner({ arrivedFromStripe, stripe: stripe ?? 'unknown', role: org.role, drafts: list, polling: connectReturnPoll, refresh: arrivedRefresh })
    : null;
  const bannerBusy = list.some((t) => moving.has(t.id));
  const putOnSale = (typeId?: string) => {
    const paid = list.filter((t) => t.status === 'draft' && t.pricePence > 0 && (!typeId || t.id === typeId));
    paid.forEach((t) => void move(t, 'on_sale'));
  };

  const orderRows = (rows: readonly Order[]) => (
    <ul className="p3-list p3-flush">
      {rows.map((o) => {
        const tag = orderTag(o.status);
        return (
          <li key={o.id} className="p3-row p3-order" data-testid={`tix-order-${o.id}`}>
            <div className="p3-grow">
              <div className="p3-row-t" data-testid="tix-order-buyer">{buyerNameOf(o)}</div>
              <div className="p3-row-s" data-testid="tix-order-line">
                {orderLine(o, today)}
                {many ? ` \u00B7 ${typeName.get(o.typeId) ?? ''}` : ''}
              </div>
              <div className="p3-row-tags">
                <span className={TONE_CLASS[tag.tone]} data-testid="tix-order-tag">{tag.label}</span>
              </div>
            </div>
            {manager && refundable(withPendingRefund(o, pendingRefund.get(o.id))) && (
              <button
                type="button"
                className="p3-btn p3-btn-line p3-btn-sm"
                onClick={() => setRefunding(o)}
                disabled={inFlight.has(o.id)}
                aria-busy={inFlight.has(o.id) || undefined}
                data-testid="tix-refund"
              >
                {inFlight.has(o.id) ? 'Refunding\u2026' : 'Refund'}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  const ordersCard = (all: boolean) => {
    if (orders.isPending && orders.fetchStatus !== 'idle') return <p className="p3-note" data-testid="tix-orders-loading">Loading orders&hellip;</p>;
    if (orders.isError) {
      return (
        <div className="p3-state" data-testid="tix-orders-error" role="alert">
          <strong>We could not load the orders.</strong>
          <p>Check your connection, then try again.</p>
          <button type="button" className="p3-btn p3-btn-line" onClick={() => void orders.refetch()}>Try again</button>
        </div>
      );
    }
    if (shown.length === 0) return <p className="p3-note p3-pad-y" data-testid="tix-orders-empty">{noOrdersText(list, manager)}</p>;
    const more = seeAllLabel(shown.length);
    return (
      <>
        {!manager && shown.some(refundable) && <p className="p3-note p3-pad-y" data-testid="tix-refund-reason">{NOT_MANAGER_REFUND}</p>}
        {orderRows(all ? shown : shown.slice(0, PREVIEW_ORDERS))}
        {!all && more && (
          <button type="button" className="p3-link" onClick={() => setView('orders')} data-testid="tix-see-all">{more}</button>
        )}
      </>
    );
  };

  let body;
  if (types.isPending) body = <p className="p3-note" data-testid="tix-types-loading">Loading tickets&hellip;</p>;
  else if (types.isError) {
    body = (
      <div className="p3-card p3-state" data-testid="tix-types-error" role="alert">
        <strong>We could not load the tickets.</strong>
        <p>Check your connection, then try again.</p>
        <button type="button" className="p3-btn p3-btn-line" onClick={() => void types.refetch()}>Try again</button>
      </div>
    );
  } else if (list.length === 0) {
    body = (
      <div className="p3-card p3-state" data-testid="tix-types-empty">
        <strong>No tickets yet</strong>
        {/* The reason sits once, by Add a ticket (or in the role note at the top): review r1 D7, D8. */}
        <p>{why ? 'No tickets on this event yet.' : 'Tap Add a ticket below. Free tickets work straight away; paid ones need payments connected.'}</p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="p3-card p3-tight" data-testid="tix-types">
          <ul className="p3-list p3-flush">
            {list.map((t) => (
              <TypeRow
                key={t.id}
                type={t}
                sales={sales.get(t.id) ?? null}
                ctx={ctx}
                onboard={onboard}
                onCheck={() => void stripeQuery.refetch()}
                busy={moving.has(t.id)}
                error={moveError.get(t.id) ?? null}
                onMove={(to) => void move(t, to)}
                onEdit={() => openEditor(t)}
              />
            ))}
          </ul>
        </div>
        <h4 className="p3-h2 p3-h2-s">Orders</h4>
        <div className="p3-card p3-tight" data-testid="tix-orders">{ordersCard(false)}</div>
      </>
    );
  }

  const addId = `tix-add-why-${series.id}`;
  const roleId = `tix-role-why-${series.id}`;
  const roleWhy = why === NOT_MANAGER;
  const listFooter =
    view === 'list' ? (
      <div className="p3-stack-s">
        <button type="button" className="p3-btn" disabled={!!why} aria-describedby={why ? (roleWhy ? roleId : addId) : undefined} onClick={() => openEditor(null)} data-testid="tix-add">
          Add a ticket
        </button>
        {why && !roleWhy && <p id={addId} className="p3-note" data-testid="tix-add-reason">{why}</p>}
      </div>
    ) : undefined;

  return (
    <>
      <button type="button" className="p3-card p3-status-row" onClick={() => { setView('list'); setOpen(true); }} data-testid="tix-row">
        <span className="p3-grow">
          <span className="p3-row-t">Tickets</span>
          <span className="p3-row-s" data-testid="tix-row-detail">{` \u00B7 ${detail}`}</span>
        </span>
        {row && <span className={TONE_CLASS[row.chip.tone]} data-testid="tix-row-chip">{row.chip.label}</span>}
        <span aria-hidden="true">&rsaquo;</span>
      </button>
      {open && (
        <StackSheet
          full
          title={`${view === 'orders' ? 'Orders' : 'Tickets'} \u00B7 ${series.name}`}
          onClose={() => setOpen(false)}
          onBack={view === 'orders' ? () => setView('list') : undefined}
          footer={listFooter}
          testId="tix-tall"
        >
          {view === 'list' ? (
            <div className="p3-stack-s" data-testid="tix-list-view">
              <p className="p3-note" data-testid="tix-event-rules">
                {eventDateLine(series)}. {buyerRulesLine()}
              </p>
              {!manager && <p id={roleId} className="p3-note" data-testid="tix-readonly">{NOT_MANAGER}</p>}
              {banner && (
                <div className="p3-card p3-stack-s" role="status" data-testid="tix-return-banner" data-kind={banner.kind}>
                  <p className="p3-note" data-testid="tix-return-line">{banner.line}</p>
                  {banner.actions.map((a) => (
                    <button
                      key={`${a.kind}-${a.typeId ?? ''}`}
                      type="button"
                      className="p3-btn"
                      style={{ minHeight: 44 }}
                      disabled={a.kind === 'carry_on' ? onboard.busy : a.kind === 'check' ? false : bannerBusy}
                      aria-busy={(a.kind === 'carry_on' ? onboard.busy : bannerBusy) || undefined}
                      onClick={() => (a.kind === 'carry_on' ? void onboard.go() : a.kind === 'check' ? void stripeQuery.refetch() : putOnSale(a.typeId))}
                      data-testid={`tix-return-${a.kind}`}
                    >
                      {a.label}
                    </button>
                  ))}
                  {banner.actions.some((a) => a.kind === 'carry_on') && onboard.note && (
                    <p role="alert" className="p3-error" data-testid={CONNECT_START_ERROR_SHOWN}>{onboard.note}</p>
                  )}
                </div>
              )}
              {body}
              {types.isSuccess && (
                <Suspense fallback={<p className="p3-note" data-testid="promo-loading">Loading promo codes&hellip;</p>}>
                  <PromoSection organiserId={org.id} seriesId={series.id} onSay={say} onAlert={(text) => late(text, false)} />
                </Suspense>
              )}
            </div>
          ) : (
            <>
            <div className="p3-card p3-tight" data-testid="tix-orders-view">{ordersCard(true)}</div>
            {orders.isSuccess && (
              <Suspense fallback={null}>
                <SalesReport seriesId={series.id} eventName={series.name} types={list} orders={orders.data ?? []} today={today} />
              </Suspense>
            )}
            </>
          )}
        </StackSheet>
      )}
      {open && editing && draft && (
        <TypeSheet
          type={editing.type}
          draft={draft}
          onDraft={setDraft}
          organiserId={org.id}
          seriesId={series.id}
          ctx={ctx}
          eventStart={eventStart}
          series={series}
          onboard={onboard}
          onCheck={() => void stripeQuery.refetch()}
          hasOrders={hasOrdersOf(editing.type, sales, orders.data ?? [])}
          checking={!!editing.type && (summary.isPending || orders.isPending)}
          onClose={(saving) => {
            closeEditor();
            // Closed mid-save: the save lands on its own (toast); the draft must not be sent again.
            if (saving) setDraft(null);
          }}
          onLate={late}
          onSaved={(text, changed) => {
            // Only the saved type's switch reason is stale; another row's refusal stays (review r2 R4).
            const saved = editing.type?.id;
            setEditing(null);
            setDraft(null);
            say(text);
            if (changed) {
              if (saved) setMoveError((m) => without(m, saved));
              void refresh();
            }
          }}
        />
      )}
      {open && refunding && (
        <RefundSheet
          order={withPendingRefund(refunding, pendingRefund.get(refunding.id))}
          typeName={many ? typeName.get(refunding.typeId) ?? null : null}
          today={today}
          onClose={() => setRefunding(null)}
          onLate={late}
          onStart={() => flight(refunding.id, true)}
          onSettled={() => flight(refunding.id, false)}
          onSent={(p) => noteSent(refunding, p)}
          getKeys={() => keysOf(`${refunding.id}:${refunding.refundedPence}`)}
          setKey={(p, k) => holdKey(`${refunding.id}:${refunding.refundedPence}`, p, k)}
          onDone={(text) => {
            setRefunding(null);
            say(text);
            void refresh().then(refocusTop);
          }}
        />
      )}
      {/*
        Rendered after the sheets, outside their aria-modal dialogs (review r2 R6, kept): the
        alert is announced as a live region and Tab reaches Dismiss (no focus trap), but a screen
        reader that confines browse mode to the dialog reaches Dismiss only once the sheet closes.
        Each toast is its own node, keyed, so an alert is never a status node changing role (R7).
      */}
      {(status !== null || alerts.length > 0) && (
        <div className="p3-toast-stack">
          {alerts.map((a) => <TicketToast key={`alert-${a.id}`} text={a.text} alert onClose={() => dismiss(a.id)} />)}
          {status !== null && <TicketToast key={`status-${status.id}`} text={status.text} alert={false} onClose={closeStatus} />}
        </div>
      )}
    </>
  );
}

const without = <V,>(m: ReadonlyMap<string, V>, k: string) => {
  const n = new Map(m);
  n.delete(k);
  return n;
};

function TicketToast({ text, alert, onClose }: { text: string; alert: boolean; onClose: () => void }) {
  useEffect(() => {
    if (alert) return;
    const t = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(t);
  }, [text, alert, onClose]);
  return (
    <div className="p3-toast" role={alert ? 'alert' : 'status'} data-testid="tix-toast">
      <span>{text}</span>
      {alert && <button type="button" className="p3-link p3-toast-act" onClick={onClose} data-testid="tix-toast-dismiss">Dismiss</button>}
    </div>
  );
}

/** One ticket type: name and counts (tap to edit), and the Selling switch. */
function TypeRow({
  type: t,
  sales,
  ctx,
  onboard,
  onCheck,
  busy,
  error,
  onMove,
  onEdit,
}: {
  type: TicketType;
  sales: TypeSales | null;
  ctx: MoveContext;
  onboard: { go: () => Promise<void>; busy: boolean; note: string | null; switchedOff: boolean };
  onCheck: () => void;
  busy: boolean;
  error: string | null;
  onMove: (to: TicketStatus) => void;
  onEdit: () => void;
}) {
  const id = useId();
  const to = switchMove(t.status);
  const blocked = to ? moveBlock(t, to, ctx) : null;
  // The role reason is said once at the top of the sheet, not under every row.
  // A paid draft with payments not connected: the Connect payments block replaces the "go to Get paid" reason.
  const connect = to === 'on_sale' && t.status === 'draft' ? connectBlock(t.pricePence, ctx, onboard) : null;
  const shownReason = blocked && blocked !== NOT_MANAGER && !(connect && blocked === connect.replaces) ? blocked : null;
  return (
    <li className="p3-row p3-row-col" data-testid={`tix-type-${t.id}`} data-status={t.status}>
      <div className="p3-type">
        <button type="button" className="p3-date-btn p3-grow" onClick={onEdit} data-testid="tix-edit">
          <span className="p3-grow">
            <span className="p3-row-t p3-block">{t.name}</span>
            <span className="p3-row-s" data-testid="tix-type-line">
              {priceLabel(t.pricePence)} &middot; {countsLine(sales ? sales.ticketsSold : null, leftOf(t))}
            </span>
          </span>
        </button>
        {to ? (
          <span className="p3-switch-wrap">
            <span id={`${id}-l`} className="p3-row-s" data-testid="tix-switch-label">{SWITCH_LABEL[t.status]}</span>
            <button
              type="button"
              role="switch"
              aria-checked={t.status === 'on_sale'}
              aria-labelledby={`${id}-l`}
              aria-describedby={shownReason ? `${id}-why` : undefined}
              aria-busy={busy || undefined}
              disabled={!!blocked || busy}
              onClick={() => onMove(to)}
              className="p3-switch"
              data-testid="tix-switch"
            >
              <i aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className={TONE_CLASS.neutral} data-testid="tix-type-closed">{SWITCH_LABEL.closed}</span>
        )}
      </div>
      {shownReason && <p id={`${id}-why`} className="p3-note" data-testid="tix-switch-reason"><ReasonText text={shownReason} /></p>}
      {connect && blocked === connect.replaces && (
        <div className="p3-stack-s" data-testid="tix-connect">
          <p className="p3-note" data-testid="tix-connect-line">{connect.line}</p>
          <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={() => (connect.kind === 'check' ? onCheck() : void onboard.go())} disabled={connect.kind === 'check' ? false : onboard.busy} aria-busy={(connect.kind !== 'check' && onboard.busy) || undefined} data-testid="tix-connect-btn">
            {connect.button}
          </button>
          {connect.kind === 'check' ? (
            <button type="button" className="p3-link" style={{ minHeight: 44, textAlign: 'left' }} onClick={() => void onboard.go()} disabled={onboard.busy} data-testid="tix-connect-open">{OPEN_STRIPE_LABEL}</button>
          ) : (
            <SellingElsewhere seriesId={t.seriesId} />
          )}
          {connect.error && <p role="alert" className="p3-error" data-testid={CONNECT_START_ERROR_SHOWN}>{connect.error}</p>}
        </div>
      )}
      {error && <p role="alert" className="p3-error" data-testid="tix-move-error">{error}</p>}
    </li>
  );
}
