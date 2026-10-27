import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OrganiserShell } from '../shell/OrganiserShell';
import { ORG_PATHS } from '../shell/paths';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { Card, EmptyState, ErrorState, SectionLabel, SkeletonRows, StatusTag } from '../ui';
import { EventCard, LINK, NextStepCard, NumberCards, SetupBar, useSalesSummary, useStripeState } from './parts';
import { TICKET_PATHS } from './paths';
import { ticketKeys } from './ticketsApi';
import { NOT_MANAGER, STRIPE_COPY, canManage, nextStep, reasonMessage, setupSteps, type TypeSales } from './ticketModel';

/**
 * /account/tickets (mockup B, docs/design/1060.md): ONE Next step card while setup is
 * unfinished, the setup bar, Sold / Sales, then the page's live events as compact cards.
 */
export default function TicketsHome() {
  const { home, selected } = useOrganiserChoice();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stripeParam = params.get('stripe');
  // Read once on arrival, then dropped from the URL so a reload or a bookmark does not repeat the note.
  const [back] = useState<'return' | 'refresh' | null>(stripeParam === 'return' || stripeParam === 'refresh' ? stripeParam : null);
  const summary = useSalesSummary(selected?.id);
  const { query: stripeQuery, state: stripe } = useStripeState(selected?.id);
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

  const shell = (children: ReactNode, end?: ReactNode) => (
    <OrganiserShell title="Tickets" back={{ to: ORG_PATHS.home, label: 'Home' }} topBarEnd={end} testId="tix-home">
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
  const organiserId = selected.id;
  const live = selected.series.filter((s) => s.lifecycle_status === 'live');
  const manager = canManage(selected.role);
  const types: TypeSales[] | null = summary.data?.ok ? summary.data.types : null;
  const addPath = (seriesId: string) => `${TICKET_PATHS.event(seriesId, organiserId)}&add=1`;
  const openPath = (seriesId: string) => TICKET_PATHS.event(seriesId, organiserId);
  const loaded = !!stripe && !!summary.data;
  const step = loaded ? nextStep(selected.role, stripe, live, types ?? []) : null;

  // The top of the page waits for both reads: a Next step guessed from half the facts would flicker.
  let top: ReactNode;
  if (stripeQuery.isLoading || summary.isLoading) top = <SkeletonRows count={2} label="Loading your ticket set-up" />;
  else if (stripeQuery.isError || !stripe) {
    top = (
      <Card variant="padded" testId="tix-getpaid">
        <ErrorState quiet title="We could not read your payment set-up." onRetry={() => void stripeQuery.refetch()} retrying={stripeQuery.isFetching} />
      </Card>
    );
  } else if (summary.isError || !summary.data) {
    top = (
      <Card variant="padded" testId="tix-sales">
        <ErrorState quiet title="We could not load your sales." onRetry={() => void summary.refetch()} retrying={summary.isFetching} />
      </Card>
    );
  } else {
    const list = types ?? [];
    const steps = setupSteps(stripe, list);
    top = (
      <>
        {!manager && (
          <p className="text-[13px] text-[var(--mut)]" data-testid="tix-readonly">
            You can see sales here. {NOT_MANAGER}
          </p>
        )}
        {step && <NextStepCard key={step.kind} step={step} organiserId={organiserId} back={back} addPath={addPath} openPath={openPath} />}
        {manager && live.length > 0 && steps.some((s) => !s.done) && <SetupBar steps={steps} />}
        {!summary.data.ok && (
          <p className="text-[14px] text-[var(--mut)]" data-testid="tix-sales-refused">{reasonMessage(summary.data.reason)}</p>
        )}
        {list.length > 0 && <NumberCards types={list} />}
      </>
    );
  }

  const events =
    live.length === 0 ? (
      <Card variant="padded" testId="tix-events">
        <EmptyState
          testId="tix-no-live"
          title="No live events yet"
          body="Tickets go on live events. Put an event live first, then add tickets to it here."
          action={<Link to={ORG_PATHS.events} className={LINK}>Go to your events</Link>}
        />
      </Card>
    ) : (
      <section aria-labelledby="tix-events-label" className="space-y-[8px]" data-testid="tix-events">
        <SectionLabel id="tix-events-label">Your events</SectionLabel>
        {live.map((s) => {
          const own = types ? types.filter((t) => t.seriesId === s.id) : null;
          // Payments sorted (or not needed): an event with no tickets carries its own Add tickets.
          const ready = stripe === 'connected' || (types ?? []).some((t) => t.pricePence === 0);
          // ...unless the Next step card is already that button (one primary per event).
          const canAdd = manager && ready && own !== null && own.length === 0 && !(step?.kind === 'add' && step.seriesId === s.id);
          return <EventCard key={s.id} series={s} types={own} to={openPath(s.id)} addTo={canAdd ? addPath(s.id) : null} />;
        })}
      </section>
    );

  return shell(
    <>
      <p className="truncate text-[14px] text-[var(--mut)]" data-testid="tix-page-name">{selected.name}</p>
      {top}
      {events}
    </>,
    stripe === 'connected' ? <StatusTag tone="live" testId="tix-paidout">{STRIPE_COPY.connected.tag}</StatusTag> : null,
  );
}
