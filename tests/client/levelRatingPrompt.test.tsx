// @vitest-environment jsdom
/**
 * Gate for the dancer-rated level prompt. Asserts the states the RPCs
 * (series_level_summary_p5_v1 / rate_series_level_p5_v1) make reachable:
 * hidden for signed-out and anonymous users; on the event page a one-tap card
 * that shows only while unrated, saves once, thanks the dancer and disappears
 * (and stays visible on error); on the compact dashboard row the caller's own
 * vote pre-selected and changeable. It does not cover layout or the
 * server-side organiser/dancer refusals.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('sonner', () => ({ toast: h.toast }));

import { LevelRatingPrompt, RATED_TOAST } from '@/components/LevelRatingPrompt';

const SERIES = '11111111-1111-1111-1111-111111111111';
const summary = (over: Record<string, unknown> = {}) => ({
  series_id: SERIES,
  vote_count: 3,
  threshold: 7,
  counts: null,
  derived_level: null,
  my_level: null,
  ...over,
});

const mount = (compact = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LevelRatingPrompt seriesId={SERIES} compact={compact} />
    </QueryClientProvider>,
  );

// Waits for the summary RPC to resolve, so an "empty" assertion is not just
// the pre-fetch render.
const settled = async () => {
  await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('series_level_summary_p5_v1', { p_series_id: SERIES }));
  await new Promise((r) => setTimeout(r, 0));
};

const rateCalls = () => h.rpc.mock.calls.filter(([name]) => name === 'rate_series_level_p5_v1');

// Summary RPC returns `current()`; a successful rate updates my_level so the
// post-save refetch sees the vote, as the real RPC pair does.
let current = summary();
beforeEach(() => {
  h.user = { id: 'u1' };
  current = summary();
  h.toast.error.mockReset();
  h.toast.success.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string, args: { p_level?: string }) => {
    if (name === 'series_level_summary_p5_v1') return { data: current, error: null };
    current = summary({ my_level: args.p_level, vote_count: 4 });
    return { data: {}, error: null };
  });
});
afterEach(cleanup);

describe('LevelRatingPrompt (event page, one-tap)', () => {
  it('shows the five option cards with their meanings and progress', async () => {
    mount();
    expect(await screen.findByText('How hard is this event?')).toBeTruthy();
    const expected: Record<string, string> = {
      beginner: 'Never danced it, or first months',
      improver: 'Know the basics, building up',
      intermediate: 'Comfortable with turns and flow',
      advanced: 'Fast, complex, lots of experience',
      open_level: 'All levels welcome',
    };
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    for (const [value, meaning] of Object.entries(expected)) {
      expect(screen.getByTestId(`level-rating-${value}`).textContent).toContain(meaning);
    }
    expect(screen.getByTestId('level-rating-progress').textContent).toBe('3 of 7 ratings so far');
    expect(screen.getByLabelText('Rate the level of this event')).toBeTruthy();
    // Votes are stored per dancer_id (admin-readable), so the card must not claim anonymity.
    expect(screen.getByTestId('level-rating-card').textContent).not.toMatch(/anonymous/i);
  });

  it('shows the plain count once the threshold is met', async () => {
    current = summary({ vote_count: 9 });
    mount();
    expect((await screen.findByTestId('level-rating-progress')).textContent).toBe('9 ratings');
  });

  it('one tap saves once, thanks the dancer, then the card is gone', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-improver'));
    await waitFor(() => expect(screen.queryByTestId('level-rating-card')).toBeNull());
    expect(rateCalls()).toEqual([['rate_series_level_p5_v1', { p_series_id: SERIES, p_level: 'improver' }]]);
    expect(h.toast.success).toHaveBeenCalledTimes(1);
    expect(h.toast.success).toHaveBeenCalledWith(RATED_TOAST);
    expect(RATED_TOAST).toBe('Thanks! You can change your rating in your dashboard.');
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('disables every option while the save is in flight', async () => {
    let release: (() => void) | null = null;
    h.rpc.mockImplementation(async (name: string, args: { p_level?: string }) => {
      if (name === 'series_level_summary_p5_v1') return { data: current, error: null };
      await new Promise<void>((r) => { release = r; });
      current = summary({ my_level: args.p_level });
      return { data: {}, error: null };
    });
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-advanced'));
    // Wait until the rate RPC is actually parked and the pending render landed.
    await waitFor(() => {
      expect(release).not.toBeNull();
      expect(screen.getByTestId('level-rating-advanced').getAttribute('aria-busy')).toBe('true');
      for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getByTestId('level-rating-advanced').textContent).toContain('Saving');
    fireEvent.click(screen.getByTestId('level-rating-beginner'));
    (release as unknown as () => void)();
    await waitFor(() => expect(screen.queryByTestId('level-rating-card')).toBeNull());
    expect(rateCalls()).toHaveLength(1);
  });

  it('stays hidden after the save even when the follow-up refetch fails', async () => {
    let saved = false;
    h.rpc.mockImplementation(async (name: string) => {
      if (name === 'series_level_summary_p5_v1') {
        return saved ? { data: null, error: new Error('refetch down') } : { data: current, error: null };
      }
      saved = true;
      return { data: {}, error: null };
    });
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-beginner'));
    await waitFor(() => expect(screen.queryByTestId('level-rating-card')).toBeNull());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('level-rating-card')).toBeNull();
  });

  it('still offers the card on the next event after rating one (same mounted instance)', async () => {
    const OTHER = '22222222-2222-2222-2222-222222222222';
    const mineBySeries: Record<string, string | null> = { [SERIES]: null, [OTHER]: null };
    h.rpc.mockImplementation(async (name: string, args: { p_series_id: string; p_level?: string }) => {
      if (name === 'series_level_summary_p5_v1') {
        return { data: summary({ series_id: args.p_series_id, my_level: mineBySeries[args.p_series_id] }), error: null };
      }
      mineBySeries[args.p_series_id] = args.p_level ?? null;
      return { data: {}, error: null };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (id: string) => (
      <QueryClientProvider client={client}>
        <LevelRatingPrompt seriesId={id} />
      </QueryClientProvider>
    );
    const { rerender } = render(view(SERIES));
    fireEvent.click(await screen.findByTestId('level-rating-advanced'));
    await waitFor(() => expect(screen.queryByTestId('level-rating-card')).toBeNull());
    rerender(view(OTHER));
    expect(await screen.findByTestId('level-rating-card')).toBeTruthy();
  });

  it('rating one series leaves another cached, unrated series untouched', async () => {
    const OTHER = '33333333-3333-3333-3333-333333333333';
    const votes: Record<string, string> = {};
    h.rpc.mockImplementation(async (name: string, args: { p_series_id: string; p_level?: string }) => {
      if (name === 'series_level_summary_p5_v1') {
        return { data: summary({ series_id: args.p_series_id, my_level: votes[args.p_series_id] ?? null }), error: null };
      }
      votes[args.p_series_id] = args.p_level as string;
      return { data: {}, error: null };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <div data-testid="a"><LevelRatingPrompt seriesId={SERIES} /></div>
        <div data-testid="b"><LevelRatingPrompt seriesId={OTHER} /></div>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId('level-rating-card')).toHaveLength(2));
    fireEvent.click(screen.getByTestId('a').querySelector('[data-testid="level-rating-beginner"]') as Element);
    await waitFor(() => expect(screen.getByTestId('a').innerHTML).toBe(''));
    expect(screen.getByTestId('b').querySelector('[data-testid="level-rating-card"]')).not.toBeNull();
  });

  it('renders nothing when the dancer has already rated', async () => {
    current = summary({ my_level: 'advanced' });
    const { container } = mount();
    await settled();
    expect(container.innerHTML).toBe('');
  });

  it('keeps the card and shows the error toast when the save fails', async () => {
    h.rpc.mockImplementation(async (name: string) =>
      name === 'series_level_summary_p5_v1'
        ? { data: current, error: null }
        : { data: null, error: new Error('boom') },
    );
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-intermediate'));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Couldn't save your rating. Please try again."));
    expect(screen.getByTestId('level-rating-card')).toBeTruthy();
    expect(h.toast.success).not.toHaveBeenCalled();
    // Pending state clears, so the dancer can try again.
    await waitFor(() => expect((screen.getByTestId('level-rating-intermediate') as HTMLButtonElement).disabled).toBe(false));
  });
});

describe('LevelRatingPrompt (compact, My Attendance)', () => {
  it('pre-selects the caller\'s existing vote', async () => {
    current = summary({ my_level: 'advanced' });
    mount(true);
    const btn = await screen.findByTestId('level-rating-advanced');
    expect(btn.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('level-rating-beginner').getAttribute('aria-checked')).toBe('false');
  });

  it('lets the dancer change their vote and stays visible', async () => {
    current = summary({ my_level: 'advanced' });
    mount(true);
    fireEvent.click(await screen.findByTestId('level-rating-improver'));
    await waitFor(() =>
      expect(screen.getByTestId('level-rating-improver').getAttribute('aria-checked')).toBe('true'),
    );
    expect(rateCalls()).toEqual([['rate_series_level_p5_v1', { p_series_id: SERIES, p_level: 'improver' }]]);
    expect(screen.getByTestId('level-rating-progress')).toBeTruthy();
    expect(h.toast.success).not.toHaveBeenCalled();
  });
});

describe('LevelRatingPrompt (who sees it)', () => {
  it('renders nothing for a signed-out visitor', async () => {
    h.user = null;
    const { container } = mount();
    await settled();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for an anonymous sign-up', async () => {
    h.user = { id: 'anon', is_anonymous: true };
    const { container } = mount(true);
    await settled();
    expect(container.innerHTML).toBe('');
  });
});
