/**
 * Where a signed-in person lands, for every account shape x every entry point
 * (brief dancer-app-routing, owner workflow 2026-10-15). ONE mapping:
 * lib/accountRouting (profileSides / signInLanding / switcherItems /
 * oldDancerHomeRedirect) plus lib/auth-otp-routing's landingPathAfterAuth for
 * the callback's first hop. Screens render these answers; this table is the
 * check that would have caught "sign-in landed on the OLD dancer home".
 */
import { describe, expect, it } from 'vitest';
import {
  APP_HOME_PATH,
  APP_WELCOME_PATH,
  CONTINUE_AS_PATH,
  DANCER_HOME_PATH,
  ORGANISER_HOME_PATH,
  oldDancerHomeRedirect,
  profileSides,
  signInLanding,
  switcherItems,
  type SidesFacts,
} from '@/lib/accountRouting';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import { DANCER_HOME, DANCER_WELCOME } from '@/modules/dancer-app/shell/routes';

const ORG_A = { id: 'org-a', name: 'Bachata Nights', avatar_url: 'https://x.test/a.png' };
const ORG_B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };

type Shape = {
  name: string;
  facts: SidesFacts;
  /** The old-home redirect's extra facts (organiser reads as Account.tsx reads them). */
  openRequestCount: number;
  /** Sign-in with no returnTo: a path, or the chooser's side keys in order. */
  signIn: string | string[];
  /** Sign-up as a dancer (role "dancer"). */
  signUpDancer: string | string[];
  /** The ticked side in the /app switcher and in the organiser area (null = that area is not theirs). */
  tickInApp: string | null;
  tickInOrganiser: string | null;
  /** /account/dancer: where the allowed-redirect sends them (null = today's page stays). */
  oldDancerHome: string | null;
};

const dancerFacts = (dancer: SidesFacts['dancer'], extra: Partial<SidesFacts> = {}): SidesFacts => ({
  organisers: [],
  dancer,
  areaAllowed: true,
  ...extra,
});

const SHAPES: Shape[] = [
  {
    name: 'dancer complete',
    facts: dancerFacts('complete'),
    openRequestCount: 0,
    signIn: APP_HOME_PATH,
    signUpDancer: APP_HOME_PATH,
    tickInApp: 'dancer',
    tickInOrganiser: null,
    oldDancerHome: APP_HOME_PATH,
  },
  {
    name: 'dancer incomplete',
    facts: dancerFacts('incomplete'),
    openRequestCount: 0,
    signIn: APP_WELCOME_PATH,
    signUpDancer: APP_WELCOME_PATH,
    tickInApp: 'dancer',
    tickInOrganiser: null,
    oldDancerHome: APP_WELCOME_PATH,
  },
  {
    name: 'signed in, no dancer profile',
    facts: dancerFacts('no_profile'),
    openRequestCount: 0,
    signIn: '/',
    signUpDancer: '/',
    tickInApp: null,
    tickInOrganiser: null,
    oldDancerHome: null,
  },
  {
    name: 'organiser only',
    facts: dancerFacts('no_profile', { organisers: [ORG_A] }),
    openRequestCount: 0,
    signIn: ORGANISER_HOME_PATH,
    signUpDancer: ORGANISER_HOME_PATH,
    tickInApp: null,
    tickInOrganiser: 'organiser:org-a',
    oldDancerHome: null,
  },
  {
    name: 'organiser + dancer',
    facts: dancerFacts('complete', { organisers: [ORG_A] }),
    openRequestCount: 0,
    signIn: ['organiser:org-a', 'dancer'],
    signUpDancer: ['organiser:org-a', 'dancer'],
    tickInApp: 'dancer',
    tickInOrganiser: 'organiser:org-a',
    // The owner's report (2026-10-15): the account menu's dancer entry kept them on the old home.
    oldDancerHome: APP_HOME_PATH,
  },
  {
    name: 'two organisers + dancer',
    facts: dancerFacts('complete', { organisers: [ORG_A, ORG_B] }),
    openRequestCount: 0,
    signIn: ['organiser:org-a', 'organiser:org-b', 'dancer'],
    signUpDancer: ['organiser:org-a', 'organiser:org-b', 'dancer'],
    tickInApp: 'dancer',
    // In the organiser area the tick follows ?o= (the button they tapped).
    tickInOrganiser: 'organiser:org-b',
    oldDancerHome: APP_HOME_PATH,
  },
  {
    name: 'open organiser request (no organiser yet)',
    facts: dancerFacts('complete'),
    openRequestCount: 1,
    signIn: APP_HOME_PATH,
    signUpDancer: APP_HOME_PATH,
    tickInApp: 'dancer',
    tickInOrganiser: null,
    oldDancerHome: APP_HOME_PATH,
  },
  {
    name: 'admin only (no dancer profile, no organiser)',
    facts: dancerFacts('no_profile', { areaAllowed: false }),
    openRequestCount: 0,
    signIn: '/',
    signUpDancer: '/',
    tickInApp: null,
    tickInOrganiser: null,
    oldDancerHome: null,
  },
  {
    name: 'gate closed, not listed',
    facts: dancerFacts('complete', { areaAllowed: false }),
    openRequestCount: 0,
    // Never stranded: the old dancer home, which stays.
    signIn: DANCER_HOME_PATH,
    signUpDancer: DANCER_HOME_PATH,
    tickInApp: 'dancer',
    tickInOrganiser: null,
    oldDancerHome: null,
  },
];

