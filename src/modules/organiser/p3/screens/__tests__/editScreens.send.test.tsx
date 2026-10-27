// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, wsRaw } from './wsFixtures';
import { L } from '../../model';
import { VERSION_CONFLICT } from '../../../shared/copy';
import { LINK_PROBLEM } from '../../../shared/linkRules';

/*
 * W3a through the REAL send path: edit screen -> useSaveRun -> useSendOnce -> runSeriesCommand ->
 * envelope. Only supabase and the side reads (admin check, profile progress, venues, city) are
 * stood in for. A data router (createMemoryRouter) so the leave guard's router blocker is live,
 * as under app/root.tsx.
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
  useVenueOptions: () => ({ isPending: false, isError: false, data: [
    { id: 'v1', name: 'Salsa Hall', neighbourhood: null, city_name: 'Leeds', address: null, postcode: null },
    { id: 'v2', name: 'Studio Two', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  ] }),
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { cleanup(); rpc.mockReset(); });

type Raw = Record<string, unknown>;
let raw: Raw = SHAPES.weekly;
let qc: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;

function server(command: (env: Raw, n: number) => unknown = () => ({ data: { ok: true, new_version: 8 }, error: null })) {
  const envs: Raw[] = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') { envs.push(args.p_envelope as Raw); return command(args.p_envelope as Raw, envs.length); }
    return { data: null, error: null };
  });
  return envs;
}

function show(path: string, shape: Raw = SHAPES.weekly) {
  raw = shape;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <EventPage /> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
    { path: '/account/p3/events', element: <p data-testid="events-list">events</p> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}

const DETAILS = '/account/p3/events/ser-1/details';
const PRICES = '/account/p3/events/ser-1/prices';
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;
const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

describe('Name and details: the one save', () => {
  it('untouched: Save is off ("Nothing changed yet"), no tray, nothing sent', async () => {
    const envs = server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-details'));
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().textContent).toBe(L.nothingChanged);
    expect(screen.queryByTestId('p3-pending')).toBeNull();
    expect(screen.queryByTestId('p3-undo-mine')).toBeNull();
    await press(saveBtn());
    expect(envs).toHaveLength(0);
  });

  it('one field: the tray counts it; Save sends ONE series.upsert with name and that key, then the event page says so', async () => {
    const envs = server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-description'));
    type('p3-d-description', 'No partner needed.');
    expect(screen.getByTestId('p3-pending').textContent).toBe(`${L.notSaved} · ${L.changes(1)} ${L.tapToSee}`);
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-event'));
    expect(envs).toHaveLength(1);
    expect(envs[0]).toMatchObject({ target_id: 'ser-1', expected_version: 7, command: { kind: 'series.upsert', payload: { name: 'Sensual Fridays', default_description: 'No partner needed.' } } });
    expect(Object.keys((envs[0].command as Raw).payload as Raw).sort()).toEqual(['default_description', 'name']);
    await waitFor(() => expect(screen.getByTestId('p3-toast').textContent).toContain(L.detailsSaved));
  });

  it('a new place sends the place and its city', async () => {
    const envs = server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-pick-place'));
    fireEvent.click(screen.getByTestId('p3-d-pick-place'));
    fireEvent.click(within(screen.getByTestId('p3-d-venues')).getByText('Studio Two'));
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect((envs[0].command as Raw).payload).toEqual({ name: 'Sensual Fridays', default_venue_id: 'v2', default_city_id: 'city-9' });
  });

  it('the chat link and the name: two commands, the second against the version the first returned', async () => {
    const envs = server((_e, n) => ({ data: { ok: true, new_version: 7 + n }, error: null }));
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-chat'));
    type('p3-d-chat', 'https://chat.whatsapp.com/abc');
    type('p3-d-name', 'Friday Social');
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(2));
    expect(envs[0]).toMatchObject({ expected_version: 7, command: { kind: 'series.upsert', payload: { name: 'Friday Social' } } });
    expect(envs[1]).toMatchObject({ expected_version: 8, command: { kind: 'series.set_group_chat', payload: { url: 'https://chat.whatsapp.com/abc' } } });
  });

  it('a dropped connection: Try again re-sends the SAME key and version; a landed step is not sent twice', async () => {
    const envs = server((_e, n) => (n === 2 ? (() => { throw new TypeError('Failed to fetch'); })() : { data: { ok: true, new_version: 7 + n }, error: null }));
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-chat'));
    type('p3-d-chat', 'https://chat.whatsapp.com/abc');
    type('p3-d-name', 'Friday Social');
    await press(saveBtn());
    await waitFor(() => screen.getByTestId('p3-save-error'));
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(3));
    expect((envs[2].command as Raw).kind).toBe('series.set_group_chat');
    expect(envs[2].idempotency_key).toBe(envs[1].idempotency_key);
    expect(envs[2].expected_version).toBe(envs[1].expected_version);
  });

  it('a refusal shows the plain words (COMMAND_COPY), never the server text, and keeps the typing', async () => {
    server(() => ({ data: null, error: { message: 'version_conflict: expected 7 got 9' } }));
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-name'));
    type('p3-d-name', 'Friday Social');
    await press(saveBtn());
    await waitFor(() => expect(screen.getByTestId('p3-save-error').textContent).toBe(VERSION_CONFLICT));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).value).toBe('Friday Social');
  });

  it('an invalid link: Save is off with the reason; nothing is sent', async () => {
    const envs = server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-ticket'));
    type('p3-d-ticket', 'tickets please');
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('p3-save-why').textContent).toBe(LINK_PROBLEM.ticket);
    expect(screen.getByTestId('p3-problem-ticket').textContent).toBe(LINK_PROBLEM.ticket);
    expect(envs).toHaveLength(0);
  });

  it('Undo my changes asks first; Keep editing keeps, the confirm restores and sends nothing', async () => {
    const envs = server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-name'));
    type('p3-d-name', 'Friday Social');
    fireEvent.click(screen.getByTestId('p3-undo-mine'));
    fireEvent.click(screen.getByTestId('p3-keep-editing'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).value).toBe('Friday Social');
    fireEvent.click(screen.getByTestId('p3-undo-mine'));
    fireEvent.click(screen.getByTestId('p3-undo-confirm'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).value).toBe('Sensual Fridays');
    expect(screen.queryByTestId('p3-pending')).toBeNull();
    expect(envs).toHaveLength(0);
  });

  it('the leave guard asks only when there are unsaved edits (Back link, and any route change such as a tab)', async () => {
    server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-name'));
    type('p3-d-name', 'Friday Social');
    await press(screen.getByTestId('p3-edit-back'));
    expect(screen.getByText(L.leaveTitle)).toBeTruthy();
    expect(within(screen.getByTestId('p3-pending-list')).getByText(`${L.detailsName}: Friday Social`)).toBeTruthy();
    await press(screen.getByTestId('p3-keep-editing'));
    expect(screen.getByTestId('p3-details')).toBeTruthy();
    await act(async () => { await router.navigate('/account/p3/events'); });
    expect(screen.getByText(L.leaveTitle)).toBeTruthy();
    await press(screen.getByTestId('p3-leave-go'));
    await waitFor(() => screen.getByTestId('events-list'));
  });

  it('no edits: Back leaves at once', async () => {
    server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-edit-back'));
    await press(screen.getByTestId('p3-edit-back'));
    await waitFor(() => screen.getByTestId('p3-event'));
    expect(screen.queryByText(L.leaveTitle)).toBeNull();
  });

  it('someone else saves while typing: the typing stays and the screen says so', async () => {
    server();
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-name'));
    type('p3-d-name', 'Friday Social');
    raw = wsRaw({ version: 9, default_description: 'Changed elsewhere' }, [], []);
    await act(async () => { await qc.invalidateQueries({ queryKey: ['org-event-workspace', 'ser-1'] }); });
    await waitFor(() => screen.getByTestId('p3-changed-elsewhere'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).value).toBe('Friday Social');
    fireEvent.click(screen.getByTestId('p3-start-again'));
    expect((screen.getByTestId('p3-d-description') as HTMLTextAreaElement).value).toBe('Changed elsewhere');
    expect(screen.queryByTestId('p3-changed-elsewhere')).toBeNull();
  });

  it.each([['ended'], ['archived']] as const)('%s: every field is greyed and Save names why', async (shape) => {
    server();
    show(DETAILS, SHAPES[shape]);
    await waitFor(() => screen.getByTestId('p3-details-lock'));
    expect((screen.getByTestId('p3-d-name') as HTMLInputElement).disabled).toBe(true);
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('p3-save-why').textContent).toMatch(/can't be changed here/);
  });
});

describe('Prices: the one save', () => {
  it('no list yet: the empty state says what to do; "It\'s free" sends payment_methods free', async () => {
    const envs = server();
    show(PRICES);
    await waitFor(() => screen.getByTestId('p3-prices-empty'));
    expect(screen.getByTestId('p3-prices-empty').textContent).toBe(L.pricesNone);
    fireEvent.click(screen.getByTestId('p3-free-switch'));
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect((envs[0].command as Raw).payload).toEqual({ name: 'Sensual Fridays', payment_methods: 'free' });
  });

  it('a new price: a bad amount names the problem; a good one sends the whole list', async () => {
    const envs = server();
    show(PRICES);
    await waitFor(() => screen.getByTestId('p3-price-add'));
    fireEvent.click(screen.getByTestId('p3-price-add'));
    type('p3-price-name', 'Class and party');
    type('p3-price-amount', '12.345');
    expect(screen.getByTestId('p3-save-why').textContent).toBe('Use a price like 12 or 12.50');
    type('p3-price-amount', '15');
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    const passes = ((envs[0].command as Raw).payload as Raw).default_passes as Raw[];
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ name: 'Class and party', price: 15, currency: 'GBP' });
  });

  it('a list the team set up: rows locked with the reason, how to pay still saves alone', async () => {
    const envs = server();
    show(PRICES, wsRaw({ passes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Early bird', price: 30, tier: 1 }] }, [], []));
    await waitFor(() => screen.getByTestId('p3-prices-rows-lock'));
    expect(screen.queryByTestId('p3-price-add')).toBeNull();
    fireEvent.click(screen.getAllByTestId('p3-pay-chip')[1]);
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect((envs[0].command as Raw).payload).toEqual({ name: 'Sensual Fridays', payment_methods: 'door' });
  });

  it('a festival offers its ticket link only, and no free switch', async () => {
    server();
    show(PRICES, SHAPES.festival);
    await waitFor(() => screen.getByTestId('p3-pay'));
    expect(screen.getAllByTestId('p3-pay-chip').map((b) => b.textContent)).toEqual(['Ticket link']);
    expect(screen.queryByTestId('p3-free-switch')).toBeNull();
  });
});

describe('the event page opens both screens (no copy pointing at the old area for these rows)', () => {
  it('Name and details and Prices are links to the P3 routes', async () => {
    server();
    show('/account/p3/events/ser-1');
    await waitFor(() => screen.getByTestId('p3-open-details'));
    expect(screen.getByTestId('p3-open-details').getAttribute('href')).toBe(DETAILS);
    expect(screen.getByTestId('p3-open-prices').getAttribute('href')).toBe(PRICES);
    expect(screen.getByTestId('p3-about').textContent).not.toContain('use the current organiser area');
  });
});
