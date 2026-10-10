// @vitest-environment jsdom
/**
 * Finish your profile: asks for exactly the missing fields, saves only what was
 * filled through the one own-profile write path (save_my_dancer_profile_v1),
 * sends nothing for an untouched form, and "Skip for now" lasts the session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ProfileCompletion, ProfileField } from '@/lib/profileCompletion';

const h = vi.hoisted(() => ({
  completion: null as unknown as ProfileCompletion,
  after: null as unknown as ProfileCompletion,
  save: vi.fn(),
}));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.after }),
  profileCompletionQueryKey: (id: string) => ['profile-completion', id],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/saveMyDancerProfile', () => ({ saveMyDancerProfile: h.save }));
// The route's guard (signed-out -> /auth) is AuthGuard's own, tested with it; the screen is tested here.
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'London' })}>Pick city</button>
  ),
}));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ onChange, userId }: { onChange: (u: string) => void; userId: string }) => (
    <button type="button" data-user={userId} onClick={() => onChange('https://img.example/a.jpg')}>Upload photo</button>
  ),
}));

import { FinishProfileScreen as FinishProfile } from '../FinishProfile';
import { SKIP_FINISH_PROFILE_KEY } from '@/lib/profileCompletion';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';

let path = '';
const Probe = () => {
  const l = useLocation();
  useEffect(() => {
    path = `${l.pathname}${l.search}`;
  });
  return null;
};
const mount = (at = `/finish-profile?returnTo=${encodeURIComponent('/event/e1#level-rating')}`) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Probe />
        <Routes>
          <Route path="/finish-profile" element={<FinishProfile />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const inc = (missing: ProfileField[]): ProfileCompletion => ({ status: 'incomplete', missing, profileId: 'persona-B' });
const FIELD_UI: Record<ProfileField, () => HTMLElement | null> = {
  first_name: () => screen.queryByLabelText(/first name/i),
  based_city_id: () => screen.queryByRole('button', { name: 'Pick city' }),
  dance_role: () => screen.queryByRole('radiogroup', { name: /dance role/i }),
  avatar_url: () => screen.queryByRole('button', { name: 'Upload photo' }),
};
const ALL: ProfileField[] = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'];

beforeEach(() => {
  sessionStorage.clear();
  path = '';
  h.save.mockReset().mockResolvedValue({});
  h.after = inc(['avatar_url']);
});
afterEach(cleanup);

describe.each([
  ['missing first name', ['first_name']],
  ['missing city', ['based_city_id']],
  ['missing dance role', ['dance_role']],
  ['missing photo', ['avatar_url']],
  ['missing role + photo', ['dance_role', 'avatar_url']],
  ['all missing', ALL],
] as [string, ProfileField[]][])('%s', (_n, missing) => {
  it('shows exactly the missing fields', () => {
    h.completion = inc(missing);
    mount();
    for (const f of ALL) expect(Boolean(FIELD_UI[f]())).toBe(missing.includes(f));
  });

  it('untouched: Save is disabled with a reason and sends no command', () => {
    h.completion = inc(missing);
    mount();
    const save = screen.getByRole('button', { name: /^save/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText(/fill in at least one/i)).toBeTruthy();
    fireEvent.click(save);
    expect(h.save).not.toHaveBeenCalled();
  });
});

it('saves only the fields filled in, with the exact stored dance-role value', async () => {
  h.completion = inc(['dance_role', 'avatar_url']);
  mount();
  fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ dance_role: 'Lead and Follow' }));
  // Still missing the photo: stays, and says what is left.
  await waitFor(() => expect(screen.getByText(/still missing: photo/i)).toBeTruthy());
  expect(path.startsWith('/finish-profile')).toBe(true);
});

it('photo upload uses the resolved persona id, and a save that completes the profile goes back', async () => {
  h.completion = inc(['avatar_url']);
  h.after = { status: 'complete', missing: [], profileId: 'persona-B' };
  mount();
  const upload = screen.getByRole('button', { name: 'Upload photo' });
  expect(upload.getAttribute('data-user')).toBe('persona-B');
  fireEvent.click(upload);
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ avatar_url: 'https://img.example/a.jpg' }));
  await waitFor(() => expect(path).toBe('/event/e1'));
});

it('whitespace-only first name is not a value', () => {
  h.completion = inc(['first_name']);
  mount();
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '   ' } });
  expect((screen.getByRole('button', { name: /^save/i }) as HTMLButtonElement).disabled).toBe(true);
});

it('Skip for now: remembered for the session, back to where they were', async () => {
  h.completion = inc(ALL);
  mount();
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
  expect(sessionStorage.getItem(SKIP_FINISH_PROFILE_KEY)).toBe('1');
  await waitFor(() => expect(path).toBe('/event/e1'));
  expect(h.save).not.toHaveBeenCalled();
});

it.each([
  ['Skip for now', inc(ALL), /skip for now/i],
  ['Continue', { status: 'complete', missing: [], profileId: 'persona-B' } as ProfileCompletion, /continue/i],
] as const)('returnTo pointing back at this screen: %s goes home, not round in a loop', async (_name, c, button) => {
  h.completion = c;
  mount(`/finish-profile?returnTo=${encodeURIComponent('/finish-profile')}`);
  fireEvent.click(screen.getByRole('button', { name: button }));
  await waitFor(() => expect(path).toBe('/'));
});

it('complete: says so and offers Continue, no form', () => {
  h.completion = { status: 'complete', missing: [], profileId: 'persona-B' };
  mount();
  expect(screen.getByText(/your profile is complete/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
  expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
});

it('no profile row: explains, offers the WhatsApp contact, no form that cannot save', () => {
  h.completion = { status: 'no_profile', missing: ALL, profileId: null };
  mount();
  expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
  expect(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')).toBe(WHATSAPP_GET_LISTED_URL);
});

it('a failed save says so and keeps what they typed', async () => {
  h.completion = inc(['first_name']);
  h.save.mockRejectedValue(new Error('boom'));
  mount();
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/couldn.t save/i));
  expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Ana');
});
