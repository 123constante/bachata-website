// @vitest-environment jsdom
/**
 * The dancer-first HARD GATE (owner decision 2026-10-11, supersedes #718's
 * skippable row), on top of layout D, table-driven over the prod shapes
 * (helpers/dancerBackend.ts):
 *
 *   {no dancer row, stub, partly filled, complete, archived}
 *     x {no organiser, organiser, open access request}
 *
 * For every cell, through the real ROUTE components (guards included) and one
 * fake backend:
 * 1. where /account, /account/o and the organiser-intent sign-in landing end up:
 *    an unfinished profile (anything but `complete`) is sent to /finish-profile
 *    with returnTo = the page they wanted; a complete one gets #718's layout D;
 * 2. the gated Finish screen says why, and offers no "Skip for now";
 * 3. complete profiles are never gated;
 * 4. returnTo round-trips: finishing a fillable profile lands on the page wanted;
 * 5. the organiser home has no "Finish your dancer profile" row any more;
 * 6. the fact reads the same on the ungated Finish screen and the rating card,
 *    and no copy names a control that is not on screen.
 *
 * The expectations are written out here, not read from lib/accountRouting, so
 * the mapping and the screens are both checked against the owner's rule.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CITY, FULL, ROLE_SHAPES, ROW_SHAPES, makeBackend, type Backend, type BackendState } from './helpers/dancerBackend';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown } }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@example.com', is_anonymous: false },
    session: null,
    isLoading: false,
    authStatus: 'ready',
    signOut: async () => 'signed_out',
  }),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange('city-london')}>Pick city</button>
  ),
}));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://img.example/new.jpg')}>Upload photo</button>
  ),
}));

import Account from '../Account';
import FinishProfile from '../FinishProfile';
import MyAttendance from '../MyAttendance';
import OrganiserRoutes from '@/modules/organiser/shell/OrganiserRoutes';
import ProfileCompletionChrome from '@/components/profile/ProfileCompletionChrome';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import {
  NO_PROFILE_CONTACT_URL,
  completenessFact,
  missingProfileFields,
  type ProfileCompletion,
  type ProfileField,
} from '@/lib/profileCompletion';

/** The owner's words for the gated Finish screen (task 2026-10-11). */
const GATE_REASON = 'Finish your dancer profile first, then you can set up your organiser page.';

/** What the server says for a row (profile_complete_v1 + _dancer_profile_id_for_account_v1). */
const serverSays = (row: BackendState['row']): ProfileCompletion => {
  if (!row || row.archived_at) return { status: 'no_profile', missing: missingProfileFields(null), profileId: null };
  const missing = missingProfileFields(row);
  return missing.length === 0
    ? { status: 'complete', missing: [], profileId: 'persona-1' }
    : { status: 'incomplete', missing, profileId: 'persona-1' };
};

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function GateHarness({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<ProfileGateValue | null | 'loading'>('loading');
  return (
    <ProfileGateContext.Provider value={gate}>
      <ProfileCompletionChrome onGate={setGate} />
      {children}
    </ProfileGateContext.Provider>
  );
}

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="probe">{`${pathname}${search}`}</output>;
}

const mount = (backend: Backend, at: string) => {
  h.backend = backend;
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[at]}>
        <LocationProbe />
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/account/dancer" element={<Account view="dancer" />} />
          <Route path="/account/attendance" element={<MyAttendance />} />
          <Route path="/account/o/*" element={<OrganiserRoutes />} />
          <Route path="/finish-profile" element={<FinishProfile />} />
          <Route path="/event/:id" element={<GateHarness><LevelRatingPrompt seriesId="ev1" /></GateHarness>} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const here = () => new URL(screen.getByTestId('probe').textContent!, 'https://x.test');

/** Lands on the gated Finish screen, with returnTo = the page that was wanted. */
const expectGatedTo = async (wanted: string) => {
  await waitFor(() => expect(here().pathname).toBe('/finish-profile'), { timeout: 3000 });
  expect(here().searchParams.get('returnTo')).toBe(wanted);
  expect(await screen.findByText(GATE_REASON)).toBeTruthy();
};

/** Copy that names a control -> the control it names. If the words show, the control must too. */
const NAMED_CONTROLS: [RegExp, () => HTMLElement | null][] = [
  [/message us/i, () => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === NO_PROFILE_CONTACT_URL) ?? null],
  [/Try again/, () => screen.queryAllByRole('button', { name: 'Try again' })[0] ?? null],
  [/I organise events/, () => screen.queryByRole('button', { name: /I organise events/ })],
  [/My attendance/, () => screen.queryByRole('link', { name: /My attendance/ })],
  [/Browse parties/, () => screen.queryByRole('link', { name: /Browse parties/ })],
  [/Skip for now/, () => screen.queryAllByRole('button', { name: 'Skip for now' })[0] ?? null],
  [/Fill in at least one field above/, () => screen.queryByRole('button', { name: 'Save' })],
];
const noDanglingCopy = () => {
  const text = document.body.textContent ?? '';
  for (const [words, control] of NAMED_CONTROLS) {
    if (words.test(text)) expect(control(), `copy says ${words} but that control is not on screen`).not.toBeNull();
  }
};

