// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, wsRaw } from './wsFixtures';
import { L } from '../../model';
import { parseEventWorkspace } from '../../../events/eventModel';

/*
 * A picture that does not load shows a plain note, never a broken icon, and the control that fixes it stays.
 * Rows: the Details cover, a date's picture. (The brief also names an "event pictures" grid on Details; main has
 * none -- the only gallery is the date sheet's -- so that row is not in the table.)
 */
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [{ id: 'v1', name: 'Salsa Hall', neighbourhood: null, city_name: 'Leeds', address: null, postcode: null }] }),
}));
vi.mock('../../../events/media', () => ({ uploadEventPicture: vi.fn() }));

import { DetailsScreen } from '../DetailsScreen';
import { DateFieldSheet } from '../DateFieldSheets';

afterEach(() => { cleanup(); rpc.mockReset(); });

const GOOD = 'https://example.test/good.jpg';
const DEAD = 'https://example.test/dead-404.jpg';
const NEW = 'https://example.test/new.jpg';
const fail = (el: Element) => act(() => { fireEvent.error(el); });
const NOTE = L.detailsImageBroken;

interface Row {
  name: string;
  /** Mount with these picture addresses; returns what the test needs. */
  mount: (urls: string[], opts?: { off?: boolean }) => Promise<{ sent: () => number }>;
  imgs: () => HTMLImageElement[];
  fix: () => HTMLElement; // the control that fixes a broken picture
  fixAlive: () => boolean;
  /** Change the address to NEW, where the row can. */
  swap?: () => Promise<void>;
  /** Remove the first picture, where the row can. */
  remove?: () => Promise<void>;
}

const cover: Row = {
  name: 'cover',
  async mount(urls) {
    const envs: unknown[] = [];
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_event_workspace_p5') return { data: wsRaw({ default_cover_image_url: urls[0] ?? null }, SHAPES.weekly ? [] : [], []), error: null };
      if (name === 'series_command_p5') { envs.push(args.p_envelope); return { data: { ok: true, new_version: 8 }, error: null }; }
      return { data: null, error: null };
    });
    const router = createMemoryRouter([{ path: '/d/:seriesId', element: <DetailsScreen /> }], { initialEntries: ['/d/ser-1'] });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
    await waitFor(() => screen.getByTestId('p3-field-cover'));
    return { sent: () => envs.length };
  },
  imgs: () => Array.from(screen.getByTestId('p3-field-cover').querySelectorAll('img')),
  fix: () => screen.getByTestId('p3-d-cover-btn'),
  fixAlive: () => !(screen.getByTestId('p3-d-cover') as HTMLInputElement).disabled,
};

const sheet = (urls: string[]) => {
  const raw = wsRaw({ default_cover_image_url: null }, [], []);
  const ws = parseEventWorkspace(raw);
  const onSave = vi.fn();
  const detail = { galleryOverride: urls, titleOverride: null, passesOverride: null } as never;
  const view = (u: string[], disabled = false) => (
    <DateFieldSheet step="edit-photos" ws={ws} detail={{ ...(detail as object), galleryOverride: u } as never} busy={disabled} error={null} onSave={onSave} onBack={() => {}} onClose={() => {}} />
  );
  return { onSave, view };
};
const datePic: Row = {
  name: 'date picture',
  async mount(urls, opts) {
    const s = sheet(urls);
    render(s.view(urls, opts?.off));
    return { sent: () => s.onSave.mock.calls.length };
  },
  imgs: () => Array.from(screen.getByTestId('p3-photos').querySelectorAll('img')),
  fix: () => screen.getAllByTestId('p3-photo-remove')[0],
  fixAlive: () => !(screen.getAllByTestId('p3-photo-remove')[0] as HTMLButtonElement).disabled,
  async remove() { await act(async () => { fireEvent.click(screen.getAllByTestId('p3-photo-remove')[0]); }); },
};

describe.each([cover, datePic])('a picture that does not load: $name', (row) => {
  it('loads: no note, no sideways trouble, the fixing control is there', async () => {
    const r = await row.mount([GOOD]);
    expect(row.imgs()).toHaveLength(1);
    expect(screen.queryByTestId('p3-image-broken')).toBeNull();
    expect(row.fix()).toBeTruthy();
    expect(row.fixAlive()).toBe(true);
    expect(r.sent()).toBe(0);
  });

  it('fails to load: the note replaces the picture, the fixing control stays enabled, nothing is sent', async () => {
    const r = await row.mount([DEAD]);
    fail(row.imgs()[0]);
    const note = screen.getByTestId('p3-image-broken');
    expect(note.getAttribute('role')).toBe('img');
    expect(note.getAttribute('aria-label')).toBe(NOTE);
    expect(note.textContent).toBe(NOTE);
    expect(row.imgs()).toHaveLength(0);
    expect(row.fix()).toBeTruthy();
    expect(row.fixAlive()).toBe(true);
    // the note names "change it or remove it": the control it points at is on screen
    expect(row.fix().textContent || row.fix().getAttribute('aria-label')).toBeTruthy();
    expect(r.sent()).toBe(0);
    if (row === cover) {
      expect(screen.getByTestId('p3-save') as HTMLButtonElement).toHaveProperty('disabled', true);
      await act(async () => { fireEvent.click(screen.getByTestId('p3-save')); });
      expect(r.sent()).toBe(0);
    }
  });

  it('disabled (no permission): still a note, no crash, no command', async () => {
    const r = await row.mount([DEAD], { off: true });
    fail(row.imgs()[0]);
    expect(screen.getByTestId('p3-image-broken')).toBeTruthy();
    expect(r.sent()).toBe(0);
  });
});

describe('fails, then Remove (date picture)', () => {
  it('Remove works on a broken picture and the note goes with it', async () => {
    await datePic.mount([DEAD, GOOD]);
    fail(datePic.imgs()[0]);
    expect(screen.getByTestId('p3-image-broken')).toBeTruthy();
    await datePic.remove!();
    expect(screen.queryByTestId('p3-image-broken')).toBeNull();
    expect(datePic.imgs()).toHaveLength(1);
    expect(within(screen.getByTestId('p3-photos')).getAllByTestId('p3-photo')).toHaveLength(1);
  });
});

describe('fails, then a new address (cover)', () => {
  it('a different URL gets its own try: the note is gone and the picture is drawn', async () => {
    const { BrokenImage } = await import('../BrokenImage');
    const { rerender } = render(<BrokenImage src={DEAD} className="p3-cover" />);
    fail(document.querySelector('img')!);
    expect(screen.getByTestId('p3-image-broken')).toBeTruthy();
    rerender(<BrokenImage src={NEW} className="p3-cover" />);
    expect(screen.queryByTestId('p3-image-broken')).toBeNull();
    expect(document.querySelector('img')?.getAttribute('src')).toBe(NEW);
  });
});
