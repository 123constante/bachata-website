/**
 * Where a signed-in person's account lives -- the ONE mapping (layout D,
 * owner decision 2026-10-11: the account is a PERSON with roles, not either/or).
 *
 * - The header's account icon opens ACCOUNT_HOME_PATH. That page
 *   (src/pages/Account.tsx) asks `accountHome()` and either shows the dancer
 *   home or replaces itself with the organiser home, exactly as before.
 * - profileSides() / signInLanding() / switcherItems(): the person's sides (each
 *   organiser, then the dancer profile), read by the sign-in landing, the
 *   "Continue as..." screen and the Switch-profile sheet in both areas.
 * - `dancerGate()` / `isDancerGatedPath()`: dancer first, then organiser -- an
 *   unfinished dancer profile reaches none of these pages (see below).
 *
 * Nothing else decides any of it, so the icon, the page, the gate and the menu
 * cannot disagree. Imports only lib/authRouting (itself import-free): GlobalHeader
 * is on every page's first load, and already loads that module.
 */

import { sanitizeReturnTo } from './authRouting';
import type { DeletionLanding } from './accountDeletion';
import { ACCOUNT_HOME_PATH, isAccountPath } from './accountPaths';
import { P3_START_PATH } from './p3StartPath';

// The two the site header needs live in an import-free leaf (review #789 S6); re-exported here.
export { ACCOUNT_HOME_PATH, isAccountPath };
/** The dancer home for anyone, organisers included (the account menu's dancer entry). */
export const DANCER_HOME_PATH = '/account/dancer';
/** The organiser area's Home. Equal to ORG_PATHS.home (asserted in accountRouting.test.tsx). */
export const ORGANISER_HOME_PATH = '/account/o';
/**
 * The organiser area's Home for every first-load door (F-01, owner decision 1 (c)): P3's Home while P3
 * is live (VITE_ENABLE_ORGANISER_P3 AND _SELF_SERVE, the pair AnimatedRoutes mounts /account/p3/* on),
 * else ORGANISER_HOME_PATH exactly as before. Written over the exact `import.meta.env.VITE_X` form so
 * Vite replaces it and Rollup folds it to ONE string: zero first-load bytes (bundle budget). Do not
 * route it through featureFlags' `flags` or a helper. Pinned to `flags` in p3Landing.matrix.test.ts.
 * import.meta.env is absent outside Vite (Playwright imports this file in plain Node via
 * selfServeErrors): the read is guarded and defaults to ORGANISER_HOME_PATH (review 1237 r1 F1),
 * the same pattern as src/lib/goingCheckin.ts.
 */
const readOrganiserAreaHome = (): string => {
  try {
    return import.meta.env.VITE_ENABLE_ORGANISER_P3 === 'true' &&
      import.meta.env.VITE_ENABLE_ORGANISER_SELF_SERVE === 'true'
      ? '/account/p3'
      : ORGANISER_HOME_PATH;
  } catch {
    return ORGANISER_HOME_PATH;
  }
};
export const ORGANISER_AREA_HOME_PATH: string = readOrganiserAreaHome();
/** My attendance (src/pages/MyAttendance.tsx): nights marked going or interested; past ones link to their rating card. */
export const MY_ATTENDANCE_PATH = '/account/attendance';
/** Account settings (src/pages/AccountSettings.tsx): sign out, email, export, hide, erase. Never gated: see isDancerGatedPath. */
export const ACCOUNT_SETTINGS_PATH = '/account/settings';
/** Settings opened from inside the dancer app: `?from=app` makes the page offer "Back to Options" (audit M4). */
export const APP_ACCOUNT_SETTINGS_PATH = `${ACCOUNT_SETTINGS_PATH}?from=app`;
/**
 * The account copy shown on BOTH the site and the dancer app (audit M16, L13): one string
 * per fact. src/modules/dancer-app/copy/sharedCopy.ts re-exports these unchanged, so the
 * dancer app reads them there; site pages read them here and never import the dancer-app
 * module (dancer-area isolation rule c). They live in THIS module, not a file of their own,
 * because every surface that shows them already loads this one: a separate module became a
 * separate first-load chunk on /app/* (one more request per view, perf-budgets chunk ratchet).
 */
