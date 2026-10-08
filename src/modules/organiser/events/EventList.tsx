import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { ORG_PATHS } from '../shell';
import { Card, DateChip, EmptyState, ErrorState, PrimaryButton, SectionLabel, SkeletonRows, StatusTag } from '../ui';
import { listedSeries, useOrganiserHome, type ListedSeries } from './eventsApi';

function nextDate(s: ListedSeries): string | null {
  return s.next_dates.find((d) => d.lifecycle_status !== 'cancelled')?.occurrence_date ?? null;
}

function EventRow({ series, active }: { series: ListedSeries; active: boolean }) {
  const next = nextDate(series);
  const tag = lifecycleTag(series.lifecycle_status);
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
        <span className="flex items-center gap-[4px] truncate text-[13px] text-[var(--mut)]" data-testid="org-event-row-venue">
          {series.default_venue_name ? (<><MapPin aria-hidden="true" className="h-[12px] w-[12px] shrink-0" />{series.default_venue_name}</>) : next ? 'No venue yet' : 'No upcoming dates'}
        </span>
      </span>
      <StatusTag tone={tag.tone} testId="org-event-row-status">{tag.label}</StatusTag>
    </Link>
  );
}

/**
 * The organiser's events (the left column on wide screens). `primaryNew` puts
 * the screen's one PrimaryButton, New event, above the list (or on the empty
 * state); pass it only where no other primary shows (the list route, not
 * beside the editor).
 */
export function EventList({ activeId, primaryNew = false }: { activeId?: string; primaryNew?: boolean }) {
  const home = useOrganiserHome();
  const navigate = useNavigate();
  if (home.isPending) return <SkeletonRows count={4} label="Loading your events" testId="org-events-loading" />;
  if (home.isError) return <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} testId="org-events-error" />;
  const series = listedSeries(home.data.organisers);
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
      ) : (
        <Card>
          {series.map((s) => <EventRow key={s.id} series={s} active={s.id === activeId} />)}
        </Card>
      )}
    </div>
  );
}

