import { useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { EmptyState, PrimaryButton } from '@/modules/organiser/ui';

/**
 * A login with no events at all (INT-B S-4): Change, Cancel and Add a date all say
 * the same thing and offer the one step that can work, New event. One piece, so
 * the fact never reads two ways. `flow` names the test ids (`<flow>-which-event`,
 * `<flow>-empty-new`).
 */
export function NoEventsYet({ flow }: { flow: 'change' | 'cancel' | 'add' }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="No events yet"
      testId={`${flow}-which-event`}
      action={<PrimaryButton testId={`${flow}-empty-new`} onClick={() => navigate(ORG_PATHS.newWhat)}>New event</PrimaryButton>}
    />
  );
}
