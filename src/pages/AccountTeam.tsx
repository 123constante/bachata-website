import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { TeamPanel } from '@/modules/organiser-self-serve/components/TeamPanel';
import { PageLoadError, PageLoading, PageOffline } from '@/modules/organiser-self-serve/components/PageStates';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser-self-serve/selfServeApi';

/**
 * /account/team/:organiserId? -- who runs an organiser and who is asking to
 * (Lever 2 W6). Flag-gated (VITE_ENABLE_ORGANISER_SELF_SERVE) like /account,
 * behind AuthGuard inside this lazy chunk, and never indexed. The organiser
 * must be one of the caller's own: organiser_home_v1 lists only those, so a
 * foreign id shows "not yours" without a second read.
 */
function AccountTeamPage() {
  const { user } = useAuth();
  const { organiserId } = useParams<{ organiserId?: string }>();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user });

  if (!user) return null;
  const organisers = home.data?.organisers ?? [];
  const organiser = organiserId ? organisers.find((o) => o.id === organiserId) ?? null : organisers[0] ?? null;

  return (
    <div className="tap-44-crumbs contents">
      <GlobalLayout breadcrumbs={buildBreadcrumbs('accountTeam')} floatingCount={0}>
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 pt-3 pb-24 space-y-4 tap-44" data-testid="account-team-page">
        <Link to="/account" className="text-xs text-primary tap-link gap-1">
          <ChevronLeft className="w-3 h-3" aria-hidden="true" /> Your account
        </Link>
        {/* Until the organiser is known there is no team name, so each state below carries the page's h1. */}
        {home.isPending && home.isPaused ? (
          <PageOffline titleAs="h1" />
        ) : home.isPending ? (
          <PageLoading label="Loading your team">
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </PageLoading>
        ) : home.isError && !home.data ? (
          <PageLoadError titleAs="h1" title="We couldn&rsquo;t load your team." onRetry={() => void home.refetch()} />
        ) : organisers.length === 0 ? (
          <div className="rounded-md border border-border p-3 space-y-2" data-testid="team-no-organiser">
            <h1 className="text-sm font-semibold">You don&rsquo;t run an organiser yet.</h1>
            <p className="text-xs text-muted-foreground">
              A team belongs to an organiser. <Link to="/account" className="text-primary tap-link-inline">Claim yours or create one</Link>, then your team shows here.
            </p>
          </div>
        ) : !organiser ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert" data-testid="team-unavailable">
            <h1 className="text-sm font-semibold">This team isn&rsquo;t yours to see.</h1>
            <p className="text-xs text-muted-foreground">
              It belongs to an organiser you don&rsquo;t help run.{' '}
              <Link to="/account" className="text-primary tap-link-inline">Back to your account</Link>.
            </p>
          </div>
        ) : (
          <>
            <header>
              <h1 className="text-lg font-semibold leading-tight" data-testid="team-title">{organiser.name}</h1>
              <p className="text-xs text-muted-foreground">Team and access requests</p>
            </header>
            <TeamPanel key={organiser.id} organiser={organiser} />
          </>
        )}
      </div>
      </GlobalLayout>
    </div>
  );
}

export default function AccountTeam() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountTeamPage />
    </AuthGuard>
  );
}
