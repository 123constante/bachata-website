import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ORGANISER_HOME_KEY,
  fetchIncomingAccessRequests,
  incomingAccessRequestsQueryKey,
  removeOrganiserMember,
  resolveAccessRequest,
  teamOf,
  type AccessDecision,
  type HomeOrganiser,
} from '../selfServeApi';
import { teamErrorMessage } from '../selfServeErrors';
import {
  ROLE_LABEL,
  howToAddManager,
  instantDateLabel,
  memberAction,
  memberLabel,
  type IncomingAccessRequest,
  type TeamMember,
  type TeamRole,
} from '../teamModel';

/**
 * The team page body (Lever 2 W6, mockup 05-B's account page; 04-C's team tab
 * as its own page): who runs the organiser, who is asking to, and the three
 * writes the server offers an owner (remove a manager, leave, grant or
 * decline a request). Adding a manager IS granting their request: there is no
 * add-by-email RPC, so the page says how a person asks. A manager sees the
 * same lists and may only leave.
 */

function MemberRow({
  member, viewerRole, team, onConfirm, confirming, pending, onCancel, onRemove,
}: {
  member: TeamMember; viewerRole: TeamRole; team: TeamMember[];
  confirming: boolean; pending: boolean;
  onConfirm: () => void; onCancel: () => void; onRemove: () => void;
}) {
  const action = memberAction(member, viewerRole, team);
  const label = memberLabel(member);
  return (
    <li className="py-2 space-y-1" data-testid="team-member" data-role={member.role} data-self={member.isSelf ? 'true' : 'false'}>
      {/* Wraps (S3): a long email takes the first line and the role and Leave/Remove drop below it, never off-screen. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-sm font-medium break-all">
            {label}
            {member.isSelf && <span className="text-muted-foreground font-normal"> &middot; you</span>}
          </p>
          {member.displayName && member.email && <p className="text-xs text-muted-foreground break-all">{member.email}</p>}
        </div>
        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-[11px] shrink-0">{ROLE_LABEL[member.role]}</Badge>
        {action && !confirming && (
          <Button
            type="button" size="sm" variant="outline" className="shrink-0"
            disabled={!action.enabled || pending}
            onClick={onConfirm}
            data-testid={`member-${action.kind}`}
          >
            {action.kind === 'leave' ? 'Leave' : 'Remove'}
          </Button>
        )}
      </div>
      {action && !action.enabled && <p className="text-xs text-muted-foreground" data-testid="member-note">{action.note}</p>}
      {action && confirming && (
        <div className="flex flex-wrap items-center gap-2" data-testid="member-confirm">
          <p className="text-sm w-full">
            {action.kind === 'leave'
              ? 'Leave this team? You will no longer see or edit its events.'
              : `Remove ${label}? They will no longer see or edit these events.`}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Keep</Button>
          <Button type="button" size="sm" variant="destructive" onClick={onRemove} disabled={pending} data-testid="member-confirm-yes">
            {pending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {action.kind === 'leave' ? 'Leave' : 'Remove'}
          </Button>
        </div>
      )}
    </li>
  );
}

function RequestRow({ request, canDecide, pending, onDecide }: {
  request: IncomingAccessRequest; canDecide: boolean; pending: boolean; onDecide: (decision: AccessDecision) => void;
}) {
  const asked = instantDateLabel(request.createdAt);
  return (
    <li className="py-2 space-y-1" data-testid="access-request">
      <p className="text-sm font-medium break-all" data-testid="request-email">{request.requesterEmail ?? 'Someone'}</p>
      {request.message && <p className="text-sm text-muted-foreground" data-testid="request-message">&ldquo;{request.message}&rdquo;</p>}
      <p className="text-xs text-muted-foreground">{asked ? `Asked ${asked}` : 'Asked to join'} &middot; wants to be a manager</p>
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => onDecide('grant')} data-testid="request-grant">
            <UserPlus className="w-4 h-4" aria-hidden="true" /> Add as manager
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onDecide('decline')} data-testid="request-decline">
            Decline
          </Button>
        </div>
      )}
    </li>
  );
}

export function TeamPanel({ organiser }: { organiser: HomeOrganiser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const team = teamOf(organiser);
  const viewerRole: TeamRole = organiser.role === 'owner' ? 'owner' : 'manager';
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser.id),
    queryFn: () => fetchIncomingAccessRequests(organiser.id),
  });

  const remove = useMutation({
    mutationFn: (member: TeamMember) => removeOrganiserMember(organiser.id, member.userId),
    onSuccess: (result, member) => {
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      if (result.selfRemoved) {
        navigate('/account', { replace: true });
        return;
      }
      setConfirmation(`${memberLabel(member)} no longer has access.`);
    },
    onError: (err) => setError(teamErrorMessage(err)),
  });

  const decide = useMutation({
    mutationFn: ({ request, decision }: { request: IncomingAccessRequest; decision: AccessDecision }) =>
      resolveAccessRequest(request.requestId, decision),
    onSuccess: (_result, { request, decision }) => {
      void queryClient.invalidateQueries({ queryKey: incomingAccessRequestsQueryKey(organiser.id) });
      if (decision === 'grant') void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      setConfirmation(
        decision === 'grant'
          ? `${request.requesterEmail ?? 'They'} can now edit ${organiser.name}'s events as a manager.`
          : `Declined. ${request.requesterEmail ?? 'They'} can ask again later.`,
      );
    },
    onError: (err) => setError(teamErrorMessage(err)),
  });

  const pending = remove.isPending || decide.isPending;
  const act = (fn: () => void) => { setError(null); setConfirmation(null); fn(); };

  return (
    <div className="space-y-4" data-testid="team-panel">
      {confirmation && (
        <p className="text-sm text-primary flex items-start gap-2" role="status" data-testid="team-confirmation">
          <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {confirmation}
        </p>
      )}
      {error && <p className="text-xs text-destructive" role="alert" data-testid="team-error">{error}</p>}

      {/* minmax(0,1fr): a bare grid track is min-content wide, so a long email stretched the page past the screen (S3). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:items-start">
        <section className="min-w-0 rounded-md border border-border p-3 space-y-2" aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-base font-semibold">Team</h2>
          <ul className="divide-y divide-border/60" data-testid="team-list">
            {team.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                viewerRole={viewerRole}
                team={team}
                confirming={confirming === m.userId}
                pending={pending}
                onConfirm={() => act(() => setConfirming(m.userId))}
                onCancel={() => setConfirming(null)}
                onRemove={() => act(() => remove.mutate(m))}
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground" data-testid="team-note">
            Managers can edit everything and send events for review; only an owner can add or remove people.
          </p>
        </section>

        <section className="min-w-0 rounded-md border border-border p-3 space-y-2" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="text-base font-semibold">Access requests</h2>
          {requests.isLoading ? (
            <Skeleton className="h-12 w-full rounded-md" />
          ) : requests.isError ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm">We couldn&rsquo;t load the requests.</p>
              <Button size="sm" variant="outline" onClick={() => void requests.refetch()}>Try again</Button>
            </div>
          ) : (requests.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="requests-empty">No one is asking for access right now.</p>
          ) : (
            <ul className="divide-y divide-border/60" data-testid="requests-list">
              {(requests.data ?? []).map((r) => (
                <RequestRow
                  key={r.requestId}
                  request={r}
                  canDecide={viewerRole === 'owner'}
                  pending={pending}
                  onDecide={(decision) => act(() => decide.mutate({ request: r, decision }))}
                />
              ))}
            </ul>
          )}
          {viewerRole !== 'owner' && (requests.data ?? []).length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="requests-owner-only">Only an owner can add them.</p>
          )}
          <p className="text-xs text-muted-foreground" data-testid="access-howto">{howToAddManager(organiser.name)}</p>
        </section>
      </div>
    </div>
  );
}
