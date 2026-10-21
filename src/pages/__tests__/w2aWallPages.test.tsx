// @vitest-environment jsdom
/**
 * flags.peopleWall at PAGE level. OFF (the default): /djs and /dancers render the old tiles
 * (the existing w1PeopleListsPage tests run unchanged and stay the byte-for-byte guard).
 * ON: the same reads feed the wall.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({ dancers: [] as unknown[], names: [] as unknown[], badges: [] as unknown[], badgesError: false, djs: [] as unknown[] }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/integrations/supabase/client', () => {
  const builder = () => {
    const b: Record<string, unknown> = {
      select: () => b, or: () => b, order: () => b,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: h.dancers, error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name: string) => {
        if (name === 'get_public_dancer_names_v1') return { data: h.names, error: null };
        if (name === 'get_public_people_badges_v1') return h.badgesError ? { data: null, error: { message: 'x' } } : { data: h.badges, error: null };
        if (name === 'list_public_djs_v1') return { data: h.djs, error: null };
        return { data: null, error: null };
      },
    },
  };
});

import Dancers from '@/pages/Dancers';
import DJs from '@/pages/DJs';
import { flags } from '@/lib/featureFlags';

const setWall = (on: boolean) => { (flags as { peopleWall: boolean }).peopleWall = on; };
const mount = (el: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const D = (id: string, first: string) => ({ id, first_name: first, avatar_url: null, nationality: null, dance_role: null, cities: { name: 'London' }, dancing_role_details: null });
const B = (id: string, roles: string[]) => ({ id, roles, dj_name: null, next_gig_date: null, dj_has_upcoming: false });
const DJ = (id: string, n: string) => ({ id, display_name: n, dj_name: n, first_name: null, surname: null, photo_url: null, nationality_code: null, has_upcoming_gig: false, next_gig_date: null });

beforeEach(() => {
  installJsdomPolyfills();
  h.dancers = [D('d1', 'Ana'), D('d2', 'Fay'), D('d3', 'Tom')];
  h.names = [
    { id: 'd1', surname: null, display_name: 'Ana', public_name: 'Ana' },
    { id: 'd2', surname: null, display_name: 'Fay', public_name: 'Fay' },
    { id: 'd3', surname: null, display_name: 'Tom', public_name: 'Tom' },
  ];
  h.badges = [B('d1', ['teacher', 'dancer']), B('d2', ['dancer']), B('d3', ['teacher']), B('j1', ['dj'])];
  h.badgesError = false;
  h.djs = [DJ('j1', 'DJ El Rugido')];
});
afterEach(() => { cleanup(); setWall(false); });

describe('flags.peopleWall', () => {
  it('defaults OFF', () => { expect((flags as { peopleWall: boolean }).peopleWall).toBe(false); });

  it('OFF: old tiles, no wall', async () => {
    mount(<DJs />); await wait();
    expect(screen.getAllByTestId('dj-tile')).toHaveLength(1);
    expect(screen.queryByTestId('wall-root')).toBeNull();
    cleanup();
    mount(<Dancers />); await wait();
    expect(screen.getAllByTestId('dancer-tile')).toHaveLength(2);
    expect(screen.queryByTestId('wall-root')).toBeNull();
  });

  it('ON /djs: the wall shows the same DJs, linked the same way', async () => {
    setWall(true);
    mount(<DJs />); await wait();
    expect(screen.queryByTestId('dj-tile')).toBeNull();
    const [t] = screen.getAllByTestId('wall-tile');
    expect(t.getAttribute('href')).toBe('/djs/j1');
    expect(screen.getByTestId('tile-name').textContent).toBe('El Rugido');
  });

  it('ON /dancers: only Dancer-role people, same links', async () => {
    setWall(true);
    mount(<Dancers />); await wait();
    expect(screen.queryByTestId('dancer-tile')).toBeNull();
    expect(screen.getAllByTestId('wall-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
  });

  it('ON /dancers with the badges read failed: everyone shows, never "No dancers yet"', async () => {
    setWall(true); h.badgesError = true;
    mount(<Dancers />); await wait();
    expect(screen.queryByText(/No dancers yet/)).toBeNull();
    expect(screen.getAllByTestId('wall-tile')).toHaveLength(3);
  });
});
