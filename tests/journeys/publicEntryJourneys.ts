/**
 * Every public way into an account -- ONE row list, read by
 *   - the routing-model spec  (tests/journeys/publicEntryJourneys.test.ts) and
 *   - the production-build walk (tests/e2e-build/public-journeys.build.spec.ts).
 * docs/journeys/public-entry-journeys.md is the same table in prose; keep the ids equal.
 *
 * A row is: where the person starts, who they are, what they do half way, and the
 * END screen with the state it must leave. Import-free on purpose (Playwright and
 * Vitest both load it).
 */

export type Person = {
  /** Signed in already when they open the entry link. */
  signedIn: boolean;
  /** The dancer profile: none yet (a new e-mail gets a stub at sign-up, i.e. 'incomplete'), part-filled, or finished. */
  dancer: 'incomplete' | 'complete' | 'none';
  /** Organisers they run (owner or manager). */
  organisers: number;
  /** The sign-up metadata role (Auth.tsx user_type), when the account has one. */
  userType?: string;
  /** Open organiser access requests. Default 0. */
  openRequests?: number;
};

export type Journey = {
  id: string;
  title: string;
  /** The URL the person opens. */
  entry: string;
  person: Person;
  /** For an /auth entry: sign up or sign in (what the form does after the code). */
  auth?: 'signup' | 'signin';
  /** Something that happens half way through onboarding. */
  midway?:
    | 'reload'
    | 'closed-tab-then-sign-in'
    | 'closed-tab-after-required'
    | 'magic-link-same-browser'
    | 'wrong-code-first'
    | 'expired-link'
    /** Browser Back on every onboarding card, and once more on the END screen. */
    | 'back-each-step'
    /** The e-mailed link opened on a SECOND device (another browser context); the first device then types the code. */
    | 'magic-link-other-context';
  /** What the person taps on the screen the walk would otherwise stop on. */
  then?: 'continue-as-organiser' | 'join-team';
  /** The END: the path (no query unless it matters), the screen, and the state left behind. */
  end: { path: string; screen: string; state: string };
};

export const ORGANISER_LINK = '/auth?mode=signup&userType=organiser&returnTo=%2Faccount%2Fo';
export const DANCER_LINK = '/auth?mode=signup&userType=dancer';

