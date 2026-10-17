// @vitest-environment jsdom
/**
 * S6 Hand over (C30 -> C31 -> C32, D14, D40): confirmed-email members only, keyed by user_id, the ONE
 * warning sentence (handOverWarning, imported by exactly ONE file), ONE transfer call, Done with no Undo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));

import HandoverFlow from '../index';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { handOverWarning } from '@/modules/organiser/shared/copy';
import { ORG, makeRpc, mountAt, org, row } from '../../../team/__tests__/fixtures';

const routes = (
  <>
    <Route path="/account/o/handover" element={<HandoverFlow step="to" />} />
    <Route path="/account/o/handover/:userId" element={<HandoverFlow step="confirm" />} />
  </>
);
let world: ReturnType<typeof makeRpc>;
let members: unknown[];
let myRole: string;

beforeEach(() => {
  h.rpc.mockReset();
  myRole = 'owner';
  members = [
    row('me', 'owner', { is_self: true }),
    row('maya-user', 'manager', { display_name: 'Maya Rao', profile_id: 'maya-profile' }),
    row('noemail', 'manager', { display_name: 'No Email', email: null }),
    row('other-owner', 'owner', { display_name: 'Second Owner' }),
  ];
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: [org('owner')] }));
  world = makeRpc({ organiser_team_v1: () => ({ my_role: myRole, members }), organiser_transfer_ownership_v1: { ok: true } });
  h.rpc.mockImplementation(world.rpc);
});
afterEach(cleanup);

describe('C30 to whom', () => {
  it('lists members with a confirmed email only: not you, not owners, not email-less members', async () => {
    mountAt(ORG_PATHS.handover, routes);
    const opts = await screen.findAllByTestId('handover-option');
    expect(opts.map((o) => o.textContent)).toEqual(['MRMaya Rao']); // initials face + name
    expect(opts[0].getAttribute('href')).toBe(ORG_PATHS.handoverTo('maya-user'));
  });

  it('nobody eligible -> an empty state with one action (Add someone)', async () => {
    members = [row('me', 'owner', { is_self: true })];
    mountAt(ORG_PATHS.handover, routes);
    const empty = await screen.findByTestId('handover-empty');
    expect(within(empty).getByTestId('handover-add').getAttribute('href')).toBe(ORG_PATHS.teamAdd);
  });

  it('a manager cannot hand over', async () => {
    myRole = 'manager';
    h.home.mockImplementation(async () => ({ today: '2026-10-07', organisers: [org('manager')] }));
    members = [row('me', 'manager', { is_self: true }), row('o', 'owner')];
    mountAt(ORG_PATHS.handover, routes);
    expect(await screen.findByTestId('handover-owner-only')).toBeTruthy();
  });
});

describe('C31 confirm -> C32 Done', () => {
  it('shows the verbatim warning sentence; Hand over = ONE transfer call by user_id, then Done with no Undo', async () => {
    mountAt(ORG_PATHS.handoverTo('maya-user'), routes);
    const warning = await screen.findByTestId('handover-warning');
    expect(warning.textContent).toBe(handOverWarning('Ritmo', 'Maya R.'));
    fireEvent.click(screen.getByTestId('handover-send'));
    const msg = await screen.findByTestId('org-done-message');
    expect(msg.textContent).toBe('Maya R. is the Owner - you are a Manager. Only Maya can hand it back.');
    expect(world.calls('organiser_transfer_ownership_v1')).toEqual([{ p_organiser_id: ORG, p_to_user_id: 'maya-user' }]);
    const labels = within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Back to Home']);
    expect(screen.queryByText(/undo/i)).toBeNull();
  });

  it('a refusal reads in plain words and stays on the screen', async () => {
    world = makeRpc({ organiser_team_v1: () => ({ my_role: 'owner', members }), organiser_transfer_ownership_v1: new Error('not_a_member') });
    h.rpc.mockImplementation(world.rpc);
    mountAt(ORG_PATHS.handoverTo('maya-user'), routes);
    fireEvent.click(await screen.findByTestId('handover-send'));
    await waitFor(() => expect(screen.getByTestId('handover-error').textContent).toContain('no longer on the team'));
  });

  it('someone who cannot take over (no email / an owner / unknown) gets a way back, not a button', async () => {
    for (const id of ['noemail', 'other-owner', 'ghost']) {
      mountAt(ORG_PATHS.handoverTo(id), routes);
      expect(await screen.findByTestId('handover-missing')).toBeTruthy();
      expect(screen.queryByTestId('handover-send')).toBeNull();
      cleanup();
    }
  });
});

describe('the pinned sentence', () => {
  it('handOverWarning is imported by exactly ONE file (D40)', () => {
    const root = resolve(__dirname, '../../../../..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== '__tests__') walk(p); continue; }
        if (/\.(ts|tsx)$/.test(name) && /\bhandOverWarning\b/.test(readFileSync(p, 'utf8')) && !p.endsWith('shared/copy.ts')) hits.push(p);
      }
    };
    walk(join(root, 'modules/organiser'));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('flows/handover/Confirm.tsx');
  });
});
