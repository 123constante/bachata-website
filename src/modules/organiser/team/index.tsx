import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, UserPlus } from 'lucide-react';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { ROLE_LABEL, TEAM_CAP, TEAM_FULL_REASON, memberLabel, type TeamMember } from '@/modules/organiser/shared/teamModel';
import { MESSAGE_US, NO_PAGE, canAdd as addGate, canDecline, canLeave } from '@/modules/organiser/shared/teamRules';
import { ORG_PATHS } from '../shell/paths';
import { JoinRequestCard } from '../flows/fix/JoinRequest';
import { useOrgSurface } from '../shell/surface';
import { AnnounceRegion, Card, EmptyState, ErrorState, GhostButton, SkeletonRows, useAnnounce } from '../ui';
import { OrganiserSwitcher } from '../profile/OrganiserSwitcher';
import { Avatar } from './Avatar';
import { GateReason } from './GateReason';
import { PublicToggle } from './PublicToggle';
import { useTeamContext } from './useTeamContext';

/**
 * /account/o/team (C25). Faces and roles (Owner / Manager, D41), the open join request as a card
 * ABOVE the list (D9), "Add someone" for an owner AND a manager (D50). The caller's own row says who
 * added them (R3-11) and links to Leave (C29, More). A row opens that person (C26), keyed by user_id.
 */
function MemberRow({ m }: { m: TeamMember }) {
  const { paths } = useOrgSurface();
  const name = memberLabel(m);
  return (
    <Link to={paths.teamPerson(m.userId)} data-testid="team-member" data-role={m.role} data-self={m.isSelf ? 'true' : 'false'} className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">
      <Avatar name={name} photoUrl={m.photoUrl} size={40} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] text-[var(--fg)] [overflow-wrap:anywhere]">{name}{m.isSelf ? ' (you)' : ''}</span>
        {m.isSelf && m.addedByDisplayName && <span className="block text-[13px] text-[var(--mut)]" data-testid="team-added-by">Added by {m.addedByDisplayName}</span>}
      </span>
      <span className="shrink-0 rounded-[8px] bg-[var(--card2)] px-[8px] py-[2px] text-[12px] text-[var(--fg)]">{ROLE_LABEL[m.role]}</span>
      <ChevronRight aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />
    </Link>
  );
}

export default function TeamPage() {
  const ctx = useTeamContext();
  const { organiser, members, viewerRole } = ctx;
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
  // P3 shows a Contributor the control with its reason (W4a owner pick); R1 keeps it hidden.
  const addReason = addGate(viewerRole, members).reason;
  // What the RPCs accept, from the ONE mapping (teamRules): Decline is owner-only, Leave never orphans a page.
  const declineGate = canDecline(viewerRole, members, full);
  const leaveGate = canLeave(members);

  return (
    <Shell title="Team" back={hub} testId="org-page-team">
      <div className="flex flex-col gap-3 p-3">
        {/* P3 picks the page on Switch page (You), so the chips are R1's alone. */}
        {kind === 'r1' && <OrganiserSwitcher organisers={ctx.organisers} selectedId={organiser?.id ?? null} onChoose={ctx.choose} />}
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading your team" testId="team-loading" />
        ) : ctx.failed ? (
          <ErrorState title="Your team did not load" onRetry={ctx.retry} testId="team-load-error" />
        ) : !organiser ? (
          kind === 'p3' ? (
            <EmptyState title={NO_PAGE.title} body={NO_PAGE.body} action={<Link to={ORG_PATHS.help} className="font-semibold underline" data-testid="team-message-us">{MESSAGE_US}</Link>} testId="team-no-organiser" />
          ) : (
            <EmptyState title="You don&rsquo;t have a page yet" body="A team belongs to a page. Claim yours or add one from Home, then your team shows here." testId="team-no-organiser" />
          )
        ) : (
          <>
            {(requests.data ?? []).length > 0 && (
              <Card label="Wants to join" testId="requests-card">
                {(requests.data ?? []).map((r) => (
                  <JoinRequestCard key={r.requestId} organiserId={organiser.id} request={r} blockedReason={full ? TEAM_FULL_REASON : null} declineGate={declineGate} onAnswered={announce} />
                ))}
              </Card>
            )}
            <Card label="Team" testId="team-list">
              {members.map((m) => <MemberRow key={m.userId} m={m} />)}
            </Card>
            {me && (
              <Card label="Public team" testId="team-public-card">
                <PublicToggle organiserId={organiser.id} profileId={me.profileId ?? null} onChanged={announce} />
              </Card>
            )}
            {(canAdd || kind === 'p3') && (
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
