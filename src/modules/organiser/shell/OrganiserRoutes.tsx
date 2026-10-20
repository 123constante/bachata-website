import { Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useAccountGate } from '@/lib/accountGate';
import { finishProfileHref } from '@/lib/profileCompletion';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SkeletonRows } from '../ui/Skeleton';
import { ModuleLegacyRedirect } from './LegacyRedirect';
import { OrganiserShell } from './OrganiserShell';
import { ORG_PATHS } from './paths';

// One lazy chunk per folder. main's screens stay mounted on the R1 paths until
// their slice swaps them. Every R1 route group has landed (INT2): no route
// points at ./placeholders any more.
const HomePage = lazyWithRetry(() => import('../home'));
const EventsPage = lazyWithRetry(() => import('../events'));
const OneEvent = lazyWithRetry(() => import('../events/OneEvent'));
const DatePage = lazyWithRetry(() => import('../dates'));
const TeamPage = lazyWithRetry(() => import('../team'));
const PageScreen = lazyWithRetry(() => import('../page')); // S7 page/
const SwitchFlow = lazyWithRetry(() => import('../switch')); // S1 switch/
const ChangeFlow = lazyWithRetry(() => import('../flows/change')); // S2 flows/change
const AddFlow = lazyWithRetry(() => import('../flows/add')); // S3 flows/add
const CancelFlow = lazyWithRetry(() => import('../flows/cancel')); // S3 flows/cancel
const NewFlow = lazyWithRetry(() => import('../flows/new'));
const EventDetails = lazyWithRetry(() => import('../events/Details'));
const ProgrammeSeries = lazyWithRetry(() => import('../events/ProgrammeSeries')); // SW1 series programme
const SeriesOrganisers = lazyWithRetry(() => import('../events/SeriesOrganisers')); // SW1 event organisers
const TeamFlow = lazyWithRetry(() => import('../team/TeamFlow')); // S6 team/ (add, person)
const HandoverFlow = lazyWithRetry(() => import('../flows/handover')); // S6 flows/handover
const MorePage = lazyWithRetry(() => import('../more')); // S7 more/
const HelpPage = lazyWithRetry(() => import('../more/help')); // S7 more/help
const CoverFlow = lazyWithRetry(() => import('../flows/fix')); // S7 flows/fix
const DonePage = lazyWithRetry(() => import('../flows/Done')); // S0b flows/Done (wired by S2, its first caller)

// The loading frame keeps the header's shape but draws NO Switch-profile button: this
// frame is thrown away when the gate settles and again when the page chunk arrives, and a
// sheet opened from it vanished mid-tap with it. The real button comes with the page.
function ShellFallback() {
  return (
    <OrganiserShell title="" topBarEnd={<span aria-hidden="true" className="inline-block h-[44px] w-[44px] shrink-0" />}>
      <SkeletonRows count={4} label="Loading" testId="org-route-loading" />
    </OrganiserShell>
  );
}

/**
 * Starts organiser_home_v1 (the read Home, Team, Profile and Events all open
 * with) as soon as auth is known, while the page's lazy chunk is still
 * downloading. Without it a cold load ran chunk -> then the RPC, one after the
 * other (the Team page's grey bars, 2026-10-08). Same key and fetcher as the
 * pages, so they pick the result up from the cache; a fresh entry is not re-read.
 */
function PrefetchOrganiserHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (user?.id) void queryClient.prefetchQuery({ queryKey: organiserHomeQueryKey(user.id), queryFn: fetchOrganiserHome });
  }, [queryClient, user?.id]);
  return null;
}

/**
 * The account gate (lib/accountGate, pinned 4.3 #1) is the ONE answer to "may
 * this login see the organiser area": complete -> the area; incomplete -> the
 * Finish screen, back here after; loading -> skeleton; deleted -> nothing (the
 * sign-in landing routes it); signed out -> nothing here, AuthGuard sends it to sign-in.
 */
