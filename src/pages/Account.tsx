import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, LogOut, Users } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { OrganiserOnboarding } from '@/modules/organiser-self-serve/components/OrganiserOnboarding';
import { OrganiserHome } from '@/modules/organiser-self-serve/components/OrganiserHome';
import { cn } from '@/lib/utils';
import {
  LIFECYCLE_LABEL,
  fetchMyAccessRequests,
  fetchOrganiserHome,
  myAccessRequestsQueryKey,
  organiserHomeQueryKey,
  type HomeOrganiser,
} from '@/modules/organiser-self-serve/selfServeApi';
import { declinedRequests } from '@/modules/organiser-self-serve/accessRequestModel';
import { isMailboxProvenToken } from '@/modules/organiser-self-serve/sessionProof';

/**
 * /account -- the signed-in landing (Lever 2, W1). Flag-gated
 * (VITE_ENABLE_ORGANISER_SELF_SERVE) and behind AuthGuard; never indexed.
 *
 * A user with no organiser meets onboarding (mockup 06-B: claim, request
 * access, create). A user with organisers sees them listed (a selector when
 * there are several) above the selected one's home (W2, mockup 01-B).
 *
 * AuthGuard wraps the page HERE, inside this lazy chunk, not in
 * AnimatedRoutes: it imports the Supabase client, and pulling it into the
 * catchall chunk cost every catchall route a first-load request.
 */

/** One organiser in the selector shown when the user runs several. */
function OrganiserRow({ org, selected, onSelect }: { org: HomeOrganiser; selected: boolean; onSelect: () => void }) {
  const upcoming = org.series.reduce((sum, s) => sum + (Number(s.upcoming_count) || 0), 0);
  return (
    <li
      className={cn('rounded-md border p-3 flex items-center gap-3', selected ? 'border-primary' : 'border-border')}
      data-testid="my-organiser"
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold truncate">{org.name}</span>
        <span className="block text-xs text-muted-foreground">
          {org.role === 'owner' ? 'Owner' : 'Manager'} &middot; {org.series.length} series &middot; {upcoming} upcoming dates
        </span>
      </button>
      <Badge variant={org.lifecycle_status === 'live' ? 'default' : 'secondary'} className="text-[11px]">
        {LIFECYCLE_LABEL[org.lifecycle_status] ?? org.lifecycle_status}
      </Badge>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);

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
  const selected = organisers.find((o) => o.id === selectedId) ?? organisers[0] ?? null;
  const openRequests = useMemo(() => (requests.data ?? []).filter((r) => r.status === 'open'), [requests.data]);
  const declined = useMemo(() => declinedRequests(requests.data ?? []), [requests.data]);
  const requestedIds = useMemo(() => new Set(openRequests.map((r) => r.organiserId)), [openRequests]);
  const mailboxProven = isMailboxProvenToken(session?.access_token);

  // The confirmation line sits at the top of the page, above the fold on a phone.
  const announce = (message: string) => {
    setConfirmation(message);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refresh = (message: string, organiserId?: string) => {
    announce(message);
    if (organiserId) setSelectedId(organiserId);
    setShowOnboarding(false);
    void queryClient.invalidateQueries({ queryKey: organiserHomeQueryKey(user?.id) });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
  };

  // The onboarding card unmounts on success, so bring the confirmation into view
  // and focus it for screen readers; the scroll-to-top alone can miss it.
  useEffect(() => {
    if (!confirmation) return;
    const el = confirmationRef.current;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  }, [confirmation]);

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
    <div className="tap-44-crumbs contents">
      <GlobalLayout breadcrumbs={buildBreadcrumbs('account')} floatingCount={0}>
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-24 space-y-4 tap-44" data-testid="account-page">
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
          <p ref={confirmationRef} tabIndex={-1} className="text-sm text-primary flex items-start gap-2 outline-none" role="status" data-testid="account-confirmation">
            <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {confirmation}
          </p>
        )}

        {home.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : home.isError && !home.data ? (
          // A home that never loaded. A failed RELOAD (after a write) keeps the organisers on screen.
          <div className="rounded-md border border-border p-3 space-y-2" role="alert">
            <p className="text-sm">We couldn&rsquo;t load your organisers.</p>
            <Button size="sm" variant="outline" onClick={() => void home.refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            {organisers.length > 1 && (
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Your organisers</h2>
                <ul className="space-y-2">
                  {organisers.map((org) => (
                    <OrganiserRow
                      key={org.id}
                      org={org}
                      selected={org.id === selected?.id}
                      onSelect={() => setSelectedId(org.id)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {selected && (
              <OrganiserHome
                key={selected.id}
                organiser={selected}
                today={home.data?.today ?? ''}
                onSentForReview={() => announce('Sent for review.')}
              />
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

            {declined.length > 0 && (
              <section className="space-y-2" data-testid="declined-access-requests">
                <h2 className="text-base font-semibold">Request declined</h2>
                <ul className="space-y-2">
                  {declined.map((r) => (
                    <li key={r.requestId} className="rounded-md border border-border p-3 text-sm space-y-1" role="status">
                      <p>
                        Your request for access to <span className="font-medium">{r.organiserName ?? 'an organiser'}</span> was declined
                        {' '}&middot; {new Date(r.resolvedAt ?? r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        The reason is not shown here yet. If you are the organiser, you can ask again with a note, or claim the page by confirming your email.
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selected && (
              <Link
                to={`/account/team/${selected.id}`}
                className="text-sm text-primary tap-link gap-1"
                data-testid="team-link"
              >
                <Users className="w-4 h-4" aria-hidden="true" /> Team and access requests
              </Link>
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
                className="text-sm text-primary tap-link gap-1"
                onClick={() => setShowOnboarding(true)}
              >
                Add another organiser <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            {organisers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Just here to dance? <Link to="/" className="text-primary tap-link-inline">Skip this and browse events</Link>.
              </p>
            )}
          </>
        )}
      </div>
      </GlobalLayout>
    </div>
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
