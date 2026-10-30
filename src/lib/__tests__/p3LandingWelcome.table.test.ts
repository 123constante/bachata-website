import { describe, expect, it } from 'vitest';
import { ACCOUNT_HOME_PATH, CONTINUE_AS_PATH, ORGANISER_HOME_PATH, accountHome, type SidesFacts } from '@/lib/accountRouting';
import { P3_START_PATH, landingPathAfterAuth, continueAsLanding, organiserHomeHandoff } from '@/lib/auth-otp-routing';

// Brief p3-landing-welcome (owner decision 2026-10-30): while P3 is live (organiserP3 AND
// organiserSelfServe), a person with NO page -- waiting on an open access request or not -- ends on
// P3's Welcome, whatever way in; anyone with a page, and everyone with P3 off, ends exactly where
// they did before. Person state x flag x entry -> where they END, following each hop the app makes:
// the sign-up callback (AuthCallback -> landingPathAfterAuth), sign-in (/account/continue ->
// continueAsLanding, what ContinueAsPage renders), /account (pages/Account -> accountHome; 'organiser'
// replaces itself with /account/o) and /account/o (R1 Home -> organiserHomeHandoff, after its
// dancer-first gate). Each hop is the app's own function; this file only chains them.

type State = {
  name: string;
  /** null = the read failed. */
  organisers: { id: string; name: string; avatar_url: null }[] | null;
  /** null = the read failed. */
  openRequests: number | null;
  dancer: 'complete' | 'incomplete' | 'no_profile';
  /** The sign-up's metadata had a dancer row to fill in (the signup trigger made one). */
  dancerRow: boolean;
};
const page = (id: string) => ({ id, name: `Page ${id}`, avatar_url: null });
const STATES: State[] = [
  { name: 'no dancer row', organisers: [], openRequests: 0, dancer: 'no_profile', dancerRow: false },
  { name: 'dancer complete, 0 pages', organisers: [], openRequests: 0, dancer: 'complete', dancerRow: true },
  { name: '0 pages + open request', organisers: [], openRequests: 1, dancer: 'complete', dancerRow: true },
  { name: '1 page', organisers: [page('a')], openRequests: 0, dancer: 'complete', dancerRow: true },
  { name: 'several pages', organisers: [page('a'), page('b')], openRequests: 0, dancer: 'complete', dancerRow: true },
  { name: 'load error', organisers: null, openRequests: null, dancer: 'complete', dancerRow: true },
];

const FINISH = '/finish-profile?returnTo=%2Faccount%2Fo';
const DANCER_APP = '/app/home';
const R1 = ORGANISER_HOME_PATH;

/** /account/o: the dancer-first gate, then R1 Home (or its hand-off to P3). */
const atOrganiserHome = (s: State, p3Live: boolean): string => {
  if (s.dancer !== 'complete') return FINISH;
  return organiserHomeHandoff(p3Live, s.organisers === null ? null : s.organisers.length) ?? R1;
};
/** /account: accountHome; 'organiser' goes on to /account/o; else the dancer home stays. */
const atAccount = (s: State, p3Live: boolean): string => {
  const where = accountHome({ organiserCount: s.organisers === null ? null : s.organisers.length, openRequestCount: s.openRequests });
  return where === 'organiser' ? atOrganiserHome(s, p3Live) : ACCOUNT_HOME_PATH;
};
const facts = (s: State, organiserIntent: boolean): SidesFacts => ({
  organisers: s.organisers,
  dancer: s.dancer,
  areaAllowed: true,
  organiserIntent,
  openRequestCount: s.openRequests,
  isAdmin: false,
  deletion: null,
});
/** Follows a landing to where it rests: /account and /account/o take their own hop. */
const follow = (to: string, s: State, p3Live: boolean): string => {
  if (to === ACCOUNT_HOME_PATH) return atAccount(s, p3Live);
  if (to === R1) return atOrganiserHome(s, p3Live);
  return to;
};
const atSignIn = (s: State, p3Live: boolean, organiserIntent = true): string => {
  const l = continueAsLanding(facts(s, organiserIntent), p3Live);
  if (l.kind === 'wait') return 'wait';
  if (l.kind === 'choose') return 'choose';
  return follow(l.to, s, p3Live);
};
/** AuthCallback for an Organiser sign-up: no dancer row -> its fallback ('/'); else landingPathAfterAuth. */
const atSignUp = (s: State, p3Live: boolean): string => {
  if (!s.dancerRow) return '/';
  const to = landingPathAfterAuth({ organiserSelfServe: true, organiserP3: p3Live, role: 'organiser', isSignup: true });
  return to === CONTINUE_AS_PATH ? atSignIn(s, p3Live) : follow(to, s, p3Live);
};

