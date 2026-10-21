import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey, weekdayOfKey } from '@/lib/londonDate';
import { eventLock, ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { comingDates, dayLabel } from '@/modules/organiser/shared/dateList';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { lifeChip } from '@/modules/organiser/jobs/homeJobs';
import { putBackPath, RESTORE_CAP_NOTE, restoreCapped } from '@/modules/organiser/flows/cancel/cancelModel';
import { canAddTo, findSeries } from '@/modules/organiser/flows/add/addModel';
import { useFlowHome } from '@/modules/organiser/flows/add/useFlow';
import { ACTION_LABEL, EventStep, eventActions, eventStepPath, readStep, STEP_PARAM, type EventStepName } from '@/modules/organiser/flows/event';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Card, EmptyState, ErrorState, SkeletonRows } from '../ui';
import { ClosedLines } from './ClosedLines';
import { DatesList } from './EditorRows';
import { EventList } from './EventList';
import { moreLabel, readIsFull, wsCancelledComing, wsComing, type EventWorkspace } from './eventModel';
import { NO_COMING } from '@/modules/organiser/shared/copy';
import { useEventWorkspace } from './eventsApi';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { nothingComingUp } from '@/modules/organiser/shared/lifeLabel';
import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { LifecycleActions } from './LifecycleActions';
import { EventPage } from './EventPage';
import { useRebuildSwitch } from '../shell/rebuildSwitch';
import { useOrganiserSeries } from '../shared/useOrganiserSeries';
import { notFoundText } from '../flows/add/notFoundText';

