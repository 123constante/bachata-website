import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { NEXT_LABEL, readDoneState } from './doneState';

/**
 * The one Done screen every flow ends on (D29, D51): the confirmation line and
 * ONE button "Back to Home", plus the `next` button when the flow gives one
 * (D61). No Undo (D49). A reload has no router state, so it goes Home.
 */
export default function Done() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = readDoneState(location.state);
  if (!state) return <Navigate to={ORG_PATHS.home} replace />;
  return (
    <OrganiserShell title={state.title}>
      <div className="flex flex-col gap-3 p-3" data-testid="org-done">
        <p className="flex items-center gap-2 text-[16px] font-bold" role="status" data-testid="org-done-message">
          <CheckCircle2 aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--ok-fg)]" />
          {state.message}
        </p>
        <PrimaryButton testId="org-done-home" onClick={() => navigate(ORG_PATHS.home, { replace: true })}>
          Back to Home
        </PrimaryButton>
        {state.next && (
          <GhostButton testId="org-done-next" onClick={() => navigate(state.next as string, { replace: true })}>
            {NEXT_LABEL}
          </GhostButton>
        )}
      </div>
    </OrganiserShell>
  );
}
