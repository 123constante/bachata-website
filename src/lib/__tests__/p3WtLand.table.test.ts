import { describe, expect, it } from 'vitest';
import { continueAsLanding } from '@/lib/auth-otp-routing';
import type { SidesFacts } from '@/lib/accountRouting';
import { legacyAccountPath, type LegacyAccountTarget } from '@/modules/organiser/shell/legacyPaths';
import { acceptedInviteLanding } from '@/modules/organiser/p3/shell/paths';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { LEGACY_UNTIL, organiserAreaHome, r1AreaRedirect, r1LegacyPath, type OrganiserAreaFlags } from '@/lib/organiserAreaHome';
import { JOIN_COPY } from '@/modules/admin-organisers/join/joinCopy';

// Brief p3-wt-land (FIXLIST F-01..F-05, owner decision D1 = (c)): every entry point x person shape x
// legacy window (open / closed) x `?legacy=1` (asked / not) -> ONE destination. `land()` follows the
// app's own redirects through the shared mapping (lib/organiserAreaHome + legacyPaths), so a row can
// only pass if the real chain ends where the expected column says. P3 is live in prod: ON.

const ON: OrganiserAreaFlags = { organiserP3: true, organiserSelfServe: true };
const OFF: OrganiserAreaFlags = { organiserP3: false, organiserSelfServe: true };
const OPEN = '2026-11-01';
const CLOSED = LEGACY_UNTIL;
const P3 = '/account/p3';
const R1 = '/account/o';

/** Follow the redirect chain a URL meets in the app (AnimatedRoutes -> OrganiserRoutes -> R1 routes). */
const land = (url: string, f: OrganiserAreaFlags, today: string): string => {
  for (let hop = 0; hop < 5; hop++) {
    const [path, rest = ''] = url.split('#');
    const hash = url.includes('#') ? `#${rest}` : '';
    const [pathname, query = ''] = path.split('?');
    const search = query ? `?${query}` : '';
    const old = pathname.match(/^\/account\/(new|series|team)(?:\/([^/]+))?$/);
    if (pathname === '/account' && search) { url = legacyAccountPath('home', {}, search, hash); continue; }
    if (old) {
      const target = old[1] as LegacyAccountTarget;
      url = legacyAccountPath(target, target === 'team' ? { organiserId: old[2] } : { seriesId: old[2] }, search, hash);
      continue;
    }
    if (pathname === R1 || pathname.startsWith(`${R1}/`)) {
      const to = r1AreaRedirect(f, { pathname, search, hash }, today, false);
      if (to) { url = to; continue; }
      // R1 renders: an old R1-only URL shape still redirects inside R1 (OrganiserRoutes).
      const inside = r1LegacyPath(pathname, search, hash);
      if (inside && inside !== url) { url = inside; continue; }
    }
    return url;
  }
  throw new Error(`redirect loop at ${url}`);
};

describe('land(): every old link x window x ?legacy=1 (P3 live)', () => {
  // [entry point, url without legacy, P3 destination, R1 destination when the old area is kept]
  const ROWS: Array<[string, string, string, string]> = [
    ['/account/o (old Home)', R1, P3, R1],
    ['/account/o?o= (page pick)', `${R1}?o=a`, `${P3}?o=a`, `${R1}?o=a`],
    ['/account?o= (old email)', '/account?o=a', `${P3}?o=a`, `${R1}?o=a`],
    ['/account/new', '/account/new', `${P3}/create`, `${R1}/new/what`],
    ['/account/series/:id', '/account/series/s1', `${P3}/events/s1`, `${R1}/events/s1`],
    ['/account/team', '/account/team', `${P3}/you/team`, `${R1}/team`],
    ['/account/team/:org', '/account/team/a', `${P3}/you/team?o=a`, `${R1}/team?o=a`],
    ['/account/o/events/:id (event)', `${R1}/events/s1`, `${P3}/events/s1`, `${R1}/events/s1`],
    ['/account/o/series/:id (old event bookmark keeps the event)', `${R1}/series/s1`, `${P3}/events/s1`, `${R1}/events/s1`],
    ['/account/o/series/:id?o= keeps page and event', `${R1}/series/s1?o=a`, `${P3}/events/s1?o=a`, `${R1}/events/s1?o=a`],
    ['/account/o/new/what (New event)', `${R1}/new/what`, `${P3}/create`, `${R1}/new/what`],
    ['/account/o/team (Team)', `${R1}/team`, `${P3}/you/team`, `${R1}/team`],
  ];
  const withLegacy = (u: string) => `${u}${u.includes('?') ? '&' : '?'}legacy=1`;
  /** The kept old area carries `legacy=1` along (R1 reads it); compare the rest of the URL. */
  const dropLegacy = (u: string) => {
    const x = new URL(u, 'https://x');
    expect(x.searchParams.get('legacy')).toBe('1');
    x.searchParams.delete('legacy');
    return `${x.pathname}${x.search}${x.hash}`;
  };
  for (const [name, url, p3, r1] of ROWS) {
    it(`${name} | window open | no ?legacy -> P3`, () => expect(land(url, ON, OPEN)).toBe(p3));
    it(`${name} | window closed | no ?legacy -> P3`, () => expect(land(url, ON, CLOSED)).toBe(p3));
    it(`${name} | window closed | ?legacy=1 -> P3 (expired)`, () => expect(land(withLegacy(url), ON, CLOSED)).toBe(p3));
    it(`${name} | window open | ?legacy=1 -> old area`, () => expect(dropLegacy(land(withLegacy(url), ON, OPEN))).toBe(r1));
    it(`${name} | P3 off -> old area`, () => expect(land(url, OFF, OPEN)).toBe(r1));
  }
});

