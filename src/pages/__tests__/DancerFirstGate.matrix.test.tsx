// @vitest-environment jsdom
/**
 * Dancer first, then organiser (owner decision 2026-10-11, supersedes #718's
 * skippable row): every signed-in account finishes its dancer profile -- all
 * four fields of profile_complete_v1 -- BEFORE any account or organiser page.
 * Layout D (#718) stays for complete profiles. Table-driven over the prod
 * shapes (helpers/dancerBackend.ts):
 *
 *   {no dancer row, stub, partly filled, complete, archived}
 *     x {no organiser, organiser, open access request}
 *
 * Every cell is rendered through the REAL route entries (the lazy pages'
 * default exports, guards included) and one fake backend, and asserts:
 * 1. where /account and /account/o land;
 * 2. a gated page explains itself ("Finish your dancer profile first...");
 * 3. "Skip for now" is absent in gated mode;
 * 4. a complete profile is never gated (the Finish screen is never visited);
 * 5. returnTo round-trips: finishing lands the person where they were going;
 * 6. the completeness fact reads the same on the dancer home, the Finish
 *    screen and the rating card (completenessFact), and no copy names a
 *    control that is not on screen.
 *
 * Written to run unchanged against #718 (v2) too: it imports only what both
 * versions export, so the cells that fail there are the behaviour this changes.
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

import Account, { AccountScreen } from '../Account';
import FinishProfile from '../FinishProfile';
import OrganiserArea from '@/modules/organiser/shell/OrganiserRoutes';
import ProfileCompletionChrome from '@/components/profile/ProfileCompletionChrome';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { myDancerSummaryQueryKey } from '@/hooks/useMyDancerSummary';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import {
  NO_PROFILE_CONTACT_URL,
  PROFILE_FIELD_LABEL,
  completenessFact,
  finishProfileHref,
  missingProfileFields,
  type ProfileCompletion,
  type ProfileField,
} from '@/lib/profileCompletion';

/** The owner's words for the gated Finish screen. Written out, not imported: v2 has no such copy. */
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

/** Every location the router has been at, in order. */
let visited: string[] = [];
function LocationProbe() {
  const { pathname, search } = useLocation();
  const here = `${pathname}${search}`;
  if (visited[visited.length - 1] !== here) visited.push(here);
  return <p data-testid="location">{here}</p>;
}
const location = () => screen.getByTestId('location').textContent ?? '';

const mount = (backend: Backend, at: string) => {
  h.backend = backend;
  visited = [];
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[at]}>
        <LocationProbe />
        {/* The production route table for these paths (components/AnimatedRoutes.tsx). */}
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/account/dancer" element={<Account view="dancer" />} />
          <Route path="/account/o/*" element={<OrganiserArea />} />
          <Route path="/finish-profile" element={<FinishProfile />} />
          <Route path="/event/:id" element={<GateHarness><LevelRatingPrompt seriesId="ev1" /></GateHarness>} />
          {/* Not a route: the dancer home's screen on its own, to read its completeness line for every shape. */}
          <Route path="/test/dancer-screen" element={<AccountScreen view="dancer" />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Copy that names a control -> the control it names. If the words show, the control must too. */
const NAMED_CONTROLS: [RegExp, () => HTMLElement | null][] = [
  [/Skip for now/, () => screen.queryAllByRole('button', { name: /Skip for now/ })[0] ?? null],
  [/message us/i, () => screen.queryAllByRole('link').find((a) => a.getAttribute('href') === NO_PROFILE_CONTACT_URL) ?? null],
  [/Try again/, () => screen.queryAllByRole('button', { name: 'Try again' })[0] ?? null],
  [/I organise events/, () => screen.queryByRole('button', { name: /I organise events/ })],
  [/My attendance/, () => screen.queryByRole('link', { name: /My attendance/ })],
  [/Browse parties/, () => screen.queryByRole('link', { name: /Browse parties/ })],
  [/Fill in at least one field/, () => screen.queryByRole('button', { name: 'Save' })],
];
const noDanglingCopy = () => {
  const text = document.body.textContent ?? '';
  for (const [words, control] of NAMED_CONTROLS) {
    if (words.test(text)) expect(control(), `copy says ${words} but that control is not on screen`).not.toBeNull();
  }
};

/** The gated Finish screen, reached on the way to `target`. */
const expectGated = async (target: string) => {
  await waitFor(() => expect(location()).toBe(finishProfileHref(target)));
  expect(await screen.findByText(GATE_REASON)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Skip for now/ }), 'Skip in gated mode').toBeNull();
  expect(screen.queryByTestId('org-page-home')).toBeNull();
  expect(screen.queryByTestId('dancer-home')).toBeNull();
  noDanglingCopy();
};

