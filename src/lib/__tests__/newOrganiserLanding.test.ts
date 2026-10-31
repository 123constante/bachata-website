import { describe, expect, it } from 'vitest';
import { ORGANISER_HOME_PATH, appWelcomeHref, onboardingEnd, onboardingEndLabel, signInLanding, type SidesFacts } from '@/lib/accountRouting';
import { P3_START_PATH, landingPathAfterAuth, newOrganiserLanding } from '@/lib/auth-otp-routing';
import { P3_PATHS } from '@/modules/organiser/p3/shell/paths';
import { organiserAreaHome } from '@/lib/organiserAreaHome';

// F4 (owner decision 2026-10-29): a brand-new organiser who signs in lands on
// P3's Welcome (/account/p3/start) -- only while the P3 area is live
// (organiserP3 AND organiserSelfServe, the pair AnimatedRoutes mounts it on).
// Every other kind of person lands exactly where they did before, flag on or off.
// signInLanding is fed the way /account/continue feeds it (ContinueAsPage).

const R1 = '/account/o';
const START = '/account/p3/start';

type Flags = { organiserP3: boolean; organiserSelfServe: boolean };
const FLAGS: Array<[string, Flags]> = [
  ['both off', { organiserP3: false, organiserSelfServe: false }],
  ['self-serve only', { organiserP3: false, organiserSelfServe: true }],
  ['P3 only', { organiserP3: true, organiserSelfServe: false }],
  ['P3 live', { organiserP3: true, organiserSelfServe: true }],
];
const live = (f: Flags) => f.organiserP3 && f.organiserSelfServe;

it('the restated paths are the real ones', () => {
  expect(P3_START_PATH).toBe(P3_PATHS.start);
  expect(newOrganiserLanding(false)).toBe(ORGANISER_HOME_PATH);
  expect(newOrganiserLanding(true)).toBe(P3_PATHS.start);
});

const base: SidesFacts = {
  organisers: [],
  dancer: 'complete',
  areaAllowed: true,
  dancerFace: null,
  organiserIntent: false,
  openRequestCount: 0,
  isAdmin: false,
  deletion: null,
};

// Person kind -> facts, returnTo, and the landing for P3 off / P3 live.
const KINDS: Array<{ kind: string; facts: Partial<SidesFacts>; returnTo?: string; off: string; on: string }> = [
  { kind: 'new organiser, dancer done (no page, no membership, no request)', facts: { organiserIntent: true }, off: R1, on: START },
  { kind: 'new organiser, dancer unfinished', facts: { organiserIntent: true, dancer: 'incomplete' }, off: appWelcomeHref(R1), on: appWelcomeHref(START) },
  { kind: 'organiser-intent with an open access request', facts: { organiserIntent: true, openRequestCount: 1 }, off: '/app/home', on: '/app/home' },
  { kind: 'existing organiser (one page)', facts: { organisers: [{ id: 'o1', name: 'A', avatar_url: null }], dancer: 'no_profile' }, off: R1, on: P3_PATHS.home }, // p3-landing F-01: P3 Home while live
  { kind: 'existing organiser with organiser intent', facts: { organisers: [{ id: 'o1', name: 'A', avatar_url: null }], dancer: 'no_profile', organiserIntent: true }, off: R1, on: P3_PATHS.home },
  { kind: 'dancer only', facts: {}, off: '/app/home', on: '/app/home' },
  { kind: 'dancer only, unfinished', facts: { dancer: 'incomplete' }, off: '/app/welcome', on: '/app/welcome' },
  { kind: 'invite claim (returnTo kept)', facts: { organiserIntent: true }, returnTo: '/invite/abc', off: '/invite/abc', on: '/invite/abc' },
];

describe('signInLanding: every person kind x P3 flag', () => {
  for (const k of KINDS) {
    for (const [name, f] of FLAGS) {
      it(`${k.kind} -- ${name}`, () => {
        // What useProfileSides passes: the new-organiser landing and the organiser area's Home (p3-landing).
        const facts: SidesFacts = { ...base, ...k.facts, newOrganiserTo: newOrganiserLanding(live(f)), organiserHomeTo: organiserAreaHome({ organiserP3: live(f), organiserSelfServe: true }) };
        expect(signInLanding(facts, k.returnTo ?? null)).toEqual({ kind: 'go', to: live(f) ? k.on : k.off });
      });
    }
  }

  it('no newOrganiserTo (any other caller) keeps today\'s landing', () => {
    expect(signInLanding({ ...base, organiserIntent: true }, null)).toEqual({ kind: 'go', to: R1 });
  });

  it('two organisers still choose, P3 live or not', () => {
    for (const [, f] of FLAGS) {
      const two = [{ id: 'a', name: 'A', avatar_url: null }, { id: 'b', name: 'B', avatar_url: null }];
      expect(signInLanding({ ...base, organisers: two, newOrganiserTo: newOrganiserLanding(live(f)) }, null).kind).toBe('choose');
    }
  });
});

