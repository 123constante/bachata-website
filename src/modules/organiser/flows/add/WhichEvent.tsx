import { Navigate, useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { comingDates } from '@/modules/organiser/shared/dateList';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { NoEventsYet } from '../NoEventsYet';
import { addBlock, addableSeries } from './addModel';
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
        <NoEventsYet flow="add" />
      ) : (
        <StepList testId="add-which-event">
          {list.map((s) => (
            <StepRow
              key={s.id}
              testId="add-event-row"
              label={s.name}
              // A row that cannot work is disabled with its reason (open call S3): 27 of 67 live
              // events sat at the 30-date cap and 7 festivals held their one date on 2026-10-17.
              reason={addBlock(s, undefined, home.data.today)}
              sub={comingDates(s, home.data.today, 1)[0]?.label ?? (s.lifecycle_status === 'draft' ? lifecycleTag('draft').label : 'No dates')}
              onClick={() => navigate(ORG_PATHS.addEvent(s.id))}
            />
          ))}
        </StepList>
      )}
    </Step>
  );
}
