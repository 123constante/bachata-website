import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { londonTodayKey } from '@/lib/londonDate';
import { eventHref } from '@/lib/seo/eventHref';
import { Card, EmptyState, GhostButton, ErrorState, SectionLabel, SkeletonRows, londonDateParts } from '@/modules/organiser/ui';
import type { LineupAppearance } from './areaApi';

export const LINEUP_HEADING = "Where you're on the line-up";
export const LINEUP_EMPTY_TITLE = 'No line-ups yet';
export const LINEUP_EMPTY_BODY = 'When an organiser adds you to a line-up, it shows here.';
/** Series shown before "Show all N" (D32). */
export const LINEUP_FIRST = 10;

export interface LineupSeries {
  seriesId: string;
  eventName: string;
  slug: string | null;
  /** The series' first row in server order: its soonest date. */
  next: LineupAppearance;
  moreDates: number;
}

/** One entry per series, in the order the server first names it (D32); never re-sorted. */
export function groupLineup(rows: LineupAppearance[]): LineupSeries[] {
  const bySeries = new Map<string, { g: LineupSeries; dates: Set<string> }>();
  for (const r of rows) {
    const s = bySeries.get(r.seriesId);
    if (s) s.dates.add(r.date);
    else bySeries.set(r.seriesId, { g: { seriesId: r.seriesId, eventName: r.eventName, slug: r.slug, next: r, moreDates: 0 }, dates: new Set([r.date]) });
  }
  // Two sessions on one date are one date.
  return [...bySeries.values()].map(({ g, dates }) => ({ ...g, moreDates: dates.size - 1 }));
}

export function moreDatesLine(n: number): string {
  return n === 0 ? '' : n === 1 ? 'and 1 more date' : `and ${n} more dates`;
}

function SeriesRow({ g, today }: { g: LineupSeries; today: string }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{g.eventName}</span>
        <span className="block text-[13px] text-[var(--mut)]">
          {londonDateParts(g.next.date, today).label}
          {g.next.sessionTitle ? `, ${g.next.sessionTitle}` : ''}
        </span>
        {g.moreDates > 0 && <span className="block text-[13px] text-[var(--mut)]">{moreDatesLine(g.moreDates)}</span>}
      </span>
      {g.slug && <ChevronRight aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--mut)]" />}
    </>
  );
  const cls = 'flex min-h-[56px] items-center gap-[12px] px-[16px] py-[10px]';
  // No slug: the series id is not a public event id, so a link would not open (D33).
  return g.slug ? (
    <Link to={eventHref({ slug: g.slug, event_id: g.seriesId })} className={cls} data-testid="lineup-row">{inner}</Link>
  ) : (
    <div className={cls} data-testid="lineup-row">{inner}</div>
  );
}

export interface LineupListProps {
  status: 'pending' | 'error' | 'success';
  rows: LineupAppearance[] | undefined;
  onRetry(): void;
  retrying?: boolean;
  today?: string;
}

/** Upcoming events that name this person in the programme, in server order (soonest first). */
export function LineupList({ status, rows, onRetry, retrying, today = londonTodayKey() }: LineupListProps) {
  const [showAll, setShowAll] = useState(false);
  let body;
  if (status === 'pending') body = <SkeletonRows count={3} label="Loading your line-ups" />;
  else if (status === 'error') body = <ErrorState quiet onRetry={onRetry} retrying={retrying} testId="lineup-error" />;
  else if (!rows || rows.length === 0) body = <EmptyState testId="lineup-empty" title={LINEUP_EMPTY_TITLE} body={LINEUP_EMPTY_BODY} />;
  else {
    const series = groupLineup(rows);
    const shown = showAll ? series : series.slice(0, LINEUP_FIRST);
    body = (
      <div className="space-y-[8px]">
        <Card testId="lineup-list">
          {shown.map((g) => <SeriesRow key={g.seriesId} g={g} today={today} />)}
        </Card>
        {shown.length < series.length && (
          <GhostButton size="sm" testId="lineup-show-all" onClick={() => setShowAll(true)}>{`Show all ${series.length}`}</GhostButton>
        )}
      </div>
    );
  }
  return (
    <section aria-label={LINEUP_HEADING}>
      <SectionLabel>{LINEUP_HEADING}</SectionLabel>
      {body}
    </section>
  );
}
