import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
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
 * /account/o/* -- the rebuilt organiser area (arc/organiser-rebuild).
 * Mounted beside the old /account pages, which keep working until W5.
 * AuthGuard wraps it here, inside this lazy chunk, exactly as Account.tsx
 * does (signed-out visitors go to the same /auth sign-in, with returnTo).
 */
export default function OrganiserRoutes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
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
