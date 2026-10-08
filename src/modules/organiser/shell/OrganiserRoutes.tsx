import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SkeletonRows } from '../ui/Skeleton';
import { OrganiserShell } from './OrganiserShell';
import { ORG_PATHS } from './paths';

// One lazy chunk per worker folder, so W1..W4 only ever fill their own folder.
const HomePage = lazyWithRetry(() => import('../home'));
const EventsPage = lazyWithRetry(() => import('../events'));
const NewEventPage = lazyWithRetry(() => import('../events/NewEventPage'));
const EventEditorPage = lazyWithRetry(() => import('../events/EventEditorPage'));
const DatePage = lazyWithRetry(() => import('../dates'));
const TeamPage = lazyWithRetry(() => import('../team'));
const ProfilePage = lazyWithRetry(() => import('../profile'));

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
 * /account/o/* -- the rebuilt organiser area (arc/organiser-rebuild).
 * Mounted beside the old /account pages, which keep working until W5.
 * AuthGuard wraps it here, inside this lazy chunk, exactly as Account.tsx
 * does (signed-out visitors go to the same /auth sign-in, with returnTo).
 */
export default function OrganiserRoutes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <PrefetchOrganiserHome />
      <Suspense fallback={<ShellFallback />}>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/new" element={<NewEventPage />} />
          <Route path="events/:seriesId" element={<EventEditorPage />} />
          <Route path="events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to={ORG_PATHS.home} replace />} />
        </Routes>
      </Suspense>
    </AuthGuard>
  );
}
