import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ExternalLink, LogOut } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { OrganiserOnboarding } from '@/modules/organiser-self-serve/components/OrganiserOnboarding';
import {
  LIFECYCLE_LABEL,
  fetchMyAccessRequests,
  fetchOrganiserHome,
  myAccessRequestsQueryKey,
  organiserHomeQueryKey,
  type HomeOrganiser,
} from '@/modules/organiser-self-serve/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser-self-serve/sessionProof';

/**
 * /account -- the signed-in landing (Lever 2, W1). Flag-gated
 * (VITE_ENABLE_ORGANISER_SELF_SERVE) and behind AuthGuard; never indexed.
 *
 * A user with no organiser meets onboarding (mockup 06-B: claim, request
 * access, create). A user with one sees it listed; W2 replaces that list with
 * the organiser home (mockup 01-B).
 *
 * AuthGuard wraps the page HERE, inside this lazy chunk, not in
 * AnimatedRoutes: it imports the Supabase client, and pulling it into the
 * catchall chunk cost every catchall route a first-load request.
 */

function OrganiserRow({ org }: { org: HomeOrganiser }) {
  const live = org.lifecycle_status === 'live';
  const upcoming = org.series.reduce((sum, s) => sum + (Number(s.upcoming_count) || 0), 0);
  return (
    <li className="rounded-md border border-border p-3 flex items-center gap-3" data-testid="my-organiser">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{org.name}</p>
        <p className="text-xs text-muted-foreground">
          {org.role === 'owner' ? 'Owner' : 'Manager'} &middot; {org.series.length} series &middot; {upcoming} upcoming dates
        </p>
        {org.lifecycle_status === 'draft' && (
          <p className="text-xs text-muted-foreground mt-1">Not public yet. Next: add your events and send it for review.</p>
        )}
        {org.lifecycle_status === 'pending_review' && (
          <p className="text-xs text-muted-foreground mt-1">The team is checking it, usually within a day.</p>
        )}
        {org.lifecycle_status === 'rejected' && org.latest_decision?.reason && (
          <p className="text-xs text-destructive mt-1">{org.latest_decision.reason}</p>
        )}
      </div>
      <Badge variant={live ? 'default' : 'secondary'} className="text-[11px]">
        {LIFECYCLE_LABEL[org.lifecycle_status] ?? org.lifecycle_status}
      </Badge>
      {live && (
        <Link
          to={`/organisers/${org.slug ?? org.id}`}
          className="text-xs text-primary inline-flex items-center gap-1"
          aria-label={`Public page for ${org.name}`}
        >
          Page <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

function AccountPage() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [signOutNote, setSignOutNote] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const home = useQuery({
    queryKey: organiserHomeQueryKey(user?.id),
    queryFn: fetchOrganiserHome,
    enabled: !!user,
  });
  const requests = useQuery({
    queryKey: myAccessRequestsQueryKey(user?.id),
    queryFn: fetchMyAccessRequests,
    enabled: !!user,
  });

  const organisers = useMemo(() => home.data?.organisers ?? [], [home.data]);
  const myIds = useMemo(() => new Set(organisers.map((o) => o.id)), [organisers]);
  const openRequests = useMemo(() => (requests.data ?? []).filter((r) => r.status === 'open'), [requests.data]);
  const requestedIds = useMemo(() => new Set(openRequests.map((r) => r.organiserId)), [openRequests]);
  const mailboxProven = isMailboxProvenToken(session?.access_token);

  const refresh = (message: string) => {
    setConfirmation(message);
    setShowOnboarding(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void queryClient.invalidateQueries({ queryKey: organiserHomeQueryKey(user?.id) });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
  };

  const handleSignOut = async () => {
    const outcome = await signOut();
    if (outcome === 'failed') {
      setSignOutNote('Sign-out did not complete. Check your connection and try again.');
      return;
    }
    navigate('/', { replace: true });
  };

  if (!user) return null;

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('account')} floatingCount={0}>
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-24 space-y-4" data-testid="account-page">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Your account</h1>
            <p className="text-xs text-muted-foreground truncate">Signed in as {user.email}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void handleSignOut()}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </header>
        {signOutNote && <p className="text-xs text-destructive" role="alert">{signOutNote}</p>}
        {confirmation && (
          <p className="text-sm text-primary flex items-start gap-2" role="status" data-testid="account-confirmation">
            <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {confirmation}
          </p>
        )}

        {home.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : home.isError ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert">
            <p className="text-sm">We couldn&rsquo;t load your organisers.</p>
            <Button size="sm" variant="outline" onClick={() => void home.refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            {organisers.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Your organisers</h2>
                <ul className="space-y-2">
                  {organisers.map((org) => <OrganiserRow key={org.id} org={org} />)}
                </ul>
              </section>
            )}

            {openRequests.length > 0 && (
              <section className="space-y-2" data-testid="my-access-requests">
                <h2 className="text-base font-semibold">Waiting for an answer</h2>
                <ul className="space-y-1">
                  {openRequests.map((r) => (
                    <li key={r.requestId} className="text-sm text-muted-foreground">
                      Access to <span className="text-foreground">{r.organiserName ?? 'an organiser'}</span>{' '}
                      &middot; asked {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {organisers.length === 0 || showOnboarding ? (
              <OrganiserOnboarding
                user={user}
                mailboxProven={mailboxProven}
                myOrganiserIds={myIds}
                requestedIds={requestedIds}
                firstRun={organisers.length === 0}
                onChanged={refresh}
              />
            ) : (
              <button
                type="button"
                className="text-sm text-primary inline-flex items-center gap-1"
                onClick={() => setShowOnboarding(true)}
              >
                Add another organiser <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            {organisers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Just here to dance? <Link to="/" className="text-primary">Skip this and browse events</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </GlobalLayout>
  );
}

export default function Account() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountPage />
    </AuthGuard>
  );
}
