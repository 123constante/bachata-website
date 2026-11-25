import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, removeOrganiserMember } from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { organiserTeamQueryKey } from '@/modules/organiser/shared/teamRpcApi';
import { canReceiveOwnership } from '@/modules/organiser/shared/teamModel';
import { canLeave, canManagePeople, canRemove as removeGate } from '@/modules/organiser/shared/teamRules';
import { fetchTeamR2Changes, fetchTeamR2People, setTeamR2Switches, teamR2ChangesKey, teamR2PeopleKey } from '../p3/r4/r4TeamR2Api';
import { changeSentence, doorUntilWords, switchErrorLine } from '../p3/r4/R4TeamR2';
import { goDone } from '../flows/doneState';
import { useOrgSurface } from '../shell/surface';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../ui';
import { Avatar } from './Avatar';
import { GateReason } from './GateReason';
import { useTeamContext } from './useTeamContext';

const WORD = { owner: 'Owner', manager: 'Manager', contributor: 'Contributor', door: 'Door' } as const;
const chip = (on: boolean) => `min-h-[44px] flex-1 rounded-[12px] px-3 text-[16px] font-bold ${on ? 'bg-[var(--fg)] text-[var(--bg)]' : 'bg-[var(--card2)] text-[var(--fg)]'}`;

