import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, removeOrganiserMember } from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { organiserTeamQueryKey, setTeamMember } from '@/modules/organiser/shared/teamRpcApi';
import { ROLE_LABEL, canReceiveOwnership, memberLabel, memberShortName } from '@/modules/organiser/shared/teamModel';
import { goDone } from '../flows/doneState';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../ui';
import { Avatar } from './Avatar';
import { useTeamContext } from './useTeamContext';

export const ROLE_EXPLAINER = 'Owners add and remove people, change roles and hand the page over. Managers edit every event and send it for review.';
export const OWNER_ONLY_ROLE = 'Only the owner changes roles';

/**
 * /account/o/team/:userId (C26): one person, keyed by user_id (what organiser_team_v1 returns and the
 * remove / hand-over RPCs take). The role explanation lives here (D20). The owner can remove them (Done
 * "Removed from the team", with "Add them back", no Undo, D49) and hand the page over; a Contributor can be
 * made a Manager. A manager sees the role with the change control disabled, with its reason (D50).
 */
export default function Person() {
  const { userId = '' } = useParams();
  const ctx = useTeamContext();
  const { organiser, members, viewerRole } = ctx;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = members.find((m) => m.userId === userId) ?? null;
  const name = member ? memberLabel(member) : 'Team';

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };
  const remove = useMutation({
    mutationFn: () => removeOrganiserMember(organiser!.id, userId),
    onSuccess: () => {
      refresh();
      goDone(navigate, { title: 'Removed', message: 'Removed from the team', seriesId: null, next: ORG_PATHS.teamAdd, nextLabel: 'Add them back' });
    },
    onError: (e) => setError(teamErrorMessage(e)),
  });
  const promote = useMutation({
    mutationFn: () => setTeamMember(organiser!.id, member!.email ?? '', 'manager'),
    onSuccess: () => { refresh(); goDone(navigate, { title: 'Role changed', message: `${memberShortName(member!)} is a Manager`, seriesId: null }); },
    onError: (e) => setError(teamErrorMessage(e)),
  });

  const isOwner = viewerRole === 'owner';
  const canRemove = isOwner && !!member && !member.isSelf && member.role !== 'owner';
  const canPromote = isOwner && !!member && !member.isSelf && member.role === 'contributor' && member.email !== null;

  return (
    <OrganiserShell title={name} back={{ to: ORG_PATHS.team, label: 'Team' }} testId="org-page-team-person">
      <div className="flex flex-col gap-3 p-3">
        {ctx.loading ? (
          <SkeletonRows count={2} label="Loading" testId="person-loading" />
        ) : ctx.failed ? (
          <ErrorState title="This did not load" onRetry={ctx.retry} testId="person-load-error" />
        ) : !organiser || !member ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="person-missing">They are not on the team any more. <Link to={ORG_PATHS.team} className="underline">Back to the team</Link></p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={name} photoUrl={member.photoUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-[var(--fg)] [overflow-wrap:anywhere]">{name}</p>
                <p className="text-[14px] text-[var(--mut)]" data-testid="person-role">{ROLE_LABEL[member.role]}{member.isSelf ? ' · you' : ''}</p>
              </div>
            </div>
            <p className="text-[14px] text-[var(--mut)]" data-testid="person-explainer">{ROLE_EXPLAINER}</p>
            {!isOwner && !member.isSelf && (
              <GhostButton disabled aria-describedby="person-role-reason" testId="person-change-role">Change role</GhostButton>
            )}
            {!isOwner && !member.isSelf && <p id="person-role-reason" className="text-[13px] text-[var(--mut)]" data-testid="person-role-reason">{OWNER_ONLY_ROLE}</p>}
            {canPromote && <GhostButton loading={promote.isPending} loadingLabel="Saving" onClick={() => { setError(null); promote.mutate(); }} testId="person-make-manager">Make Manager</GhostButton>}
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="person-error">{error}</p>}
            {isOwner && canReceiveOwnership(member) && (
              <Link to={ORG_PATHS.handoverTo(userId)} data-testid="person-hand-over" className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--card2)] text-[16px] font-bold text-[var(--fg)]">Hand the page over</Link>
            )}
            {member.isSelf && member.role !== 'owner' && (
              <Link to={ORG_PATHS.more} data-testid="person-leave" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--mut)]">Leave this team</Link>
            )}
            {canRemove && (asking ? (
              <div role="alertdialog" aria-label={`Remove ${name}?`} className="flex flex-col gap-2" data-testid="person-remove-confirm">
                <p className="text-[15px] text-[var(--fg)]">Remove {name}? They will no longer see or edit these events.</p>
                <PrimaryButton loading={remove.isPending} loadingLabel="Removing" onClick={() => { setError(null); remove.mutate(); }} testId="person-remove-yes">Remove</PrimaryButton>
                <GhostButton disabled={remove.isPending} onClick={() => setAsking(false)} testId="person-remove-no">Keep them</GhostButton>
              </div>
            ) : (
              <GhostButton onClick={() => setAsking(true)} testId="person-remove">Remove from the team</GhostButton>
            ))}
          </>
        )}
      </div>
    </OrganiserShell>
  );
}
