import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { lineupSummary, toDraft, TYPE_LABEL } from '@/modules/organiser/shared/programmeModel';
import { upcomingDates, type WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { ORG_PATHS } from '../shell';
import { Card, Collapse, DateChip, GhostButton, SkeletonRows, SummaryRow } from '../ui';
import { shortDate } from './eventModel';
import { useNextDateProgramme } from './eventsApi';


/** The sessions of the NEXT date, read-only with their people; opens that date's editor (W3). */
export function ScheduleCard({ seriesId, next, today }: { seriesId: string; next: WorkspaceDate | null; today: string }) {
  const navigate = useNavigate();
  const programme = useNextDateProgramme(next?.id);
  if (!next) {
    return (
      <Card label="Schedule" testId="org-schedule">
        <SummaryRow label="No upcoming date" sublabel="Sessions show here once a date is listed" />
      </Card>
    );
  }
  const open = () => navigate(ORG_PATHS.date(seriesId, next.id));
  const sessions = programme.data
    ? toDraft(programme.data.sessions, programme.data.sessionPeople).filter((s) => !s.removed).sort((a, b) => a.start.localeCompare(b.start))
    : [];
  return (
    <Card label={`Schedule \u00b7 ${shortDate(next.occurrence_date, today)}`} testId="org-schedule">
      {programme.isPending && <div className="p-[16px]"><SkeletonRows count={2} label="Loading the schedule" /></div>}
      {programme.isError && <SummaryRow label="The schedule did not load" sublabel="Open the date to see it" onPress={open} />}
      {programme.data && sessions.length === 0 && (
        <SummaryRow label="No sessions yet" sublabel="Add classes, a party or a show on this date" onPress={open} testId="org-schedule-empty" />
      )}
      {sessions.map((s) => (
        <SummaryRow
          key={s.key}
          testId="org-schedule-session"
          label={[TYPE_LABEL[s.type ?? ''] ?? 'Session', s.title].filter(Boolean).join(': ')}
          sublabel={lineupSummary(s.people, 6) ?? 'No one added yet'}
          value={s.start ? (s.end ? `${s.start}\u2013${s.end}` : s.start) : undefined}
          onPress={open}
        />
      ))}
    </Card>
  );
}

/** Upcoming dates (tap opens the date editor) and past dates collapsed below. */
export function DatesList({ seriesId, dates, today }: { seriesId: string; dates: WorkspaceDate[]; today: string }) {
  const navigate = useNavigate();
  const [showPast, setShowPast] = useState(false);
  const upcoming = upcomingDates(dates, today);
  const past = dates.filter((d) => d.occurrence_date < today).sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
  const row = (d: WorkspaceDate) => (
    <button key={d.id} type="button" data-testid="org-date-row" data-date={d.occurrence_date}
      onClick={() => navigate(ORG_PATHS.date(seriesId, d.id))}
      className="flex min-h-[60px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left">
      <DateChip date={d.occurrence_date} />
      <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{shortDate(d.occurrence_date, today)}</span>
      {d.lifecycle_status === 'cancelled' && <span className="text-[13px] text-[var(--danger)]">Cancelled</span>}
    </button>
  );
  return (
    <section aria-label="Dates" className="space-y-[12px]" data-testid="org-dates">
      <Card label={`Upcoming dates (${upcoming.length})`}>
        {upcoming.length ? upcoming.map(row) : <SummaryRow icon={<CalendarDays />} label="No upcoming dates" sublabel="Extend to list more" />}
      </Card>
      {past.length > 0 && (
        <>
          <GhostButton size="sm" onClick={() => setShowPast((s) => !s)} aria-expanded={showPast} testId="org-dates-past-toggle">
            Past dates ({past.length}) <ChevronDown aria-hidden="true" className={showPast ? 'h-[16px] w-[16px] rotate-180' : 'h-[16px] w-[16px]'} />
          </GhostButton>
          <Collapse show={showPast}>
            <Card testId="org-dates-past">{past.map(row)}</Card>
          </Collapse>
        </>
      )}
    </section>
  );
}
