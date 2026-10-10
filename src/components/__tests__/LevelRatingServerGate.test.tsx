// @vitest-environment jsdom
/**
 * The SERVER's rating gate. rate_series_level_p5_v1 RAISEs `profile_incomplete`
 * when the caller's persona is not complete (admin migration). The UI gate is
 * the fast path and can be stale (a fail-open check, a cache from before a
 * field was cleared), so the server's refusal must land on the SAME
 * disabled-with-reason state -- "Finish your profile to rate" + link -- with the
 * vote stashed (pendingLevelRating) and never a raw error string on screen.
 *
 * Table: refusal (held, gate shown) x any other error (the existing generic path,
 * unchanged) x success, on both the card and its compact form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const h = vi.hoisted(() => ({
  rate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: { id: 'u1' } }),
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
import { isProfileIncompleteError } from '@/hooks/useSeriesLevelRating';

// The UI gate says "complete" (stale, or the check failed open): only the server knows.
const STALE_COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };

const mount = (compact: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/ev1?occ=2']}>
        <ProfileGateContext.Provider value={profileGateValue(STALE_COMPLETE)}>
          <LevelRatingPrompt seriesId="ev1" compact={compact} />
        </ProfileGateContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const CASES: {
  name: string;
  answer: { data: unknown; error: { message: string } | null };
  held: boolean;
  toast: string | null;
}[] = [
  {
    name: 'refused: message is exactly profile_incomplete',
    answer: { data: null, error: { message: 'profile_incomplete' } },
    held: true,
    toast: null,
  },
  {
    name: 'refused: profile_incomplete wrapped in more text',
    answer: { data: null, error: { message: 'P0001: profile_incomplete (persona abc)' } },
    held: true,
    toast: null,
  },
  {
    name: 'any other error: the existing generic path',
    answer: { data: null, error: { message: 'connection reset' } },
    held: false,
    toast: "Couldn't save your rating. Please try again.",
  },
  {
    name: 'an organiser refusal: its existing message',
    answer: { data: null, error: { message: 'organisers cannot rate their own event' } },
    held: false,
    toast: 'Organisers cannot rate their own event.',
  },
  { name: 'success', answer: { data: { series_id: 'ev1', level: 'mixed' }, error: null }, held: false, toast: null },
];

beforeEach(() => {
  localStorage.clear();
  h.rate.mockReset();
  h.toast.mockReset();
});
afterEach(cleanup);

describe('isProfileIncompleteError', () => {
  it.each([
    [{ message: 'profile_incomplete' }, true],
    [new Error('xx profile_incomplete yy'), true],
    [{ message: 'only dancers can rate the level' }, false],
    [null, false],
    ['profile_incomplete as a bare string is not an error object', false],
  ])('%o -> %s', (error, expected) => {
    expect(isProfileIncompleteError(error)).toBe(expected);
  });
});

describe.each([false, true])('compact=%s', (compact) => {
  describe.each(CASES)('$name', ({ answer, held, toast }) => {
    it(held ? 'held: stashed, gate shown, tiles disabled, no raw text' : 'unchanged path', async () => {
      h.rate.mockResolvedValue(answer);
      mount(compact);
      const tile = (await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement;
      expect(tile.disabled).toBe(false);
      fireEvent.click(tile);
      await waitFor(() => expect(h.rate).toHaveBeenCalledTimes(1));

      if (held) {
        const gate = await screen.findByTestId('level-rating-gate');
        expect(gate.textContent).toContain('Finish your profile to rate');
        expect(screen.getByRole('link', { name: /finish (your )?profile/i }).getAttribute('href')).toBe(
          `/finish-profile?returnTo=${encodeURIComponent('/event/ev1?occ=2#level-rating')}`,
        );
        expect(((await screen.findByTestId('level-rating-mixed')) as HTMLButtonElement).disabled).toBe(true);
        const stash = JSON.parse(localStorage.getItem(PENDING_LEVEL_RATING_KEY) ?? 'null');
        expect(stash).toMatchObject({ seriesId: 'ev1', level: 'mixed' });
        expect(h.toast).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('profile_incomplete');
        return;
      }

      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('level-rating-gate')).toBeNull();
      expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull();
      if (toast) expect(h.toast).toHaveBeenCalledWith(toast);
      else expect(h.toast).not.toHaveBeenCalled();
    });
  });
});

it('refused before the signed-in chrome has published a gate: the gate words as a toast, never raw text, vote stashed', async () => {
  h.rate.mockResolvedValue({ data: null, error: { message: 'profile_incomplete' } });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/ev1']}>
        <LevelRatingPrompt seriesId="ev1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByTestId('level-rating-mixed'));
  await waitFor(() => expect(h.toast).toHaveBeenCalledWith('Finish your profile to rate.'));
  expect(JSON.parse(localStorage.getItem(PENDING_LEVEL_RATING_KEY) ?? 'null')).toMatchObject({ level: 'mixed' });
  expect(document.body.textContent).not.toContain('profile_incomplete');
});
