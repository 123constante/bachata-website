// @vitest-environment jsdom
/**
 * Audit M17: the CityPicker and NationalityPicker comboboxes have an accessible name everywhere.
 * 1. The pickers forward id / aria-label / aria-labelledby to the trigger (real components).
 * 2. Every caller names its combobox: rendered for the dancer-facing screens (setup city card,
 *    Edit, Finish your profile, sign-up), source-level for the heavy organiser/legacy pages.
 * 3. Completeness: every <CityPicker / <NationalityPicker in src is a row of this table.
 * Also M28 on sign-up: the one shared "Message us to add your city" link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({ completion: null as unknown }));

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
      getUser: async () => ({ data: { user: null } }),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));
vi.mock('@/lib/auth-intent', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth-intent')>()),
  checkAccountExistsByEmail: vi.fn(async () => 'existing'),
}));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserSelfServe: true } };
});
vi.mock('@/lib/analytics', async (orig) => ({ ...(await orig<object>()), trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...(h.completion as object), refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));

// Stand-in pickers that pass the naming props through exactly as the real trigger does (tested below).
type StubProps = { id?: string; 'aria-label'?: string; 'aria-labelledby'?: string; placeholder?: string };
const s = vi.hoisted(() => ({
  stub: (fallback: string) => (p: StubProps) => (
    <button type="button" role="combobox" aria-expanded={false} id={p.id} aria-label={p['aria-label']} aria-labelledby={p['aria-labelledby']}>
      {p.placeholder ?? fallback}
    </button>
  ),
}));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: s.stub('Select city') }));
vi.mock('@/components/ui/nationality-picker', () => ({ NationalityPicker: s.stub('Select nationality') }));

import { CityCard } from '@/modules/dancer-app/screens/onboarding/steps';
import { makeProfile } from '@/modules/dancer-app/api/fixtures';
import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { setTestUser } from '@/modules/dancer-app/shell/testAuth';
import { FinishProfileScreen } from '@/pages/FinishProfile';
import Auth from '@/pages/Auth';
import { ADD_CITY_MESSAGE, dancerMessageUsUrl } from '@/lib/contactLinks';

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  resetShell();
});

describe('M17: the pickers forward id / aria-label / aria-labelledby to the combobox', () => {
  const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const PICKERS = [
    ['CityPicker', async () => (await vi.importActual<typeof import('@/components/ui/city-picker')>('@/components/ui/city-picker')).CityPicker],
    ['NationalityPicker', async () => (await vi.importActual<typeof import('@/components/ui/nationality-picker')>('@/components/ui/nationality-picker')).NationalityPicker],
  ] as const;
  for (const [name, load] of PICKERS) {
    it(`${name}: id + aria-label`, async () => {
      const Picker = (await load()) as unknown as (p: Record<string, unknown>) => JSX.Element;
      render(<QueryClientProvider client={qc()}><Picker id="pick-x" aria-label="Your city" onChange={() => {}} /></QueryClientProvider>);
      expect(screen.getByRole('combobox', { name: 'Your city' }).id).toBe('pick-x');
    });
    it(`${name}: a <label htmlFor> names it through the id`, async () => {
      const Picker = (await load()) as unknown as (p: Record<string, unknown>) => JSX.Element;
      render(
        <QueryClientProvider client={qc()}>
          <label htmlFor="pick-y">Home city</label>
          <Picker id="pick-y" onChange={() => {}} />
        </QueryClientProvider>,
      );
      expect(screen.getByRole('combobox', { name: 'Home city' })).toBeTruthy();
    });
    it(`${name}: aria-labelledby`, async () => {
      const Picker = (await load()) as unknown as (p: Record<string, unknown>) => JSX.Element;
      render(
        <QueryClientProvider client={qc()}>
          <p id="lbl-z">Where you dance</p>
          <Picker aria-labelledby="lbl-z" onChange={() => {}} />
        </QueryClientProvider>,
      );
      expect(screen.getByRole('combobox', { name: 'Where you dance' })).toBeTruthy();
    });
  }
});

describe('M17: every caller names its combobox (rendered)', () => {
  it('setup city card: "Your city"', async () => {
    render(<CityCard profile={makeProfile({ first_name: 'Ana' })} busy={false} error={null} onSubmit={() => {}} />);
    expect(await screen.findByRole('combobox', { name: 'Your city' })).toBeTruthy();
  });

  it('Edit: "City" and "Nationality"; ?focus=city lands on the city combobox', async () => {
    renderInShell({ path: '/app/me/edit?focus=city', backend: { shape: 'fourFieldComplete' } });
    const city = await screen.findByRole('combobox', { name: 'City' });
    expect(screen.getByRole('combobox', { name: 'Nationality' })).toBeTruthy();
    expect(document.activeElement).toBe(city);
  });

  it('Finish your profile: "Your city"', async () => {
    setTestUser({ id: 'u1' });
    h.completion = { status: 'incomplete', missing: ['based_city_id'], profileId: 'persona-B' };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/finish-profile']}>
          <Routes>
            <Route path="/finish-profile" element={<FinishProfileScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('combobox', { name: 'Your city' })).toBeTruthy();
  });

  it('sign-up details: "City", and M28 the shared "Message us to add your city" link', async () => {
    setTestUser(null);
    render(
      <MemoryRouter initialEntries={['/auth?mode=signup']}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^continue as dancer$/i }));
    await screen.findByText('A little about you');
    expect(screen.getByRole('combobox', { name: 'City' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Message us to add your city' });
    expect(link.getAttribute('href')).toBe(dancerMessageUsUrl(ADD_CITY_MESSAGE));
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.parentElement?.textContent).toBe('City not in the list? Message us to add your city');
  });
});

// Source-level rows: pages too heavy to mount here (organiser/vendor screens, legacy dancer pages).
// Each names the combobox with aria-label, or with an id that a <label htmlFor> in the same file targets.
type Row = { file: string; picker: 'CityPicker' | 'NationalityPicker'; ariaLabel?: string; id?: string; rendered?: true };
const ROWS: Row[] = [
  { file: 'src/modules/dancer-app/screens/onboarding/steps.tsx', picker: 'CityPicker', id: 'ob-city', rendered: true },
  { file: 'src/modules/dancer-app/screens/edit/EditScreen.tsx', picker: 'CityPicker', id: 'based_city_id', rendered: true },
  { file: 'src/modules/dancer-app/screens/edit/EditScreen.tsx', picker: 'NationalityPicker', id: 'nationality', rendered: true },
  { file: 'src/pages/FinishProfile.tsx', picker: 'CityPicker', id: 'finish-city', rendered: true },
  { file: 'src/pages/Auth.tsx', picker: 'CityPicker', id: 'signup-city', rendered: true },
  { file: 'src/components/auth/AuthStepper.tsx', picker: 'CityPicker', id: 'stepper-city' },
  { file: 'src/pages/Onboarding.tsx', picker: 'CityPicker', id: 'onboarding-city' },
  { file: 'src/pages/EditProfile.tsx', picker: 'CityPicker', id: 'edit-profile-city' },
  { file: 'src/pages/EditProfile.tsx', picker: 'NationalityPicker', id: 'edit-profile-nationality' },
  { file: 'src/components/profile/DancerDashboard.tsx', picker: 'CityPicker', ariaLabel: 'City' },
  { file: 'src/pages/CreateVideographerProfile.tsx', picker: 'CityPicker', ariaLabel: 'City' },
  { file: 'src/pages/OrganiserProfile.tsx', picker: 'CityPicker', id: 'city' },
  { file: 'src/pages/VendorDashboardPage.tsx', picker: 'CityPicker', ariaLabel: 'City' },
  { file: 'src/pages/VendorPortal.tsx', picker: 'CityPicker', ariaLabel: 'City' },
];

const ROOT = path.resolve(__dirname, '../../../..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');
/** The JSX elements `<Picker ... />` in a file, in order. */
const elements = (src: string, picker: string) => src.match(new RegExp(`<${picker}\\b[\\s\\S]*?/>`, 'g')) ?? [];