function AccountGated({ children }: { children: ReactNode }) {
  const { status } = useAccountGate();
  const { pathname, search, hash } = useLocation();
  if (status === 'complete') return <>{children}</>;
  if (status === 'incomplete') return <Navigate to={finishProfileHref(`${pathname}${search}${hash}`)} replace />;
  if (status === 'loading') return <ShellFallback />;
  return null;
}

/**
 * /account/o/* -- the organiser area (R1, rule 2: no tabs, every job a path
 * from Home). AuthGuard wraps it here, inside this lazy chunk, exactly as
 * Account.tsx does (signed-out visitors go to the same /auth sign-in, with returnTo).
 */
export default function OrganiserRoutes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <PrefetchOrganiserHome />
      <AccountGated>
        <Suspense fallback={<ShellFallback />}>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="switch" element={<SwitchFlow />} />

            <Route path="change" element={<ChangeFlow step="event" />} />
            <Route path="change/:seriesId" element={<ChangeFlow step="date" />} />
            <Route path="change/:seriesId/:occurrenceId" element={<ChangeFlow step="what" />} />
            <Route path="change/:seriesId/:occurrenceId/time" element={<ChangeFlow step="time" />} />
            <Route path="change/:seriesId/:occurrenceId/venue" element={<ChangeFlow step="venue" />} />
            <Route path="change/:seriesId/:occurrenceId/lineup" element={<DatePage />} />
            <Route path="change/:seriesId/pick" element={<ChangeFlow step="pick" />} />
            <Route path="change/:seriesId/:occurrenceId/off" element={<ChangeFlow step="off" />} />
            <Route path="change/:seriesId/:occurrenceId/copy" element={<ChangeFlow step="copy" />} />
            <Route path="change/:seriesId/:occurrenceId/:field" element={<ChangeFlow step="detail" />} />

            <Route path="add" element={<AddFlow step="event" />} />
            <Route path="add/:seriesId" element={<AddFlow step="day" />} />
            <Route path="add/:seriesId/:date" element={<AddFlow step="time" />} />

            <Route path="cancel" element={<CancelFlow step="event" />} />
            <Route path="cancel/:seriesId" element={<CancelFlow step="date" />} />
            <Route path="cancel/:seriesId/:occurrenceId" element={<CancelFlow step="confirm" />} />

            <Route path="new/what" element={<NewFlow />} />
            <Route path="new/name" element={<NewFlow />} />
            <Route path="new/:seriesId/venue" element={<NewFlow />} />
            <Route path="new/:seriesId/date" element={<NewFlow />} />
            <Route path="new/:seriesId/time" element={<NewFlow />} />
            <Route path="new/:seriesId/cover" element={<NewFlow />} />

            <Route path="events" element={<EventsPage />} />
            <Route path="events/:seriesId" element={<OneEvent />} />
            <Route path="events/:seriesId/details" element={<EventDetails />} />
            <Route path="events/:seriesId/programme" element={<ProgrammeSeries />} />
            <Route path="events/:seriesId/organisers" element={<SeriesOrganisers />} />

            <Route path="team" element={<TeamPage />} />
            <Route path="team/add" element={<TeamFlow step="add" />} />
            <Route path="team/:userId" element={<TeamFlow step="person" />} />
            <Route path="handover" element={<HandoverFlow step="to" />} />
            <Route path="handover/:userId" element={<HandoverFlow step="confirm" />} />

            <Route path="page" element={<PageScreen />} />
            <Route path="more" element={<MorePage />} />
            <Route path="more/help" element={<HelpPage />} />
            <Route path="cover/:seriesId" element={<CoverFlow />} />
            <Route path="done" element={<DonePage />} />

            {/* main's URLs (bookmarks, links already sent) -> their R1 paths. */}
            <Route path="events/new" element={<ModuleLegacyRedirect target="newEvent" />} />
            <Route path="events/:seriesId/dates/:occurrenceId" element={<ModuleLegacyRedirect target="date" />} />
            <Route path="profile" element={<ModuleLegacyRedirect target="profile" />} />

            <Route path="*" element={<Navigate to={ORG_PATHS.home} replace />} />
          </Routes>
        </Suspense>
      </AccountGated>
    </AuthGuard>
  );
}
