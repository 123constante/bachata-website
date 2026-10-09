// @vitest-environment jsdom
/**
 * Table-driven screen x shape check for the party-rating card: every summary
 * shape the server can return x signed-out / signed-in / compact, plus the
 * sign-in round trip (a stashed vote is sent exactly once).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  summary: null as unknown,
  rate: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('sonner', () => ({ toast: { error: h.toast } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args: unknown) =>
      name === 'rate_series_level_p5_v1' ? h.rate(args) : Promise.resolve({ data: h.summary, error: null }),
  },
}));

import { LevelRatingPrompt } from '../LevelRatingPrompt';
import { PENDING_LEVEL_RATING_KEY } from '@/lib/pendingLevelRating';
import { AUTH_PENDING_RETURN_TO_KEY } from '@/lib/authRouting';

const S = (counts: Record<string, number> | null, derived: string | null, votes: number, mine: string | null = null) => ({
  series_id: 'ev1', vote_count: votes, threshold: 7, counts, derived_level: derived, my_level: mine,
});
const NEW = S(null, null, 0);
const UNDER7 = S(null, null, 4);
const WIN = S({ mostly_beginners: 1, mixed: 3, strong: 5 }, 'strong', 9);
const TIE = S({ mostly_beginners: 3, mixed: 1, strong: 3 }, 'mixed', 7);
const ZERO = S({ mostly_beginners: 0, mixed: 0, strong: 7 }, 'strong', 7);

const mount = (props: { compact?: boolean } = {}) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/ev1?occ=2']}>
        <LevelRatingPrompt seriesId="ev1" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const rateCalls = () => h.rate.mock.calls.length;
const tile = (v: string) => screen.findByTestId(`level-rating-${v}`);

beforeEach(() => {
  localStorage.clear();
  h.user = null;
  h.summary = NEW;
  h.rate.mockReset().mockResolvedValue({ data: {}, error: null });
  h.toast.mockReset();
});
afterEach(cleanup);

describe('signed out', () => {
  it.each([
    ['no votes', NEW],
    ['under 7 votes', UNDER7],
  ])('%s: three tiles, no counts anywhere', async (_n, summary) => {
    h.summary = summary;
    const { container } = mount();
    expect((await tile('mostly_beginners')).textContent).toContain('Mostly beginners');
    expect(screen.getByTestId('level-rating-mixed')).toBeTruthy();
    expect(screen.getByTestId('level-rating-strong')).toBeTruthy();
    expect(screen.queryByTestId('level-rating-result')).toBeNull();
    expect(screen.queryByTestId('level-rating-chart')).toBeNull();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('a tap highlights the tile, opens the sheet, sends NOTHING and stashes the vote', async () => {
    mount();
    fireEvent.click(await tile('strong'));
    expect(await screen.findByText('Sign in to save it')).toBeTruthy();
    expect(rateCalls()).toBe(0);
    expect(screen.getByTestId('level-rating-strong').getAttribute('aria-checked')).toBe('true');
    expect(JSON.parse(localStorage.getItem(PENDING_LEVEL_RATING_KEY) ?? '{}')).toMatchObject({ seriesId: 'ev1', level: 'strong' });
    // The return-to is stashed on the link click, never on open.
    expect(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY)).toBeNull();
    expect(screen.getByTestId('level-rating-login').getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Fevent%2Fev1%3Focc%3D2');
    expect(screen.getByTestId('level-rating-signup').getAttribute('href')).toBe('/auth?mode=signup&returnTo=%2Fevent%2Fev1%3Focc%3D2');
    fireEvent.click(screen.getByTestId('level-rating-login'));
    expect(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY)).toBe('/event/ev1?occ=2');
  });

  it('dismissing the sheet drops the stashed vote', async () => {
    mount();
    fireEvent.click(await tile('mixed'));
    await screen.findByText('Sign in to save it');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull());
    expect(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY)).toBeNull();
    expect(rateCalls()).toBe(0);
  });

  it('an anonymous session is treated as signed out', async () => {
    h.user = { id: 'anon', is_anonymous: true };
    mount();
    fireEvent.click(await tile('mixed'));
    expect(await screen.findByText('Sign in to save it')).toBeTruthy();
    expect(rateCalls()).toBe(0);
  });

  it('compact (My Attendance) renders nothing when signed out', async () => {
    h.summary = NEW;
    const { container } = mount({ compact: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe('');
  });
});

describe('result shapes (everyone sees them)', () => {
  it('clear winner: word, agree line, three bars, base line, tiles hidden behind the toggle', async () => {
    h.summary = WIN;
    mount();
    expect((await screen.findByTestId('level-rating-winner')).textContent).toBe('Strong');
    expect(screen.getByTestId('level-rating-line').textContent).toBe('5 of 9 dancers agree');
    expect(screen.getByTestId('level-rating-bar-strong').textContent).toContain('5');
    expect(screen.getByTestId('level-rating-based-on').textContent).toBe('Based on 9 dancers');
    expect(screen.queryByTestId('level-rating-strong')).toBeNull();
    expect(screen.getByTestId('level-rating-toggle').textContent).toBe('Rate it too');
  });

  it('a tie reads as Mixed with the split sentence', async () => {
    h.summary = TIE;
    mount();
    expect((await screen.findByTestId('level-rating-winner')).textContent).toBe('Mixed');
    expect(screen.getByTestId('level-rating-line').textContent).toBe('Dancers were split between Mostly beginners and Strong');
  });

  it('a zero-count bar is shown faded, not dropped', async () => {
    h.summary = ZERO;
    mount();
    await screen.findByTestId('level-rating-chart');
    expect(screen.getByTestId('level-rating-bar-mixed').getAttribute('data-zero')).toBe('true');
    expect(screen.getByTestId('level-rating-bar-strong').getAttribute('data-zero')).toBeNull();
  });

  it('signed out, "Rate it too" shows the tiles and a tap still goes to sign-in, not the RPC', async () => {
    h.summary = WIN;
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-toggle'));
    fireEvent.click(await tile('mixed'));
    expect(await screen.findByText('Sign in to save it')).toBeTruthy();
    expect(rateCalls()).toBe(0);
  });
});

describe('signed in', () => {
  beforeEach(() => {
    h.user = { id: 'u1' };
  });

  it('a tap rates once and the card thanks them', async () => {
    mount();
    const strong = await tile('strong');
    h.summary = S(null, null, 5, 'strong');
    fireEvent.click(strong);
    await waitFor(() => expect(rateCalls()).toBe(1));
    expect(h.rate).toHaveBeenCalledWith({ p_series_id: 'ev1', p_level: 'strong' });
    expect((await screen.findByTestId('level-rating-thanks')).textContent).toContain('You rated it Strong');
  });

  it('from the result view: toggle shows tiles, picking another level rates once', async () => {
    h.summary = { ...WIN, my_level: 'mixed' };
    mount();
    const toggle = await screen.findByTestId('level-rating-toggle');
    expect(toggle.textContent).toBe('Change your rating');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByTestId('level-rating-mixed').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('level-rating-strong'));
    await waitFor(() => expect(rateCalls()).toBe(1));
    expect(h.rate).toHaveBeenCalledWith({ p_series_id: 'ev1', p_level: 'strong' });
  });

  it('a failed vote from the result view brings the tiles back for a retry', async () => {
    h.summary = WIN;
    h.rate.mockResolvedValue({ data: null, error: { message: 'boom' } });
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-toggle'));
    fireEvent.click(await tile('strong'));
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    expect(screen.getByTestId('level-rating-strong')).toBeTruthy();
  });

  it('shows the thank-you and the change toggle once they have a rating', async () => {
    h.summary = S(null, null, 5, 'strong');
    mount();
    expect((await screen.findByTestId('level-rating-thanks')).textContent).toContain('You rated it Strong');
    expect(screen.getByTestId('level-rating-toggle').textContent).toBe('Change your rating');
  });

  it('tapping the level they already chose sends nothing', async () => {
    h.summary = S(null, null, 5, 'mixed');
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-toggle'));
    fireEvent.click(await tile('mixed'));
    expect(rateCalls()).toBe(0);
  });

  it.each([
    ['organisers cannot rate their own series', 'Organisers cannot rate their own event.'],
    ['only dancers can rate', 'Create a dancer profile to rate events.'],
    ['boom', "Couldn't save your rating. Please try again."],
  ])('RPC refusal "%s" shows the right message', async (message, expected) => {
    h.rate.mockResolvedValue({ data: null, error: { message } });
    mount();
    fireEvent.click(await tile('mixed'));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expected));
  });

  it('back from sign-in: the stashed vote is sent exactly once, even across a remount', async () => {
    localStorage.setItem(PENDING_LEVEL_RATING_KEY, JSON.stringify({ seriesId: 'ev1', level: 'strong', at: Date.now() }));
    const first = mount();
    await waitFor(() => expect(rateCalls()).toBe(1));
    expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull();
    first.unmount();
    mount();
    await tile('mixed');
    await new Promise((r) => setTimeout(r, 30));
    expect(rateCalls()).toBe(1);
  });

  it('a stashed vote for a different series is not sent here', async () => {
    localStorage.setItem(PENDING_LEVEL_RATING_KEY, JSON.stringify({ seriesId: 'other', level: 'strong', at: Date.now() }));
    mount();
    await tile('mixed');
    await new Promise((r) => setTimeout(r, 30));
    expect(rateCalls()).toBe(0);
  });

  it('compact: a plain three-chip row, no hero card', async () => {
    mount({ compact: true });
    expect((await tile('mostly_beginners')).textContent).toBe('Mostly beginners');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText('Level')).toBeNull();
  });
});
