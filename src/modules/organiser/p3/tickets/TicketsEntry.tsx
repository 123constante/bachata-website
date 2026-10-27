import { useCallback, useEffect, useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { londonTodayKey } from '@/lib/londonDate';
import { setTicketStatus, ticketKeys } from '../../tickets/ticketsApi';
import {
  BOOKING_FEE_PENCE,
  MAX_PER_ORDER,
  NOT_MANAGER,
  NOT_MANAGER_REFUND,
  SWITCH_LABEL,
  buyerNameOf,
  canManage,
  countsLine,
  eventStartOf,
  feeLabel,
  leftOf,
  orderLine,
  orderTag,
  priceLabel,
  refundable,
  switchMove,
  type MoveContext,
  type Order,
  type TicketStatus,
  type TicketType,
  type TypeSales,
} from '../../tickets/ticketModel';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import type { HomeSeriesFull } from '../../shared/homeModel';
import { organiserOfSeries, useP3Home, useSeriesOrders, useSeriesTypes, useStripe, useSummary } from './data';
import {
  PREVIEW_ORDERS,
  TONE_CLASS,
  addWhy,
  draftFor,
  eventDateLine,
  hasOrdersOf,
  noOrdersText,
  p3MoveBlock,
  p3Reason,
  seeAllLabel,
  shownOrders,
  ticketsRowOf,
  type TypeDraft,
} from './model';
import { RefundSheet } from './RefundSheet';
import { StackSheet, refocusTop } from './StackSheet';
import { TypeSheet } from './TypeSheet';

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

function Entry({ org, series }: { org: HomeOrganiser; series: HomeSeriesFull }) {
  const queryClient = useQueryClient();
  const today = londonTodayKey();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<{ type: TicketType | null } | null>(null);
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
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
  // A refusal that lands after its sheet closed is an alert that stays until dismissed (review r1 F3).
  const [toast, setToast] = useState<{ text: string; alert: boolean } | null>(null);
  const say = useCallback((text: string) => setToast({ text, alert: false }), [setToast]);
  const closeToast = useCallback(() => setToast(null), [setToast]);

  const types = useSeriesTypes(org.id, series.id);
  const list = types.data ?? [];
  const orders = useSeriesOrders(org.id, series.id, list.map((t) => t.id), types.isSuccess);
  const summary = useSummary(org.id);
  const { state: stripe } = useStripe(org.id);

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
   */
  const late = (text: string, landed: boolean) => {
    setToast({ text, alert: !landed });
    if (landed) void refresh().then(refocusTop);
  };

  const openEditor = (type: TicketType | null) => {
    setDraft((held) => draftFor(held, type, eventStart));
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
      } else setMoveError((m) => with_(m, p3Reason(out.reason)));
    } catch {
      setMoveError((m) => with_(m, p3Reason(null)));
    } finally {
      setMoving((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
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
            {manager && refundable(o) && (
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
        <p>{why ? `No tickets on this event yet. ${why}` : 'Tap Add a ticket below. Free tickets work straight away; paid ones need payments connected.'}</p>
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
                busy={moving.has(t.id)}
                error={moveError.get(t.id) ?? null}
                onMove={(to) => void move(t, to)}
                onEdit={() => openEditor(t)}
              />
            ))}
          </ul>
        </div>
        <h4 className="p3-h2">Orders</h4>
        <div className="p3-card p3-tight" data-testid="tix-orders">{ordersCard(false)}</div>
      </>
    );
  }

  const addId = `tix-add-why-${series.id}`;
  const listFooter =
    view === 'list' ? (
      <div className="p3-stack-s">
        <button type="button" className="p3-btn" disabled={!!why} aria-describedby={why ? addId : undefined} onClick={() => openEditor(null)} data-testid="tix-add">
          Add a ticket
        </button>
        {why && list.length > 0 && <p id={addId} className="p3-note" data-testid="tix-add-reason">{why}</p>}
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
                {eventDateLine(series)}. Buyers pay a {feeLabel(BOOKING_FEE_PENCE)} booking fee per paid ticket, up to {MAX_PER_ORDER} tickets an order.
              </p>
              {!manager && <p className="p3-note" data-testid="tix-readonly">{NOT_MANAGER}</p>}
              {body}
            </div>
          ) : (
            <div className="p3-card p3-tight" data-testid="tix-orders-view">{ordersCard(true)}</div>
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
          hasOrders={hasOrdersOf(editing.type, sales, orders.data ?? [])}
          onClose={(saving) => {
            closeEditor();
            // Closed mid-save: the save lands on its own (toast); the draft must not be sent again.
            if (saving) setDraft(null);
          }}
          onLate={late}
          onSaved={(text, changed) => {
            setEditing(null);
            setDraft(null);
            say(text);
            if (changed) {
              setMoveError(new Map());
              void refresh();
            }
          }}
        />
      )}
      {open && refunding && (
        <RefundSheet
          order={refunding}
          typeName={many ? typeName.get(refunding.typeId) ?? null : null}
          today={today}
          onClose={() => setRefunding(null)}
          onLate={late}
          onStart={() => flight(refunding.id, true)}
          onSettled={() => flight(refunding.id, false)}
          onDone={(text) => {
            setRefunding(null);
            say(text);
            void refresh().then(refocusTop);
          }}
        />
      )}
      {toast && <TicketToast text={toast.text} alert={toast.alert} onClose={closeToast} />}
    </>
  );
}

function TicketToast({ text, alert, onClose }: { text: string; alert: boolean; onClose: () => void }) {
  useEffect(() => {
    if (alert) return;
    const t = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(t);
  }, [text, alert, onClose]);
  return (
    <div className="p3-toast p3-toast-top" role={alert ? 'alert' : 'status'} data-testid="tix-toast">
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
  busy,
  error,
  onMove,
  onEdit,
}: {
  type: TicketType;
  sales: TypeSales | null;
  ctx: MoveContext;
  busy: boolean;
  error: string | null;
  onMove: (to: TicketStatus) => void;
  onEdit: () => void;
}) {
  const id = useId();
  const to = switchMove(t.status);
  const blocked = to ? p3MoveBlock(t, to, ctx) : null;
  // The role reason is said once at the top of the sheet, not under every row.
  const shownReason = blocked && blocked !== NOT_MANAGER ? blocked : null;
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
      {shownReason && <p id={`${id}-why`} className="p3-note" data-testid="tix-switch-reason">{shownReason}</p>}
      {error && <p role="alert" className="p3-error" data-testid="tix-move-error">{error}</p>}
    </li>
  );
}
