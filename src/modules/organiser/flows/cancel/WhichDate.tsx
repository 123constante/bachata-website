import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { cancelDates, cancellableSeries, findSeries, seriesLock } from '../add/addModel';
import { useFlowHome, useSeriesWorkspace } from '../add/useFlow';
import { Failed, Loading, Missing, Refusal, Step, StepList, StepRow } from '../add/parts';

/**
 * C12: which date. The coming SCHEDULED dates of one event (a cancelled date
 * is put back, not cancelled again); none left -> one action, Add a date.
 */
export default function WhichDate() {
  const navigate = useNavigate();
  const { seriesId = '' } = useParams();
  const home = useFlowHome();
  const one = findSeries(home.data, seriesId);
  const lock = one ? seriesLock(one.lifecycle_status, 'cancel') : null;
  const ws = useSeriesWorkspace(seriesId, !!one && !lock);
  const back = cancellableSeries(home.data).length === 1 ? ORG_PATHS.home : ORG_PATHS.cancel;
  const dates = one && home.data && ws.data ? cancelDates(one, ws.data, home.data.today) : [];

  return (
    <Step title={one?.name ?? 'Which date?'} back={back}>
      {home.isError || ws.isError ? (
        <Failed flow="cancel" onRetry={() => { void home.refetch(); void ws.refetch(); }} />
      ) : !home.data ? (
        <Loading flow="cancel" />
      ) : !one ? (
        <Missing flow="cancel" />
      ) : lock ? (
        <Refusal flow="cancel" text={lock} back={ORG_PATHS.home} backLabel="Back to Home" />
      ) : !ws.data ? (
        <Loading flow="cancel" />
      ) : dates.length === 0 ? (
        <EmptyState
          title="No dates to cancel"
          testId="cancel-which-date"
          action={<PrimaryButton testId="cancel-empty-add" onClick={() => navigate(ORG_PATHS.addEvent(seriesId))}>Add a date</PrimaryButton>}
        />
      ) : (
        <StepList testId="cancel-which-date">
          {dates.map((d) => (
            <StepRow
              key={d.occurrenceId}
              testId="cancel-date-row"
              label={d.label}
              sub={d.time ?? undefined}
              onClick={() => navigate(ORG_PATHS.cancelDate(seriesId, d.occurrenceId))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
