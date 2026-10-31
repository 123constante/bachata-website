import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORGANISER_HOME_PATH, profileSides, signInLanding, type SidesFacts } from '@/lib/accountRouting';
import { P3_START_PATH, continueAsLanding, organiserHomeHandoff } from '@/lib/auth-otp-routing';
import { legacyAccountPath } from '@/modules/organiser/shell/legacyPaths';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { P3_PATHS } from '@/modules/organiser/p3/shell/paths';
import {
  LEGACY_UNTIL,
  isOrganiserAreaPath,
  legacyAreaHref,
  organiserAreaHome,
  r1AreaRedirect,
  r1ToP3Path,
  type OrganiserAreaFlags,
} from '@/lib/organiserAreaHome';

// Brief p3-landing (FLIP-READINESS F-01..F-06; owner decision 1, option (c), 2026-10-31): while P3
// is live every organiser door opens P3; /account/o/* redirects to the P3 screen doing the same job,
// with ?legacy=1 honoured before LEGACY_UNTIL. With the flag OFF every answer is byte-identical to
// before. Entry point x flag (off / on) x person type -> where the person lands.

const OFF: OrganiserAreaFlags = { organiserP3: false, organiserSelfServe: true };
const ON: OrganiserAreaFlags = { organiserP3: true, organiserSelfServe: true };
const P3_ONLY: OrganiserAreaFlags = { organiserP3: true, organiserSelfServe: false };
const R1 = '/account/o';
const P3 = '/account/p3';
const TODAY = '2026-11-01';
const AFTER = LEGACY_UNTIL;

const page = (id: string) => ({ id, name: `Page ${id}`, avatar_url: null });
type Person = { name: string; organisers: SidesFacts['organisers']; dancer: SidesFacts['dancer'] };
// A helper/member reaches a page through entity_members; organiser_home_v1 returns it exactly as a
// claimed page, so its row is the 1-page shape with a page id of its own.
const PEOPLE: Person[] = [
  { name: '0 pages', organisers: [], dancer: 'complete' },
  { name: '1 page', organisers: [page('a')], dancer: 'no_profile' },
  { name: '2 pages', organisers: [page('a'), page('b')], dancer: 'no_profile' },
  { name: 'helper/member', organisers: [page('m')], dancer: 'no_profile' },
];
const facts = (p: Person, f: OrganiserAreaFlags): SidesFacts => ({
  organisers: p.organisers,
  dancer: p.dancer,
  areaAllowed: true,
  organiserIntent: false,
  openRequestCount: 0,
  isAdmin: false,
  deletion: null,
  organiserHomeTo: organiserAreaHome(f),
});

describe('paths restated in lib/organiserAreaHome match the areas', () => {
  it('P3 and R1 homes', () => {
    expect(organiserAreaHome(ON)).toBe(P3_PATHS.home);
    expect(organiserAreaHome(OFF)).toBe(ORG_PATHS.home);
    expect(organiserAreaHome(OFF)).toBe(ORGANISER_HOME_PATH);
  });
});

describe('organiserAreaHome: flag x page choice', () => {
  it.each([
    [OFF, null, R1],
    [OFF, 'a', `${R1}?o=a`],
    [ON, null, P3],
    [ON, 'a b', `${P3}?o=a%20b`],
    [P3_ONLY, null, R1], // P3 routes mount only with self-serve on too
  ] as const)('%o / %s -> %s', (f, id, want) => expect(organiserAreaHome(f, id)).toBe(want));
});

describe('sign-in (/account/continue) and the switcher: person x flag', () => {
  const EXPECTED: Record<string, [unknown, unknown]> = {
    '0 pages': [{ kind: 'go', to: '/app/home' }, { kind: 'go', to: '/app/home' }],
    '1 page': [{ kind: 'go', to: R1 }, { kind: 'go', to: P3 }],
    '2 pages': ['choose', 'choose'],
    'helper/member': [{ kind: 'go', to: R1 }, { kind: 'go', to: P3 }],
  };
  for (const p of PEOPLE) {
    for (const [i, f] of [OFF, ON].entries()) {
      it(`${p.name} | P3 ${i ? 'on' : 'off'}`, () => {
        const l = continueAsLanding(facts(p, f), i === 1);
        expect(l.kind === 'choose' ? 'choose' : l).toEqual(EXPECTED[p.name][i]);
      });
    }
  }
  it('2 pages: each side carries ?o= into the live area', () => {
    for (const [f, base] of [[OFF, R1], [ON, P3]] as const) {
      const s = profileSides(facts(PEOPLE[2], f));
      expect(s.status === 'ready' && s.sides.filter((x) => x.kind === 'organiser').map((x) => x.to)).toEqual([`${base}?o=a`, `${base}?o=b`]);
    }
  });
  it('flag off without the fact is byte-identical to before (absent = /account/o)', () => {
    const { organiserHomeTo: _drop, ...old } = facts(PEOPLE[1], OFF);
    expect(signInLanding(old, null)).toEqual({ kind: 'go', to: R1 });
  });
});

