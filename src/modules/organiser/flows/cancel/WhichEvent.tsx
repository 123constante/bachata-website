import { Navigate, useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { comingDates } from '@/modules/organiser/shared/dateList';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { listedSeries } from '@/modules/organiser/events/eventsApi';
import { NoEventsYet } from '../NoEventsYet';
import { cancellableSeries } from '../add/addModel';
import { useFlowHome } from '../add/useFlow';
import { Failed, Loading, Step, StepList, StepRow } from '../add/parts';

/** C11: which event. One qualifying event skips straight to its dates (D34). */
export default function WhichEvent() {
  const navigate = useNavigate();
  const home = useFlowHome();
  const list = cancellableSeries(home.data);
  if (home.data && list.length === 1) return <Navigate to={ORG_PATHS.cancelEvent(list[0].id)} replace />;
  return (
    <Step title="Which event?" back={ORG_PATHS.home}>
      {home.isError ? (
        <Failed flow="cancel" onRetry={() => void home.refetch()} />
      ) : !home.data ? (
        <Loading flow="cancel" />
      ) : listedSeries(home.data.organisers).length === 0 ? (
        <NoEventsYet flow="cancel" />
      ) : list.length === 0 ? (
        <EmptyState
          title="No dates to cancel"
          testId="cancel-which-event"
          action={<PrimaryButton testId="cancel-empty-add" onClick={() => navigate(ORG_PATHS.add)}>Add a date</PrimaryButton>}
        />
      ) : (
        <StepList testId="cancel-which-event">
          {list.map((s) => (
            <StepRow
              key={s.id}
              testId="cancel-event-row"
              label={s.name}
              sub={comingDates(s, home.data.today, 1)[0]?.label}
              onClick={() => navigate(ORG_PATHS.cancelEvent(s.id))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
