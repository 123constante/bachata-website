import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { AllDatesScreen } from '../screens/AllDatesScreen';
import { EventPage } from '../screens/EventPage';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { youRoutes } from './youTickets';
import { P3_PATHS } from './paths';

/**
 * The P3 organiser area (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserP3 and flags.organiserSelfServe are on). W1: Home, Events and Stats read screens; W2a: one event's page and its Status sheet; W2b: its date sheets and All dates; You is still a placeholder.
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
          {youRoutes()}
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
