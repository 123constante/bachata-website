import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { P3YouSurface } from '../you/surface';
import { youGetPaidRoute } from './youTickets';
import { P3_PATHS } from './paths';

// The You hub and the R1 screens it pushes: lazy, as in OrganiserRoutes. Static imports here put
// every one of their chunks in AnimatedRoutes' preload list for this area, which /app/* loads first.
const YouScreen = lazyWithRetry(() => import('../you/YouScreen').then((m) => ({ default: m.YouScreen })));
// One event's page and All dates load on their own too, as W3a's edit screens do (PR #1082).
const EventPage = lazyWithRetry(() => import('../screens/EventPage').then((m) => ({ default: m.EventPage })));
const AllDatesScreen = lazyWithRetry(() => import('../screens/AllDatesScreen').then((m) => ({ default: m.AllDatesScreen })));
const TeamPage = lazyWithRetry(() => import('../../team'));
const TeamFlow = lazyWithRetry(() => import('../../team/TeamFlow'));
const HandoverFlow = lazyWithRetry(() => import('../../flows/handover'));
const SwitchPage = lazyWithRetry(() => import('../../switch'));
const WelcomePage = lazyWithRetry(() => import('../../switch/Welcome'));
const PageScreen = lazyWithRetry(() => import('../../page'));
const Done = lazyWithRetry(() => import('../../flows/Done'));
// W3a's edit screens load on their own (PR #1082 r1 #8): their shared modules stay out of the list of
// chunks the app's route table names for the P3 area, which /app's first load carries.
const DetailsScreen = lazyWithRetry(() => import('../screens/DetailsScreen').then((m) => ({ default: m.DetailsScreen })));
const PricesScreen = lazyWithRetry(() => import('../screens/PricesScreen').then((m) => ({ default: m.PricesScreen })));

/**
 * The P3 organiser area (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserP3 and flags.organiserSelfServe are on). W1: Home, Events and Stats read screens; W2a: one event's page and its Status sheet; W2b: its date sheets and All dates; W4a: the You hub and the screens it pushes (Team, Switch page, Organiser page, Welcome), the R1 screens in P3's frame.
 */
export default function P3Routes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <Routes>
        <Route element={<P3Shell />}>
          <Route index element={<HomeScreen />} />
          <Route path="events" element={<EventsScreen />} />
          <Route path="events/:seriesId" element={<Suspense fallback={null}><EventPage /></Suspense>} />
          <Route path="events/:seriesId/dates" element={<Suspense fallback={null}><AllDatesScreen /></Suspense>} />
          <Route path="events/:seriesId/details" element={<Suspense fallback={null}><DetailsScreen /></Suspense>} />
          <Route path="events/:seriesId/prices" element={<Suspense fallback={null}><PricesScreen /></Suspense>} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="you" element={<P3YouSurface />}>
            <Route index element={<YouScreen />} />
            <Route path="switch" element={<SwitchPage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="page" element={<PageScreen />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="team/add" element={<TeamFlow step="add" />} />
            <Route path="team/:userId" element={<TeamFlow step="person" />} />
            <Route path="handover" element={<HandoverFlow step="to" />} />
            <Route path="handover/:userId" element={<HandoverFlow step="confirm" />} />
            <Route path="done" element={<Done />} />
          </Route>
          {youGetPaidRoute()}
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
