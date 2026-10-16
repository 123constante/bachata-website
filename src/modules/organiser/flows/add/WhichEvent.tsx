import { Navigate, useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { comingDates } from '@/modules/organiser/shared/dateList';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';
import { CAP_NOTE } from '@/modules/organiser/events/dateCap';
import { addableSeries, atCap } from './addModel';
import { useFlowHome } from './useFlow';
import { Failed, Loading, Step, StepList, StepRow } from './parts';

/** C7: which event. One qualifying event skips straight to its days (D34). */
export default function WhichEvent() {
  const navigate = useNavigate();
  const home = useFlowHome();
  const list = addableSeries(home.data);
  if (home.data && list.length === 1) return <Navigate to={ORG_PATHS.addEvent(list[0].id)} replace />;
  return (
    <Step title="Which event?" back={ORG_PATHS.home}>
      {home.isError ? (
        <Failed flow="add" onRetry={() => void home.refetch()} />
      ) : !home.data ? (
        <Loading flow="add" />
      ) : list.length === 0 ? (
        <EmptyState
          title="No events yet"
          testId="add-which-event"
          action={<PrimaryButton testId="add-empty-new" onClick={() => navigate(ORG_PATHS.newWhat)}>New event</PrimaryButton>}
        />
      ) : (
        <StepList testId="add-which-event">
          {list.map((s) => (
            <StepRow
              key={s.id}
              testId="add-event-row"
              label={s.name}
              // 27 of 67 live events held 30+ coming dates on 2026-10-16: say so before the day list does.
              sub={atCap(s, undefined, home.data.today)
                ? CAP_NOTE
                : comingDates(s, home.data.today, 1)[0]?.label ?? (s.lifecycle_status === 'draft' ? 'Draft' : 'No dates')}
              onClick={() => navigate(ORG_PATHS.addEvent(s.id))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
