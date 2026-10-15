import { describe, expect, it } from 'vitest';
import {
  APP_WELCOME_PATH,
  hasOrganiserIntent,
  isDancerGatedTarget,
  oldDancerHomeRedirect,
  onboardingEnd,
  onboardingEndLabel,
  onwardReturnTo,
  profileSides,
  signInLanding,
  type SidesFacts,
} from '@/lib/accountRouting';
import { sanitizeReturnTo } from '@/lib/authRouting';
import { landingPathAfterAuth, normalizeLandingRole, shouldHonorReturnTo, SIGNED_IN_LANDING_PATH } from '@/lib/auth-otp-routing';
import { finishProfileHref } from '@/lib/profileCompletion';
import { photoHandoff } from '@/modules/dancer-app/screens/onboarding/steps';
import { returnPathFor } from '@/modules/dancer-app/screens/photo/photoScreenDeps';
import { JOURNEYS, type Journey, type Person } from './publicEntryJourneys';

/**
 * Every public entry journey, driven hop by hop through the SAME functions the
 * pages call (no second copy of any routing decision):
 *   /auth (+ code or e-mailed link) -> AuthCallback.routeOnwards
 *   -> /account/continue (signInLanding) -> the dancer gate (finishProfileHref)
 *   -> /finish-profile (oldDancerHomeRedirect) -> /app/welcome -> the photo
 *   screen and back (photoHandoff / returnPathFor) -> the onboarding's end
 *   (onboardingEnd). Organiser self-serve is on (prod).
 * The production-build walk of the same rows is tests/e2e-build/public-journeys.build.spec.ts.
 */

type Walk = { end: string; trail: string[] };

const u = (path: string) => new URL(path, 'https://site.test');
const pathOf = (path: string) => u(path).pathname;

/** What AuthCallback.routeOnwards picks after the code (or the e-mailed link) for this entry. */
const afterAuth = (entry: string, person: Person, mode: 'signup' | 'signin' | undefined): string => {
  const q = u(entry).searchParams;
  const returnTo = sanitizeReturnTo(q.get('returnTo'));
  // A signed-in visitor on /auth goes straight on (Auth.tsx): the link's returnTo, else the landing.
  if (person.signedIn) return returnTo ?? SIGNED_IN_LANDING_PATH;
  const isSignupFlow = mode === 'signup';
  if (returnTo && shouldHonorReturnTo({ returnTo, isSignupFlow, organiserSelfServe: true })) return returnTo;
  const role = normalizeLandingRole(isSignupFlow ? q.get('userType') : person.userType);
  return landingPathAfterAuth({ organiserSelfServe: true, role, isSignup: isSignupFlow });
};

const sidesFacts = (s: Person): SidesFacts => ({
  organisers: Array.from({ length: s.organisers }, (_, i) => ({ id: `o${i}`, name: `Org ${i}`, avatar_url: null })),
  dancer: s.dancer === 'none' ? 'no_profile' : s.dancer,
  areaAllowed: true,
  organiserIntent: hasOrganiserIntent(s.userType),
  openRequestCount: s.openRequests ?? 0,
});

