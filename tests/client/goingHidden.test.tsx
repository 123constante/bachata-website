// @vitest-environment jsdom
/**
 * GOING_CHECKIN_ENABLED: the one switch for the public "I'm Going / Interested"
 * control. Table-driven over every surface a visitor could see or tap Going on:
 * off => nothing Going-related renders (no button, heading, hint or count);
 * on => the surface renders as before, so the switch really is the only thing
 * between the code and the visitor.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';

const h = vi.hoisted(() => ({ on: false, rpc: vi.fn() }));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: { id: 'u1' }, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () => [
    { id: 'fest-1', name: 'Costa Bachata Congress', city: 'Alicante', date: '2026-12-20', start_time: '2026-12-20T10:00:00Z', poster_url: null },
  ],
}));

import { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import { RsvpBlockPlaceholder } from '@/modules/event-page/bento/blocks/RsvpBlockPlaceholder';

import { NumbersView } from '@/modules/dancer-app/screens/home/NumbersTiles';
import { asWallClock } from '@/lib/time/wallClock';
import FestivalHub from '@/pages/FestivalHub';
import MyAttendance from '@/pages/MyAttendance';
import { GOING_COPY } from '@/modules/going';

const OCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
// Going P2: the Going cell is the module's tag + get_my_going_v1's count (homeGoing.tsx builds it from useMyNights().goingCount); no Interested.
const NUMBERS = { viewsWeek: 1, viewsMonth: 2, viewsTotal: 3, noViews: false, went: 6, votes: 7, allZero: false };
const ZERO = { ...NUMBERS, went: 0, votes: 0, allZero: true };

const occurrence = {
  occurrenceId: OCC,
  startsAt: asWallClock('2099-12-20T20:00:00'),
  endsAt: asWallClock('2099-12-20T23:59:00'),
  localDate: asWallClock('2099-12-20T00:00:00'),
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
};

const GOING_WORDS = /going|interested/i;
type Surface = { name: string; ui: () => ReactNode; settle?: number; onMarker: () => unknown };
const SURFACES: Surface[] = [
  {
    name: 'event page block (RsvpBlock)',
    ui: () => (
      <RsvpBlock publicEventId="p1" occurrenceId={OCC} occurrence={occurrence} seriesLifecycle="live" />
    ),
    onMarker: () => screen.getByTestId('rsvp-going'),
  },
  {
    name: 'event page block placeholder',
    ui: () => <RsvpBlockPlaceholder />,
    onMarker: () => screen.getByTestId('rsvp-placeholder'),
  },
  { name: 'festival hub', ui: () => <FestivalHub />, settle: 150, onMarker: () => screen.findByTestId('festival-going-button', {}, { timeout: 4000 }) },
  {
    name: 'dancer app numbers strip',
    ui: () => <NumbersView n={NUMBERS} hasPhoto going={{ label: GOING_COPY.tagGoing, value: 4, went: 6 }} />,
    onMarker: () => screen.getByTestId('stat-going'),
  },
  {
    name: 'dancer app numbers strip, all zero',
    ui: () => <NumbersView n={ZERO} hasPhoto going={{ label: GOING_COPY.tagGoing, value: 0, went: 0 }} />,
    onMarker: () => screen.getByTestId('stats-strip-empty'),
  },
  { name: 'my attendance, empty', ui: () => <MyAttendance />, settle: 100, onMarker: () => screen.getByText(GOING_COPY.myUpcomingEmptyHow) },
];

beforeEach(() => {
  installJsdomPolyfills();
  localStorage.clear();
  h.rpc.mockReset().mockImplementation(async (name: string) => {
    // The festival hub's night (its P5 occurrence id) comes from event_view_p5.
    if (name === 'event_view_p5') return { data: { occurrence_id: OCC, occurrence_effective: { occurrence_id: OCC, starts_at: '2099-12-20T20:00:00+00:00', ends_at: null, is_cancelled: false }, event: { lifecycle_status: 'live' } }, error: null };
    return { data: [], error: null };
  });
});
afterEach(() => {
  cleanup();
});

const mount = async (s: Surface) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{s.ui()}</MemoryRouter>
    </QueryClientProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, s.settle ?? 20));
  });
  return view;
};

describe('GOING_CHECKIN_ENABLED', () => {
  it.each(SURFACES)('off: $name renders nothing Going-related', async (s) => {
    h.on = false;
    const { container } = await mount(s);
    const text = container.textContent ?? '';
    // The festival hub is a whole page: only its card controls and counts are Going-related.
    if (s.name === 'festival hub') {
      expect(screen.getByText('Costa Bachata Congress')).toBeTruthy();
      expect(text).not.toMatch(/I'm Going|Going:|Interested:|attending|WhatsApp/);
      expect(screen.queryByTestId('festival-going-lock')).toBeNull();
    } else if (s.name === 'dancer app numbers strip') {
      expect(screen.queryByTestId('stat-going')).toBeNull();
      expect(screen.queryByTestId('stat-interested')).toBeNull();
      expect(screen.getByTestId('stat-went')).toBeTruthy();
    } else if (s.name === 'my attendance, empty') {
      expect(text).not.toContain(GOING_COPY.myUpcomingEmptyHow);
      expect(h.rpc.mock.calls.filter(([n]) => n === 'get_my_going_v1')).toEqual([]);
    } else {
      expect(text).not.toMatch(GOING_WORDS);
      expect(container.querySelector('section, button')).toBeNull();
    }
    expect(h.rpc.mock.calls.filter(([n]) => /attendance/.test(n as string))).toEqual([]);
  });

  it('off: the all-zero strip leaves no empty card behind', async () => {
    h.on = false;
    await mount(SURFACES[4]);
    expect(screen.queryByTestId('stats-strip')).toBeNull();
  });

  it.each(SURFACES)('on: $name renders as before', async (s) => {
    h.on = true;
    await mount(s);
    expect(await s.onMarker()).toBeTruthy();
  });
});
