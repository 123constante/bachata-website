import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { Card, GhostButton, PrimaryButton, SectionLabel } from '../ui';
import { FAILURE_TEXT, invitationsQueryKey, OrganiserApiError, respondToInvite, useMyInvitations } from './organiserApi';
import { INVITATIONS_TITLE, invitationLine, type Invitation } from './organiserModel';

/** Pure view: one row per invitation, Accept and Decline. Mounted on Home by C12 through <InvitationsList />. */
export function InvitationsView({ invitations, busyId, error, notice = null, onRespond }: {
  invitations: Invitation[]; busyId: string | null; error: string | null; notice?: string | null; onRespond: (i: Invitation, accept: boolean) => void;
}) {
  if (invitations.length === 0 && !notice) return null;
  return (
    <section aria-label={INVITATIONS_TITLE} data-testid="org-invitations" className="flex flex-col gap-[8px]">
      <SectionLabel>{INVITATIONS_TITLE}</SectionLabel>
      {invitations.length > 0 && <Card testId="org-invitations-card">
        {invitations.map((i) => (
          <div key={i.inviteId} data-testid="org-invitation" className="flex flex-col gap-[8px] px-[16px] py-[12px]">
            <p className="text-[15px] text-[var(--fg)]" data-testid="org-invitation-line">{invitationLine(i)}</p>
            <div className="flex gap-[8px]">
              <PrimaryButton size="sm" block={false} testId="org-invitation-accept" loading={busyId === i.inviteId} disabled={busyId !== null} onClick={() => onRespond(i, true)}>Accept</PrimaryButton>
              <GhostButton size="sm" block={false} testId="org-invitation-decline" disabled={busyId !== null} onClick={() => onRespond(i, false)}>Decline</GhostButton>
            </div>
          </div>
        ))}
      </Card>}
      {notice && <p role="status" className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-invitations-withdrawn">{notice}</p>}
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
  const [notice, setNotice] = useState<string | null>(null);
  const respond = useMutation({
    mutationFn: ({ i, accept }: { i: Invitation; accept: boolean }) => respondToInvite(i.inviteId, accept),
    onSuccess: () => { setError(null); setNotice(null); },
    // F4: an invite cancelled under the invitee is "withdrawn", not an error to retry forever.
    onError: (e) => {
      const kind = e instanceof OrganiserApiError ? e.kind : 'failed';
      if (kind === 'gone') { setError(null); setNotice(FAILURE_TEXT.gone); } else { setNotice(null); setError(FAILURE_TEXT[kind]); }
    },
    // Every settle refetches, so a gone invite never stays answerable.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey(user?.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
  });
  return (
    <InvitationsView invitations={list.data ?? []} busyId={respond.isPending ? respond.variables?.i.inviteId ?? null : null} error={error} notice={notice}
      onRespond={(i, accept) => respond.mutate({ i, accept })} />
  );
}
