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
// their slice swaps them; the R1 route groups whose folder does not exist yet
// point at ./placeholders, and each slice (S1-S9) changes only its import target.
const HomePage = lazyWithRetry(() => import('../home'));
const EventsPage = lazyWithRetry(() => import('../events'));
const EventEditorPage = lazyWithRetry(() => import('../events/EventEditorPage'));
const DatePage = lazyWithRetry(() => import('../dates'));
const TeamPage = lazyWithRetry(() => import('../team'));
const ProfilePage = lazyWithRetry(() => import('../profile'));
const SwitchFlow = lazyWithRetry(() => import('./placeholders')); // S1 switch/
const ChangeFlow = lazyWithRetry(() => import('./placeholders')); // S2 flows/change
const AddFlow = lazyWithRetry(() => import('./placeholders')); // S3 flows/add
const CancelFlow = lazyWithRetry(() => import('./placeholders')); // S3 flows/cancel
const NewFlow = lazyWithRetry(() => import('../flows/new'));
const EventDetails = lazyWithRetry(() => import('./placeholders')); // S5 events/Details
const TeamFlow = lazyWithRetry(() => import('./placeholders')); // S6 team/
const HandoverFlow = lazyWithRetry(() => import('./placeholders')); // S6 flows/handover
const MorePage = lazyWithRetry(() => import('./placeholders')); // S7 more/
const CoverFlow = lazyWithRetry(() => import('./placeholders')); // S7 flows/fix
const DonePage = lazyWithRetry(() => import('./placeholders')); // S0b flows/Done

function ShellFallback() {
  return (
    <OrganiserShell title="">
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
            <Route path="switch" element={<SwitchFlow name="Switch page" />} />

            <Route path="change" element={<ChangeFlow name="Change a date" />} />
            <Route path="change/:seriesId" element={<ChangeFlow name="Change a date" />} />
            <Route path="change/:seriesId/:occurrenceId" element={<DatePage />} />
            <Route path="change/:seriesId/:occurrenceId/time" element={<ChangeFlow name="Change a date" />} />
            <Route path="change/:seriesId/:occurrenceId/venue" element={<ChangeFlow name="Change a date" />} />
            <Route path="change/:seriesId/:occurrenceId/day" element={<ChangeFlow name="Change a date" />} />

            <Route path="add" element={<AddFlow name="Add a date" />} />
            <Route path="add/:seriesId" element={<AddFlow name="Add a date" />} />
            <Route path="add/:seriesId/:date" element={<AddFlow name="Add a date" />} />

            <Route path="cancel" element={<CancelFlow name="Cancel a date" />} />
            <Route path="cancel/:seriesId" element={<CancelFlow name="Cancel a date" />} />
            <Route path="cancel/:seriesId/:occurrenceId" element={<CancelFlow name="Cancel a date" />} />

            <Route path="new/what" element={<NewFlow />} />
            <Route path="new/name" element={<NewFlow />} />
            <Route path="new/:seriesId/venue" element={<NewFlow />} />
            <Route path="new/:seriesId/date" element={<NewFlow />} />
            <Route path="new/:seriesId/time" element={<NewFlow />} />
            <Route path="new/:seriesId/cover" element={<NewFlow />} />

            <Route path="events" element={<EventsPage />} />
            <Route path="events/:seriesId" element={<EventEditorPage />} />
            <Route path="events/:seriesId/details" element={<EventDetails name="Event details" />} />

            <Route path="team" element={<TeamPage />} />
            <Route path="team/add" element={<TeamFlow name="Team" />} />
            <Route path="team/:userId" element={<TeamFlow name="Team" />} />
            <Route path="handover" element={<HandoverFlow name="Hand over" />} />
            <Route path="handover/:userId" element={<HandoverFlow name="Hand over" />} />

            <Route path="page" element={<ProfilePage />} />
            <Route path="more" element={<MorePage name="More" />} />
            <Route path="cover/:seriesId" element={<CoverFlow name="Cover" />} />
            <Route path="done" element={<DonePage name="Done" />} />

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
