import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { AllDatesScreen } from '../screens/AllDatesScreen';
import { EventPage } from '../screens/EventPage';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import TeamPage from '../../team';
import TeamFlow from '../../team/TeamFlow';
import HandoverFlow from '../../flows/handover';
import SwitchPage from '../../switch';
import WelcomePage from '../../switch/Welcome';
import PageScreen from '../../page';
import { P3YouSurface } from '../you/surface';
import { YouScreen } from '../you/YouScreen';
import { P3_PATHS } from './paths';

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
          </Route>
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
