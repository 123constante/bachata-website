// @vitest-environment jsdom
/**
 * Gate for the dancer-rated level prompt. Asserts the four states the RPCs
 * (series_level_summary_p5_v1 / rate_series_level_p5_v1) make reachable:
 * hidden for signed-out and anonymous users, "N of 7" below the threshold,
 * the caller's own vote pre-selected, and a click sending the right payload.
 * It does not cover layout or the server-side organiser/dancer refusals.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';

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

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LevelRatingPrompt seriesId={SERIES} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.user = { id: 'u1' };
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string) =>
    name === 'series_level_summary_p5_v1' ? { data: summary(), error: null } : { data: {}, error: null },
  );
});
afterEach(cleanup);

describe('LevelRatingPrompt', () => {
  it('shows progress below the threshold', async () => {
    mount();
    expect((await screen.findByTestId('level-rating-progress')).textContent).toBe('3 of 7 ratings so far');
  });

  it('pre-selects the caller\'s existing vote', async () => {
    h.rpc.mockImplementation(async () => ({ data: summary({ my_level: 'advanced' }), error: null }));
    mount();
    const btn = await screen.findByTestId('level-rating-advanced');
    expect(btn.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('level-rating-beginner').getAttribute('aria-checked')).toBe('false');
  });

  it('sends the chosen level to rate_series_level_p5_v1', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-improver'));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('rate_series_level_p5_v1', { p_series_id: SERIES, p_level: 'improver' }),
    );
  });

  it('renders nothing for a signed-out visitor', () => {
    h.user = null;
    const { container } = mount();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for an anonymous sign-up', () => {
    h.user = { id: 'anon', is_anonymous: true };
    const { container } = mount();
    expect(container.innerHTML).toBe('');
  });
});
