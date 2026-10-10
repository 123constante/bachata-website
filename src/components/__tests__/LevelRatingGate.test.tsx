// @vitest-environment jsdom
/**
 * The party-rating card x profile completeness. An unfinished profile must see
 * the rating tiles DISABLED WITH A REASON and a link to the Finish-your-profile
 * screen -- never tiles that look live and then fail. UI gate only:
 * rate_series_level_p5_v1 does not check completeness (server enforcement is an
 * admin-repo follow-up).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const h = vi.hoisted(() => ({
  user: { id: 'u1' } as null | { id: string },
  completion: null as unknown as ProfileCompletion,
  rate: vi.fn(),
  toast: vi.fn(),
}));
// The real module too: it also exports ProfileGateContext, which LevelRatingPrompt reads.
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user }),
}));
vi.mock('sonner', () => ({ toast: { error: h.toast } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args: unknown) =>
      name === 'rate_series_level_p5_v1'
        ? h.rate(args)
        : Promise.resolve({
            data: { series_id: 'ev1', vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null },
            error: null,
          }),
  },
}));

import { LevelRatingPrompt } from '../LevelRatingPrompt';
import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue } from '@/lib/profileCompletion';
import { PENDING_LEVEL_RATING_KEY } from '@/lib/pendingLevelRating';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';

const ALL = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'] as const;
const SHAPES: { name: string; c: ProfileCompletion; blocked: boolean }[] = [
  { name: 'complete', c: { status: 'complete', missing: [], profileId: 'p1' }, blocked: false },
  { name: 'missing first name', c: { status: 'incomplete', missing: ['first_name'], profileId: 'p1' }, blocked: true },
  { name: 'missing city', c: { status: 'incomplete', missing: ['based_city_id'], profileId: 'p1' }, blocked: true },
  { name: 'missing dance role', c: { status: 'incomplete', missing: ['dance_role'], profileId: 'p1' }, blocked: true },
  { name: 'missing photo', c: { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' }, blocked: true },
  { name: 'all missing', c: { status: 'incomplete', missing: [...ALL], profileId: 'p1' }, blocked: true },
  { name: 'no profile row', c: { status: 'no_profile', missing: [...ALL], profileId: null }, blocked: true },
  { name: 'check still loading', c: { status: 'loading', missing: [], profileId: null }, blocked: false },
  { name: 'check failed', c: { status: 'error', missing: [], profileId: null }, blocked: false },
];

const mount = (compact = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/ev1?occ=2']}>
        {/* What AppChrome provides from ProfileCompletionChrome's onGate. */}
        <ProfileGateContext.Provider value={profileGateValue(h.completion)}>
          <LevelRatingPrompt seriesId="ev1" compact={compact} />
        </ProfileGateContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  h.user = { id: 'u1' };
  h.rate.mockReset().mockResolvedValue({ data: {}, error: null });
  h.toast.mockReset();
});
afterEach(cleanup);

describe.each([false, true])('compact=%s', (compact) => {
  describe.each(SHAPES)('$name', ({ c, blocked }) => {
    beforeEach(() => {
      h.completion = c;
    });

    it(blocked ? 'tiles disabled, reason + link on screen, a tap sends nothing' : 'tiles live, no reason, a tap rates', async () => {
      mount(compact);
      const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
      expect(tile.disabled).toBe(blocked);
      fireEvent.click(tile);
      await Promise.resolve();
      expect(h.rate).toHaveBeenCalledTimes(blocked ? 0 : 1);

      const reason = screen.queryByTestId('level-rating-gate');
      expect(Boolean(reason)).toBe(blocked);
      if (!blocked) return;
      expect(tile.getAttribute('aria-describedby')).toBe(reason!.id);
      if (c.status === 'incomplete') {
        expect(reason!.textContent).toContain('Finish your profile to rate');
        const link = screen.getByRole('link', { name: /finish (your )?profile/i });
        expect(link.getAttribute('href')).toBe(
          `/finish-profile?returnTo=${encodeURIComponent('/event/ev1?occ=2#level-rating')}`,
        );
      } else {
        expect(screen.getByRole('link', { name: /whatsapp/i }).getAttribute('href')).toBe(WHATSAPP_GET_LISTED_URL);
      }
    });
  });
});

it('a vote stashed before sign-in is held, not sent, while the profile is unfinished', async () => {
  h.completion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
  localStorage.setItem(PENDING_LEVEL_RATING_KEY, JSON.stringify({ seriesId: 'ev1', level: 'strong', at: Date.now() }));
  mount();
  await screen.findByTestId('level-rating-mixed');
  expect(h.rate).not.toHaveBeenCalled();
  expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).not.toBeNull();
});

it('outside any provider (signed out, server render) the gate never blocks', async () => {
  h.completion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/ev1']}>
        <LevelRatingPrompt seriesId="ev1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(((await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByTestId('level-rating-gate')).toBeNull();
});

it('a vote stashed before sign-in is held while the check is loading', async () => {
  h.completion = { status: 'loading', missing: [], profileId: null };
  localStorage.setItem(PENDING_LEVEL_RATING_KEY, JSON.stringify({ seriesId: 'ev1', level: 'strong', at: Date.now() }));
  mount();
  await screen.findByTestId('level-rating-mixed');
  expect(h.rate).not.toHaveBeenCalled();
});
