import { Link, useNavigate } from 'react-router-dom';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Card, Chip, ErrorState, SkeletonRows } from '../ui';
import { rememberChoice, useOrganiserChoice } from './useOrganiserChoice';

/**
 * A row of chips, one per organiser, shown only when there are several (the
 * old /account listed them and let you pick one). Wraps, never scrolls sideways.
 */
export function OrganiserSwitcher({ organisers, selectedId, onChoose }: {
  organisers: HomeOrganiser[];
  selectedId: string | null;
  onChoose: (id: string) => void;
}) {
  if (organisers.length < 2) return null;
  return (
    <div role="group" aria-label="Choose an organiser" className="flex flex-wrap gap-[8px]" data-testid="org-switcher">
      {organisers.map((o) => (
        <Chip key={o.id} selected={o.id === selectedId} onToggle={() => onChoose(o.id)} testId={`org-switch-${o.id}`}>
          <span className="max-w-[14rem] truncate">{o.name}</span>
        </Chip>
      ))}
    </div>
  );
}

const ROLE: Record<HomeOrganiser['role'], string> = { owner: 'Owner', manager: 'Manager' };

/**
 * /account/o/switch (C35): the login's pages as rows -- name, role, a Live chip
 * when live (D22: the one status mark). Tap = choose, and Home opens on it.
 */
export default function SwitchPage() {
  const navigate = useNavigate();
  const { home, organisers, selected } = useOrganiserChoice();
  const choose = (id: string) => {
    rememberChoice(id);
    navigate(`${ORG_PATHS.home}?o=${encodeURIComponent(id)}`);
  };
  const failed = (home.isError || (home.isPending && home.isPaused)) && !home.data;
  return (
    <OrganiserShell title="Switch page" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-switch">
      {home.isPending && !home.isPaused ? (
        <SkeletonRows count={2} label="Loading your pages" testId="switch-loading" />
      ) : failed ? (
        <ErrorState
          title={home.isPaused ? <>You&rsquo;re offline</> : 'Your pages did not load'}
          onRetry={() => void home.refetch()}
          retrying={home.isFetching}
          testId="switch-error"
        />
      ) : (
        <Card testId="switch-list">
          {organisers.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              aria-current={o.id === selected?.id ? 'true' : undefined}
              data-testid="switch-row"
              className="flex min-h-[56px] w-full items-center gap-[12px] border-b border-[var(--line)] px-[16px] py-[8px] text-left last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{o.name}</span>
                <span className="block text-[13px] text-[var(--mut)]">{ROLE[o.role] ?? o.role}</span>
              </span>
              {o.lifecycle_status === 'live' && (
                <span className="rounded-[8px] bg-[var(--ok-bg)] px-[8px] py-[2px] text-[12px] font-semibold text-[var(--ok-fg)]">Live</span>
              )}
            </button>
          ))}
        </Card>
      )}
      <Link
        to={`${ORG_PATHS.home}?add=1`}
        data-testid="switch-add-page"
        className="mt-[12px] flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--gold)]"
      >
        Add a page
      </Link>
    </OrganiserShell>
  );
}
