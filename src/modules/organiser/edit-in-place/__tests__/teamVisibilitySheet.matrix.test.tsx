// @vitest-environment jsdom
// The Team sheet's "Who shows on your page" (J7): every caller x every target x
// (hide, show), through the REAL sheet with injected reads. The expected answer
// is an independent truth table written from set_organiser_team_member_hidden_v1
// (admin #1259), NOT a call to canSetHidden(), so a wrong rule goes red here.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach } from 'vitest';
import TeamVisibilitySheet from '../TeamVisibilitySheet';
import { VISIBILITY_COPY, visibilityAccess, visibilityRows } from '../teamVisibilityModel';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';
import type { PublicTeamRow } from '@/modules/profile/organiserTeam';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

afterEach(cleanup);

const ORG = 'org-1';
// People on the team. Each target appears in two states: shown (action = hide) and hidden (action = show).
const P = { owner: 'p-owner', owner2: 'p-owner2', manager: 'p-manager', manager2: 'p-manager2', listed: 'p-listed', me: 'p-me' };

type Caller = 'owner' | 'manager' | 'admin-seatless' | 'listed-self' | 'contributor-self' | 'contributor-stranger';
type Target = 'other owner' | 'other manager' | 'listed person' | 'self' | 'seat without persona';

const seat = (userId: string, role: TeamRole, personId: string | null, isSelf = false, displayName: string | null = null): TeamMember => ({
  userId, role, personId, isSelf, isPrimary: false, joinedAt: null, email: null, displayName: displayName ?? `Seat ${userId}`,
});
const pub = (person_id: string, public_name: string, sort_key: number): PublicTeamRow => ({ person_id, public_name, slug: null, avatar_url: null, sort_key });

/** The team as each caller sees it: the caller's own row is marked isSelf / is the "me" person. */
function teamFor(caller: Caller): { myRole: TeamRole | 'admin' | null; members: TeamMember[] } {
  const base = [
    seat('u-owner2', 'owner', P.owner2, false, 'Olga Owner'),
    seat('u-manager2', 'manager', P.manager2, false, 'Max Manager'),
    seat('u-nopersona', 'manager', null, false, 'No Persona'),
  ];
  switch (caller) {
    case 'owner': return { myRole: 'owner', members: [seat('u-me', 'owner', P.me, true, 'Me Myself'), ...base] };
    case 'manager': return { myRole: 'manager', members: [...base, seat('u-me', 'manager', P.me, true, 'Me Myself')] };
    case 'admin-seatless': return { myRole: 'admin', members: base };
    case 'listed-self': return { myRole: null, members: base };
    case 'contributor-self': return { myRole: 'contributor', members: [...base, seat('u-me', 'contributor', P.me, true, 'Me Myself')] };
    case 'contributor-stranger': return { myRole: 'contributor', members: [...base, seat('u-me', 'contributor', 'p-elsewhere', true, 'Me Myself')] };
  }
}

/** Who the caller is as a person, for the listed-self arm (no seat row carries isSelf). */
const isMeListed = (caller: Caller) => caller === 'listed-self' || caller === 'contributor-self';

const TARGET_ID: Record<Target, string | null> = {
  'other owner': P.owner2, 'other manager': P.manager2, 'listed person': P.listed, self: P.me, 'seat without persona': null,
};
const TARGET_NAME: Record<Target, string> = {
  'other owner': 'Olga Owner', 'other manager': 'Max Manager', 'listed person': 'Lia Listed', self: 'Me Myself', 'seat without persona': 'No Persona',
};

// Independent truth table (RPC: owner -> anyone; manager -> not an owner; self arm; else refused).
const MAY: Record<Caller, Record<Target, boolean>> = {
  owner: { 'other owner': true, 'other manager': true, 'listed person': true, self: true, 'seat without persona': false },
  manager: { 'other owner': false, 'other manager': true, 'listed person': true, self: true, 'seat without persona': false },
  'admin-seatless': { 'other owner': false, 'other manager': false, 'listed person': false, self: false, 'seat without persona': false },
  'listed-self': { 'other owner': false, 'other manager': false, 'listed person': false, self: true, 'seat without persona': false },
  'contributor-self': { 'other owner': false, 'other manager': false, 'listed person': false, self: true, 'seat without persona': false },
  'contributor-stranger': { 'other owner': false, 'other manager': false, 'listed person': false, self: false, 'seat without persona': false },
};

