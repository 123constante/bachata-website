// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { R4TeamR2Person } from '../r4TeamR2Api';

const api = vi.hoisted(() => ({ people: vi.fn(), set: vi.fn(), changes: vi.fn(), requests: vi.fn() }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/selfServeApi')>()),
  fetchIncomingAccessRequests: api.requests,
}));
vi.mock('../../../flows/fix/JoinRequest', () => ({
  JoinRequestCard: (p: { onAnswered: (m: string) => void; blockedReason: string | null }) => (
    <div data-testid="join-card">{p.blockedReason}<button type="button" onClick={() => p.onAnswered('Done')}>answer</button></div>
  ),
}));
const ctx = vi.hoisted(() => ({ viewerRole: 'owner' }));
vi.mock('../r4TeamR2Api', async (orig) => ({
  ...(await orig<typeof import('../r4TeamR2Api')>()),
  fetchTeamR2People: api.people, setTeamR2Switches: api.set, fetchTeamR2Changes: api.changes,
}));
vi.mock('../../../team/useTeamContext', () => ({
  useTeamContext: () => ({ organiser: { id: 'org1', name: 'Page' }, members: [], listed: null, loading: false, failed: false, retry: () => {}, viewerRole: ctx.viewerRole }),
}));
import { R4TeamR2, buildRows, changeSentence, doorUntilWords, switchErrorLine } from '../R4TeamR2';

afterEach(() => { cleanup(); vi.clearAllMocks(); ctx.viewerRole = 'owner'; });

const P = (o: Partial<R4TeamR2Person>): R4TeamR2Person => ({
  userId: 'u', profileId: null, name: 'Ana', avatarUrl: null, role: 'manager', canSignIn: true, onPublic: true, isYou: false, doorUntil: null, doorExpired: false, ...o,
});

describe('R4 Team R2 model', () => {
  it('builds rows in RPC order; owner and non-owner viewers lock sign-in', () => {
    const people = [P({ userId: 'o', role: 'owner' }), P({ userId: 'm' }), P({ userId: 'd', role: 'door', doorUntil: '2026-11-26T14:00:00Z' }), P({ userId: 'x', role: 'door', doorExpired: true })];
    const asOwner = buildRows(people, 'owner');
    expect(asOwner.map((r) => r.person.userId)).toEqual(['o', 'm', 'd', 'x']);
    expect(asOwner.map((r) => r.signInLocked)).toEqual([true, false, false, false]);
    expect(asOwner.map((r) => r.kind)).toEqual(['normal', 'normal', 'door', 'door-expired']);
    expect(buildRows(people, 'manager').every((r) => r.signInLocked)).toBe(true);
  });
  it.each([
    ['raise exception cannot_lock_out_owner', "You can't switch off your own sign-in."],
    ['not_a_member', 'Only the page owner can change this.'],
    ['use_transfer', 'Only the page owner can change this.'],
    ['network down', 'Could not save. Try again.'],
  ])('error %s -> line', (m, line) => expect(switchErrorLine({ message: m })).toBe(line));
  it('door_until is London time (BST and GMT)', () => {
    expect(doorUntilWords('2026-07-02T13:00:00Z')).toBe('Door until Thursday 14:00');
    expect(doorUntilWords('2026-11-26T14:00:00Z')).toBe('Door until Thursday 14:00');
  });
  const now = new Date('2026-11-25T12:00:00Z');
  it.each([
    ['added', 'Ana added Leo as Manager - 2h ago', { toRole: 'manager' }],
    ['removed', 'Ana removed Leo from the team - 2h ago', {}],
    ['role_changed', 'Ana changed Leo from Contributor to Manager - 2h ago', { fromRole: 'contributor', toRole: 'manager' }],
    ['shown', 'Ana showed Leo on the public page - 2h ago', {}],
    ['hidden', 'Ana hid Leo from the public page - 2h ago', {}],
    ['invite_link', 'Ana sent an invite link - 2h ago', {}],
    ['door_added', 'Ana added Leo to the door - 2h ago', {}],
    ['door_removed', 'Ana removed Leo from the door - 2h ago', {}],
    ['owner_handed_over', 'Ana handed the page over to Leo - 2h ago', {}],
    ['undone', 'Ana undid a change for Leo - 2h ago', {}],
  ])('sentence for %s', (action, want, extra) => {
    expect(changeSentence({ at: '2026-11-25T10:00:00Z', actor: 'Ana', person: 'Leo', action, fromRole: null, toRole: null, id: null, canUndo: false, ...extra }, now)).toBe(want);
  });
  it('says yesterday', () => {
    expect(changeSentence({ at: '2026-11-24T10:00:00Z', actor: 'Ana', person: 'Leo', action: 'hidden', fromRole: null, toRole: null, id: null, canUndo: false }, now)).toBe('Ana hid Leo from the public page - yesterday');
  });
});

const mount = (entry = '/') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[entry]}><R4TeamR2 /></MemoryRouter>
  </QueryClientProvider>,
);
const seed = () => {
  api.people.mockResolvedValue({ people: [P({ userId: 'o', role: 'owner', name: 'Owen', isYou: true }), P({ userId: 'm', name: 'Mia' })], invites: [{ role: 'manager', expiresAt: '2026-12-01T00:00:00Z', createdAt: null }] });
  api.changes.mockResolvedValue([]);
};