const ENTRIES = { 'sign-up callback': atSignUp, 'sign-in': atSignIn, '/account': atAccount, '/account/o': atOrganiserHome } as const;
type Entry = keyof typeof ENTRIES;

// The whole table: [state][entry] = [flag off, flag on]. A sign-up only ever has 0 pages, so its
// rows for 1 / several pages and a load error record what the same functions answer anyway.
// A page plus a finished dancer profile is two sides: sign-in shows "Continue as...".
const W = P3_START_PATH;
const EXPECTED: Record<string, Record<Entry, [string, string]>> = {
  'no dancer row': { 'sign-up callback': ['/', '/'], 'sign-in': ['/app/welcome', '/app/welcome'], '/account': [ACCOUNT_HOME_PATH, ACCOUNT_HOME_PATH], '/account/o': [FINISH, FINISH] },
  'dancer complete, 0 pages': { 'sign-up callback': [R1, W], 'sign-in': [R1, W], '/account': [ACCOUNT_HOME_PATH, ACCOUNT_HOME_PATH], '/account/o': [R1, W] },
  '0 pages + open request': { 'sign-up callback': [R1, W], 'sign-in': [DANCER_APP, W], '/account': [R1, W], '/account/o': [R1, W] },
  '1 page': { 'sign-up callback': [R1, W], 'sign-in': ['choose', 'choose'], '/account': [R1, R1], '/account/o': [R1, R1] },
  'several pages': { 'sign-up callback': [R1, W], 'sign-in': ['choose', 'choose'], '/account': [R1, R1], '/account/o': [R1, R1] },
  'load error': { 'sign-up callback': [R1, W], 'sign-in': [ACCOUNT_HOME_PATH, ACCOUNT_HOME_PATH], '/account': [ACCOUNT_HOME_PATH, ACCOUNT_HOME_PATH], '/account/o': [R1, R1] },
};

describe('person state x flag x entry -> destination', () => {
  const cells = STATES.flatMap((s) =>
    (Object.keys(ENTRIES) as Entry[]).flatMap((entry) => ([false, true] as const).map((p3Live) => ({ s, entry, p3Live, label: `${s.name} | ${entry} | P3 ${p3Live ? 'on' : 'off'}` }))),
  );
  it.each(cells)('$label', ({ s, entry, p3Live }) => {
    expect(ENTRIES[entry](s, p3Live)).toBe(EXPECTED[s.name][entry][p3Live ? 1 : 0]);
  });
});

describe('the cases the owner saw (local copy, flags ON, 2026-10-30)', () => {
  const zero = STATES[1];
  const waiting = STATES[2];
  it('Back to Home from R1 (/account/o) with no page lands on P3 Welcome, not R1 Find your page', () => {
    expect(atOrganiserHome(zero, true)).toBe(P3_START_PATH);
    expect(atOrganiserHome(waiting, true)).toBe(P3_START_PATH);
  });
  it('the account icon (/account) while waiting on Tropicana lands on P3 Welcome', () => {
    expect(atAccount(waiting, true)).toBe(P3_START_PATH);
  });
  it('signing in again while waiting lands on P3 Welcome, with or without the organiser sign-up metadata', () => {
    expect(atSignIn(waiting, true, true)).toBe(P3_START_PATH);
    expect(atSignIn(waiting, true, false)).toBe(P3_START_PATH);
  });
});

describe('flag off: every row is where it was before this change', () => {
  it('a waiting person signing in still goes to their dancer side; /account still opens R1', () => {
    expect(atSignIn(STATES[2], false, false)).toBe(DANCER_APP);
    expect(atAccount(STATES[2], false)).toBe(R1);
  });
  it('the hand-off never fires off, with a page, or before / without the home read', () => {
    for (const n of [undefined, null, 0, 1, 2]) expect(organiserHomeHandoff(false, n)).toBeNull();
    for (const n of [undefined, null, 1, 2]) expect(organiserHomeHandoff(true, n)).toBeNull();
  });
  it('a waiting sign-in waits for the request read only while P3 is live', () => {
    const loading = { ...facts(STATES[2], false), openRequestCount: undefined };
    expect(continueAsLanding(loading, true)).toEqual({ kind: 'wait' });
    expect(continueAsLanding(loading, false)).toEqual({ kind: 'go', to: DANCER_APP });
  });
  it('a deleted login still goes to restore first, P3 live or not', () => {
    const deleted = { ...facts(STATES[2], false), deletion: 'restore' as const };
    for (const live of [false, true]) {
      const l = continueAsLanding(deleted, live);
      expect(l.kind === 'go' && l.to.startsWith('/account/restore')).toBe(true);
    }
  });
});
