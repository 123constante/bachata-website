import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { lifeChip } from '@/modules/organiser/jobs/homeJobs';
import { seriesLife, type Life } from '@/modules/organiser/shared/lifeLabel';
import { useOrganiserChoice } from '@/modules/organiser/switch/useOrganiserChoice';
import { ORG_PATHS } from '../shell';
import { Card, EmptyState, ErrorState, PrimaryButton, SkeletonRows } from '../ui';
import { listedSeries, useOrganiserHome, type ListedSeries } from './eventsApi';

const TONE: Record<'ok' | 'bad' | 'n', string> = {
  ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  bad: 'bg-[var(--card2)] text-[var(--danger)]',
  n: 'bg-[var(--card2)] text-[var(--mut)]',
};

/** The row's section reads lifeLabel (W3 d31): the chip's words come from there too, via lifeChip. */
const lifeOf = (s: ListedSeries): Life => seriesLife(s, s.upcoming_count);

function EventRow({ series, today }: { series: ListedSeries; today: string }) {
  // The chip is Home's own mapping (jobs/homeJobs lifeChip): a fact never reads differently on two screens.
  const chip = lifeChip(series, today);
  return (
    <Link to={ORG_PATHS.event(series.id)} data-testid="org-event-row" data-series-id={series.id}
      className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">
      <span className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] font-semibold leading-[19px] text-[var(--fg)]">{series.name}</span>
      <span data-testid="org-event-chip" className={cn('shrink-0 rounded-full px-[8px] py-[2px] text-[12px] font-semibold', TONE[chip.tone])}>{chip.label}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  );
}

/**
 * My events (C33): every listed series as a row, its chip, tap -> the event; C33b empty state.
 * Events whose dates have all passed stay visible under a collapsed Past heading (owner: events are never hidden).
 */
export function EventList({ activeId }: { activeId?: string } = {}) {
  const home = useOrganiserHome();
  // With two or more pages, New event keeps the chosen page (?o=), as Home's does.
  const { organisers, selected } = useOrganiserChoice();
  const navigate = useNavigate();
  const [pastOpen, setPastOpen] = useState(false);
  const activeInPast = !!activeId && !!home.data && listedSeries(home.data.organisers).some((s) => s.id === activeId && lifeOf(s).section === 'past');
  // Opening an event under Past opens the section once (state adjusted during render); after
  // that the person can collapse it. Opening a different past event opens it again.
  const [seenActive, setSeenActive] = useState<string | undefined>(undefined);
  const openedId = activeInPast ? activeId : undefined;
  if (openedId !== seenActive) {
    setSeenActive(openedId);
    if (openedId) setPastOpen(true);
  }
  if (home.isPending) return <SkeletonRows count={4} label="Loading your events" testId="org-events-loading" />;
  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} testId="org-events-error" />;
  const today = home.data.today ?? londonTodayKey();
  const series = listedSeries(home.data.organisers);
  const current = series.filter((s) => lifeOf(s).section === 'current');
  const past = series.filter((s) => lifeOf(s).section === 'past');
  const showPast = pastOpen;
  const newButton = (
    <PrimaryButton onClick={() => navigate(ORG_PATHS.newWhatFor(organisers.length > 1 ? selected?.id : null))} testId="org-events-new">
      <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> New event
    </PrimaryButton>
  );
  if (series.length === 0) return <EmptyState testId="org-events-empty" title="No events yet" action={newButton} />;
  return (
    <div data-testid="org-event-list" className="flex flex-col gap-3">
      {current.length === 0 ? (
        <EmptyState
          testId="org-events-none-current"
          title="Nothing coming up"
          body="Every event you run is under Past. Open one to see how to add dates, or use New event."
          action={newButton}
        />
      ) : (
        <Card testId="org-events-current">{current.map((s) => <EventRow key={s.id} series={s} today={today} />)}</Card>
      )}
      {past.length > 0 && (
        <section data-testid="org-events-past" className="space-y-[8px]">
          <button
            type="button"
            aria-expanded={showPast}
            aria-controls="org-events-past-rows"
            onClick={() => setPastOpen(!showPast)}
            data-testid="org-events-past-toggle"
            className="flex min-h-[44px] w-full items-center justify-between gap-[8px] px-[4px] text-left text-[13px] font-semibold uppercase text-[var(--mut)]"
          >
            <span>Past <span data-testid="org-events-past-count">({past.length})</span></span>
            <ChevronDown aria-hidden="true" size={16} className={cn('block h-[16px] w-[16px] shrink-0 self-center transition-transform', showPast && 'rotate-180')} />
          </button>
          {showPast && (
            <div id="org-events-past-rows">
              <Card>{past.map((s) => <EventRow key={s.id} series={s} today={today} />)}</Card>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
