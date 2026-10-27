import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, GhostButton, PrimaryButton, SkeletonRows, StatusTag, SummaryRow } from '../ui';
import { fetchSalesSummary, fetchStripeAccount, startOnboarding, ticketKeys } from './ticketsApi';
import {
  NOT_MANAGER_STRIPE,
  NOT_SWITCHED_ON,
  STRIPE_COPY,
  canManage,
  formatPence,
  reasonMessage,
  stripeStateOf,
  totalsOf,
  type MemberRole,
  type StripeState,
} from './ticketModel';
import { TICKET_PATHS } from './paths';

/** The reason under a disabled control, named by it (aria-describedby). */
export function Reason({ id, children, testId }: { id: string; children: string | null; testId?: string }) {
  if (!children) return null;
  return (
    <p id={id} data-testid={testId} className="text-[13px] text-[var(--mut)]">
      {children}
    </p>
  );
}

export function useStripeState(organiserId: string | undefined) {
  const q = useQuery({
    queryKey: ticketKeys.stripe(organiserId),
    queryFn: () => fetchStripeAccount(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
  const state: StripeState | null = q.isSuccess ? stripeStateOf(q.data) : null;
  return { query: q, state };
}

export function useSalesSummary(organiserId: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.summary(organiserId),
    queryFn: () => fetchSalesSummary(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
}

/** Get paid: Stripe Connect state and the one button that starts or finishes onboarding. */
export function GetPaidCard({
  organiserId,
  role,
  back,
  primary,
}: {
  organiserId: string;
  role: MemberRole;
  /** `?stripe=` on arrival: the person is back from Stripe. */
  back: 'return' | 'refresh' | null;
  /** The screen's one primary button (Home has no other). */
  primary: boolean;
}) {
  const { query, state } = useStripeState(organiserId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const reasonId = useId();
  if (query.isLoading) return <Card label="Get paid"><SkeletonRows count={1} label="Loading payment set-up" /></Card>;
  if (query.isError || !state) {
    return (
      <Card label="Get paid" variant="padded" testId="tix-getpaid">
        <ErrorState quiet title="We could not read your payment set-up." onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </Card>
    );
  }
  const copy = STRIPE_COPY[state];
  const blocked = canManage(role) ? null : NOT_MANAGER_STRIPE;
  const go = async () => {
    setBusy(true);
    setNote(null);
    const origin = window.location.origin;
    const out = await startOnboarding(
      organiserId,
      TICKET_PATHS.stripeBack(origin, organiserId, 'return'),
      TICKET_PATHS.stripeBack(origin, organiserId, 'refresh'),
    );
    if (out.kind === 'ok') {
      window.location.assign(out.value);
      return;
    }
    setBusy(false);
    setNote(out.kind === 'not_configured' ? NOT_SWITCHED_ON : reasonMessage(out.reason));
  };
  const Button = primary ? PrimaryButton : GhostButton;
  const backNote =
    back === 'return' && state !== 'connected'
      ? 'Back from Stripe. It can take a minute to show as connected; reload the page if it does not.'
      : back === 'refresh'
        ? 'That Stripe link ran out. Tap the button to carry on where you left off.'
        : null;
  return (
    <Card label="Get paid" variant="padded" testId="tix-getpaid" data-state={state}>
      <div className="space-y-[8px]">
        <div className="flex items-center justify-between gap-[8px]">
          <p className="text-[15px] font-semibold">Stripe</p>
          <StatusTag tone={copy.tone} testId="tix-getpaid-tag">{copy.tag}</StatusTag>
        </div>
        <p className="text-[14px] text-[var(--mut)]">{copy.body}</p>
        {backNote && <p className="text-[13px] text-[var(--mut)]" data-testid="tix-getpaid-back">{backNote}</p>}
        {copy.action && (
          <>
            <Button
              block
              testId="tix-getpaid-go"
              onClick={() => void go()}
              loading={busy}
              loadingLabel="Opening Stripe"
              disabled={!!blocked}
              aria-describedby={blocked ? reasonId : undefined}
            >
              {copy.action}
            </Button>
            <Reason id={reasonId} testId="tix-getpaid-reason">{blocked}</Reason>
          </>
        )}
        {note && (
          <p role="status" data-testid="tix-getpaid-note" className="text-[13px] text-[var(--fg)]">
            {note}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Sales: counts and sums only, across every ticket type of the page. */
export function SalesCard({ organiserId }: { organiserId: string }) {
  const q = useSalesSummary(organiserId);
  if (q.isLoading) return <Card label="Sales"><SkeletonRows count={3} label="Loading sales" /></Card>;
  if (q.isError || !q.data) {
    return (
      <Card label="Sales" variant="padded" testId="tix-sales">
        <ErrorState quiet title="We could not load your sales." onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </Card>
    );
  }
  if (!q.data.ok) {
    return (
      <Card label="Sales" variant="padded" testId="tix-sales">
        <p className="text-[14px] text-[var(--mut)]" data-testid="tix-sales-refused">{reasonMessage(q.data.reason)}</p>
      </Card>
    );
  }
  if (q.data.types.length === 0) {
    return (
      <Card label="Sales" variant="padded" testId="tix-sales">
        <p className="text-[14px] text-[var(--mut)]" data-testid="tix-sales-empty">
          No ticket sales yet. Open one of your events below and add a ticket type to start selling.
        </p>
      </Card>
    );
  }
  const t = totalsOf(q.data.types);
  return (
    <Card label="Sales" testId="tix-sales">
      <SummaryRow affordance="none" label="Tickets sold" value={String(t.ticketsSold)} testId="tix-sales-sold" />
      <SummaryRow affordance="none" label="Paid orders" value={String(t.ordersPaid)} testId="tix-sales-orders" />
      <SummaryRow affordance="none" label="Ticket money" sublabel="Before Stripe&rsquo;s fees" value={formatPence(t.grossPence)} testId="tix-sales-gross" />
      <SummaryRow affordance="none" label="Booking fees" sublabel="Paid by buyers on top of the price, 50p a ticket" value={formatPence(t.bookingFeesPence)} testId="tix-sales-fees" />
      <SummaryRow affordance="none" label="Refunded" value={`${formatPence(t.refundedPence)} (${t.ordersRefunded})`} testId="tix-sales-refunded" />
      {t.ordersPending > 0 && <SummaryRow affordance="none" label="Waiting for payment" value={String(t.ordersPending)} testId="tix-sales-pending" />}
      {t.ordersDisputed > 0 && <SummaryRow affordance="none" label="Disputed" value={String(t.ordersDisputed)} testId="tix-sales-disputed" />}
    </Card>
  );
}
