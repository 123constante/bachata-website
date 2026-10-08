import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import {
  ORGANISER_HOME_KEY,
  fetchIncomingAccessRequests,
  incomingAccessRequestsQueryKey,
  removeOrganiserMember,
  resolveAccessRequest,
  teamOf,
  type AccessDecision,
  type HomeOrganiser,
} from '@/modules/organiser-self-serve/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser-self-serve/selfServeErrors';
import {
  ROLE_LABEL,
  howToAddManager,
  instantDateLabel,
  memberAction,
  memberLabel,
  type IncomingAccessRequest,
  type TeamMember,
  type TeamRole,
} from '@/modules/organiser-self-serve/teamModel';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  AnnounceRegion,
  Card,
  Collapse,
  EmptyState,
  ErrorState,
  GhostButton,
  PersonRow,
  PrimaryButton,
  SkeletonRows,
  useAnnounce,
  useShake,
} from '../ui';
import { OrganiserSwitcher } from '../profile/OrganiserSwitcher';
import { useOrganiserChoice } from '../profile/useOrganiserChoice';

/**
 * /account/o/team (W4). Who runs the organiser and who is asking to. The
 * server offers an owner three writes: remove a manager, leave, and grant or
 * decline a request; a manager may only leave. Adding a person IS granting
 * their request (there is no add-by-email RPC) and there is no change-role
 * RPC, so roles are shown, never edited. Buttons a viewer cannot use stay
 * visible, disabled, with the reason underneath.
 */

/** Which inline question is open; only one at a time, so one primary button. */
type Asking = { kind: 'member'; id: string } | { kind: 'grant'; id: string } | null;

const NOTE = 'px-4 pb-3 text-[13px] text-[var(--mut)]';

function Question({ text, yes, no, onYes, onNo, pending, error, shakeProps, testId }: {
  text: string; yes: string; no: string; onYes: () => void; onNo: () => void; pending: boolean;
  error: string | null; shakeProps: { className?: string; onAnimationEnd?: () => void }; testId: string;
}) {
  return (
    <div role="alertdialog" aria-label={text} data-testid={testId} className={`space-y-2 px-4 pb-4 ${shakeProps.className ?? ''}`} onAnimationEnd={shakeProps.onAnimationEnd}>
      <p className="text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{text}</p>
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid={`${testId}-error`}>{error}</p>}
      <div className="flex flex-col gap-2">
        <GhostButton size="sm" onClick={onNo} disabled={pending} autoFocus testId={`${testId}-no`}>{no}</GhostButton>
        <PrimaryButton size="sm" onClick={onYes} loading={pending} loadingLabel="Working" testId={`${testId}-yes`}>{yes}</PrimaryButton>
      </div>
    </div>
  );
}

