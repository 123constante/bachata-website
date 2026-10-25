import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, UserPlus } from 'lucide-react';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { ROLE_LABEL, TEAM_CAP, TEAM_FULL_REASON, memberLabel, type TeamMember } from '@/modules/organiser/shared/teamModel';
import { JoinRequestCard } from '../flows/fix/JoinRequest';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { AnnounceRegion, Card, EmptyState, ErrorState, GhostButton, SkeletonRows, useAnnounce } from '../ui';
import { OrganiserSwitcher } from '../profile/OrganiserSwitcher';
import { Avatar } from './Avatar';
import { PublicToggle } from './PublicToggle';
import { useTeamContext } from './useTeamContext';

/**
 * /account/o/team (C25). Faces and roles (Owner / Manager, D41), the open join request as a card
 * ABOVE the list (D9), "Add someone" for an owner AND a manager (D50). The caller's own row says who
 * added them (R3-11) and links to Leave (C29, More). A row opens that person (C26), keyed by user_id.
 */
function MemberRow({ m }: { m: TeamMember }) {
  const name = memberLabel(m);
  return (
    <Link to={ORG_PATHS.teamPerson(m.userId)} data-testid="team-member" data-role={m.role} data-self={m.isSelf ? 'true' : 'false'} className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">
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
  const [message, announce] = useAnnounce();
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser?.id),
    queryFn: () => fetchIncomingAccessRequests(organiser!.id),
    enabled: !!organiser,
  });
  const full = members.length >= TEAM_CAP;
  const canAdd = viewerRole === 'owner' || viewerRole === 'manager';
  const me = members.find((m) => m.isSelf);

  return (
    <OrganiserShell title="Team" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-team">
      <div className="flex flex-col gap-3 p-3">
        <OrganiserSwitcher organisers={ctx.organisers} selectedId={organiser?.id ?? null} onChoose={ctx.choose} />
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading your team" testId="team-loading" />
        ) : ctx.failed ? (
          <ErrorState title="Your team did not load" onRetry={ctx.retry} testId="team-load-error" />
        ) : !organiser ? (
          <EmptyState title="You don&rsquo;t have a page yet" body="A team belongs to a page. Claim yours or add one from Home, then your team shows here." testId="team-no-organiser" />
        ) : (
          <>
            {(requests.data ?? []).length > 0 && (
              <Card label="Wants to join" testId="requests-card">
                {(requests.data ?? []).map((r) => (
                  <JoinRequestCard key={r.requestId} organiserId={organiser.id} request={r} blockedReason={full ? TEAM_FULL_REASON : null} onAnswered={announce} />
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
            {canAdd && (
              full ? (
                <>
                  <GhostButton disabled testId="team-add" aria-describedby="team-full"><UserPlus aria-hidden="true" className="h-[18px] w-[18px]" /> Add someone</GhostButton>
                  <p id="team-full" className="text-[13px] text-[var(--mut)]" data-testid="team-full">{TEAM_FULL_REASON}</p>
                </>
              ) : (
                <Link to={ORG_PATHS.teamAdd} data-testid="team-add" className="inline-flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[var(--btn)] text-[16px] font-bold text-[var(--btnfg)]">
                  <UserPlus aria-hidden="true" className="h-[18px] w-[18px]" /> Add someone
                </Link>
              )
            )}
            {me && me.role !== 'owner' && (
              <Link to={ORG_PATHS.more} data-testid="team-leave" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--mut)]">Leave this page</Link>
            )}
          </>
        )}
      </div>
    </OrganiserShell>
  );
}
