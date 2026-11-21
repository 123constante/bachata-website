/**
 * The dancer app's route table: ONE list, read by DancerAppRoutes (the router),
 * DancerAppShell (the active tab) and tests/catchallClientPaths.test.ts (every
 * path below must be in src/components/catchallClientPaths.ts, or the server
 * answers it with a 404). Import-free on purpose.
 *
 * Pinned by briefs/dancer-rebuild-INTERFACE.md section 5. Wave 2 replaces the
 * placeholder screens; it does not add or rename routes here (B1b adds
 * /app/page, B2 adds /app/options/*).
 */

export const DANCER_APP_BASE = '/app';

export type DancerRouteId = 'welcome' | 'home' | 'nights' | 'me' | 'edit' | 'photo' | 'page' | 'options' | 'tickets';

export type DancerRoute = {
  id: DancerRouteId;
  /** Absolute path, as the browser shows it. */
  path: string;
  /** What the placeholder screen (and the document title) calls it. */
  title: string;
};

export const DANCER_ROUTES: readonly DancerRoute[] = [
  { id: 'welcome', path: '/app/welcome', title: 'Welcome' },
  { id: 'home', path: '/app/home', title: 'Home' },
  { id: 'nights', path: '/app/nights', title: 'Nights' },
  { id: 'me', path: '/app/me', title: 'Me' },
  { id: 'edit', path: '/app/me/edit', title: 'Edit profile' },
  { id: 'photo', path: '/app/me/photo', title: 'Photo' },
  { id: 'page', path: '/app/page', title: 'My page' },
  { id: 'options', path: '/app/options', title: 'Options' },
  // Option A (brief option-a-tickets-tab): the buyer's door QRs. Shown as a tab only while
  // flags.publicTicketing is on; the screen itself sends a flag-off visit to Home.
  { id: 'tickets', path: '/app/tickets', title: 'Tickets' },
];

export const DANCER_HOME = '/app/home';
export const DANCER_WELCOME = '/app/welcome';
export const DANCER_TICKETS = '/app/tickets';

/** Every URL the dancer app answers: the bare base (a redirect to Home) plus each route. */
export const DANCER_APP_PATHS: readonly string[] = [DANCER_APP_BASE, ...DANCER_ROUTES.map((r) => r.path)];

export type DancerTab = { id: 'tickets' | 'home' | 'nights' | 'me' | 'options'; label: string; path: string };

/** The bottom tabs, left to right (mockups v8). */
export const DANCER_TABS: readonly DancerTab[] = [
  { id: 'home', label: 'Home', path: '/app/home' },
  { id: 'nights', label: 'Nights', path: '/app/nights' },
  { id: 'me', label: 'Me', path: '/app/me' },
  { id: 'options', label: 'Options', path: '/app/options' },
];

/** The Tickets tab: FIRST, and only while flags.publicTicketing is on (the shell passes the flag in). */
export const TICKETS_TAB: DancerTab = { id: 'tickets', label: 'Tickets', path: DANCER_TICKETS };

/** Layout C (DANCER_LAYOUT_C_ENABLED, brief dancer-layout-c-s2): Home, Nights, Me only. No Options, no Tickets tab. */
export const LAYOUT_C_TABS: readonly DancerTab[] = DANCER_TABS.filter((t) => t.id !== 'options');

/**
 * The tabs the shell draws: the four, with Tickets in front while ticketing is on. Layout C
 * (the shell passes the flag in; this file stays import-free) = always the three.
 */
export const shellTabs = (ticketsOn: boolean, layoutC = false, keepTickets = false): readonly DancerTab[] =>
  layoutC ? (keepTickets ? [TICKETS_TAB, ...LAYOUT_C_TABS] : LAYOUT_C_TABS) : ticketsOn ? [TICKETS_TAB, ...DANCER_TABS] : DANCER_TABS;

/**
 * Layout C: the two route ids that are no longer tabs still answer (old links, the catch-all
 * path list), each by sending the visit on: Options -> Me (its rows moved there), Tickets ->
 * Home (the ticket card moved there, slice S1). The query string is kept (checkout ?o=).
 */
export const LAYOUT_C_REDIRECTS: Partial<Record<DancerRouteId, string>> = { options: '/app/me', tickets: DANCER_HOME };

/** True on /app and everything under it. Case-folded, as the router matches. */
export const isDancerAppPath = (pathname: string): boolean => {
  const p = pathname.toLowerCase();
  return p === DANCER_APP_BASE || p.startsWith(`${DANCER_APP_BASE}/`);
};

/** The tab a path belongs to: /app/me/edit and /app/me/photo are under Me; /app/welcome is under none. */
export const activeTabFor = (pathname: string): DancerTab['id'] | null => {
  const p = pathname.toLowerCase().replace(/\/+$/, '');
  for (const tab of [TICKETS_TAB, ...DANCER_TABS]) {
    if (p === tab.path || p.startsWith(`${tab.path}/`)) return tab.id;
  }
  return null;
};