/** The "nobody else can see my dancer page" state. One word everywhere: hidden. */
export const HIDDEN_STATE_WORD = 'hidden';
export const HIDDEN_STATE_LINE = 'Your dancer profile is hidden. Only you can see it.';
export const SHOW_AGAIN_LABEL = 'Show my profile again';
/** The one name for the account page (was Options / Settings / Your account). */
export const ACCOUNT_SETTINGS_LABEL = 'Account settings';
/** Where a deleted (= hidden) account lands after sign-in: restore within 30 days, else the deleted card (pages/AccountRestore). */
export const ACCOUNT_RESTORE_PATH = '/account/restore';

/** /account/restore, carrying the page the sign-in was headed for (its "Continue" goes there). */
export const restorePathFor = (returnTo: string | null): string => {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `${ACCOUNT_RESTORE_PATH}?returnTo=${encodeURIComponent(safe)}` : ACCOUNT_RESTORE_PATH;
};

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
  // The sign-in landing only reads; each side it opens is gated where it lives.
  if (path === CONTINUE_AS_PATH || path === `${CONTINUE_AS_PATH}/`) return false;
  // /invite is NOT gated (W1, Option B): the invite page asks the dancer questions inline and never leaves.
  return isAccountPath(path);
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

/**
 * The dancer app's base, restated from modules/dancer-app/shell/routes DANCER_APP_BASE (pinned equal by
 * accountRouting tests): importing it from there split that leaf into a chunk of its own (+1 request on /app/*).
 */
export const DANCER_APP_PREFIX = '/app';

/**
 * Is `target` a page a signed-out person cannot open (AuthGuard sends them to "Welcome back") or a gated
 * one (mid-setup it sends them back into setup)? /account/*, /app/*, and every isDancerGatedTarget.
 * Review #789 S2: a sign-up's "Not now" never goes to one.
 */
