import { useState, type ReactNode } from 'react';
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
} from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { fetchOrganiserTeam, organiserTeamQueryKey, setTeamMember, transferOwnership } from '@/modules/organiser/shared/teamRpcApi';
import {
  ROLE_LABEL,
  ADD_ROLES,
  READ_ONLY_REASON,
  instantDateLabel,
  memberAction,
  memberLabel,
  ownerMoves,
  type IncomingAccessRequest,
  type TeamMember,
  type TeamRole,
} from '@/modules/organiser/shared/teamModel';
import { isPlausibleEmail } from '@/modules/admin-organisers/inviteModel';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  Card,
  Collapse,
  EmptyState,
  ErrorState,
  GhostButton,
  PrimaryButton,
  SkeletonRows,
  initials,
  useAnnounce,
  useShake,
} from '../ui';
import { OrganiserSwitcher } from '../profile/OrganiserSwitcher';
import { useOrganiserChoice } from '../profile/useOrganiserChoice';

/**
 * /account/o/team (W4). Who runs the organiser and who is asking to. The
 * server offers an owner: add by email, change role, make owner (transfer),
 * remove, and grant or decline a request; anyone else may only leave. The list
 * comes from organiser_team_v1 (contributors included), falling back to the
 * Home read while it loads. Controls a viewer cannot use stay visible,
 * disabled, with the reason underneath.
 */

/** Which inline question is open; only one at a time, so one primary button. */
type Asking =
  | { kind: 'member'; id: string }
  | { kind: 'grant'; id: string }
  | { kind: 'role'; id: string }
  | { kind: 'transfer'; id: string }
  | null;

const NOTE = 'px-[16px] pb-[12px] text-[13px] text-[var(--mut)]';

/**
 * A person on the team or asking to join. Unlike the shared PersonRow it never
 * truncates: two owners whose emails share a long prefix
 * (bachatacommunity.leeds@ / bachatacommunity.london@) would both read
 * 'bachatacommu...' at 390px, so the name and the email wrap onto a second line.
 */
function TeamPersonRow({ name, sublabel, role, trailing, testId }: {
  name: string; sublabel?: string; role?: string; trailing?: ReactNode; testId: string;
}) {
  return (
    <div data-testid={testId} className="flex min-h-[52px] items-center gap-[12px] px-[16px] py-[8px]">
      <span aria-hidden="true" className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[13px] font-bold text-[var(--fg)]">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{name}</span>
        {sublabel && <span className="block text-[13px] text-[var(--mut)] [overflow-wrap:anywhere]">{sublabel}</span>}
      </span>
      {role && <span className="shrink-0 rounded-[8px] bg-[var(--card2)] px-[8px] py-[2px] text-[12px] text-[var(--fg)]">{role}</span>}
      {trailing}
    </div>
  );
}

function Question({ text, yes, no, onYes, onNo, pending, error, shakeProps, testId }: {
  text: string; yes: string; no: string; onYes: () => void; onNo: () => void; pending: boolean;
  error: string | null; shakeProps: { className?: string; onAnimationEnd?: () => void }; testId: string;
}) {
  return (
    <div role="alertdialog" aria-label={text} data-testid={testId} className={`space-y-[8px] px-[16px] pb-[16px] ${shakeProps.className ?? ''}`} onAnimationEnd={shakeProps.onAnimationEnd}>
      <p className="text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{text}</p>
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid={`${testId}-error`}>{error}</p>}
      <div className="flex flex-col gap-[8px]">
        <GhostButton size="sm" onClick={onNo} disabled={pending} autoFocus testId={`${testId}-no`}>{no}</GhostButton>
        <PrimaryButton size="sm" onClick={onYes} loading={pending} loadingLabel="Working" testId={`${testId}-yes`}>{yes}</PrimaryButton>
      </div>
    </div>
  );
}

/** The fixed note under the team list (shown in the loading frame too: it needs no data). */
function TeamNote() {
  return (
    <p className={`${NOTE} pt-[12px]`} data-testid="team-note">
      Owners add and remove people and change roles. Managers edit every event and send it for review. Contributors help edit events.
    </p>
  );
}

