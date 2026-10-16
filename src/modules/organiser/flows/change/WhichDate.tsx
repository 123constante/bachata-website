import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { changeableSeries, changeDates, findSeries } from './changeModel';
import { useChangeHome, useSeriesWorkspace } from './useChange';
import { Failed, Loading, Missing, Step, StepList, StepRow } from './parts';

/** C3: which date. The coming dates of one event (D34): weekday, day, full month, time. */
export default function WhichDate() {
  const navigate = useNavigate();
  const { seriesId = '' } = useParams();
  const home = useChangeHome();
  const ws = useSeriesWorkspace(seriesId);
  const one = findSeries(home.data, seriesId);
  // The one-event organiser came straight here: back goes Home, not to a one-row list.
  const back = changeableSeries(home.data).length === 1 ? ORG_PATHS.home : ORG_PATHS.change;
  const dates = one && home.data && one.lifecycle_status === 'live' ? changeDates(one, ws.data, home.data.today) : [];

  return (
    <Step title={one?.name ?? 'Which date?'} back={back}>
      {home.isError ? (
        <Failed onRetry={() => void home.refetch()} />
      ) : !home.data ? (
        <Loading />
      ) : !one ? (
        <Missing />
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
        </StepList>
      )}
    </Step>
  );
}
