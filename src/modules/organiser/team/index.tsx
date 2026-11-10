import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, UserPlus } from 'lucide-react';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { TEAM_CAP, TEAM_FULL_REASON, memberLabel, type TeamMember } from '@/modules/organiser/shared/teamModel';
import { MESSAGE_US, NO_PAGE, canDecline, canLeave, ownRowLabel, teamAddOffer } from '@/modules/organiser/shared/teamRules';
import { useSeatKind } from '@/modules/organiser/shared/useSeatKind';
import { ShareJoinLink } from './ShareJoinLink';
import { JoinRequestCard } from '../flows/fix/JoinRequest';
import { useOrgSurface } from '../shell/surface';
import { AnnounceRegion, Card, EmptyState, ErrorState, GhostButton, SkeletonRows, useAnnounce } from '../ui';
import { OrganiserSwitcher } from '../profile/OrganiserSwitcher';
import { organiserTeamQueryKey } from '@/modules/organiser/shared/teamRpcApi';
import { callerSeatOf } from '@/modules/organiser/edit-in-place/teamVisibilityModel';
import { Avatar } from './Avatar';
import { hideErrorMessage, organiserPublicTeamKey, setTeamMemberHidden } from './publicTeamApi';
import { NOBODY_LISTED, SHARED_READ_FAILED, SHARED_ROLE_LABEL, rowSwitch, type SharedTeamRow } from './teamShared';
import { GateReason } from './GateReason';
import { PublicToggle } from './PublicToggle';
import { useTeamContext } from './useTeamContext';
import { PageNameCaption, RequestsError, requestsErrorShown } from './p3TeamBits';
import { TEAM_ROLES } from '@/modules/organiser/shared/teamModel';

/**
 * Slice 1b fix: the P3 Team tab lists the roles, from the ONE list (TEAM_ROLES: Owner, Manager, Door).
 * Door is shown disabled with its reason, as in the picker. No contributor word.
 */
