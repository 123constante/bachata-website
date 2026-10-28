// @vitest-environment jsdom
/**
 * P3 W4b: the unfinished-profile tap gate (owner pick no-city B, "look first, finish on the tap").
 * Every shape of the ONE completeness fact (ProfileGateContext) x every organiser tap (Claim, Ask
 * to join, Create). Written RED first: on the unfixed code a tap opens today's sheet for every shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ search: vi.fn(), claim: vi.fn(), request: vi.fn(), create: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  searchClaimableOrganisers: api.search,
  claimOrganiser: api.claim,
  requestOrganiserAccess: api.request,
  createOrganiserProfile: api.create,
}));

import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { NO_PROFILE_TEXT, profileGateValue, type ProfileCompletion } from '@/lib/profileCompletion';
import { DANCER_GATE_REASON } from '@/lib/accountRouting';
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { OnboardingView } from '../onboarding/OnboardingView';
import { withAdmin } from '../onboarding/profileGate';

const org = (id: string, name: string, hint: ClaimHint | null) => ({ id, name, slug: id, avatar_url: null, city_id: null, hint });
const gate = (c: ProfileCompletion): ProfileGateValue => profileGateValue(c);

type Shape = { name: string; value: ProfileGateValue | 'loading' | null; gated: 'finish' | 'no_row' | null };
const SHAPES: Shape[] = [
  { name: 'complete', value: gate({ status: 'complete', missing: [], profileId: 'p' }), gated: null },
  { name: 'unfinished: city and photo missing', value: gate({ status: 'incomplete', missing: ['based_city_id', 'avatar_url'], profileId: 'p' }), gated: 'finish' },
  { name: 'unfinished: all four missing', value: gate({ status: 'incomplete', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: 'p' }), gated: 'finish' },
  { name: 'no dancer row', value: gate({ status: 'no_profile', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: null }), gated: 'no_row' },
  // The completeness read failed: fall back to today (buttons on, the server decides).
  { name: 'read failed (error)', value: gate({ status: 'error', missing: [], profileId: null }), gated: null },
  { name: 'still loading', value: 'loading', gated: null },
  { name: 'no provider', value: null, gated: null },
];

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function mount(value: ProfileGateValue | 'loading' | null, look: 'r1' | 'p3' = 'p3') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProfileGateContext.Provider value={value}>
        <MemoryRouter initialEntries={['/account/p3/you/add']}>
          <Routes>
            <Route
              path="/account/p3/you/add"
              element={
                <OnboardingView
                  user={{ id: 'u1', email: 'me@x.example' }}
                  mailboxProven
                  myOrganiserIds={new Set()}
                  requests={[]}
                  firstRun
                  onChanged={vi.fn()}
                  look={look}
                />
              }
            />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </ProfileGateContext.Provider>
    </QueryClientProvider>,
  );
}

const TAPS = [
  { tap: 'Claim', hint: 'email_matches' as ClaimHint, button: 'onboarding-claim', todays: 'onboarding-claim-confirm' },
  { tap: 'Ask to join', hint: 'managed' as ClaimHint, button: 'onboarding-request', todays: 'onboarding-request-send' },
  { tap: 'Create', hint: null, button: 'onboarding-create', todays: 'onboarding-create-name' },
];

async function tap(t: (typeof TAPS)[number]) {
  if (t.tap === 'Create') {
    fireEvent.click(screen.getByTestId('onboarding-create'));
    return;
  }
  api.search.mockResolvedValue([org('a', 'Alpha Nights', t.hint)]);
  fireEvent.change(screen.getByTestId('onboarding-search'), { target: { value: 'alpha' } });
  fireEvent.click(await screen.findByTestId(t.button));
}

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

describe.each(SHAPES)('P3 Welcome, shape: $name', (shape) => {
  it.each(TAPS)('tap $tap', async (t) => {
    mount(shape.value);
    // Look first: the screen is the same for every shape, nothing says "unfinished" before a tap.
    expect(screen.queryByTestId('onboarding-gate')).toBeNull();
    expect((screen.getByTestId('onboarding-create') as HTMLButtonElement).disabled).toBe(false);
    await tap(t);
    const sheet = await screen.findByTestId('onboarding-sheet');
    if (shape.gated === null) {
      expect(screen.queryByTestId('onboarding-gate')).toBeNull();
      expect(await screen.findByTestId(t.todays)).toBeTruthy();
      return;
    }
    // Gated: before any typing, no create / claim / request field or command.
    expect(sheet.querySelector('[data-testid="onboarding-gate"]')).toBeTruthy();
    expect(screen.queryByTestId(t.todays)).toBeNull();
    expect(screen.queryByTestId('onboarding-create-name')).toBeNull();
    expect(screen.queryByTestId('onboarding-request-note')).toBeNull();
    expect(sheet.textContent).toContain(DANCER_GATE_REASON);
    if (shape.gated === 'finish') {
      expect(sheet.textContent).toContain('Still to add:');
      expect(sheet.textContent).toContain('When you are done you come back to Welcome; search for your page again.');
      // Never "Message us" for a profile that has a row (owner rule).
      expect(sheet.textContent).not.toMatch(/message us/i);
      const off = screen.queryByTestId('onboarding-gate-off');
      if (t.tap === 'Create') expect(off).toBeNull();
      else {
        expect((off as HTMLButtonElement).disabled).toBe(true);
        expect(off?.textContent).toBe(t.tap === 'Claim' ? 'Claim it' : 'Ask to join');
        expect(document.getElementById(off!.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Finish your dancer profile first.');
      }
      fireEvent.click(screen.getByTestId('onboarding-gate-finish'));
      expect(screen.getByTestId('where').textContent).toBe(`/finish-profile?returnTo=${encodeURIComponent('/account/p3/you/add')}`);
    } else {
      expect(sheet.textContent).toContain(NO_PROFILE_TEXT);
      expect(screen.queryByTestId('onboarding-gate-finish')).toBeNull();
      expect(screen.getByTestId('onboarding-gate-contact').getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
    }
    expect(api.claim).not.toHaveBeenCalled();
    expect(api.request).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });
});

// The server's _require_complete_dancer_profile_v1 returns early for is_admin(): an admin is
// never refused for the profile, so the tap must not stop one either (prod: 2 admins, no row).
const ADMIN_SHAPES: Shape[] = [
  { name: 'admin, no dancer row', value: { ...SHAPES[3].value as ProfileGateValue, isAdmin: true }, gated: null },
  { name: 'admin, unfinished', value: { ...SHAPES[2].value as ProfileGateValue, isAdmin: true }, gated: null },
];

describe.each(ADMIN_SHAPES)('P3 Welcome, $name', (shape) => {
  it.each(TAPS)('tap $tap opens today’s sheet', async (t) => {
    mount(shape.value);
    await tap(t);
    expect(await screen.findByTestId(t.todays)).toBeTruthy();
    expect(screen.queryByTestId('onboarding-gate')).toBeNull();
  });
});

describe('withAdmin (P3 Add a page merges the admin read into the gate)', () => {
  const unfinished = SHAPES[2].value as ProfileGateValue;
  it('admin: carries isAdmin, so the tap opens', () => {
    expect(withAdmin(unfinished, { isAdmin: true, isPending: false })).toMatchObject({ status: 'incomplete', isAdmin: true });
  });
  it('not admin: the same fact, still gated', () => {
    expect(withAdmin(unfinished, { isAdmin: false, isPending: false })).toBe(unfinished);
  });
  it('admin read pending: loading (opens today; the server decides)', () => {
    expect(withAdmin(unfinished, { isAdmin: false, isPending: true })).toBe('loading');
  });
  it('no fact yet: unchanged', () => {
    expect(withAdmin(null, { isAdmin: true, isPending: false })).toBeNull();
    expect(withAdmin('loading', { isAdmin: true, isPending: false })).toBe('loading');
  });
});

describe('R1 (/account/o, flag off) keeps today: no tap gate', () => {
  it.each(TAPS)('unfinished profile, tap $tap opens today’s sheet', async (t) => {
    mount(SHAPES[1].value, 'r1');
    await tap(t);
    expect(await screen.findByTestId(t.todays)).toBeTruthy();
    expect(screen.queryByTestId('onboarding-gate')).toBeNull();
  });
});
