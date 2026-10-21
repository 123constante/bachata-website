import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { Card, GhostButton, PrimaryButton, SectionLabel } from '../ui';
import { FAILURE_TEXT, invitationsQueryKey, OrganiserApiError, respondToInvite, useMyInvitations } from './organiserApi';
import { INVITATIONS_TITLE, invitationLine, type Invitation } from './organiserModel';

/** Pure view: one row per invitation, Accept and Decline. Mounted on Home by C12 through <InvitationsList />. */
export function InvitationsView({ invitations, busyId, error, onRespond }: {
  invitations: Invitation[]; busyId: string | null; error: string | null; onRespond: (i: Invitation, accept: boolean) => void;
}) {
  if (invitations.length === 0) return null;
  return (
    <section aria-label={INVITATIONS_TITLE} data-testid="org-invitations" className="flex flex-col gap-[8px]">
      <SectionLabel>{INVITATIONS_TITLE}</SectionLabel>
      <Card testId="org-invitations-card">
        {invitations.map((i) => (
          <div key={i.inviteId} data-testid="org-invitation" className="flex flex-col gap-[8px] px-[16px] py-[12px]">
            <p className="text-[15px] text-[var(--fg)]" data-testid="org-invitation-line">{invitationLine(i)}</p>
            <div className="flex gap-[8px]">
              <PrimaryButton size="sm" block={false} testId="org-invitation-accept" loading={busyId === i.inviteId} disabled={busyId !== null} onClick={() => onRespond(i, true)}>Accept</PrimaryButton>
              <GhostButton size="sm" block={false} testId="org-invitation-decline" disabled={busyId !== null} onClick={() => onRespond(i, false)}>Decline</GhostButton>
            </div>
          </div>
        ))}
      </Card>
      {error && <p role="alert" className="px-[4px] text-[14px] text-[var(--danger)]" data-testid="org-invitations-error">{error}</p>}
    </section>
  );
}

/** Home "Invitations" (ER-C11). Renders nothing when there are none or the server is not there yet. */
export function InvitationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useMyInvitations();
  const [error, setError] = useState<string | null>(null);
  const respond = useMutation({
    mutationFn: ({ i, accept }: { i: Invitation; accept: boolean }) => respondToInvite(i.inviteId, accept),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey(user?.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
    onError: (e) => setError(FAILURE_TEXT[e instanceof OrganiserApiError ? e.kind : 'failed']),
  });
  return (
    <InvitationsView invitations={list.data ?? []} busyId={respond.isPending ? respond.variables?.i.inviteId ?? null : null} error={error}
      onRespond={(i, accept) => respond.mutate({ i, accept })} />
  );
}
