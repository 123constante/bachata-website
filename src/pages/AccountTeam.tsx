import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { TeamPanel } from '@/modules/organiser-self-serve/components/TeamPanel';
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
          <ChevronLeft className="w-3 h-3" aria-hidden="true" /> My events
        </Link>
        {home.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        ) : home.isError && !home.data ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert">
            <p className="text-sm">We couldn&rsquo;t load your team.</p>
            <Button size="sm" variant="outline" onClick={() => void home.refetch()}>Try again</Button>
          </div>
        ) : !organiser ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert" data-testid="team-unavailable">
            <p className="text-sm font-semibold">This team isn&rsquo;t yours to see.</p>
            <p className="text-xs text-muted-foreground">
              {organisers.length === 0 ? 'You do not run an organiser yet.' : 'It belongs to an organiser you don’t help run.'}{' '}
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
