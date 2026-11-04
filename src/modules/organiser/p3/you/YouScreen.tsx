import { Link } from 'react-router-dom';
import { YouTicketsRow } from '../shell/youTickets';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { NO_PAGE_ADD } from '@/modules/organiser/shared/teamRules';
import { useAuth } from '@/hooks/useAuth';
import { graceStatusFrom, onboardingLeft } from '../onboarding/graceModel';
import { fetchOnboardingStatus, onboardingStatusKey } from '../onboarding/statusQuery';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { ROLE_LABEL } from '@/modules/organiser/shared/teamModel';
import { P3_PATHS } from '../shell/paths';
import { Avatar } from '../../team/Avatar';
import { useTeamContext } from '../../team/useTeamContext';
import { RetryButton, StateCard } from '../screens/parts';
import { P3_SURFACE } from './surface';
import { YOU, youRows, type YouRow } from './youRows';
import { londonTodayKey } from '@/lib/londonDate';
import { LEGACY_UNTIL_LABEL, legacyAreaHref } from '@/lib/organiserAreaHome';

function Chev() {
  return (
    <svg className="p3-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function NavRow({ r }: { r: YouRow }) {
  const body = (
    <>
      <span className="p3-grow">
        <span className="p3-row-t" style={r.to ? undefined : { color: 'var(--mut)' }}>{r.label}</span>
        {(r.reason ?? r.sub) && <span className="p3-row-s p3-block">{r.reason ?? r.sub}</span>}
      </span>
      {r.badge !== null && <span className="p3-count p3-count-warn" aria-label={YOU.requestsLabel(r.badge)}>{r.badge}</span>}
      {r.to && <Chev />}
    </>
  );
  return r.to ? (
    <Link to={r.to} className="p3-navrow" data-testid={`p3-you-${r.id}`}>{body}</Link>
  ) : (
    <div className="p3-navrow" aria-disabled="true" data-testid={`p3-you-${r.id}`} data-disabled="true">{body}</div>
  );
}

/** The page You is about: photo, name, the person's role, its status. */
function PageCard({ page }: { page: HomeOrganiser }) {
  // The page's lifecycle in the shared words (Live, Draft, Paused...), the one status mark (D22).
  const tag = lifecycleTag(page.lifecycle_status);
  const tone = tag.tone === 'live' ? 'live' : tag.tone === 'draft' ? 'draft' : 'hidden';
  return (
    <section className="p3-card p3-you-page" data-testid="p3-you-page-card">
      <Avatar name={page.name} photoUrl={page.avatar_url} size={48} />
      <span className="p3-grow">
        <span className="p3-row-t p3-block" data-testid="p3-you-page-name">{page.name}</span>
        <span className="p3-row-s">{ROLE_LABEL[page.role]}</span>
      </span>
      <span className={`p3-tag p3-tag-${tone}`} data-testid="p3-you-page-status">{tag.label}</span>
    </section>
  );
}

function AccountCard() {
  return (
    <section className="p3-card p3-list">
      <NavRow r={{ id: 'account', label: YOU.account, sub: YOU.accountSub, to: P3_PATHS.youAccount, reason: null, badge: null }} />
    </section>
  );
}

/**
 * P3 You (W4a, mockup A): the shown page as a card, then one row per area (Switch page with 2+
 * pages, Organiser page, Team, Add another page), each pushing its screen; back returns here.
 * Reads the same team, join-request and onboarding-status caches the pushed screens read, so the
 * numbers here and there agree.
 */
export function YouScreen() {
  const ctx = useTeamContext();
  const { organiser, organisers } = ctx;
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser?.id),
    queryFn: () => fetchIncomingAccessRequests(organiser!.id),
    enabled: !!organiser,
  });
  // The Home banner's read and count (one mapping), for the page shown here.
  const { user } = useAuth();
  const status = useQuery({ queryKey: onboardingStatusKey(user?.id), queryFn: fetchOnboardingStatus, enabled: !!user?.id && !!organiser, staleTime: 60_000, retry: false });

  if (ctx.loading) return <StateCard title={YOU.loading} testId="p3-you-loading">This takes a second.</StateCard>;
  if (!organiser && ctx.failed) {
    return (
      <StateCard title={YOU.failed} testId="p3-you-error">
        <p>{YOU.failedBody}</p>
        <RetryButton onClick={ctx.retry} />
      </StateCard>
    );
  }

  const rows = youRows({
    pages: organisers.length,
    teamCount: organiser && !ctx.failed ? ctx.members.length : null,
    requests: requests.data?.length ?? 0,
    requiredLeft: onboardingLeft(status.data ? graceStatusFrom(status.data, organiser?.id ?? null) : null),
    addPage: P3_SURFACE.addPage,
  });

  return (
    <div className="p3-stack" data-testid="p3-you">
      {organiser ? (
        <PageCard page={organiser} />
      ) : (
        <StateCard title={NO_PAGE_ADD.title} testId="p3-you-no-page">
          <p>{NO_PAGE_ADD.body}</p>
          <Link to={P3_SURFACE.addPage} className="p3-btn p3-btn-link" data-testid="p3-you-add-page-link">{NO_PAGE_ADD.action}</Link>
        </StateCard>
      )}
      <YouTicketsRow />
      <section className="p3-card p3-list" data-testid="p3-you-rows">
        {rows.map((r) => <NavRow key={r.id} r={r} />)}
      </section>
      <AccountCard />
      <LegacyAreaLink />
    </div>
  );
}

/** Owner decision 1 (c): the dated way back to the old organiser area, so nobody is trapped. Gone after LEGACY_UNTIL. */
function LegacyAreaLink() {
  const href = legacyAreaHref(londonTodayKey());
  if (!href) return null;
  return (
    <p className="p3-row-s">
      <Link to={href} className="p3-link" data-testid="p3-you-legacy-area">Use the old organiser area (until {LEGACY_UNTIL_LABEL})</Link>
      {/* review 1237 r1 N2: the choice holds only inside the old area's own links, this tab */}{' '}
      It stays open in this tab while you use its own links; other links bring you back here.
    </p>
  );
}
