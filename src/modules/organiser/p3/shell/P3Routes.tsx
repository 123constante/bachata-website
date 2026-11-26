import { Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams, type Params } from 'react-router-dom';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { flags } from '@/lib/featureFlags';
import { P3PushedSurface, P3YouSurface } from '../you/surface';
import { youGetPaidRoute } from './youTickets';
import { P3_PATHS } from './paths';
import { P3RouteBoundary, type P3RouteBack, type P3RouteFrame } from './P3RouteBoundary';

// Organiser Round 4 is the only organiser UI: white + orange shell and screens, lazy so none lands in the app's first load.
const R4Shell = lazyWithRetry(() => import('../r4/R4Shell').then((m) => ({ default: m.R4Shell })));
const R4Home = lazyWithRetry(() => import('../r4/R4Home').then((m) => ({ default: m.R4Home })));
const R4Events = lazyWithRetry(() => import('../r4/R4Events').then((m) => ({ default: m.R4Events })));
const R4Night = lazyWithRetry(() => import('../r4/R4Night').then((m) => ({ default: m.R4Night })));
const R4EditNight = lazyWithRetry(() => import('../r4/R4EditNight').then((m) => ({ default: m.R4EditNight })));
const R4Raffle = lazyWithRetry(() => import('../r4/R4Raffle').then((m) => ({ default: m.R4Raffle })));
const R4Tickets = lazyWithRetry(() => import('../r4/R4Tickets').then((m) => ({ default: m.R4Tickets })));
const R4Team = lazyWithRetry(() => import('../r4/R4Team').then((m) => ({ default: m.R4Team })));
const R4Compare = lazyWithRetry(() => import('../r4/R4Compare').then((m) => ({ default: m.R4Compare })));
const R4DoorInvite = lazyWithRetry(() => import('../r4/R4DoorInvite').then((m) => ({ default: m.R4DoorInvite })));
// Editor v2 S1 (flag organiserEditorV2): the gate and the night screen load on their own, never on first load.
const R4EditorGate = lazyWithRetry(() => import('../v2/EditorGate').then((m) => ({ default: m.R4EditorGate })));
const TicketsV2 = lazyWithRetry(() => import('../v2/TicketsV2').then((m) => ({ default: m.TicketsV2 })));
const inSuspense = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

// The You hub and the R1 screens it pushes: lazy, as in OrganiserRoutes. Static imports here put
// every one of their chunks in AnimatedRoutes' preload list for this area, which /app/* loads first.
const YouScreen = lazyWithRetry(() => import('../you/YouScreen').then((m) => ({ default: m.YouScreen })));
// One event's page and All dates load on their own too, as W3a's edit screens do (PR #1082).
const EventPage = lazyWithRetry(() => import('../screens/EventPage').then((m) => ({ default: m.EventPage })));
const AllDatesScreen = lazyWithRetry(() => import('../screens/AllDatesScreen').then((m) => ({ default: m.AllDatesScreen })));
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
const toHome = () => ({ to: P3_PATHS.home, label: 'Home' });
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
/** Editor v2: the old edit and night URLs become the one editor page (the night id rides in ?night=). */
export function ToEditor() {
  const { seriesId, occurrenceId } = useParams();
  const [params] = useSearchParams();
  const keepOpen = flags.organiserHomeClassesWeek && !!occurrenceId && params.get('open') === 'when';
  const q = occurrenceId ? `?night=${encodeURIComponent(occurrenceId)}${keepOpen ? '&open=when' : ''}` : '';
  return <Navigate to={`${P3_PATHS.event(seriesId ?? '')}${q}`} replace />;
}
function lazyScreen(el: ReactNode, frame: P3RouteFrame, back: (p: Readonly<Params>) => P3RouteBack) {
  return <P3RouteBoundary frame={frame} back={back}><Suspense fallback={null}>{el}</Suspense></P3RouteBoundary>;
}

/**
 * The P3 organiser area (lazy chunk, mounted by AnimatedRoutes ONLY while
 * flags.organiserP3 and flags.organiserSelfServe are on). W1: Home, Events and Stats read screens; W2a: one event's page and its Status sheet; W2b: its date sheets and All dates; W4a: the You hub and the screens it pushes (Team, Switch page, Organiser page, Welcome), the R1 screens in P3's frame.
 */
function P3Shell() {
  return inSuspense(<R4Shell />);
}

export default function P3Routes() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <Routes>
        <Route path="you/details" element={lazyScreen(<PersonFlow />, 'own', toYou)} />
        <Route path="start" element={lazyScreen(<OnboardingFlow />, 'own', toHome)} />
        {flags.organiserTicketing && <Route path="get-paid" element={lazyScreen(<GetPaidStart />, 'own', toHome)} />}
        {flags.organiserTicketing && <Route path="events/:seriesId/door" element={lazyScreen(<DoorScreen r4 />, 'own', toEvent)} />}
        <Route element={<P3Shell />}>
          <Route index element={inSuspense(<R4Home />)} />
          <Route path="events" element={inSuspense(<R4Events />)} />
          <Route path="tickets" element={inSuspense(<R4Tickets />)} />
          <Route path="events/:seriesId" element={flags.organiserEditorV2 ? lazyScreen(<R4EditorGate fallback={<R4Night />} />, 'tab', toEvent) : inSuspense(<R4Night />)} />
          <Route path="events/:seriesId/all" element={lazyScreen(<EventPage />, 'tab', toEvent)} />
          <Route path="events/:seriesId/edit" element={flags.organiserEditorV2 ? <ToEditor /> : lazyScreen(<R4EditNight />, 'tab', toEvent)} />
          {flags.organiserEditorV2 && <Route path="events/:seriesId/tickets" element={lazyScreen(<TicketsV2 />, 'tab', toEvent)} />}
          {flags.organiserEditorV2 && <Route path="events/:seriesId/night/:occurrenceId" element={<ToEditor />} />}
          <Route path="events/:seriesId/raffle" element={lazyScreen(<R4Raffle />, 'tab', toEvent)} />
          <Route path="events/:seriesId/dates" element={lazyScreen(<AllDatesScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/details" element={lazyScreen(<DetailsScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/prices" element={lazyScreen(<PricesScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/history" element={lazyScreen(<HistoryScreen />, 'tab', toEvent)} />
          <Route path="events/:seriesId/organisers" element={<P3PushedSurface back={toEvent}><SeriesOrganisers /></P3PushedSurface>} />
          <Route path="create" element={<P3PushedSurface back={toEvents}><CreateFlow /></P3PushedSurface>} />
          {NEW_STEPS.map((step) => <Route key={step} path={step} element={<OldNewStep />} />)}
          {flags.organiserDash && <Route path="compare" element={inSuspense(<R4Compare />)} />}
          {flags.organiserDash && <Route path="events/:seriesId/in" element={<P3PushedSurface back={toEvent}><WhoIsInRoute home={toHome()} /></P3PushedSurface>} />}
          {flags.organiserDash && <Route path="events/:seriesId/came/:occurrenceId" element={<P3PushedSurface back={toEvent}><WhoCameRoute home={toHome()} /></P3PushedSurface>} />}
          <Route path="you" element={<P3YouSurface />}>
            <Route index element={<YouScreen />} />
            <Route path="switch" element={<SwitchPage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="page" element={<PageScreen />} />
            <Route path="team" element={inSuspense(<R4Team />)} />
            <Route path="team/door-invite" element={inSuspense(<R4DoorInvite />)} />
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
          <Route path="*" element={<Navigate to={P3_PATHS.home} replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
}
