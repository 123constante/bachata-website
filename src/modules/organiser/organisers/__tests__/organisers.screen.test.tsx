// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({
  lifecycle: 'live', version: 3, myIds: ['o'] as string[], search: [] as { id: string; name: string }[],
  rows: [] as unknown[], calls: [] as [string, ...unknown[]][], fail: null as null | { kind: string },
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../shell', () => ({ OrganiserShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, ORG_PATHS: { home: '/account/o', eventDetails: (id: string) => `/d/${id}` } }));
vi.mock('../../events/eventsApi', () => ({
  useEventWorkspace: () => ({ isError: false, isFetching: false, refetch: vi.fn(), data: { series: { id: 's1', version: h.version, lifecycle_status: h.lifecycle } } }),
}));
vi.mock('../../events/programmeSeriesApi', () => ({ useSeriesRole: () => ({ role: 'owner', loading: false, myPages: h.myIds.map((id) => ({ id })) }) }));
vi.mock('@/modules/organiser/flows/event', () => ({
  EventConflict: () => <p data-testid="conflict">Someone else changed this event</p>,
  StepError: ({ text }: { text: string | null }) => (text ? <p role="alert" data-testid="step-error">{text}</p> : null),
}));
vi.mock('../organiserApi', async (orig) => {
  const real = await orig<typeof import('../organiserApi')>();
  const fail = async () => { if (h.fail) throw new real.OrganiserApiError(h.fail.kind as never); };
  return {
    ...real,
    useSeriesOrganisers: () => ({ data: h.rows, isError: false, isFetching: false, refetch: vi.fn() }),
    useMyInvitations: () => ({ data: h.rows }),
    searchOrganiserPages: async () => h.search,
    inviteOrganiser: async (...a: unknown[]) => { h.calls.push(['invite', ...a]); await fail(); return 'inv-new'; },
    cancelInvite: async (...a: unknown[]) => { h.calls.push(['cancel', ...a]); await fail(); },
    removeOrganiserPage: async (...a: unknown[]) => { h.calls.push(['remove', ...a]); await fail(); },
    leaveEvent: async (...a: unknown[]) => { h.calls.push(['leave', ...a]); await fail(); },
    respondToInvite: async (...a: unknown[]) => { h.calls.push(['respond', ...a]); await fail(); },
  };
});

import SeriesOrganisers from '../../events/SeriesOrganisers';
import { InvitationsList } from '../InvitationsList';

