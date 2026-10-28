import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, removeOrganiserMember } from '@/modules/organiser/shared/selfServeApi';
import { ROLE_HELP, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { organiserTeamQueryKey, setTeamMember } from '@/modules/organiser/shared/teamRpcApi';
import { ROLE_LABEL, canReceiveOwnership, memberLabel, memberShortName } from '@/modules/organiser/shared/teamModel';
import { TEAM_REASONS, canLeave, canManagePeople, canRemove as removeGate } from '@/modules/organiser/shared/teamRules';
import { goDone } from '../flows/doneState';
import { useOrgSurface } from '../shell/surface';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../ui';
import { Avatar } from './Avatar';
import { GateReason } from './GateReason';
import { useTeamContext } from './useTeamContext';

/** The role explanation: the ONE string in selfServeErrors, shared with the /page picker (A-S5). */
export const ROLE_EXPLAINER = ROLE_HELP;
export const OWNER_ONLY_ROLE = TEAM_REASONS.roles;

/**
 * /account/o/team/:userId (C26): one person, keyed by user_id (what organiser_team_v1 returns and the
 * remove / hand-over RPCs take). The role explanation lives here (D20). The owner can remove them (Done
 * "Removed from the team", with "Add them back", no Undo, D49) and hand the page over; a Contributor can be
 * made a Manager. A manager sees the role with the change control disabled, with its reason (D50).
 */
export default function Person() {
  const { userId = '' } = useParams();
  const ctx = useTeamContext();
  const { Shell, paths, doneBack } = useOrgSurface();
  const { organiser, members, viewerRole } = ctx;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The inline confirm swaps the focused button out: focus goes into it on open, back to Remove on Keep (B-S8).
  const confirmRef = useRef<HTMLDivElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const backToRemove = useRef(false);
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (backToRemove.current) {
      backToRemove.current = false;
      removeRef.current?.focus();
    }
  }, [asking]);
  const member = members.find((m) => m.userId === userId) ?? null;
  const name = member ? memberLabel(member) : 'Team';

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };
  // Cache refresh stays on the mutation; the navigate to Done rides mutate()'s own callbacks, which
  // TanStack drops once this screen unmounts, so a late answer never yanks the person off another screen.
  const remove = useMutation({
    mutationFn: () => removeOrganiserMember(organiser!.id, userId),
    onSuccess: refresh,
    onError: (e) => setError(teamErrorMessage(e)),
  });
  const removeDone = () => goDone(navigate, { title: 'Removed', message: 'Removed from the team', seriesId: null, next: member?.displayName ? paths.teamAddFor(member.displayName) : paths.teamAdd, nextLabel: 'Add them back' }, doneBack, paths.done);
  const promote = useMutation({
    mutationFn: () => setTeamMember(organiser!.id, member!.email ?? '', 'manager'),
    onSuccess: refresh,
    onError: (e) => setError(teamErrorMessage(e)),
  });
  const promoteDone = () => goDone(navigate, { title: 'Role changed', message: `${memberShortName(member!)} is a Manager`, seriesId: null }, doneBack, paths.done);

  const isOwner = viewerRole === 'owner';
  // What the RPCs accept, from the ONE mapping (teamRules).
  const manageGate = canManagePeople(viewerRole, members);
  const remover = member ? removeGate(viewerRole, members, member) : null;
  const canRemove = !!remover?.ok;
  const leaveGate = member?.isSelf ? canLeave(members) : null;
  const canPromote = isOwner && !!member && !member.isSelf && member.role === 'contributor' && member.email !== null;

  return (
    <Shell title={name} back={{ to: paths.team, label: 'Team' }} testId="org-page-team-person">
      <div className="flex flex-col gap-3 p-3">
        {ctx.loading ? (
          <SkeletonRows count={2} label="Loading" testId="person-loading" />
        ) : ctx.failed ? (
          <ErrorState title="This did not load" onRetry={ctx.retry} testId="person-load-error" />
        ) : !organiser || !member ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="person-missing">They are not on the team any more. <Link to={paths.team} className="underline">Back to the team</Link></p>
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
            {!isOwner && !member.isSelf && <GateReason gate={manageGate} id="person-role-reason" testId="person-role-reason" />}
            {canPromote && <GhostButton loading={promote.isPending} loadingLabel="Saving" onClick={() => { setError(null); promote.mutate(undefined, { onSuccess: promoteDone }); }} testId="person-make-manager">Make Manager</GhostButton>}
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="person-error">{error}</p>}
            {isOwner && canReceiveOwnership(member) && (
              <Link to={paths.handoverTo(userId)} data-testid="person-hand-over" className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--card2)] text-[16px] font-bold text-[var(--fg)]">Hand the page over</Link>
            )}
            {leaveGate?.ok && (
              <Link to={paths.more} data-testid="person-leave" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--mut)]">Leave this page</Link>
            )}
            {leaveGate && !leaveGate.ok && (
              <>
                <GhostButton disabled testId="person-leave" aria-describedby="person-leave-reason">Leave this page</GhostButton>
                <GateReason gate={leaveGate} id="person-leave-reason" testId="person-leave-reason" />
              </>
            )}
            {canRemove && (asking ? (
              <div ref={confirmRef} role="group" tabIndex={-1} aria-label={`Remove ${name}?`} className="flex flex-col gap-2 outline-none" data-testid="person-remove-confirm">
                <p className="text-[15px] text-[var(--fg)]">Remove {name}? They will no longer see or edit these events.</p>
                <PrimaryButton loading={remove.isPending} loadingLabel="Removing" onClick={() => { setError(null); remove.mutate(undefined, { onSuccess: removeDone }); }} testId="person-remove-yes">Remove</PrimaryButton>
                <GhostButton disabled={remove.isPending} onClick={() => { backToRemove.current = true; setAsking(false); }} testId="person-remove-no">Keep them</GhostButton>
              </div>
            ) : (
              <GhostButton ref={removeRef} onClick={() => setAsking(true)} testId="person-remove">Remove from the team</GhostButton>
            ))}
            {isOwner && remover && !remover.ok && (
              <>
                <GhostButton disabled testId="person-remove" aria-describedby="person-remove-reason">Remove from the team</GhostButton>
                <GateReason gate={remover} id="person-remove-reason" testId="person-remove-reason" />
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
