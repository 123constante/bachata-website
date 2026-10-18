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

export type DancerRouteId = 'welcome' | 'home' | 'nights' | 'me' | 'edit' | 'photo' | 'page' | 'options';

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
];

export const DANCER_HOME = '/app/home';
export const DANCER_WELCOME = '/app/welcome';

/** Every URL the dancer app answers: the bare base (a redirect to Home) plus each route. */
export const DANCER_APP_PATHS: readonly string[] = [DANCER_APP_BASE, ...DANCER_ROUTES.map((r) => r.path)];

export type DancerTab = { id: 'home' | 'nights' | 'me' | 'options'; label: string; path: string };

/** The bottom tabs, left to right (mockups v8). */
export const DANCER_TABS: readonly DancerTab[] = [
  { id: 'home', label: 'Home', path: '/app/home' },
  { id: 'nights', label: 'Nights', path: '/app/nights' },
  { id: 'me', label: 'Me', path: '/app/me' },
  { id: 'options', label: 'Options', path: '/app/options' },
];

/** True on /app and everything under it. Case-folded, as the router matches. */
export const isDancerAppPath = (pathname: string): boolean => {
  const p = pathname.toLowerCase();
  return p === DANCER_APP_BASE || p.startsWith(`${DANCER_APP_BASE}/`);
};

/** The tab a path belongs to: /app/me/edit and /app/me/photo are under Me; /app/welcome is under none. */
export const activeTabFor = (pathname: string): DancerTab['id'] | null => {
  const p = pathname.toLowerCase().replace(/\/+$/, '');
  for (const tab of DANCER_TABS) {
    if (p === tab.path || p.startsWith(`${tab.path}/`)) return tab.id;
  }
  return null;
};
