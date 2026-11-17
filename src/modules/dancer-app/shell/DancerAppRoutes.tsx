import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useDancerAnalyticsIdentity } from '../analytics/events';
import { DancerAreaGate } from '../gate/DancerAreaGate';
import { DancerAppShell } from './DancerAppShell';
import { DANCER_HOME, DANCER_ROUTES, type DancerRouteId } from './routes';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import HomeScreen from '../screens/home/HomeScreen';
import NightsScreen from '../screens/nights/NightsScreen';
import MeScreen from '../screens/me/MeScreen';
import EditScreen from '../screens/edit/EditScreen';
import PhotoScreen from '../screens/photo/PhotoScreen';
import PageScreen from '../screens/page/PageScreen';
import OptionsScreen from '../screens/options/OptionsScreen';
import TicketsScreen from '../screens/tickets/TicketsScreen';
import { flags } from '@/lib/featureFlags';
import { useViewOnly } from '../gate/viewOnly';
import { TeaserHome, TeaserMe, TeaserNights, TeaserOptions } from '../screens/teaser/TeaserScreens';
import { teaserActive } from '../screens/teaser/teaserModel';

/** Route id -> screen. One entry per DANCER_ROUTES row (TypeScript refuses a missing one). */
export const DANCER_SCREENS: Record<DancerRouteId, ComponentType> = {
  welcome: OnboardingScreen,
  home: HomeScreen,
  nights: NightsScreen,
  me: MeScreen,
  edit: EditScreen,
  photo: PhotoScreen,
  page: PageScreen,
  options: OptionsScreen,
  tickets: TicketsScreen,
};

/** The read-only twins the post-pay teaser shows in place of these four screens (flags.ticketTeaser). */
const TEASER_SCREENS: Partial<Record<DancerRouteId, ComponentType>> = { home: TeaserHome, nights: TeaserNights, me: TeaserMe, options: TeaserOptions };

/** The real screen, or its read-only twin for a view-only buyer with the teaser flag on. Flag off = always the real one. */
const ScreenOrTeaser = ({ id, Screen }: { id: DancerRouteId; Screen: ComponentType }) => {
  const viewOnly = useViewOnly();
  const Twin = TEASER_SCREENS[id];
  if (Twin && teaserActive({ teaserFlag: flags.ticketTeaser, ticketingFlag: flags.publicTicketing, viewOnly })) return <Twin />;
  return <Screen />;
};

/** Signed in by now (AuthGuard): publish the person for the funnel events. */
const AnalyticsIdentity = () => {
  const { user } = useAuth();
  useDancerAnalyticsIdentity(user);
  return null;
};

/**
 * Everything under /app (mounted by AnimatedRoutes as one lazy chunk,
 * `dancer-app`). Order of the guards: AuthGuard (signed out -> today's /auth
 * with returnTo; the gate is never asked) -> DancerAreaGate (not allowed or
 * error -> /account) -> the shell. Every route is noindex.
 */
export const DancerAppRoutes = () => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AnalyticsIdentity />
      <DancerAreaGate>
        <Routes>
          <Route element={<DancerAppShell />}>
            <Route index element={<Navigate to={DANCER_HOME} replace />} />
            {DANCER_ROUTES.map((r) => {
              const Screen = DANCER_SCREENS[r.id];
              return <Route key={r.id} path={r.path.slice('/app/'.length)} element={<ScreenOrTeaser id={r.id} Screen={Screen} />} />;
            })}
            <Route path="*" element={<Navigate to={DANCER_HOME} replace />} />
          </Route>
        </Routes>
      </DancerAreaGate>
    </AuthGuard>
  );
};

export default DancerAppRoutes;