const walk = (row: Journey): Walk => {
  const st: Person = { ...row.person };
  let midway = row.midway;
  let path = afterAuth(row.entry, st, row.auth);
  if (midway === 'expired-link') {
    // AuthCallback bounces an expired link to /auth?mode=signin&callbackError=expired&returnTo=<kept>; they sign in from there.
    const kept = sanitizeReturnTo(u(row.entry).searchParams.get('returnTo'));
    const notice = `/auth?mode=signin&callbackError=expired${kept ? `&returnTo=${encodeURIComponent(kept)}` : ''}`;
    path = afterAuth(notice, st, 'signin');
    midway = undefined;
  }
  const trail = [path];
  for (let hop = 0; hop < 20; hop += 1) {
    const at = u(path);
    const p = at.pathname;
    let next: string | null = null;
    if (p === SIGNED_IN_LANDING_PATH) {
      const landing = signInLanding(sidesFacts(st), null);
      if (landing.kind === 'wait') throw new Error('sides never load');
      if (landing.kind === 'choose') return { end: path, trail };
      next = landing.to;
    } else if (st.dancer !== 'complete' && isDancerGatedTarget(`${p}${at.search}`)) {
      next = finishProfileHref(`${p}${at.search}`);
    } else if (p === '/finish-profile') {
      next = oldDancerHomeRedirect({
        view: 'finish',
        allowed: true,
        legacyParams: false,
        organiserCount: st.organisers,
        openRequestCount: 0,
        profile: st.dancer === 'none' ? 'no_profile' : st.dancer,
        returnTo: at.searchParams.get('returnTo'),
      });
      if (next === null) return { end: path, trail };
    } else if (p === APP_WELCOME_PATH) {
      const returnTo = at.searchParams.get('returnTo');
      if (st.dancer !== 'complete') {
        if (midway === 'reload') {
          // A reload re-reads the same URL: nothing but the URL carries the destination.
          midway = undefined;
          next = path;
        } else if (midway === 'closed-tab-then-sign-in') {
          // The URL is gone. They sign in from the header later: no returnTo at all.
          midway = undefined;
          next = afterAuth('/auth?mode=signin', st, 'signin');
        } else {
          // Name, city, role, then the photo hand-off and back; the photo finishes the required part.
          const handoff = u(photoHandoff(returnTo));
          next = returnPathFor(handoff.searchParams.get('return'));
          st.dancer = 'complete';
        }
      } else if (midway === 'closed-tab-after-required') {
        // Required cards done, the tab closed on "You're in" (review F2). They sign in from the header later.
        midway = undefined;
        next = afterAuth('/auth?mode=signin', st, 'signin');
      } else {
        // The 'in' card (or the optional cards, then 'nice'): its end button.
        next = onboardingEnd(returnTo);
      }
    } else {
      return { end: path, trail };
    }
    path = next;
    trail.push(path);
  }
  throw new Error(`no end after 20 hops: ${trail.join(' -> ')}`);
};

describe('public entry journeys: every row ends on its END screen (routing model)', () => {
  it.each(JOURNEYS.map((j) => [j.id, j] as const))('%s', (_id, row) => {
    const { end, trail } = walk(row);
    expect({ end: row.end.path.includes('?') ? end : pathOf(end), trail }).toEqual({ end: row.end.path, trail });
  });

  it('organiser intent rides every onboarding hop (no /app/welcome without returnTo=/account/o)', () => {
    for (const row of JOURNEYS.filter((j) => j.end.path === '/account/o' && j.person.dancer === 'incomplete')) {
      const welcomes = walk(row).trail.filter((t) => pathOf(t) === APP_WELCOME_PATH);
      expect(welcomes.length, row.id).toBeGreaterThan(0);
      for (const w of welcomes) expect(u(w).searchParams.get('returnTo'), `${row.id}: ${w}`).toBe('/account/o');
    }
  });

  it("the gate's /finish-profile?returnTo=/account/o carries the destination into onboarding (owner's 2026-10-15 failure)", () => {
    const facts = { view: 'finish', allowed: true, legacyParams: false, organiserCount: 0, openRequestCount: 0, returnTo: '/account/o' } as const;
    expect(oldDancerHomeRedirect({ ...facts, profile: 'incomplete' })).toBe('/app/welcome?returnTo=%2Faccount%2Fo');
    expect(oldDancerHomeRedirect({ ...facts, profile: 'complete' })).toBe('/account/o');
  });

  it('the dancer link is unchanged: onboarding carries nothing and ends on Home', () => {
    const { trail } = walk(JOURNEYS.find((j) => j.id === 'dancer-link-new')!);
    expect(trail).toEqual(['/account/continue', '/app/welcome', '/app/welcome', '/app/home']);
  });
});

