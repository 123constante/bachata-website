// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  flag: false,
  completion: { status: 'complete', missing: [] as string[], profileId: 'p1', refetch: () => {} } as Record<string, unknown>,
}));

vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'publicTicketing' ? h.flag : (t as Record<string | symbol, unknown>)[k]) }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, authStatus: 'ready', isLoading: false, signOut: vi.fn() }) }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london' }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({ useProfileCompletion: () => h.completion }));
vi.mock('@/hooks/useMyDancerSummary', () => ({
  useMyDancerSummary: () => ({ data: null, isLoading: false, isError: false, isPending: false, isPaused: false, isSuccess: true, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useMyProfileVisibility', () => ({ useMyProfileVisibility: () => ({ status: 'visible', refetch: vi.fn() }) }));
vi.mock('@/modules/areas/home/AccountAreasRow', () => ({ AccountAreasRow: () => null }));
vi.mock('../HideSurnameCard', () => ({ HideSurnameCard: () => null }));

import { DancerHome } from '../DancerHome';
import { MY_TICKETS_ACCOUNT_PATH } from '@/lib/accountRouting';
import { MY_TICKETS_PATH } from '@/modules/tickets/myTicketsModel';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><DancerHome organiserSection="hidden" organiserCheckFailed={false} requests={[]} /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('account path constant', () => {
  it('equals the tickets model path, so the two cannot drift', () => expect(MY_TICKETS_ACCOUNT_PATH).toBe(MY_TICKETS_PATH));
});

describe('DancerHome My tickets row: flag x account state', () => {
  beforeEach(() => { h.flag = false; });
  afterEach(cleanup);
  const states: Array<[string, string, boolean]> = [
    ['loading', 'loading', false],
    ['signed out', 'signed_out', false],
    ['no profile', 'no_profile', true],
    ['incomplete profile', 'incomplete', true],
    ['complete profile', 'complete', true],
    ['organiser-only account (no dancer profile)', 'no_profile', true],
  ];
  it.each(states.flatMap(([l, s, shown]) => [[l, s, true, shown], [l, s, false, false]] as const))(
    '%s (%s), flag on=%s',
    (_l, status, flagOn, shown) => {
      h.flag = flagOn;
      h.completion = { status, missing: status === 'incomplete' ? ['first_name'] : [], profileId: 'p1', refetch: () => {} };
      mount();
      const row = screen.queryByTestId('dancer-home-tickets');
      expect(!!row).toBe(shown);
      // Flag off (or no row): exactly today's two cards.
      const nav = screen.getByRole('navigation', { name: 'Your nights' });
      expect(nav.querySelectorAll('a')).toHaveLength(shown ? 3 : 2);
      expect(screen.getByTestId('dancer-home-attendance')).toBeTruthy();
      expect(screen.getByTestId('dancer-home-parties')).toBeTruthy();
      if (row) {
        expect(row.getAttribute('href')).toBe(MY_TICKETS_ACCOUNT_PATH);
        expect(row.textContent).toContain('My tickets');
        expect(row.textContent).toContain('Your tickets and door codes');
        expect(row.className).toContain('min-h-[44px]');
        expect(row.className).toContain('col-span-2');
      }
    },
  );
});
