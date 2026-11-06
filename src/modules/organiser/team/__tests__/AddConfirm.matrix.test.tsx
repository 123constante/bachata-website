// @vitest-environment jsdom
/**
 * Add someone: a confirm step before a person becomes a Manager. Table: viewer role x person state x action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));

import TeamFlow from '../TeamFlow';
import { addConfirmTitle } from '../AddConfirm';
import { TEAM_CAP } from '@/modules/organiser/shared/teamModel';
import { ORG, makeRpc, mountAt, org, row } from './fixtures';

const ADD = 'organiser_team_add_member_by_profile_v1';
const face = (i: number, o: Record<string, unknown> = {}) => ({ profile_id: `p${i}`, display_name: `Dancer${i} Sur${i}`, photo_url: null, fact: null, can_add: true, ...o });
const hit = { profile_id: 'pz', display_name: 'Zoe Park', photo_url: null, city_name: 'Leeds' };
let world: ReturnType<typeof makeRpc>;
let faces: unknown[];
let members: unknown[];
let role: 'owner' | 'manager' | 'member';
let pageName: string | null;

const install = (extra: Record<string, unknown> = {}) => {
  world = makeRpc({
    organiser_team_v1: () => ({ my_role: role, members }),
    list_organiser_access_requests_v1: [],
    organiser_team_browse_people_v1: () => faces,
    organiser_team_search_people_v1: [hit],
    ...extra,
  });
  h.rpc.mockImplementation(world.rpc);
};
const at = () => mountAt('/account/o/team/add', <Route path="/account/o/team/add" element={<TeamFlow step="add" />} />);
const minH = (el: HTMLElement) => /min-h-\[(\d+)px\]|h-\[(\d+)px\]/.exec(el.className)?.slice(1).map(Number).find(Boolean) ?? 0;
const search = async () => {
  at();
  fireEvent.change(await screen.findByTestId('add-search'), { target: { value: 'zo' } });
  return screen.findByTestId('add-result');
};

beforeEach(() => {
  h.rpc.mockReset();
  role = 'owner';
  pageName = 'Ritmo';
  members = [row('me', 'owner', { is_self: true }), row('ana', 'manager', { display_name: 'Ana Maria' })];
  faces = [face(1, { profile_id: 'pr', display_name: 'Priya Sharma' })];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: [{ ...org(role as 'owner'), role, name: pageName }] }));
  install();
});
afterEach(cleanup);

describe('who sees the confirm (viewer role)', () => {
  it.each(['owner', 'manager'] as const)('%s: tapping a face asks first and writes nothing yet', async (r) => {
    role = r;
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    expect((await screen.findByTestId('add-confirm-question')).textContent).toBe('Add Priya Sharma as Manager of Ritmo?');
    expect(world.calls(ADD)).toHaveLength(0);
  });
  it.each(['member', 'none'] as const)('%s: read-only line, no faces, no confirm', async (r) => {
    role = r === 'none' ? ('' as never) : r;
    at();
    expect(await screen.findByTestId('add-read-only')).toBeTruthy();
    expect(screen.queryAllByTestId('add-face')).toHaveLength(0);
    expect(screen.queryByTestId('add-confirm')).toBeNull();
  });
});

describe('person states', () => {
  it('addable search result: confirm, then exactly one add and Done', async () => {
    fireEvent.click(await search());
    expect((await screen.findByTestId('add-confirm-question')).textContent).toBe('Add Zoe Park as Manager of Ritmo?');
    expect(world.calls(ADD)).toHaveLength(0);
    fireEvent.click(screen.getByTestId('add-confirm-yes'));
    expect((await screen.findByTestId('org-done-message')).textContent).toBe('Zoe P. is a Manager');
    expect(world.calls(ADD)).toEqual([{ p_organiser_id: ORG, p_profile_id: 'pz', p_member_role: 'manager', p_reason: null }]);
  });
  it('canAdd === false face: invite share, no confirm, no write', async () => {
    faces = [face(1, { display_name: 'Lena Voss', can_add: false })];
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('add-confirm')).toBeNull();
    expect(world.calls(ADD)).toHaveLength(0);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  it('person already on the team: not on the wall, and their name finds no one', async () => {
    faces = [face(1, { profile_id: 'ana', display_name: 'Ana Maria' })];
    install({ organiser_team_search_people_v1: [{ ...hit, profile_id: 'ana', display_name: 'Ana Maria' }] });
    at();
    await screen.findByTestId('add-search');
    await waitFor(() => expect(screen.queryAllByTestId('add-face')).toHaveLength(0));
    fireEvent.change(screen.getByTestId('add-search'), { target: { value: 'ana' } });
    expect((await screen.findByTestId('add-no-results')).textContent).toMatch(/^No one found/);
  });
  it('team full: faces disabled, no confirm opens', async () => {
    members = Array.from({ length: TEAM_CAP }, (_, i) => row(i === 0 ? 'me' : `m${i}`, i === 0 ? 'owner' : 'manager', i === 0 ? { is_self: true } : {}));
    at();
    const b = (await screen.findByTestId('add-face')) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(screen.queryByTestId('add-confirm')).toBeNull();
    expect(world.calls(ADD)).toHaveLength(0);
  });
  it('one-letter name reads sensibly', async () => {
    faces = [face(1, { display_name: 'Q' })];
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    expect((await screen.findByTestId('add-confirm-question')).textContent).toBe('Add Q as Manager of Ritmo?');
  });
  it('a nameless face is never shown (so never confirmable); the title still falls back to "this person"', async () => {
    faces = [face(1, { display_name: '' }), face(2, { display_name: 'Priya Sharma', profile_id: 'pr' })];
    at();
    expect(await screen.findAllByTestId('add-face')).toHaveLength(1);
    expect(addConfirmTitle('  ', 'Ritmo')).toBe('Add this person as Manager of Ritmo?');
  });
  it('a very long page name wraps in the body (no truncation of the question)', async () => {
    pageName = 'The Very Long Named Bachata Sensual Dance Collective of Greater Manchester and Beyond';
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    const q = await screen.findByTestId('add-confirm-question');
    expect(q.textContent).toContain(pageName);
    expect(q.className).toContain('break-words');
  });
  it('page name missing: "this page"', async () => {
    pageName = null;
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    expect((await screen.findByTestId('add-confirm-question')).textContent).toBe('Add Priya Sharma as Manager of this page?');
  });
});

describe('actions', () => {
  it('Add: exactly one call (role manager), then Done', async () => {
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    fireEvent.click(await screen.findByTestId('add-confirm-yes'));
    expect((await screen.findByTestId('org-done-message')).textContent).toBe('Priya S. is a Manager');
    expect(world.calls(ADD)).toEqual([{ p_organiser_id: ORG, p_profile_id: 'pr', p_member_role: 'manager', p_reason: null }]);
  });
  it('Cancel: closes, zero calls, focus back on the face', async () => {
    at();
    const f = await screen.findByTestId('add-face');
    f.focus();
    fireEvent.click(f);
    fireEvent.click(await screen.findByTestId('add-confirm-no'));
    await waitFor(() => expect(screen.queryByTestId('add-confirm')).toBeNull());
    expect(world.calls(ADD)).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(f));
  });
  it('Escape: closes, zero calls', async () => {
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    await screen.findByTestId('add-confirm');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('add-confirm')).toBeNull());
    expect(world.calls(ADD)).toHaveLength(0);
  });
  it('failed add: panel closes, error line, no Done', async () => {
    install({ [ADD]: () => new Error('owner_only') });
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    fireEvent.click(await screen.findByTestId('add-confirm-yes'));
    expect(await screen.findByTestId('add-error')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('add-confirm')).toBeNull());
    expect(screen.queryByTestId('org-done-message')).toBeNull();
    expect(screen.getByTestId('org-page-team-add')).toBeTruthy();
  });
  it('team_full failure: panel closes, error stays, faces stay disabled so Add cannot be reached again', async () => {
    install({ [ADD]: () => new Error('team_full') });
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    fireEvent.click(await screen.findByTestId('add-confirm-yes'));
    expect(await screen.findByTestId('add-error')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('add-confirm')).toBeNull());
    expect((screen.getByTestId('add-face') as HTMLButtonElement).disabled).toBe(true);
    expect(world.calls(ADD)).toHaveLength(1);
  });
  it('both buttons are at least 44px high', async () => {
    at();
    fireEvent.click(await screen.findByTestId('add-face'));
    for (const id of ['add-confirm-yes', 'add-confirm-no']) expect(minH(await screen.findByTestId(id))).toBeGreaterThanOrEqual(44);
  });
});