/** Flag organiserTeamR2: one person from organiser_team_people_v1, two switches, owner-only role chips. */
export default function PersonR2() {
  const { userId = '' } = useParams();
  const ctx = useTeamContext();
  const { Shell, paths, doneBack } = useOrgSurface();
  const { organiser, members, viewerRole } = ctx;
  const org = organiser?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [bothOff, setBothOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (asking) confirmRef.current?.focus(); }, [asking]);
  const people = useQuery({ queryKey: teamR2PeopleKey(org), queryFn: () => fetchTeamR2People(org!), enabled: !!org });
  const changes = useQuery({ queryKey: teamR2ChangesKey(org), queryFn: () => fetchTeamR2Changes(org!), enabled: !!org });
  const p = people.data?.people.find((x) => x.userId === userId) ?? null;
  const member = members.find((m) => m.userId === userId) ?? null;

  const save = useMutation({
    mutationFn: (v: { signIn: boolean; pub: boolean; role?: 'manager' | 'contributor' }) => setTeamR2Switches(org!, userId, v.signIn, v.pub, v.role),
    onError: (e) => setError(switchErrorLine(e)),
    onSettled: () => { void qc.invalidateQueries({ queryKey: teamR2PeopleKey(org) }); void qc.invalidateQueries({ queryKey: teamR2ChangesKey(org) }); },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: organiserTeamQueryKey(org!) });
    void qc.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
  };
  const remove = useMutation({ mutationFn: () => removeOrganiserMember(org!, userId), onSuccess: refresh, onError: (e) => setError(teamErrorMessage(e)) });
  const removeDone = () => goDone(navigate, { title: 'Removed', message: 'Removed from the team', seriesId: null, next: member?.displayName ? paths.teamAddFor(member.displayName) : paths.teamAdd, nextLabel: 'Add them back' }, doneBack, paths.done);

  const flip = (which: 'signIn' | 'pub') => {
    if (!p) return;
    const next = { signIn: p.canSignIn, pub: p.onPublic, [which]: which === 'signIn' ? !p.canSignIn : !p.onPublic };
    setError(null);
    if (!next.signIn && !next.pub) setBothOff(true); else save.mutate(next);
  };
  const isOwner = viewerRole === 'owner';
  const remover = member ? removeGate(viewerRole, members, member) : null;
  const leaveGate = member?.isSelf ? canLeave(members) : null;
  const manageGate = canManagePeople(viewerRole, members);
  const lastChange = p ? changes.data?.find((c) => c.person === p.name) : undefined;
  const sw = (label: string, on: boolean, off: boolean, id: string, which: 'signIn' | 'pub') => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={off || save.isPending} onClick={() => flip(which)} data-testid={id} className="flex min-h-[44px] items-center justify-between rounded-[12px] bg-[var(--card)] px-3 disabled:opacity-60">
      <span className="text-[15px] text-[var(--fg)]">{label}</span><span className="text-[14px] font-bold text-[var(--mut)]">{on ? 'On' : 'Off'}</span>
    </button>
  );

  return (
    <Shell title={p?.name ?? 'Team'} back={{ to: paths.team, label: 'Team' }} testId="org-page-team-person">
      <div className="flex flex-col gap-3 p-3">
        {ctx.loading || (!!org && people.isPending) ? (
          <SkeletonRows count={2} label="Loading" testId="person-loading" />
        ) : ctx.failed || people.isError ? (
          <ErrorState title="Could not load. Try again." onRetry={() => { ctx.retry(); void people.refetch(); }} testId="person-load-error" />
        ) : !organiser || !p ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="person-missing">They are not on the team any more. <Link to={paths.team} className="inline-flex min-h-[44px] items-center underline">Back to the team</Link></p>
        ) : (
          <>
            <div className="flex items-center gap-3" data-testid="person-summary">
              <Avatar name={p.name} photoUrl={p.avatarUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-[var(--fg)] [overflow-wrap:anywhere]">{p.name}</p>
                <p className="text-[14px] text-[var(--mut)]" data-testid="person-role">{p.role === 'door' && !p.doorExpired ? doorUntilWords(p.doorUntil) : WORD[p.role]}{p.isYou ? ' · you' : ''}</p>
                {lastChange && <p className="text-[13px] text-[var(--mut)]" data-testid="person-last-change">{changeSentence(lastChange, new Date())}</p>}
              </div>
            </div>
            {sw('Can sign in', p.role === 'owner' ? true : p.canSignIn, p.role === 'owner' || !isOwner, 'person-signin', 'signIn')}
            {sw('On public page', p.onPublic, false, 'person-public', 'pub')}
            {bothOff && (
              <div role="group" aria-label={`Remove ${p.name}?`} className="flex flex-col gap-2" data-testid="person-bothoff-confirm">
                <p className="text-[15px] text-[var(--fg)]">Remove {p.name} from the team?</p>
                <PrimaryButton loading={save.isPending} loadingLabel="Saving" onClick={() => { setBothOff(false); save.mutate({ signIn: false, pub: false }); }} testId="person-bothoff-yes">Remove</PrimaryButton>
                <GhostButton onClick={() => setBothOff(false)} testId="person-bothoff-no">Cancel</GhostButton>
              </div>
            )}
            {isOwner && !p.isYou && (p.role === 'manager' || p.role === 'contributor') ? (
              <div className="flex gap-2" role="radiogroup" aria-label="Role" data-testid="person-role-chips">
                {(['manager', 'contributor'] as const).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={p.role === r} disabled={save.isPending} className={chip(p.role === r)} data-testid={`person-role-${r}`}
                    onClick={() => { if (p.role !== r) { setError(null); save.mutate({ signIn: p.canSignIn, pub: p.onPublic, role: r }); } }}>{WORD[r]}</button>
                ))}
              </div>
            ) : null}
            {!isOwner && !p.isYou && <GateReason gate={manageGate} id="person-role-reason" testId="person-role-reason" />}
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="person-error">{error}</p>}
            {isOwner && member && canReceiveOwnership(member) && (
              <Link to={paths.handoverTo(userId)} data-testid="person-hand-over" className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--card2)] text-[16px] font-bold text-[var(--fg)]">Hand the page over</Link>
            )}
            {leaveGate?.ok && <Link to={paths.more} data-testid="person-leave" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--mut)]">Leave this page</Link>}
            {leaveGate && !leaveGate.ok && (
              <>
                <GhostButton disabled testId="person-leave" aria-describedby="person-leave-reason">Leave this page</GhostButton>
                <GateReason gate={leaveGate} id="person-leave-reason" testId="person-leave-reason" />
              </>
            )}
            {remover?.ok && (asking ? (
              <div ref={confirmRef} role="group" tabIndex={-1} aria-label={`Remove ${p.name}?`} className="flex flex-col gap-2 outline-none" data-testid="person-remove-confirm">
                <p className="text-[15px] text-[var(--fg)]">Remove {p.name}? They will no longer see or edit these events.</p>
                <PrimaryButton loading={remove.isPending} loadingLabel="Removing" onClick={() => { setError(null); remove.mutate(undefined, { onSuccess: removeDone }); }} testId="person-remove-yes">Remove</PrimaryButton>
                <GhostButton disabled={remove.isPending} onClick={() => setAsking(false)} testId="person-remove-no">Keep them</GhostButton>
              </div>
            ) : <GhostButton onClick={() => setAsking(true)} testId="person-remove">Remove from the team</GhostButton>)}
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
