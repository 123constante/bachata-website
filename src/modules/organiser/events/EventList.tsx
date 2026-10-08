import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIFECYCLE_LABEL } from '@/modules/organiser/shared/selfServeApi';
import { ORG_PATHS } from '../shell';
import { Card, DateChip, EmptyState, ErrorState, PrimaryButton, SectionLabel, SkeletonRows, StatusTag } from '../ui';
import { listedSeries, useOrganiserHome, type ListedSeries } from './eventsApi';

function nextDate(s: ListedSeries): string | null {
  return s.next_dates.find((d) => d.lifecycle_status !== 'cancelled')?.occurrence_date ?? null;
}

function EventRow({ series, active }: { series: ListedSeries; active: boolean }) {
  const next = nextDate(series);
  const live = series.lifecycle_status === 'live';
  return (
    <Link
      to={ORG_PATHS.event(series.id)}
      data-testid="org-event-row"
      data-series-id={series.id}
      aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-[64px] items-center gap-3 px-4 py-3', active && 'bg-[var(--card2)]')}
    >
      {next ? <DateChip date={next} /> : (
        <span aria-hidden="true" className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--card2)] text-[var(--mut)]">
          <CalendarPlus className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{series.name}</span>
        <span className="flex items-center gap-1 truncate text-[13px] text-[var(--mut)]" data-testid="org-event-row-venue">
          {series.default_venue_name ? (<><MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />{series.default_venue_name}</>) : next ? 'No place yet' : 'No upcoming dates'}
        </span>
      </span>
      <StatusTag tone={live ? 'live' : 'draft'} testId="org-event-row-status">
        {live ? 'Live' : LIFECYCLE_LABEL[series.lifecycle_status] ?? 'Draft'}
      </StatusTag>
    </Link>
  );
}

/**
 * The organiser's events (the left column on wide screens). `primaryNew` puts
 * the screen's one PrimaryButton on the empty state; pass it only where no other
 * primary button shows (the list route, not beside the editor).
 */
export function EventList({ activeId, primaryNew = false }: { activeId?: string; primaryNew?: boolean }) {
  const home = useOrganiserHome();
  const navigate = useNavigate();
  if (home.isPending) return <SkeletonRows count={4} label="Loading your events" testId="org-events-loading" />;
  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} testId="org-events-error" />;
  const series = listedSeries(home.data.organisers);
  return (
    <div data-testid="org-event-list">
      <SectionLabel>Your events</SectionLabel>
      {series.length === 0 ? (
        <EmptyState
          testId="org-events-empty"
          title="No events yet"
          body="Create your first event. It starts as a draft only you can see."
          action={primaryNew ? <PrimaryButton onClick={() => navigate(ORG_PATHS.newEvent)} testId="org-events-new">New event</PrimaryButton> : undefined}
        />
      ) : (
        <Card>
          {series.map((s) => <EventRow key={s.id} series={s} active={s.id === activeId} />)}
        </Card>
      )}
    </div>
  );
}

/** The 'New event' link for the top bar (a gold link, never a second primary button). */
export function NewEventLink() {
  return (
    <Link to={ORG_PATHS.newEvent} data-testid="org-events-new-link" className="flex h-11 items-center rounded-[12px] px-3 text-[15px] font-semibold text-[var(--gold)]">
      New event
    </Link>
  );
}