describe('/account/o/* -> P3 (F-02, F-03): every R1 path x flag', () => {
  const ROWS: Array<[string, string, string | null]> = [
    // [R1 path + query, P3 target with the flag on, ...] -- flag off always null (R1 renders)
    ['/account/o', P3, null],
    ['/account/o?o=a', `${P3}?o=a`, null],
    ['/account/o/events', `${P3}/events`, null],
    ['/account/o/events/s1', `${P3}/events/s1`, null],
    ['/account/o/events/s1/details', `${P3}/events/s1/details`, null],
    ['/account/o/events/s1/organisers', `${P3}/events/s1/organisers`, null],
    ['/account/o/events/s1/programme', `${P3}/events/s1`, null],
    ['/account/o/events/s1/dates/d1', `${P3}/events/s1`, null],
    ['/account/o/events/new', `${P3}/create`, null],
    ['/account/o/new/what?o=a', `${P3}/create?o=a`, null],
    ['/account/o/new/s1/venue', `${P3}/create`, null],
    ['/account/o/change/s1/d1/time', `${P3}/events/s1`, null],
    ['/account/o/change', `${P3}/events`, null],
    ['/account/o/add/s1', `${P3}/events/s1`, null],
    ['/account/o/cancel/s1/d1', `${P3}/events/s1`, null],
    ['/account/o/cover/s1', `${P3}/events/s1`, null],
    ['/account/o/team?o=a', `${P3}/you/team?o=a`, null],
    ['/account/o/team/add?q=Ann', `${P3}/you/team/add?q=Ann`, null],
    ['/account/o/team/u1', `${P3}/you/team/u1`, null],
    ['/account/o/handover/u1', `${P3}/you/handover/u1`, null],
    ['/account/o/page', `${P3}/you/page`, null],
    ['/account/o/profile', `${P3}/you/page`, null],
    ['/account/o/switch', `${P3}/you/switch`, null],
    ['/account/o/welcome?o=a', `${P3}/you/welcome?o=a`, null],
    ['/account/o/go-live?o=a', `${P3}/start?o=a`, null],
    ['/account/o/more/help', P3, null],
    ['/account/o/done#x', `${P3}#x`, null],
  ];
  it.each(ROWS)('%s', (url, on) => {
    const [pathname, search = ''] = url.split('#')[0].split('?');
    const hash = url.includes('#') ? `#${url.split('#')[1]}` : '';
    const loc = { pathname, search: search ? `?${search}` : '', hash };
    expect(r1AreaRedirect(OFF, loc, TODAY, false)).toBeNull();
    expect(r1AreaRedirect(P3_ONLY, loc, TODAY, false)).toBeNull();
    expect(r1AreaRedirect(ON, loc, TODAY, false)).toBe(on);
  });
  it('the profile wizard stays in R1 (P3 profile-lock link target, F-06)', () => {
    expect(r1AreaRedirect(ON, { pathname: '/account/o/complete', search: '', hash: '' }, TODAY, false)).toBeNull();
  });
  it('not an R1 path -> null', () => expect(r1ToP3Path('/account/other', '', '')).toBeNull());
});

describe('?legacy=1: honoured before LEGACY_UNTIL only', () => {
  const at = (search: string) => ({ pathname: '/account/o/events/s1', search, hash: '' });
  it.each([
    ['?legacy=1', TODAY, false, null],
    ['', TODAY, true, null], // chosen earlier in this tab
    ['?legacy=1', AFTER, false, `${P3}/events/s1`],
    ['', AFTER, true, `${P3}/events/s1`],
    ['?legacy=0', TODAY, false, `${P3}/events/s1`],
    ['?legacy=1&o=a', AFTER, false, `${P3}/events/s1?o=a`], // legacy dropped from the P3 URL
  ] as const)('%s on %s sticky=%s -> %s', (search, today, sticky, want) => {
    expect(r1AreaRedirect(ON, at(search), today, sticky)).toBe(want);
  });
  it('the dated fallback link exists only while the window is open', () => {
    expect(legacyAreaHref('2026-11-07')).toBe(`${R1}?legacy=1`);
    expect(legacyAreaHref(AFTER)).toBeNull();
  });
});

describe('old /account links (LegacyAccountRedirect) -> R1 -> P3: flag x target', () => {
  const chain = (f: OrganiserAreaFlags, target: Parameters<typeof legacyAccountPath>[0], params: Parameters<typeof legacyAccountPath>[1], search = '') => {
    const r1 = legacyAccountPath(target, params, search, '');
    const [pathname, q = ''] = r1.split('?');
    return r1AreaRedirect(f, { pathname, search: q ? `?${q}` : '', hash: '' }, TODAY, false) ?? r1;
  };
  it.each([
    ['home', {}, '?o=a', `${R1}?o=a`, `${P3}?o=a`],
    ['new', {}, '', `${R1}/new/what`, `${P3}/create`],
    ['series', { seriesId: 's1' }, '', `${R1}/events/s1`, `${P3}/events/s1`],
    ['team', { organiserId: 'a' }, '', `${R1}/team?o=a`, `${P3}/you/team?o=a`],
  ] as const)('%s', (target, params, search, off, on) => {
    expect(chain(OFF, target, params, search)).toBe(off);
    expect(chain(ON, target, params, search)).toBe(on);
  });
});

