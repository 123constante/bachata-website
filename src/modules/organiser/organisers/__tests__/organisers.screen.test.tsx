// @vitest-environment jsdom
// ER-FIX2-S4: the organisers route and screen over the real RPC client (supabase.rpc is
// faked per function, so the error mapping runs for real). F1 switch, F2/F3 retries,
// F4 dead invite, F5 empty list, F6 full control, F8 loading, F10 search cap, F11 Leave.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

type Answer = { data: unknown; error: { code: string; message: string } | null };
const h = vi.hoisted(() => ({
  lifecycle: 'live', version: 3, myIds: ['o'] as string[], homeRole: 'owner' as 'owner' | 'manager' | null, homeLoading: false,
  organiserIds: ['o'] as string[] | null, search: [] as { id: string; name: string }[],
  rows: [] as unknown[], orgError: null as unknown, calls: [] as [string, unknown][], answer: {} as Record<string, unknown>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(async (fn: string, args: unknown) => { h.calls.push([fn, args]); return (h.answer[fn] as Answer | undefined) ?? { data: {}, error: null }; }), from: vi.fn() },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../shell', () => ({ OrganiserShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, ORG_PATHS: { home: '/account/o', eventDetails: (id: string) => `/d/${id}` } }));
vi.mock('../../events/eventsApi', () => ({
  useEventWorkspace: () => (h.organiserIds === null
    ? { isError: false, isFetching: true, refetch: vi.fn(), data: undefined }
    : { isError: false, isFetching: false, refetch: vi.fn(), data: { organiserIds: h.organiserIds, series: { id: 's1', version: h.version, lifecycle_status: h.lifecycle } } }),
}));
vi.mock('../../events/programmeSeriesApi', () => ({ useSeriesRole: () => ({ role: h.homeRole, loading: h.homeLoading, myPages: h.homeLoading ? [] : h.myIds.map((id) => ({ id })) }) }));
vi.mock('../../events/SeriesOrganisers', () => ({ default: () => <p data-testid="sw1-screen">SW1 organisers</p> }));
vi.mock('@/modules/organiser/flows/event', () => ({
  EventConflict: () => <p data-testid="conflict">Someone else changed this event</p>,
  StepError: ({ text }: { text: string | null }) => (text ? <p role="alert" data-testid="step-error">{text}</p> : null),
}));
vi.mock('../organiserApi', async (orig) => {
  const real = await orig<typeof import('../organiserApi')>();
  return {
    ...real,
    useSeriesOrganisers: () => ({ data: h.orgError ? undefined : h.rows, isError: !!h.orgError, error: h.orgError, isFetching: false, refetch: vi.fn() }),
    useMyInvitations: () => ({ data: h.rows }),
    searchOrganiserPages: async () => h.search,
  };
});

import { RebuildSwitchContext } from '../../shell/rebuildSwitch';
import OrganisersRoute from '../OrganisersRoute';
import { InvitationsList } from '../InvitationsList';
import { FAILURE_TEXT, OrganiserApiError, invitationsQueryKey, organisersQueryKey } from '../organiserApi';
import { parseOrganisers } from '../organiserModel';

const owner = { page_id: 'o', name: 'Bachata Nights', role: 'owner', status: 'accepted' };
const co = { page_id: 'c', name: 'Salsa Crew', role: 'co', status: 'accepted' };
const co2 = { page_id: 'c2', name: 'Kizomba Club', role: 'co', status: 'accepted' };
const invited = { page_id: 'i', name: 'Zouk Club', role: 'co', status: 'invited', invite_id: 'inv1' };
const setRows = (...rows: object[]) => { h.rows = parseOrganisers({ organisers: rows }); };
const bad = (message: string, code = 'P0001'): Answer => ({ data: null, error: { code, message } });

let client: QueryClient;
let invalidated: unknown[][];
function mount(...args: [raw?: string | undefined]) {
  const raw = args.length ? args[0] : '*';
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidated = [];
  const real = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((f?: { queryKey?: unknown[] }) => { invalidated.push(f?.queryKey ?? []); return real(f); }) as typeof client.invalidateQueries;
  return render(
    <QueryClientProvider client={client}>
      <RebuildSwitchContext.Provider value={{ raw, on: false, pending: false }}>
        <MemoryRouter initialEntries={['/e/s1']}>
          <Routes><Route path="/e/:seriesId" element={<OrganisersRoute />} /><Route path="/account/o" element={<p data-testid="home">Home</p>} /></Routes>
        </MemoryRouter>
      </RebuildSwitchContext.Provider>
    </QueryClientProvider>,
  );
}
const wasRefetched = () => invalidated.some((k) => JSON.stringify(k) === JSON.stringify(organisersQueryKey('s1')));

beforeEach(() => {
  Object.assign(h, { lifecycle: 'live', version: 3, myIds: ['o'], homeRole: 'owner', homeLoading: false, organiserIds: ['o'], search: [], orgError: null, calls: [], answer: {} });
  setRows(owner, co, invited);
});
afterEach(cleanup);

const ids = (id: string) => screen.queryAllByTestId(id);
const tooSmall = () => Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => /h-\[(\d+)px\]/.test(b.className) && Number(/h-\[(\d+)px\]/.exec(b.className)![1]) < 44);

describe('F1: the rebuild switch chooses the screen, per event', () => {
  it.each<[string, string | undefined, string[] | null, 'sw1' | 'new']>([
    ['switch OFF (unset): main SW1 screen', undefined, ['o'], 'sw1'],
    ['switch OFF (empty)', '', ['o'], 'sw1'],
    ['allowlist without this event owner page', 'zz', ['o'], 'sw1'],
    ['allowlist names a co page only (owner decides)', 'c', ['o', 'c'], 'sw1'],
    ['allowlist names this event owner page', 'o', ['o', 'c'], 'new'],
    ['"*" (everyone)', '*', ['o'], 'new'],
    ['"*" on a no-organiser event', '*', [], 'new'],
    ['event still loading: never the rebuilt screen first', 'o', null, 'sw1'],
  ])('%s', async (_n, raw, organiserIds, want) => {
    h.organiserIds = organiserIds;
    mount(raw);
    if (want === 'sw1') {
      expect(await screen.findByTestId('sw1-screen')).toBeTruthy();
      expect(ids('org-block-text')).toHaveLength(0);
    } else {
      expect(await screen.findByTestId('org-block-text')).toBeTruthy();
      expect(ids('sw1-screen')).toHaveLength(0);
    }
  });
  it('the organisers read is unavailable: the unavailable words, not a generic error', async () => {
    h.orgError = new OrganiserApiError('unavailable');
    mount();
    expect((await screen.findByTestId('org-organisers-unavailable')).textContent).toBe(FAILURE_TEXT.unavailable);
    expect(ids('org-organisers-error')).toHaveLength(0);
  });
});

describe('F6: roles x controls on the screen (full control)', () => {
  it('owner: block text, Remove on each co, Cancel (x) on Invited, Invite on, no Leave', async () => {
    setRows(owner, co, co2, invited);
    mount();
    expect((await screen.findByTestId('org-block-text')).textContent).not.toMatch(/only the owner/i);
    const rows = ids('org-linked-row');
    expect(rows.map((r) => r.getAttribute('data-role') + '/' + r.getAttribute('data-status'))).toEqual(['owner/accepted', 'co/accepted', 'co/accepted', 'co/invited']);
    expect(ids('org-remove')).toHaveLength(2);
    expect(rows[0].querySelector('[data-testid="org-remove"]')).toBeNull();
    expect(ids('org-leave')).toHaveLength(0);
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(false);
    expect(tooSmall()).toEqual([]);
  });
  it('co-organiser: Remove on ANOTHER co, "Leave" on their own row, no only-owner note', async () => {
    setRows(owner, co, co2);
    h.myIds = ['c']; h.homeRole = 'manager';
    mount();
    await screen.findByTestId('org-block-text');
    expect(ids('org-remove')).toHaveLength(1);
    expect(within(ids('org-linked-row')[2]).getByTestId('org-remove')).toBeTruthy();
    expect(screen.getByTestId('org-leave').textContent).toBe('Leave');
    expect(ids('org-remove-note')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/only the owner/i);
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(false);
  });
  it('non-member (the list has accepted rows, none mine): nothing to press, Invite off WITH the reason', async () => {
    h.myIds = ['z']; h.homeRole = null;
    mount();
    await screen.findByTestId('org-block-text');
    expect(ids('org-remove').length + ids('org-leave').length).toBe(0);
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-invite-reason').textContent).toBe('You are not an organiser of this event.');
  });
  it('an ended event: Invite off with the lock text', async () => {
    h.lifecycle = 'ended';
    mount();
    await screen.findByTestId('org-block-text');
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-invite-reason').textContent).toMatch(/has ended/);
  });
  it('there is no Save button: organiser changes save at once', async () => {
    mount();
    await screen.findByTestId('org-block-text');
    expect(ids('org-save')).toHaveLength(0);
  });
});

describe('F5 + F8: the no-organiser event and the Home read', () => {
  it('no rows, the event is on my Home: an empty state that says what to do, Invite ON, never "not an organiser"', async () => {
    h.rows = []; h.organiserIds = [];
    mount();
    expect((await screen.findByTestId('org-empty')).textContent).toMatch(/Invite an organiser/);
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.textContent).not.toMatch(/not an organiser/);
  });
  it('no rows and nothing ties me to it: the empty fact, Invite off with the reason', async () => {
    h.rows = []; h.organiserIds = []; h.homeRole = null;
    mount();
    expect((await screen.findByTestId('org-empty')).textContent).not.toMatch(/Invite an organiser below/);
    expect(screen.getByTestId('org-invite-reason').textContent).toBe('You are not an organiser of this event.');
  });
  it('Home still loading: a skeleton, not a disabled Invite with "not an organiser"', async () => {
    h.homeLoading = true;
    mount();
    expect(await screen.findByTestId('org-organisers-loading')).toBeTruthy();
    expect(ids('org-invite')).toHaveLength(0);
    expect(ids('org-invite-reason')).toHaveLength(0);
  });
});

