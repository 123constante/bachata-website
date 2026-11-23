import { Suspense, type ComponentType } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useDancerAnalyticsIdentity } from '../analytics/events';
import { DancerAreaGate } from '../gate/DancerAreaGate';
import { useViewOnly } from '../gate/viewOnly';
import { DancerAppShell } from './DancerAppShell';
import { DANCER_HOME, DANCER_ROUTES, DANCER_TICKETS, LAYOUT_C_REDIRECTS, type DancerRouteId } from './routes';
import { DANCER_LAYOUT_C_ENABLED } from '../screens/home/layoutCFlag';
import { useMyDancerEdit } from '../api/useMyDancerEdit';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import HomeScreen from '../screens/home/HomeScreen';
import NightsScreen from '../screens/nights/NightsScreen';
import MeScreen, { MeSettings, type MeSettingsGhost } from '../screens/me/MeScreen';
import EditScreen from '../screens/edit/EditScreen';
import PhotoScreen from '../screens/photo/PhotoScreen';
import PageScreen from '../screens/page/PageScreen';
import SignOutControl from '../screens/options/SignOutControl';
import OptionsScreen from '../screens/options/OptionsScreen';
// Lazy (with the teaser twins below): the tickets modules they share then sit in their own chunk, off the /app first load.
const PartyChatRoute = lazyWithRetry(() => import('../screens/partychat/PartyChatScreen').then((m) => ({ default: m.PartyChatRoute })));
const TicketsScreen = lazyWithRetry(() => import('../screens/tickets/TicketsScreen'));

const TeaserHome = lazyWithRetry(() => import('../screens/teaser/TeaserScreens').then((m) => ({ default: m.TeaserHome })));
const TeaserNights = lazyWithRetry(() => import('../screens/teaser/TeaserScreens').then((m) => ({ default: m.TeaserNights })));
const TeaserMe = lazyWithRetry(() => import('../screens/teaser/TeaserScreens').then((m) => ({ default: m.TeaserMe })));
const TeaserOptionsLazy = lazyWithRetry(() => import('../screens/teaser/TeaserScreens').then((m) => ({ default: m.TeaserOptions })));
const TeaserOptions = () => <TeaserOptionsLazy signOut={<SignOutControl testId="teaser-sign-out" />} />;
const TeaserMeLazy = lazyWithRetry(() => import('../screens/teaser/TeaserScreens').then((m) => ({ default: m.TeaserMe })));
/**
 * Layout C preview Me: the live Settings section (built here, in the dancer-app chunk, and passed in
 * like the Sign out control: the teaser chunk must not import it) and, last, the quiet Sign out row.
 */
const TeaserMeSettings = ({ ghost }: { ghost: MeSettingsGhost }) => {
  const q = useMyDancerEdit();
  return <MeSettings otherRoles={q.data?.other_roles ?? []} ghost={ghost} />;
};
const TeaserHomeC = () => <TeaserHome layoutC />;
const TeaserMeC = () => (
  <TeaserMeLazy layoutC settings={(ghost) => <TeaserMeSettings ghost={ghost} />} signOut={<SignOutControl testId="teaser-sign-out" />} />
);
import { useTeaserState } from '../screens/teaser/teaserGate';

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

/** The read-only twins the post-pay teaser shows in place of these four screens (TICKET_TEASER_ENABLED). */
const TEASER_SCREENS: Partial<Record<DancerRouteId, ComponentType>> = DANCER_LAYOUT_C_ENABLED
  ? { home: TeaserHomeC, nights: TeaserNights, me: TeaserMeC }
  : { home: TeaserHome, nights: TeaserNights, me: TeaserMe, options: TeaserOptions };

/**
 * The real screen, or its read-only twin for an allowed person with an unfinished profile and the teaser
 * flag on (the shell decides: teaserGate teaserState). While that read is out, a tab with a twin draws
 * nothing, so the real screen never flashes first. Flag off = always the real one.
 */
const ScreenOrTeaser = ({ id, Screen }: { id: DancerRouteId; Screen: ComponentType }) => {
  const teaser = useTeaserState();
  const viewOnly = useViewOnly();
  const Twin = TEASER_SCREENS[id];
  const { search } = useLocation();
  // Layout C: Options and Tickets are not tabs; their URLs send the visit on (query kept), before any twin.
  // A view-only buyer stays on /app/tickets: it is the only /app screen the gate lets them see
  // (Home would bounce them to /account), so their door QRs never disappear.
  const to = DANCER_LAYOUT_C_ENABLED && !(viewOnly && id === 'tickets') ? LAYOUT_C_REDIRECTS[id] : undefined;
  if (to) return <Navigate to={`${to}${search}`} replace />;
  if (Twin && teaser === 'pending') return null;
  // Checkout return (buyer onboarding ON) lands on Home with ?o=. Only the teaser Home draws the
  // order card; anyone else goes on to the Tickets tab, which does, with ?o= (and free=1) kept.
  // Layout C has no Tickets tab (it redirects back here), so no hop: Home carries the ticket card (S1).
  if (id === 'home' && (!DANCER_LAYOUT_C_ENABLED || viewOnly) && BUYER_ONBOARDING_ENABLED && teaser !== 'on' && new URLSearchParams(search).has('o')) {
    return <Navigate to={`${DANCER_TICKETS}${search}`} replace />;
  }
  const Shown = Twin && teaser === 'on' ? Twin : Screen;
  return <Suspense fallback={null}><Shown /></Suspense>;
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
            <Route path="party-chat/:chatId" element={<Suspense fallback={null}><PartyChatRoute /></Suspense>} />
            <Route path="*" element={<Navigate to={DANCER_HOME} replace />} />
          </Route>
        </Routes>
      </DancerAreaGate>
    </AuthGuard>
  );
};

export default DancerAppRoutes;
