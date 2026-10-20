// @vitest-environment jsdom
/**
 * TODAY's /dancers directory (src/pages/Dancers.tsx) and /account/attendance
 * (src/pages/MyAttendance.tsx), as the accessible tree at 390x844 and desktop.
 * Directory shapes: empty, mixed (named / hidden surname / nameless / looking for a
 * partner), signed-out vs signed-in with plans. Attendance shapes: empty, past party
 * (links to the event's own rating card), future, festival, mixed. NOTE for the
 * brief's "inline level-vote prompt in MyAttendance": today MyAttendance has NO inline
 * prompt, only a "Rate the dancing level" LINK to `/event/:id#level-rating`; that
 * link is what is pinned. Date is pinned (clock-derived labels).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  dancers: [] as unknown[],
  names: [] as unknown[],
  attendance: [] as unknown[],
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/integrations/supabase/client', () => {
  const builder = () => {
    const b: Record<string, unknown> = {
      select: () => b,
      or: () => b,
      order: () => b,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: h.dancers, error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name: string) => {
        if (name === 'get_public_dancer_names_v1') return { data: h.names, error: null };
        if (name === 'get_my_event_attendance_v2') return { data: h.attendance, error: null };
        return { data: null, error: null };
      },
    },
  };
});

import Dancers from '@/pages/Dancers';
import MyAttendance from '@/pages/MyAttendance';

const mount = (el: ReactNode, at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const D = (id: string, first: string | null, over: Record<string, unknown> = {}) => ({
  id, first_name: first, avatar_url: null, nationality: null, dance_role: null, cities: { name: 'London' }, dancing_role_details: null, ...over,
});
const DIRECTORY: Record<string, { dancers: unknown[]; names: unknown[] }> = {
  empty: { dancers: [], names: [] },
  'mixed shapes': {
    dancers: [
      D('d1', 'Ana', { avatar_url: 'https://cdn.example.test/a.jpg', dance_role: 'Follower', dancing_role_details: { favorite_styles: ['Sensual'], dance_started_year: 2015, looking_for_partner: true } }),
      D('d2', 'Fay', { dance_role: 'Leader' }),
      D('d3', 'Eli', { cities: null }),
      D('d4', null),
    ],
    names: [
      { id: 'd1', surname: 'Lopez', display_name: 'Ana Lopez', public_name: 'Ana Lopez' },
      { id: 'd2', surname: null, display_name: 'Fay', public_name: 'Fay' },
      { id: 'd3', surname: null, display_name: 'Eli Gomez', public_name: 'Eli Gomez' },
    ],
  },
};
const row = (o: Record<string, unknown>) => ({
  event_id: 'ev1', status: 'going', updated_at: null, name: 'Friday Social', occurrence_date: '2026-10-02',
  city_name: 'London', country: 'GB', city_slug: 'london', start_time: null, type: 'party', is_active: true, ...o,
});
const ATTENDANCE: Record<string, unknown[]> = {
  empty: [],
  'past party': [row({ event_id: 'past1', occurrence_date: '2026-01-02' })],
  'future party': [row({ event_id: 'fut1', occurrence_date: '2099-01-02' })],
  'past festival': [row({ event_id: 'fest1', occurrence_date: '2026-01-02', type: 'festival' })],
  mixed: [
    row({ event_id: 'past1', occurrence_date: '2026-01-02' }),
    row({ event_id: 'fut1', occurrence_date: '2099-01-02', status: 'interested' }),
    row({ event_id: 'fest1', occurrence_date: '2099-06-02', type: 'festival', name: 'Costa Congress' }),
  ],
};

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
  h.user = null;
  h.attendance = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(VIEWPORTS)('directory + attendance at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe.each(Object.entries(DIRECTORY))('/dancers: %s', (_n, shape) => {
    it.each([
      ['signed out', null],
      ['signed in, with plans', { id: 'u1' }],
    ] as const)('%s', async (_v, user) => {
      h.user = user ? { ...user } : null;
      h.dancers = shape.dancers;
      h.names = shape.names;
      h.attendance = user ? [row({ event_id: 'fut1', occurrence_date: '2099-01-02', type: 'standard' })] : [];
      mount(<Dancers />, '/dancers');
      await wait();
      expect(a11yTree()).toMatchSnapshot();
    });
  });

  describe.each(Object.entries(ATTENDANCE))('/account/attendance: %s', (_n, rows) => {
    it('renders', async () => {
      h.user = { id: 'u1' };
      h.attendance = rows;
      mount(<MyAttendance />, '/account/attendance');
      await wait();
      expect(a11yTree()).toMatchSnapshot();
    });
  });
});