describe('actions send at once, once', () => {
  it('remove a co-organiser: one series_remove_organiser_v1 call, then the list refetches', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('org-remove'));
    await waitFor(() => expect(h.calls).toEqual([['series_remove_organiser_v1', { p_series_id: 's1', p_page_id: 'c' }]]));
    await waitFor(() => expect(wasRefetched()).toBe(true));
  });
  it('invite: search any page, linked and invited ones are not offered, tap sends one invite', async () => {
    h.search = [{ id: 'o', name: 'Bachata Nights' }, { id: 'c', name: 'Salsa Crew' }, { id: 'i', name: 'Zouk Club' }, { id: 'n', name: 'Kizomba Club' }];
    mount();
    fireEvent.click(await screen.findByTestId('org-invite'));
    fireEvent.change(await screen.findByTestId('org-invite-search'), { target: { value: 'club' } });
    const results = await screen.findAllByTestId('org-invite-result', {}, { timeout: 3000 });
    expect(results.map((r) => r.textContent)).toEqual([expect.stringContaining('Kizomba Club')]);
    expect(ids('org-invite-more')).toHaveLength(0);
    fireEvent.click(results[0].querySelector('button') ?? results[0]);
    await waitFor(() => expect(h.calls).toEqual([['series_invite_organiser_v1', { p_series_id: 's1', p_page_id: 'n' }]]));
  });
  it('F10: 20 results back says to type more of the name', async () => {
    h.search = Array.from({ length: 20 }, (_x, i) => ({ id: `p${i}`, name: `Bachata ${i}` }));
    mount();
    fireEvent.click(await screen.findByTestId('org-invite'));
    fireEvent.change(await screen.findByTestId('org-invite-search'), { target: { value: 'bachata' } });
    expect((await screen.findByTestId('org-invite-more', {}, { timeout: 3000 })).textContent).toMatch(/first 20.*Type more of the name/);
  });
  it('co-organiser leaves: a confirm sheet first, nothing sent until confirmed, then Home', async () => {
    h.myIds = ['c']; h.homeRole = 'manager';
    mount();
    fireEvent.click(await screen.findByTestId('org-leave'));
    expect((await screen.findByTestId('org-leave-note')).textContent).toMatch(/Any organiser on the event can invite you again/);
    expect(h.calls).toEqual([]);
    fireEvent.click(screen.getByTestId('org-leave-confirm'));
    await waitFor(() => expect(h.calls).toEqual([['series_leave_v1', { p_series_id: 's1', p_page_id: 'c' }]]));
    expect(await screen.findByTestId('home')).toBeTruthy();
  });
});

