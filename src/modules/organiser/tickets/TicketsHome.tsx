import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OrganiserShell } from '../shell/OrganiserShell';
import { ORG_PATHS } from '../shell/paths';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { Card, EmptyState, ErrorState, SkeletonRows, SummaryRow } from '../ui';
import { GetPaidCard, SalesCard, useSalesSummary } from './parts';
import { TICKET_PATHS } from './paths';
import { ticketKeys } from './ticketsApi';

const LINK = 'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--gold)]';

/** /account/tickets: Get paid, Sales (counts and sums), and the page's live events. */
export default function TicketsHome() {
  const { home, selected } = useOrganiserChoice();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stripeParam = params.get('stripe');
  // Read once on arrival, then dropped from the URL so a reload or a bookmark does not repeat the note.
  const [back] = useState<'return' | 'refresh' | null>(stripeParam === 'return' || stripeParam === 'refresh' ? stripeParam : null);
  const summary = useSalesSummary(selected?.id);
  // Back from Stripe: read the account row again (the webhook may have landed meanwhile).
  useEffect(() => {
    if (back && selected?.id) void queryClient.invalidateQueries({ queryKey: ticketKeys.stripe(selected.id) });
  }, [back, selected?.id, queryClient]);
  useEffect(() => {
    if (!stripeParam) return;
    const next = new URLSearchParams(params);
    next.delete('stripe');
    setParams(next, { replace: true });
  }, [stripeParam, params, setParams]);

  const shell = (children: ReactNode) => (
    <OrganiserShell title="Tickets" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="tix-home">
      <div className="space-y-[12px]">{children}</div>
    </OrganiserShell>
  );
  if (home.isLoading) return shell(<SkeletonRows count={4} label="Loading" />);
  if (home.isError) return shell(<ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} />);
  if (!selected) {
    return shell(
      <EmptyState
        testId="tix-no-page"
        title="No organiser page yet"
        body="Set up your organiser page first, then come back here to sell tickets."
        action={<Link to={ORG_PATHS.home} className={LINK}>Go to your organiser home</Link>}
      />,
    );
  }
  const live = selected.series.filter((s) => s.lifecycle_status === 'live');
  const typeCount = (seriesId: string) =>
    summary.data?.ok ? summary.data.types.filter((t) => t.seriesId === seriesId).length : null;
  return shell(
    <>
      <p className="truncate text-[14px] text-[var(--mut)]" data-testid="tix-page-name">{selected.name}</p>
      <GetPaidCard organiserId={selected.id} role={selected.role} back={back} primary />
      <SalesCard organiserId={selected.id} />
      {live.length === 0 ? (
        <Card label="Your events" variant="padded" testId="tix-events">
          <EmptyState
            testId="tix-no-live"
            title="No live events yet"
            body="Tickets go on live events. Put an event live first, then add tickets to it here."
            action={<Link to={ORG_PATHS.events} className={LINK}>Go to your events</Link>}
          />
        </Card>
      ) : (
        <Card label="Your events" testId="tix-events">
          {live.map((s) => {
            const n = typeCount(s.id);
            return (
              <SummaryRow
                key={s.id}
                testId={`tix-event-${s.id}`}
                label={s.name}
                value={n === null ? undefined : n === 0 ? 'No tickets' : `${n} ${n === 1 ? 'ticket type' : 'ticket types'}`}
                onPress={() => navigate(TICKET_PATHS.event(s.id, selected.id))}
              />
            );
          })}
        </Card>
      )}
    </>,
  );
}
