import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { londonDateKey } from '@/lib/londonDate';
import { OrganiserShell } from '../shell/OrganiserShell';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { AnnounceRegion, Card, EmptyState, ErrorState, GhostButton, PrimaryButton, SkeletonRows, StatusTag, useAnnounce, useOpenerRef } from '../ui';
import { LINK, Reason, SellingSwitch, eventDateLine, useSalesSummary, useStripeState } from './parts';
import { RefundSheet } from './RefundSheet';
import { TypeSheet } from './TypeSheet';
import { TICKET_PATHS } from './paths';
import { fetchOrders, fetchSeriesTypes, setTicketStatus, ticketKeys } from './ticketsApi';
import {
  BOOKING_FEE_PENCE,
  MAX_PER_ORDER,
  NOT_MANAGER,
  NOT_MANAGER_REFUND,
  SHOWN_ORDER,
  SWITCH_LABEL,
  buyerNameOf,
  canManage,
  countsLine,
  eventStartOf,
  feeLabel,
  leftOf,
  moveBlock,
  orderLine,
  orderTag,
  priceLabel,
  reasonMessage,
  refundable,
  switchMove,
  type MemberRole,
  type MoveContext,
  type Order,
  type TicketStatus,
  type TicketType,
  type TypeSales,
} from './ticketModel';

/** Why "Add a ticket" is disabled, or null. */
export const addBlock = (role: MemberRole, seriesLive: boolean): string | null =>
  !canManage(role) ? NOT_MANAGER : !seriesLive ? 'Put this event live before adding tickets.' : null;

/**
 * /account/tickets/events/:seriesId (mockup B): one row per ticket type with its Selling
 * switch, then the event's orders by buyer name with Refund (owner / manager only).
 * `?add=1` opens the add sheet on arrival (Home's Add tickets).
 */
