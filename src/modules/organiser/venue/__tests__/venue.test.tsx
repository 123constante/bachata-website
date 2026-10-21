// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { venueName, venueOptionsQueryKey, type VenueOption } from '../../shared/publicVenues';
import { VenuePicker, type VenuePickerDeps } from '../VenuePicker';
import { lookupPostcode, normalisePostcode } from '../postcode';
import { searchVenues } from '../venueSearch';
import { createVenueDraft, similarVenues, VenueApiError } from '../venueApi';

afterEach(cleanup);
const v = (id: string, name: string, postcode: string | null = null): VenueOption => ({ id, name, neighbourhood: null, city_name: 'London', address: null, postcode });
const VENUES = [v('1', 'Pura Vida', 'E1 6AN'), v('2', 'Pura Studio', 'N1 9GU'), v('3', 'The Church Hall', 'SW9 8HH')];

describe('search shapes', () => {
  it.each([
    ['', 'idle', 0, false],
    ['p', 'partial', 2, false],
    ['zz', 'none', 0, true],
    ['pura vida', 'exact', 1, true],
    ['PURA', 'partial', 2, true],
    ['sw98hh', 'partial', 1, true],
  ])('%j -> %s (%i results, add=%s)', (q, shape, n, add) => {
    const s = searchVenues(VENUES, q);
    expect(s.shape).toBe(shape);
    expect(s.results).toHaveLength(n);
    expect(s.canAdd).toBe(add);
  });
  it('puts the exact name first', () => expect(searchVenues(VENUES, 'pura studio').results[0].id).toBe('2'));
});

const ok = (body: unknown, status = 200) => async () => ({ ok: status < 300, status, json: async () => body });
const GOOD = { result: { postcode: 'E1 6AN', latitude: 51.5, longitude: -0.07, admin_ward: 'Spitalfields', admin_district: 'Tower Hamlets' } };

describe('postcode shapes', () => {
  it.each([['e16an', 'E1 6AN'], [' SW1A 1AA ', 'SW1A 1AA'], ['nope', null], ['12345', null], ['', null]])('normalise %j', (raw, out) => expect(normalisePostcode(raw)).toBe(out));
  it('found: address, area, lat/lng', async () => {
    const r = await lookupPostcode('e16an', ok(GOOD));
    expect(r).toEqual({ ok: true, found: { postcode: 'E1 6AN', lat: 51.5, lng: -0.07, address: 'Spitalfields, Tower Hamlets', area: 'Spitalfields' } });
  });
  it('bad shape never calls the network', async () => {
    const f = vi.fn();
    expect(await lookupPostcode('xx', f)).toEqual({ ok: false, failure: 'bad' });
    expect(f).not.toHaveBeenCalled();
  });
  it('404 -> not_found; 500 -> offline; throw -> offline; no coords -> not_found', async () => {
    expect(await lookupPostcode('E1 6AN', ok({}, 404))).toEqual({ ok: false, failure: 'not_found' });
    expect(await lookupPostcode('E1 6AN', ok({}, 500))).toEqual({ ok: false, failure: 'offline' });
    expect(await lookupPostcode('E1 6AN', () => Promise.reject(new Error('x')))).toEqual({ ok: false, failure: 'offline' });
    expect(await lookupPostcode('E1 6AN', ok({ result: {} }))).toEqual({ ok: false, failure: 'not_found' });
  });
});

describe('RPC client (pinned interface, server faked)', () => {
  const place = { postcode: 'E1 6AN', lat: 51.5, lng: -0.07, address: 'a', area: 'b' };
  it('create sends the pinned arguments and parses existing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { venue_id: 'n1', existing: true }, error: null });
    expect(await createVenueDraft(' New ', place, rpc)).toEqual({ venueId: 'n1', existing: true });
    expect(rpc).toHaveBeenCalledWith('owner_create_venue_draft_v1', { p_name: 'New', p_postcode: 'E1 6AN', p_lat: 51.5, p_lng: -0.07, p_address: 'a', p_area: 'b' });
  });
  it('similar parses rows and drops malformed ones', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { venues: [{ venue_id: 'a', name: 'A', postcode: 'E1 6AN' }, { name: 'bad' }] }, error: null });
    expect(await similarVenues('A', 'E1 6AN', rpc)).toEqual([{ venueId: 'a', name: 'A', postcode: 'E1 6AN' }]);
  });
  it.each([
    [{ code: 'PGRST202', message: 'Could not find the function' }, 'unavailable'],
    [{ code: '54000', message: 'rate_limited' }, 'rate_limited'],
    [{ message: 'rate limit exceeded' }, 'failed'], // ER-FIX-C5: no substring match, AS BUILT text only
    [{ message: 'boom' }, 'failed'],
  ])('error %j -> %s', async (error, kind) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(createVenueDraft('x', place, rpc)).rejects.toMatchObject({ kind });
    await expect(createVenueDraft('x', place, rpc)).rejects.toBeInstanceOf(VenueApiError);
  });
  it('a result with no venue_id fails', async () => {
    await expect(createVenueDraft('x', place, vi.fn().mockResolvedValue({ data: {}, error: null }))).rejects.toMatchObject({ kind: 'failed' });
  });
});

