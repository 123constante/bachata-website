import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { StateCard } from '../screens/parts';
import type { OrganiserShellProps } from '../../shell/OrganiserShell';
import { ORG_PATHS } from '../../shell/paths';
import { OrgSurfaceProvider, type OrgSurface } from '../../shell/surface';
import { P3_PATHS } from '../shell/paths';

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

/**
 * Where the shared screens' links go in P3. Team, Switch, the page editor and Welcome are P3
 * routes, and so is Done (W4a fix 1: P3's frame, its primary back to the screen the change was
 * made on, its second back to You); More (Account and help), the profile wizard and Add an event
 * stay R1 screens, which come back here.
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
  },
  hub: YOU,
  handoverBack: { to: P3_PATHS.youTeam, label: 'Team' },
  // W4b: P3's own Welcome / Add a page, not R1 Home's add sheet.
  addPage: P3_PATHS.youAdd,
  doneBack: P3_PATHS.youTeam,
  pageDoneBack: P3_PATHS.youPage,
};

/** Layout route: every screen under /you reads its links and frame from P3_SURFACE. */
export function P3YouSurface() {
  return (
    <OrgSurfaceProvider value={P3_SURFACE}>
      {/* The pushed screens are lazy (P3Routes): keep P3's frame, top bar included, while one arrives. */}
      <Suspense fallback={<P3PushedShell title="" back={YOU} testId="p3-you-route-loading"><StateCard title="Loading&hellip;" testId="p3-you-route-loading-card">This takes a second.</StateCard></P3PushedShell>}>
        <Outlet />
      </Suspense>
    </OrgSurfaceProvider>
  );
}
