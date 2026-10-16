import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { changeableSeries, changeDateList, findSeries, seriesLock } from './changeModel';
import { useChangeHome, useSeriesWorkspace } from './useChange';
import { Failed, Loading, Missing, Refusal, Step, StepList, StepRow } from './parts';

/**
 * C3: which date. The coming dates of one event (D34): weekday, day, full
 * month, time. The first 14, then ONE "N more" row that opens the rest in
 * place (owner, 2026-10-16). A paused or ended event reached by URL is refused.
 */
export default function WhichDate() {
  const navigate = useNavigate();
  const { seriesId = '' } = useParams();
  const [expanded, setExpanded] = useState(false);
  const home = useChangeHome();
  const ws = useSeriesWorkspace(seriesId);
  const one = findSeries(home.data, seriesId);
  // The one-event organiser came straight here: back goes Home, not to a one-row list.
  const back = changeableSeries(home.data).length === 1 ? ORG_PATHS.home : ORG_PATHS.change;
  const lock = one ? seriesLock(one.lifecycle_status) : null;
  const list = one && home.data && !lock ? changeDateList(one, ws.data, home.data.today) : null;
  const dates = list ? (expanded ? list.all : list.first) : [];

  return (
    <Step title={one?.name ?? 'Which date?'} back={back}>
      {home.isError ? (
        <Failed onRetry={() => void home.refetch()} />
      ) : !home.data ? (
        <Loading />
      ) : !one ? (
        <Missing />
      ) : lock ? (
        <Refusal text={lock} seriesId={seriesId} home />
      ) : dates.length === 0 ? (
        <EmptyState
          title="No coming dates"
          testId="change-which-date"
          action={<PrimaryButton testId="change-empty-add" onClick={() => navigate(ORG_PATHS.addEvent(seriesId))}>Add a date</PrimaryButton>}
        />
      ) : (
        <StepList testId="change-which-date">
          {dates.map((d) => (
            <StepRow
              key={d.occurrenceId}
              testId="change-date-row"
              label={d.label}
              sub={d.time ?? undefined}
              onClick={() => navigate(ORG_PATHS.changeDate(seriesId, d.occurrenceId))}
            />
          ))}
          {!expanded && list && list.more > 0 && (
            <StepRow
              testId="change-more-dates"
              label={`${list.more} more`}
              end={<ChevronDown aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />}
              onClick={() => setExpanded(true)}
            />
          )}
        </StepList>
      )}
    </Step>
  );
}