function setup(caller: Caller, hiddenIds: string[], opts: { hiddenFails?: boolean; setHidden?: (organiserId: string, personId: string, hidden: boolean) => Promise<unknown> } = {}) {
  const team = teamFor(caller);
  // The public read never carries a hidden person (organiser_public_team_v1 honours hides).
  const allPublic = [pub(P.owner2, 'Olga Owner', 1), pub(P.manager2, 'Max Manager', 2), pub(P.listed, 'Lia Listed', 3)];
  if (caller === 'owner' || caller === 'manager' || isMeListed(caller)) allPublic.push(pub(P.me, 'Me Myself', caller === 'owner' ? 0 : 4));
  const publicRows = allPublic.filter((r) => !hiddenIds.includes(r.person_id));
  const names = new Map([[P.listed, 'Lia Listed'], [P.me, 'Me Myself']]);
  const fetchPublic = vi.fn(async () => publicRows);
  const fetchHidden = vi.fn(async () => { if (opts.hiddenFails) throw new Error('boom'); return new Set(hiddenIds); });
  const fetchNames = vi.fn(async (ids: string[]) => new Map(ids.filter((i) => names.has(i)).map((i) => [i, names.get(i) as string])));
  const setHidden = vi.fn(opts.setHidden ?? (async (_o: string, _p: string, _h: boolean): Promise<unknown> => ({ ok: true })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const members = team.members;
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <TeamVisibilitySheet organiserId={ORG} myRole={team.myRole} members={members} onClose={() => {}}
        fetchPublic={fetchPublic} fetchHidden={fetchHidden} fetchNames={fetchNames} setHidden={setHidden} />
    </QueryClientProvider>,
  );
  return { setHidden, invalidate, fetchHidden };
}

async function rowFor(name: string) {
  const list = await screen.findByTestId('eip-vis-list');
  const row = within(list).getAllByTestId('eip-vis-row').find((r) => r.textContent?.startsWith(name));
  expect(row, `row for ${name}`).toBeTruthy();
  return row as HTMLElement;
}

// listed-self has no seat, so the sheet cannot tell which person is "me" from organiser_team_v1; the
// self arm for a seatless listed person is unreachable from the edit layer (it mounts on canEdit only).
// It stays in the table as a documented "no control" until a caller-person read exists.
const CALLERS: Caller[] = ['owner', 'manager', 'admin-seatless', 'contributor-self', 'contributor-stranger'];
const TARGETS: Target[] = ['other owner', 'other manager', 'listed person', 'self', 'seat without persona'];
const ACTIONS = ['hide', 'show'] as const;

const cells: Array<[Caller, Target, 'hide' | 'show', boolean]> = [];
for (const c of CALLERS) for (const t of TARGETS) for (const a of ACTIONS) {
  if (t === 'seat without persona' && a === 'show') continue; // a person with no persona cannot be hidden
  if (t === 'self' && c === 'admin-seatless') continue; // a seatless admin is not on the team
  if (t === 'self' && c === 'contributor-stranger') continue; // their persona is not on this team
  cells.push([c, t, a, MAY[c][t]]);
}

describe('Team sheet: caller x target x action -> a control or none', () => {
  it.each(cells)('%s on %s (%s): control %s', async (caller, target, action, may) => {
    const pid = TARGET_ID[target];
    const { setHidden, invalidate } = setup(caller, action === 'show' && pid ? [pid] : []);
    const row = await rowFor(TARGET_NAME[target]);
    const status = within(row).getByTestId('eip-vis-status').textContent;
    expect(status).toBe(pid === null ? VISIBILITY_COPY.noPersona : action === 'show' ? VISIBILITY_COPY.hidden : VISIBILITY_COPY.shown);
    const button = within(row).queryByTestId('eip-vis-action');
    if (!may) { expect(button).toBeNull(); return; }
    expect(button?.textContent).toBe(action === 'hide' ? VISIBILITY_COPY.hide : VISIBILITY_COPY.show);
    expect(button?.getAttribute('aria-label')).toBe(action === 'hide' ? `Hide ${TARGET_NAME[target]} from the public page` : `Show ${TARGET_NAME[target]} on the public page`);
    fireEvent.click(button as HTMLElement);
    await waitFor(() => expect(setHidden).toHaveBeenCalledWith(ORG, pid, action === 'hide'));
    // Both reads are refreshed together after the call.
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([f]) => JSON.stringify((f as { queryKey: unknown }).queryKey));
      expect(keys).toEqual(expect.arrayContaining([JSON.stringify(['organiser-team-hidden', ORG]), JSON.stringify(['organiser-public-team', ORG])]));
    });
  });

  it('covers every caller and target (no silent gap in the table)', () => {
    expect(new Set(cells.map((c) => c[0])).size).toBe(CALLERS.length);
    expect(new Set(cells.map((c) => c[1])).size).toBe(TARGETS.length);
    expect(cells.length).toBeGreaterThanOrEqual(35);
  });
});