/** Follow the callback's first hop, then the Continue-as page. */
const afterCallback = (first: string, facts: SidesFacts): string | string[] => {
  if (first !== CONTINUE_AS_PATH) return first;
  const landing = signInLanding(facts, null);
  if (landing.kind === 'choose') return landing.sides.map((s) => s.key);
  if (landing.kind === 'go') return landing.to;
  return 'wait';
};

const profileOf = (kind: SidesFacts['dancer']) => (kind === 'complete' || kind === 'incomplete' || kind === 'no_profile' ? kind : null);

describe.each(SHAPES)('$name', (shape) => {
  it('sign-in with no returnTo: straight to the one side, or the chooser', () => {
    const first = landingPathAfterAuth({ organiserSelfServe: true, role: null, isSignup: false });
    expect(afterCallback(first, shape.facts)).toEqual(shape.signIn);
  });

  it('sign-in as an account whose metadata says organiser still gets the chooser (sign-in, not sign-up)', () => {
    const first = landingPathAfterAuth({ organiserSelfServe: true, role: 'organiser', isSignup: false });
    expect(afterCallback(first, shape.facts)).toEqual(shape.signIn);
  });

  it('sign-in with an explicit returnTo: always there, never the chooser', () => {
    expect(signInLanding(shape.facts, '/event/abc')).toEqual({ kind: 'go', to: '/event/abc' });
  });

  it('sign-up as a dancer', () => {
    const first = landingPathAfterAuth({ organiserSelfServe: true, role: 'dancer', isSignup: true });
    expect(afterCallback(first, shape.facts)).toEqual(shape.signUpDancer);
  });

  it('sign-up as an organiser: the organiser onboarding, exactly as before', () => {
    expect(landingPathAfterAuth({ organiserSelfServe: true, role: 'organiser', isSignup: true })).toBe(ORGANISER_HOME_PATH);
  });

  it('each chooser button goes to its own side', () => {
    const state = profileSides(shape.facts);
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    for (const side of state.sides) {
      if (side.kind === 'dancer') {
        const want = shape.facts.areaAllowed ? (shape.facts.dancer === 'incomplete' ? APP_WELCOME_PATH : APP_HOME_PATH) : DANCER_HOME_PATH;
        expect(side.to).toBe(want);
      } else {
        const many = state.sides.filter((s) => s.kind === 'organiser').length > 1;
        expect(side.to).toBe(many ? `${ORGANISER_HOME_PATH}?o=${side.organiserId}` : ORGANISER_HOME_PATH);
      }
    }
    // Organisers are the priority: always listed first.
    const kinds = state.sides.map((s) => s.kind);
    expect(kinds).toEqual([...kinds].sort((a, b) => (a === b ? 0 : a === 'organiser' ? -1 : 1)));
  });

  it('the switcher in /app ticks the dancer side and lists only the real sides', () => {
    const state = profileSides(shape.facts);
    if (state.status !== 'ready') throw new Error('not ready');
    const items = switcherItems(state.sides, { area: 'dancer' });
    expect(items.map((i) => i.key)).toEqual(state.sides.map((s) => s.key));
    expect(items.filter((i) => i.current).map((i) => i.key)).toEqual(shape.tickInApp ? [shape.tickInApp] : []);
  });

  it('the switcher in the organiser area ticks the organiser side', () => {
    const state = profileSides(shape.facts);
    if (state.status !== 'ready') throw new Error('not ready');
    const items = switcherItems(state.sides, { area: 'organiser', organiserId: 'org-b' });
    expect(items.filter((i) => i.current).map((i) => i.key)).toEqual(shape.tickInOrganiser ? [shape.tickInOrganiser] : []);
  });

  it('the old /account/dancer URL', () => {
    expect(
      oldDancerHomeRedirect({
        view: 'dancer',
        allowed: shape.facts.areaAllowed === true,
        legacyParams: false,
        organiserCount: (shape.facts.organisers ?? []).length,
        openRequestCount: shape.openRequestCount,
        profile: profileOf(shape.facts.dancer),
      }),
    ).toBe(shape.oldDancerHome);
  });
});

describe('the chooser never appears for a single-side person', () => {
  it.each(SHAPES)('$name', (shape) => {
    const state = profileSides(shape.facts);
    if (state.status !== 'ready') throw new Error('not ready');
    const landing = signInLanding(shape.facts, null);
    expect(landing.kind === 'choose').toBe(state.sides.length >= 2);
  });
});

describe('loading and failed reads', () => {
  it('waits while any read is loading', () => {
    expect(signInLanding(dancerFacts('complete', { organisers: undefined }), null)).toEqual({ kind: 'wait' });
    expect(signInLanding(dancerFacts('loading'), null)).toEqual({ kind: 'wait' });
    expect(signInLanding(dancerFacts('complete', { areaAllowed: undefined }), null)).toEqual({ kind: 'wait' });
  });
  it('a failed read cannot prove the sides: today\'s /account decides (it has the error card)', () => {
    expect(signInLanding(dancerFacts('complete', { organisers: null }), null)).toEqual({ kind: 'go', to: '/account' });
    expect(signInLanding(dancerFacts('unknown'), null)).toEqual({ kind: 'go', to: '/account' });
  });
  it('the app paths are the dancer app\'s own', () => {
    expect(APP_HOME_PATH).toBe(DANCER_HOME);
    expect(APP_WELCOME_PATH).toBe(DANCER_WELCOME);
  });
});
