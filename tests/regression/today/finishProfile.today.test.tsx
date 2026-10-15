// @vitest-environment jsdom
/**
 * TODAY's /finish-profile (src/pages/FinishProfile.tsx), pinned as the accessible
 * tree for every missing-field combination of first name / city / role / photo
 * (15 non-empty subsets) plus the no-profile, error and done modes, at 390x844
 * and desktop. Must pass unchanged on main and on the finished rebuild branch.
 * The behaviour rules (Save disabled until filled, Skip rule) are asserted next
 * to the snapshot so a re-recorded snapshot cannot hide them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ProfileCompletion, ProfileField } from '@/lib/profileCompletion';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({ completion: null as unknown as ProfileCompletion }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: vi.fn().mockResolvedValue({}) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'London' })}>Pick city</button>
  ),
}));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://img.example/a.jpg')}>Upload photo</button>
  ),
}));

import { FinishProfileScreen } from '@/pages/FinishProfile';

const FIELDS: ProfileField[] = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'];
const SUBSETS: ProfileField[][] = Array.from({ length: 15 }, (_, i) => FIELDS.filter((_f, bit) => ((i + 1) >> bit) & 1));

type Row = { name: string; completion: ProfileCompletion; expectForm: boolean };
const ROWS: Row[] = [
  ...SUBSETS.map((missing) => ({
    name: `missing ${missing.join('+')}`,
    completion: { status: 'incomplete', missing, profileId: 'persona-1' } as ProfileCompletion,
    expectForm: true,
  })),
  { name: 'no profile', completion: { status: 'no_profile', missing: FIELDS, profileId: null }, expectForm: false },
  { name: 'complete (done)', completion: { status: 'complete', missing: [], profileId: 'persona-1' }, expectForm: false },
  { name: 'error', completion: { status: 'error', missing: [], profileId: null }, expectForm: false },
  { name: 'loading', completion: { status: 'loading', missing: [], profileId: null }, expectForm: false },
];

const mount = (at: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/finish-profile" element={<FinishProfileScreen />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  installJsdomPolyfills();
  sessionStorage.clear();
});
afterEach(cleanup);

describe.each(VIEWPORTS)('/finish-profile at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it.each(ROWS)('$name', ({ completion, expectForm }) => {
    h.completion = completion;
    mount(`/finish-profile?returnTo=${encodeURIComponent('/event/e1')}`);
    expect(a11yTree()).toMatchSnapshot();
    if (!expectForm) return;
    // Save is disabled until a missing field is filled; nothing is asked that is not missing.
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled, 'Save disabled on an untouched form').toBe(true);
    const asked = {
      first_name: !!screen.queryByLabelText(/first name/i),
      based_city_id: !!screen.queryByRole('button', { name: 'Pick city' }),
      dance_role: !!screen.queryByRole('radiogroup', { name: /dance role/i }),
      avatar_url: !!screen.queryByRole('button', { name: 'Upload photo' }),
    };
    for (const f of FIELDS) expect(asked[f], `${f} asked iff missing`).toBe(completion.missing.includes(f));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.getByText('elsewhere')).toBeTruthy();
  });
});
