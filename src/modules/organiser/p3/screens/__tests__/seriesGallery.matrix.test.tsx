// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, wsRaw } from './wsFixtures';
import { L } from '../../model';
import { parseEventWorkspace } from '../../../events/eventModel';
import { mediaCommand } from '../../../events/seriesExtras';
import { detailsDraftOf, detailsPlan } from '../../data/details';

/*
 * Series pictures on the P3 Details screen (audit row 13): gallery shapes (0, 1, 2, 5, over the
 * 30 cap) x owner / not-owner x course / recurring / festival. Pins the exact command a save
 * sends (the same default_gallery upsert mediaCommand builds), or none.
 */
const rpc = vi.hoisted(() => vi.fn());
const owner = vi.hoisted(() => ({ ready: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: owner.ready, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { DetailsScreen } from '../DetailsScreen';

afterEach(() => { cleanup(); rpc.mockReset(); owner.ready = true; });

type Raw = Record<string, unknown>;
const pics = (n: number) => Array.from({ length: n }, (_, i) => `https://cdn.example/g${i + 1}.webp`);
const KINDS = { recurring: SHAPES.weekly, course: SHAPES.course, festival: SHAPES.festival } as const;
const withGallery = (shape: Raw, n: number): Raw => {
  const s = (shape.series as Raw).series as Raw;
  return { ...shape, series: { ...(shape.series as Raw), series: { ...s, gallery: pics(n) } } };
};

function show(raw: Raw) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return { data: { ok: true, new_version: 8 }, error: null }; }
    return { data: null, error: null };
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId', element: <p data-testid="p3-event">event</p> },
  ], { initialEntries: ['/account/p3/events/ser-1/details'] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return envs;
}
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;

describe.each(Object.entries(KINDS))('%s', (kind, shape) => {
  describe.each([0, 1, 2, 5, 31])('%i pictures', (n) => {
    it('owner: the row shows the count; remove one sends ONE default_gallery upsert (same as mediaCommand); untouched sends nothing', async () => {
      const raw = withGallery(shape, n);
      const envs = show(raw);
      await waitFor(() => screen.getByTestId('p3-d-pictures-count'));
      expect(screen.getByTestId('p3-d-pictures-count').textContent).toBe(L.detailsPicturesCount(n));
      const open = screen.getByTestId('p3-d-pictures-open') as HTMLButtonElement;
      if (kind === 'festival') {
        expect(open.disabled).toBe(true);
        expect(screen.getByTestId('p3-d-pictures-festival').textContent).toBe(L.detailsPicturesFestival);
        return;
      }
      expect(open.textContent).toBe(n ? L.detailsPicturesEdit : L.detailsPicturesAdd);
      fireEvent.click(open);
      await waitFor(() => screen.getByTestId('p3-sheet'));
      expect(screen.queryAllByTestId('p3-picture')).toHaveLength(n);
      if (n === 0) expect(screen.getByTestId('p3-pictures-empty').textContent).toBe(L.detailsPicturesEmpty);
      if (n >= 30) expect(screen.getByTestId('p3-pictures-max')).toBeTruthy();
      else expect(screen.getByTestId('p3-pictures-add')).toBeTruthy();
      expect(saveBtn().disabled).toBe(true); // untouched
      if (n === 0) return;
      fireEvent.click(screen.getAllByTestId('p3-picture-remove')[0]);
      fireEvent.click(screen.getByTestId('p3-pictures-done'));
      await act(async () => { fireEvent.click(saveBtn()); });
      await waitFor(() => expect(envs).toHaveLength(1));
      const ws = parseEventWorkspace(raw);
      expect((envs[0].command as Raw)).toEqual(mediaCommand(ws, 'default_gallery', pics(n).slice(1)));
    });
  });
});

describe('not the owner (profile unfinished)', () => {
  it.each(['recurring', 'course'] as const)('%s: Pictures is greyed, nothing can be sent', async (kind) => {
    owner.ready = false;
    const envs = show(withGallery(KINDS[kind], 2));
    await waitFor(() => screen.getByTestId('p3-details-lock'));
    expect((screen.getByTestId('p3-d-pictures-open') as HTMLButtonElement).disabled).toBe(true);
    expect(saveBtn().disabled).toBe(true);
    expect(envs).toHaveLength(0);
  });
});

describe('plan', () => {
  it('only the gallery changed: exactly name + default_gallery', () => {
    const ws = parseEventWorkspace(withGallery(SHAPES.weekly, 2));
    const base = detailsDraftOf(ws);
    expect(detailsPlan(base, { ...base, gallery: pics(3) })).toEqual([mediaCommand(ws, 'default_gallery', pics(3))]);
    expect(detailsPlan(base, { ...base })).toEqual([]);
  });
  it('over the cap is a problem', () => {
    const base = detailsDraftOf(parseEventWorkspace(wsRaw({}, [], [])));
    expect(detailsPlan(base, { ...base, gallery: pics(31) })).toEqual([]);
  });
});
