// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES, wsRaw } from './wsFixtures';
import { L } from '../../model';

/*
 * Review round 3 on PR #1082 (docs/reviews/1082-r3.md), the screen half, through the REAL send
 * path as editScreens.send does (only supabase and the side reads stood in for). Each row was
 * RED on 70b1c75.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'city-9' }) }));
const progress = vi.hoisted(() => ({ current: { publishReady: true, requiredLeft: [] as string[] } }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => ({ data: progress.current }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

afterEach(() => { cleanup(); rpc.mockReset(); progress.current = { publishReady: true, requiredLeft: [] }; });

type Raw = Record<string, unknown>;
let raw: Raw = SHAPES.weekly;
let qc: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;

function server(command: (env: Raw, n: number) => unknown) {
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
const value = (id: string) => (screen.getByTestId(id) as HTMLInputElement).value;

/** Name and chat link changed; step 1 (series.upsert) lands at v8, step 2 (series.set_group_chat) is refused. */
async function halfLanded() {
  const envs = server((_e, n) => (n === 2
    ? { data: null, error: { message: 'permission_denied: group chat url' } }
    : { data: { ok: true, new_version: 7 + n }, error: null }));
  show(DETAILS);
  await waitFor(() => screen.getByTestId('p3-d-chat'));
  type('p3-d-name', 'Friday Social');
  type('p3-d-chat', 'https://chat.whatsapp.com/abc');
  await press(saveBtn());
  await waitFor(() => screen.getByTestId('p3-save-error'));
  expect(envs).toHaveLength(2);
  return envs;
}

describe('r3 #2: a landed step moves the base, not only the version', () => {
  it('(a) Undo keeps the landed name; the tray is empty', async () => {
    await halfLanded();
    fireEvent.click(screen.getByTestId('p3-undo-mine'));
    fireEvent.click(screen.getByTestId('p3-undo-confirm'));
    expect(value('p3-d-name')).toBe('Friday Social');
    expect(value('p3-d-chat')).toBe('');
    expect(screen.queryByTestId('p3-pending')).toBeNull();
    expect(saveBtn().textContent).toBe(L.nothingChanged);
  });

  it('(b) Undo, then a description edit: sends the landed name against the landed version', async () => {
    const envs = await halfLanded();
    fireEvent.click(screen.getByTestId('p3-undo-mine'));
    fireEvent.click(screen.getByTestId('p3-undo-confirm'));
    type('p3-d-description', 'No partner needed.');
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(3));
    expect(envs[2]).toMatchObject({ expected_version: 8, command: { kind: 'series.upsert', payload: { name: 'Friday Social', default_description: 'No partner needed.' } } });
  });

  it('(c) the leave sheet lists only what did not land (the chat link), not Name', async () => {
    await halfLanded();
    await press(screen.getByTestId('p3-edit-back'));
    const list = within(screen.getByTestId('p3-pending-list'));
    expect(list.queryByText(`${L.detailsName}: Friday Social`)).toBeNull();
    expect(list.getByText(L.detailsChat)).toBeTruthy();
  });

  it('Try again after the half-landing re-sends only the chat step, same key, landed version', async () => {
    const envs = await halfLanded();
    rpc.mockReset();
    const more = server(() => ({ data: { ok: true, new_version: 9 }, error: null }));
    await press(saveBtn());
    await waitFor(() => expect(more).toHaveLength(1));
    expect(more[0]).toMatchObject({ expected_version: 8, idempotency_key: envs[1].idempotency_key, command: { kind: 'series.set_group_chat' } });
  });
});

describe('r3 #3: the "someone else saved" banner says the save will be refused', () => {
  it('names Start again as the way, and promises no merge', async () => {
    server(() => ({ data: { ok: true, new_version: 8 }, error: null }));
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-description'));
    type('p3-d-description', 'Mine');
    raw = wsRaw({ version: 9, default_ticket_url: 'https://tickets.example.test/new' }, [], []);
    await act(async () => { await qc.invalidateQueries({ queryKey: ['org-event-workspace', 'ser-1'] }); });
    const banner = await waitFor(() => screen.getByTestId('p3-changed-elsewhere'));
    expect(banner.textContent).toContain('will be refused');
    expect(banner.textContent).toContain('Start again');
    expect(banner.textContent).toContain('copy');
    expect(banner.textContent).not.toMatch(/puts yours over theirs/);
  });
});

describe('r3 #5: Prices has the profile lock, as Details and the old area do', () => {
  it.each([[DETAILS, 'p3-details-lock', 'p3-d-name'], [PRICES, 'p3-prices-lock', 'p3-free-switch']] as const)(
    'an unfinished profile on %s: the lock shows with what to do, controls off, Save names why, nothing sent',
    async (path, lockId, controlId) => {
      progress.current = { publishReady: false, requiredLeft: ['photo'] };
      const envs = server(() => ({ data: { ok: true, new_version: 8 }, error: null }));
      show(path);
      await waitFor(() => screen.getByTestId(lockId));
      expect(screen.getByTestId(lockId).textContent).toMatch(/Finish your profiles first/);
      expect(within(screen.getByTestId(lockId)).getByText('Complete your profile')).toBeTruthy();
      expect((screen.getByTestId(controlId) as HTMLInputElement).disabled).toBe(true);
      expect(saveBtn().disabled).toBe(true);
      await press(saveBtn());
      expect(envs).toHaveLength(0);
    },
  );
  it('a finished profile: Prices is live', async () => {
    server(() => ({ data: { ok: true, new_version: 8 }, error: null }));
    show(PRICES);
    await waitFor(() => screen.getByTestId('p3-free-switch'));
    expect(screen.queryByTestId('p3-prices-lock')).toBeNull();
    expect((screen.getByTestId('p3-free-switch') as HTMLInputElement).disabled).toBe(false);
  });
});

describe('r3 #4 on the screen: a chat link the server would refuse holds the save', () => {
  it('https://localhost/x: the problem shows, Save off, nothing sent; a WhatsApp link saves', async () => {
    const envs = server(() => ({ data: { ok: true, new_version: 8 }, error: null }));
    show(DETAILS);
    await waitFor(() => screen.getByTestId('p3-d-chat'));
    type('p3-d-chat', 'https://localhost/x');
    expect(screen.getByTestId('p3-problem-chat').textContent).toBe(L.detailsChatBad);
    expect(saveBtn().disabled).toBe(true);
    type('p3-d-chat', 'https://chat.whatsapp.com/abc');
    await press(saveBtn());
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(envs[0]).toMatchObject({ command: { kind: 'series.set_group_chat', payload: { url: 'https://chat.whatsapp.com/abc' } } });
  });
});
