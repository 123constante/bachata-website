// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, WEEKLY13 } from './wsFixtures';

type ShapeKey = keyof typeof SHAPES | 'weekly13';
import { L } from '../../model';

/*
 * Walk B's 10 untested cells: Details and Prices on every real event shape. Same stand-ins as
 * editScreens.send.test.tsx (supabase and the side reads only); the send path is the real one.
 * Locking is by lifecycle only (eventLock): ended and archived grey the screen; a past one-off
 * that is still "live" is open, so it sits with the open shapes here.
 */
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'city-9' }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { DetailsScreen } from '../DetailsScreen';

afterEach(() => { cleanup(); rpc.mockReset(); });

type Raw = Record<string, unknown>;
const DETAILS = '/account/p3/events/ser-1/details';
const YT = 'https://youtu.be/dQw4w9WgXcQ';
const VM = 'https://vimeo.com/123456789';
const NOPE = (n: number) => `https://example.com/page${n}`;

function show(key: ShapeKey) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: SHAPES[key as keyof typeof SHAPES], error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return { data: { ok: true, new_version: 8 }, error: null }; }
    return { data: null, error: null };
  });
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
  ], { initialEntries: [DETAILS] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  return envs;
}

describe('detailsKindHint matrix', () => {
  it.each([
    ['weekly', 'weekly', false],
    ['one-off', 'oneoff', false],
    ['course', 'course', false],
    ['festival', 'festival', true],
    ['draft one-off', 'draft', false],
  ] as const)('%s: kind hint text and test id', async (_n, key, isFestival) => {
    show(key);
    await waitFor(() => screen.getByTestId('p3-details'));
    const hint = screen.getByTestId('p3-d-kind-hint');
    expect(hint.textContent).toBe(isFestival ? L.detailsKindHintFestival : L.detailsKindHint);
    expect(L.detailsKindHint).toBe('Worked out from your sessions. Change a session to change it.');
    expect(L.detailsKindHintFestival).toBe('Festival sessions are set with the Bachata Calendar team. Ask us to change the programme.');
  });
});

describe('detailsVideosNote matrix', () => {
  it.each([
    ['0 links', '', false],
    ['1 link', YT, false],
    ['2 links', `${YT}\n${VM}`, true],
    ['5 links', [YT, VM, NOPE(1), NOPE(2), NOPE(3)].join('\n'), true],
    ['2 non-playable', `${NOPE(1)}\n${NOPE(2)}`, true],
    ['blank lines do not count', `${YT}\n\n  \n`, false],
  ] as const)('%s: note shown=%s', async (_n, typed, shown) => {
    show('weekly');
    await waitFor(() => screen.getByTestId('p3-details'));
    fireEvent.change(screen.getByTestId('p3-d-videos'), { target: { value: typed } });
    const note = screen.queryByTestId('p3-d-videos-note');
    if (shown) {
      expect(note).not.toBeNull();
      expect(note!.textContent).toBe('Dancers see the first link that can play (YouTube, Vimeo or an uploaded video). The others are kept.');
    }
    else expect(note).toBeNull();
  });

  it('an untouched Save still sends nothing', async () => {
    const envs = show('festival');
    await waitFor(() => screen.getByTestId('p3-details'));
    const save = screen.getByTestId('p3-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await act(async () => { fireEvent.click(save); });
    expect(envs).toHaveLength(0);
  });
});