describe('Team sheet: states', () => {
  it.each(CALLERS)('%s: hidden read fails -> the line, Try again, and NO controls', async (caller) => {
    setup(caller, [], { hiddenFails: true });
    const alert = await screen.findByTestId('eip-vis-hidden-error');
    expect(alert.textContent).toContain(VISIBILITY_COPY.hiddenReadError);
    expect(within(alert).getByRole('button', { name: VISIBILITY_COPY.retry })).toBeTruthy();
    expect(screen.queryAllByTestId('eip-vis-action')).toHaveLength(0);
    expect(screen.queryByTestId('eip-vis-list')).toBeNull();
  });

  it('a hidden listed person is still a row (named by the name read), at the end, with Show', async () => {
    setup('owner', [P.listed]);
    const rows = (await screen.findAllByTestId('eip-vis-row')).map((r) => r.getAttribute('data-person'));
    expect(rows[rows.length - 1]).toBe(P.listed);
    const row = await rowFor('Lia Listed');
    expect(within(row).getByTestId('eip-vis-action').textContent).toBe(VISIBILITY_COPY.show);
  });

  it('order: owners, managers, then listed; each person once', async () => {
    setup('owner', []);
    const ids = (await screen.findAllByTestId('eip-vis-row')).map((r) => r.getAttribute('data-person'));
    expect(ids).toEqual([P.me, P.owner2, P.manager2, '', P.listed]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a manager is refused (owner_protected) -> the plain reason under that row, reads refreshed', async () => {
    const err = Object.assign(new Error('owner_protected'), { message: 'owner_protected', hint: 'x' });
    const setHidden = vi.fn(async () => { throw err; });
    const { invalidate } = setup('owner', [], { setHidden });
    const row = await rowFor('Olga Owner');
    fireEvent.click(within(row).getByTestId('eip-vis-action'));
    expect((await within(row).findByTestId('eip-vis-row-error')).textContent).toBe('Only an owner can hide or show an owner.');
    expect(invalidate).toHaveBeenCalled();
  });
});

describe('who gets "Who shows on your page" (lead decision: owner, admin, manager, self arm; never wider)', () => {
  const on = new Set(['p-me']);
  it.each([
    ['owner', 'p-x', true],
    ['admin', null, true],
    ['manager', 'p-x', true],
    ['contributor', 'p-me', true], // self arm: their own person is on the public Team
    ['contributor', 'p-x', false],
    ['contributor', null, false],
    [null, 'p-me', true], // self arm (listed only)
    [null, null, false],
  ] as const)('role %s, person %s -> %s', (myRole, callerPersonId, want) => {
    expect(visibilityAccess({ myRole, callerPersonId, onTeamIds: on })).toBe(want);
  });
});

describe('status says what the public read says (prod: 60 seats, page may be a draft)', () => {
  const m = (role: TeamRole, personId: string | null, isSelf = false): TeamMember => ({ userId: `u-${personId}`, role, personId, isSelf, isPrimary: false, joinedAt: null, email: null, displayName: `N ${personId}` });
  it.each([
    ['seat in the public read', ['p-a'], [], VISIBILITY_COPY.shown, 'hide'],
    ['seat missing from the public read (draft page / archived profile), not hidden', [], [], VISIBILITY_COPY.notShown, 'hide'],
    ['seat hidden', [], ['p-a'], VISIBILITY_COPY.hidden, 'show'],
  ] as const)('%s', (_n, pub, hid, status, action) => {
    const rows = visibilityRows({ myRole: 'owner', members: [m('owner', 'p-me', true), m('manager', 'p-a')], publicRows: pub.map((id, i) => ({ person_id: id, public_name: 'A', slug: null, avatar_url: null, sort_key: i + 1 })), hidden: new Set(hid) });
    const row = rows.find((r) => r.personId === 'p-a');
    expect(row?.status).toBe(status);
    expect(row?.action).toBe(action);
  });
});
