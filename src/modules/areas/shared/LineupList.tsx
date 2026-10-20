import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { londonTodayKey } from '@/lib/londonDate';
import { eventHref } from '@/lib/seo/eventHref';
import { Card, EmptyState, ErrorState, SectionLabel, SkeletonRows, londonDateParts } from '@/modules/organiser/ui';
import type { LineupAppearance } from './areaApi';

export const LINEUP_HEADING = "Where you're on the line-up";
export const LINEUP_EMPTY_TITLE = 'No line-ups yet';
export const LINEUP_EMPTY_BODY = 'When an organiser adds you to a line-up, it shows here.';

export interface LineupListProps {
  status: 'pending' | 'error' | 'success';
  rows: LineupAppearance[] | undefined;
  onRetry(): void;
  retrying?: boolean;
  today?: string;
}

/** Upcoming events that name this person in the programme, in server order (soonest first). */
export function LineupList({ status, rows, onRetry, retrying, today = londonTodayKey() }: LineupListProps) {
  let body;
  if (status === 'pending') body = <SkeletonRows count={3} label="Loading your line-ups" />;
  else if (status === 'error') body = <ErrorState quiet onRetry={onRetry} retrying={retrying} testId="lineup-error" />;
  else if (!rows || rows.length === 0) body = <EmptyState testId="lineup-empty" title={LINEUP_EMPTY_TITLE} body={LINEUP_EMPTY_BODY} />;
  else {
    body = (
      <Card testId="lineup-list">
        {rows.map((r, i) => (
          <Link
            key={`${r.seriesId}-${r.date}-${i}`}
            to={eventHref({ slug: r.slug, event_id: r.seriesId })}
            className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[10px]"
            data-testid="lineup-row"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{r.eventName}</span>
              <span className="block text-[13px] text-[var(--mut)]">
                {londonDateParts(r.date, today).label}
                {r.sessionTitle ? `, ${r.sessionTitle}` : ''}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--mut)]" />
          </Link>
        ))}
      </Card>
    );
  }
  return (
    <section aria-label={LINEUP_HEADING}>
      <SectionLabel>{LINEUP_HEADING}</SectionLabel>
      {body}
    </section>
  );
}