export default function SeriesTickets() {
  const { seriesId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { home, selected } = useOrganiserChoice();
  const organiserId = selected?.id;
  const series = selected?.series.find((s) => s.id === seriesId) ?? null;
  const queryClient = useQueryClient();
  const [message, announce] = useAnnounce();
  const [editing, setEditing] = useState<{ type: TicketType | null } | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<{ id: string; text: string } | null>(null);
  // The sheets mount on tap, so the opener is remembered here (B-S8 focus return).
  const editOpener = useOpenerRef(editing !== null);
  const refundOpener = useOpenerRef(refunding !== null);

  const types = useQuery({
    queryKey: ticketKeys.types(organiserId, seriesId),
    queryFn: () => fetchSeriesTypes(organiserId as string, seriesId),
    enabled: !!organiserId && !!series,
  });
  const typeIds = (types.data ?? []).map((t) => t.id);
  const orders = useQuery({
    queryKey: [...ticketKeys.orders(organiserId, seriesId), typeIds.join(',')],
    queryFn: () => fetchOrders(typeIds),
    enabled: types.isSuccess && typeIds.length > 0,
  });
  const summary = useSalesSummary(organiserId);
  const { state: stripe } = useStripeState(organiserId);

  const role = selected?.role ?? null;
  const seriesLive = series?.lifecycle_status === 'live';
  const blockedAdd = addBlock(role ?? '', seriesLive);
  // Home's Add tickets: open the sheet once the page is known, then drop the flag from the URL.
  const wantsAdd = params.get('add') === '1';
  const [addHandled, setAddHandled] = useState(false);
  if (wantsAdd && series && !addHandled) {
    // Adjusting state while rendering (not in an effect): the sheet opens on the first paint.
    setAddHandled(true);
    if (!blockedAdd) setEditing({ type: null });
  }
  useEffect(() => {
    if (!wantsAdd || !series) return;
    const next = new URLSearchParams(params);
    next.delete('add');
    setParams(next, { replace: true });
  }, [wantsAdd, series, params, setParams]);

  const shell = (children: ReactNode, footer?: ReactNode) => (
    <OrganiserShell
      title={series?.name ?? 'Tickets'}
      back={{ to: TICKET_PATHS.home(organiserId), label: 'Tickets' }}
      testId="tix-event"
      actionBar={footer}
    >
      <div className="space-y-[12px]">{children}</div>
      <AnnounceRegion message={message} />
    </OrganiserShell>
  );
  if (home.isLoading) return shell(<SkeletonRows count={3} label="Loading" />);
  if (home.isError) return shell(<ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} />);
  if (!selected || !series) {
    return shell(
      <EmptyState
        testId="tix-event-missing"
        title="This event is not on this page"
        body="Pick the event again from your ticket home."
        action={<Link to={TICKET_PATHS.home(organiserId)} className={LINK}>Back to tickets</Link>}
      />,
    );
  }
  const manager = canManage(selected.role);
  const ctx: MoveContext = { role: selected.role, stripe: stripe ?? 'unknown', seriesLive };
  const sales = new Map<string, TypeSales>((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ticketKeys.all });
  const list = types.data ?? [];

  const move = async (t: TicketType, to: TicketStatus) => {
    setMoving(t.id);
    setMoveError(null);
    try {
      const out = await setTicketStatus(t.id, to);
      if (out.ok) {
        announce(`${t.name}: ${SWITCH_LABEL[to]}`);
        await refresh();
      } else setMoveError({ id: t.id, text: reasonMessage(out.reason) });
    } catch {
      setMoveError({ id: t.id, text: reasonMessage(null) });
    } finally {
      setMoving(null);
    }
  };

  let body: ReactNode;
  if (types.isLoading) body = <SkeletonRows count={3} label="Loading tickets" />;
  else if (types.isError) body = <ErrorState quiet onRetry={() => void types.refetch()} retrying={types.isFetching} />;
  else if (list.length === 0) {
    body = (
      <EmptyState
        testId="tix-types-empty"
        title="No tickets yet"
        body={blockedAdd ? `No tickets on this event yet. ${blockedAdd}` : 'Tap Add a ticket below. Free tickets work straight away; paid ones need payments connected.'}
      />
    );
  } else {
    body = (
      <>
        <Card label="Tickets" testId="tix-types">
          {list.map((t) => (
            <TypeRow
              key={t.id}
              type={t}
              sales={sales.get(t.id) ?? null}
              ctx={ctx}
              busy={moving === t.id}
              error={moveError?.id === t.id ? moveError.text : null}
              onMove={(to) => void move(t, to)}
              onEdit={() => setEditing({ type: t })}
            />
          ))}
        </Card>
        <OrdersCard
          orders={orders.data ?? []}
          loading={orders.isLoading}
          failed={orders.isError}
          onRetry={() => void orders.refetch()}
          retrying={orders.isFetching}
          types={list}
          manager={manager}
          onRefund={setRefunding}
        />
      </>
    );
  }

  const footer = <AddBar blocked={blockedAdd} onAdd={() => setEditing({ type: null })} />;

  return shell(
    <>
      <p className="text-[13px] text-[var(--mut)]" data-testid="tix-event-rules">
        {eventDateLine(series)}. Buyers pay a {feeLabel(BOOKING_FEE_PENCE)} booking fee per paid ticket, up to {MAX_PER_ORDER} tickets an order.
      </p>
      {!manager && <p className="text-[13px] text-[var(--mut)]" data-testid="tix-readonly">{NOT_MANAGER}</p>}
      {body}
      {editing && (
        <TypeSheet
          open
          onOpenChange={(o) => !o && setEditing(null)}
          type={editing.type}
          organiserId={selected.id}
          seriesId={series.id}
          ctx={ctx}
          eventStart={eventStartOf(series)}
          hasOrders={hasOrders(editing.type, sales, orders.data ?? [])}
          returnFocusRef={editOpener}
          onSaved={(text) => {
            setEditing(null);
            announce(text);
            void refresh();
          }}
        />
      )}
      {refunding && (
        <RefundSheet
          order={refunding}
          returnFocusRef={refundOpener}
          onClose={() => setRefunding(null)}
          onDone={(text) => {
            setRefunding(null);
            announce(text);
            void refresh();
          }}
        />
      )}
    </>,
    footer,
  );
}

/** The server freezes the price once ANY order row exists (pending and expired included). */
export const hasOrders = (t: TicketType | null, sales: Map<string, TypeSales>, orders: readonly Order[]): boolean => {
  // orders holds every status (fetchOrders), expired included.
  if (!t) return false;
  const s = sales.get(t.id);
  const counted = s ? s.ordersPaid + s.ordersPending + s.ordersRefunded + s.ordersDisputed > 0 : false;
  return counted || t.reserved > 0 || orders.some((o) => o.typeId === t.id);
};

