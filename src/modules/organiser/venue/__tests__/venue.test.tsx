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
import { addVenueBlock } from '../addVenue';

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

// ER-FIX2-S3 (F-C5-1): ONE "Add a new venue" sheet per prototype v7. These replace the four-step
// tests (search -> details + "Look up postcode" -> "Is it one of these?" -> confirm), whose rule is superseded.
const openAdd = async (q = 'Zumba Loft') => {
  type('Search venues', q);
  fireEvent.click(await screen.findByTestId('venue-add-new'));
};
const reason = () => screen.queryByTestId('venue-add-reason')?.textContent ?? null;
const addBtn = () => screen.getByTestId('venue-add') as HTMLButtonElement;
/** Name + postcode typed, lookup + look-alike check answered: Add venue is enabled. */
const fillReady = async (postcode = 'E1 6AN') => {
  type('Postcode', postcode);
  await waitFor(() => expect(addBtn().disabled).toBe(false));
};

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
  it('ONE sheet: name prefilled + postcode + Add venue on the same screen, no Look up / Next / confirm step', async () => {
    const { onPick, deps } = setup();
    await openAdd();
    const sheet = screen.getByTestId('venue-add-sheet');
    expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toBe('Zumba Loft');
    expect(sheet.contains(screen.getByLabelText('Postcode'))).toBe(true);
    expect(sheet.contains(addBtn())).toBe(true);
    expect(screen.queryByRole('button', { name: /look up postcode/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^next$/i })).toBeNull();
    await fillReady('e16an');
    expect(deps.lookup).toHaveBeenCalledWith('E1 6AN');
    expect(screen.getByTestId('postcode-found')).toBeTruthy();
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(deps.create).toHaveBeenCalledWith('Zumba Loft', expect.objectContaining({ postcode: 'E1 6AN' }));
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'new1', name: 'Zumba Loft', postcode: 'E1 6AN' });
    expect(onPick.mock.calls[0][1]).toEqual({ existing: false });
    expect(screen.queryByTestId('venue-confirm')).toBeNull();
  });
  it.each([
    // [name, postcode, look-alikes, expected reason] -- prototype v7 nvBlock wording
    ['', '', [], 'Type the name'],
    ['Zu', 'E1 6AN', [], 'Type the name'], // F-C5-2: 3 letters, not 2
    ['Zumba Loft', '', [], 'Type the postcode'],
    ['Zumba Loft', 'E1 6A', [], 'Type the postcode'],
    ['Zumba Loft', 'E1 6AN', [{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: 'E1 6AN' }], 'Check the list above'],
    ['Zumba Loft', 'E1 6AN', [], null],
  ])('Add venue reason: name %j, postcode %j -> %j', async (name, postcode, rows, expected) => {
    setup({ similar: vi.fn().mockResolvedValue(rows) });
    await openAdd();
    type('Venue name', name);
    type('Postcode', postcode);
    if (expected === null) await waitFor(() => expect(addBtn().disabled).toBe(false));
    else await waitFor(() => expect(reason()).toBe(expected));
    expect(addBtn().disabled).toBe(expected !== null);
    if (expected) expect(addBtn().getAttribute('aria-describedby')).toBe('venue-add-reason');
  });
  it('look-alikes show inline: tap one picks it (existing) and creates nothing', async () => {
    const { onPick, deps } = setup({ similar: vi.fn().mockResolvedValue([{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: 'E1 6AN' }]) });
    await openAdd();
    type('Postcode', 'E1 6AN');
    const list = await screen.findByTestId('venue-similar');
    expect(screen.getByTestId('venue-add-sheet').contains(list)).toBe(true);
    expect(list.textContent).toMatch(/Is it one of these\?/);
    fireEvent.click(screen.getByTestId('similar-venue'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), { existing: false }); // R2-4: a tapped look-alike is not ALREADY_LISTED
    expect(deps.create).not.toHaveBeenCalled();
  });
  it('"No, it\'s a new venue" enables Add venue on the same sheet; editing the name asks again', async () => {
    setup({ similar: vi.fn().mockResolvedValue([{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: null }]) });
    await openAdd();
    type('Postcode', 'E1 6AN');
    fireEvent.click(await screen.findByTestId('similar-none'));
    await waitFor(() => expect(addBtn().disabled).toBe(false));
    expect(screen.queryByTestId('venue-similar')).toBeNull();
    type('Venue name', 'Zumba Loft 2');
    await waitFor(() => expect(reason()).toBe('Check the list above'));
  });
  it('existing:true picks that venue, says so to the caller, and does not duplicate it', async () => {
    const { onPick } = setup({ create: vi.fn().mockResolvedValue({ venueId: '1', existing: true }) });
    await openAdd('Pura Vida');
    type('Venue name', 'Pura Vida');
    await fillReady();
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(VENUES[0], { existing: true }));
  });
  it('postcode failures: not found (field error), offline (Retry recovers)', async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce({ ok: false, failure: 'not_found' })
      .mockResolvedValueOnce({ ok: false, failure: 'offline' })
      .mockResolvedValueOnce(await_ok());
    setup({ lookup });
    await openAdd();
    type('Postcode', 'E1 6AN');
    expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/could not find that postcode/);
    expect(reason()).toBe('Type the postcode');
    type('Postcode', 'E1 6AP');
    const retry = await screen.findByTestId('postcode-offline-retry');
    expect(reason()).toBe('Try the postcode lookup again');
    fireEvent.click(retry);
    await screen.findByTestId('postcode-found');
    await waitFor(() => expect(addBtn().disabled).toBe(false));
  });
  it('editing the postcode after a lookup clears the result and blocks Add', async () => {
    setup();
    await openAdd();
    await fillReady();
    type('Postcode', 'E1 6A');
    expect(screen.queryByTestId('postcode-found')).toBeNull();
    expect(addBtn().disabled).toBe(true);
    expect(reason()).toBe('Type the postcode');
  });
  it('an answer for an older postcode is dropped', async () => {
    let first: (v: unknown) => void = () => {};
    const lookup = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { first = r; }))
      .mockResolvedValueOnce({ ok: true, found: { postcode: 'N1 9GU', lat: 51.5, lng: -0.1, address: 'x', area: 'Islington' } });
    setup({ lookup });
    await openAdd();
    type('Postcode', 'E1 6AN');
    type('Postcode', 'N1 9GU');
    await waitFor(() => expect(addBtn().disabled).toBe(false));
    first(await_ok());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId('postcode-found').textContent).toMatch(/N1 9GU/);
  });
  it('a failed create shows a calm error and keeps Add venue', async () => {
    setup({ create: vi.fn().mockRejectedValue(new VenueApiError('unavailable')) });
    await openAdd();
    await fillReady();
    click('Add venue');
    expect((await screen.findByTestId('venue-save-error')).textContent).toMatch(/not available yet/);
    expect(screen.getByTestId('venue-add')).toBeTruthy();
  });
  // ER-FIX2-S3 review rounds 1-2. R1-2/3/4/7 were RED on the first one-sheet build; R2-1 and R2-3 were
  // RED on the round-1 build (the look-alike debounce is now a fixed 250ms, so the race is real here).
  it('R2-1 "No, it\'s a new venue" tapped while a new name settles answers only the list on screen', async () => {
    const similar = vi.fn(async (name: string) => (name === 'Zumba Loft' ? [{ venueId: 's1', name: 'Zumba Loft Ltd', postcode: null }] : [{ venueId: 's2', name: 'Zumba Loft Two Ltd', postcode: null }]));
    setup({ similar });
    await openAdd();
    type('Postcode', 'E1 6AN');
    await screen.findByTestId('similar-none');
    type('Venue name', 'Zumba Loft Two');
    fireEvent.click(screen.getByTestId('similar-none')); // inside the 250ms window: the s1 list is on screen
    await waitFor(() => expect(screen.getByTestId('similar-venue').textContent).toMatch(/Zumba Loft Two Ltd/));
    expect(reason()).toBe('Check the list above');
    expect(addBtn().disabled).toBe(true);
  });
  it('R2-3 while Add venue is saving, the sheet takes no other tap', async () => {
    setup({ create: vi.fn(() => new Promise<never>(() => {})) });
    await openAdd();
    await fillReady();
    click('Add venue');
    await waitFor(() => expect((screen.getByTestId('venue-back') as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByLabelText('Venue name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Postcode') as HTMLInputElement).disabled).toBe(true);
  });
  it('R1-2 a parent re-render with inline deps does not re-run the lookup or the look-alike check', async () => {
    const lookup = vi.fn().mockResolvedValue(await_ok());
    const similar = vi.fn().mockResolvedValue([]);
    const create = vi.fn();
    const ui = () => (
      <QueryClientProvider client={client}>
        <VenuePicker options={VENUES} onPick={vi.fn()} deps={{ lookup: (p) => lookup(p), similar: (n, p) => similar(n, p), create }} />
      </QueryClientProvider>
    );
    const client = new QueryClient();
    const { rerender } = render(ui());
    await openAdd();
    type('Postcode', 'E1 6AN');
    await waitFor(() => expect(addBtn().disabled).toBe(false));
    rerender(ui());
    rerender(ui());
    await new Promise((r) => setTimeout(r, 20));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(similar).toHaveBeenCalledTimes(1);
  });
  it('R1-3 a lookup that throws reads as offline with Retry', async () => {
    setup({ lookup: vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(await_ok()) });
    await openAdd();
    type('Postcode', 'E1 6AN');
    fireEvent.click(await screen.findByTestId('postcode-offline-retry'));
    await waitFor(() => expect(addBtn().disabled).toBe(false));
  });
  it('R1-4 reopening Add does not show the last session\'s lookup answer', async () => {
    let release: (v: unknown) => void = () => {};
    const lookup = vi.fn()
      .mockResolvedValueOnce({ ok: false, failure: 'offline' })
      .mockImplementationOnce(() => new Promise((r) => { release = r; }));
    setup({ lookup });
    await openAdd();
    type('Postcode', 'E1 6AN');
    await screen.findByTestId('postcode-offline-retry');
    click('Back to search');
    await openAdd();
    type('Postcode', 'E1 6AN');
    expect(screen.queryByTestId('postcode-offline-retry')).toBeNull();
    expect(reason()).toBe('Looking up the postcode');
    release(await_ok());
  });
  it('R1-7 a long search prefills at most 60 letters', async () => {
    setup();
    await openAdd('Z'.repeat(70));
    expect((screen.getByLabelText('Venue name') as HTMLInputElement).value).toHaveLength(60);
  });
  it('F-C5-4: 1 letter with no match says how to add a venue', async () => {
    setup();
    type('Search venues', 'z');
    expect((await screen.findByTestId('venue-none')).textContent).toMatch(/Type 2\+ letters to add a venue/);
  });
  it.each([
    // [state, reason] -- pure, every branch of the shared block rule
    [{ name: 'Zu', postcode: 'E1 6AN' }, 'Type the name'],
    [{ name: 'Zum', postcode: 'E1' }, 'Type the postcode'],
    [{ name: 'Zum', postcode: 'E1 6AN' }, 'Looking up the postcode'],
    [{ name: 'Zum', postcode: 'E1 6AN', lookup: { postcode: 'E1 6AN', attempt: 0, found: null, failure: 'not_found' as const } }, 'Type the postcode'],
    [{ name: 'Zum', postcode: 'E1 6AN', lookup: { postcode: 'E1 6AN', attempt: 0, found: null, failure: 'offline' as const } }, 'Try the postcode lookup again'],
    [{ name: 'Zum', postcode: 'E1 6AN', attempt: 1, lookup: { postcode: 'E1 6AN', attempt: 0, found: null, failure: 'offline' as const } }, 'Looking up the postcode'],
    [{ name: 'Zum', postcode: 'e16an', lookup: { postcode: 'E1 6AN', attempt: 0, found: await_ok().found, failure: null } }, 'Checking the list'],
    [{ name: 'Zum', postcode: 'E1 6AN', lookup: { postcode: 'E1 6AN', attempt: 0, found: await_ok().found, failure: null }, similar: { key: 'Zu|E1 6AN', rows: [] } }, 'Checking the list'],
    [{ name: 'Zum', postcode: 'E1 6AN', lookup: { postcode: 'E1 6AN', attempt: 0, found: await_ok().found, failure: null }, similar: { key: 'Zum|E1 6AN', rows: [{ venueId: 'a', name: 'Zum', postcode: null }] } }, 'Check the list above'],
    [{ name: 'Zum', postcode: 'E1 6AN', sure: true, lookup: { postcode: 'E1 6AN', attempt: 0, found: await_ok().found, failure: null }, similar: { key: 'Zum|E1 6AN', rows: [{ venueId: 'a', name: 'Zum', postcode: null }] } }, null],
    [{ name: ' Zum ', postcode: 'E1 6AN', lookup: { postcode: 'E1 6AN', attempt: 0, found: await_ok().found, failure: null }, similar: { key: 'Zum|E1 6AN', rows: [] } }, null],
  ])('addVenueBlock %j -> %j', (partial, expected) => {
    expect(addVenueBlock({ attempt: 0, lookup: null, similar: null, sure: false, ...partial })).toBe(expected);
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

  const toReady = async () => {
    await openAdd();
    await fillReady();
  };
  it.each([
    ['rate_limited', 'You can add 5 venues a day. Try again tomorrow, or pick an existing venue.'],
    ['refused', /could not be added/],
    ['failed', /Check your connection/],
  ] as const)('C5-1/C5-3 %s shows its own message', async (kind, text) => {
    setup({ create: vi.fn().mockRejectedValue(new VenueApiError(kind)) });
    await toReady();
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
    await toReady();
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    const cached = client.getQueryData<VenueOption[]>(venueOptionsQueryKey) ?? [];
    expect(venueName(cached, 'new1')).toBe('Zumba Loft');
    expect(cached).toHaveLength(VENUES.length + 1);
  });

  // C5-4 rewritten for ER-FIX2-S3: the one reason line now carries prototype v7's "Type the postcode".
  it('C5-4 a part postcode says the postcode is needed', async () => {
    setup();
    await openAdd('Zumba');
    type('Postcode', 'E1 6A');
    expect(reason()).toBe('Type the postcode');
  });

  it('C5-5 existing:true outside the list uses the stored name, not the typed one', async () => {
    const { onPick } = setup({
      similar: vi.fn().mockResolvedValue([{ venueId: 'z9', name: 'Zumba Loft', postcode: 'E1 6AN' }]),
      create: vi.fn().mockResolvedValue({ venueId: 'z9', existing: true }),
    });
    await openAdd('zumba loft');
    type('Postcode', 'E1 6AN');
    fireEvent.click(await screen.findByTestId('similar-none'));
    await waitFor(() => expect(addBtn().disabled).toBe(false));
    click('Add venue');
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'z9', name: 'Zumba Loft' });
  });

  it('C5-6 venue source files hold no raw non-ASCII', () => {
    for (const f of ['VenuePicker.tsx', 'venueSearch.ts', 'venueApi.ts', 'postcode.ts', 'addVenue.ts']) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect([...src].filter((ch) => ch.charCodeAt(0) > 127), f).toEqual([]);
    }
    expect(searchVenues([v('x', 'Café Tango')], 'cafe tango').shape).toBe('exact');
  });

  // C5-7 rewritten for ER-FIX2-S3: one sheet, so focus moves twice (open -> name, Back -> search).
  it('C5-7 opening the sheet focuses the name; Back to search focuses the search', async () => {
    setup();
    await openAdd();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Venue name')));
    click('Back to search');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Search venues')));
  });
});