function TeamBody({ organiser }: { organiser: HomeOrganiser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const team = teamOf(organiser);
  const viewerRole: TeamRole = organiser.role === 'owner' ? 'owner' : 'manager';
  const [asking, setAsking] = useState<Asking>(null);
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, announce] = useAnnounce();
  const { shake, shakeProps } = useShake();

  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser.id),
    queryFn: () => fetchIncomingAccessRequests(organiser.id),
  });

  const hide = (key: string) => setGone((s) => new Set(s).add(key));
  const fail = (err: unknown) => { setError(teamErrorMessage(err)); shake(); };
  const ask = (next: Asking) => { setError(null); setAsking(next); };

  const remove = useMutation({
    mutationFn: (member: TeamMember) => removeOrganiserMember(organiser.id, member.userId),
    onSuccess: (result, member) => {
      setAsking(null);
      if (result.selfRemoved) {
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
        navigate(ORG_PATHS.home, { replace: true });
        return;
      }
      hide(`m:${member.userId}`);
      announce(`${memberLabel(member)} no longer has access.`);
    },
    onError: fail,
  });

  const decide = useMutation({
    mutationFn: ({ request, decision }: { request: IncomingAccessRequest; decision: AccessDecision }) =>
      resolveAccessRequest(request.requestId, decision),
    onSuccess: (_r, { request, decision }) => {
      setAsking(null);
      hide(`r:${request.requestId}`);
      const who = request.requesterEmail ?? 'They';
      announce(decision === 'grant'
        ? `${who} can now edit ${organiser.name}\u2019s events as a manager.`
        : `Declined. ${who} can ask again later.`);
    },
    onError: fail,
  });

  // Re-read once the row has collapsed, so the gap closes before the list changes.
  const settleMember = () => void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  const settleRequest = () => void queryClient.invalidateQueries({ queryKey: incomingAccessRequestsQueryKey(organiser.id) });

  const pending = remove.isPending || decide.isPending;

  return (
    <div className="space-y-5" data-testid="team-body">
      <AnnounceRegion message={message} />
      {message && <p className="text-[14px] text-[var(--gold)]" data-testid="team-confirmation">{message}</p>}

      <Card label="Team" testId="team-list">
        {team.map((m) => {
          const action = memberAction(m, viewerRole, team);
          const label = memberLabel(m);
          const isAsking = asking?.kind === 'member' && asking.id === m.userId;
          return (
            <Collapse key={m.userId} show={!gone.has(`m:${m.userId}`)} onExited={settleMember}>
              <div data-testid="team-member" data-role={m.role} data-self={m.isSelf ? 'true' : 'false'}>
                <PersonRow
                  name={label}
                  sublabel={[m.isSelf ? 'You' : null, m.displayName ? m.email : null].filter(Boolean).join(' \u00b7 ') || undefined}
                  role={ROLE_LABEL[m.role]}
                  testId={`member-${m.userId}`}
                  trailing={action && !isAsking ? (
                    <GhostButton
                      size="sm" block={false}
                      disabled={!action.enabled || pending}
                      onClick={() => ask({ kind: 'member', id: m.userId })}
                      testId={`member-${action.kind}`}
                      aria-describedby={action.note ? `note-${m.userId}` : undefined}
                    >
                      {action.kind === 'leave' ? 'Leave' : 'Remove'}
                    </GhostButton>
                  ) : undefined}
                />
                {action?.note && <p id={`note-${m.userId}`} className={NOTE} data-testid="member-note">{action.note}</p>}
                {action && isAsking && (
                  <Question
                    testId="member-confirm"
                    text={action.kind === 'leave'
                      ? 'Leave this team? You will no longer see or edit its events.'
                      : `Remove ${label}? They will no longer see or edit these events.`}
                    no={action.kind === 'leave' ? 'No, stay' : 'No, keep them'}
                    yes={action.kind === 'leave' ? 'Yes, leave' : 'Yes, remove'}
                    onNo={() => ask(null)}
                    onYes={() => { setError(null); remove.mutate(m); }}
                    pending={remove.isPending}
                    error={error}
                    shakeProps={shakeProps}
                  />
                )}
              </div>
            </Collapse>
          );
        })}
        <p className={`${NOTE} pt-3`} data-testid="team-note">
          Owners add and remove people. Managers edit every event and send it for review. Only the Bachata Calendar team can change someone&rsquo;s role.
        </p>
      </Card>

      <Card label="Requests to join" testId="requests-card">
        {requests.isPending ? (
          <SkeletonRows count={2} label="Loading requests" testId="requests-loading" />
        ) : requests.isError ? (
          <div className="p-3">
            <ErrorState title="Requests did not load" onRetry={() => void requests.refetch()} retrying={requests.isFetching} testId="requests-error" />
          </div>
        ) : (requests.data ?? []).length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-[var(--mut)]" data-testid="requests-empty">No one is asking to join right now.</p>
        ) : (
          (requests.data ?? []).map((r) => {
            const asked = instantDateLabel(r.createdAt);
            const who = r.requesterEmail ?? 'This person';
            const isAsking = asking?.kind === 'grant' && asking.id === r.requestId;
            return (
              <Collapse key={r.requestId} show={!gone.has(`r:${r.requestId}`)} onExited={settleRequest}>
                <div data-testid="access-request">
                  <PersonRow
                    name={r.requesterEmail ?? 'Someone'}
                    sublabel={`${asked ? `Asked ${asked}` : 'Asked to join'} \u00b7 wants to be a manager`}
                    testId={`request-${r.requestId}`}
                  />
                  {r.message && <p className="px-4 pb-2 text-[14px] text-[var(--fg)]" data-testid="request-message">&ldquo;{r.message}&rdquo;</p>}
                  {isAsking ? (
                    <Question
                      testId="request-grant-confirm"
                      text={`Add ${who} as a manager? They will be able to edit all of ${organiser.name}\u2019s events and send them for review. They cannot add or remove people.`}
                      no="No, not now"
                      yes="Yes, add as manager"
                      onNo={() => ask(null)}
                      onYes={() => { setError(null); decide.mutate({ request: r, decision: 'grant' }); }}
                      pending={decide.isPending}
                      error={error}
                      shakeProps={shakeProps}
                    />
                  ) : (
                    <div className="space-y-2 px-4 pb-4">
                      <div className="flex gap-2">
                        <GhostButton size="sm" disabled={viewerRole !== 'owner' || pending} onClick={() => ask({ kind: 'grant', id: r.requestId })} testId="request-grant">
                          <UserPlus aria-hidden="true" className="h-4 w-4" /> Add as manager
                        </GhostButton>
                        <GhostButton
                          size="sm" disabled={viewerRole !== 'owner' || pending}
                          loading={decide.isPending && decide.variables?.request.requestId === r.requestId}
                          loadingLabel="Declining"
                          onClick={() => { ask(null); decide.mutate({ request: r, decision: 'decline' }); }}
                          testId="request-decline"
                        >
                          Decline
                        </GhostButton>
                      </div>
                      {viewerRole !== 'owner' && <p className="text-[13px] text-[var(--mut)]" data-testid="requests-owner-only">Only an owner can add or decline people.</p>}
                      {error && asking === null && decide.variables?.request.requestId === r.requestId && (
                        <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="request-error">{error}</p>
                      )}
                    </div>
                  )}
                </div>
              </Collapse>
            );
          })
        )}
      </Card>

      <Card label="Add someone" variant="padded" testId="team-howto">
        <p className="text-[14px] text-[var(--mut)]" data-testid="access-howto">{howToAddManager(organiser.name)}</p>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  const { home, organisers, selected, choose } = useOrganiserChoice();
  return (
    <OrganiserShell title="Team" testId="org-page-team">
      <div className="space-y-4">
        <OrganiserSwitcher organisers={organisers} selectedId={selected?.id ?? null} onChoose={choose} />
        {home.isPending ? (
          <SkeletonRows count={3} label="Loading your team" testId="team-loading" />
        ) : home.isError && !home.data ? (
          <ErrorState title="Your team did not load" onRetry={() => void home.refetch()} retrying={home.isFetching} testId="team-load-error" />
        ) : !selected ? (
          <EmptyState title="You don&rsquo;t run an organiser yet" body="A team belongs to an organiser. Claim yours or create one from Home, then your team shows here." testId="team-no-organiser" />
        ) : (
          <TeamBody key={selected.id} organiser={selected} />
        )}
      </div>
    </OrganiserShell>
  );
}
