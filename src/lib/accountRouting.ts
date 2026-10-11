/**
 * Where a signed-in person's account lives -- the ONE mapping (layout D,
 * owner decision 2026-10-11: the account is a PERSON with roles, not either/or).
 *
 * - The header's account icon opens ACCOUNT_HOME_PATH. That page
 *   (src/pages/Account.tsx) asks `accountHome()` and either shows the dancer
 *   home or replaces itself with the organiser home, exactly as before.
 * - On the organiser home, `accountView()` says whether the one small
 *   "Finish your dancer profile" row shows, and whether the account menu (the
 *   account icon in the organiser top bar) has a dancer-profile entry.
 *
 * Nothing else decides any of it, so the icon, the page, the row and the menu
 * cannot disagree. Import-free on purpose: GlobalHeader is on every page's
 * first load.
 */

export const ACCOUNT_HOME_PATH = '/account';
/** The dancer home for anyone, organisers included (the account menu's dancer entry). */
export const DANCER_HOME_PATH = '/account/dancer';
/** The organiser area's Home. Equal to ORG_PATHS.home (asserted in accountRouting.test.tsx). */
export const ORGANISER_HOME_PATH = '/account/o';
/** My attendance (src/pages/MyAttendance.tsx): nights marked going or interested; past ones link to their rating card. */
export const MY_ATTENDANCE_PATH = '/account/attendance';

export type AccountHome = 'organiser' | 'dancer' | 'loading';

/**
 * The query keys an organiser-area link carries: `add` and `o` are read by the
 * organiser Home and Team pages, `from` and `claim` by old emails. An allow-list:
 * tracking keys (utm_*, igsh, srsltid...) must never send a dancer to the
 * organiser area. A #hash alone never does either: the site's own "Skip to
 * content" link is #main-content.
 */
const ORGANISER_LINK_KEYS = new Set(['add', 'o', 'from', 'claim']);

/** An old /account link meant for the organiser area: one of those query keys (the hash rides along). */
export const isLegacyAccountLink = (search: string, _hash: string): boolean =>
  [...new URLSearchParams(search).keys()].some((key) => ORGANISER_LINK_KEYS.has(key));

export type AccountFacts = {
  /** isLegacyAccountLink(): an old /account link (email, bookmark) for the organiser area. */
  legacyParams?: boolean;
  /** organiser_home_v1's organiser count. undefined while loading, null when the read failed. */
  organiserCount: number | null | undefined;
  /** The person's OPEN organiser access requests. undefined while loading, null when the read failed. */
  openRequestCount: number | null | undefined;
};

/**
 * - an organiser (owner or manager of at least one), or someone waiting on an
 *   open access request, lands on the organiser home: unchanged from before;
 * - everyone else lands on the dancer home.
 * A failed read cannot prove anyone is an organiser, so it lands on the dancer
 * home, which then names the organiser area and links to it.
 */
export const accountHome = (facts: AccountFacts): AccountHome => {
  if (facts.legacyParams) return 'organiser';
  // An organiser is known as soon as the home read says so: never wait on the requests read.
  if ((facts.organiserCount ?? 0) > 0) return 'organiser';
  if (facts.organiserCount === undefined || facts.openRequestCount === undefined) return 'loading';
  if ((facts.openRequestCount ?? 0) > 0) return 'organiser';
  return 'dancer';
};

/** completenessFact(...).kind (lib/profileCompletion). An archived profile resolves to no persona: 'no_profile'. */
export type DancerFactKind = 'complete' | 'incomplete' | 'no_profile' | 'unknown';

export type AccountView = {
  /** Where the account icon lands. */
  landing: AccountHome;
  /** The organiser home's one small, skippable "Finish your dancer profile" row. */
  unfinishedRow: boolean;
  /** The account menu (organiser top bar) lists the dancer profile next to the organiser home. */
  menuDancerEntry: boolean;
};

/**
 * Layout D for one person:
 * (a) organisers + an UNFINISHED dancer profile -> the one row on the organiser home, nothing else;
 * (b) organisers + a FINISHED dancer profile -> no row; the dancer profile is an account-menu entry;
 * (c) no organiser and no open request -> the dancer home;
 * no dancer profile at all (none, or archived) -> nothing about dancing on the organiser side.
 */
export const accountView = (facts: AccountFacts & { dancer: DancerFactKind }): AccountView => {
  const landing = accountHome(facts);
  const hasOrganisers = (facts.organiserCount ?? 0) > 0;
  return {
    landing,
    unfinishedRow: hasOrganisers && facts.dancer === 'incomplete',
    menuDancerEntry: landing === 'organiser' && facts.dancer === 'complete',
  };
};

/** True on every page the account icon stands for (dancer home, attendance, organiser area). */
export const isAccountPath = (pathname: string): boolean =>
  pathname === ACCOUNT_HOME_PATH || pathname.startsWith(`${ACCOUNT_HOME_PATH}/`);

/** The organiser-home row's "skip": hidden for the rest of this browser session. */
const ROW_DISMISSED_KEY = 'bc:dancer-row-dismissed';

export const isDancerRowDismissed = (): boolean => {
  try {
    return window.sessionStorage.getItem(ROW_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

export const dismissDancerRow = (): void => {
  try {
    window.sessionStorage.setItem(ROW_DISMISSED_KEY, '1');
  } catch {
    // Private mode / blocked storage: the row still hides for this page view (component state).
  }
};
