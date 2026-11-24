// @vitest-environment jsdom
/**
 * Slice A3-web: rendered keep-list for EditProfile's Partner Search section,
 * level-retired flag OFF and ON. Harness follows myPersonaSurfaces.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

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
  dancing_role_details: {
    looking_for_partner: true, partner_search_role: 'Leader', partner_search_level: ['Advanced'],
    partner_practice_goals: ['Competition'], partner_details: '', favorite_styles: [],
    favorite_songs: [], achievements: [], dance_started_year: 2021,
  },
};
const YEARS_ROW = { partner_years_min: 2, partner_years_max: 5 };

const builder = (table: string): unknown =>
  new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => ({ data: table === 'dancing_role_details' ? { ...YEARS_ROW } : { ...ROW }, error: null });
      }
      return () => builder(table);
    },
  });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: async () => ({ data: [], error: null }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
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
vi.mock('@/lib/city-canonical', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/city-canonical')>()),
  resolveCanonicalCity: async () => ({ cityId: 'c1', cityName: 'London' }),
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready', retryAuth: () => {} }),
}));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: () => {} }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: () => {},
}));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));

import EditProfile from '../EditProfile';
import { buildDancerProfilePayload } from '@/lib/saveMyDancerProfile';
import { PARTNER_YEARS_V3 } from '@/modules/dancer-app/screens/onboarding/modelV3';

const LEVELS = ['Beginner', 'Improver', 'Intermediate', 'Advanced', 'Professional'];
const GOALS = ['Social Dancing', 'Drills & Technique', 'Choreography', 'Competition', 'Teaching Prep'];

const mount = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <EditProfile />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('Partner Search');
  await screen.findByText('Practice Goals');
};
/** What reaches the RPC: the page's input through the real payload builder. */
const lastDetails = () => {
  const calls = saveMyDancerProfile.mock.calls;
  const input = calls[calls.length - 1][0] as Parameters<typeof buildDancerProfilePayload>[0];
  return buildDancerProfilePayload(input).dancer_details as Record<string, unknown>;
};

beforeEach(() => {
  localStorage.clear();
  saveMyDancerProfile.mockReset().mockResolvedValue({ ...ROW });
});
afterEach(cleanup);

describe.each([false, true])('EditProfile partner section, flag on=%s', (on) => {
  beforeEach(() => {
    f.on = on;
  });

  it('keep-list: switch, role select, practice goals, details, save and other sections', async () => {
    await mount();
    expect(screen.getByText('Show profile in partner finder')).toBeTruthy();
    expect(screen.getByText("I'm looking for a...")).toBeTruthy();
    expect(screen.getAllByText('Leader').length).toBeGreaterThan(0);
    for (const g of GOALS) expect(screen.getByText(g)).toBeTruthy();
    expect(screen.getByPlaceholderText('Describe your availability, goals...')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save/ })).toBeTruthy();
    expect(screen.getByText('Social & Contact')).toBeTruthy();
    expect(screen.getByText('Favorite Styles')).toBeTruthy();
  });

  it(on ? 'years pills 0-2 / 2-5 / 5+ / Any, no level pills' : 'level pills, no years pills', async () => {
    await mount();
    const years = screen.queryByRole('group', { name: 'Years dancing' });
    if (on) {
      expect(years).toBeTruthy();
      expect(within(years as HTMLElement).getAllByText(/./).map((n) => n.textContent)).toEqual(
        PARTNER_YEARS_V3.map((y) => y.label),
      );
      expect(screen.queryByText('Preferred Level(s)')).toBeNull();
      for (const l of LEVELS) expect(screen.queryByText(l)).toBeNull();
    } else {
      expect(screen.getByText('Preferred Level(s)')).toBeTruthy();
      for (const l of LEVELS) expect(screen.getByText(l)).toBeTruthy();
      expect(years).toBeNull();
    }
  });
});

describe('EditProfile partner section saves', () => {
  it('flag on: the stored 2-5 range shows selected, a tap changes form state only (no save until Save)', async () => {
    f.on = true;
    await mount();
    expect(screen.getByTestId('partner-years-2-5').getAttribute('class')).not.toBe(
      screen.getByTestId('partner-years-5+').getAttribute('class'),
    );
    fireEvent.click(screen.getByTestId('partner-years-5+'));
    expect(saveMyDancerProfile).not.toHaveBeenCalled();
  });

  it.each([
    ['0-2', 0, 2],
    ['5+', 5, null],
    ['any', null, null],
  ])('flag on: %s is written on Save as %s/%s, no level', async (id, min, max) => {
    f.on = true;
    await mount();
    fireEvent.click(screen.getByTestId(`partner-years-${id}`));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    const d = lastDetails();
    expect(d.partner_years_min).toBe(min);
    expect(d.partner_years_max).toBe(max);
    expect('partner_search_level' in d).toBe(false);
  });

  it('flag on: tapping the stored 2-5 pill is no change, so Save sends no command', async () => {
    f.on = true;
    await mount();
    fireEvent.click(screen.getByTestId('partner-years-2-5'));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await new Promise((r) => setTimeout(r, 30));
    expect(saveMyDancerProfile).not.toHaveBeenCalled();
  });

  it('flag off: a level tap is written on Save, with no years', async () => {
    f.on = false;
    await mount();
    fireEvent.click(screen.getByText('Beginner'));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    const d = lastDetails();
    expect(d.partner_search_level).toEqual(['Advanced', 'Beginner']);
    expect('partner_years_min' in d).toBe(false);
  });
});