const owner = { page_id: 'o', name: 'Bachata Nights', role: 'owner', status: 'accepted' };
const co = { page_id: 'c', name: 'Salsa Crew', role: 'co', status: 'accepted' };
const invited = { page_id: 'i', name: 'Zouk Club', role: 'co', status: 'invited', invite_id: 'inv1' };

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/e/s1']}>
        <Routes><Route path="/e/:seriesId" element={<SeriesOrganisers />} /><Route path="/account/o" element={<p data-testid="home">Home</p>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// useSeriesOrganisers is mocked to return parsed rows, so the fixtures are parsed here.
import { parseOrganisers } from '../organiserModel';
const setRows = (...rows: object[]) => { h.rows = parseOrganisers({ organisers: rows }); };

beforeEach(() => { h.lifecycle = 'live'; h.version = 3; h.myIds = ['o']; h.search = []; h.calls = []; h.fail = null; setRows(owner, co, invited); });
afterEach(cleanup);

const ids = (id: string) => screen.queryAllByTestId(id);
const tooSmall = () => Array.from(document.querySelectorAll<HTMLElement>('button')).filter((b) => /h-\[(\d+)px\]/.test(b.className) && Number(/h-\[(\d+)px\]/.exec(b.className)![1]) < 44);

describe('roles x controls on the screen', () => {
  it('owner: block text, Remove on the co only, Cancel (x) on Invited, Invite on, no Leave', async () => {
    mount();
    expect((await screen.findByTestId('org-block-text')).textContent).toBe('Every organiser can edit. Only the owner can end the event.');
    const rows = ids('org-linked-row');
    expect(rows.map((r) => r.getAttribute('data-role') + '/' + r.getAttribute('data-status'))).toEqual(['owner/accepted', 'co/accepted', 'co/invited']);
    expect(rows[2].textContent).toContain('Invited');
    expect(ids('org-remove')).toHaveLength(1);
    expect(rows[0].querySelector('[data-testid="org-remove"]')).toBeNull();
    expect(ids('org-leave')).toHaveLength(0);
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(false);
    expect(ids('org-remove-note')).toHaveLength(0);
    expect(tooSmall()).toEqual([]);
  });

  it('co-organiser: no Remove, only Leave on their own row, the only-owner note, Invite on', async () => {
    h.myIds = ['c'];
    mount();
    await screen.findByTestId('org-block-text');
    expect(ids('org-remove')).toHaveLength(0);
    expect(ids('org-leave')).toHaveLength(1);
    expect(screen.getByTestId('org-remove-note').textContent).toBe('Only the owner can remove an organiser.');
    expect((screen.getByTestId('org-invite') as HTMLButtonElement).disabled).toBe(false);
  });

  it('non-member: nothing to press, Invite off WITH the reason', async () => {
    h.myIds = ['z'];
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

describe('actions send at once, once', () => {
  it('owner removes a co-organiser: one series_remove_organiser call', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('org-remove'));
    await waitFor(() => expect(h.calls).toEqual([['remove', 's1', 'c']]));
  });

  it('cancel an invite (x on the Invited chip)', async () => {
    mount();
    await screen.findByTestId('org-block-text');
    fireEvent.click(within(ids('org-linked-row')[2]).getByRole('button'));
    await waitFor(() => expect(h.calls).toEqual([['cancel', 'inv1']]));
  });

  it('invite: search any page, linked and invited ones are not offered, tap sends one invite', async () => {
    h.search = [{ id: 'o', name: 'Bachata Nights' }, { id: 'c', name: 'Salsa Crew' }, { id: 'i', name: 'Zouk Club' }, { id: 'n', name: 'Kizomba Club' }];
    mount();
    fireEvent.click(await screen.findByTestId('org-invite'));
    fireEvent.change(await screen.findByTestId('org-invite-search'), { target: { value: 'club' } });
    const results = await screen.findAllByTestId('org-invite-result', {}, { timeout: 3000 });
    expect(results).toHaveLength(1);
    expect(results[0].textContent).toContain('Kizomba Club');
    fireEvent.click(results[0].querySelector('button') ?? results[0]);
    await waitFor(() => expect(h.calls).toEqual([['invite', 's1', 'n']]));
  });

  it('invite search where everything found is already taken says so', async () => {
    h.search = [{ id: 'c', name: 'Salsa Crew' }];
    mount();
    fireEvent.click(await screen.findByTestId('org-invite'));
    fireEvent.change(await screen.findByTestId('org-invite-search'), { target: { value: 'salsa' } });
    expect((await screen.findByTestId('org-invite-none', {}, { timeout: 3000 })).textContent).toMatch(/already runs this event or has been invited/);
  });

  it('co-organiser leaves: a confirm sheet first, nothing sent until confirmed, then Home', async () => {
    h.myIds = ['c'];
    mount();
    fireEvent.click(await screen.findByTestId('org-leave'));
    expect(await screen.findByTestId('org-leave-note')).toBeTruthy();
    expect(h.calls).toEqual([]);
    fireEvent.click(screen.getByTestId('org-leave-confirm'));
    await waitFor(() => expect(h.calls).toEqual([['leave', 's1', 'c']]));
    expect(await screen.findByTestId('home')).toBeTruthy();
  });

  it('staying on the event sends nothing', async () => {
    h.myIds = ['c'];
    mount();
    fireEvent.click(await screen.findByTestId('org-leave'));
    fireEvent.click(await screen.findByTestId('org-leave-stay'));
    await waitFor(() => expect(ids('org-leave-note')).toHaveLength(0));
    expect(h.calls).toEqual([]);
  });
});

describe('failures', () => {
  it('a version conflict shows "Someone else changed this event" (EventConflict)', async () => {
    h.fail = { kind: 'conflict' };
    mount();
    fireEvent.click(await screen.findByTestId('org-remove'));
    expect((await screen.findByTestId('conflict')).textContent).toBe('Someone else changed this event');
  });
  it.each([['unavailable', /not available yet/], ['rate_limited', /lot of invites/], ['refused', /not allowed/]])('%s reads in words', async (kind, text) => {
    h.fail = { kind };
    mount();
    fireEvent.click(await screen.findByTestId('org-remove'));
    expect((await screen.findByTestId('step-error')).textContent).toMatch(text);
  });
});

describe('Home Invitations', () => {
  const invites = [{ invite_id: 'a', series_id: 's9', series_name: 'Friday Social', invited_page_id: 'p', invited_page_name: 'Zouk Club', invited_by_name: 'Ana' }];
  const mountList = () => {
    h.rows = invites.map((i) => ({ inviteId: i.invite_id, seriesId: i.series_id, seriesName: i.series_name, invitedPageId: i.invited_page_id, invitedPageName: i.invited_page_name, invitedByName: i.invited_by_name }));
    const client = new QueryClient();
    return render(<QueryClientProvider client={client}><InvitationsList /></QueryClientProvider>);
  };
  it('lists the invitation with Accept and Decline, each sends one respond', async () => {
    mountList();
    expect((await screen.findByTestId('org-invitation-line')).textContent).toBe('Ana invited Zouk Club to run Friday Social');
    fireEvent.click(screen.getByTestId('org-invitation-accept'));
    await waitFor(() => expect(h.calls).toEqual([['respond', 'a', true]]));
  });
  it('Decline sends accept=false', async () => {
    mountList();
    fireEvent.click(await screen.findByTestId('org-invitation-decline'));
    await waitFor(() => expect(h.calls).toEqual([['respond', 'a', false]]));
  });
  it('no invitations: renders nothing at all', () => {
    h.rows = [];
    const { container } = render(<QueryClientProvider client={new QueryClient()}><InvitationsList /></QueryClientProvider>);
    expect(container.innerHTML).toBe('');
  });
});
