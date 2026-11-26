// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ people: vi.fn(), changes: vi.fn(), undo: vi.fn(), requests: vi.fn() }));
const flags = vi.hoisted(() => ({ on: true }));
const ctx = vi.hoisted(() => ({ viewerRole: 'owner' }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get organiserTeamR3() { return flags.on; } } }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/selfServeApi')>()),
  fetchIncomingAccessRequests: api.requests,
}));
vi.mock('../../../flows/fix/JoinRequest', () => ({ JoinRequestCard: () => null }));
vi.mock('../r4TeamR2Api', async (orig) => ({
  ...(await orig<typeof import('../r4TeamR2Api')>()),
  fetchTeamR2People: api.people, fetchTeamR2Changes: api.changes, undoTeamChange: api.undo,
}));
vi.mock('../../../team/useTeamContext', () => ({
  useTeamContext: () => ({ organiser: { id: 'org1', name: 'Page' }, members: [], listed: null, loading: false, failed: false, retry: () => {}, viewerRole: ctx.viewerRole }),
}));
import { R4TeamR2, undoErrorLine } from '../R4TeamR2';
import { parseChanges } from '../r4TeamR2Api';

afterEach(() => { cleanup(); vi.clearAllMocks(); ctx.viewerRole = 'owner'; flags.on = true; });

const C = (o: object) => ({ at: '2026-11-25T10:00:00Z', actor: 'Ana', person: 'Leo', action: 'hidden', fromRole: null, toRole: null, id: null, canUndo: false, ...o });
const seed = () => {
  api.people.mockResolvedValue({ people: [{ userId: 'o', profileId: null, name: 'Owen', avatarUrl: null, role: 'owner', canSignIn: true, onPublic: true, isYou: true, doorUntil: null, doorExpired: false }], invites: [] });
  api.requests.mockResolvedValue([]);
  api.changes.mockResolvedValue([C({ id: 'c1', canUndo: true }), C({ id: 'c2', canUndo: false }), C({ id: null, canUndo: true })]);
};
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><MemoryRouter><R4TeamR2 /></MemoryRouter></QueryClientProvider>);
  return spy;
};
const openList = async () => { fireEvent.click(await screen.findByTestId('r4-team-r2-changes-toggle')); await screen.findAllByTestId('r4-team-r2-change'); };

describe('parseChanges id / can_undo', () => {
  it('reads both, defaults safely', () => {
    const [a, b] = parseChanges([{ at: 't', action: 'hidden', id: 'x', can_undo: true }, { at: 't', action: 'undone' }]);
    expect([a.id, a.canUndo, b.id, b.canUndo]).toEqual(['x', true, null, false]);
  });
});

describe('undo refusal lines', () => {
  it.each([
    ['state_moved_on', "This changed again since, so it can't be undone."],
    ['already_undone', 'Already undone.'],
    ['touches_owner', "The owner's access can't be undone here."],
    ['not_authorised', 'Only the page owner can change this.'],
    ['restore_mismatch', 'Could not undo. Try again.'],
    ['network down', 'Could not undo. Try again.'],
  ])('%s', (m, line) => expect(undoErrorLine(new Error(m))).toBe(line));
});

describe('Team Recent changes Undo', () => {
  it('flag ON owner: Undo only where canUndo and id', async () => {
    seed(); mount(); await openList();
    expect(screen.getAllByTestId('r4-team-r2-undo')).toHaveLength(1);
    expect(screen.getByTestId('r4-team-r2-undo').getAttribute('aria-label')).toContain('Undo: Ana hid Leo');
  });
  it('flag OFF: no Undo, existing testids render', async () => {
    flags.on = false; seed(); mount(); await openList();
    expect(screen.queryByTestId('r4-team-r2-undo')).toBeNull();
    for (const id of ['r4-team-r2', 'r4-team-r2-add', 'r4-team-r2-list', 'r4-team-r2-row', 'r4-team-r2-signin', 'r4-team-r2-public', 'r4-team-r2-changes', 'r4-team-r2-changes-toggle']) {
      expect(screen.getAllByTestId(id).length).toBeGreaterThan(0);
    }
  });
  it('flag ON keeps the same testids', async () => {
    seed(); mount(); await openList();
    for (const id of ['r4-team-r2', 'r4-team-r2-add', 'r4-team-r2-list', 'r4-team-r2-row', 'r4-team-r2-signin', 'r4-team-r2-public', 'r4-team-r2-changes', 'r4-team-r2-changes-toggle']) {
      expect(screen.getAllByTestId(id).length).toBeGreaterThan(0);
    }
  });
  it('manager sees none', async () => {
    ctx.viewerRole = 'manager'; seed(); mount(); await openList();
    expect(screen.queryByTestId('r4-team-r2-undo')).toBeNull();
  });
  it('success: Undoing... then Undone. and both keys invalidated', async () => {
    seed(); let done!: () => void;
    api.undo.mockReturnValue(new Promise<void>((r) => { done = r; }));
    const spy = mount(); await openList();
    fireEvent.click(screen.getByTestId('r4-team-r2-undo'));
    const btn = screen.getByTestId('r4-team-r2-undo') as HTMLButtonElement;
    expect(btn.textContent).toBe('Undoing...'); expect(btn.disabled).toBe(true);
    done();
    await waitFor(() => expect(screen.getByTestId('r4-team-said').textContent).toBe('Undone.'));
    expect(api.undo).toHaveBeenCalledWith('org1', 'c1');
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toContain(JSON.stringify(['organiser-team-r2-people', 'org1']));
    expect(keys).toContain(JSON.stringify(['organiser-team-r2-changes', 'org1']));
  });
  it('refusal shows the line under the row and refreshes changes', async () => {
    seed(); api.undo.mockRejectedValue(new Error('state_moved_on'));
    const spy = mount(); await openList();
    fireEvent.click(screen.getByTestId('r4-team-r2-undo'));
    expect((await screen.findByTestId('r4-team-r2-undoerr')).textContent).toBe("This changed again since, so it can't be undone.");
    expect(spy).toHaveBeenCalled();
  });
});
