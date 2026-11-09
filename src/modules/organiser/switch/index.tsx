import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { useOrgSurface } from '../shell/surface';
import { Card, Chip, ErrorState, SkeletonRows } from '../ui';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { rememberChoice, useOrganiserChoice } from './useOrganiserChoice';
import { fetchMyRoles, myRolesQueryKey } from '@/modules/areas/home/rolesApi';
import { AREA_HREF, AREA_NAME } from '@/modules/areas/home/areaStatus';
import { otherPagesOf, roleWordOf, todosOf } from '@/modules/organiser/p3/model/strip';
import { L } from '@/modules/organiser/p3/model/labels';

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

/** P3's mark on the page You shows. */
export const SHOWING = 'Showing';

/** P3 (slice 1a): the teacher, DJ and dancer pages the person holds (my_roles_v1), under the organiser pages. Never badged. */
function OtherPages() {
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const held = otherPagesOf(roles.data);
  if (held.length === 0) return null;
  return (
    <>
      <h2 className="mt-[16px] mb-[8px] text-[14px] font-semibold text-[var(--mut)]">{L.strip.otherPages}</h2>
      <Card testId="switch-other-pages">
        {held.map((role) => (
          <Link
            key={role}
            to={AREA_HREF[role]}
            data-testid={`switch-area-${role}`}
            className="flex min-h-[56px] w-full items-center border-b border-[var(--line)] px-[16px] py-[8px] text-[15px] font-semibold text-[var(--fg)] last:border-b-0"
          >
            {AREA_NAME[role]}
          </Link>
        ))}
      </Card>
    </>
  );
}

/**
 * /account/o/switch (C35): the login's pages as rows -- name, role, a Live chip
 * when live (D22: the one status mark). Tap = choose, and Home opens on it.
 */
export default function SwitchPage() {
  const navigate = useNavigate();
  const { kind, Shell, hub, addPage } = useOrgSurface();
  const { user, home, organisers, selected } = useOrganiserChoice();
  const choose = (id: string) => {
    rememberChoice(user?.id, id);
    navigate(`${hub.to}?o=${encodeURIComponent(id)}`);
  };
  const failed = (home.isError || (home.isPending && home.isPaused)) && !home.data;
  return (
    <Shell title="Switch page" back={hub} testId="org-page-switch">
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
                <span className="block text-[13px] text-[var(--mut)]">{roleWordOf(o.role)}</span>
              </span>
              {/* P3: an OTHER organiser page with to-dos carries its count; the open page and a page with none carry nothing. */}
              {kind === 'p3' && home.data && o.id !== selected?.id && todosOf(home.data, o.id) > 0 && (
                <span
                  className="inline-flex min-w-[20px] items-center justify-center rounded-[999px] bg-[var(--btn)] px-[6px] text-[12px] font-bold leading-[20px] text-[var(--btnfg)]"
                  data-testid="switch-todo-badge"
                  aria-label={L.strip.pageTodos(todosOf(home.data, o.id))}
                >
                  {todosOf(home.data, o.id)}
                </span>
              )}
              {o.lifecycle_status === 'live' && (
                <span className="rounded-[8px] bg-[var(--ok-bg)] px-[8px] py-[2px] text-[12px] font-semibold text-[var(--ok-fg)]">{lifecycleTag('live').label}</span>
              )}
              {/* P3: Switch decides which page You, Team and the page editor show; say which one that is. */}
              {kind === 'p3' && o.id === selected?.id && (
                <span className="rounded-[8px] bg-[var(--btn)] px-[8px] py-[2px] text-[12px] font-semibold text-[var(--btnfg)]" data-testid="switch-showing">{SHOWING}</span>
              )}
            </button>
          ))}
        </Card>
      )}
      {kind === 'p3' && <OtherPages />}
      <Link
        to={addPage}
        data-testid="switch-add-page"
        // P3: the terracotta text-link token (--gold-fg), as P3's other text links; --gold is for fills (2.69:1 on cream).
        className={`mt-[12px] flex min-h-[44px] items-center justify-center text-[15px] font-semibold ${kind === 'p3' ? 'text-[var(--gold-fg)]' : 'text-[var(--gold)]'}`}
      >
        Add a page
      </Link>
    </Shell>
  );
}
