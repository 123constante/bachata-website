// @vitest-environment jsdom
/**
 * Slice A3-web: rendered keep-list for the DancerDashboard partner editor,
 * level-retired flag OFF and ON. Harness follows dancerProfilePrivateColumns.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= NoopObserver;

const ACCOUNT = 'acct-1';
const f = vi.hoisted(() => ({ on: false }));
const h = vi.hoisted(() => ({ user: { id: 'acct-1', is_anonymous: false, user_metadata: {} } }));
const saveMyDancerProfile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/levelRetiredFlag', () => ({
  get LEVEL_RETIRED_ENABLED() {
    return f.on;
  },
}));

const ROW = {
  id: ACCOUNT, first_name: 'Ana', surname: 'Bee', based_city_id: 'c1', dance_role: 'Follower',
  avatar_url: null, nationality: 'GB', instagram: 'ana.ig', facebook: '', website_url: '',
  cities: { name: 'London' },
  dancing_role_details: {
    looking_for_partner: false, partner_search_role: 'Leader', partner_search_level: ['Advanced'],
    partner_years_min: 2, partner_years_max: 5, partner_practice_goals: ['Socials'],
    partner_details: '', favorite_styles: [], favorite_songs: [], achievements: [], dance_started_year: 2021,
  },
};

const builder = (): unknown =>
  new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
      if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: { ...ROW }, error: null });
      return () => builder();
    },
  });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => builder(),
    rpc: async () => ({ data: [], error: null }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      updateUser: async () => ({ error: null }),
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => ({ data: fn === '_my_dancer_profile_id_v1' ? ACCOUNT : null, error: null }),
}));
vi.mock('@/lib/saveMyDancerProfile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/saveMyDancerProfile')>()),
  saveMyDancerProfile,
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready', retryAuth: () => {} }),
}));
vi.mock('@/contexts/CityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/CityContext')>()),
  useCity: () => ({ citySlug: null, cityId: null, cityName: null, setCity: () => {}, cities: [], loading: false }),
}));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));

import { DancerDashboard } from '../DancerDashboard';
import { PARTNER_YEARS_V3 } from '@/modules/dancer-app/screens/onboarding/modelV3';
import {
  PARTNER_PRACTICE_GOAL_OPTIONS,
  PARTNER_SEARCH_LEVEL_OPTIONS,
  PARTNER_SEARCH_ROLE_OPTIONS,
} from '../dancerConstants';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{(<DancerDashboard />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );

/** Loads the dashboard and opens the inline partner editor via the tile's switch. */
const openEditor = async () => {
  mount();
  await screen.findByText('Partner Mode');
  fireEvent.click(screen.getByRole('switch'));
  await screen.findByText('Looking for role');
};
const lastDetails = () => {
  const calls = saveMyDancerProfile.mock.calls;
  return (calls[calls.length - 1][0] as { dancer_details: Record<string, unknown> }).dancer_details;
};

beforeEach(() => {
  localStorage.clear();
  saveMyDancerProfile.mockReset().mockImplementation(async () => ({ ...ROW }));
});
afterEach(cleanup);

describe.each([false, true])('DancerDashboard partner editor, flag on=%s', (on) => {
  beforeEach(() => {
    f.on = on;
  });

  it('tile status line (before opening the editor)', async () => {
    mount();
    await screen.findByText('Partner Mode');
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByText(on ? 'Leader • 2-5 yrs' : 'Leader • Advanced')).toBeTruthy();
    expect(screen.getByText('Searching')).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('keep-list: role pills, practice goals, details box, switch present either way', async () => {
    await openEditor();
    for (const r of PARTNER_SEARCH_ROLE_OPTIONS) expect(screen.getByText(r)).toBeTruthy();
    expect(screen.getByText('Practice goals')).toBeTruthy();
    for (const g of PARTNER_PRACTICE_GOAL_OPTIONS) expect(screen.getByText(g)).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Availability, preferred practice rhythm/)).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
    expect(screen.getByText('Searching')).toBeTruthy();
  });

  it(on ? 'years pills 0-2 / 2-5 / 5+ / Any shown, level pills absent' : 'level pills shown, no years pills', async () => {
    await openEditor();
    const years = screen.queryByRole('group', { name: 'Years dancing' });
    if (on) {
      expect(screen.getByText('Years dancing')).toBeTruthy();
      expect(years).toBeTruthy();
      expect(within(years as HTMLElement).getAllByText(/./).map((n) => n.textContent)).toEqual(
        PARTNER_YEARS_V3.map((y) => y.label),
      );
      expect(screen.queryByText('Preferred levels')).toBeNull();
      for (const l of PARTNER_SEARCH_LEVEL_OPTIONS) expect(screen.queryByText(l)).toBeNull();
    } else {
      expect(screen.getByText('Preferred levels')).toBeTruthy();
      for (const l of PARTNER_SEARCH_LEVEL_OPTIONS) expect(screen.getByText(l)).toBeTruthy();
      expect(years).toBeNull();
      expect(screen.queryByTestId('partner-years-0-2')).toBeNull();
    }
  });
});

describe('DancerDashboard partner editor saves', () => {
  it.each([
    ['0-2', 0, 2],
    ['2-5', 2, 5],
    ['5+', 5, null],
    ['any', null, null],
  ])('flag on: tapping %s saves years %s/%s and no level', async (id, min, max) => {
    f.on = true;
    await openEditor();
    saveMyDancerProfile.mockClear();
    fireEvent.click(screen.getByTestId(`partner-years-${id}`));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    const d = lastDetails();
    expect(d.partner_years_min).toBe(min);
    expect(d.partner_years_max).toBe(max);
    expect('partner_search_level' in d).toBe(false);
  });

  it('flag off: tapping a level saves the level and no years', async () => {
    f.on = false;
    await openEditor();
    saveMyDancerProfile.mockClear();
    fireEvent.click(screen.getByText('Beginner'));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    const d = lastDetails();
    expect(d.partner_search_level).toEqual(['Advanced', 'Beginner']);
    expect('partner_years_min' in d).toBe(false);
    expect('partner_years_max' in d).toBe(false);
  });
});