/** Fill in every field the Finish screen asks for and save. */
const finishTheForm = async () => {
  await screen.findByRole('button', { name: 'Save' });
  const name = screen.queryByLabelText(/first name/i);
  if (name) fireEvent.change(name, { target: { value: 'Ana' } });
  const city = screen.queryByRole('button', { name: 'Pick city' });
  if (city) fireEvent.click(city);
  if (screen.queryByRole('radiogroup')) fireEvent.click(screen.getByRole('radio', { name: 'Follower' }));
  const photo = screen.queryByRole('button', { name: 'Upload photo' });
  if (photo) fireEvent.click(photo);
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
  const state = (): BackendState => ({ row: shape.row ? { ...shape.row } : null, organisers: role.organisers, requests: role.requests });
  const fact = completenessFact(serverSays(shape.row));
  // The owner's rule written out here, NOT read from lib/accountRouting.
  const gated = fact.kind !== 'complete';
  const organiserSide = role.organisers > 0 || role.requests.some((r) => r.status === 'open');
  // Can this person finish here? Only a resolvable row can be saved; no row / archived is "message us".
  const fillable = fact.kind === 'incomplete';

  it('/account: gated until the dancer profile is complete, then layout D', async () => {
    mount(makeBackend(state()), '/account');
    if (gated) {
      await expectGated('/account');
      return;
    }
    if (organiserSide) {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      expect(screen.queryByTestId('dancer-home')).toBeNull();
    } else {
      expect(await screen.findByTestId('dancer-home')).toBeTruthy();
      expect(screen.getByRole('button', { name: /I organise events/ }).getAttribute('aria-expanded')).toBe('false');
    }
    expect(visited.some((v) => v.startsWith('/finish-profile')), 'a complete profile is never gated').toBe(false);
  });

  it('/account/o (the organiser home): gated the same way, never a skippable row', async () => {
    mount(makeBackend(state()), '/account/o');
    if (gated) {
      await expectGated('/account/o');
      return;
    }
    await screen.findByTestId('org-page-home');
    await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('org-dancer-row')).toBeNull();
    expect(screen.queryByRole('button', { name: /Skip for now/ })).toBeNull();
    expect(visited.some((v) => v.startsWith('/finish-profile')), 'a complete profile is never gated').toBe(false);
    noDanglingCopy();
  });

  it('/account/dancer: gated the same way', async () => {
    mount(makeBackend(state()), '/account/dancer');
    if (gated) {
      await expectGated('/account/dancer');
      return;
    }
    expect(await screen.findByTestId('dancer-home')).toBeTruthy();
    expect(visited.some((v) => v.startsWith('/finish-profile'))).toBe(false);
  });

  it('returnTo round-trips: finishing lands on the page they wanted', async () => {
    const backend = makeBackend(state());
    mount(backend, '/account/o');
    if (!gated) {
      expect(await screen.findByTestId('org-page-home')).toBeTruthy();
      return;
    }
    await expectGated('/account/o');
    if (!fillable) {
      // No row, or archived: nothing to fill in. The way forward is named and on screen; no Skip, no loop back.
      expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === NO_PROFILE_CONTACT_URL)).toBe(true);
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      return;
    }
    await finishTheForm();
    await waitFor(() => expect(location()).toBe('/account/o'));
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
    expect(backend.calls.some((c) => c.name === 'save_my_dancer_profile_v1')).toBe(true);
  });

  it('the dancer home states the one fact, naming exactly the missing fields', async () => {
    mount(makeBackend(state()), '/test/dancer-screen');
    await screen.findByTestId('dancer-home');
    await waitFor(() => expect(screen.queryByTestId('dancer-home-loading')).toBeNull());
    if (fact.kind === 'incomplete') {
      const line = screen.getByTestId('dancer-home-completeness').textContent!;
      expect(line).toBe(fact.text);
      for (const f of Object.keys(PROFILE_FIELD_LABEL) as ProfileField[]) {
        expect(line.includes(PROFILE_FIELD_LABEL[f]), f).toBe(fact.missing.includes(f));
      }
    } else if (fact.kind === 'complete') {
      expect(screen.getByTestId('dancer-home-completeness').textContent).toBe(fact.text);
      expect(screen.getByTestId('dancer-home-name').textContent).toBe(FULL.first_name);
      expect(screen.getByTestId('dancer-home-details').textContent).toContain(CITY.name);
    } else {
      expect(screen.getByTestId('dancer-home-no-profile').textContent).toContain(fact.text);
    }
  });

  it('the Finish screen states the same fact and asks for exactly those fields', async () => {
    mount(makeBackend(state()), finishProfileHref('/account'));
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
    noDanglingCopy();
  });

  it('public pages stay open: the event page and its rating card (the same fact)', async () => {
    mount(makeBackend(state()), '/event/ev1');
    const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
    if (fact.kind === 'complete') {
      await waitFor(() => expect(tile.disabled).toBe(false));
      expect(screen.queryByTestId('level-rating-gate')).toBeNull();
    } else {
      await waitFor(() => expect(tile.disabled).toBe(true));
      expect(screen.getByTestId('level-rating-gate').textContent).toContain(`${fact.reason}.`);
    }
    expect(location()).toBe('/event/ev1');
  });
});