export const isSignedInOnlyTarget = (target: string): boolean => {
  const path = target.split('#', 1)[0].split('?', 1)[0].toLowerCase();
  return (
    isAccountPath(path) || path === DANCER_APP_PREFIX || path.startsWith(`${DANCER_APP_PREFIX}/`) || isDancerGatedTarget(target)
  );
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

// ---- Your profiles: the sides a person can be (owner workflow 2026-10-15) ----
//
// ONE list, read by the "Continue as..." screen after sign-in, the "Switch
// profile" sheet (dancer app and organiser area) and every redirect below.
// Sides today: each organiser the person runs (owner or manager), one entry per
// organiser, ALWAYS listed first; then their dancer profile. An open organiser
// access request is not a side (they run nothing yet): the dancer app's
// Options row links to it.

/** Sign-in with no returnTo lands here: straight on to the one side, or "Continue as...". */
export const CONTINUE_AS_PATH = '/account/continue';
/** The dancer app's Home and onboarding (modules/dancer-app/shell/routes, asserted equal in the test). */
export const APP_HOME_PATH = '/app/home';
export const APP_WELCOME_PATH = '/app/welcome';

// ---- The onward destination through onboarding (owner decision 2026-10-15) ----
//
// The organiser launch link (/auth?mode=signup&userType=organiser&returnTo=/account/o)
// runs the FULL dancer setup, then lands on the organiser 'claim your page'
// screen. Its returnTo rides every hop as `?returnTo=`: /auth -> the code step
// -> /auth/callback -> /account/o's gate -> /finish-profile -> /app/welcome ->
// the photo screen and back -> the end of onboarding. One explicit returnTo
// always wins; with none, onboarding ends on the dancer Home, as before.
// docs/journeys/public-entry-journeys.md walks every row.

/** The query key the onward destination travels under, on /finish-profile and /app/welcome alike. */
export const RETURN_TO_PARAM = 'returnTo';

/** The pages onboarding itself is made of: never an onward destination (it would loop back into them). */
const ONBOARDING_PATHS = [APP_WELCOME_PATH, '/finish-profile'];

/**
 * A returnTo onboarding may carry on to: same-site and relative (sanitizeReturnTo:
 * no //host, no scheme, no backslash trick, never /auth), and not onboarding itself.
 */
export const onwardReturnTo = (raw: string | null | undefined): string | null => {
  const safe = sanitizeReturnTo(raw ?? null);
  if (!safe) return null;
  let path = safe.split(/[?#]/, 1)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  path = path.toLowerCase().replace(/\/+$/, '');
  return ONBOARDING_PATHS.includes(path) ? null : safe;
};

/**
 * The account was created for an organiser-type role: sign-up metadata user_type
 * set and not 'dancer' -- the same reading lib/auth-otp-routing landingPathAfterAuth
 * gives a sign-up (a non-dancer role goes on to /account/o).
 */
export const hasOrganiserIntent = (userType: unknown): boolean =>
  typeof userType === 'string' && userType.trim() !== '' && userType.trim().toLowerCase() !== 'dancer';

/** The dancer onboarding, carrying the onward destination when there is one. */
export const appWelcomeHref = (returnTo: string | null | undefined): string => {
  const onward = onwardReturnTo(returnTo);
  return onward ? `${APP_WELCOME_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(onward)}` : APP_WELCOME_PATH;
};

/** Where onboarding ends: the onward destination, else the dancer Home. */
export const onboardingEnd = (returnTo: string | null | undefined): string => onwardReturnTo(returnTo) ?? APP_HOME_PATH;

/** The end-of-onboarding button names where it goes; it never says Home when it does not go there. */
export const onboardingEndLabel = (end: string): string => {
  const rawPath = end.split(/[?#]/, 1)[0];
  const path = rawPath.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === APP_HOME_PATH) return 'Go to Home';
  if (path === ORGANISER_HOME_PATH || path.startsWith(`${ORGANISER_HOME_PATH}/`)) return 'Next: set up your organiser page';
  // A chosen page (o=, e.g. the Review-step return) already exists: "find or create" would point at a step that is not coming.
  // P3's Home ('/account/p3', ORGANISER_AREA_HOME_PATH while P3 is live) is the switcher's onward
  // returnTo for the same person (useProfileSides passes no newOrganiserTo): same step (review 1237 r1 F5).
  if (path === P3_START_PATH || path === '/account/p3') return /[?&]o=[^&#]/.test(end) ? 'Next: back to your page' : 'Next: find or create your page';
  if (path === INVITE_PATH || path.startsWith(`${INVITE_PATH}/`)) return 'Next: join the team';
  return 'Continue';
};

export type SideOrganiser = { id: string; name: string; avatar_url: string | null };

export type SidesFacts = {
  /** organiser_home_v1's organisers. undefined while loading, null when the read failed. */
  organisers: readonly SideOrganiser[] | null | undefined;
  /** completenessFact(...).kind, or 'loading'. */
  dancer: DancerFactKind | 'loading';
  /** The dancer-area gate (useDancerArea): undefined while loading; a failed read is false (closed). */
  areaAllowed: boolean | undefined;
  /** The dancer's own name and photo when read (the dancer app's my-dancer-edit cache); null when unknown. */
  dancerFace?: { firstName: string | null; avatarUrl: string | null } | null;
  /**
   * The account was created from an organiser-type link (sign-up metadata
   * user_type is not 'dancer'). Someone who closed the tab half way through
   * onboarding and signs in again later still ends on the organiser page.
   */
  organiserIntent?: boolean;
  /**
   * Open organiser access requests: undefined while loading, null when the read
   * failed. Only signInLanding reads it (a request is not a side).
   */
  openRequestCount?: number | null;
  /**
   * The person is an admin (admin_is_admin, hooks/useIsAdmin): undefined while
   * loading, null when the read failed. Only signInLanding reads it, and only
   * for a person with no side at all (M44).
   */
  isAdmin?: boolean | null;
  /**
   * lib/accountGate's `deletion`: a soft-deleted login routes to restore / the deleted card BEFORE
   * any side or returnTo. 'loading' = not read yet; undefined / null = not deleted (or a failed read).
   */
  deletion?: DeletionLanding | 'loading';
  /**
   * Where a brand-new organiser (organiser intent, no organiser, no open request) lands:
   * lib/auth-otp-routing newOrganiserLanding, passed in by /account/continue (F4).
   * Absent = the organiser home, as before.
   */
  newOrganiserTo?: string;
  /**
   * The organiser area's Home (lib/organiserAreaHome organiserAreaHome: P3 while live, F-01).
   * Absent = ORGANISER_HOME_PATH, as before.
   */
  organiserHomeTo?: string;
};

export type ProfileSide =
  | { kind: 'organiser'; key: string; organiserId: string; name: string; avatarUrl: string | null; to: string }
  | { kind: 'dancer'; key: 'dancer'; firstName: string | null; avatarUrl: string | null; to: string };

export type SidesState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; sides: ProfileSide[] };

/**
 * Where the dancer side opens: the dancer app when the gate lets the person in
 * (onboarding while the profile is unfinished), else today's dancer home -- a
 * closed gate never strands anyone.
 */
export const dancerSidePath = (dancer: 'complete' | 'incomplete', areaAllowed: boolean): string =>
  !areaAllowed ? DANCER_HOME_PATH : dancer === 'incomplete' ? APP_WELCOME_PATH : APP_HOME_PATH;

/**
 * The person's sides. A dancer side exists for a finished or unfinished dancer
 * profile; none for no profile (no row, or an archived one). The organiser home
 * shows every organiser at once; with more than one, each button carries ?o=
 * (the key the organiser pages read) so the switcher can tick the one tapped.
 */
export const profileSides = (f: SidesFacts): SidesState => {
  if (f.organisers === undefined || f.dancer === 'loading' || f.areaAllowed === undefined) return { status: 'loading' };
  if (f.organisers === null || f.dancer === 'unknown') return { status: 'failed' };
  const many = f.organisers.length > 1;
  const home = f.organiserHomeTo ?? ORGANISER_HOME_PATH;
  const sides: ProfileSide[] = f.organisers.map((o) => ({
    kind: 'organiser',
    key: `organiser:${o.id}`,
    organiserId: o.id,
    name: o.name,
    avatarUrl: o.avatar_url,
    to: many ? `${home}?o=${encodeURIComponent(o.id)}` : home,
  }));
  if (f.dancer === 'complete' || f.dancer === 'incomplete') {
    sides.push({
      kind: 'dancer',
      key: 'dancer',
      firstName: f.dancerFace?.firstName ?? null,
      avatarUrl: f.dancerFace?.avatarUrl ?? null,
      // Organiser intent with nothing organised yet: the unfinished onboarding carries on to the organiser page.
      to:
        f.dancer === 'incomplete' && f.areaAllowed && f.organiserIntent && f.organisers.length === 0
          ? appWelcomeHref(f.newOrganiserTo ?? home)
          : dancerSidePath(f.dancer, f.areaAllowed),
    });
  }
  return { status: 'ready', sides };
};

export type SignInLanding = { kind: 'wait' } | { kind: 'go'; to: string } | { kind: 'choose'; sides: ProfileSide[] };

/**
 * After sign-in: a deleted login goes to restore / the deleted card (lib/accountGate); an explicit returnTo (a link the person followed) always wins;
 * one side -> straight there; two or more -> "Continue as..." (every sign-in, no
 * "remember"). No side at all (no live dancer row, no organiser): an admin stays
 * on the site home, as before; anyone else goes to the dancer setup (M44, owner
 * decision 2026-10-15) when the dancer area lets them in, else the site home. A
 * failed admin read keeps the site home. A failed sides read cannot prove the
 * sides: /account decides, with its own error card.
 *
 * One exception (review F2, option (b)): a single FINISHED dancer side whose
 * account came by the organiser link, with no organiser and no open request,
 * goes to the organiser claim screen -- the person closed the tab after the
 * required cards. Only the landing changes; the dancer side's own `to` (the
 * switcher's entry) still opens the dancer app. A failed request read keeps the
 * plain landing.
 */
export const signInLanding = (f: SidesFacts, returnTo: string | null): SignInLanding => {
  // A deleted login first (AuthCallback already did this on the way in; the organiser area relies on it too).
  if (f.deletion === 'loading') return { kind: 'wait' };
  if (f.deletion) return { kind: 'go', to: restorePathFor(returnTo) };
  if (returnTo) return { kind: 'go', to: returnTo };
  const state = profileSides(f);
  if (state.status === 'loading') return { kind: 'wait' };
  if (state.status === 'failed') return { kind: 'go', to: ACCOUNT_HOME_PATH };
  if (state.sides.length === 0) {
    if (!f.areaAllowed) return { kind: 'go', to: '/' };
    if (f.isAdmin === undefined) return { kind: 'wait' };
    return { kind: 'go', to: f.isAdmin === false ? APP_WELCOME_PATH : '/' };
  }
  if (state.sides.length === 1) {
    const unclaimedOrganiser = state.sides[0].kind === 'dancer' && f.dancer === 'complete' && f.organiserIntent;
    if (unclaimedOrganiser && f.openRequestCount === undefined) return { kind: 'wait' };
    if (unclaimedOrganiser && f.openRequestCount === 0) return { kind: 'go', to: f.newOrganiserTo ?? f.organiserHomeTo ?? ORGANISER_HOME_PATH };
    return { kind: 'go', to: state.sides[0].to };
  }
  return { kind: 'choose', sides: state.sides };
};

/** Which area the switcher is drawn in; the organiser area passes its ?o= (null when absent). */
export type SwitcherWhere = { area: 'dancer' } | { area: 'organiser'; organiserId: string | null };

/**
 * The "Switch profile" sheet: every side, with a tick on the current one. In the
 * organiser area that is the organiser named by ?o=, or the only organiser.
 */
export const switcherItems = (sides: readonly ProfileSide[], where: SwitcherWhere): Array<ProfileSide & { current: boolean }> => {
  const organisers = sides.filter((s) => s.kind === 'organiser');
  const tickedOrganiser =
    where.area !== 'organiser'
      ? null
      : (organisers.find((s) => s.kind === 'organiser' && s.organiserId === where.organiserId) ?? (organisers.length === 1 ? organisers[0] : null));
  return sides.map((s) => ({ ...s, current: where.area === 'dancer' ? s.kind === 'dancer' : s === tickedOrganiser }));
};

/** The old dancer pages RedirectIfAllowed wraps: /account (resolve), /account/dancer, /finish-profile. */
export type OldDancerHomeFacts = {
  view: 'resolve' | 'dancer' | 'finish';
  /** The dancer-area gate let this person in. */
  allowed: boolean;
  legacyParams: boolean;
  /** undefined = loading, null = the read failed. */
  organiserCount: number | null | undefined;
  openRequestCount: number | null | undefined;
  profile: 'complete' | 'incomplete' | 'no_profile' | 'error' | 'loading' | 'signed_out' | null;
  /** /finish-profile's ?returnTo= (the gated page the person wanted): it rides on into onboarding. */
  returnTo?: string | null;
};

/**
 * Where an old dancer page sends a person the gate lets in, or null = stay.
 * - /account/dancer IS the dancer side: anyone allowed goes to the dancer app,
 *   organisers included (it is what their account menu's dancer entry opened);
 * - /account and /finish-profile: only when /account would show the dancer home
 *   (accountHome), proven -- an organiser, an open request, an old organiser
 *   link, a loading or FAILED organiser read all stay on today's page;
 * - complete -> Home; incomplete -> onboarding; anything else stays (today's
 *   Finish screen has the message-us and Try-again paths);
 * - /finish-profile?returnTo=X: X is an explicit destination and always wins --
 *   incomplete -> onboarding carrying X (the organiser link's /account/o),
 *   complete -> X itself.
 */
export const oldDancerHomeRedirect = (f: OldDancerHomeFacts): string | null => {
  if (!f.allowed) return null;
  // An explicit returnTo wins before the home check: an organiser whose dancer
  // profile is unfinished is sent here by the /account/o gate (M35).
  const explicit = f.view === 'finish' && onwardReturnTo(f.returnTo) !== null;
  if (f.view !== 'dancer' && !explicit) {
    const where = accountHome({ legacyParams: f.legacyParams, organiserCount: f.organiserCount, openRequestCount: f.openRequestCount });
    if (where !== 'dancer') return null;
    if (f.organiserCount === null || f.openRequestCount === null) return null;
  }
  const onward = f.view === 'finish' ? f.returnTo : null;
  if (f.profile === 'complete') return onboardingEnd(onward);
  if (f.profile === 'incomplete') return appWelcomeHref(onward);
  return null;
};
