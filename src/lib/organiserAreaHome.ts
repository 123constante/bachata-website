/**
 * Where "the organiser area" is (FLIP-READINESS F-01..F-03, owner decision 1, option (c), recorded
 * 2026-10-31): while P3 is live (organiserP3 AND organiserSelfServe, the pair AnimatedRoutes mounts
 * /account/p3/* on) every organiser door opens P3's Home; else R1's Home, exactly as before.
 * R1's own URLs (/account/o/*) redirect to the P3 screen that does the same job, except while the
 * person chose the old area with `?legacy=1` before LEGACY_UNTIL, so nobody is trapped.
 *
 * Import-free leaf: lib/accountRouting (on /app's first load) and the dancer screens read it, so it
 * must not drag featureFlags (Vite env) into Node-side importers. Paths restated; asserted equal to
 * P3_PATHS.home and ORG_PATHS.home in src/lib/__tests__/p3Landing.matrix.test.ts.
 */
export type OrganiserAreaFlags = { organiserP3: boolean; organiserSelfServe: boolean };

const P3_HOME = '/account/p3';
const R1_HOME = '/account/o';

export const p3AreaLive = (f: OrganiserAreaFlags): boolean => f.organiserP3 && f.organiserSelfServe;

/** The organiser area's Home; `?o=` picks the page (both areas read that key). */
export const organiserAreaHome = (f: OrganiserAreaFlags, organiserId?: string | null): string => {
  const base = p3AreaLive(f) ? P3_HOME : R1_HOME;
  return organiserId ? `${base}?o=${encodeURIComponent(organiserId)}` : base;
};

/** True for any path inside either organiser area (query and hash ignored). */
export const isOrganiserAreaPath = (path: string): boolean => {
  const p = path.split(/[?#]/)[0];
  return p === P3_HOME || p.startsWith(`${P3_HOME}/`) || p === R1_HOME || p.startsWith(`${R1_HOME}/`);
};

/** Last London day (exclusive) the old area is honoured with `?legacy=1`: honoured to 7 Nov 2026 inclusive. */
export const LEGACY_UNTIL = '2026-11-08';
export const LEGACY_QUERY = 'legacy';
export const LEGACY_UNTIL_LABEL = '7 November';

/** `today` = a London YYYY-MM-DD key. */
export const legacyWindowOpen = (today: string): boolean => today < LEGACY_UNTIL;

/** The dated fallback link (P3 You hub) -- null once the window has closed. */
export const legacyAreaHref = (today: string): string | null => (legacyWindowOpen(today) ? `${R1_HOME}?${LEGACY_QUERY}=1` : null);

const seg = (s: string) => encodeURIComponent(decodeURIComponent(s));

/**
 * R1 path -> the P3 path that does the same job (null = keep R1: the profile wizard, which P3's
 * profile-lock line links to, F-06). Query (`?o=` included) and hash ride along; `legacy` is dropped.
 */
export const r1ToP3Path = (pathname: string, search: string, hash: string): string | null => {
  const rest = pathname === R1_HOME ? '' : pathname.startsWith(`${R1_HOME}/`) ? pathname.slice(R1_HOME.length + 1) : null;
  if (rest === null) return null;
  const parts = rest.split('/').filter(Boolean);
  const [a, b, c] = parts;
  let to: string;
  if (a === 'complete') return null;
  if (!a) to = P3_HOME;
  else if (a === 'events' && b === 'new') to = `${P3_HOME}/create`;
  else if (a === 'events' && b) to = c === 'details' || c === 'organisers' ? `${P3_HOME}/events/${seg(b)}/${c}` : `${P3_HOME}/events/${seg(b)}`;
  else if (a === 'events') to = `${P3_HOME}/events`;
  else if ((a === 'change' || a === 'add' || a === 'cancel' || a === 'cover') && b && b !== 'pick') to = `${P3_HOME}/events/${seg(b)}`;
  else if (a === 'change' || a === 'add' || a === 'cancel') to = `${P3_HOME}/events`;
  else if (a === 'new') to = `${P3_HOME}/create`;
  else if (a === 'team' && b === 'add') to = `${P3_HOME}/you/team/add`;
  else if (a === 'team' && b) to = `${P3_HOME}/you/team/${seg(b)}`;
  else if (a === 'team') to = `${P3_HOME}/you/team`;
  else if (a === 'handover') to = b ? `${P3_HOME}/you/handover/${seg(b)}` : `${P3_HOME}/you/handover`;
  else if (a === 'page' || a === 'profile') to = `${P3_HOME}/you/page`;
  else if (a === 'switch') to = `${P3_HOME}/you/switch`;
  else if (a === 'welcome') to = `${P3_HOME}/you/welcome`;
  else if (a === 'go-live') to = `${P3_HOME}/start`;
  else to = P3_HOME;
  const q = new URLSearchParams(search);
  q.delete(LEGACY_QUERY);
  const qs = q.toString();
  return `${to}${qs ? `?${qs}` : ''}${hash}`;
};

/**
 * The /account/o/* decision (read by modules/organiser/shell/OrganiserRoutes): the P3 path to
 * redirect to, or null = R1 renders (P3 off, the profile wizard, or the old area chosen with
 * `?legacy=1` -- or earlier this tab, `stickyLegacy` -- while the window is open).
 */
export const r1AreaRedirect = (
  f: OrganiserAreaFlags,
  loc: { pathname: string; search: string; hash: string },
  today: string,
  stickyLegacy: boolean,
): string | null => {
  if (!p3AreaLive(f)) return null;
  const asked = new URLSearchParams(loc.search).get(LEGACY_QUERY) === '1';
  if (legacyWindowOpen(today) && (asked || stickyLegacy)) return null;
  return r1ToP3Path(loc.pathname, loc.search, loc.hash);
};
