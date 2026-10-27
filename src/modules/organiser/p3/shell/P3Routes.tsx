import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { AllDatesScreen } from '../screens/AllDatesScreen';
import { EventPage } from '../screens/EventPage';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { P3YouSurface } from '../you/surface';
import { YouScreen } from '../you/YouScreen';
import { P3_PATHS } from './paths';

// The R1 screens the You hub pushes: lazy, as in OrganiserRoutes. Static imports here put every
// one of their chunks in AnimatedRoutes' preload list for this area, which /app/* loads first.
const TeamPage = lazyWithRetry(() => import('../../team'));
const TeamFlow = lazyWithRetry(() => import('../../team/TeamFlow'));
const HandoverFlow = lazyWithRetry(() => import('../../flows/handover'));
const SwitchPage = lazyWithRetry(() => import('../../switch'));
const WelcomePage = lazyWithRetry(() => import('../../switch/Welcome'));
const PageScreen = lazyWithRetry(() => import('../../page'));
const Done = lazyWithRetry(() => import('../../flows/Done'));

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
          <Route path="events/:seriesId" element={<EventPage />} />
          <Route path="events/:seriesId/dates" element={<AllDatesScreen />} />
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
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
