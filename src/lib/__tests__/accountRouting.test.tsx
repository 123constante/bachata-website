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
  isDancerGatedTarget,
  type DancerFactKind,
  type DancerGateStatus,
  isAccountPath,
  isLegacyAccountLink,
  type AccountFacts,
  type AccountHome,
} from '@/lib/accountRouting';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';

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

// Layout D (owner decision 2026-10-11): the person has roles, not either/or.
// No unfinished-profile row any more: the dancer-first gate keeps an unfinished profile out.
describe.each([
  // organisers, open requests, dancer fact -> landing, menu entry
  [0, 0, 'complete', 'dancer', false],
  [1, 0, 'complete', 'organiser', true],
  [2, 0, 'unknown', 'organiser', false],
  [0, 1, 'complete', 'organiser', true],
] as [number, number, DancerFactKind, AccountHome, boolean][])(
  'accountView(organisers %i, open requests %i, dancer %s)',
  (organiserCount, openRequestCount, dancer, landing, menuDancerEntry) => {
    it(`-> ${landing}, menu entry ${menuDancerEntry}`, () => {
      expect(accountView({ organiserCount, openRequestCount, dancer })).toEqual({ landing, menuDancerEntry });
    });
  },
);

// Dancer first, then organiser (owner decision 2026-10-11).
describe.each([
  ['complete', 'pass'],
  ['signed_out', 'pass'],
  ['loading', 'wait'],
  ['incomplete', 'gate'],
  ['no_profile', 'gate'],
  ['error', 'gate'],
] as [DancerGateStatus, string][])('dancerGate(%s)', (status, want) => {
  it(`-> ${want}`, () => expect(dancerGate(status)).toBe(want));
});

describe.each([
  ['/account', true],
  ['/account/', true],
  ['/account/dancer', true],
  ['/account/o', true],
  ['/account/o/events/new', true],
  ['/account/o/team', true],
  ['/account/new', true],
  ['/account/series/s1', true],
  ['/account/team/o1', true],
  ['/Account/O', true],
  ['/invite', true],
  ['/invite/abc', true],
  ['/account/attendance', false],
  ['/account/settings', false],
  ['/account/settings/ownership', false],
  ['/account/settings/delete', false],
  ['/account/deleted', false],
  ['/', false],
  ['/event/e1', false],
  ['/organiser/salsa-nights', false],
  ['/finish-profile', false],
  ['/parties', false],
  ['/accounting', false],
  ['/invites', false],
])('isDancerGatedPath(%j)', (path, want) => {
  it(`-> ${want}`, () => expect(isDancerGatedPath(path)).toBe(want));
});

describe.each([
  ['/account/o?add=1#x', true],
  ['/%61ccount/o', true],
  ['/organiser/salsa-nights?claim=1', true],
  ['/organiser/salsa-nights?x=1&claim=1#top', true],
  ['/organiser/salsa-nights', false],
  ['/organiser/salsa-nights?claim=0', false],
  ['/event/e1#level-rating', false],
  ['/event/e1?occ=2#level-rating', false],
])('isDancerGatedTarget(%j)', (target, want) => {
  it(`-> ${want}`, () => expect(isDancerGatedTarget(target)).toBe(want));
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
