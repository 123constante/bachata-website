import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { P3Shell } from './P3Shell';
import { AllDatesScreen } from '../screens/AllDatesScreen';

import { EventPage } from '../screens/EventPage';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { P3Placeholder } from './placeholders';
import { P3_PATHS } from './paths';

// W3a's edit screens load on their own (PR #1082 r1 #8): their shared modules stay out of the list of
// chunks the app's route table names for the P3 area, which /app's first load carries.
const DetailsScreen = lazyWithRetry(() => import('../screens/DetailsScreen').then((m) => ({ default: m.DetailsScreen })));
const PricesScreen = lazyWithRetry(() => import('../screens/PricesScreen').then((m) => ({ default: m.PricesScreen })));
const HistoryScreen = lazyWithRetry(() => import('../screens/HistoryScreen').then((m) => ({ default: m.HistoryScreen })));

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
          <Route path="events/:seriesId/details" element={<Suspense fallback={null}><DetailsScreen /></Suspense>} />
          <Route path="events/:seriesId/prices" element={<Suspense fallback={null}><PricesScreen /></Suspense>} />
          <Route path="events/:seriesId/history" element={<Suspense fallback={null}><HistoryScreen /></Suspense>} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="you" element={<P3Placeholder tab="you" />} />
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
