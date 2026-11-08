// @vitest-environment jsdom
/**
 * Team restructure C: the Team screen and the public page read ONE team (organiser_team_shared_v1).
 * Shapes x viewers. Public rows == shared rows filtered by is_public; one label mapping; every
 * reason on screen points at a control that is on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));

import TeamPage from '../index';
import { parseSharedTeam, rowSwitch, SHARED_ROLE_LABEL, NOBODY_LISTED, type SharedTeamRow } from '../teamShared';
import { parsePublicTeam } from '../publicTeamApi';
import { teamFromPublicRows } from '@/modules/profile/organiserTeam';
import { OrganiserTeamSection } from '@/modules/profile/OrganiserTeamSection';
import { ORG, makeRpc, mountAt, org, row } from './fixtures';

const shared = (o: Record<string, unknown>) => ({
  person_id: 'p-' + String(o.n ?? 1), user_id: null, slug: 'x', public_name: 'Person ' + String(o.n ?? 1), avatar_url: null,
  access_role: 'none', listing_label: 'listed', is_stub: false, is_public: true, public_reason: 'roster', sort_key: Number(o.n ?? 1), ...o,
});

const SHAPES: Record<string, Record<string, unknown>[]> = {
  'seat only': [shared({ n: 1, user_id: 'me', access_role: 'owner', public_reason: 'seat' })],
  'roster only': [shared({ n: 1 }), shared({ n: 2 })],
  both: [shared({ n: 1, user_id: 'me', access_role: 'owner', public_reason: 'seat' }), shared({ n: 2 })],
  'seat + roster off': [shared({ n: 1, user_id: 'me', access_role: 'owner', public_reason: 'seat' }), shared({ n: 2, is_public: false, public_reason: 'not_listed' })],
  stub: [shared({ n: 1, is_stub: true, is_public: false, public_reason: 'stub' })],
  hidden: [shared({ n: 1, is_public: false, public_reason: 'hidden' })],
  empty: [],
};

const toRow = (r: Record<string, unknown>): SharedTeamRow => parseSharedTeam([r])[0];

describe('shared team: public rows are the shared rows filtered by is_public', () => {
  for (const [name, rows] of Object.entries(SHAPES)) {
    it(name, () => {
      const parsed = parseSharedTeam(rows);
      const publicRows = parsePublicTeam(rows.filter((r) => r.is_public === true));
      const ids = teamFromPublicRows(publicRows).people.map((p) => p.personId);
      expect(ids).toEqual(parsed.filter((r) => r.isPublic).map((r) => r.personId));
    });
  }
  it('tolerates a new column and refuses a bad shape', () => {
    expect(parseSharedTeam([{ ...shared({}), brand_new: 1 }])).toHaveLength(1);
    expect(() => parseSharedTeam({})).toThrow();
    expect(() => parseSharedTeam([{ person_id: 'x' }])).toThrow();
  });
});

describe('one label mapping and a reason for every disabled switch', () => {
  it('labels', () => expect(SHARED_ROLE_LABEL).toEqual({ owner: 'Owner', manager: 'Manager', contributor: 'Contributor', none: 'Listed' }));
  const callers = { owner: { seat: 'owner' as const, personId: 'p-9' }, manager: { seat: 'manager' as const, personId: 'p-9' }, visitor: { seat: null, personId: null } };
  for (const [shape, rows] of Object.entries(SHAPES)) {
    for (const [who, caller] of Object.entries(callers)) {
      it(`${shape} / ${who}: disabled means a reason, enabled means a command`, () => {
        for (const r of rows.map(toRow)) {
          const sw = rowSwitch(r, caller);
          expect(sw.press === null).toBe(sw.reason !== null);
          expect(sw.on).toBe(r.isPublic);
        }
      });
    }
  }
  it('stub, no profile and hidden-without-rights each say why', () => {
    expect(rowSwitch(toRow(shared({ is_public: false, public_reason: 'stub' })), callers.owner).reason).toMatch(/profile/);
    expect(rowSwitch(toRow(shared({ person_id: null, is_public: false, public_reason: 'no_profile' })), callers.owner).reason).toMatch(/No dancer profile/);
    expect(rowSwitch(toRow(shared({ is_public: false, public_reason: 'hidden' })), callers.visitor).reason).toMatch(/owner or manager/);
  });
  it('a manager cannot hide an owner; an owner can; hidden offers Show', () => {
    const own = toRow(shared({ access_role: 'owner', public_reason: 'seat' }));
    expect(rowSwitch(own, callers.manager).press).toBeNull();
    expect(rowSwitch(own, callers.owner).press).toBe('hide');
    expect(rowSwitch(toRow(shared({ is_public: false, public_reason: 'hidden' })), callers.owner).press).toBe('show');
  });
});

describe('Team screen', () => {
  let shape: Record<string, unknown>[] | Error;
  beforeEach(() => {
    h.rpc.mockReset();
    h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-07', organisers: [org('owner')] }));
    h.rpc.mockImplementation(makeRpc({
      organiser_team_v1: () => ({ my_role: 'owner', members: [row('me', 'owner', { is_self: true, display_name: 'Me' })] }),
      organiser_team_shared_v1: () => { if (shape instanceof Error) throw shape; return shape; },
      list_organiser_access_requests_v1: [],
    }).rpc);
  });
  afterEach(() => cleanup());

  it('both: every person with a label and a switch; roster person is not a link', async () => {
    shape = SHAPES.both;
    mountAt('/account/o/team', <Route path="/account/o/team" element={<TeamPage />} />);
    await waitFor(() => expect(screen.getAllByTestId('team-member')).toHaveLength(2));
    const rows = screen.getAllByTestId('team-member');
    expect(within(rows[0]).getByTestId('team-row-label').textContent).toBe('Owner');
    expect(within(rows[1]).getByTestId('team-row-label').textContent).toBe('Listed');
    expect(rows[1].querySelector('a')).toBeNull();
    expect(screen.getAllByTestId('team-row-switch')).toHaveLength(2);
  });
  it('stub: switch disabled with its reason', async () => {
    shape = SHAPES.stub;
    mountAt('/account/o/team', <Route path="/account/o/team" element={<TeamPage />} />);
    await waitFor(() => expect(screen.getByTestId('team-row-switch')).toBeTruthy());
    expect((screen.getByTestId('team-row-switch') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('team-row-reason').textContent).toMatch(/profile/);
  });
  it('empty: says nobody is listed and Add someone is on screen', async () => {
    shape = SHAPES.empty;
    mountAt('/account/o/team', <Route path="/account/o/team" element={<TeamPage />} />);
    await waitFor(() => expect(screen.getByTestId('team-empty').textContent).toBe(NOBODY_LISTED));
    expect(screen.getByTestId('team-add')).toBeTruthy();
  });
  it('shared read failed: seats still show, with a plain line, never "nobody is listed"', async () => {
    shape = new Error('boom');
    mountAt('/account/o/team', <Route path="/account/o/team" element={<TeamPage />} />);
    await waitFor(() => expect(screen.getByTestId('team-shared-failed')).toBeTruthy());
    expect(screen.queryByTestId('team-empty')).toBeNull();
    expect(screen.getAllByTestId('team-member')).toHaveLength(1);
  });
});

describe('public Team section when empty', () => {
  const props = { team: teamFromPublicRows([]), failed: false, onRetry: () => {}, nationality: new Map(), badges: new Map(), badgesState: 'ready' as never };
  const view = (href: string | null) => render(<MemoryRouter><OrganiserTeamSection {...props} ownEmptyHref={href} /></MemoryRouter>);
  afterEach(() => cleanup());
  it('visitor sees nothing (no dead heading)', () => { const { container } = view(null); expect(container.innerHTML).toBe(''); });
  it('organiser sees one line linking to Team', () => {
    view('/account/o/team');
    expect(screen.getByTestId('org-team-own-empty').textContent).toBe('Your Team is empty. Add people in Team.');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/account/o/team');
  });
});
