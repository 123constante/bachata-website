import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useLondonToday } from '@/hooks/useLondonToday';
import { SeriesEditor } from '@/modules/organiser-self-serve/components/SeriesEditor';
import { PageLoadError, PageLoading, PageOffline } from '@/modules/organiser-self-serve/components/PageStates';
import { fetchSeriesWorkspace, seriesWorkspaceQueryKey } from '@/modules/organiser-self-serve/selfServeApi';

/**
 * /account/series/:seriesId -- one series for its organiser (Lever 2 W4/W5).
 * Flag-gated (VITE_ENABLE_ORGANISER_SELF_SERVE) like /account, behind
 * AuthGuard inside this lazy chunk, and never indexed. The server decides who
 * may open it: admin_event_workspace_p5 refuses anyone who is not a member of
 * the series' organiser, and this page shows that refusal as "not yours".
 */

/** The workspace RPC's "not a member" and "no such series" refusals. */
const isRefusal = (error: unknown) =>
  /^(permission_denied|series_not_found)/.test(String((error as { message?: unknown } | null)?.message ?? ''));

function AccountSeriesPage() {
  const { user } = useAuth();
  const { seriesId = '' } = useParams<{ seriesId: string }>();
  // The create screen (W3) lands here with what it just did. Read once, then
  // cleared from the history entry so a reload or Back does not repeat it.
  const location = useLocation();
  const navigate = useNavigate();
  const [created] = useState(() => (location.state as { created?: 'draft' | 'submitted' } | null)?.created ?? null);
  useEffect(() => {
    if ((location.state as { created?: unknown } | null)?.created) {
      navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
    }
  }, [location.state, location.pathname, location.search, location.hash, navigate]);
  const today = useLondonToday();
  const workspace = useQuery({
    queryKey: seriesWorkspaceQueryKey(seriesId),
    queryFn: () => fetchSeriesWorkspace(seriesId),
    enabled: !!user && !!seriesId,
    retry: (count, error) => count < 2 && !isRefusal(error),
  });

  if (!user) return null;
  const name = workspace.data?.series.name;
  const refused = workspace.isError && isRefusal(workspace.error);

  return (
    <div className="tap-44-crumbs contents">
      <GlobalLayout breadcrumbs={[...buildBreadcrumbs('account'), { label: name ?? 'Event' }]} floatingCount={0}>
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 pt-3 pb-24 space-y-4 tap-44" data-testid="account-series-page">
        <Link to="/account" className="text-xs text-primary tap-link gap-1">
          <ChevronLeft className="w-3 h-3" aria-hidden="true" /> Your account
        </Link>
        {created && (
          <p className="text-sm text-primary flex items-start gap-2" role="status" data-testid="series-created">
            <Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {created === 'submitted'
              ? 'Sent for review. The Bachata Calendar team usually answers within a day.'
              : 'Saved as a draft. Dancers will not see it until it is submitted and approved.'}
          </p>
        )}
        {/* Until the editor mounts there is no event name, so each state below carries the page's h1. */}
        {workspace.isPending && workspace.isPaused ? (
          <PageOffline titleAs="h1" />
        ) : workspace.isPending ? (
          <PageLoading label="Loading this event">
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </PageLoading>
        ) : refused ? (
          <div className="rounded-md border border-border p-3 space-y-2" role="alert" data-testid="series-unavailable">
            <h1 className="text-sm font-semibold">You can&rsquo;t edit this event.</h1>
            <p className="text-xs text-muted-foreground">
              It belongs to an organiser you don&rsquo;t manage, or it no longer exists.{' '}
              <Link to="/account" className="text-primary tap-link-inline">Back to your account</Link>.
            </p>
          </div>
        ) : workspace.isError || !workspace.data ? (
          <PageLoadError titleAs="h1" title="We couldn&rsquo;t load this event." onRetry={() => void workspace.refetch()} />
        ) : (
          <SeriesEditor workspace={workspace.data} today={today} />
        )}
      </div>
      </GlobalLayout>
    </div>
  );
}

export default function AccountSeries() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountSeriesPage />
    </AuthGuard>
  );
}
