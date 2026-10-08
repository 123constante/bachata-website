// @vitest-environment jsdom
/** Profile page (W4): load, edit, save through the one RPC wrapper, refusal + shake copy, sign out. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), save: vi.fn(), signOut: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: api.signOut }) }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser-self-serve/selfServeApi')),
  fetchOrganiserHome: api.home,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOrganiserEntity: api.entity,
}));
vi.mock('@/lib/organiserProfileUpdate', async () => ({
  ...(await vi.importActual<object>('@/lib/organiserProfileUpdate')),
  saveOrganiserProfile: api.save,
}));

import ProfilePage from '../index';
import { formFromEntity, instagramHandle } from '../profileForm';

const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] };
const ENTITY = {
  id: 'org-1', name: 'Ritmo', avatar_url: null, bio: 'Salsa and bachata in Leeds', claimed_by: 'u1',
  socials: { facebook: 'ritmofb' }, city_id: 'c1', instagram: 'https://instagram.com/ritmoleeds', website: null,
  contact_email: 'me@x.example', contact_phone: '0113 000', organisation_category: 'school', founded_year: 2015,
  cities: { name: 'Leeds', slug: 'leeds' },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/profile']}>
        <Routes>
          <Route path="/account/o/profile" element={<ProfilePage />} />
          <Route path="/" element={<p data-testid="landed-root">root</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.home.mockReset().mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.save.mockReset().mockResolvedValue({ error: null });
  api.signOut.mockReset();
});
afterEach(cleanup);

describe('profile edit', () => {
  it('shows the stored profile, its Instagram handle and the public card preview', async () => {
    mount();
    expect(((await screen.findByTestId('profile-name')) as HTMLTextAreaElement).value).toBe('Ritmo');
    expect(screen.getByTestId('profile-instagram-value').textContent).toBe('@ritmoleeds');
    expect(screen.getByTestId('profile-preview').textContent).toContain('Leeds · @ritmoleeds');
    expect(screen.getByText('Guests see changes to live events straight away.')).toBeTruthy();
    expect((screen.getByTestId('profile-bar-action') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves the whole form through organiser_profile_update_p5_v1, keeping the fields it does not show', async () => {
    mount();
    fireEvent.change(await screen.findByTestId('profile-name'), { target: { value: 'Ritmo Leeds' } });
    fireEvent.click(screen.getByTestId('profile-instagram'));
    fireEvent.change(await screen.findByTestId('profile-field'), { target: { value: '@ritmo.leeds' } });
    fireEvent.click(screen.getByTestId('profile-sheet-done'));
    expect(screen.getByTestId('profile-preview-name').textContent).toBe('Ritmo Leeds');
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [, id, form, cityId] = api.save.mock.calls[0];
    expect(id).toBe('org-1');
    expect(cityId).toBe('c1');
    expect(form).toMatchObject({ name: 'Ritmo Leeds', instagram: '@ritmo.leeds', facebook: 'ritmofb', contact_phone: '0113 000', organisation_category: 'school', founded_year: '2015' });
    await waitFor(() => expect(screen.getByTestId('profile-bar-action').textContent).toContain('Saved'));
  });

  it('a refused save shakes the bar and says why in plain words', async () => {
    api.save.mockResolvedValue({ error: { message: 'organiser_name_taken: Ritmo' } });
    mount();
    fireEvent.change(await screen.findByTestId('profile-name'), { target: { value: 'Sabor' } });
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    expect((await screen.findByTestId('profile-save-error')).textContent).toBe('Another organiser already uses this name. Please choose a different one.');
    expect(screen.getByTestId('profile-bar-action').textContent).toContain('Save profile');
  });

  it('an empty name is refused before the server is asked', async () => {
    mount();
    fireEvent.change(await screen.findByTestId('profile-name'), { target: { value: '  ' } });
    fireEvent.click(screen.getByTestId('profile-bar-action'));
    expect((await screen.findByTestId('profile-save-error')).textContent).toBe('Please enter a name.');
    expect(api.save).not.toHaveBeenCalled();
  });

  it('load error offers a retry; no organiser still shows the account card', async () => {
    api.entity.mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByTestId('profile-load-error-retry'));
    expect(await screen.findByTestId('profile-name')).toBeTruthy();
    cleanup();
    api.home.mockResolvedValue({ today: '', organisers: [] });
    mount();
    expect(await screen.findByTestId('profile-no-organiser')).toBeTruthy();
    expect(screen.getByTestId('profile-org-count-value').textContent).toBe('0');
  });
});

describe('account and sign out', () => {
  it('shows the signed-in email read-only and the organiser count', async () => {
    mount();
    await screen.findByTestId('profile-name');
    expect(screen.getByTestId('profile-email-value').textContent).toBe('me@x.example');
    expect(screen.getByTestId('profile-email').tagName).toBe('DIV');
    expect(screen.getByTestId('profile-org-count-value').textContent).toBe('1');
  });

  it('asks first, then calls signOut from useAuth and lands on the start page', async () => {
    api.signOut.mockResolvedValue('signed-out');
    mount();
    fireEvent.click(await screen.findByTestId('profile-signout'));
    expect(api.signOut).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('signout-yes'));
    await waitFor(() => expect(api.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('landed-root')).toBeTruthy();
  });

  it('a failed sign-out stays and says so', async () => {
    api.signOut.mockResolvedValue('failed');
    mount();
    fireEvent.click(await screen.findByTestId('profile-signout'));
    fireEvent.click(await screen.findByTestId('signout-yes'));
    expect((await screen.findByTestId('signout-error')).textContent).toContain('Sign-out did not complete');
  });
});

describe('profileForm', () => {
  it('reads Instagram handles from @, bare and URL forms', () => {
    expect(instagramHandle('@ritmo')).toBe('ritmo');
    expect(instagramHandle('ritmo')).toBe('ritmo');
    expect(instagramHandle('https://www.instagram.com/ritmo/?hl=en')).toBe('ritmo');
    expect(instagramHandle('  ')).toBe('');
  });

  it('falls back to socials for links', () => {
    const f = formFromEntity({ ...ENTITY, instagram: null, socials: { instagram: '@x', website: 'https://x.example', facebook: null } } as never);
    expect(f.instagram).toBe('@x');
    expect(f.website).toBe('https://x.example');
    expect(f.facebook).toBe('');
  });
});