function AddBar({ blocked, onAdd }: { blocked: string | null; onAdd: () => void }) {
  const id = useId();
  return (
    <div className="space-y-[4px] px-[16px] py-[8px]">
      <PrimaryButton block testId="tix-add" disabled={!!blocked} aria-describedby={blocked ? id : undefined} onClick={onAdd}>
        Add a ticket
      </PrimaryButton>
      <Reason id={id} testId="tix-add-reason">{blocked}</Reason>
    </div>
  );
}

/** One ticket type: name and counts (tap to edit), and the Selling switch. */
export function TypeRow({
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
  const blocked = to ? moveBlock(t, to, ctx) : null;
  // The role reason is said once at the top of the page, not under every row.
  const shownReason = blocked && blocked !== NOT_MANAGER ? blocked : null;
  return (
    <div className="space-y-[4px] px-[16px] py-[8px]" data-testid={`tix-type-${t.id}`} data-status={t.status}>
      <div className="flex items-center gap-[12px]">
        <button type="button" className="min-h-[44px] min-w-0 flex-1 text-left" onClick={onEdit} data-testid="tix-edit">
          <span className="block truncate text-[15px] font-semibold">{t.name}</span>
          <span className="block text-[13px] text-[var(--mut)]" data-testid="tix-type-line">
            {priceLabel(t.pricePence)} &middot; {countsLine(sales ? sales.ticketsSold : null, leftOf(t))}
          </span>
        </button>
        {/* Name the reason only when it is rendered under this row (the role one is at the top). */}
        <SellingSwitch status={t.status} blocked={blocked} busy={busy} onMove={onMove} reasonId={shownReason ? `${id}-why` : undefined} />
      </div>
      <Reason id={`${id}-why`} testId="tix-switch-reason">{shownReason}</Reason>
      {error && (
        <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid="tix-move-error">
          {error}
        </p>
      )}
    </div>
  );
}

function OrdersCard({
  orders,
  loading,
  failed,
  onRetry,
  retrying,
  types,
  manager,
  onRefund,
}: {
  orders: readonly Order[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  retrying: boolean;
  types: readonly TicketType[];
  manager: boolean;
  onRefund: (o: Order) => void;
}) {
  if (loading) return <Card label="Orders"><SkeletonRows count={2} label="Loading orders" /></Card>;
  if (failed) {
    return (
      <Card label="Orders" variant="padded" testId="tix-orders">
        <ErrorState quiet title="We could not load the orders." onRetry={onRetry} retrying={retrying} />
      </Card>
    );
  }
  const shown = orders
    .filter((o) => SHOWN_ORDER.includes(o.status))
    .slice()
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
  if (shown.length === 0) {
    const selling = types.some((t) => t.status === 'on_sale');
    return (
      <Card label="Orders" variant="padded" testId="tix-orders">
        <p className="text-[13px] text-[var(--mut)]" data-testid="tix-orders-empty">
          {selling ? 'No orders yet. They show here, by buyer name, the moment someone buys.' : 'No orders yet. Switch a ticket to Selling above so people can buy.'}
        </p>
      </Card>
    );
  }
  const today = londonDateKey(new Date());
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const many = types.length > 1;
  return (
    <Card label="Orders" testId="tix-orders">
      {!manager && shown.some(refundable) && (
        <p className="px-[16px] py-[8px] text-[13px] text-[var(--mut)]" data-testid="tix-refund-reason">{NOT_MANAGER_REFUND}</p>
      )}
      {shown.map((o) => {
        const tag = orderTag(o.status);
        return (
          <div key={o.id} className="flex min-h-[56px] items-center gap-[8px] px-[16px] py-[8px]" data-testid={`tix-order-${o.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold" data-testid="tix-order-buyer">{buyerNameOf(o)}</p>
              <p className="truncate text-[13px] text-[var(--mut)]" data-testid="tix-order-line">
                {orderLine(o, today)}
                {many ? ` \u00B7 ${typeName.get(o.typeId) ?? ''}` : ''}
              </p>
            </div>
            {manager && refundable(o) ? (
              <GhostButton size="sm" block={false} className="shrink-0 px-[14px] text-[var(--warn-fg)]" testId="tix-refund" onClick={() => onRefund(o)}>
                Refund
              </GhostButton>
            ) : (
              <StatusTag tone={tag.tone} testId="tix-order-tag">{tag.label}</StatusTag>
            )}
          </div>
        );
      })}
    </Card>
  );
}