describe('decision 5 (F2, F3): a retry is success', () => {
  it.each(['invalid_payload: this page is already invited', 'invalid_payload: this page already organises the event'])('invite answered %j: no error, the list refetches', async (message) => {
    h.answer.series_invite_organiser_v1 = bad(message);
    h.search = [{ id: 'n', name: 'Kizomba Club' }];
    mount();
    fireEvent.click(await screen.findByTestId('org-invite'));
    fireEvent.change(await screen.findByTestId('org-invite-search'), { target: { value: 'kiz' } });
    const [r] = await screen.findAllByTestId('org-invite-result', {}, { timeout: 3000 });
    fireEvent.click(r.querySelector('button') ?? r);
    await waitFor(() => expect(wasRefetched()).toBe(true));
    expect(ids('step-error')).toHaveLength(0);
  });
  it('cancel answered "this invite is no longer open": no error, the list refetches', async () => {
    h.answer.series_invite_cancel_v1 = bad('invalid_payload: this invite is no longer open');
    mount();
    await screen.findByTestId('org-block-text');
    fireEvent.click(within(ids('org-linked-row')[2]).getByRole('button'));
    await waitFor(() => expect(h.calls).toEqual([['series_invite_cancel_v1', { p_invite_id: 'inv1' }]]));
    await waitFor(() => expect(wasRefetched()).toBe(true));
    expect(ids('step-error')).toHaveLength(0);
  });
  it('a cancel that really fails still says so AND refetches (settle)', async () => {
    h.answer.series_invite_cancel_v1 = bad('boom', 'XX000');
    mount();
    await screen.findByTestId('org-block-text');
    fireEvent.click(within(ids('org-linked-row')[2]).getByRole('button'));
    expect((await screen.findByTestId('step-error')).textContent).toBe(FAILURE_TEXT.failed);
    expect(wasRefetched()).toBe(true);
  });
});

