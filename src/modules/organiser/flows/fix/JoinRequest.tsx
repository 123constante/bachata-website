import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, incomingAccessRequestsQueryKey, resolveAccessRequest } from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { addTeamMemberByProfile, organiserTeamQueryKey } from '@/modules/organiser/shared/teamRpcApi';
import { instantDateLabel, type IncomingAccessRequest } from '@/modules/organiser/shared/teamModel';
import { Avatar } from '@/modules/organiser/team/Avatar';
import { GhostButton, PrimaryButton, useShake } from '@/modules/organiser/ui';

/**
 * C16 -> C17, the Home `join_request` row, shown ABOVE the Team list (D9). "Add as Manager" is
 * ONE organiser_team_add_member_by_profile_v1 (the requester's profile id is their user id: a
 * login always gets its own dancer profile), then the request is closed best-effort so it does
 * not linger; "Decline" is the existing resolve call. `blockedReason` disables both (team full).
 */
export function JoinRequestCard({ organiserId, request, blockedReason, onAnswered }: {
  organiserId: string;
  request: IncomingAccessRequest;
  blockedReason: string | null;
  onAnswered: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { shake, shakeProps } = useShake();
  const who = request.requesterEmail ?? 'Someone';
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: incomingAccessRequestsQueryKey(organiserId) });
    void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiserId) });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };
  const fail = (err: unknown) => { setError(teamErrorMessage(err)); shake(); };

  const add = useMutation({
    mutationFn: async () => {
      await addTeamMemberByProfile(organiserId, request.userId, 'manager', null);
      // Close the request so it leaves the card; a refusal here (not the owner, already answered) changes nothing.
      try { await resolveAccessRequest(request.requestId, 'grant'); } catch { /* the member is added either way */ }
    },
    onSuccess: () => { settle(); onAnswered(`${who} is a Manager`); },
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: () => resolveAccessRequest(request.requestId, 'decline'),
    onSuccess: () => { settle(); onAnswered(`Declined. ${who} can ask again later.`); },
    onError: fail,
  });
  const pending = add.isPending || decline.isPending;
  const asked = instantDateLabel(request.createdAt);

  return (
    <div data-testid="join-request" className={`space-y-[8px] p-[16px] ${shakeProps.className ?? ''}`} onAnimationEnd={shakeProps.onAnimationEnd}>
      <div className="flex items-center gap-[12px]">
        <Avatar name={who} photoUrl={null} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-[var(--fg)] [overflow-wrap:anywhere]">{who}</span>
          <span className="block text-[13px] text-[var(--mut)]">{asked ? `Asked ${asked} to join` : 'Wants to join'}</span>
        </span>
      </div>
      {request.message && <p className="text-[14px] text-[var(--fg)] [overflow-wrap:anywhere]" data-testid="join-request-message">&ldquo;{request.message}&rdquo;</p>}
      {blockedReason && <p className="text-[13px] text-[var(--mut)]" data-testid="join-request-blocked">{blockedReason}</p>}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="join-request-error">{error}</p>}
      <div className="flex flex-col gap-[8px]">
        <PrimaryButton size="sm" disabled={!!blockedReason || pending} loading={add.isPending} loadingLabel="Adding" onClick={() => { setError(null); add.mutate(); }} testId="join-request-add">
          Add as Manager
        </PrimaryButton>
        <GhostButton size="sm" disabled={pending} loading={decline.isPending} loadingLabel="Declining" onClick={() => { setError(null); decline.mutate(); }} testId="join-request-decline">
          Decline
        </GhostButton>
      </div>
    </div>
  );
}