const NEW: Person = { signedIn: false, dancer: 'incomplete', organisers: 0 };
const INVITE = '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
const INVITE_SIGNIN = `/auth?mode=signin&returnTo=${encodeURIComponent(INVITE)}`;
const CLAIM_END = { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' };

export const JOURNEYS: Journey[] = [
  {
    id: 'organiser-link-new',
    title: 'Organiser launch link, new e-mail',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'organiser-link-new-reload',
    title: 'Organiser link, new e-mail, reloads half way through onboarding',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'reload',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'organiser-link-new-closed-tab',
    title: 'Organiser link, new e-mail, closes the tab half way, later signs in from the header',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'closed-tab-then-sign-in',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'organiser-link-closed-tab-after-required',
    title: 'Organiser link, new e-mail, finishes the required cards, closes the tab on "You\'re in", later signs in from the header',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'closed-tab-after-required',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'organiser-link-magic-link',
    title: 'Organiser link, new e-mail, opens the e-mailed link (same browser) instead of typing the code',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'magic-link-same-browser',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'organiser-link-wrong-code',
    title: 'Organiser link, new e-mail, types a wrong code first, then the right one',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'wrong-code-first',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'the wrong code says so and keeps the code step open' },
  },
  {
    id: 'organiser-link-expired-link',
    title: 'Organiser link, new e-mail, opens an expired e-mailed link, signs in again from the notice',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'expired-link',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: '/auth says the link expired and keeps returnTo' },
  },
  {
    id: 'organiser-link-existing-dancer',
    title: 'Organiser link, e-mail that already has a finished dancer profile (form switches to sign in)',
    entry: ORGANISER_LINK,
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'unchanged dancer profile, no organiser yet' },
  },
  {
    id: 'organiser-link-signed-in',
    title: 'Organiser link opened by someone already signed in (finished dancer)',
    entry: ORGANISER_LINK,
    person: { signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' },
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'no sign-up form shown again' },
  },
  {
    id: 'organiser-link-hostile-returnto',
    title: 'Organiser link with an off-site returnTo (open-redirect attempt)',
    entry: '/auth?mode=signup&userType=organiser&returnTo=https%3A%2F%2Fevil.example%2F',
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'the off-site value is dropped; organiser intent kept by the role' },
  },
  {
    id: 'dancer-link-new',
    title: 'Dancer link (also the home banner button), new e-mail',
    entry: DANCER_LINK,
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'dancer profile complete, no organiser' },
  },
  {
    id: 'dancer-link-new-reload',
    title: 'Dancer link, new e-mail, reloads half way through onboarding',
    entry: DANCER_LINK,
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    midway: 'reload',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'dancer profile complete, no organiser' },
  },
  {
    id: 'signin-dancer',
    title: 'Header Sign in, existing dancer',
    entry: '/auth?mode=signin',
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'no chooser for one side' },
  },
  {
    id: 'signin-both',
    title: 'Sign in, organiser who is also a dancer',
    entry: '/auth?mode=signin',
    person: { signedIn: false, dancer: 'complete', organisers: 1, userType: 'organiser' },
    auth: 'signin',
    end: { path: '/account/continue', screen: 'Continue as... (organiser first, then dancer)', state: 'Back does not return to /auth' },
  },
  {
    id: 'signin-unfinished-dancer',
    title: 'Sign in, dancer who never finished onboarding',
    entry: '/auth?mode=signin',
    person: { signedIn: false, dancer: 'incomplete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: '/app/home', screen: 'dancer app Home (after onboarding)', state: 'onboarding resumes at the first missing card' },
  },
  {
    id: 'deep-link-account-o-signed-out',
    title: 'Signed out, opens /account/o (e.g. a bookmark), new e-mail signs up from there',
    entry: '/auth?mode=signup&returnTo=%2Faccount%2Fo',
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    end: { path: '/account/o', screen: 'organiser claim-your-page (OnboardingView)', state: 'dancer profile complete, no organiser yet' },
  },
  {
    id: 'deep-link-app-signed-out',
    title: 'Signed out, opens /app/nights, existing dancer signs in',
    entry: '/auth?mode=signin&returnTo=%2Fapp%2Fnights',
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: '/app/nights', screen: 'dancer app Nights', state: 'the deep link is kept' },
  },
  {
    id: 'team-invite-new',
    title: 'Organiser team invite link, new e-mail',
    entry: '/auth?mode=signup&returnTo=%2Finvite%2F0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    end: { path: '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0', screen: 'invite redeem card', state: 'dancer profile complete; joins the team from the card' },
  },
  {
    id: 'claim-link-new',
    title: 'Public organiser page "Sign in to claim", new e-mail',
    entry: '/auth?mode=signup&returnTo=%2Forganisers%2Fbachata-playground-phone-qa%3Fclaim%3D1',
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    end: { path: '/organisers/bachata-playground-phone-qa?claim=1', screen: 'public organiser page, claim card', state: 'dancer profile complete; claim offered' },
  },
  // ---- MATRIX.md "Proposed follow-up" (docs/review-packs/public-journeys/MATRIX.md on claude/journey-matrix) ----
  {
    id: 'dancer-link-back-each-card',
    title: 'Dancer link, new e-mail, presses browser Back on each onboarding card and on the END (M24)',
    entry: DANCER_LINK,
    person: { ...NEW, userType: 'dancer' },
    auth: 'signup',
    midway: 'back-each-step',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'Back never shows /auth with a session, never a blank page, never re-opens "You\'re in" (M10/M24: the end replaces)' },
  },
  {
    id: 'organiser-link-back-each-card',
    title: 'Organiser link, new e-mail, presses browser Back on each onboarding card and on the END (M10)',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'back-each-step',
    end: { ...CLAIM_END, state: 'Back never shows /auth with a session, never a blank page, never re-opens "You\'re in" (M10/M24: the end replaces)' },
  },
  {
    id: 'organiser-link-magic-link-other-device',
    title: 'Organiser link, new e-mail, opens the e-mailed link on a second device (M06)',
    entry: ORGANISER_LINK,
    person: { ...NEW, userType: 'organiser' },
    auth: 'signup',
    midway: 'magic-link-other-context',
    end: { ...CLAIM_END, state: 'device 2 ends on the claim screen; the code on device 1 then says wrong or expired' },
  },
  {
    id: 'organiser-link-unfinished-dancer-signed-in',
    title: 'Organiser link opened by someone signed in with an unfinished dancer profile (M13)',
    entry: ORGANISER_LINK,
    person: { signedIn: true, dancer: 'incomplete', organisers: 0, userType: 'dancer' },
    end: { ...CLAIM_END, state: 'the gate ran onboarding with returnTo=/account/o first' },
  },
  {
    id: 'organiser-link-organiser-signed-in',
    title: 'Organiser link opened by someone signed in who already runs an organiser (M14)',
    entry: ORGANISER_LINK,
    person: { signedIn: true, dancer: 'complete', organisers: 1, userType: 'organiser' },
    end: { path: '/account/o', screen: 'organiser Home (not the claim screen)', state: 'no sign-up form, no onboarding' },
  },
  {
    id: 'organiser-link-open-request-signed-in',
    title: 'Organiser link opened by someone signed in with an open organiser access request (M16)',
    entry: ORGANISER_LINK,
    person: { signedIn: true, dancer: 'complete', organisers: 0, userType: 'organiser', openRequests: 1 },
    end: { path: '/account/o', screen: 'organiser onboarding showing the open request', state: 'the request is listed as waiting' },
  },
  {
    id: 'dancer-link-existing-dancer',
    title: 'Dancer link, e-mail that already has a finished dancer profile (form switches to sign in) (M26)',
    entry: DANCER_LINK,
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'unchanged dancer profile' },
  },
  {
    id: 'signin-unfinished-dancer-with-organiser',
    title: 'Sign in, organiser whose dancer profile is unfinished, picks the organiser (M35)',
    entry: '/auth?mode=signin',
    person: { signedIn: false, dancer: 'incomplete', organisers: 1, userType: 'organiser' },
    auth: 'signin',
    then: 'continue-as-organiser',
    end: { path: '/account/o', screen: 'organiser Home (after "Continue as...", the gate and onboarding)', state: 'dancer profile complete' },
  },
  {
    id: 'signin-open-request',
    title: 'Sign in, finished dancer with organiser intent and an open access request (M36)',
    entry: '/auth?mode=signin',
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'organiser', openRequests: 1 },
    auth: 'signin',
    end: { path: '/app/home', screen: 'dancer app Home', state: 'no F2 jump to the claim screen' },
  },
  {
    id: 'team-invite-existing-dancer',
    title: 'Team invite, signed out finished dancer signs in from the card and joins (M53)',
    entry: INVITE_SIGNIN,
    person: { signedIn: false, dancer: 'complete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    then: 'join-team',
    end: { path: '/account/o', screen: 'organiser Home of the joined organiser', state: 'member of the organiser' },
  },
  {
    id: 'team-invite-unfinished-dancer',
    title: 'Team invite, unfinished dancer signs in from the card (M54)',
    entry: INVITE_SIGNIN,
    person: { signedIn: false, dancer: 'incomplete', organisers: 0, userType: 'dancer' },
    auth: 'signin',
    end: { path: INVITE, screen: 'invite card', state: 'onboarding ran first and its end button said "Next: join the team"' },
  },
  {
    id: 'bookmark-app-welcome-finished',
    title: 'Finished dancer opens an old /app/welcome bookmark (M71)',
    entry: '/app/welcome',
    person: { signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' },
    end: { path: '/app/welcome', screen: 'onboarding end card (owner decision M71)', state: 'no card is asked again' },
  },
  {
    id: 'bookmark-finish-profile-finished',
    title: 'Finished dancer opens an old /finish-profile bookmark (M69)',
    entry: '/finish-profile',
    person: { signedIn: true, dancer: 'complete', organisers: 0, userType: 'dancer' },
    end: { path: '/app/home', screen: 'dancer app Home', state: 'the old Finish screen is not shown' },
  },
];