describe('landingPathAfterAuth (callback, no returnTo): every sign-up kind x flags', () => {
  const ROWS: Array<{ kind: string; role: string | null; isSignup: boolean; off: string; on: string }> = [
    { kind: 'organiser sign-up (new organiser)', role: 'organiser', isSignup: true, off: R1, on: START },
    { kind: 'teacher sign-up (non-dancer role)', role: 'teacher', isSignup: true, off: R1, on: START },
    { kind: 'dancer sign-up', role: 'dancer', isSignup: true, off: '/account/continue', on: '/account/continue' },
    { kind: 'sign-in, organiser metadata', role: 'organiser', isSignup: false, off: '/account/continue', on: '/account/continue' },
    { kind: 'sign-in, dancer', role: null, isSignup: false, off: '/account/continue', on: '/account/continue' },
  ];
  for (const r of ROWS) {
    for (const [name, f] of FLAGS) {
      it(`${r.kind} -- ${name}`, () => {
        // Self-serve off: every role lands on the site home, as today.
        const want = !f.organiserSelfServe ? '/' : live(f) ? r.on : r.off;
        expect(landingPathAfterAuth({ organiserSelfServe: f.organiserSelfServe, organiserP3: f.organiserP3, role: r.role, isSignup: r.isSignup })).toBe(want);
      });
    }
  }
});

describe('onboardingEndLabel: the button names every end path', () => {
  const ROWS: Array<[string, string, string]> = [
    ['dancer Home', '/app/home', 'Go to Home'],
    ['organiser page (R1)', '/account/o', 'Next: set up your organiser page'],
    ['organiser page with query', '/account/o?x=1', 'Next: set up your organiser page'],
    ['P3 start', START, 'Next: find or create your page'],
    ['P3 start, trailing slash', `${START}/`, 'Next: find or create your page'],
    ['P3 start, unrelated query', `${START}?x=1`, 'Next: find or create your page'],
    ['P3 start with a page chosen (o=)', `${START}?o=abc`, 'Next: back to your page'],
    ['P3 Review return (o= and at=review)', `${START}?o=abc&at=review`, 'Next: back to your page'],
    ['P3 Review return, trailing slash', `${START}/?o=abc&at=review`, 'Next: back to your page'],
    ['P3 start with an empty o=', `${START}?o=`, 'Next: find or create your page'],
    ['invite', '/invite/abc', 'Next: join the team'],
    ['anything else', '/events', 'Continue'],
  ];
  for (const [name, end, label] of ROWS) {
    it(`${name} -> ${label}`, () => {
      expect(onboardingEndLabel(end)).toBe(label);
    });
  }

  it('the new-organiser unfinished-dancer landing ends on the P3 label', () => {
    const go = signInLanding({ ...base, organiserIntent: true, dancer: 'incomplete', newOrganiserTo: START }, null);
    expect(go).toEqual({ kind: 'go', to: appWelcomeHref(START) });
    expect(onboardingEndLabel(onboardingEnd(START))).toBe('Next: find or create your page');
  });
});

describe('signInLanding: today\'s behaviour for the remaining shapes (documented, not changed)', () => {
  const nt = { newOrganiserTo: START };
  const ROWS: Array<[string, Partial<SidesFacts>, unknown]> = [
    ['areaAllowed false, organiser intent, dancer done', { organiserIntent: true, areaAllowed: false }, { kind: 'go', to: START }],
    ['areaAllowed false, organiser intent, dancer incomplete', { organiserIntent: true, areaAllowed: false, dancer: 'incomplete' }, { kind: 'go', to: '/account/dancer' }],
    ['organiser intent, no dancer profile', { organiserIntent: true, dancer: 'no_profile' }, { kind: 'go', to: '/app/welcome' }],
    ['open request count null (read failed)', { organiserIntent: true, openRequestCount: null }, { kind: 'go', to: '/app/home' }],
    ['open request count undefined (loading)', { organiserIntent: true, openRequestCount: undefined }, { kind: 'wait' }],
    ['deletion set', { organiserIntent: true, deletion: 'restore' }, { kind: 'go', to: '/account/restore' }],
  ];
  for (const [name, f, want] of ROWS) {
    it(name, () => {
      expect(signInLanding({ ...base, ...f, ...nt }, null)).toEqual(want);
    });
  }
});
