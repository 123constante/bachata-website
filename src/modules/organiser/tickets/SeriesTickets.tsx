import { useId, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OrganiserShell } from '../shell/OrganiserShell';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { AnnounceRegion, Card, EmptyState, ErrorState, GhostButton, PrimaryButton, SkeletonRows, StatusTag, useAnnounce } from '../ui';
import { Reason, useSalesSummary, useStripeState } from './parts';
import { RefundSheet } from './RefundSheet';
import { TypeSheet } from './TypeSheet';
import { TICKET_PATHS } from './paths';
import { fetchOrders, fetchSeriesTypes, setTicketStatus, ticketKeys } from './ticketsApi';
import {
  MAX_PER_ORDER,
  MOVE_LABEL,
  NEXT_STATUS,
  NOT_MANAGER,
  STATUS_LABEL,
  STATUS_TONE,
  canManage,
  editLock,
  formatPence,
  moveBlock,
  orderTag,
  priceLabel,
  reasonMessage,
  refundBlock,
  refundable,
  soldLine,
  windowLine,
  type MemberRole,
  type Order,
  type StripeState,
  type TicketStatus,
  type TicketType,
  type TypeSales,
} from './ticketModel';

const LINK = 'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--gold)]';

/** Why "Add a ticket type" is disabled, or null. */
export const addBlock = (role: MemberRole, seriesLive: boolean): string | null =>
  !canManage(role) ? NOT_MANAGER : !seriesLive ? 'Put this event live before adding tickets.' : null;