function setup(deps: Partial<VenuePickerDeps> = {}) {
  const onPick = vi.fn();
  const full: VenuePickerDeps = {
    lookup: vi.fn().mockResolvedValue(await_ok()),
    similar: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ venueId: 'new1', existing: false }),
    ...deps,
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VenuePicker options={VENUES} onPick={onPick} deps={full} />
    </QueryClientProvider>,
  );
  return { onPick, deps: full };
}
function await_ok() {
  return { ok: true as const, found: { postcode: 'E1 6AN', lat: 51.5, lng: -0.07, address: 'Spitalfields, Tower Hamlets', area: 'Spitalfields' } };
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('VenuePicker', () => {
  it('hides Add until 2 letters; shows it under results; picks an existing venue', async () => {
    const { onPick } = setup();
    expect(screen.queryByTestId('venue-add-new')).toBeNull();
    type('Search venues', 'p');
    expect(screen.queryByTestId('venue-add-new')).toBeNull();
    type('Search venues', 'pu');
    const list = await screen.findByTestId('venue-results');
    const add = screen.getByTestId('venue-add-new');
    expect(list.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText('Pura Vida'));
    expect(onPick).toHaveBeenCalledWith(VENUES[0]);
  });
  it('0 results still offers Add, and says what to do', async () => {
    setup();
    type('Search venues', 'Zumba Loft');
    expect(await screen.findByTestId('venue-none')).toBeTruthy();
    expect(screen.getByTestId('venue-add-new')).toBeTruthy();
  });
  it('new venue path: name prefilled, postcode, no similar -> Add venue -> usable at once', async () => {
    const { onPick, deps } = setup();
    type('Search venues', 'Zumba Loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toBe('Zumba Loft');
    expect((screen.getByTestId('postcode-find') as HTMLButtonElement).disabled).toBe(true);
    type('Postcode', 'e16an');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    await screen.findByTestId('venue-confirm');
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(deps.create).toHaveBeenCalledWith('Zumba Loft', expect.objectContaining({ postcode: 'E1 6AN' }));
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'new1', name: 'Zumba Loft', postcode: 'E1 6AN' });
  });
  it('similar list: tap a venue picks it and creates nothing', async () => {
    const { onPick, deps } = setup({ similar: vi.fn().mockResolvedValue([{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: 'E1 6AN' }]) });
    type('Search venues', 'Zumba Loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    fireEvent.click(await screen.findByTestId('similar-venue'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    expect(deps.create).not.toHaveBeenCalled();
  });
  it('similar list: "No, it\'s a new venue" goes on to Add venue', async () => {
    setup({ similar: vi.fn().mockResolvedValue([{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: null }]) });
    type('Search venues', 'Zumba Loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    fireEvent.click(await screen.findByTestId('similar-none'));
    expect(screen.getByTestId('venue-add')).toBeTruthy();
  });
  it('existing:true picks that venue and the screen does not duplicate it', async () => {
    const { onPick } = setup({ create: vi.fn().mockResolvedValue({ venueId: '1', existing: true }) });
    type('Search venues', 'Pura Vida');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    await screen.findByTestId('venue-confirm');
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(VENUES[0]));
  });
  it('postcode failures: bad, not found, offline (with retry that recovers)', async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce({ ok: false, failure: 'not_found' })
      .mockResolvedValueOnce({ ok: false, failure: 'offline' })
      .mockResolvedValueOnce(await_ok());
    setup({ lookup });
    type('Search venues', 'Zumba');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/could not find that postcode/);
    click('Look up postcode');
    const retry = await screen.findByTestId('postcode-offline-retry');
    fireEvent.click(retry);
    await screen.findByTestId('postcode-found');
  });
  it('editing the postcode after a lookup clears the result', async () => {
    setup();
    type('Search venues', 'Zumba');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    type('Postcode', 'E1 6A');
    expect(screen.queryByTestId('postcode-found')).toBeNull();
  });
  it('a failed create shows a calm error and keeps Add venue', async () => {
    setup({ create: vi.fn().mockRejectedValue(new VenueApiError('unavailable')) });
    type('Search venues', 'Zumba');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    await screen.findByTestId('venue-confirm');
    click('Add venue');
    expect((await screen.findByTestId('venue-save-error')).textContent).toMatch(/not available yet/);
    expect(screen.getByTestId('venue-add')).toBeTruthy();
  });
});