function TeamBody({ organiser }: { organiser: HomeOrganiser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teamRead = useQuery({ queryKey: organiserTeamQueryKey(organiser.id), queryFn: () => fetchOrganiserTeam(organiser.id) });
  // organiser_team_v1 carries no sign-up names; keep the ones the Home read has, so rows stay recognisable.
  const homeTeam = teamOf(organiser);
  const readUsable = teamRead.data && teamRead.data.myRole !== null;
  const team = readUsable
    ? teamRead.data!.members.map((m) => ({ ...m, displayName: m.displayName ?? homeTeam.find((h) => h.userId === m.userId)?.displayName ?? null }))
    : homeTeam;
  // An admin who is not a member reads the team but cannot write it from this screen.
  const readRole = readUsable ? teamRead.data!.myRole : null;
  const viewerRole: TeamRole = readRole === 'owner' || readRole === 'contributor' ? readRole : readRole === 'manager' || readRole === 'admin' ? 'manager' : organiser.role === 'owner' ? 'owner' : 'manager';
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'manager' | 'contributor'>('manager');
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
      // A grant adds a member: re-read the team now so they are listed at once.
      if (decision === 'grant') {
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
        void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser.id) });
      }
      const who = request.requesterEmail ?? 'They';
      announce(decision === 'grant'
        ? `${who} can now edit ${organiser.name}\u2019s events as a manager.`
        : `Declined. ${who} can ask again later.`);
    },
    onError: fail,
  });

  const reread = () => {
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser.id) });
  };

  const changeRole = useMutation({
    mutationFn: ({ member, to }: { member: TeamMember; to: 'manager' | 'contributor' }) => setTeamMember(organiser.id, member.email ?? '', to),
    onSuccess: (_r, { member, to }) => { setAsking(null); reread(); announce(`${memberLabel(member)} is now a ${ROLE_LABEL[to].toLowerCase()}.`); },
    onError: fail,
  });
  const transfer = useMutation({
    mutationFn: (member: TeamMember) => transferOwnership(organiser.id, member.userId),
    onSuccess: (_r, member) => { setAsking(null); reread(); announce(`${memberLabel(member)} is now the owner. You are a manager.`); },
    onError: fail,
  });
  const add = useMutation({
    mutationFn: () => setTeamMember(organiser.id, addEmail, addRole),
    onSuccess: () => { const who = addEmail.trim(); setAddEmail(''); setError(null); reread(); announce(`${who} was added as a ${ROLE_LABEL[addRole].toLowerCase()}.`); },
    onError: fail,
  });
  const addValid = isPlausibleEmail(addEmail);

  // Re-read once the row has collapsed, so the gap closes before the list changes.
  const settleMember = reread;
  const settleRequest = () => void queryClient.invalidateQueries({ queryKey: incomingAccessRequestsQueryKey(organiser.id) });

  const pending = remove.isPending || decide.isPending || changeRole.isPending || transfer.isPending || add.isPending;

  return (
    <div className="space-y-[20px]" data-testid="team-body">
      {/* One element both shows and announces the confirmation (a separate sr-only
          region repeated the same words, so screen readers heard it twice). */}
      <p role="status" aria-live="polite" aria-atomic="true" className={message ? 'text-[14px] text-[var(--gold)]' : 'sr-only'} data-testid="team-confirmation">{message}</p>

      <Card label="Team" testId="team-list">
        {team.map((m) => {
          const action = memberAction(m, viewerRole, team);
          const label = memberLabel(m);
          const isAsking = asking?.kind === 'member' && asking.id === m.userId;
          return (
            <Collapse key={m.userId} show={!gone.has(`m:${m.userId}`)} onExited={settleMember}>
              <div data-testid="team-member" data-role={m.role} data-self={m.isSelf ? 'true' : 'false'}>
                <TeamPersonRow
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
                {(() => {
                  const moves = ownerMoves(m, viewerRole);
                  if (!moves) return null;
                  const noEmail = m.email === null;
                  const roleOpen = asking?.kind === 'role' && asking.id === m.userId;
                  const transferOpen = asking?.kind === 'transfer' && asking.id === m.userId;
                  return (
                    <div data-testid="member-moves">
                      {moves.note && <p className={NOTE} data-testid="move-note">{moves.note}</p>}
                      {moves.changeTo && !roleOpen && !transferOpen && (
                        <div className="flex flex-wrap gap-[8px] px-[16px] pb-[12px]">
                          <GhostButton size="sm" block={false} disabled={noEmail || pending} onClick={() => ask({ kind: 'role', id: m.userId })} testId="move-role">Make {ROLE_LABEL[moves.changeTo].toLowerCase()}</GhostButton>
                          <GhostButton size="sm" block={false} disabled={!moves.canTransfer || pending} onClick={() => ask({ kind: 'transfer', id: m.userId })} testId="move-transfer">Make owner</GhostButton>
                        </div>
                      )}
                      {moves.changeTo && noEmail && <p className={NOTE} data-testid="move-note-noemail">We cannot show this person&rsquo;s email, so their role cannot be changed here. Remove them and add them again.</p>}
                      {roleOpen && moves.changeTo && (
                        <Question
                          testId="role-confirm"
                          text={`Make ${label} a ${ROLE_LABEL[moves.changeTo].toLowerCase()}?`}
                          no="No, keep it" yes={`Yes, make ${ROLE_LABEL[moves.changeTo].toLowerCase()}`}
                          onNo={() => ask(null)}
                          onYes={() => { setError(null); changeRole.mutate({ member: m, to: moves.changeTo! }); }}
                          pending={changeRole.isPending} error={error} shakeProps={shakeProps}
                        />
                      )}
                      {transferOpen && (
                        <Question
                          testId="transfer-confirm"
                          text={`Make ${label} the owner? You will become a manager and will no longer be able to add or remove people.`}
                          no="No, stay owner" yes="Yes, hand over"
                          onNo={() => ask(null)}
                          onYes={() => { setError(null); transfer.mutate(m); }}
                          pending={transfer.isPending} error={error} shakeProps={shakeProps}
                        />
                      )}
                    </div>
                  );
                })()}
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
        <TeamNote />
      </Card>

      <Card label="Requests to join" testId="requests-card">
        {requests.isPending ? (
          <SkeletonRows count={2} label="Loading requests" testId="requests-loading" />
        ) : requests.isError ? (
          <div className="p-[12px]">
            <ErrorState title="Requests did not load" onRetry={() => void requests.refetch()} retrying={requests.isFetching} testId="requests-error" />
          </div>
        ) : (requests.data ?? []).length === 0 ? (
          <p className="px-[16px] py-[16px] text-[15px] text-[var(--mut)]" data-testid="requests-empty">No one is asking to join right now.</p>
        ) : (
          (requests.data ?? []).map((r) => {
            const asked = instantDateLabel(r.createdAt);
            const who = r.requesterEmail ?? 'This person';
            const isAsking = asking?.kind === 'grant' && asking.id === r.requestId;
            return (
              <Collapse key={r.requestId} show={!gone.has(`r:${r.requestId}`)} onExited={settleRequest}>
                <div data-testid="access-request">
                  <TeamPersonRow
                    name={r.requesterEmail ?? 'Someone'}
                    sublabel={`${asked ? `Asked ${asked}` : 'Asked to join'} \u00b7 wants to be a manager`}
                    testId={`request-${r.requestId}`}
                  />
                  {r.message && <p className="px-[16px] pb-[8px] text-[14px] text-[var(--fg)]" data-testid="request-message">&ldquo;{r.message}&rdquo;</p>}
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
                    <div className="space-y-[8px] px-[16px] pb-[16px]">
                      <div className="flex gap-[8px]">
                        <GhostButton size="sm" disabled={viewerRole !== 'owner' || pending} onClick={() => ask({ kind: 'grant', id: r.requestId })} testId="request-grant">
                          <UserPlus aria-hidden="true" className="h-[16px] w-[16px]" /> Add as manager
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

      <Card label="Add someone" variant="padded" testId="team-add">
        {viewerRole === 'owner' ? (
          <form
            className="space-y-[8px]"
            onSubmit={(e) => { e.preventDefault(); if (addValid && !pending) { setError(null); add.mutate(); } }}
          >
            <p className="text-[14px] text-[var(--mut)]">They need a Bachata Calendar account already. Use the email they signed up with.</p>
            <input type="email" inputMode="email" autoComplete="off" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Their email" aria-label="Their email" data-testid="add-email" className="h-[44px] w-full rounded-[10px] border border-[var(--line)] bg-[var(--card2)] px-[12px] text-[15px] text-[var(--fg)]" />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as 'manager' | 'contributor')} aria-label="Role" data-testid="add-role" className="h-[44px] w-full rounded-[10px] border border-[var(--line)] bg-[var(--card2)] px-[12px] text-[15px] text-[var(--fg)]">
              {ADD_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <PrimaryButton size="sm" type="submit" disabled={!addValid || pending} loading={add.isPending} loadingLabel="Adding" testId="add-submit" aria-describedby={addValid ? undefined : 'add-reason'}>Add to team</PrimaryButton>
            {!addValid && <p id="add-reason" className="text-[13px] text-[var(--mut)]" data-testid="add-reason">Enter their email address to add them.</p>}
            {add.isError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="add-error">{error}</p>}
          </form>
        ) : (
          <p className="text-[14px] text-[var(--mut)]" data-testid="add-read-only">{READ_ONLY_REASON}</p>
        )}
      </Card>
    </div>
  );
}

export default function TeamPage() {
  const { home, organisers, selected, choose } = useOrganiserChoice();
  return (
    <OrganiserShell title="Team" testId="org-page-team">
      <div className="space-y-[16px]">
        <OrganiserSwitcher organisers={organisers} selectedId={selected?.id ?? null} onChoose={choose} />
        {home.isPending ? (
          // The page's own frame while the team loads: the Team card (rows to come, its fixed note).
          <Card label="Team" testId="team-list">
            <div className="p-[12px]"><SkeletonRows count={2} label="Loading your team" testId="team-loading" /></div>
            <TeamNote />
          </Card>
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
