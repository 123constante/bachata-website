// @vitest-environment jsdom
/**
 * Layout D (owner decision 2026-10-11: the account is a PERSON with roles, not
 * either/or), table-driven over the prod shapes (helpers/dancerBackend.ts):
 *
 *   {no dancer row, stub, partly filled, complete, archived}
 *     x {no organiser, organiser, open access request}
 *
 * For every cell, rendered through the real screens and one fake backend:
 * 1. where the account icon's /account lands (organiser home or dancer home);
 * 2. whether the organiser home shows the one "Finish your dancer profile" row;
 * 3. whether the organiser home's account menu has a dancer-profile entry;
 * 4. that the completeness fact reads the same on the dancer home, the
 *    organiser-home row, the Finish screen and the rating card -- all from
 *    completenessFact();
 * 5. that no copy names a control that is not on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

import { AccountScreen } from '../Account';
import { FinishProfileScreen } from '../FinishProfile';
import OrganiserHomePage from '@/modules/organiser/home';
import ProfileCompletionChrome from '@/components/profile/ProfileCompletionChrome';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { myDancerSummaryQueryKey } from '@/hooks/useMyDancerSummary';
import { DANCER_HOME_PATH, accountView } from '@/lib/accountRouting';
import {
  NO_PROFILE_CONTACT_URL,
  PROFILE_FIELD_LABEL,
  completenessFact,
  finishProfileHref,
  missingProfileFields,
  type ProfileCompletion,
  type ProfileField,
} from '@/lib/profileCompletion';

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

const mount = (backend: Backend, at: string) => {
  h.backend = backend;
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/account/dancer" element={<AccountScreen view="dancer" />} />
          <Route path="/account/o" element={<OrganiserHomePage />} />
          <Route path="/finish-profile" element={<FinishProfileScreen />} />
          <Route path="/event/:id" element={<GateHarness><LevelRatingPrompt seriesId="ev1" /></GateHarness>} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Copy that names a control -> the control it names. If the words show, the control must too. */
const NAMED_CONTROLS: [RegExp, () => HTMLElement | null][] = [
  [/Finish your (dancer )?profile/, () => screen.queryAllByRole('link', { name: /Finish your (dancer )?profile/ })[0] ?? null],
  [/message us/i, () => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === NO_PROFILE_CONTACT_URL) ?? null],
  [/Try again/, () => screen.queryAllByRole('button', { name: 'Try again' })[0] ?? null],
  [/I organise events/, () => screen.queryByRole('button', { name: /I organise events/ })],
  [/My attendance/, () => screen.queryByRole('link', { name: /My attendance/ })],
  [/Browse parties/, () => screen.queryByRole('link', { name: /Browse parties/ })],
  [/organiser home/i, () => screen.queryAllByRole('link', { name: /organiser home/i })[0] ?? null],
];
const noDanglingCopy = () => {
  const text = document.body.textContent ?? '';
  for (const [words, control] of NAMED_CONTROLS) {
    if (words.test(text)) expect(control(), `copy says ${words} but that control is not on screen`).not.toBeNull();
  }
};

