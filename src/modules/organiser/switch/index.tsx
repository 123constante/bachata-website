import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { useOrgSurface } from '../shell/surface';
import { Card, Chip, ErrorState, SkeletonRows } from '../ui';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { rememberChoice, useOrganiserChoice } from './useOrganiserChoice';
import { fetchMyRoleIntent, fetchMyRoles, myRoleIntentQueryKey, myRolesQueryKey } from '@/modules/areas/home/rolesApi';
import { AREA_HREF, AREA_NAME } from '@/modules/areas/home/areaStatus';
import { otherPagesOf, roleWordOf, todosOf } from '@/modules/organiser/p3/model/strip';
import { L } from '@/modules/organiser/p3/model/labels';
import { AddProfileCard } from './AddProfileCard';
import { flags } from '@/lib/featureFlags';
import { COMING_SOON_LABEL, COMING_SOON_NAME, comingSoonRoles } from '@/components/account/profiles/switchR4Model';

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
 * Dashboard switch, Round-4 (flag dashboardSwitchR4): Teacher / DJ are grey Coming soon rows, shown
 * ONLY when picked at onboarding (switchR4Model, the sheet's one rule), never links; Dancer keeps its link.
 */
function OtherPagesR4() {
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const intent = useQuery({ queryKey: myRoleIntentQueryKey, queryFn: fetchMyRoleIntent });
  const soon = comingSoonRoles(intent.data);
  const links = otherPagesOf(roles.data).filter((r) => r !== 'teacher' && r !== 'dj');
  if (soon.length === 0 && links.length === 0) return null;
  return (
    <>
      <h2 className="mt-[16px] mb-[8px] font-mono text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--mut)]">{L.strip.otherPages}</h2>
      <Card testId="switch-other-pages" className="rounded-[11px]">
        {soon.map((role) => (
          <div
            key={role}
            aria-disabled="true"
            data-testid={`switch-soon-${role}`}
            className="flex min-h-[52px] w-full cursor-not-allowed items-center gap-[12px] px-[16px] text-[13px] text-[var(--mut)]"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{COMING_SOON_NAME[role]}</span>
            <span className="shrink-0 rounded-full border border-[var(--line)] px-[7px] py-[3px] font-mono text-[11px] uppercase leading-none tracking-[0.07em]">{COMING_SOON_LABEL}</span>
          </div>
        ))}
        {links.map((role) => (
          <Link
            key={role}
            to={AREA_HREF[role]}
            data-testid={`switch-area-${role}`}
            className="flex min-h-[52px] w-full items-center px-[16px] text-[13px] font-medium text-[var(--fg)]"
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
  const r4 = flags.dashboardSwitchR4;
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
        <Card testId="switch-list" className={r4 ? 'rounded-[11px]' : undefined}>
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
                <span
                  className={r4
                    ? 'shrink-0 rounded-full border border-[var(--btn)] px-[7px] py-[3px] text-[11px] font-semibold uppercase leading-none tracking-[0.07em] text-[var(--btn)]'
                    : 'rounded-[8px] bg-[var(--btn)] px-[8px] py-[2px] text-[12px] font-semibold text-[var(--btnfg)]'}
                  data-testid="switch-showing"
                >
                  {SHOWING}
                </span>
              )}
            </button>
          ))}
        </Card>
      )}
      {kind === 'p3' && (r4 ? <OtherPagesR4 /> : <OtherPages />)}
      {/* Round-4 (option B): Add a page is one card row; the Add a profile card leaves this page for the sheet's + Add a profile. */}
      {r4 ? (
        <Card className="mt-[16px] rounded-[11px]">
          <Link
            to={addPage}
            data-testid="switch-add-page"
            className="flex min-h-[52px] w-full items-center gap-[12px] px-[16px] text-[13px] font-medium text-[var(--gold-fg)]"
          >
            <span aria-hidden="true" className="text-[18px] leading-none">+</span>
            Add a page
          </Link>
        </Card>
      ) : (<>
      <Link
        to={addPage}
        data-testid="switch-add-page"
        // P3: the terracotta text-link token (--gold-fg), as P3's other text links; --gold is for fills (2.69:1 on cream).
        className={`mt-[12px] flex min-h-[44px] items-center justify-center text-[15px] font-semibold ${kind === 'p3' ? 'text-[var(--gold-fg)]' : 'text-[var(--gold)]'}`}
      >
        Add a page
      </Link>
      {/* P3 (slice 1c): the roles the person lacks, last on the page. Flag off (R1) = today's Switch. */}
      {kind === 'p3' && <AddProfileCard key={user?.id ?? 'signed-out'} userId={user?.id} organiserPages={organisers.length} addPage={addPage} />}
      </>)}
    </Shell>
  );
}