describe('the gate: entries and edges', () => {
  const stub = ROW_SHAPES[1].row!;

  it('an organiser-intent sign-up lands on the gate, then continues to organiser onboarding', async () => {
    // AuthCallback navigates to landingPathAfterAuth(); a non-dancer role means "set up an organiser".
    const landing = landingPathAfterAuth({ organiserSelfServe: true, role: 'organiser', managesOrganiser: null });
    expect(landing).toBe('/account/o');
    mount(makeBackend({ row: { ...stub }, organisers: 0, requests: [] }), landing);
    await expectGated('/account/o');
    await finishTheForm();
    await waitFor(() => expect(location()).toBe('/account/o'));
    // The organiser onboarding (claim / request / create), with nothing about the dancer profile.
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
    expect(screen.queryByTestId('org-dancer-row')).toBeNull();
  });

  it('a role-less sign-in of an unfinished organiser lands on the gate', async () => {
    const landing = landingPathAfterAuth({ organiserSelfServe: true, role: null, managesOrganiser: true });
    mount(makeBackend({ row: { ...stub }, organisers: 1, requests: [] }), landing);
    await expectGated(landing);
  });

  it('a deep organiser link keeps its whole address through the gate', async () => {
    const deep = '/account/o/events/new?o=org-0';
    mount(makeBackend({ row: { ...stub }, organisers: 1, requests: [] }), deep);
    await expectGated(deep);
  });

  it('an old /account?from=email link is gated too, and goes on to the organiser area after', async () => {
    mount(makeBackend({ row: { ...stub }, organisers: 0, requests: [] }), '/account?from=email');
    await expectGated('/account?from=email');
    await finishTheForm();
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('a plain /finish-profile visit (the rating card) keeps Skip for now', async () => {
    mount(makeBackend({ row: { ...stub }, organisers: 0, requests: [] }), finishProfileHref('/event/ev1#level-rating'));
    expect(await screen.findByRole('button', { name: /Skip for now/ })).toBeTruthy();
    expect(screen.queryByText(GATE_REASON)).toBeNull();
  });

  it('an organiser on their dancer profile gets a way back, not the organiser onboarding', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 1, requests: [] }), '/account/dancer');
    expect(await screen.findByTestId('dancer-home-organiser-link')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /I organise events/ })).toBeNull();
  });

  it('a shared link with only tracking params is still the dancer home', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [] }), '/account?utm_source=whatsapp&fbclid=abc');
    expect(await screen.findByTestId('dancer-home')).toBeTruthy();
  });

  it('a summary read older than the completeness answer never contradicts it', async () => {
    h.backend = makeBackend({ row: { ...FULL, dance_role: null }, organisers: 0, requests: [] });
    const qc = client();
    qc.setQueryData(myDancerSummaryQueryKey('u1'), {
      id: 'persona-1', firstName: 'Ana', cityName: 'London', danceRole: 'Leader', avatarUrl: 'https://img.example/ana.jpg',
    });
    qc.setQueryDefaults(myDancerSummaryQueryKey('u1'), { staleTime: Infinity });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/test/dancer-screen']}>
          <Routes>
            <Route path="/test/dancer-screen" element={<AccountScreen view="dancer" />} />
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
