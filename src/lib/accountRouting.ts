/**
 * Where a signed-in person's account lives -- the ONE mapping.
 *
 * The header's account icon, the sign-in landing and every "back to your
 * account" link open ACCOUNT_HOME_PATH. That page (src/pages/Account.tsx) asks
 * `accountHome()` and either shows the dancer home or replaces itself with the
 * organiser home. Nothing else decides it, so the icon and the page cannot
 * disagree about who is an organiser.
 *
 * Import-free on purpose: GlobalHeader is on every page's first load.
 */

export const ACCOUNT_HOME_PATH = '/account';
/** The organiser area's Home. Equal to ORG_PATHS.home (asserted in accountRouting.test.ts). */
export const ORGANISER_HOME_PATH = '/account/o';
/** My attendance (src/pages/MyAttendance.tsx): nights marked going or interested, and rating the past ones. */
export const MY_ATTENDANCE_PATH = '/account/attendance';

export type AccountHome = 'organiser' | 'dancer' | 'loading';

/**
 * The query keys an organiser-area link carries: `add` and `o` are read by the
 * organiser Home and Team pages, `from` by old emails. An allow-list, not a
 * block-list of tracking keys: apps add new tracking keys (igsh, si, srsltid...)
 * all the time, and none of them may send a dancer to the organiser area.
 */
const ORGANISER_LINK_KEYS = new Set(['add', 'o', 'from']);

/**
 * An old /account link meant for the organiser area: one of those keys, or any
 * #hash. Everything else on /account (?utm_source=, ?igsh=) is still decided
 * by accountHome() -- an organiser is redirected with the query kept.
 */
export const isLegacyAccountLink = (search: string, hash: string): boolean => {
  if (hash !== '' && hash !== '#') return true;
  return [...new URLSearchParams(search).keys()].some((key) => ORGANISER_LINK_KEYS.has(key));
};

export type AccountFacts = {
  /** isLegacyAccountLink(): an old /account link (email, bookmark) for the organiser area. */
  legacyParams: boolean;
  /** organiser_home_v1's organiser count. undefined while loading, null when the read failed. */
  organiserCount: number | null | undefined;
  /** The person's OPEN organiser access requests. undefined while loading, null when the read failed. */
  openRequestCount: number | null | undefined;
};

/**
 * - an organiser (owner or manager of at least one), or someone waiting on an
 *   access request, belongs on the organiser home: that is where their
 *   organiser, or their request's status, is;
 * - everyone else is a dancer.
 * A failed read cannot prove someone is an organiser, so it lands on the dancer
 * home, which then offers the organiser area by name (see DancerHome).
 */
export const accountHome = (facts: AccountFacts): AccountHome => {
  if (facts.legacyParams) return 'organiser';
  // An organiser is known as soon as the home read says so: never wait on the requests read.
  if ((facts.organiserCount ?? 0) > 0) return 'organiser';
  if (facts.organiserCount === undefined || facts.openRequestCount === undefined) return 'loading';
  if ((facts.organiserCount ?? 0) > 0 || (facts.openRequestCount ?? 0) > 0) return 'organiser';
  return 'dancer';
};

/** True on every page the account icon stands for (dancer home, attendance, organiser area). */
export const isAccountPath = (pathname: string): boolean =>
  pathname === ACCOUNT_HOME_PATH || pathname.startsWith(`${ACCOUNT_HOME_PATH}/`);