const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left text-[15px]';
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAY_HEAD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The month with dots (D23): this London month, a dot on each day that holds a date. */
function MonthDots({ ws, today }: { ws: EventWorkspace | undefined; today: string }) {
  const [y, m] = today.split('-').map(Number);
  const first = `${today.slice(0, 7)}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (weekdayOfKey(first) + 6) % 7; // Monday first
  const held = new Map((ws?.dates ?? []).filter((d) => d.occurrence_date.startsWith(today.slice(0, 7))).map((d) => [d.occurrence_date, d.lifecycle_status]));
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : i - lead + 1));
  return (
    <section aria-label={`${MONTH[m - 1]} ${y}`} data-testid="org-month" className="rounded-[12px] bg-[var(--card)] p-3">
      <p className="pb-2 text-[14px] font-semibold text-[var(--fg)]">{MONTH[m - 1]}</p>
      {/* B-S6: the weekday over each column (Monday first); the letter is visual, the full name is read. */}
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-[var(--mut)]" data-testid="org-month-weekdays">
        {WEEKDAY_HEAD.map((w) => (
          <span key={w}><span aria-hidden="true">{w[0]}</span><span className="sr-only">{w}</span></span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[12px]" data-testid="org-month-days">
        {cells.map((d, i) => {
          if (d === null) return <span key={`x${i}`} />;
          const key = `${today.slice(0, 8)}${String(d).padStart(2, '0')}`;
          const status = held.get(key);
          return (
            <span key={key} data-date={key} className={cn('flex flex-col items-center', key < today ? 'text-[var(--mut)]' : 'text-[var(--fg)]', key === today && 'font-bold')}>
              {d}
              {/* The dot's state, for a screen reader: the dot itself is decoration. */}
              {status && <span className="sr-only">{status === 'cancelled' ? ' cancelled' : ' on'}</span>}
              <span aria-hidden="true" data-testid={status ? 'org-month-dot' : undefined}
                className={cn('mt-[2px] h-[5px] w-[5px] rounded-full', status === 'scheduled' ? 'bg-[var(--gold)]' : status ? 'bg-[var(--mut)]' : 'bg-transparent')} />
            </span>
          );
        })}
      </div>
    </section>
  );
}

/**
 * A row of the event that cannot work: it stays, off, with its reason under it
 * (reachable with Tab, read with its reason). When the reason is that nothing is
 * coming, the way out is offered under it: Add a date (F-PAR decision 5).
 */
function OffRow({ label, reason, testId, addTo }: { label: string; reason: string; testId: string; addTo?: string }) {
  const reasonId = `${testId}-reason`;
  return (
    <div>
      <a role="link" aria-disabled="true" tabIndex={0} aria-describedby={reasonId} data-testid={testId} className={cn(ROW, 'cursor-not-allowed text-[var(--mut)]')}>{label}</a>
      <p id={reasonId} className="px-[16px] pb-[10px] text-[13px] text-[var(--mut)]" data-testid={reasonId}>{reason}</p>
      {addTo && (
        <Link to={addTo} data-testid={`${testId}-add-date`} className={cn(ROW, 'font-semibold text-[var(--gold)]')}>
          <span className="min-w-0 flex-1">Add a date</span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </Link>
      )}
    </div>
  );
}

function Dates({ seriesId, home, ws, today }: { seriesId: string; home: HomeSeriesFull | null; ws: EventWorkspace | undefined; today: string }) {
  const shown = home ? comingDates(home, today) : [];
  const more = moreLabel(ws, shown.length, home?.upcoming_count ?? 0, today);
  const cancelled = ws ? wsCancelledComing(ws, today) : [];
  const status = home?.lifecycle_status ?? ws?.series.lifecycle_status ?? '';
  return (
    <>
      <Card label="Coming dates" testId="org-coming">
        {shown.map((d) => (
          <div key={d.occurrenceId} className="flex items-center">
            <Link to={ORG_PATHS.changeDate(seriesId, d.occurrenceId)} data-testid="org-coming-date" className={cn(ROW, 'min-w-0 flex-1 pr-[4px]')}>
              <span className="min-w-0 flex-1 truncate text-[var(--fg)]">{d.label}{d.time ? `, ${d.time}` : ''}</span>
              <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
            </Link>
            {/* Every coming date opens its own sessions and line-up (PARITY-GAP C59), not only the next. */}
            <Link to={ORG_PATHS.dateLineup(seriesId, d.occurrenceId)} data-testid="org-coming-sessions" aria-label={`Sessions and line-up, ${d.label}`}
              className="flex min-h-[52px] min-w-[44px] shrink-0 items-center px-[12px] text-[14px] font-semibold text-[var(--gold)]">
              Sessions
            </Link>
          </div>
        ))}
        {more && <p className="px-[16px] py-[10px] text-[14px] text-[var(--mut)]" data-testid="org-coming-more">{more}</p>}
        {!shown.length && (
          <div className="px-[16px] py-[10px]" data-testid="org-coming-none">
            <p className="text-[15px] text-[var(--fg)]">No coming dates</p>
            {status === 'paused' && <p className="pt-[4px] text-[14px] text-[var(--mut)]" data-testid="org-coming-resume">Resume it to add dates</p>}
            {canAddTo(status) && (
              <Link to={ORG_PATHS.addEvent(seriesId)} className={cn(ROW, 'px-0 font-semibold text-[var(--gold)]')} data-testid="org-coming-add">Add a date</Link>
            )}
          </div>
        )}
      </Card>
      {cancelled.length > 0 && ws && (
        <Card label="Cancelled" testId="org-cancelled">
          {cancelled.map((d) => {
            const capped = restoreCapped(ws.dates, d.id, today);
            return (
              <div key={d.id} data-testid="org-cancelled-date" className="px-[16px] py-[6px]">
                <div className="flex min-h-[48px] items-center gap-[12px]">
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--mut)]">{dayLabel(d.occurrence_date)}</span>
                  {capped ? (
                    <a role="link" aria-disabled="true" data-testid="org-put-back" className="flex h-[44px] items-center px-[8px] text-[15px] text-[var(--mut)]">Put it back</a>
                  ) : (
                    <Link to={putBackPath(seriesId, d.id)} data-testid="org-put-back" className="flex h-[44px] items-center px-[8px] text-[15px] font-semibold text-[var(--gold)]">Put it back</Link>
                  )}
                </div>
                {capped && <p className="pb-[6px] text-[13px] text-[var(--mut)]" data-testid="org-put-back-reason">{RESTORE_CAP_NOTE}</p>}
              </div>
            );
          })}
        </Card>
      )}
      {/* C39: the past dates, collapsed; each opens that date read-only. */}
      {ws && <DatesList seriesId={seriesId} dates={ws.dates} today={today} truncated={ws.hasMore} pastOnly />}
    </>
  );
}

function Actions({ ws, today }: { ws: EventWorkspace; today: string }) {
  const rows = eventActions(ws.series, readIsFull(ws, today), wsComing(ws, today).length);
  // S-FEEDBACK 5: a Finished / Nothing coming up event offers only See it live; Pause and End go until a date is added.
  const idle = nothingComingUp(ws.series, upcomingDates(ws.dates, today).length);
  const shown = (Object.keys(rows) as EventStepName[]).filter((k) => rows[k] && !(idle && (k === 'pause' || k === 'end')));
  if (!shown.length) return null;
  return (
    <Card testId="org-event-actions">
      {shown.map((step) => {
        const reason = rows[step]?.reason;
        const label = step === 'day' ? `${ACTION_LABEL.day}${dayNow(ws)}` : ACTION_LABEL[step];
        return reason ? (
          <OffRow key={step} label={label} reason={reason} testId={`org-event-${step}`} addTo={reason === NO_COMING ? ORG_PATHS.addEvent(ws.series.id) : undefined} />
        ) : (
          <Link key={step} to={eventStepPath(ws.series.id, step)} data-testid={`org-event-${step}`} className={cn(ROW, step === 'end' ? 'text-[var(--danger)]' : 'text-[var(--fg)]')}>
            <span className="min-w-0 flex-1">{label}</span>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
          </Link>
        );
      })}
    </Card>
  );
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayNow(ws: EventWorkspace): string {
  const rule = ownerWeeklyRule(ws.series);
  return rule ? ` (${WEEKDAY[rule.weekdays[0]]})` : '';
}

/**
 * The rebuilt event page's route (ER-C8): loading, the not-found split (archived / no access /
 * gone), a failed read with Try again, then the page. Only with the rebuild switch on.
 */
function RebuiltEvent({ seriesId }: { seriesId: string }) {
  const found = useOrganiserSeries(seriesId);
  const ws = useEventWorkspace(seriesId);
  const home = useFlowHome();
  const today = home.data?.today ?? londonTodayKey();
  if (found.state === 'found' && ws.data) return <EventPage key={ws.data.series.version} ws={ws.data} today={today} />;
  const retry = () => { void home.refetch(); void ws.refetch(); if (found.state === 'error') found.retry(); };
  const body = found.state === 'not-found-archived' || found.state === 'no-access' || found.state === 'gone' ? (
    <EmptyState title={notFoundText(found.state)} testId={`org-event-${found.state}`} />
  ) : found.state === 'error' || ws.isError ? (
    <ErrorState onRetry={retry} retrying={home.isFetching || ws.isFetching} testId="org-event-error" />
  ) : (
    <SkeletonRows count={5} label="Loading the event" testId="org-event-loading" />
  );
  return (
    <OrganiserShell title="Event" back={{ to: ORG_PATHS.events, label: 'Events' }} testId="org-page-event">
      {body}
    </OrganiserShell>
  );
}

/**
 * /account/o/events/:seriesId (C36, D23): leads with its dates -- the month
 * with dots, the coming dates (Home's next dates, "N more" from the
 * workspace), the cancelled ones with Put it back (D46), the dates taken off --
 * then the title row to Details and the event's actions. No Undo bar (D49).
 * A `?do=` step (C42-C44) renders on this same route.
 */
export default function OneEvent() {
  const { seriesId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const home = useFlowHome();
  const ws = useEventWorkspace(seriesId);
  const today = home.data?.today ?? londonTodayKey();
  const one = findSeries(home.data, seriesId);
  const step = readStep(search.get(STEP_PARAM));
  const name = one?.name ?? ws.data?.series.name ?? 'Event';
  const rebuild = useRebuildSwitch();

  if (step && ws.data) return <EventStep ws={ws.data} today={today} step={step} />;
  if (rebuild) return <RebuiltEvent seriesId={seriesId} />;

  const body = ws.isError && isAccessRefusal(ws.error) ? (
    <NoAccess />
  ) : home.isError || ws.isError ? (
    <ErrorState onRetry={() => { void home.refetch(); void ws.refetch(); }} retrying={home.isFetching || ws.isFetching} testId="org-event-error" />
  ) : !home.data || !ws.data ? (
    <SkeletonRows count={5} label="Loading the event" testId="org-event-loading" />
  ) : !one && !ws.data.series.id ? (
    <EmptyState title="Event not found" testId="org-event-missing" />
  ) : (
    <>
      <button type="button" onClick={() => navigate(ORG_PATHS.eventDetails(seriesId))} data-testid="org-event-title"
        className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[12px] bg-[var(--card)] px-[16px] text-left">
        <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-[var(--fg)]">{name}</span>
        {one && <span className="shrink-0 text-[13px] text-[var(--mut)]" data-testid="org-event-chip">{lifeChip(one, today).label}</span>}
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
      </button>
      <ClosedLines ws={ws.data} today={today} testId="org-event" />
      <MonthDots ws={ws.data} today={today} />
      <Dates seriesId={seriesId} home={one} ws={ws.data} today={today} />
      <Actions ws={ws.data} today={today} />
      <LifecycleActions ws={ws.data} today={today} />
    </>
  );

  return (
    // Wide screens keep My events beside the event (the split the old editor had); a phone shows the event only.
    <OrganiserShell title={name} back={{ to: ORG_PATHS.events, label: 'Events' }} testId="org-page-event"
      list={<EventList activeId={seriesId} />} detail={<div className="flex flex-col gap-3 p-3">{body}</div>} />
  );
}
