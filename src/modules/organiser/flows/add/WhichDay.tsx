import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { addDays, addableSeries, findSeries, seriesLock } from './addModel';
import { useFlowHome, useSeriesWorkspace } from './useFlow';
import { Failed, Loading, Missing, Refusal, Step, StepList, StepRow } from './parts';

/**
 * C8: which day (also C15, the Home "no dates left" row: the same screen with
 * the event pre-chosen, its name the only header). The next 30 days minus the
 * days that already hold a date of this event; at the 30-date cap every day is
 * disabled with the reason on its sub-line.
 */
export default function WhichDay() {
  const navigate = useNavigate();
  const { seriesId = '' } = useParams();
  const home = useFlowHome();
  const one = findSeries(home.data, seriesId);
  const lock = one ? seriesLock(one.lifecycle_status, 'add') : null;
  const ws = useSeriesWorkspace(seriesId, !!one && !lock);
  // The one-event organiser came straight here: back goes Home, not to a one-row list.
  const back = addableSeries(home.data).length === 1 ? ORG_PATHS.home : ORG_PATHS.add;

  return (
    <Step title={one?.name ?? 'Which day?'} back={back}>
      {home.isError || ws.isError ? (
        <Failed flow="add" error={ws.error} onRetry={() => { void home.refetch(); void ws.refetch(); }} />
      ) : !home.data ? (
        <Loading flow="add" />
      ) : !one ? (
        <Missing flow="add" />
      ) : lock ? (
        <Refusal flow="add" text={lock} back={ORG_PATHS.home} backLabel="Back to Home" />
      ) : !ws.data ? (
        <Loading flow="add" />
      ) : (
        <StepList testId="add-which-day">
          {addDays(one, ws.data, home.data.today).map((d) => (
            <StepRow
              key={d.date}
              testId="add-day-row"
              label={d.label}
              reason={d.reason}
              onClick={() => navigate(ORG_PATHS.addDate(seriesId, d.date))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
