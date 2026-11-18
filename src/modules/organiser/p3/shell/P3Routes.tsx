import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams, type Params } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { flags } from '@/lib/featureFlags';
import { P3Shell as P3ShellV1 } from './P3Shell';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { CompareNights } from '../dash/CompareNights';
import { P3PushedSurface, P3YouSurface } from '../you/surface';
import { youGetPaidRoute } from './youTickets';
import { P3_PATHS } from './paths';
import { P3RouteBoundary, type P3RouteBack, type P3RouteFrame } from './P3RouteBoundary';

/** Organiser shell V2 (brief organiser-v1-shell): on only with organiserShellV2 AND organiserP3 AND organiserDash. OFF = the P3 shell exactly as before. */
export const shellV2On = (f: Pick<typeof flags, 'organiserShellV2' | 'organiserP3' | 'organiserDash'>): boolean => f.organiserShellV2 && f.organiserP3 && f.organiserDash;
/**
 * The live check. It reads each flag by name and never passes `flags` itself: handing the whole object
 * to a function makes rollup stop constant-folding EVERY flag in the bundle, so flag-gated dead code
 * comes back on every route (bundle-budget red on #1731: /event/:id +1 file, +3.2 KB gz).
 */
const v2Live = (): boolean => shellV2On({ organiserShellV2: flags.organiserShellV2, organiserP3: flags.organiserP3, organiserDash: flags.organiserDash });

// Organiser shell V2 (behind organiserShellV2): lazy, so neither it nor its tabs land in the app's first load.
const V2Shell = lazyWithRetry(() => import('../v2/V2Shell').then((m) => ({ default: m.V2Shell })));
const V2EventsTab = lazyWithRetry(() => import('../v2/V2Tabs').then((m) => ({ default: m.V2EventsTab })));
const V2Home = lazyWithRetry(() => import('../v2/V2Tabs').then((m) => ({ default: m.V2Home })));
const V2GuestsTab = lazyWithRetry(() => import('../v2/V2Tabs').then((m) => ({ default: m.V2GuestsTab })));
const V2RaffleTab = lazyWithRetry(() => import('../v2/V2Tabs').then((m) => ({ default: m.V2RaffleTab })));
const V2TicketsTab = lazyWithRetry(() => import('../v2/V2Tabs').then((m) => ({ default: m.V2TicketsTab })));
// Organiser Round 4 (flag organiserR4, brief organiser-round4-restyle): white + orange shell and Home. Needs organiserP3 and
// organiserDash; wins over V2 when both are on. Lazy, like V2. OFF = exactly as before.
const r4Live = (): boolean => flags.organiserR4 && flags.organiserP3 && flags.organiserDash;
const R4Shell = lazyWithRetry(() => import('../r4/R4Shell').then((m) => ({ default: m.R4Shell })));
const R4Home = lazyWithRetry(() => import('../r4/R4Home').then((m) => ({ default: m.R4Home })));
const inSuspense = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

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
const AddPageScreen = lazyWithRetry(() => import('../you/AddPageScreen'));
// p3-create slice 1: P3's own New event (kind, page, form), lazy so none of it lands on /app's first load.
const CreateFlow = lazyWithRetry(() => import('../new/CreateFlow'));
// p3-shell-exits: More (Account), Help and an event's Organisers, in P3's frame.
const MorePage = lazyWithRetry(() => import('../../more'));
const HelpPage = lazyWithRetry(() => import('../../more/help'));
const SeriesOrganisers = lazyWithRetry(() => import('../../events/SeriesOrganisers'));
// W4b build 2: the onboarding person screens draw their own full-screen shell (no tab bar), lazy like the rest.
const PersonFlow = lazyWithRetry(() => import('../onboarding/PersonFlow'));
const OnboardingFlow = lazyWithRetry(() => import('../onboarding/OnboardingFlow'));
// W3a's edit screens load on their own (PR #1082 r1 #8): their shared modules stay out of the list of
// chunks the app's route table names for the P3 area, which /app's first load carries.
const DetailsScreen = lazyWithRetry(() => import('../screens/DetailsScreen').then((m) => ({ default: m.DetailsScreen })));
const PricesScreen = lazyWithRetry(() => import('../screens/PricesScreen').then((m) => ({ default: m.PricesScreen })));
const HistoryScreen = lazyWithRetry(() => import('../screens/HistoryScreen').then((m) => ({ default: m.HistoryScreen })));
// Slice 3 (organiserDash): the read-only Who is in / Who came sheets, pushed (no tab bar).
const WhoIsInRoute = lazyWithRetry(() => import('../sheets/WhoSheets').then((m) => ({ default: m.WhoIsInRoute })));
const WhoCameRoute = lazyWithRetry(() => import('../sheets/WhoSheets').then((m) => ({ default: m.WhoCameRoute })));
// The door scanner (ticketing) loads on its own; its QR reader fallback (jsQR) loads only from inside it.
const GetPaidStart = lazyWithRetry(() => import('../tickets/GetPaid').then((m) => ({ default: m.GetPaidStart })));
const DoorScreen = lazyWithRetry(() => import('../door/DoorScreen').then((m) => ({ default: m.DoorScreen })));

