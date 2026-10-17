import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { seriesChip } from '@/modules/organiser/jobs/homeJobs';
import { ORG_PATHS } from '../shell';
import { Card, EmptyState, ErrorState, PrimaryButton, SkeletonRows } from '../ui';
import { listedSeries, useOrganiserHome, type ListedSeries } from './eventsApi';

const TONE: Record<'ok' | 'bad' | 'n', string> = {
  ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  bad: 'bg-[var(--card2)] text-[var(--danger)]',
  n: 'bg-[var(--card2)] text-[var(--mut)]',
};

function EventRow({ series, today }: { series: ListedSeries; today: string }) {
  // The chip is Home's own mapping (jobs/homeJobs seriesChip): a fact never reads differently on two screens.
  const chip = seriesChip(series, today);
  return (
    <Link to={ORG_PATHS.event(series.id)} data-testid="org-event-row" data-series-id={series.id}
      className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--fg)]">{series.name}</span>
      <span data-testid="org-event-chip" className={cn('shrink-0 rounded-full px-[8px] py-[2px] text-[12px] font-semibold', TONE[chip.tone])}>{chip.label}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  );
}

/** My events (C33): every listed series as a row, its chip, tap -> the event; C33b empty state. */
export function EventList() {
  const home = useOrganiserHome();
  const navigate = useNavigate();
  if (home.isPending) return <SkeletonRows count={4} label="Loading your events" testId="org-events-loading" />;
  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} testId="org-events-error" />;
  const today = home.data.today ?? londonTodayKey();
  const series = listedSeries(home.data.organisers);
  const newButton = (
    <PrimaryButton onClick={() => navigate(ORG_PATHS.newWhat)} testId="org-events-new">
      <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> New event
    </PrimaryButton>
  );
  if (series.length === 0) return <EmptyState testId="org-events-empty" title="No events yet" action={newButton} />;
  return (
    <div data-testid="org-event-list" className="flex flex-col gap-3">
      <Card>{series.map((s) => <EventRow key={s.id} series={s} today={today} />)}</Card>
    </div>
  );
}
