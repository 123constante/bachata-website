/**
 * Where a signed-in person's account lives -- the ONE mapping (layout D,
 * owner decision 2026-10-11: the account is a PERSON with roles, not either/or).
 *
 * - The header's account icon opens ACCOUNT_HOME_PATH. That page
 *   (src/pages/Account.tsx) asks `accountHome()` and either shows the dancer
 *   home or replaces itself with the organiser home, exactly as before.
 * - On the organiser home, `accountView()` says whether the account menu
 *   (the account icon in the organiser top bar) has a dancer-profile entry.
 * - `dancerGate()` / `isDancerGatedPath()`: dancer first, then organiser -- an
 *   unfinished dancer profile reaches none of these pages (see below).
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
/** Account settings (src/pages/AccountSettings.tsx): sign out, email, export, hide, erase. Never gated: see isDancerGatedPath. */
export const ACCOUNT_SETTINGS_PATH = '/account/settings';
/** The page shown after the account was erased (public: the person is signed out by then). */
export const ACCOUNT_DELETED_PATH = '/account/deleted';

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
  /** The account menu (organiser top bar) lists the dancer profile next to the organiser home. */
  menuDancerEntry: boolean;
};

/**
 * Layout D for one person whose dancer profile is FINISHED (an unfinished one
 * never gets this far: the dancer-first gate below stands in front of every
 * account page):
 * (a) organisers or an open request -> the organiser home, with the dancer
 *     profile as an account-menu entry;
 * (b) no organiser and no open request -> the dancer home.
 */
export const accountView = (facts: AccountFacts & { dancer: DancerFactKind }): AccountView => {
  const landing = accountHome(facts);
  return { landing, menuDancerEntry: landing === 'organiser' && facts.dancer === 'complete' };
};

/** True on every page the account icon stands for (dancer home, attendance, organiser area). */
export const isAccountPath = (pathname: string): boolean =>
  pathname === ACCOUNT_HOME_PATH || pathname.startsWith(`${ACCOUNT_HOME_PATH}/`);

// ---- Dancer first, then organiser (owner decision 2026-10-11) ----------------
//
// Every signed-in account finishes its dancer profile -- the one completeness
// definition, profile_complete_v1: first name, city, dance role, photo --
// BEFORE it reaches the dancer home, the organiser home, the organiser
// onboarding (claim / request / create) or any /account/o page. The ONE guard
// is components/account/DancerProfileGate (a route wrapper); the public site,
// event pages, RSVPs and the rating card are never gated.

/** The organiser invite landing (modules/admin-organisers/inviteModel INVITE_PATH): joining a team is organiser onboarding. */
const INVITE_PATH = '/invite';

/**
 * The pages behind the gate: /account, /account/dancer, /account/o and
 * everything under it, the old /account/new|series|team links (they redirect
 * into /account/o) and /invite. NOT /account/settings or /account/deleted, and NOT /account/attendance: a person's own nights
 * stay open, like the RSVPs they list. Judged case-folded, as the router matches.
 */
export const isDancerGatedPath = (pathname: string): boolean => {
  const path = pathname.toLowerCase();
  if (path === MY_ATTENDANCE_PATH || path === `${MY_ATTENDANCE_PATH}/`) return false;
  // Settings must never trap anyone: a person with an unfinished profile can still sign out, hide it or erase the account.
  if (path === ACCOUNT_SETTINGS_PATH || path.startsWith(`${ACCOUNT_SETTINGS_PATH}/`) || path === ACCOUNT_DELETED_PATH) return false;
  return isAccountPath(path) || path === INVITE_PATH || path.startsWith(`${INVITE_PATH}/`);
};

/**
 * Is `target` (a returnTo: path, query, hash) a gated destination? A gated page,
 * or a public organiser page carrying the "claim on return" intent (?claim=1,
 * modules/organiser/shared/publicClaim): that is a claim, i.e. organiser onboarding.
 */
export const isDancerGatedTarget = (target: string): boolean => {
  const beforeHash = target.split('#', 1)[0];
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt < 0 ? '' : beforeHash.slice(queryAt + 1);
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // An undecodable path is no route; judge it as written.
  }
  return isDancerGatedPath(decoded) || query.split('&').includes('claim=1');
};

/** ProfileCompletionStatus (lib/profileCompletion), restated: this module is import-free. */
export type DancerGateStatus = 'signed_out' | 'loading' | 'complete' | 'incomplete' | 'no_profile' | 'error';

/**
 * - `incomplete` (an empty stub or a partly filled row) and `no_profile` (no
 *   row, or an ARCHIVED one: `_dancer_profile_id_for_account_v1` never resolves
 *   an archived row, so it has no live profile) -> 'gate';
 * - `error` (the check itself failed) -> 'gate' too: the gate fails CLOSED, onto
 *   the Finish screen's "Try again" (the banner and rating card fail open; a
 *   gate that opened on a network blip would not be one);
 * - `loading` -> 'wait'; `complete` -> 'pass';
 * - `signed_out` -> 'pass': AuthGuard (outside the gate) sends them to sign in,
 *   and the invite page shows its own sign-in card.
 */
export const dancerGate = (status: DancerGateStatus): 'pass' | 'gate' | 'wait' => {
  if (status === 'complete' || status === 'signed_out') return 'pass';
  if (status === 'loading') return 'wait';
  return 'gate';
};

/** The gated Finish screen says why it is there (owner's words). No Skip there: it would only bounce back. */
export const DANCER_GATE_REASON = 'Finish your dancer profile first, then you can set up your organiser page.';

/**
 * The refusal the organiser create / claim / request RPCs raise for an unfinished
 * dancer profile (the SEPARATE admin PR adds that server check; it MUST raise
 * this exact string). It is also what rate_series_level_p5_v1 already raises:
 * hooks/useSeriesLevelRating keeps its own PROFILE_INCOMPLETE_ERROR because
 * importing this module there costs /event/:id one more first-load chunk
 * (perf-budgets.json ratchet); selfServe.test.ts pins the two equal.
 */
export const PROFILE_INCOMPLETE_CODE = 'profile_incomplete';
