import { Link } from 'react-router-dom';
import { canReceiveOwnership, memberLabel } from '@/modules/organiser/shared/teamModel';
import { useOrgSurface } from '../../shell/surface';
import { Card, EmptyState, ErrorState, SkeletonRows } from '../../ui';
import { Avatar } from '../../team/Avatar';
import { useTeamContext } from '../../team/useTeamContext';

/** C30 /handover: hand the page over to whom. Only members the server can hand to (a confirmed email). */
export default function ToWhom() {
  const { organiser, members, viewerRole, loading, failed, retry } = useTeamContext();
  const { Shell, paths, handoverBack } = useOrgSurface();
  const options = members.filter(canReceiveOwnership);
  return (
    <Shell title="Hand over" back={handoverBack} testId="org-page-handover">
      <div className="flex flex-col gap-3 p-3">
        {loading ? (
          <SkeletonRows count={3} label="Loading your team" testId="handover-loading" />
        ) : failed ? (
          <ErrorState title="Your team did not load" onRetry={retry} testId="handover-load-error" />
        ) : !organiser || viewerRole !== 'owner' ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="handover-owner-only">Only the owner can hand the page over.</p>
        ) : options.length === 0 ? (
          <EmptyState
            title="No one can take over yet"
            body="Add a Manager with a confirmed email first, then hand the page over to them."
            action={<Link to={paths.teamAdd} data-testid="handover-add" className="inline-flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--btn)] text-[16px] font-bold text-[var(--btnfg)]">Add someone</Link>}
            testId="handover-empty"
          />
        ) : (
          <>
            <p className="text-[15px] text-[var(--fg)]">Hand {organiser.name} over to:</p>
            <Card testId="handover-list">
              {options.map((m) => (
                <Link key={m.userId} to={paths.handoverTo(m.userId)} data-testid="handover-option" className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                  <Avatar name={memberLabel(m)} photoUrl={m.photoUrl} size={40} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{memberLabel(m)}</span>
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}