// ER-FIX-C5: wave 1 review findings C5-1..C5-7. Each row was run RED on the unfixed code first.
describe('ER-FIX-C5', () => {
  const place = { postcode: 'E1 6AN', lat: 51.5, lng: -0.07, address: 'a', area: 'b' };
  it.each([
    // C5-1 AS BUILT: rate limit = 54000 + rate_limited; other refusals are P0001; a real network failure has no code.
    [{ code: '54000', message: 'rate_limited' }, 'rate_limited'],
    [{ code: 'P0001', message: 'permission_denied: authentication_required' }, 'refused'],
    [{ code: 'P0001', message: 'invalid_payload: p_postcode' }, 'refused'],
    [{ code: 'P0001', message: 'invalid_payload: separate rate check' }, 'refused'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'failed'],
  ])('C5-1 error %j -> %s', async (error, kind) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(createVenueDraft('x', place, rpc)).rejects.toMatchObject({ kind });
  });

  const toConfirm = async () => {
    type('Search venues', 'Zumba Loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
  };
  it.each([
    ['rate_limited', 'You can add 5 venues a day. Try again tomorrow, or pick an existing venue.'],
    ['refused', /could not be added/],
    ['failed', /Check your connection/],
  ] as const)('C5-1/C5-3 %s shows its own message', async (kind, text) => {
    setup({ create: vi.fn().mockRejectedValue(new VenueApiError(kind)) });
    await toConfirm();
    await screen.findByTestId('venue-confirm');
    click('Add venue');
    const msg = (await screen.findByTestId('venue-save-error')).textContent ?? '';
    if (typeof text === 'string') expect(msg).toBe(text);
    else expect(msg).toMatch(text);
    if (kind !== 'failed') expect(msg).not.toMatch(/connection/);
  });

  it('C5-2 a created venue lands in the venue options cache at once', async () => {
    const client = new QueryClient();
    client.setQueryData(venueOptionsQueryKey, VENUES);
    const onPick = vi.fn();
    const deps: VenuePickerDeps = {
      lookup: vi.fn().mockResolvedValue(await_ok()),
      similar: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ venueId: 'new1', existing: false }),
    };
    render(<QueryClientProvider client={client}><VenuePicker options={VENUES} onPick={onPick} deps={deps} /></QueryClientProvider>);
    await toConfirm();
    await screen.findByTestId('venue-confirm');
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const cached = client.getQueryData<VenueOption[]>(venueOptionsQueryKey) ?? [];
    expect(venueName(cached, 'new1')).toBe('Zumba Loft');
    expect(cached).toHaveLength(VENUES.length + 1);
  });

  it('C5-4 a part postcode says a full one is needed', async () => {
    setup();
    type('Search venues', 'Zumba');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6A');
    expect(screen.getByText('Full UK postcode needed')).toBeTruthy();
  });

  it('C5-5 existing:true outside the list uses the stored name, not the typed one', async () => {
    const { onPick } = setup({
      similar: vi.fn().mockResolvedValue([{ venueId: 'z9', name: 'Zumba Loft', postcode: 'E1 6AN' }]),
      create: vi.fn().mockResolvedValue({ venueId: 'z9', existing: true }),
    });
    type('Search venues', 'zumba loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    fireEvent.click(await screen.findByTestId('similar-none'));
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'z9', name: 'Zumba Loft' });
  });

  it('C5-6 venue source files hold no raw non-ASCII', () => {
    for (const f of ['VenuePicker.tsx', 'venueSearch.ts', 'venueApi.ts', 'postcode.ts']) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect([...src].filter((ch) => ch.charCodeAt(0) > 127), f).toEqual([]);
    }
    expect(searchVenues([v('x', 'Café Tango')], 'cafe tango').shape).toBe('exact');
  });

  it('C5-7 each step moves focus to its heading or first field; "Is it one of these?" has Back', async () => {
    setup({ similar: vi.fn().mockResolvedValue([{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: null }]) });
    type('Search venues', 'Zumba Loft');
    fireEvent.click(await screen.findByTestId('venue-add-new'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Venue name')));
    type('Postcode', 'E1 6AN');
    click('Look up postcode');
    await screen.findByTestId('postcode-found');
    click('Next');
    const heading = await screen.findByRole('heading', { name: 'Is it one of these?' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    click('Back');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Venue name')));
    click('Next');
    fireEvent.click(await screen.findByTestId('similar-none'));
    const confirm = await screen.findByRole('heading', { name: 'Zumba Loft' });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
  });
});
