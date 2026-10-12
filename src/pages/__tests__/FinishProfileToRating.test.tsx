// @vitest-environment jsdom
/**
 * The launch path for the first dancers, end to end in one router and one
 * query cache (the app's own wiring: ProfileCompletionChrome publishes the
 * gate, the rating card reads it):
 *
 *   event page, profile unfinished -> rating tiles disabled WITH the reason and
 *   a "Finish your profile" link that carries returnTo for THIS event ->
 *   Finish screen (an untouched form sends nothing) -> save -> back on the
 *   same event, signed in, tiles live, no stale gate -> a rating is sent.
 *
 * The server gate (rate_series_level_p5_v1 refusing 'profile_incomplete') is
 * modelled, not changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeBackend, CITY, type Backend, type DancerRow } from './helpers/dancerBackend';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown } }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: { id: 'u1', email: 'ana@example.com' }, session: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
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

import { FinishProfileScreen } from '../FinishProfile';
import ProfileCompletionChrome from '@/components/profile/ProfileCompletionChrome';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { completenessFact } from '@/lib/profileCompletion';

let where = '';
const Where = () => {
  const l = useLocation();
  useEffect(() => {
    where = `${l.pathname}${l.search}${l.hash}`;
  });
  return null;
};

/** The app's own wiring. Set h.backend before rendering it. */
function App() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [gate, setGate] = useState<ProfileGateValue | null | 'loading'>('loading');
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/event/ev1?occ=2']}>
        <Where />
        <ProfileGateContext.Provider value={gate}>
          <ProfileCompletionChrome onGate={setGate} />
          <Routes>
            <Route path="/event/:id" element={<LevelRatingPrompt seriesId="ev1" />} />
            <Route path="/finish-profile" element={<FinishProfileScreen />} />
            <Route path="/auth" element={<p data-testid="sign-in">sign in</p>} />
          </Routes>
        </ProfileGateContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const tile = () => screen.getByTestId('level-rating-mixed') as HTMLButtonElement;
const saves = (b: Backend) => b.calls.filter((c) => c.name === 'save_my_dancer_profile_v1');

const ROW: DancerRow = { first_name: 'Ana', based_city_id: CITY.id, dance_role: 'Follower', avatar_url: null, archived_at: null };

const scrolled = vi.fn();
beforeEach(() => {
  // jsdom has no layout; the card scrolls itself into view on #level-rating.
  scrolled.mockReset();
  Element.prototype.scrollIntoView = scrolled;
  sessionStorage.clear();
  localStorage.clear();
  where = '';
});
afterEach(cleanup);

describe('unfinished profile -> finish -> rate', () => {
  it('lands back on the same event with the rating tiles usable', async () => {
    const backend = makeBackend({ row: { ...ROW }, organisers: 0, requests: [] });
    h.backend = backend;
    render(<App />);

    // 1. Gated, with the reason and a way forward that comes back HERE.
    await screen.findByTestId('level-rating-mixed');
    await waitFor(() => expect(tile().disabled).toBe(true));
    // The card names the missing field in the same words as every other surface.
    expect(screen.getByTestId('level-rating-gate').textContent).toContain(
      completenessFact({ status: 'incomplete', missing: ['avatar_url'] }).reason,
    );
    const link = screen.getByRole('link', { name: 'Finish your profile' });
    expect(link.getAttribute('href')).toBe(`/finish-profile?returnTo=${encodeURIComponent('/event/ev1?occ=2#level-rating')}`);

    // 2. The Finish screen: Save is disabled with a reason, and submitting anyway sends nothing.
    fireEvent.click(link);
    const save = (await screen.findByRole('button', { name: 'Save' })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText('Fill in at least one field above to save.')).toBeTruthy();
    fireEvent.submit(save.closest('form')!);
    await new Promise((r) => setTimeout(r, 20));
    expect(saves(backend)).toEqual([]);

    // 3. Finish it.
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(where).toBe('/event/ev1?occ=2#level-rating'));
    expect(saves(backend)).toHaveLength(1);
    expect(screen.queryByTestId('sign-in')).toBeNull();

    // 4. Back on the event: no stale "Finish your profile to rate", tiles live.
    await screen.findByTestId('level-rating-mixed');
    await waitFor(() => expect(tile().disabled).toBe(false));
    expect(screen.queryByTestId('level-rating-gate')).toBeNull();
    expect(screen.queryByTestId('profile-completion-banner')).toBeNull();
    expect(scrolled).toHaveBeenCalled();

    // 5. And a rating goes through the (modelled) server gate.
    fireEvent.click(tile());
    await waitFor(() =>
      expect(backend.calls.filter((c) => c.name === 'rate_series_level_p5_v1').map((c) => c.args)).toEqual([
        { p_series_id: 'ev1', p_level: 'mixed' },
      ]),
    );
  });

  it('a partial save keeps the gate up and says what is still missing', async () => {
    const backend = makeBackend({ row: { ...ROW, dance_role: null }, organisers: 0, requests: [] });
    h.backend = backend;
    render(<App />);
    await screen.findByTestId('level-rating-mixed');
    fireEvent.click(await screen.findByRole('link', { name: 'Finish your profile' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Upload photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved. Still to add: dance role.')).toBeTruthy();
    expect(where.startsWith('/finish-profile')).toBe(true);
  });
});