describe('M17: every caller names its combobox (source)', () => {
  it.each(ROWS.map((r) => [`${r.file} ${r.picker}`, r] as const))('%s', (_n, row) => {
    const src = read(row.file);
    const [el, ...more] = elements(src, row.picker);
    expect(more).toHaveLength(0);
    const attr = (name: string, v: string) => new RegExp(`\\s${name}=["']${v}["']`, 'g');
    if (row.ariaLabel) expect(el).toMatch(attr('aria-label', row.ariaLabel));
    if (row.id) {
      expect(el).toMatch(attr('id', row.id));
      // A label targets it (the dancer-app Field component renders <label htmlFor={id}>).
      const viaField = src.includes(`<Field id="${row.id}"`);
      expect(viaField || attr('htmlFor', row.id).test(src)).toBe(true);
      // No other element in the file holds the same id (the old wrapper-div label targets).
      expect(src.match(attr('id', row.id))?.length).toBe(viaField ? 2 : 1);
    }
  });

  it('completeness: every <CityPicker / <NationalityPicker in src is a row', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(path.join(ROOT, rel)).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(rel);
        } else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
          const src = read(rel);
          for (const p of ['CityPicker', 'NationalityPicker']) for (const _ of elements(src, p)) found.push(`${rel} ${p}`);
        }
      }
    };
    walk('src');
    expect(found.sort()).toEqual(ROWS.map((r) => `${r.file} ${r.picker}`).sort());
  });
});
