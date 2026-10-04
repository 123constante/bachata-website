import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useLondonToday } from '@/hooks/useLondonToday';
import { CreateEventForm } from '@/modules/organiser-self-serve/components/CreateEventForm';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser-self-serve/selfServeApi';

/**
 * /account/new -- create a party or a weekly class (Lever 2 W3, mockup 02-A).
 * Flag-gated (VITE_ENABLE_ORGANISER_SELF_SERVE) like /account, behind
 * AuthGuard inside this lazy chunk, never indexed. The organisers come from
 * the same organiser_home_v1 read the home uses (one cache entry); the server
 * decides what lands: a create needs a LIVE organiser the caller owns or
 * manages, and the form explains that before it is sent.
 */

function AccountNewPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const home = useQuery({
    queryKey: organiserHomeQueryKey(user?.id),
    queryFn: fetchOrganiserHome,
    enabled: !!user,
  });
  const today = useLondonToday(home.data?.today);

  if (!user) return null;
  const organisers = home.data?.organisers ?? [];

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('account.new')} floatingCount={0}>
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 pt-3 pb-24 space-y-4" data-testid="account-new-page">
        <Link to="/account" className="text-xs text-primary inline-flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" aria-hidden="true" /> My events
        </Link>
        <h1 className="text-lg font-semibold leading-tight">New event</h1>
        {home.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        ) : home.isError && !home.data ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert">
            <p className="text-sm">We couldn&rsquo;t load your organisers.</p>
            <Button size="sm" variant="outline" onClick={() => void home.refetch()}>Try again</Button>
          </div>
        ) : organisers.length === 0 ? (
          <div className="rounded-md border border-border p-3 space-y-2" data-testid="create-no-organiser">
            <p className="text-sm font-semibold">Set up your organiser first.</p>
            <p className="text-xs text-muted-foreground">
              Events belong to an organiser. <Link to="/account" className="text-primary">Claim yours or create one</Link>, then come back here.
            </p>
          </div>
        ) : (
          <CreateEventForm organisers={organisers} initialOrganiserId={params.get('organiser')} today={today} />
        )}
      </div>
    </GlobalLayout>
  );
}

export default function AccountNew() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountNewPage />
    </AuthGuard>
  );
}