describe('R4 Team R2 screen (flag ON)', () => {
  it('flipping a switch calls set_switches once with the other switch unchanged', async () => {
    seed(); api.set.mockResolvedValue(undefined);
    mount();
    const rows = await screen.findAllByTestId('r4-team-r2-row');
    fireEvent.click(rows[1].querySelector('[data-testid="r4-team-r2-public"]')!);
    await waitFor(() => expect(api.set).toHaveBeenCalledTimes(1));
    expect(api.set).toHaveBeenCalledWith('org1', 'm', true, false);
  });
  it('error reverts the switch and shows the plain line', async () => {
    seed(); api.set.mockRejectedValue({ message: 'boom' });
    mount();
    const rows = await screen.findAllByTestId('r4-team-r2-row');
    const sw = rows[1].querySelector('[data-testid="r4-team-r2-public"]')!;
    fireEvent.click(sw);
    expect((await screen.findByTestId('r4-team-r2-rowerr')).textContent).toBe('Could not save. Try again.');
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
  it('owner row sign-in is on and disabled; both-off asks first', async () => {
    seed(); api.set.mockResolvedValue(undefined);
    mount();
    const rows = await screen.findAllByTestId('r4-team-r2-row');
    const own = rows[0].querySelector('[data-testid="r4-team-r2-signin"]') as HTMLButtonElement;
    expect(own.disabled).toBe(true);
    expect(own.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(rows[1].querySelector('[data-testid="r4-team-r2-signin"]')!);
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('org1', 'm', false, true));
    cleanup(); api.set.mockClear();
    api.people.mockResolvedValue({ people: [P({ userId: 'o', role: 'owner' }), P({ userId: 'm', name: 'Mia', canSignIn: false })], invites: [] });
    mount();
    const rows2 = await screen.findAllByTestId('r4-team-r2-row');
    fireEvent.click(rows2[1].querySelector('[data-testid="r4-team-r2-public"]')!);
    expect(api.set).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('r4-team-r2-remove'));
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('org1', 'm', false, false));
  });
  it('manager viewer: every sign-in switch is read-only', async () => {
    ctx.viewerRole = 'manager'; seed();
    mount();
    await screen.findAllByTestId('r4-team-r2-row');
    expect((screen.getAllByTestId('r4-team-r2-signin') as HTMLButtonElement[]).every((b) => b.disabled)).toBe(true);
  });
  it('shows the muted invite row, and hides Recent changes when the RPC refuses', async () => {
    seed(); api.changes.mockResolvedValue(null);
    mount();
    expect((await screen.findByTestId('r4-team-r2-invite')).textContent).toContain('Invite link sent - waiting');
    expect(screen.queryByTestId('r4-team-r2-changes')).toBeNull();
  });
  it('load error shows the line and Retry', async () => {
    api.people.mockRejectedValue(new Error('x')); api.changes.mockResolvedValue([]);
    mount();
    expect((await screen.findByTestId('r4-team-r2-error')).textContent).toContain('Could not load your team. Pull to refresh.');
    expect(screen.getByTestId('r4-team-r2-retry')).toBeTruthy();
  });
});

describe('R4 Team R2 Waiting to join (flag ON)', () => {
  const req = { requestId: 'rq1', userId: 'ux', requesterEmail: 'sam@example.com', message: null, createdAt: '2026-11-25T10:00:00Z' };
  const seedReq = (rows: unknown[]) => { seed(); api.requests.mockResolvedValue(rows); };
  it('renders above the list; tapping the row opens the request; answering closes it and shows the message', async () => {
    seedReq([req]);
    mount();
    const section = await screen.findByTestId('r4-team-waiting');
    const first = (await screen.findAllByTestId('r4-team-r2-row'))[0];
    expect(section.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('r4-team-request')).toBeNull();
    fireEvent.click(screen.getByTestId('r4-team-waiting-row'));
    expect(await screen.findByTestId('r4-team-request')).toBeTruthy();
    fireEvent.click(screen.getByText('answer'));
    await waitFor(() => expect(screen.queryByTestId('r4-team-request')).toBeNull());
    expect(screen.getByTestId('r4-team-said').textContent).toBe('Done');
    await waitFor(() => expect(api.people.mock.calls.length).toBeGreaterThan(1));
  });
  it('?answer=<id> opens that request on mount', async () => {
    seedReq([req]);
    mount('/?answer=rq1');
    expect(await screen.findByTestId('r4-team-request')).toBeTruthy();
  });
  it('zero requests -> no section; no Door invite link row', async () => {
    seedReq([]);
    mount();
    await screen.findAllByTestId('r4-team-r2-row');
    expect(screen.queryByTestId('r4-team-waiting')).toBeNull();
    expect(screen.queryByTestId('r4-team-door-invite')).toBeNull();
  });
  it('request load error shows the line and Try again', async () => {
    seed(); api.requests.mockRejectedValue(new Error('x'));
    mount();
    expect((await screen.findByTestId('r4-team-requests-error')).textContent).toContain('We could not load join requests.');
  });
});

describe('KEEP-LIST (flag OFF): R4Team still renders everything it rendered on main', () => {
  const src = readFileSync('src/modules/organiser/p3/r4/R4Team.tsx', 'utf8');
  const ids = ['r4-team-loading', 'r4-team-error', 'r4-team-retry', 'r4-team-nopage', 'r4-team', 'r4-team-said', 'r4-team-viewonly', 'r4-team-add', 'r4-team-add-why',
    'r4-team-readnote', 'r4-team-requests-error', 'r4-team-waiting', 'r4-team-waiting-row', 'r4-team-invited', 'r4-team-invited-error', 'r4-team-invited-retry',
    'r4-team-door-invite', 'r4-team-request', 'r4-team-row', 'r4-team-you', 'r4-add-go', 'r4-add-invite'];
  it.each(ids)('%s', (id) => expect(src).toContain(id));
  it('flag line only returns early; defaults off', async () => {
    expect(src).toContain('if (flags.organiserTeamR2) return <R4TeamR2 />;');
    expect((await import('@/lib/featureFlags')).flags.organiserTeamR2).toBe(false);
  });
});
