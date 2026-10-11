/**
 * Where a signed-in person's account lives -- the ONE mapping (layout D,
 * owner decision 2026-10-11: the account is a PERSON with roles, not either/or).
 *
 * - The header's account icon opens ACCOUNT_HOME_PATH. That page
 *   (src/pages/Account.tsx) asks `accountHome()` and either shows the dancer
 *   home or replaces itself with the organiser home, exactly as before.
 * - On the organiser home, `accountView()` says whether the account menu
 *   (the account icon in the organiser top bar) has a dancer-profile entry.
 * - Before any of that, the dancer-first gate (`dancerGate()`, applied by
 *   components/account/DancerProfileGate on every /account* page): only a
 *   COMPLETE dancer profile gets in; anyone else finishes it first.
 *
 * Nothing else decides any of it, so the icon, the page, the gate and the menu
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
  /** Where the account icon lands (once the dancer gate lets the person through). */
  landing: AccountHome;
  /** The account menu (organiser top bar) lists the dancer profile next to the organiser home. */
  menuDancerEntry: boolean;
};

/**
 * Layout D for one person who is past the dancer gate (a complete profile):
 * an organiser or open request lands on the organiser home, whose account menu
 * lists the dancer profile; everyone else lands on the dancer home.
 */
export const accountView = (facts: AccountFacts & { dancer: DancerFactKind }): AccountView => {
  const landing = accountHome(facts);
  return { landing, menuDancerEntry: landing === 'organiser' && facts.dancer === 'complete' };
};

/** True on every page the account icon stands for (dancer home, attendance, organiser area). */
export const isAccountPath = (pathname: string): boolean =>
  pathname === ACCOUNT_HOME_PATH || pathname.startsWith(`${ACCOUNT_HOME_PATH}/`);

// ---- The dancer-first gate (owner decision 2026-10-11, supersedes #718's skippable row) ----

/**
 * The pages behind the gate: EVERY /account* page -- the dancer home
 * (/account, /account/dancer), My attendance, the organiser home, its
 * onboarding (claim / request / create) and every /account/o* page. Public
 * pages (events, RSVPs, parties, profiles, /finish-profile itself) never are.
 */
export const isDancerGatedPath = isAccountPath;

/** useProfileCompletion().status, as lib/profileCompletion names it. */
export type DancerGateStatus = 'signed_out' | 'loading' | 'complete' | 'incomplete' | 'no_profile' | 'error';

/**
 * Signed in on a gated page: only a COMPLETE dancer profile passes.
 * - incomplete (a stub or partly filled row) -> finish it first;
 * - no_profile (no row, or an ARCHIVED one: an archived row never resolves,
 *   _dancer_profile_id_for_account_v1, so there is no live profile) -> the
 *   Finish screen, which offers the contact (nothing to fill in);
 * - loading -> wait (a skeleton), then decide;
 * - error (the check itself failed) -> pass. A failed read proves nothing about
 *   the profile, and every completeness surface fails OPEN (lib/profileCompletion):
 *   an organiser is never locked out of tonight's event by a timeout. The writes
 *   that make someone an organiser (claim / request / create) are refused by the
 *   server for an unfinished profile anyway (PROFILE_INCOMPLETE_CODE);
 * - signed_out -> pass: AuthGuard, outside, is the authority on being signed in
 *   (an anonymous session reads as signed_out here; v2 behaviour, the server decides).
 */
export const dancerGate = (status: DancerGateStatus): 'pass' | 'wait' | 'finish' => {
  if (status === 'loading') return 'wait';
  if (status === 'incomplete' || status === 'no_profile') return 'finish';
  return 'pass';
};

/** The query value /finish-profile reads to know it was reached through the gate (no Skip there). */
export const FINISH_GATE_PARAM = 'gate';
export const FINISH_GATE_ORGANISER = 'organiser';

/** The gated Finish screen's one line of why. */
export const DANCER_GATE_REASON = 'Finish your dancer profile first, then you can set up your organiser page.';