// p3-prefix-d D2: every lazy screen sits in a boundary, so a chunk that will not load shows a
// message, Try again and a way back instead of a blank screen. `back` is where that link goes.
const toEvent = (p: Readonly<Params>) => ({ to: P3_PATHS.event(p.seriesId ?? ''), label: 'Event' });
const toEvents = () => ({ to: P3_PATHS.events, label: 'Events' });
const toYou = () => ({ to: P3_PATHS.you, label: 'You' });
// With the V2 shell on there is no Home tab: the way back is Events (flag off: Home, as before).
const toHome = () => (v2Live() ? { to: P3_PATHS.events, label: 'Events' } : { to: P3_PATHS.home, label: 'Home' });
/**
 * The interim bridge's URLs (#1202: R1's New event steps in P3's frame). They redirect now: the
 * first two to P3's New event (the page kept), any step of a draft to that draft's event page
 * (review r1 F6: `new/:seriesId/*`, not only the four R1 steps, so none falls to Home).
 */
export const NEW_STEPS = ['new/what', 'new/name', 'new/:seriesId/*'] as const;

function OldNewStep() {
  const { seriesId } = useParams();
  const [params] = useSearchParams();
  // review 1 F9 / F10: the format and the page ride along (a named page is not asked again)
  return <Navigate to={seriesId ? P3_PATHS.event(seriesId) : P3_PATHS.createForFormat(params.get('format'), params.get('o'))} replace />;
}
function lazyScreen(el: ReactNode, frame: P3RouteFrame, back: (p: Readonly<Params>) => P3RouteBack) {
  return <P3RouteBoundary frame={frame} back={back}><Suspense fallback={null}>{el}</Suspense></P3RouteBoundary>;
}

/**
 * The P3 organiser area (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserP3 and flags.organiserSelfServe are on). W1: Home, Events and Stats read screens; W2a: one event's page and its Status sheet; W2b: its date sheets and All dates; W4a: the You hub and the screens it pushes (Team, Switch page, Organiser page, Welcome), the R1 screens in P3's frame.
 */
/** The area's frame: the V2 shell behind organiserShellV2, else the P3 shell exactly as before. */
function P3Shell() {
  if (r4Live()) return inSuspense(<R4Shell />);
  return v2Live() ? inSuspense(<V2Shell />) : <P3ShellV1 />;
}

export default function P3Routes() {
  useNoindexMeta(true);
  const r4 = r4Live();
  const v2 = !r4 && v2Live();
  return (
    <AuthGuard>
      <Routes>
        <Route path="you/details" element={lazyScreen(<PersonFlow />, 'own', toYou)} />
        <Route path="start" element={lazyScreen(<OnboardingFlow />, 'own', toHome)} />
        {flags.organiserTicketing && <Route path="get-paid" element={lazyScreen(<GetPaidStart />, 'own', toHome)} />}
        {flags.organiserTicketing && <Route path="events/:seriesId/door" element={lazyScreen(<DoorScreen />, 'own', toEvent)} />}
        <Route element={<P3Shell />}>
          <Route index element={r4 ? inSuspense(<R4Home />) : v2 ? inSuspense(<V2Home />) : <HomeScreen />} />
          <Route path="events" element={v2 ? inSuspense(<V2EventsTab />) : <EventsScreen />} />
          {(v2 || r4) && <Route path="tickets" element={inSuspense(<V2TicketsTab />)} />}
          {v2 && <Route path="guests" element={inSuspense(<V2GuestsTab />)} />}
          {v2 && <Route path="raffle" element={inSuspense(<V2RaffleTab />)} />}
          <Route path="events/:seriesId" element={lazyScreen(<EventPage />, 'tab', toEvents)} />
          <Route path="events/:seriesId/dates" element={lazyScreen(<AllDatesScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/details" element={lazyScreen(<DetailsScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/prices" element={lazyScreen(<PricesScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/history" element={lazyScreen(<HistoryScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/organisers" element={<P3PushedSurface back={toEvent}><SeriesOrganisers /></P3PushedSurface>} />
          <Route path="create" element={<P3PushedSurface back={toEvents}><CreateFlow /></P3PushedSurface>} />
          {NEW_STEPS.map((step) => <Route key={step} path={step} element={<OldNewStep />} />)}
          <Route path="stats" element={<StatsScreen />} />
          {flags.organiserDash && <Route path="compare" element={<P3PushedSurface back={toHome}><CompareNights /></P3PushedSurface>} />}
          {flags.organiserDash && <Route path="events/:seriesId/in" element={<P3PushedSurface back={toEvent}><WhoIsInRoute home={toHome()} /></P3PushedSurface>} />}
          {flags.organiserDash && <Route path="events/:seriesId/came/:occurrenceId" element={<P3PushedSurface back={toEvent}><WhoCameRoute home={toHome()} /></P3PushedSurface>} />}
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
            <Route path="add" element={<AddPageScreen />} />
            <Route path="account" element={<MorePage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
          {youGetPaidRoute()}
          <Route path="*" element={<Navigate to={v2 ? P3_PATHS.events : P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
