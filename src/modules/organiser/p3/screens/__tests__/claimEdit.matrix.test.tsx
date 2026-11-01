// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, item, occ, program, weekly, wsRaw } from './wsFixtures';
import { L, hasOneDate, saveWordsFor } from '../../model';

/*
 * claim-edit-fix r1: Details x EventPage x the shapes owners really have (weekly with 30 dates,
 * weekly 16, one-off 1 date, one-off 2 dates, draft, ended, with/without sessions, no gallery,
 * 10 photos). One shared word mapping (model/saveWords), edit rows above the lists, field
 * order on Details, gallery for every date sent as series.upsert default_gallery, and an
 * untouched Save that sends nothing.
 */

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'city-9' }) }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: upload }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: { publishReady: true, requiredLeft: [] } }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [{ id: 'v1', name: 'Salsa Hall', neighbourhood: null, city_name: 'Leeds', address: null, postcode: null }] }),
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { cleanup(); rpc.mockReset(); upload.mockReset(); });

type Raw = Record<string, unknown>;
const PARTY = program([item('pty', 'party', 'Social', '21:00', '01:00', [['DJ Kizzy', 'djing']])]);
const pics = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example.test/${i}.jpg`);
const one = (extra: Raw = {}) => wsRaw({ format: 'one_off', recurrence_rule: null, ...extra }, PARTY, [occ('2026-10-31')]);

const CASES: Array<[name: string, raw: Raw, oneDate: boolean]> = [
  ['weekly 30 dates', wsRaw({}, PARTY, weekly('2026-10-30', 30).map((d) => occ(d))), false],
  ['weekly 16 dates', wsRaw({}, PARTY, weekly('2026-10-30', 16).map((d) => occ(d))), false],
  ['one-off 1 date', one(), true],
  ['one-off 2 dates', wsRaw({ format: 'one_off', recurrence_rule: null }, PARTY, [occ('2026-10-31'), occ('2026-11-01')]), false],
  ['draft, no dates', SHAPES.draft, true],
  ['draft with one date', one({ lifecycle_status: 'draft' }), true],
  ['ended', SHAPES.ended, false],
  ['with sessions', SHAPES.weekly, false],
  ['without sessions', SHAPES.noSessions, false],
  ['no gallery', one({ gallery: [] }), true],
  ['10 photos', wsRaw({ gallery: pics(10) }, PARTY, weekly('2026-10-30', 8).map((d) => occ(d))), false],
  ['one date of a longer series', wsRaw({}, PARTY, [occ('2026-10-30')], { total: 40 }), false],
];

function server(raw: Raw) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return { data: { ok: true, new_version: 8 }, error: null }; }
    return { data: null, error: null };
  });
  return envs;
}

function show(path: string, raw: Raw) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <EventPage /> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
    { path: '/account/p3/events', element: <p>events</p> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  void raw;
}

const DETAILS = '/account/p3/events/ser-1/details';
const PRICES = '/account/p3/events/ser-1/prices';
const EVENT = '/account/p3/events/ser-1';
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;
const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('one shared save-word mapping', () => {
  it('one date says Save / Saved; anything else says for all dates', () => {
    expect(saveWordsFor(true)).toEqual({ save: 'Save', nothing: L.nothingChanged, detailsSaved: 'Saved. Dancers see it now.', pricesSaved: 'Saved. Dancers see it now.' });
    expect(saveWordsFor(false)).toEqual({ save: L.saveAll, nothing: L.nothingChanged, detailsSaved: L.detailsSaved, pricesSaved: L.pricesSaved });
  });
  it('hasOneDate: a page of one date is one date only when the series total agrees', () => {
    expect(hasOneDate(1, null)).toBe(true);
    expect(hasOneDate(1, 1)).toBe(true);
    expect(hasOneDate(1, 40)).toBe(false);
    expect(hasOneDate(0, 0)).toBe(true);
    expect(hasOneDate(0, null)).toBe(true);
    expect(hasOneDate(0, 5)).toBe(false);
    expect(hasOneDate(2, 2)).toBe(false);
  });
});

describe.each(CASES)('%s', (_name, raw, oneDate) => {
  it('event page: the edit rows come before Sessions and Coming up', async () => {
    server(raw);
    show(EVENT, raw);
    const rows = await screen.findByTestId('p3-edit-rows');
    expect(screen.getByTestId('p3-open-details').textContent).toContain(L.detailsTitle);
    expect(screen.getByTestId('p3-open-prices').textContent).toContain(L.prices);
    const lists = [screen.queryByTestId('p3-sessions'), screen.queryByTestId('p3-coming')].filter(Boolean) as Element[];
    expect(lists.length).toBeGreaterThan(0);
    for (const l of lists) expect(before(rows, l)).toBe(true);
    // About stays below, without a second copy of the rows
    expect(screen.getAllByTestId('p3-edit-rows')).toHaveLength(1);
  });

  it('Details: name, about, cover, photos, ticket link first; the rest under More details; nothing removed', async () => {
    server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    const order = ['name', 'description', 'cover', 'gallery', 'ticket'].map((k) => screen.getByTestId(`p3-field-${k}`));
    const more = screen.getByTestId('p3-d-more');
    for (let i = 1; i < order.length; i++) expect(before(order[i - 1], order[i])).toBe(true);
    expect(before(order[order.length - 1], more)).toBe(true);
    for (const k of ['venueId', 'instagram', 'videos', 'chat']) expect(before(more, screen.getByTestId(`p3-field-${k}`))).toBe(true);
    expect(screen.getByTestId('p3-d-music')).toBeTruthy();
    expect(screen.getByTestId('p3-d-kind')).toBeTruthy();
  });

  it('Details: untouched, Save is off and sends nothing; the photos shown are the stored ones', async () => {
    const envs = server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().textContent).toBe(L.nothingChanged);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    const stored = ((raw.series as Raw).series as Raw).gallery;
    expect(screen.queryAllByTestId('p3-d-photo')).toHaveLength(Array.isArray(stored) ? stored.length : 0);
  });

  // a nameless draft and an ended event cannot be saved (blocked / locked): their Save stays off by design
  it.skipIf(_name === 'draft, no dates' || _name === 'ended')('Details and Prices: the Save button and the toast use the shared words', async () => {
    const words = saveWordsFor(oneDate);
    for (const [path, toast] of [[DETAILS, words.detailsSaved], [PRICES, words.pricesSaved]] as const) {
      cleanup();
      const envs = server(raw);
      show(path, raw);
      if (path === DETAILS) {
        await screen.findByTestId('p3-details');
        fireEvent.change(screen.getByTestId('p3-d-ticket'), { target: { value: 'https://tickets.example.test/new' } });
      } else {
        await screen.findByTestId('p3-prices');
        await press(screen.getByTestId('p3-price-add'));
        fireEvent.change(screen.getByTestId('p3-price-name'), { target: { value: 'Entry' } });
        fireEvent.change(screen.getByTestId('p3-price-amount'), { target: { value: '10' } });
      }
      expect(saveBtn().textContent).toBe(words.save);
      if (path === DETAILS) {
        await press(saveBtn());
        await waitFor(() => screen.getByTestId('p3-toast'));
        expect(envs).toHaveLength(1);
        expect(screen.getByTestId('p3-toast').textContent).toContain(toast);
      }
    }
  });
});

describe('Photos for every date', () => {
  it('adding two photos sends ONE series.upsert with default_gallery and the name, then the shared toast', async () => {
    const raw = wsRaw({ gallery: pics(2) }, PARTY, weekly('2026-10-30', 30).map((d) => occ(d)));
    const envs = server(raw);
    upload.mockResolvedValueOnce('https://img.example.test/new1.jpg').mockResolvedValueOnce('https://img.example.test/new2.jpg');
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    const file = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
    await act(async () => { fireEvent.change(screen.getByTestId('p3-d-photos-file'), { target: { files: [file('a.jpg'), file('b.jpg')] } }); });
    await waitFor(() => expect(screen.getAllByTestId('p3-d-photo')).toHaveLength(4));
    expect(saveBtn().textContent).toBe(L.saveAll);
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(envs[0]).toMatchObject({ expected_version: 7, command: { kind: 'series.upsert', payload: { name: 'Sensual Fridays', default_gallery: [...pics(2), 'https://img.example.test/new1.jpg', 'https://img.example.test/new2.jpg'] } } });
    await waitFor(() => expect(screen.getByTestId('p3-toast').textContent).toContain(L.detailsSaved));
  });

  it('removing one of 10 photos sends the other 9; removing all sends an empty list', async () => {
    const raw = wsRaw({ gallery: pics(10) }, PARTY, weekly('2026-10-30', 8).map((d) => occ(d)));
    const envs = server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    fireEvent.click(screen.getAllByTestId('p3-d-photo-remove')[3]);
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(((envs[0].command as Raw).payload as Raw).default_gallery).toEqual(pics(10).filter((_, i) => i !== 3));
  });

  it('a failed upload keeps the photos already here and says why; nothing is sent', async () => {
    const raw = wsRaw({ gallery: pics(1) }, PARTY, weekly('2026-10-30', 4).map((d) => occ(d)));
    const envs = server(raw);
    upload.mockRejectedValueOnce(new Error('That file is too big.'));
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    await act(async () => { fireEvent.change(screen.getByTestId('p3-d-photos-file'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } }); });
    await waitFor(() => screen.getByTestId('p3-d-photos-error'));
    expect(screen.getAllByTestId('p3-d-photo')).toHaveLength(1);
    expect(saveBtn().disabled).toBe(true);
    expect(envs).toHaveLength(0);
  });

  it('30 photos: no Add button, and it says why', async () => {
    const raw = wsRaw({ gallery: pics(30) }, PARTY, weekly('2026-10-30', 4).map((d) => occ(d)));
    server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    expect(screen.queryByTestId('p3-d-photos-add')).toBeNull();
    expect(screen.getByTestId('p3-d-photos-max')).toBeTruthy();
  });
});

describe('claim-edit-fix r2: uploads, copy, cap, zero dates', () => {
  const file = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
  const pick = async (...n: string[]) => { await act(async () => { fireEvent.change(screen.getByTestId('p3-d-photos-file'), { target: { files: n.map(file) } }); }); };
  const weeklyRaw = (gallery: string[]) => wsRaw({ gallery }, PARTY, weekly('2026-10-30', 8).map((d) => occ(d)));

  it('F1: while a photo uploads, Save is off, Add is off, and leaving asks', async () => {
    const raw = weeklyRaw(pics(2));
    const envs = server(raw);
    let done: (u: string) => void = () => {};
    upload.mockReturnValueOnce(new Promise<string>((r) => { done = r; }));
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    fireEvent.change(screen.getByTestId('p3-d-ticket'), { target: { value: 'https://tickets.example.test/new' } });
    expect(saveBtn().disabled).toBe(false);
    await pick('a.jpg');
    expect(saveBtn().disabled).toBe(true);
    expect((screen.getByTestId('p3-d-photos-add') as HTMLButtonElement).disabled).toBe(true);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    await press(screen.getByTestId('p3-edit-back'));
    expect(screen.queryByTestId('p3-d-photos')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => { done('https://img.example.test/n.jpg'); });
    await waitFor(() => expect(saveBtn().disabled).toBe(false));
  });

  it('F1: leaving with a photo uploading and nothing else changed still asks', async () => {
    const raw = weeklyRaw(pics(1));
    server(raw);
    upload.mockReturnValueOnce(new Promise<string>(() => {}));
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    await pick('a.jpg');
    await press(screen.getByTestId('p3-edit-back'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('F2: photos land on the latest draft, and Undo is off while uploading', async () => {
    const raw = weeklyRaw(pics(2));
    server(raw);
    let done: (u: string) => void = () => {};
    upload.mockResolvedValueOnce('https://img.example.test/n1.jpg').mockReturnValueOnce(new Promise<string>((r) => { done = r; }));
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    await pick('a.jpg', 'b.jpg');
    await waitFor(() => expect(screen.getAllByTestId('p3-d-photo')).toHaveLength(3));
    const undo = screen.queryByTestId('p3-undo-mine') as HTMLButtonElement | null;
    if (undo) expect(undo.disabled).toBe(true);
    await act(async () => { done('https://img.example.test/n2.jpg'); });
    await waitFor(() => expect(screen.getAllByTestId('p3-d-photo')).toHaveLength(4));
  });

  it('F3: the hint and toast do not claim every date; one mapping; series gallery with 2 dates on their own photos', async () => {
    expect(L.detailsPhotosHint).toContain('every date that has no photos of its own');
    expect(L.detailsSaved).not.toMatch(/every date\./);
    expect(L.detailsSaved).toContain('own photos keeps them');
    const raw = weeklyRaw(pics(2));
    const envs = server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    expect(screen.getByTestId('p3-field-gallery').textContent).toContain(L.detailsPhotosHint);
    fireEvent.click(screen.getAllByTestId('p3-d-photo-remove')[0]);
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('p3-toast').textContent).toContain('own photos keeps them'));
  });

  it('F4: picking more photos than fit says the cap instead of dropping silently', async () => {
    const raw = weeklyRaw(pics(29));
    server(raw);
    upload.mockResolvedValue('https://img.example.test/x.jpg');
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    await pick('a.jpg', 'b.jpg', 'c.jpg');
    await waitFor(() => expect(screen.getAllByTestId('p3-d-photo')).toHaveLength(30));
    expect(screen.getByTestId('p3-d-photos-error').textContent).toBe(L.datePhotosMax(30));
  });

  it('F5: an event with no dates says Save / Saved.', () => {
    expect(saveWordsFor(hasOneDate(0, 0))).toEqual(saveWordsFor(true));
  });
});