/** Fill every field the Finish screen asks for, then Save. */
const fillAndSave = async (missing: ProfileField[]) => {
  await screen.findByRole('button', { name: 'Save' });
  if (missing.includes('first_name')) fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ana' } });
  if (missing.includes('based_city_id')) fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
  if (missing.includes('dance_role')) fireEvent.click(screen.getAllByRole('radio')[0]);
  if (missing.includes('avatar_url')) fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const CELLS = ROW_SHAPES.flatMap((shape) => ROLE_SHAPES.map((role) => ({ shape, role })));

describe.each(CELLS)('$shape.name x $role.name', ({ shape, role }) => {
  const state: BackendState = { row: shape.row ? { ...shape.row } : null, organisers: role.organisers, requests: role.requests };
  const fact = completenessFact(serverSays(shape.row));
  const hasOrganisers = role.organisers > 0;
  const openRequest = role.requests.some((r) => r.status === 'open');
  // The owner's rule, written out: anything but a complete profile is gated,
  // archived included (an archived row never resolves: no live dancer profile).
  const gated = fact.kind !== 'complete';
  const fillable = fact.kind === 'incomplete';

  it('/account (the account icon): gated unless complete; complete lands as layout D', async () => {
    mount(makeBackend(state), '/account');
    if (gated) {
      await expectGatedTo('/account');
      expect(screen.queryByTestId('dancer-home')).toBeNull();
      expect(screen.queryByTestId('org-page-home')).toBeNull();
    } else if (hasOrganisers || openRequest) {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
    } else {
      expect(await screen.findByTestId('dancer-home')).toBeTruthy();
      expect(screen.getByRole('button', { name: /I organise events/ }).getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('/account/o (organiser home and onboarding): gated unless complete', async () => {
    mount(makeBackend(state), '/account/o');
    if (gated) {
      await expectGatedTo('/account/o');
      expect(screen.queryByTestId('org-page-home')).toBeNull();
    } else {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
      if (!hasOrganisers) expect(await screen.findByTestId('org-onboarding')).toBeTruthy();
    }
    // #718's skippable row is gone: the gate makes it unreachable.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('org-dancer-row')).toBeNull();
  });

  it('a deep organiser page keeps its full address in returnTo', async () => {
    mount(makeBackend(state), '/account/o/team?o=org-0');
    if (gated) await expectGatedTo('/account/o/team?o=org-0');
    else await waitFor(() => expect(here().pathname).not.toBe('/finish-profile'));
  });

  it('the organiser-intent sign-in landing goes through the gate, remembering the intent', async () => {
    const landing = landingPathAfterAuth({ organiserSelfServe: true, role: 'organiser', managesOrganiser: null });
    mount(makeBackend(state), landing);
    if (gated) await expectGatedTo(landing);
    else expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('the gated Finish screen explains itself and offers no Skip', async () => {
    mount(makeBackend(state), '/account/o');
    if (!gated) {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      return;
    }
    await expectGatedTo('/account/o');
    if (fillable) {
      await screen.findByRole('button', { name: 'Save' });
      expect(document.body.textContent).toContain(fact.text);
      expect(document.body.textContent).not.toContain('Everything else on the site works without it');
    } else {
      // No live dancer profile (none, or archived): nothing to fill in here, so the
      // way forward is the contact, never a "Continue" straight back into the gate.
      expect(await screen.findByText(fact.text)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
    noDanglingCopy();
  });

  it('returnTo round-trips: finishing lands on the page that was wanted', async () => {
    const backend = makeBackend(state);
    mount(backend, '/account/o');
    if (!gated) {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      return;
    }
    await expectGatedTo('/account/o');
    if (!fillable) return; // nothing to fill in; covered by the screen's own cell above
    await fillAndSave(fact.missing);
    await waitFor(() => expect(here().pathname).toBe('/account/o'), { timeout: 3000 });
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
    expect(backend.calls.filter((c) => c.name === 'save_my_dancer_profile_v1')).toHaveLength(1);
  });

  it('the dancer pages under /account are gated too; a complete profile is not', async () => {
    mount(makeBackend(state), '/account/dancer');
    if (gated) await expectGatedTo('/account/dancer');
    else expect(await screen.findByTestId('dancer-home')).toBeTruthy();
  });

  it('the ungated Finish screen (from the rating card) keeps #718 behaviour: same fact, Skip offered', async () => {
    mount(makeBackend(state), `/finish-profile?returnTo=${encodeURIComponent('/event/ev1#level-rating')}`);
    if (fillable) {
      await screen.findByRole('button', { name: 'Save' });
      expect(document.body.textContent).toContain(fact.text);
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
    } else {
      expect(await screen.findByText(fact.text)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    }
    expect(document.body.textContent).not.toContain(GATE_REASON);
    noDanglingCopy();
  });

  it('the rating card states the same fact (or is open when complete) -- public pages are never gated', async () => {
    mount(makeBackend(state), '/event/ev1');
    const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
    expect(here().pathname).toBe('/event/ev1');
    if (fact.kind === 'complete') {
      await waitFor(() => expect(tile.disabled).toBe(false));
      expect(screen.queryByTestId('level-rating-gate')).toBeNull();
    } else {
      await waitFor(() => expect(tile.disabled).toBe(true));
      expect(screen.getByTestId('level-rating-gate').textContent).toContain(`${fact.reason}.`);
    }
  });
});

describe('dancer-first gate edges', () => {
  it('a completeness check that fails does not lock an organiser out (fail open; the server refuses the writes)', async () => {
    const backend = makeBackend({ row: { ...FULL }, organisers: 1, requests: [] });
    const rpc = backend.client.rpc;
    backend.client.rpc = (name: string, args?: Record<string, unknown>) =>
      name === 'profile_complete_v1' ? Promise.resolve({ data: null, error: { message: 'statement timeout' } }) : rpc(name, args);
    mount(backend, '/account/o');
    expect(await screen.findByTestId('org-page-home', {}, { timeout: 3000 })).toBeTruthy();
    expect(here().pathname).toBe('/account/o');
    // And it settles: an errored read re-fetched by each newly mounted observer once
    // looped gate -> page -> refetch -> gate (hundreds of reads a second).
    await new Promise((r) => setTimeout(r, 300));
    const asked = backend.calls.filter((c) => c.name === 'profile_complete_v1').length;
    await new Promise((r) => setTimeout(r, 300));
    expect(backend.calls.filter((c) => c.name === 'profile_complete_v1').length - asked).toBe(0);
    expect(screen.getByTestId('org-page-home')).toBeTruthy();
  });

  it('reached gated, a check that then fails says so with Try again, and offers no Skip', async () => {
    const backend = makeBackend({ row: { ...ROW_SHAPES[1].row! }, organisers: 1, requests: [] });
    const rpc = backend.client.rpc;
    backend.client.rpc = (name: string, args?: Record<string, unknown>) =>
      name === 'profile_complete_v1' ? Promise.resolve({ data: null, error: { message: 'statement timeout' } }) : rpc(name, args);
    mount(backend, `/finish-profile?gate=organiser&returnTo=${encodeURIComponent('/account/o')}`);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
    noDanglingCopy();
  });

  it('a gated link reaching a profile that reads complete: no "finish first" line, Continue goes on', async () => {
    // The server refused an organiser claim the cached answer thought complete, and the
    // re-check says complete too: the screen must not say "finish first" above "complete".
    mount(makeBackend({ row: { ...FULL }, organisers: 1, requests: [] }), `/finish-profile?gate=organiser&returnTo=${encodeURIComponent('/account/o')}`);
    expect(await screen.findByText('Your profile is complete. You can rate parties now.')).toBeTruthy();
    expect(screen.queryByText(GATE_REASON)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('My attendance is an account page: gated for an unfinished profile', async () => {
    mount(makeBackend({ row: { ...ROW_SHAPES[1].row! }, organisers: 0, requests: [] }), '/account/attendance');
    await expectGatedTo('/account/attendance');
  });

  it('an organiser on their dancer profile gets a way back, not the organiser onboarding', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 1, requests: [] }), '/account/dancer');
    expect(await screen.findByTestId('dancer-home-organiser-link')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I organise events/ })).toBeNull();
  });

  it('an old /account link with an organiser key still goes to the organiser area once complete', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [] }), '/account?from=email');
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('an old /account link for an unfinished profile is gated and keeps its query in returnTo', async () => {
    mount(makeBackend({ row: null, organisers: 0, requests: [] }), '/account?from=email');
    await expectGatedTo('/account?from=email');
  });

  it('a shared link with only tracking params is still the dancer home', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [] }), '/account?utm_source=whatsapp&fbclid=abc');
    expect(await screen.findByTestId('dancer-home')).toBeTruthy();
    expect((await screen.findByTestId('dancer-home-details')).textContent).toContain(CITY.name);
  });

  it('a failed organiser read lands a complete profile on the dancer home and names the organiser area', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [], organiserHomeFails: true }), '/account');
    expect(await screen.findByTestId('dancer-home-organiser-check-failed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the organiser area' })).toBeTruthy();
  });
});