function RolesCard() {
  return (
    <Card label="Roles" testId="p3-team-roles">
      <ul className="flex flex-col">
        {TEAM_ROLES.map((r) => {
          const off = r.key === 'door';
          const whyId = `p3-team-role-${r.key}-why`;
          return (
            <li key={r.key} data-testid={`p3-team-role-${r.key}`} data-disabled={off ? 'true' : 'false'} aria-disabled={off ? 'true' : undefined} aria-describedby={off ? whyId : undefined} className={`flex min-h-[44px] flex-col justify-center px-[16px] py-[8px] ${off ? 'opacity-60' : ''}`}>
              <span className="text-[15px] font-bold text-[var(--fg)]">{r.label}</span>
              <span className="text-[13px] text-[var(--mut)]">{r.can}</span>
              {off && <span id={whyId} className="text-[13px] text-[var(--mut)]" data-testid="p3-team-role-door-why">{r.notAddable}</span>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * /account/o/team (C25). Faces and roles (Owner / Manager, D41), the open join request as a card
 * ABOVE the list (D9), "Add someone" for an owner AND a manager (D50). The caller's own row says who
 * added them (R3-11) and links to Leave (C29, More). A row opens that person (C26), keyed by user_id.
 */
function ListedRow({ row, organiserId, caller, onChanged, seatLabel }: { row: SharedTeamRow; organiserId: string; caller: { seat: ReturnType<typeof callerSeatOf>; personId: string | null }; onChanged: (msg: string) => void; seatLabel: string | null }) {
  const { paths } = useOrgSurface();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = row.name ?? 'A team member';
  const sw = rowSwitch(row, caller);
  const reasonId = `team-row-reason-${row.personId ?? row.userId ?? row.sortKey}`;
  const press = async () => {
    if (!sw.press || !row.personId) return;
    setBusy(true);
    setError(null);
    try {
      await setTeamMemberHidden(organiserId, row.personId, sw.press === 'hide');
      await Promise.all([
        qc.invalidateQueries({ queryKey: organiserTeamQueryKey(organiserId) }),
        qc.invalidateQueries({ queryKey: organiserPublicTeamKey(organiserId) }),
      ]);
      onChanged(sw.press === 'hide' ? `${name} is hidden from your public page.` : `${name} shows on your public page.`);
    } catch (e) {
      setError(hideErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const face = (
    <>
      <Avatar name={name} photoUrl={row.avatarUrl} size={40} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{name}</span>
      </span>
      <span className="shrink-0 rounded-[8px] bg-[var(--card2)] px-[8px] py-[2px] text-[12px] text-[var(--fg)]" data-testid="team-row-label">{seatLabel ?? SHARED_ROLE_LABEL[row.accessRole]}</span>
    </>
  );
  return (
    <div data-testid="team-member" data-role={row.accessRole} data-public={row.isPublic ? 'true' : 'false'} className="px-[16px] py-[8px]">
      <div className="flex min-h-[56px] items-center gap-[12px]">
        {row.userId ? <Link to={paths.teamPerson(row.userId)} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-[12px]">{face}</Link> : <div className="flex min-w-0 flex-1 items-center gap-[12px]">{face}</div>}
        <button
          type="button"
          role="switch"
          aria-checked={sw.on}
          aria-label={`Shows on your public page: ${name}`}
          aria-describedby={sw.reason ? reasonId : undefined}
          disabled={busy || !sw.press}
          onClick={() => void press()}
          data-testid="team-row-switch"
          className={`relative h-[44px] w-[64px] shrink-0 rounded-full border disabled:opacity-60 ${sw.on ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-[var(--line-strong)] bg-[var(--card2)]'}`}
        >
          <span aria-hidden="true" className={`absolute top-[5px] h-[32px] w-[32px] rounded-full bg-[var(--fg)] ${sw.on ? 'left-[27px]' : 'left-[5px]'}`} />
        </button>
      </div>
      {sw.reason && <p id={reasonId} className="text-[13px] text-[var(--mut)]" data-testid="team-row-reason">{sw.reason}</p>}
      {error && <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid="team-row-error">{error}</p>}
    </div>
  );
}

function MemberRow({ m, seatLabel }: { m: TeamMember; seatLabel: string | null }) {
  const { paths } = useOrgSurface();
  const name = memberLabel(m);
  return (
    <Link to={paths.teamPerson(m.userId)} data-testid="team-member" data-role={m.role} data-self={m.isSelf ? 'true' : 'false'} className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">
      <Avatar name={name} photoUrl={m.photoUrl} size={40} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{name}{m.isSelf ? ' (you)' : ''}</span>
        {m.isSelf && m.addedByDisplayName && <span className="block text-[13px] text-[var(--mut)]" data-testid="team-added-by">Added by {m.addedByDisplayName}</span>}
      </span>
      <span className="shrink-0 rounded-[8px] bg-[var(--card2)] px-[8px] py-[2px] text-[12px] text-[var(--fg)]" data-testid="team-row-label">{seatLabel ?? SHARED_ROLE_LABEL[m.role]}</span>
      <ChevronRight aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />
    </Link>
  );
}

export default function TeamPage() {
  const ctx = useTeamContext();
  const { organiser, members, viewerRole, listed } = ctx;
  const { kind, Shell, paths, hub } = useOrgSurface();
  const [message, announce] = useAnnounce();
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser?.id),
    queryFn: () => fetchIncomingAccessRequests(organiser!.id),
    enabled: !!organiser,
  });
  const full = members.length >= TEAM_CAP;
  const canAdd = viewerRole === 'owner' || viewerRole === 'manager';
  const me = members.find((m) => m.isSelf);
  const caller = { seat: callerSeatOf(viewerRole), personId: me?.personId ?? null };
  // P3 shows a Contributor the control with its reason (W4a owner pick); R1 keeps it hidden.
  const seat = useSeatKind(organiser?.id);
  const offer = teamAddOffer(seat, viewerRole, members);
  const addReason = offer.gate.reason;
  const isSelfRow = (personId: string | null, userId: string | null) => !!me && ((!!personId && personId === me.personId) || (!!userId && userId === me.userId));
  // What the RPCs accept, from the ONE mapping (teamRules): Decline is owner-only, Leave never orphans a page.
  const declineGate = canDecline(viewerRole, members, full);
  const leaveGate = canLeave(members);

  return (
    <Shell title="Team" back={hub} testId="org-page-team">
      <div className="flex flex-col gap-3 p-3">
        {/* P3 picks the page on Switch page (You), so the chips are R1's alone. */}
        {kind === 'r1' && <OrganiserSwitcher organisers={ctx.organisers} selectedId={organiser?.id ?? null} onChoose={ctx.choose} />}
        <PageNameCaption name={organiser?.name} show={kind === 'p3' && ctx.organisers.length >= 2} />
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading your team" testId="team-loading" />
        ) : ctx.failed ? (
          <ErrorState title="Your team did not load" onRetry={ctx.retry} testId="team-load-error" />
        ) : !organiser ? (
          kind === 'p3' ? (
            <EmptyState title={NO_PAGE.title} body={NO_PAGE.body} action={<Link to={paths.help} className="font-semibold underline" data-testid="team-message-us">{MESSAGE_US}</Link>} testId="team-no-organiser" />
          ) : (
            <EmptyState title="You don&rsquo;t have a page yet" body="A team belongs to a page. Claim yours or add one from Home, then your team shows here." testId="team-no-organiser" />
          )
        ) : (
          <>
            {kind === 'p3' && requestsErrorShown(requests) && <RequestsError onRetry={() => void requests.refetch()} />}
            {(requests.data ?? []).length > 0 && (
              <Card label="Wants to join" testId="requests-card">
                {(requests.data ?? []).map((r) => (
                  <JoinRequestCard key={r.requestId} organiserId={organiser.id} request={r} blockedReason={full ? TEAM_FULL_REASON : null} declineGate={declineGate} onAnswered={announce} />
                ))}
              </Card>
            )}
            <Card label="Team" testId="team-list">
              {listed
                ? listed.map((r) => <ListedRow key={r.personId ?? r.userId ?? r.sortKey} row={r} organiserId={organiser.id} caller={caller} onChanged={announce} seatLabel={ownRowLabel(seat, isSelfRow(r.personId, r.userId))} />)
                : members.map((m) => <MemberRow key={m.userId} m={m} seatLabel={ownRowLabel(seat, m.isSelf)} />)}
              {listed && listed.length === 0 && <p className="px-[16px] py-[12px] text-[14px] text-[var(--mut)]" data-testid="team-empty">{NOBODY_LISTED}</p>}
              {!listed && !ctx.loading && <p className="px-[16px] py-[8px] text-[13px] text-[var(--mut)]" data-testid="team-shared-failed">{SHARED_READ_FAILED}</p>}
            </Card>
            {kind === 'p3' && <RolesCard />}
            {me && (
              <Card label="Public team" testId="team-public-card">
                <PublicToggle organiserId={organiser.id} profileId={me.profileId ?? null} onChanged={announce} />
              </Card>
            )}
            {offer.kind === 'share' ? (
              <ShareJoinLink organiserId={organiser.id} organiserName={organiser.name} announce={announce} />
            ) : (canAdd || kind === 'p3') && (
              addReason ? (
                <>
                  <GhostButton disabled testId="team-add" aria-describedby="team-add-reason"><UserPlus aria-hidden="true" className="h-[18px] w-[18px]" /> Add someone</GhostButton>
                  <p id="team-add-reason" className="text-[13px] text-[var(--mut)]" data-testid="team-add-reason">{addReason}</p>
                </>
              ) : (
                <Link to={paths.teamAdd} data-testid="team-add" className="inline-flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[var(--btn)] text-[16px] font-bold text-[var(--btnfg)]">
                  <UserPlus aria-hidden="true" className="h-[18px] w-[18px]" /> Add someone
                </Link>
              )
            )}
            {leaveGate?.ok && (
              <Link to={paths.more} data-testid="team-leave" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--mut)]">Leave this page</Link>
            )}
            {leaveGate && !leaveGate.ok && (
              <>
                <GhostButton disabled testId="team-leave" aria-describedby="team-leave-reason">Leave this page</GhostButton>
                <GateReason gate={leaveGate} id="team-leave-reason" testId="team-leave-reason" />
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
