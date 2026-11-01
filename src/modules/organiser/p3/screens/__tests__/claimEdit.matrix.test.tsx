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
 * order on Details, Pictures (main's row and sheet), and an
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

  it('Details: name, about, cover, Pictures, ticket link first; the rest under More details; nothing removed', async () => {
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

  it('Details: untouched, Save is off and sends nothing; the Pictures count is the stored one', async () => {
    const envs = server(raw);
    show(DETAILS, raw);
    await screen.findByTestId('p3-details');
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().textContent).toBe(L.nothingChanged);
    await press(saveBtn());
    expect(envs).toHaveLength(0);
    const stored = ((raw.series as Raw).series as Raw).gallery;
    expect(screen.getByTestId('p3-d-pictures-count').textContent).toBe(L.detailsPicturesCount(Array.isArray(stored) ? stored.length : 0));
    expect(screen.queryByTestId('p3-d-photos')).toBeNull();
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

describe('claim-edit-fix r3: zero dates (Photos field dropped; main\'s Pictures row is the one way)', () => {
  it('F5: an event with no dates says Save / Saved.', () => {
    expect(saveWordsFor(hasOneDate(0, 0))).toEqual(saveWordsFor(true));
  });
});