describe('failures in words', () => {
  it.each([['rate_limited', '54000', /lot of invites/], ['permission_denied: x', '42501', /not allowed/]])('%s reads in words', async (message, code, text) => {
    h.answer.series_remove_organiser_v1 = bad(message, code);
    mount();
    fireEvent.click(await screen.findByTestId('org-remove'));
    expect((await screen.findByTestId('step-error')).textContent).toMatch(text);
  });
});

describe('Home Invitations', () => {
  const invites = [{ inviteId: 'a', seriesId: 's9', seriesName: 'Friday Social', invitedPageId: 'p', invitedPageName: 'Zouk Club', invitedByName: 'Ana' }];
  const mountList = () => {
    h.rows = invites;
    client = new QueryClient();
    invalidated = [];
    const real = client.invalidateQueries.bind(client);
    client.invalidateQueries = ((f?: { queryKey?: unknown[] }) => { invalidated.push(f?.queryKey ?? []); return real(f); }) as typeof client.invalidateQueries;
    return render(<QueryClientProvider client={client}><InvitationsList /></QueryClientProvider>);
  };
  const listRefetched = () => invalidated.some((k) => JSON.stringify(k) === JSON.stringify(invitationsQueryKey('u1')));
  it('lists the invitation with Accept and Decline, each sends one respond', async () => {
    mountList();
    expect((await screen.findByTestId('org-invitation-line')).textContent).toBe('Ana invited Zouk Club to run Friday Social');
    fireEvent.click(screen.getByTestId('org-invitation-accept'));
    await waitFor(() => expect(h.calls).toEqual([['series_invite_respond_v1', { p_invite_id: 'a', p_accept: true }]]));
  });
  it('Decline sends accept=false', async () => {
    mountList();
    fireEvent.click(await screen.findByTestId('org-invitation-decline'));
    await waitFor(() => expect(h.calls).toEqual([['series_invite_respond_v1', { p_invite_id: 'a', p_accept: false }]]));
  });
  it('F4: an invite withdrawn meanwhile reads "withdrawn" (not an error) and the list refetches', async () => {
    h.answer.series_invite_respond_v1 = bad('invalid_payload: this invite is no longer open');
    mountList();
    fireEvent.click(await screen.findByTestId('org-invitation-accept'));
    expect((await screen.findByTestId('org-invitations-withdrawn')).textContent).toBe('This invitation was withdrawn.');
    expect(ids('org-invitations-error')).toHaveLength(0);
    expect(listRefetched()).toBe(true);
  });
  it('a real failure says so and still refetches', async () => {
    h.answer.series_invite_respond_v1 = bad('boom', 'XX000');
    mountList();
    fireEvent.click(await screen.findByTestId('org-invitation-accept'));
    expect((await screen.findByTestId('org-invitations-error')).textContent).toBe(FAILURE_TEXT.failed);
    expect(listRefetched()).toBe(true);
  });
  it('no invitations: renders nothing at all', () => {
    h.rows = [];
    const { container } = render(<QueryClientProvider client={new QueryClient()}><InvitationsList /></QueryClientProvider>);
    expect(container.innerHTML).toBe('');
  });
});
