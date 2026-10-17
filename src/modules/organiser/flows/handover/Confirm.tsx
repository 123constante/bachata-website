import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { handOverWarning } from '@/modules/organiser/shared/copy';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { organiserTeamQueryKey, transferOwnership } from '@/modules/organiser/shared/teamRpcApi';
import { canReceiveOwnership, firstName, memberLabel, memberShortName } from '@/modules/organiser/shared/teamModel';
import { OrganiserShell, ORG_PATHS } from '../../shell';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../../ui';
import { Avatar } from '../../team/Avatar';
import { useTeamContext } from '../../team/useTeamContext';
import { goDone } from '../doneState';

/**
 * C31 /handover/:userId (user_id, what organiser_transfer_ownership_v1 takes): the costly action, so the
 * ONE warning sentence (D14, D40), then "Hand over" = ONE transfer call, then Done (C32, no Undo: only the
 * new owner can hand it back).
 */
export default function Confirm() {
  const { userId = '' } = useParams();
  const { organiser, members, viewerRole, loading, failed, retry } = useTeamContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const member = members.find((m) => m.userId === userId) ?? null;

  const hand = useMutation({
    mutationFn: () => transferOwnership(organiser!.id, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      goDone(navigate, {
        title: 'Handed over',
        message: `${memberShortName(member!)} is the Owner - you are a Manager. Only ${firstName(memberLabel(member!))} can hand it back.`,
        seriesId: null,
      });
    },
    onError: (e) => setError(teamErrorMessage(e)),
  });

  return (
    <OrganiserShell title="Hand over" back={{ to: ORG_PATHS.handover, label: 'Back' }} testId="org-page-handover-confirm">
      <div className="flex flex-col gap-3 p-3">
        {loading ? (
          <SkeletonRows count={2} label="Loading" testId="handover-loading" />
        ) : failed ? (
          <ErrorState title="This did not load" onRetry={retry} testId="handover-load-error" />
        ) : !organiser || viewerRole !== 'owner' ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="handover-owner-only">Only the owner can hand the page over.</p>
        ) : !member || !canReceiveOwnership(member) ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="handover-missing">They cannot take over right now. <Link to={ORG_PATHS.handover} className="underline">Choose someone else</Link></p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={memberLabel(member)} photoUrl={member.photoUrl} size={48} />
              <p className="text-[16px] font-bold text-[var(--fg)]">{memberShortName(member)}</p>
            </div>
            <p className="text-[15px] text-[var(--fg)]" data-testid="handover-warning">{handOverWarning(organiser.name, memberShortName(member))}</p>
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="handover-error">{error}</p>}
            <PrimaryButton loading={hand.isPending} loadingLabel="Handing over" onClick={() => { setError(null); hand.mutate(); }} testId="handover-send">Hand over</PrimaryButton>
            <GhostButton disabled={hand.isPending} onClick={() => navigate(ORG_PATHS.handover, { replace: true })} testId="handover-keep">Keep it</GhostButton>
          </>
        )}
      </div>
    </OrganiserShell>
  );
}