describe('onwardReturnTo: same-site relative paths only (no open redirect)', () => {
  it.each([
    ['/account/o', '/account/o'],
    ['/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0', '/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0'],
    ['/organisers/x?claim=1', '/organisers/x?claim=1'],
    ['https://evil.example/', null],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['/\t/evil.example', null],
    ['javascript:alert(1)', null],
    ['/auth?mode=signin', null],
    ['/%61uth', null],
    ['/app/welcome', null],
    ['/App/Welcome/', null],
    ['/finish-profile?returnTo=/account/o', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (raw, want) => {
    expect(onwardReturnTo(raw)).toBe(want);
    expect(onboardingEnd(raw)).toBe(want ?? '/app/home');
  });

  it('a hostile returnTo on the photo hand-off falls back to the plain onboarding', () => {
    expect(photoHandoff('https://evil.example/')).toBe('/app/me/photo?return=/app/welcome');
    expect(returnPathFor(u(photoHandoff('/account/o')).searchParams.get('return'))).toBe('/app/welcome?returnTo=%2Faccount%2Fo');
  });
});

describe('the end button names where it goes', () => {
  it.each([
    ['/app/home', 'Go to Home'],
    ['/account/o', 'Next: set up your organiser page'],
    ['/account/o?o=1', 'Next: set up your organiser page'],
    ['/invite/0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0', 'Next: join the team'],
    ['/organisers/x?claim=1', 'Continue'],
  ])('%s -> %s', (end, label) => {
    expect(onboardingEndLabel(end)).toBe(label);
  });
});

describe('organiser intent from the sign-up role', () => {
  it.each([
    ['organiser', true],
    ['Organiser ', true],
    ['teacher', true],
    ['dancer', false],
    ['', false],
    [undefined, false],
    [42, false],
  ])('%s -> %s', (raw, want) => {
    expect(hasOrganiserIntent(raw)).toBe(want);
  });

  // Review F2, option (b): a finished dancer who came by the organiser link and has not organised anything yet
  // lands on the claim screen at sign-in; everyone else is unchanged.
  const org = [{ id: 'o0', name: 'Org 0', avatar_url: null }];
  const finished = { dancer: 'complete', areaAllowed: true } as const;
  it.each([
    ['intent, no organiser, no open request -> the claim screen', { ...finished, organisers: [], organiserIntent: true, openRequestCount: 0 }, { kind: 'go', to: '/account/o' }],
    ['intent, closed dancer area -> still the claim screen', { ...finished, areaAllowed: false, organisers: [], organiserIntent: true, openRequestCount: 0 }, { kind: 'go', to: '/account/o' }],
    ['NO intent -> dancer Home (signin-dancer)', { ...finished, organisers: [], organiserIntent: false, openRequestCount: 0 }, { kind: 'go', to: '/app/home' }],
    ['intent, an open request -> dancer Home, not the claim screen', { ...finished, organisers: [], organiserIntent: true, openRequestCount: 1 }, { kind: 'go', to: '/app/home' }],
    ['intent, open requests still loading -> wait', { ...finished, organisers: [], organiserIntent: true, openRequestCount: undefined }, { kind: 'wait' }],
    ['intent, open requests read failed -> dancer Home', { ...finished, organisers: [], organiserIntent: true, openRequestCount: null }, { kind: 'go', to: '/app/home' }],
  ] as const)('one finished dancer side, %s', (_name, facts, want) => {
    expect(signInLanding(facts as SidesFacts, null)).toEqual(want);
  });

  it('intent, already runs an organiser -> "Continue as..." (signin-both), never the claim screen', () => {
    const landing = signInLanding({ ...finished, organisers: org, organiserIntent: true, openRequestCount: 0 }, null);
    expect(landing.kind).toBe('choose');
  });

  it("the dancer side's own button still opens the dancer app (the switcher's dancer entry)", () => {
    const state = profileSides({ ...finished, organisers: [], organiserIntent: true, openRequestCount: 0 });
    expect(state.status === 'ready' && state.sides.map((s) => s.to)).toEqual(['/app/home']);
  });
});
