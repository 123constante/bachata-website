// @vitest-environment jsdom
/**
 * The dancer home (/account) x every prod shape of a signed-in account
 * (dancerBackend.ts, counts measured 2026-10-11). For each shape:
 *
 * - the right page: an organiser, or someone with an OPEN access request, is
 *   sent on to /account/o; everyone else gets the dancer home;
 * - ONE completeness fact: the dancer home's line, the Finish screen's form,
 *   the site banner and the rating card all read completenessFact / ratingGate
 *   off the same server answer, so they say the same thing;
 * - no copy points at a control that is not on screen, and every empty or
 *   blocked state says what the person can do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeBackend, DANCER_SHAPES, ORGANISER_SHAPES, type Backend, type BackendState } from './helpers/dancerBackend';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown }, anonymous: false }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@example.com', is_anonymous: h.anonymous },
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

import { AccountScreen } from '../Account';
import { myDancerSummaryQueryKey } from '@/hooks/useMyDancerSummary';
import { profileCompletionQueryKey } from '@/hooks/useProfileCompletion';
import { danceRoleLabel } from '@/lib/auth-otp-routing';
import { onlineManager } from '@tanstack/react-query';
import { FinishProfileScreen } from '../FinishProfile';
import ProfileCompletionChrome from '@/components/profile/ProfileCompletionChrome';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import {
  NO_PROFILE_CONTACT_URL,
  PROFILE_FIELD_LABEL,
  RATE_BLOCKED_REASON,
  NO_PROFILE_REASON,
  completenessFact,
  finishProfileHref,
  missingProfileFields,
  type ProfileCompletion,
  type ProfileField,
} from '@/lib/profileCompletion';

/** What profile_complete_v1 + the row say for a shape: the fact every surface must state. */
const expected = (s: BackendState): ProfileCompletion => {
  if (!s.row) return { status: 'no_profile', missing: missingProfileFields(null), profileId: null };
  const missing = missingProfileFields(s.row);
  return missing.length === 0
    ? { status: 'complete', missing: [], profileId: 'persona-1' }
    : { status: 'incomplete', missing, profileId: 'persona-1' };
};

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** What AppChrome does: the lazy chrome publishes the gate, the rating card reads it. */
function GateHarness({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<ProfileGateValue | null | 'loading'>('loading');
  return (
    <ProfileGateContext.Provider value={gate}>
      <ProfileCompletionChrome onGate={setGate} />
      {children}
    </ProfileGateContext.Provider>
  );
}

const mountAccount = (backend: Backend, at = '/account') => {
  h.backend = backend;
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/account/o" element={<p data-testid="organiser-home">organiser home</p>} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/**
 * Copy that names a control, and the control it names. If the words are on
 * screen, the control must be too (CLAUDE.md: no copy pointing at a control that
 * is not there).
 */
const NAMED_CONTROLS: [RegExp, () => HTMLElement | null][] = [
  [/Finish your profile/, () => screen.queryByRole('link', { name: 'Finish your profile' })],
  [/message us/i, () => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === NO_PROFILE_CONTACT_URL) ?? null],
  [/Try again/, () => screen.queryAllByRole('button', { name: 'Try again' })[0] ?? null],
  [/organiser area/, () => screen.queryAllByRole('link', { name: /organiser area/ })[0] ?? null],
  [/I organise events/, () => screen.queryByRole('button', { name: /I organise events/ })],
  [/My attendance/, () => screen.queryByRole('link', { name: /My attendance/ })],
  [/Browse parties/, () => screen.queryByRole('link', { name: /Browse parties/ })],
  [/Sign out/, () => screen.queryByRole('button', { name: 'Sign out' })],
  [/Sign in with your email/, () => screen.queryByRole('link', { name: 'Sign in' })],
];

beforeEach(() => {
  h.anonymous = false;
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(cleanup);

describe.each(DANCER_SHAPES)('dancer home: $name', ({ state }) => {
  const want = expected(state);
  const fact = completenessFact(want);

  it('shows the dancer home with the one completeness fact', async () => {
    mountAccount(makeBackend(state));
    const home = await screen.findByTestId('dancer-home');
    await waitFor(() => expect(within(home).queryByTestId('dancer-home-loading')).toBeNull());
    expect(screen.queryByTestId('organiser-home')).toBeNull();

    const finish = screen.queryByRole('link', { name: 'Finish your profile' });
    if (fact.kind === 'incomplete') {
      expect(screen.getByTestId('dancer-home-completeness').textContent).toBe(fact.text);
      // Exactly the missing fields are named, and only those.
      for (const f of Object.keys(PROFILE_FIELD_LABEL) as ProfileField[]) {
        const named = screen.getByTestId('dancer-home-completeness').textContent!.includes(PROFILE_FIELD_LABEL[f]);
        expect(named, f).toBe(want.missing.includes(f));
      }
      expect(finish?.getAttribute('href')).toBe(finishProfileHref('/account'));
    } else if (fact.kind === 'complete') {
      expect(screen.getByTestId('dancer-home-completeness').textContent).toBe(fact.text);
      expect(finish).toBeNull();
    } else {
      expect(fact.kind).toBe('no_profile');
      expect(screen.getByTestId('dancer-home-no-profile').textContent).toContain(fact.text);
      expect(finish).toBeNull();
    }

    // A field the fact calls missing reads "not set" on the card above the line.
    if (state.row && fact.kind !== 'no_profile') {
      expect(screen.getByTestId('dancer-home-name').textContent).toBe(
        want.missing.includes('first_name') ? 'Name not set' : state.row.first_name!.trim(),
      );
      const details = screen.getByTestId('dancer-home-details').textContent!;
      expect(details.includes('City not set')).toBe(want.missing.includes('based_city_id'));
      expect(details.includes('Dance role not set')).toBe(want.missing.includes('dance_role'));
      // The role reads as the Finish screen's picker labels it ("Both", never "Lead and Follow").
      if (!want.missing.includes('dance_role')) expect(details).toContain(danceRoleLabel(state.row.dance_role!));
      expect(!!screen.queryByTestId('dancer-home-photo')).toBe(!want.missing.includes('avatar_url'));
    }

    expect(!!screen.queryByTestId('dancer-home-archived')).toBe(!!state.row?.archived_at);
    expect(!!screen.queryByTestId('dancer-home-organiser-check-failed')).toBe(!!(state.organiserHomeFails || state.requestsFail));
    expect(screen.getByRole('link', { name: /My attendance/ }).getAttribute('href')).toBe('/account/attendance');
    expect(screen.getByRole('link', { name: /Browse parties/ }).getAttribute('href')).toBe('/city/london-gb/parties');

    const text = document.body.textContent ?? '';
    for (const [words, control] of NAMED_CONTROLS) {
      if (words.test(text)) expect(control(), `copy says ${words} but the control is missing`).not.toBeNull();
    }
  });

  it('the Finish screen asks for exactly the same missing fields', async () => {
    h.backend = makeBackend(state);
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={[finishProfileHref('/account')]}>
          <FinishProfileScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    if (fact.kind === 'incomplete') {
      await screen.findByRole('button', { name: 'Save' });
      expect(screen.getByText(new RegExp(fact.text.replace(/[.]/g, '\\.')))).toBeTruthy();
      const asked: Record<ProfileField, boolean> = {
        first_name: !!screen.queryByLabelText(/first name/i),
        based_city_id: !!screen.queryByRole('button', { name: 'Pick city' }),
        dance_role: !!screen.queryByRole('radiogroup'),
        avatar_url: !!screen.queryByRole('button', { name: 'Upload photo' }),
      };
      for (const f of Object.keys(asked) as ProfileField[]) expect(asked[f], f).toBe(want.missing.includes(f));
    } else if (fact.kind === 'complete') {
      expect(await screen.findByText(fact.text)).toBeTruthy();
    } else {
      expect(await screen.findByText(/no dancer profile yet/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    }
  });

  it('the banner and the rating card state the same fact', async () => {
    h.backend = makeBackend(state);
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={['/event/ev1']}>
          <GateHarness>
            <LevelRatingPrompt seriesId="ev1" />
          </GateHarness>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
    if (fact.kind === 'complete') {
      await waitFor(() => expect(tile.disabled).toBe(false));
      expect(screen.queryByTestId('level-rating-gate')).toBeNull();
      expect(screen.queryByTestId('profile-completion-banner')).toBeNull();
    } else {
      await waitFor(() => expect(tile.disabled).toBe(true));
      const gate = screen.getByTestId('level-rating-gate');
      expect(gate.textContent).toContain(fact.kind === 'incomplete' ? RATE_BLOCKED_REASON : NO_PROFILE_REASON);
      const banner = screen.getByTestId('profile-completion-banner');
      if (fact.kind === 'incomplete') expect(banner.textContent).toContain(fact.text);
    }
  });
});

describe.each(ORGANISER_SHAPES)('organiser page: $name', ({ state }) => {
  it('goes on to the organiser home, never the dancer home', async () => {
    mountAccount(makeBackend(state));
    expect(await screen.findByTestId('organiser-home')).toBeTruthy();
    expect(screen.queryByTestId('dancer-home')).toBeNull();
  });
});

describe('the organiser onboarding stays one tap away', () => {
  it('is collapsed, and opening it shows the unchanged claim / request / create view', async () => {
    mountAccount(makeBackend(DANCER_SHAPES[1].state));
    const toggle = await screen.findByRole('button', { name: /I organise events/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('org-onboarding')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByTestId('org-onboarding')).toBeTruthy();
  });

  it('a summary read older than the completeness answer never contradicts it', async () => {
    // The cached summary still says "Leader" (read before a role was cleared elsewhere);
    // the server says the role is missing. The card follows the fact, not the stale read.
    const backend = makeBackend({ row: { ...DANCER_SHAPES[5].state.row!, dance_role: null }, organisers: 0, requests: [] });
    h.backend = backend;
    const qc = client();
    qc.setQueryData(myDancerSummaryQueryKey('u1'), {
      id: 'persona-1', firstName: 'Ana', cityName: 'London', danceRole: 'Leader', avatarUrl: 'https://img.example/ana.jpg', archived: false,
    });
    qc.setQueryDefaults(myDancerSummaryQueryKey('u1'), { staleTime: Infinity });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/account" element={<AccountScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Add your dance role to rate parties.')).toBeTruthy();
    expect(screen.getByTestId('dancer-home-details').textContent).toContain('Dance role not set');
    expect(screen.getByTestId('dancer-home-details').textContent).not.toContain('Leader');
  });

  it('an old /account link with a query keeps going to the organiser area', async () => {
    mountAccount(makeBackend(DANCER_SHAPES[1].state), '/account?from=email');
    expect(await screen.findByTestId('organiser-home')).toBeTruthy();
  });

  it('a shared link with only tracking params is still the dancer home', async () => {
    mountAccount(makeBackend(DANCER_SHAPES[1].state), '/account?utm_source=whatsapp&fbclid=abc');
    expect(await screen.findByTestId('dancer-home')).toBeTruthy();
    expect(screen.queryByTestId('organiser-home')).toBeNull();
  });

  it('an organiser answer arriving later (not from an action here) still redirects', async () => {
    const backend = makeBackend(DANCER_SHAPES[1].state);
    const qc = client();
    h.backend = backend;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/account" element={<AccountScreen />} />
            <Route path="/account/o" element={<p data-testid="organiser-home">organiser home</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('dancer-home');
    backend.state.organisers = 1; // e.g. an owner granted a request elsewhere
    await qc.invalidateQueries({ queryKey: ['organiser-home'] });
    expect(await screen.findByTestId('organiser-home')).toBeTruthy();
    expect(screen.queryByTestId('dancer-home-now-organiser')).toBeNull();
  });

  it('offline with the completeness answer cached: says the details could not load, never "not set"', async () => {
    h.backend = makeBackend(DANCER_SHAPES[5].state);
    const qc = client();
    qc.setQueryDefaults(['profile-completion'], { staleTime: Infinity });
    qc.setQueryData(profileCompletionQueryKey('u1'), { status: 'complete', missing: [], profileId: 'persona-1' });
    qc.setQueryData(['organiser-home', 'u1'], { today: '2026-10-11', organisers: [] });
    qc.setQueryData(['my-access-requests', 'u1'], []);
    qc.setQueryDefaults(['organiser-home'], { staleTime: Infinity });
    qc.setQueryDefaults(['my-access-requests'], { staleTime: Infinity });
    onlineManager.setOnline(false);
    try {
      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/account']}>
            <Routes>
              <Route path="/account" element={<AccountScreen />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(await screen.findByTestId('dancer-home-details-failed')).toBeTruthy();
      expect(screen.queryByText('Name not set')).toBeNull();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('one "Sign out" on screen: the open onboarding brings its own', async () => {
    mountAccount(makeBackend(DANCER_SHAPES[1].state));
    await screen.findByTestId('dancer-home');
    expect(screen.getByTestId('dancer-home-signout')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /I organise events/ }));
    await screen.findByTestId('org-onboarding');
    expect(screen.queryByTestId('dancer-home-signout')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Sign out/ })).toHaveLength(1);
  });

  it('a failed name/city/photo read says so and offers a retry, never "not set"', async () => {
    mountAccount(makeBackend({ ...DANCER_SHAPES[5].state, summaryFails: true }));
    expect(await screen.findByTestId('dancer-home-details-failed')).toBeTruthy();
    expect(screen.queryByText('Name not set')).toBeNull();
    expect(screen.getByTestId('dancer-home-completeness').textContent).toBe('Your profile is complete. You can rate parties now.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('an anonymous session is asked to sign in, not left on a skeleton', async () => {
    h.anonymous = true;
    mountAccount(makeBackend(DANCER_SHAPES[5].state));
    expect(await screen.findByTestId('dancer-home-signed-out')).toBeTruthy();
    expect(screen.queryByTestId('dancer-home-loading')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Faccount');
  });
});