/** Every async read on the organiser home has answered (it renders "Home" or "Welcome"). */
const organiserHomeSettled = async () => {
  await screen.findByTestId('org-page-home');
  await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
  // The completeness read settles after the home read: wait until the row/menu decision is final.
  await new Promise((r) => setTimeout(r, 30));
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
  // Layout D written out here, NOT read from accountView(): the screens and the
  // mapping are both checked against the owner's rule.
  const hasOrganisers = role.organisers > 0;
  const openRequest = role.requests.some((r) => r.status === 'open');
  const want = {
    landing: hasOrganisers || openRequest ? 'organiser' : 'dancer',
    unfinishedRow: hasOrganisers && fact.kind === 'incomplete',
    menuDancerEntry: (hasOrganisers || openRequest) && fact.kind === 'complete',
  };

  it('the shared mapping says the same', () => {
    expect(
      accountView({ organiserCount: role.organisers, openRequestCount: openRequest ? 1 : 0, dancer: fact.kind }),
    ).toEqual(want);
  });

  it('the account icon (/account) lands where the mapping says', async () => {
    mount(makeBackend(state), '/account');
    if (want.landing === 'organiser') {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      expect(screen.queryByTestId('dancer-home')).toBeNull();
    } else {
      expect(await screen.findByTestId('dancer-home')).toBeTruthy();
      expect(screen.queryByTestId('org-page-home')).toBeNull();
      // (c): the organiser onboarding is there, collapsed.
      expect(screen.getByRole('button', { name: /I organise events/ }).getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('the organiser home: the unfinished-profile row and the account-menu entry', async () => {
    mount(makeBackend(state), '/account/o');
    await organiserHomeSettled();
    const row = screen.queryByTestId('org-dancer-row');
    expect(!!row, 'unfinished-profile row').toBe(want.unfinishedRow);
    if (row) {
      expect(screen.getByTestId('org-dancer-row-fact').textContent).toBe(fact.text);
      expect(screen.getByTestId('org-dancer-row-finish').getAttribute('href')).toBe(finishProfileHref('/account/o'));
    }
    const menuButton = screen.queryByTestId('org-account-menu-button');
    if (want.menuDancerEntry) {
      expect(menuButton).not.toBeNull();
      fireEvent.click(menuButton!);
      expect(screen.getByTestId('org-account-menu-dancer').getAttribute('href')).toBe(DANCER_HOME_PATH);
      expect(screen.getByTestId('org-account-menu-organiser')).toBeTruthy();
    } else {
      expect(menuButton, 'account menu').toBeNull();
    }
    // Nothing else about dancing on the organiser home (a): no second banner or summary.
    expect(screen.queryByTestId('dancer-home')).toBeNull();
    noDanglingCopy();
  });

  it('the dancer home states the one fact, naming exactly the missing fields', async () => {
    mount(makeBackend(state), DANCER_HOME_PATH);
    await screen.findByTestId('dancer-home');
    await waitFor(() => expect(screen.queryByTestId('dancer-home-loading')).toBeNull());
    if (fact.kind === 'incomplete') {
      const line = screen.getByTestId('dancer-home-completeness').textContent!;
      expect(line).toBe(fact.text);
      for (const f of Object.keys(PROFILE_FIELD_LABEL) as ProfileField[]) {
        expect(line.includes(PROFILE_FIELD_LABEL[f]), f).toBe(fact.missing.includes(f));
      }
      expect(screen.getByRole('link', { name: 'Finish your profile' }).getAttribute('href')).toBe(finishProfileHref(DANCER_HOME_PATH));
    } else if (fact.kind === 'complete') {
      expect(screen.getByTestId('dancer-home-completeness').textContent).toBe(fact.text);
      expect(screen.queryByRole('link', { name: 'Finish your profile' })).toBeNull();
      expect(screen.getByTestId('dancer-home-name').textContent).toBe(FULL.first_name);
      expect(screen.getByTestId('dancer-home-details').textContent).toContain(CITY.name);
    } else {
      expect(screen.getByTestId('dancer-home-no-profile').textContent).toContain(fact.text);
      expect(screen.queryByRole('link', { name: 'Finish your profile' })).toBeNull();
    }
    expect(screen.getByRole('link', { name: /My attendance/ }).getAttribute('href')).toBe('/account/attendance');
    expect(screen.getByRole('link', { name: /Browse parties/ }).getAttribute('href')).toBe('/city/london-gb/parties');
    noDanglingCopy();
  });

  it('the Finish screen states the same fact and asks for exactly those fields', async () => {
    mount(makeBackend(state), finishProfileHref('/account'));
    if (fact.kind === 'incomplete') {
      await screen.findByRole('button', { name: 'Save' });
      expect(document.body.textContent).toContain(fact.text);
      const asked: Record<ProfileField, boolean> = {
        first_name: !!screen.queryByLabelText(/first name/i),
        based_city_id: !!screen.queryByRole('button', { name: 'Pick city' }),
        dance_role: !!screen.queryByRole('radiogroup'),
        avatar_url: !!screen.queryByRole('button', { name: 'Upload photo' }),
      };
      for (const f of Object.keys(asked) as ProfileField[]) expect(asked[f], f).toBe(fact.missing.includes(f));
    } else {
      expect(await screen.findByText(fact.text)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    }
  });

  it('the rating card states the same fact (or is open when complete)', async () => {
    mount(makeBackend(state), '/event/ev1');
    const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
    if (fact.kind === 'complete') {
      await waitFor(() => expect(tile.disabled).toBe(false));
      expect(screen.queryByTestId('level-rating-gate')).toBeNull();
    } else {
      await waitFor(() => expect(tile.disabled).toBe(true));
      expect(screen.getByTestId('level-rating-gate').textContent).toContain(`${fact.reason}.`);
    }
  });
});

describe('layout D edges', () => {
  const organiserStub: BackendState = { row: { ...ROW_SHAPES[1].row! }, organisers: 1, requests: [] };

  it('the organiser-home row is skippable for the rest of the session', async () => {
    mount(makeBackend(organiserStub), '/account/o');
    await organiserHomeSettled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.queryByTestId('org-dancer-row')).toBeNull();
    cleanup();
    mount(makeBackend(organiserStub), '/account/o');
    await organiserHomeSettled();
    expect(screen.queryByTestId('org-dancer-row')).toBeNull();
  });

  it('an organiser on their dancer profile gets a way back, not the organiser onboarding', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 1, requests: [] }), DANCER_HOME_PATH);
    expect(await screen.findByTestId('dancer-home-organiser-link')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I organise events/ })).toBeNull();
  });

  it('an old /account link with an organiser key keeps going to the organiser area', async () => {
    mount(makeBackend({ row: null, organisers: 0, requests: [] }), '/account?from=email');
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('a shared link with only tracking params is still the dancer home', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [] }), '/account?utm_source=whatsapp&fbclid=abc');
    expect(await screen.findByTestId('dancer-home')).toBeTruthy();
  });

  it('a summary read older than the completeness answer never contradicts it', async () => {
    const backend = makeBackend({ row: { ...FULL, dance_role: null }, organisers: 0, requests: [] });
    h.backend = backend;
    const qc = client();
    qc.setQueryData(myDancerSummaryQueryKey('u1'), {
      id: 'persona-1', firstName: 'Ana', cityName: 'London', danceRole: 'Leader', avatarUrl: 'https://img.example/ana.jpg',
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

  it('a failed organiser read lands on the dancer home and names the organiser area', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [], organiserHomeFails: true }), '/account');
    expect(await screen.findByTestId('dancer-home-organiser-check-failed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the organiser area' })).toBeTruthy();
  });
});
