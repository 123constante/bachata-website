// @vitest-environment jsdom
/**
 * Gate for the dancer-rated level prompt (three answers). Asserts the states the RPCs
 * (series_level_summary_p5_v1 / rate_series_level_p5_v1) make reachable:
 * tiles (never counts) below the threshold, the caller's own vote shown,
 * a click sending the right payload, and signed-out / anonymous visitors
 * getting the same tiles but no write. The full screen x shape table, the
 * sign-in round trip and the refusal messages live in
 * src/components/__tests__/LevelRatingPrompt.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

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
      <MemoryRouter>
        <LevelRatingPrompt seriesId={SERIES} />
      </MemoryRouter>
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
  it('shows the three tiles and NO counts below the threshold', async () => {
    const { container } = mount();
    await screen.findByTestId('level-rating-strong');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('pre-selects the caller\'s existing vote', async () => {
    h.rpc.mockImplementation(async () => ({ data: summary({ my_level: 'strong' }), error: null }));
    mount();
    expect((await screen.findByTestId('level-rating-thanks')).textContent).toContain('You rated it Strong');
    fireEvent.click(screen.getByTestId('level-rating-toggle'));
    expect(screen.getByTestId('level-rating-strong').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('level-rating-mixed').getAttribute('aria-checked')).toBe('false');
  });

  it('sends the chosen level to rate_series_level_p5_v1', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-mixed'));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith('rate_series_level_p5_v1', { p_series_id: SERIES, p_level: 'mixed' }),
    );
  });

  it.each([
    ['a signed-out visitor', null],
    ['an anonymous sign-up', { id: 'anon', is_anonymous: true }],
  ])('%s sees the tiles but a tap never calls the rate RPC', async (_n, user) => {
    h.user = user;
    mount();
    fireEvent.click(await screen.findByTestId('level-rating-mixed'));
    await screen.findByText('Sign in to save it');
    expect(h.rpc.mock.calls.some(([name]) => name === 'rate_series_level_p5_v1')).toBe(false);
  });
});