// Person shapes the shape survey found on prod (organiser_home_v1's organiser count, the predicate the
// app uses: entity_members owner/manager rows). Sign-in lands each in one place.
const pg = (id: string) => ({ id, name: id, avatar_url: null });
type Shape = { name: string; organisers: SidesFacts['organisers']; dancer: SidesFacts['dancer']; isAdmin: boolean };
const SHAPES: Shape[] = [
  { name: 'has 1 page, no dancer profile', organisers: [pg('a')], dancer: 'no_profile', isAdmin: false },
  { name: 'has 2 pages', organisers: [pg('a'), pg('b')], dancer: 'no_profile', isAdmin: false },
  { name: 'has a page and a dancer profile', organisers: [pg('a')], dancer: 'complete', isAdmin: false },
  { name: 'dancer only (no page)', organisers: [], dancer: 'complete', isAdmin: false },
  { name: 'no page, no dancer profile', organisers: [], dancer: 'no_profile', isAdmin: false },
  { name: 'admin, no page, no profile', organisers: [], dancer: 'no_profile', isAdmin: true },
];
const facts = (s: Shape, f: OrganiserAreaFlags): SidesFacts => ({
  organisers: s.organisers, dancer: s.dancer, areaAllowed: true, organiserIntent: false, openRequestCount: 0,
  isAdmin: s.isAdmin, deletion: null, organiserHomeTo: organiserAreaHome(f),
});
const SIGN_IN: Record<string, [unknown, unknown]> = {
  // [P3 on, P3 off]
  'has 1 page, no dancer profile': [P3, R1],
  'has 2 pages': [[`${P3}?o=a`, `${P3}?o=b`], [`${R1}?o=a`, `${R1}?o=b`]],
  'has a page and a dancer profile': [[P3, '/app/home'], [R1, '/app/home']],
  'dancer only (no page)': ['/app/home', '/app/home'],
  'no page, no dancer profile': ['/app/welcome', '/app/welcome'],
  'admin, no page, no profile': ['/', '/'],
};
describe('sign-in landing (/account/continue): person shape x P3', () => {
  for (const s of SHAPES) {
    for (const [i, f] of [ON, OFF].entries()) {
      it(`${s.name} | P3 ${i ? 'off' : 'on'}`, () => {
        const l = continueAsLanding(facts(s, f), f.organiserP3);
        const got = l.kind === 'go' ? l.to : l.kind === 'choose' ? l.sides.map((x) => x.to) : l.kind;
        expect(got).toEqual(SIGN_IN[s.name][i]);
      });
    }
  }
  it('people with a page never land in the old area while P3 is live (any window)', () => {
    for (const s of SHAPES.filter((x) => (x.organisers?.length ?? 0) > 0)) {
      const l = continueAsLanding(facts(s, ON), true);
      const tos = l.kind === 'go' ? [l.to] : l.kind === 'choose' ? l.sides.map((x) => x.to) : [];
      for (const to of tos) for (const today of [OPEN, CLOSED]) expect(land(to, ON, today).startsWith(R1)).toBe(false);
    }
  });
});

describe('F-04 / F-05: the "go" link after claim / invite / email code', () => {
  it('accepted invite (with a page id) lands on the new Home for that page while P3 is live', () => {
    expect(acceptedInviteLanding('org 1', ON)).toBe(`${P3}?o=org%201`);
  });
  it('P3 off keeps R1 Welcome, unchanged', () => {
    expect(acceptedInviteLanding('org 1', OFF)).toBe(`${R1}/welcome?o=org%201`);
  });
  it('the button words say Home and the link opens Home (one label, both flags)', () => {
    expect(JOIN_COPY.done.button).toBe('Open your organiser home');
    expect(new URL(acceptedInviteLanding('a', ON), 'https://x').pathname).toBe(P3);
  });
  it('email-code proof (default returnTo, pinned byte-for-byte by Door.test) still ends on P3 Home, any window', () => {
    for (const today of [OPEN, CLOSED]) expect(land(ORG_PATHS.home, ON, today)).toBe(P3);
  });
  it('invite without a page id and the claim card open the area Home', () => {
    expect(organiserAreaHome(ON)).toBe(P3);
    expect(organiserAreaHome(ON, 'a')).toBe(`${P3}?o=a`);
    expect(organiserAreaHome(OFF)).toBe(R1);
  });
});
