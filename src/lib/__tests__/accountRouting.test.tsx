// @vitest-environment jsdom
/**
 * Where the signed-in account icon goes: ONE mapping (lib/accountRouting).
 * The icon always opens /account; /account asks accountHome() and either shows
 * the dancer home or replaces itself with the organiser home. Before
 * 2026-10-11 the icon went straight to /account/o, the organiser area, for
 * everyone -- a dancer landed on organiser onboarding.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ value: { user: { id: 'me' } as unknown, isLoading: false, authStatus: 'ready' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
const flags = vi.hoisted(() => ({ organiserSelfServe: true, searchV5: true, rafflesPage: false }));
vi.mock('@/lib/featureFlags', () => ({ flags }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/components/search/HeaderSearch', () => ({ HeaderSearch: () => null }));
vi.mock('@/components/search/SearchTrigger', () => ({ SearchTrigger: () => null }));

import { GlobalHeader } from '@/components/GlobalHeader';
import {
  ACCOUNT_HOME_PATH,
  DANCER_HOME_PATH,
  ORGANISER_HOME_PATH,
  accountHome,
  accountView,
  dancerGate,
  isDancerGatedPath,
  type DancerFactKind,
  type DancerGateStatus,
  isAccountPath,
  isLegacyAccountLink,
  type AccountFacts,
  type AccountHome,
} from '@/lib/accountRouting';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import { finishProfileHref, isGatedFinish } from '@/lib/profileCompletion';

beforeEach(() => {
  auth.value = { user: { id: 'me' }, isLoading: false, authStatus: 'ready' };
});
afterEach(cleanup);

const F = (o: Partial<AccountFacts>): AccountFacts => ({ legacyParams: false, organiserCount: 0, openRequestCount: 0, ...o });

describe.each([
  ['no organiser, no request (a dancer)', F({}), 'dancer'],
  ['one organiser', F({ organiserCount: 1 }), 'organiser'],
  ['three organisers', F({ organiserCount: 3 }), 'organiser'],
  ['no organiser, an open access request', F({ openRequestCount: 1 }), 'organiser'],
  ['organiser read still loading', F({ organiserCount: undefined }), 'loading'],
  ['request read still loading, no organiser', F({ openRequestCount: undefined }), 'loading'],
  ['request read still loading, has organisers: no wait', F({ organiserCount: 2, openRequestCount: undefined }), 'organiser'],
  ['organiser read failed: cannot prove organiser', F({ organiserCount: null }), 'dancer'],
  ['request read failed, has an organiser', F({ organiserCount: 2, openRequestCount: null }), 'organiser'],
  ['old /account link with a query, still loading', F({ legacyParams: true, organiserCount: undefined }), 'organiser'],
] as [string, AccountFacts, AccountHome][])('accountHome: %s', (_name, facts, want) => {
  it(`-> ${want}`, () => expect(accountHome(facts)).toBe(want));
});

// Layout D (owner decision 2026-10-11), for a person past the dancer gate.
describe.each([
  // organisers, open requests, dancer fact -> landing, menu entry
  [0, 0, 'complete', 'dancer', false],
  [1, 0, 'complete', 'organiser', true],
  [2, 0, 'unknown', 'organiser', false],
  [0, 1, 'complete', 'organiser', true],
  [0, 1, 'incomplete', 'organiser', false],
] as [number, number, DancerFactKind, AccountHome, boolean][])(
  'accountView(organisers %i, open requests %i, dancer %s)',
  (organiserCount, openRequestCount, dancer, landing, menuDancerEntry) => {
    it(`-> ${landing}, menu entry ${menuDancerEntry}`, () => {
      expect(accountView({ organiserCount, openRequestCount, dancer })).toEqual({ landing, menuDancerEntry });
    });
  },
);

// The dancer-first hard gate (owner decision 2026-10-11, supersedes #718's skippable row).
describe.each([
  ['complete', 'pass'],
  ['incomplete', 'finish'],
  // No row, or an archived one (never resolves): no live dancer profile -> gated.
  ['no_profile', 'finish'],
  // A failed check proves nothing: fail open, the server refuses the organiser writes.
  ['error', 'pass'],
  ['loading', 'wait'],
  // AuthGuard decides signed in or not (an anonymous session reads signed_out here).
  ['signed_out', 'pass'],
] as [DancerGateStatus, string][])('dancerGate(%s)', (status, want) => {
  it(`-> ${want}`, () => expect(dancerGate(status)).toBe(want));
});

describe('the gated Finish link', () => {
  it.each([
    ['/account', true],
    ['/account/dancer', true],
    ['/account/attendance', true],
    ['/account/o', true],
    ['/account/o/events/s1?x=1', true],
    ['/event/ev1#level-rating', false],
    ['/parties', false],
    ['/organisers/o1', false],
  ])('finishProfileHref(%s) gated = %s, returnTo kept', (returnTo, gated) => {
    const href = new URL(finishProfileHref(returnTo), 'https://x.test');
    expect(isGatedFinish(href.searchParams)).toBe(gated);
    expect(href.searchParams.get('returnTo')).toBe(returnTo);
  });

  it('an organiser claim refused on a public page is gated on request', () => {
    const href = new URL(finishProfileHref('/organisers/o1', { gate: true }), 'https://x.test');
    expect(isGatedFinish(href.searchParams)).toBe(true);
  });

  it('a link from the rating card keeps its old form exactly', () => {
    expect(finishProfileHref('/event/ev1#level-rating')).toBe(`/finish-profile?returnTo=${encodeURIComponent('/event/ev1#level-rating')}`);
  });

  it('only account pages are gated; public pages and the Finish screen never are', () => {
    for (const p of ['/', '/parties', '/event/x', '/finish-profile', '/auth', '/organisers/o1', '/accounts']) expect(isDancerGatedPath(p), p).toBe(false);
  });

  it('every sign-in landing that reaches the organiser area is a gated page (organiser intent included)', () => {
    for (const role of ['organiser', 'teacher', 'dj', null]) {
      for (const managesOrganiser of [true, false, null]) {
        const landing = landingPathAfterAuth({ organiserSelfServe: true, role, managesOrganiser });
        if (landing.startsWith(ORGANISER_HOME_PATH) || landing === ACCOUNT_HOME_PATH) {
          expect(isDancerGatedPath(landing), `${role}/${managesOrganiser}`).toBe(true);
          expect(isGatedFinish(new URL(finishProfileHref(landing), 'https://x.test').searchParams)).toBe(true);
        }
      }
    }
    expect(landingPathAfterAuth({ organiserSelfServe: true, role: 'organiser', managesOrganiser: null })).toBe(ORGANISER_HOME_PATH);
  });
});

describe.each([
  ['', '', false],
  ['?', '#', false],
  ['?utm_source=whatsapp&utm_medium=social', '', false],
  ['?fbclid=x', '', false],
  ['?gclid=x&mc_cid=y', '', false],
  ['?igsh=abc123', '', false],
  ['?si=xyz&srsltid=q', '', false],
  ['?from=email', '', true],
  ['?add=1', '', true],
  ['?o=org-1', '', true],
  ['?utm_source=x&from=email', '', true],
  ['?claim=1', '#top', true],
  ['', '#top', false],
  ['', '#main-content', false],
])('isLegacyAccountLink(%j, %j)', (search, hash, want) => {
  it(`-> ${want}`, () => expect(isLegacyAccountLink(search, hash)).toBe(want));
});

describe('paths', () => {
  it('ORGANISER_HOME_PATH is the organiser area Home (not a second copy that can drift)', () => {
    expect(ORGANISER_HOME_PATH).toBe(ORG_PATHS.home);
  });

  it('the sign-in landing: a known organiser goes straight home, an unknown one through /account', () => {
    expect(landingPathAfterAuth({ organiserSelfServe: true, role: null, managesOrganiser: true })).toBe(ORGANISER_HOME_PATH);
    expect(landingPathAfterAuth({ organiserSelfServe: true, role: null, managesOrganiser: null })).toBe(ACCOUNT_HOME_PATH);
  });

  it.each([
    ['/account', true],
    ['/account/attendance', true],
    [DANCER_HOME_PATH, true],
    ['/account/o', true],
    ['/account/o/events', true],
    ['/accounts', false],
    ['/event/x', false],
  ])('isAccountPath(%s) = %s', (p, want) => expect(isAccountPath(p)).toBe(want));
});

describe('the header account icon', () => {
  const icon = () => screen.queryByTestId('header-account-link');
  const mount = (at: string) => render(<MemoryRouter initialEntries={[at]}><GlobalHeader /></MemoryRouter>);

  it('opens /account, where the one mapping decides', () => {
    mount('/event/abc');
    expect(icon()?.getAttribute('href')).toBe(ACCOUNT_HOME_PATH);
  });

  it.each(['/account', '/account/attendance', '/account/o', '/account/o/team'])('is lit on %s', (at) => {
    mount(at);
    expect(icon()?.className).toContain('text-primary');
  });

  it('is not lit elsewhere', () => {
    mount('/parties');
    expect(icon()?.className).not.toContain('text-primary bg-primary/10');
  });

  it('is absent signed out', () => {
    auth.value = { user: null, isLoading: false, authStatus: 'ready' };
    mount('/');
    expect(icon()).toBeNull();
  });
});
