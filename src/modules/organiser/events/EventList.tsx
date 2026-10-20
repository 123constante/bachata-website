import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronDown, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { seriesLife, type Life } from '@/modules/organiser/shared/lifeLabel';
import { ORG_PATHS } from '../shell';
import { Card, DateChip, EmptyState, ErrorState, PrimaryButton, SectionLabel, SkeletonRows, StatusTag } from '../ui';
import { listedSeries, useOrganiserHome, type ListedSeries } from './eventsApi';

function nextDate(s: ListedSeries): string | null {
  return s.next_dates.find((d) => d.lifecycle_status !== 'cancelled')?.occurrence_date ?? null;
}

/** The row's one mapping (lifeLabel): the tag, the section and the note all read it. */
const lifeOf = (s: ListedSeries): Life => seriesLife(s, s.upcoming_count);

function EventRow({ series, active }: { series: ListedSeries; active: boolean }) {
  const next = nextDate(series);
  const life = lifeOf(series);
  return (
    <Link
      to={ORG_PATHS.event(series.id)}
      data-testid="org-event-row"
      data-series-id={series.id}
      aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-[64px] items-center gap-[12px] px-[16px] py-[12px]', active && 'bg-[var(--card2)]')}
    >
      {next ? <DateChip date={next} today={londonTodayKey()} /> : (
        <span aria-hidden="true" className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--card2)] text-[var(--mut)]">
          <CalendarPlus className="h-[20px] w-[20px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{series.name}</span>
        {/* The note wraps (never truncated): it is what the person can do, beside a wide tag at 390px. */}
        <span className={cn('flex items-center gap-[4px] text-[13px] text-[var(--mut)]', life.note ? 'leading-[18px]' : 'truncate')} data-testid="org-event-row-venue">
          {life.note ?? (series.default_venue_name ? (<><MapPin aria-hidden="true" className="h-[12px] w-[12px] shrink-0" />{series.default_venue_name}</>) : next ? 'No venue yet' : 'No upcoming dates')}
        </span>
      </span>
      <StatusTag tone={life.tag.tone} testId="org-event-row-status">{life.tag.label}</StatusTag>
    </Link>
  );
}

/**
 * The organiser's events (the left column on wide screens). `primaryNew` puts
 * the screen's one PrimaryButton, New event, above the list (or on the empty
 * state); pass it only where no other primary shows (the list route, not
 * beside the editor). Events whose dates have all passed stay visible under a
 * collapsed Past heading (owner: events are never hidden).
 */
export function EventList({ activeId, primaryNew = false }: { activeId?: string; primaryNew?: boolean }) {
  const home = useOrganiserHome();
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
  const series = listedSeries(home.data.organisers);
  const current = series.filter((s) => lifeOf(s).section === 'current');
  const past = series.filter((s) => lifeOf(s).section === 'past');
  const showPast = pastOpen;
  const newButton = (
    <PrimaryButton onClick={() => navigate(ORG_PATHS.newEvent)} testId="org-events-new">
      <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> New event
    </PrimaryButton>
  );
  return (
    <div data-testid="org-event-list" className="space-y-[12px]">
      {primaryNew && series.length > 0 && newButton}
      <SectionLabel>Your events</SectionLabel>
      {series.length === 0 ? (
        <EmptyState
          testId="org-events-empty"
          title="No events yet"
          body="Create your first event. It starts as a draft only you can see."
          action={primaryNew ? newButton : undefined}
        />
      ) : current.length === 0 ? (
        <EmptyState
          testId="org-events-none-current"
          title="Nothing coming up"
          body={primaryNew
            ? 'Every event you run is under Past. Open one to see how to add dates, or use New event above.'
            : 'Every event you run is under Past. Open one to see how to add dates.'}
        />
      ) : (
        <Card testId="org-events-current">
          {current.map((s) => <EventRow key={s.id} series={s} active={s.id === activeId} />)}
        </Card>
      )}
      {past.length > 0 && (
        <section data-testid="org-events-past" className="space-y-[8px]">
          <SectionLabel className="pb-0">
          <button
            type="button"
            aria-expanded={showPast}
            aria-controls="org-events-past-rows"
            onClick={() => setPastOpen(!showPast)}
            data-testid="org-events-past-toggle"
            className="flex min-h-[44px] w-full items-center justify-between gap-[8px] text-left uppercase"
          >
            <span>Past <span data-testid="org-events-past-count">({past.length})</span></span>
            <ChevronDown aria-hidden="true" className={cn('h-[16px] w-[16px] transition-transform', showPast && 'rotate-180')} />
          </button>
          </SectionLabel>
          {showPast && (
            <div id="org-events-past-rows">
              <Card>
                {past.map((s) => <EventRow key={s.id} series={s} active={s.id === activeId} />)}
              </Card>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