describe('isOrganiserAreaPath', () => {
  it.each([[R1, true], [`${R1}/x?o=1`, true], [P3, true], [`${P3}/events`, true], ['/account/opt', false], ['/app/home', false]] as const)('%s', (p, want) =>
    expect(isOrganiserAreaPath(p)).toBe(want));
});

// The first-load doors read accountRouting's ORGANISER_AREA_HOME_PATH, a build-time constant over the two
// Vite env vars (no featureFlags import, no helper: zero first-load bytes). Pin it, for every env
// combination, to what featureFlags' `flags` says and to the lazy helper organiserAreaHome(flags).
describe('ORGANISER_AREA_HOME_PATH equals organiserAreaHome(flags) for every env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it.each([
    ['true', 'true'], ['true', 'false'], ['false', 'true'], ['false', 'false'], ['', 'true'], ['TRUE', 'true'], ['1', 'true'],
  ] as const)('P3=%j SELF_SERVE=%j', async (p3, ss) => {
    vi.stubEnv('VITE_ENABLE_ORGANISER_P3', p3);
    vi.stubEnv('VITE_ENABLE_ORGANISER_SELF_SERVE', ss);
    vi.resetModules();
    const [{ flags }, ar] = await Promise.all([import('@/lib/featureFlags'), import('@/lib/accountRouting')]);
    expect(ar.ORGANISER_AREA_HOME_PATH).toBe(organiserAreaHome(flags));
    expect(ar.ORGANISER_AREA_HOME_PATH).toBe(p3 === 'true' && ss === 'true' ? P3_PATHS.home : ORG_PATHS.home);
  });
});

// Module-level entry points read the env at import: load each with the env stubbed off / on.
describe('door constants and the claim landing: flag x person', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const load = async (f: OrganiserAreaFlags) => {
    vi.stubEnv('VITE_ENABLE_ORGANISER_P3', String(f.organiserP3));
    vi.stubEnv('VITE_ENABLE_ORGANISER_SELF_SERVE', String(f.organiserSelfServe));
    vi.resetModules();
    const [options, areas, claim] = await Promise.all([
      import('@/modules/dancer-app/screens/options/optionsModel'),
      import('@/modules/areas/home/areaStatus'),
      import('@/lib/claimSignInLanding'),
    ]);
    return { options, areas, claim };
  };
  for (const [f, base] of [[OFF, R1], [ON, P3]] as const) {
    const label = f.organiserP3 ? 'on' : 'off';
    it(`Options / Your areas organiser rows | P3 ${label}`, async () => {
      const m = await load(f);
      // The dancer app's Options row stays /account/o (dancer-area isolation: this PR touches no dancer-app file);
      // while P3 is live OrganiserRoutes redirects it to P3 Home -- one more hop through the lazy chunk.
      expect(m.options.ORGANISER_AREA_PATH).toBe(R1);
      expect(r1AreaRedirect(f, { pathname: m.options.ORGANISER_AREA_PATH, search: '', hash: '' }, TODAY, false) ?? R1).toBe(base);
      expect(m.areas.AREA_HREF.organiser).toBe(base);
    });
    it(`claimed-by-me sign-in lands on the area Home, toast only elsewhere | P3 ${label}`, async () => {
      const m = await load(f);
      const claimed = [{ id: 'a', name: 'A' }] as never;
      expect(m.claim.claimLandingPath([], true)).toBeNull();
      expect(m.claim.claimLandingPath(claimed, true)).toBe(base);
      expect(m.claim.shouldToastClaim(claimed, false, `${base}?o=a`)).toBe(false);
      expect(m.claim.shouldToastClaim(claimed, false, '/event/1')).toBe(true);
    });
  }
});

// Handover item 2 (r2 confirm): organiserHomeHandoff keeps its `organiserCount === 0` guard. While P3 is
// live the only way to RENDER R1 Home is ?legacy=1 (r1AreaRedirect -> null); then a page holder stays in the
// old area they asked for, and a person with no page still goes to P3's Welcome (R1 has nothing for them).
// A home read not in yet / failed stays put (R1's own loading / retry), as before.
describe('?legacy=1 into R1 Home while P3 is live: the handoff guard', () => {
  const r1Home = (count: number | null | undefined) => {
    const toP3 = r1AreaRedirect(ON, { pathname: R1, search: '?legacy=1', hash: '' }, TODAY, false);
    if (toP3) return toP3;
    return organiserHomeHandoff(true, count) ?? R1;
  };
  it.each([
    [0, P3_START_PATH],
    [1, R1],
    [2, R1],
    [undefined, R1],
    [null, R1],
  ] as const)('%s page(s) -> %s', (count, want) => expect(r1Home(count)).toBe(want));
  it('without ?legacy=1 nobody reaches R1 Home: every count goes to P3 Home first', () => {
    for (const n of [0, 1, 2]) expect(r1AreaRedirect(ON, { pathname: R1, search: '', hash: '' }, TODAY, false) ?? organiserHomeHandoff(true, n)).toBe(P3);
  });
});
