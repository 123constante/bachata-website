import { Suspense, type ReactNode } from 'react';
import { Link, Outlet, useLocation, type Params } from 'react-router-dom';
import { StateCard } from '../screens/parts';
import type { OrganiserShellProps } from '../../shell/OrganiserShell';
import { ORG_PATHS } from '../../shell/paths';
import { OrgSurfaceProvider, type OrgSurface } from '../../shell/surface';
import { P3_PATHS } from '../shell/paths';
import { P3RouteBoundary, type P3RouteBack } from '../shell/P3RouteBoundary';

/**
 * The P3 frame for a screen the You hub pushes: back link and title in P3's top bar, the page in
 * P3's scrolling main (P3Shell leaves both to it, and keeps the tab bar). Same props as the R1
 * OrganiserShell, so Team, Switch, the page editor and Welcome render here unchanged.
 */
export function P3PushedShell({ title, back, topBarEnd, children, testId }: OrganiserShellProps) {
  return (
    <>
      <header className="p3-top">
        <div className="p3-top-row">
          {back && (
            <Link to={back.to} className="p3-back" data-testid="org-back">
              <span aria-hidden="true">&lsaquo;</span> {back.label ?? 'Back'}
            </Link>
          )}
          <h1>{title}</h1>
          {topBarEnd}
        </div>
      </header>
      <main className="p3-main p3-main-pushed" data-testid={testId}>{children}</main>
    </>
  );
}

const YOU = { to: P3_PATHS.you, label: 'You' };
// a pushed screen outside You (New event, an event's Organisers) keeps a way out while its chunk loads (review 1202 N4)
const EVENTS = { to: P3_PATHS.events, label: 'Events' };

/**
 * Where the shared screens' links go in P3. Team, Switch, the page editor and Welcome are P3
 * routes, and so is Done (W4a fix 1: P3's frame, its primary back to the screen the change was
 * made on, its second back to You). p3-shell-exits: so are New event (`new/*`, out to Events),
 * Account and Help (R1 More and Help, under You) and an event's Organisers. An R1 date flow
 * (change / add / cancel, Help's rows) is a sheet on P3's event page, so those go to Events.
 */
export const P3_SURFACE: OrgSurface = {
  kind: 'p3',
  Shell: P3PushedShell,
  paths: {
    ...ORG_PATHS,
    home: P3_PATHS.home,
    switch: P3_PATHS.youSwitch,
    welcome: P3_PATHS.youWelcome,
    team: P3_PATHS.youTeam,
    teamAdd: P3_PATHS.youTeamAdd,
    teamAddFor: P3_PATHS.youTeamAddFor,
    teamPerson: P3_PATHS.youTeamPerson,
    handover: P3_PATHS.youHandover,
    handoverTo: P3_PATHS.youHandoverTo,
    page: P3_PATHS.youPage,
    done: P3_PATHS.youDone,
    more: P3_PATHS.youAccount,
    help: P3_PATHS.youHelp,
    // p3-create: New event is P3's own flow (Welcome's "Add an event" too); the R1 step keys below are the bridge URLs, which redirect.
    newWhat: P3_PATHS.create,
    newWhatFor: P3_PATHS.createFor,
    // review 1 F9: R1's name step keeps its format (that kind's form in P3)
    newName: (format) => P3_PATHS.createForFormat(format),
    // a draft's R1 steps: that draft's P3 event page, where each of them is a row
    newVenue: P3_PATHS.event,
    newDate: P3_PATHS.event,
    newTime: P3_PATHS.event,
    newCover: P3_PATHS.event,
    events: P3_PATHS.events,
    event: P3_PATHS.event,
    eventDetails: P3_PATHS.eventDetails,
    // the line-up is a sheet on P3's event page
    eventProgramme: P3_PATHS.event,
    eventOrganisers: P3_PATHS.eventOrganisers,
    change: P3_PATHS.events,
    add: P3_PATHS.events,
    cancel: P3_PATHS.events,
  },
  hub: YOU,
  handoverBack: { to: P3_PATHS.youTeam, label: 'Team' },
  // W4b: P3's own Welcome / Add a page, not R1 Home's add sheet.
  addPage: P3_PATHS.youAdd,
  doneBack: P3_PATHS.youTeam,
  pageDoneBack: P3_PATHS.youPage,
  createHub: EVENTS,
  moreTitle: 'Account',
};

/** Layout route: every screen under /you reads its links and frame from P3_SURFACE. */
export function P3YouSurface() {
  // the You hub itself sits in P3Shell's top bar and main (a tab); the screens it pushes draw their own
  const { pathname } = useLocation();
  return (
    <OrgSurfaceProvider value={P3_SURFACE}>
      {/* The pushed screens are lazy (P3Routes): keep P3's frame, top bar included, while one arrives. */}
      {/* p3-prefix-d D2: a pushed screen whose chunk will not load says so, with Try again and back to You. */}
      <P3RouteBoundary frame={pathname === P3_PATHS.you || pathname === `${P3_PATHS.you}/` ? 'tab' : 'pushed'} back={() => YOU}>
        <Suspense fallback={<P3PushedShell title="" back={YOU} testId="p3-you-route-loading"><StateCard title="Loading&hellip;" testId="p3-you-route-loading-card">This takes a second.</StateCard></P3PushedShell>}>
          <Outlet />
        </Suspense>
      </P3RouteBoundary>
    </OrgSurfaceProvider>
  );
}

/** One R1 screen outside /you in P3's frame (New event, an event's Organisers): P3_SURFACE, a boundary, a loading frame. */
export function P3PushedSurface({ back, children }: { back: (p: Readonly<Params>) => P3RouteBack; children: ReactNode }) {
  return (
    <OrgSurfaceProvider value={P3_SURFACE}>
      <P3RouteBoundary frame="pushed" back={back}>
        <Suspense fallback={<P3PushedShell title="" back={EVENTS} testId="p3-pushed-route-loading"><StateCard title="Loading&hellip;" testId="p3-pushed-route-loading-card">This takes a second.</StateCard></P3PushedShell>}>
          {children}
        </Suspense>
      </P3RouteBoundary>
    </OrgSurfaceProvider>
  );
}
