// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';
import { PHOTO_COPY, applyPhoto, photoBlock, photosOf, type PhotoAction, type Photos } from '../../model/photoOrder';

/*
 * P3 Pictures sheet with order and cover (flags.organiserPhotoOrder ON): the pure model for
 * 0/1/2/30 pictures, with and without a cover, duplicate URLs and the last picture removed; then the
 * sheet through the REAL send path (edit screen -> useSaveRun -> series.upsert envelope), a failed
 * save included. The flag-off sheet is pinned by tests/e2e/walk-p3-series-pictures.spec.ts.
 */

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'organiserPhotoOrder' ? flagState.on : Reflect.get(t, k)) }) };
});

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: vi.fn(async () => ({ cityId: 'city-9' })) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useOrganiserProgress: () => ({ isPending: false, data: undefined }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [], refetch: vi.fn() }),
}));

import { DetailsScreen } from '../DetailsScreen';

const pics = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/p${i}.jpg`);
const C = 'https://img.example/cover.jpg';
const ACTS: PhotoAction[] = ['earlier', 'later', 'cover', 'remove'];

describe('photo order model: every shape x every action', () => {
  const shapes: Array<{ name: string; s: Photos }> = [
    { name: '0 pictures, no cover', s: { cover: '', gallery: [] } },
    { name: '1 picture, no cover', s: { cover: '', gallery: pics(1) } },
    { name: 'a lone cover', s: { cover: C, gallery: [] } },
    { name: '2 pictures, no cover', s: { cover: '', gallery: pics(2) } },
    { name: 'cover + 2', s: { cover: C, gallery: pics(2) } },
    { name: '30 pictures, no cover', s: { cover: '', gallery: pics(30) } },
    { name: 'cover + 30', s: { cover: C, gallery: pics(30) } },
  ];
  for (const { name, s } of shapes) {
    const list = photosOf(s);
    it(`${name}: a blocked action changes nothing and says why; an allowed one keeps every other picture`, () => {
      for (let i = -1; i <= list.length; i += 1) {
        for (const a of ACTS) {
          const why = photoBlock(s, i, a);
          const next = applyPhoto(s, i, a);
          if (why) { expect(next).toBe(s); expect(why.length).toBeGreaterThan(10); continue; }
          const after = photosOf(next);
          expect(after.length).toBe(a === 'remove' ? list.length - 1 : list.length);
          if (a !== 'remove') expect([...after].sort()).toEqual([...list].sort());
          expect(next.gallery.length).toBeLessThanOrEqual(30);
        }
      }
    });
  }

  it('0 pictures: every action is blocked', () => {
    for (const a of ACTS) expect(photoBlock({ cover: '', gallery: [] }, 0, a)).toBe(PHOTO_COPY.gone);
  });
  it('first cannot move earlier, last cannot move later, the only one cannot move at all', () => {
    expect(photoBlock({ cover: C, gallery: pics(2) }, 0, 'earlier')).toBe(PHOTO_COPY.firstCover);
    expect(photoBlock({ cover: '', gallery: pics(2) }, 0, 'earlier')).toBe(PHOTO_COPY.first);
    expect(photoBlock({ cover: '', gallery: pics(2) }, 1, 'later')).toBe(PHOTO_COPY.last);
    expect(photoBlock({ cover: '', gallery: pics(1) }, 0, 'later')).toBe(PHOTO_COPY.only);
  });
  it('the cover cannot be removed here, and the reason differs for a lone cover', () => {
    expect(photoBlock({ cover: C, gallery: [] }, 0, 'remove')).toBe(PHOTO_COPY.coverLone);
    expect(photoBlock({ cover: C, gallery: pics(2) }, 0, 'remove')).toBe(PHOTO_COPY.coverMany);
    expect(photoBlock({ cover: C, gallery: pics(2) }, 0, 'cover')).toBe(PHOTO_COPY.isCover);
  });
  it('Make cover: the old cover becomes picture 2; with no cover, the picture leaves the gallery', () => {
    const [a, b] = pics(2);
    expect(applyPhoto({ cover: C, gallery: [a, b] }, 2, 'cover')).toEqual({ cover: b, gallery: [C, a] });
    expect(applyPhoto({ cover: '', gallery: [a, b] }, 1, 'cover')).toEqual({ cover: b, gallery: [a] });
  });
  it('moving picture 2 earlier makes it the cover; moving the cover later makes picture 2 the cover', () => {
    const [a, b] = pics(2);
    expect(applyPhoto({ cover: C, gallery: [a, b] }, 1, 'earlier')).toEqual({ cover: a, gallery: [C, b] });
    expect(applyPhoto({ cover: C, gallery: [a, b] }, 0, 'later')).toEqual({ cover: a, gallery: [C, b] });
  });
  it('the last gallery picture removed leaves an empty gallery (the cover stays)', () => {
    expect(applyPhoto({ cover: '', gallery: pics(1) }, 0, 'remove')).toEqual({ cover: '', gallery: [] });
    expect(applyPhoto({ cover: C, gallery: pics(1) }, 1, 'remove')).toEqual({ cover: C, gallery: [] });
  });
  it('duplicate URLs: actions go by position, so the second copy moves and removes, not the first', () => {
    const [a, b] = pics(2);
    expect(applyPhoto({ cover: '', gallery: [a, b, a] }, 2, 'earlier')).toEqual({ cover: '', gallery: [a, a, b] });
    expect(applyPhoto({ cover: '', gallery: [a, b, a] }, 2, 'remove')).toEqual({ cover: '', gallery: [a, b] });
    expect(photosOf({ cover: a, gallery: [a, b] }), 'a gallery copy of the cover is listed once').toEqual([a, b]);
  });
});

// ---- the sheet, through the real send path ----

type Raw = Record<string, unknown>;
afterEach(() => { cleanup(); rpc.mockReset(); flagState.on = true; });

function shapeWith(cover: string | null, gallery: string[]): Raw {
  const raw = structuredClone(SHAPES.oneoff) as Raw;
  const row = ((raw.series as Raw).series as Raw);
  row.default_cover_image_url = cover;
  row.gallery = gallery;
  return raw;
}

function server(raw: Raw, command: (n: number) => unknown = () => ({ data: { ok: true, new_version: 8 }, error: null })) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return command(envs.length); }
    return { data: null, error: null };
  });
  return envs;
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId', element: <p data-testid="p3-event">event</p> },
  ], { initialEntries: ['/account/p3/events/ser-1/details'] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}

const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
const openSheet = async () => { await waitFor(() => screen.getByTestId('p3-d-pictures-open')); await press(screen.getByTestId('p3-d-pictures-open')); };
const tiles = () => screen.getAllByTestId('p3-picture-pick');

describe('P3 Pictures sheet, flag on', () => {
  it.each([
    { n: 0, cover: null },
    { n: 1, cover: null },
    { n: 2, cover: C },
    { n: 30, cover: C },
  ])('$n pictures (cover: $cover): tiles in order, each says what to do, no command until Save', async ({ n, cover }) => {
    const envs = server(shapeWith(cover, pics(n)));
    show();
    await openSheet();
    const total = n + (cover ? 1 : 0);
    expect(screen.queryAllByTestId('p3-picture-pick')).toHaveLength(total);
    expect(screen.queryAllByTestId('p3-picture-remove'), 'no X tiles with the flag on').toHaveLength(0);
    if (total === 0) expect(screen.getByTestId('p3-pictures-empty').textContent).toMatch(/add/i);
    else expect(screen.getByTestId('p3-pictures-order-hint').textContent).toMatch(/Tap/);
    if (cover) expect(screen.getByTestId('p3-picture-cover-badge')).toBeTruthy();
    if (total) {
      await press(tiles()[0]);
      const bar = screen.getByTestId('p3-picture-bar');
      expect((within(bar).getByTestId('p3-picture-earlier') as HTMLButtonElement).disabled).toBe(true);
      expect(within(bar).getByTestId('p3-picture-why-earlier').textContent!.length).toBeGreaterThan(10);
    }
    await press(screen.getByTestId('p3-pictures-done'));
    expect(envs).toHaveLength(0);
  });

  it('Make cover then Save sends ONE series.upsert with the cover and the gallery', async () => {
    const [a, b] = pics(2);
    const envs = server(shapeWith(C, [a, b]));
    show();
    await openSheet();
    await press(tiles()[2]);
    await press(screen.getByTestId('p3-picture-cover'));
    await press(screen.getByTestId('p3-pictures-done'));
    await press(screen.getByTestId('p3-save'));
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(envs[0]).toMatchObject({ command: { kind: 'series.upsert', payload: { name: 'Halloween Party', default_cover_image_url: b, default_gallery: [C, a] } } });
  });

  it('Remove the last gallery picture: count says None yet, Save sends an empty gallery', async () => {
    const envs = server(shapeWith(null, pics(1)));
    show();
    await openSheet();
    await press(tiles()[0]);
    await press(screen.getByTestId('p3-picture-remove'));
    expect(screen.queryAllByTestId('p3-picture-pick')).toHaveLength(0);
    expect(screen.queryByTestId('p3-picture-bar')).toBeNull();
    await press(screen.getByTestId('p3-pictures-done'));
    expect(screen.getByTestId('p3-d-pictures-count').textContent).toBe(L.detailsPicturesCount(0));
    await press(screen.getByTestId('p3-save'));
    await waitFor(() => expect(envs).toHaveLength(1));
    expect((envs[0].command as Raw).payload).toEqual({ name: 'Halloween Party', default_gallery: [] });
  });

  it('a failed save keeps the edit and the count follows the draft, not a stale row', async () => {
    const envs = server(shapeWith(null, pics(3)), () => ({ data: null, error: { message: 'boom', code: 'P0001' } }));
    show();
    await openSheet();
    await press(tiles()[1]);
    await press(screen.getByTestId('p3-picture-remove'));
    await press(screen.getByTestId('p3-pictures-done'));
    expect(screen.getByTestId('p3-d-pictures-count').textContent).toBe(L.detailsPicturesCount(2));
    await press(screen.getByTestId('p3-save'));
    await waitFor(() => expect(envs.length).toBeGreaterThan(0));
    await waitFor(() => expect((screen.getByTestId('p3-save') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('p3-d-pictures-count').textContent).toBe(L.detailsPicturesCount(2));
    await openSheet();
    expect(tiles()).toHaveLength(2);
  });

  it('flag off: the X grid, no tile actions', async () => {
    flagState.on = false;
    server(shapeWith(C, pics(2)));
    show();
    await openSheet();
    expect(screen.queryAllByTestId('p3-picture-pick')).toHaveLength(0);
    expect(screen.getAllByTestId('p3-picture-remove')).toHaveLength(2);
  });
});
