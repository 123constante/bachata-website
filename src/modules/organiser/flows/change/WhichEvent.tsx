import { Navigate, useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { comingDates } from '@/modules/organiser/shared/dateList';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { changeableSeries } from './changeModel';
import { useChangeHome } from './useChange';
import { Failed, Loading, Step, StepList, StepRow } from './parts';

/** C2: which event. One qualifying event skips straight to its dates (D34). */
export default function WhichEvent() {
  const navigate = useNavigate();
  const home = useChangeHome();
  const list = changeableSeries(home.data);
  if (home.data && list.length === 1) return <Navigate to={ORG_PATHS.changeEvent(list[0].id)} replace />;
  return (
    <Step title="Which event?" back={ORG_PATHS.home}>
      {home.isError ? (
        <Failed onRetry={() => void home.refetch()} />
      ) : !home.data ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          title="No coming dates"
          testId="change-which-event"
          action={<PrimaryButton testId="change-empty-add" onClick={() => navigate(ORG_PATHS.add)}>Add a date</PrimaryButton>}
        />
      ) : (
        <StepList testId="change-which-event">
          {list.map((s) => (
            <StepRow
              key={s.id}
              testId="change-event-row"
              label={s.name}
              sub={comingDates(s, home.data.today, 1)[0]?.label}
              onClick={() => navigate(ORG_PATHS.changeEvent(s.id))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