/** /account/tickets/events/:seriesId: the event's ticket types, their status moves, and paid orders with Refund. */
export default function SeriesTickets() {
  const { seriesId = '' } = useParams();
  const { home, selected } = useOrganiserChoice();
  const organiserId = selected?.id;
  const series = selected?.series.find((s) => s.id === seriesId) ?? null;
  const queryClient = useQueryClient();
  const [message, announce] = useAnnounce();
  const [editing, setEditing] = useState<{ type: TicketType | null } | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<{ id: string; text: string } | null>(null);

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
  const role = selected.role;
  const seriesLive = series.lifecycle_status === 'live';
  const blockedAdd = addBlock(role, seriesLive);
  const sales = new Map<string, TypeSales>((summary.data?.ok ? summary.data.types : []).map((t) => [t.id, t]));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ticketKeys.all });

  const move = async (t: TicketType, to: TicketStatus) => {
    setMoving(`${t.id}:${to}`);
    setMoveError(null);
    try {
      const out = await setTicketStatus(t.id, to);
      if (out.ok) {
        announce(`${t.name}: ${STATUS_LABEL[to]}`);
        await refresh();
      } else setMoveError({ id: t.id, text: reasonMessage(out.reason) });
    } catch {
      setMoveError({ id: t.id, text: reasonMessage(null) });
    } finally {
      setMoving(null);
    }
  };

  const footer = (
    <AddBar blocked={blockedAdd} onAdd={() => setEditing({ type: null })} />
  );

  let body: ReactNode;
  if (types.isLoading) body = <SkeletonRows count={3} label="Loading tickets" />;
  else if (types.isError) body = <ErrorState quiet onRetry={() => void types.refetch()} retrying={types.isFetching} />;
  else if ((types.data ?? []).length === 0) {
    body = (
      <EmptyState
        testId="tix-types-empty"
        title="No tickets yet"
        body={
          blockedAdd
            ? `No tickets on this event yet. ${blockedAdd}`
            : 'Add a ticket type to start selling. Free tickets work straight away; paid ones need Get paid set up.'
        }
      />
    );
  } else {
    body = (types.data ?? []).map((t) => (
      <TypeCard
        key={t.id}
        type={t}
        sales={sales.get(t.id) ?? null}
        orders={(orders.data ?? []).filter((o) => o.typeId === t.id)}
        ordersLoading={orders.isLoading}
        role={role}
        stripe={stripe ?? 'none'}
        moving={moving}
        error={moveError?.id === t.id ? moveError.text : null}
        onMove={(to) => void move(t, to)}
        onEdit={() => setEditing({ type: t })}
        onRefund={setRefunding}
      />
    ));
  }

  return shell(
    <>
      <p className="text-[13px] text-[var(--mut)]" data-testid="tix-event-rules">
        Buyers pay a 50p booking fee per paid ticket and can buy up to {MAX_PER_ORDER} tickets in one order.
      </p>
      {body}
      {editing && (
        <TypeSheet
          open
          onOpenChange={(o) => !o && setEditing(null)}
          type={editing.type}
          organiserId={selected.id}
          seriesId={series.id}
          role={role}
          hasOrders={hasOrders(editing.type, sales, orders.data ?? [])}
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
        Add a ticket type
      </PrimaryButton>
      <Reason id={id} testId="tix-add-reason">{blocked}</Reason>
    </div>
  );
}

export function TypeCard({
  type: t,
  sales,
  orders,
  ordersLoading,
  role,
  stripe,
  moving,
  error,
  onMove,
  onEdit,
  onRefund,
}: {
  type: TicketType;
  sales: TypeSales | null;
  orders: readonly Order[];
  ordersLoading: boolean;
  role: MemberRole;
  stripe: StripeState;
  moving: string | null;
  error: string | null;
  onMove: (to: TicketStatus) => void;
  onEdit: () => void;
  onRefund: (o: Order) => void;
}) {
  const baseId = useId();
  const sold = sales?.ticketsSold ?? 0;
  const moves = NEXT_STATUS[t.status];
  const editBlocked = editLock(t, role);
  return (
    <Card testId={`tix-type-${t.id}`} data-status={t.status} variant="padded">
      <div className="space-y-[8px]">
        <div className="flex items-start justify-between gap-[8px]">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{t.name}</p>
            <p className="text-[14px] text-[var(--mut)]" data-testid="tix-type-line">
              {priceLabel(t.pricePence)} &middot; {soldLine(sold, t.capacity)}
            </p>
            <p className="text-[13px] text-[var(--mut)]">{windowLine(t.salesOpenAt, t.salesCloseAt)}</p>
          </div>
          <StatusTag tone={STATUS_TONE[t.status]} testId="tix-type-status">{STATUS_LABEL[t.status]}</StatusTag>
        </div>
        <div className="grid grid-cols-2 gap-[8px]">
          {moves.map((to) => {
            const blocked = moveBlock(t, to, { role, stripe });
            return (
              <div key={to} className="space-y-[2px]">
                <GhostButton
                  size="sm"
                  block
                  testId={`tix-move-${to}`}
                  disabled={!!blocked || moving !== null}
                  loading={moving === `${t.id}:${to}`}
                  aria-describedby={blocked ? `${baseId}-${to}` : undefined}
                  onClick={() => onMove(to)}
                >
                  {MOVE_LABEL[to]}
                </GhostButton>
                <Reason id={`${baseId}-${to}`} testId={`tix-move-${to}-reason`}>{blocked}</Reason>
              </div>
            );
          })}
          <div className="space-y-[2px]">
            <GhostButton size="sm" block testId="tix-edit" disabled={!!editBlocked} aria-describedby={editBlocked ? `${baseId}-edit` : undefined} onClick={onEdit}>
              Edit
            </GhostButton>
            <Reason id={`${baseId}-edit`} testId="tix-edit-reason">{editBlocked}</Reason>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-[var(--err,#f87171)]" data-testid="tix-move-error">
            {error}
          </p>
        )}
        {t.status === 'closed' && (
          <p className="text-[13px] text-[var(--mut)]" data-testid="tix-closed-note">
            Closed for good. Add a new ticket type to sell more.
          </p>
        )}
        <Orders orders={orders} loading={ordersLoading} role={role} onRefund={onRefund} />
      </div>
    </Card>
  );
}

function Orders({ orders, loading, role, onRefund }: { orders: readonly Order[]; loading: boolean; role: MemberRole; onRefund: (o: Order) => void }) {
  const id = useId();
  if (loading) return <SkeletonRows count={1} label="Loading orders" />;
  if (orders.length === 0) {
    return (
      <p className="text-[13px] text-[var(--mut)]" data-testid="tix-orders-empty">
        No orders yet. Orders show here once someone buys.
      </p>
    );
  }
  const blocked = refundBlock(role);
  return (
    <div className="space-y-[4px] border-t border-[var(--line)] pt-[8px]" data-testid="tix-orders">
      <p className="text-[13px] font-semibold text-[var(--mut)]">Orders</p>
      <Reason id={id} testId="tix-refund-reason">{orders.some(refundable) ? blocked : null}</Reason>
      {orders.map((o) => {
        const tag = orderTag(o.status);
        return (
          <div key={o.id} className="flex min-h-[44px] items-center gap-[8px]" data-testid={`tix-order-${o.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px]">{o.buyerName ?? 'A buyer'}</p>
              <p className="text-[13px] text-[var(--mut)]">
                {o.quantity} {o.quantity === 1 ? 'ticket' : 'tickets'} &middot; {formatPence(o.totalPence)}
              </p>
            </div>
            {refundable(o) ? (
              <GhostButton size="sm" testId="tix-refund" disabled={!!blocked} aria-describedby={blocked ? id : undefined} onClick={() => onRefund(o)}>
                Refund
              </GhostButton>
            ) : (
              <StatusTag tone={tag.tone} testId="tix-order-tag">{tag.label}</StatusTag>
            )}
          </div>
        );
      })}
    </div>
  );
}
