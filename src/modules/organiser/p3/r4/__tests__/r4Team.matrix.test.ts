import { describe, expect, it } from 'vitest';
import { TEAM_CAP, TEAM_FULL_REASON, type IncomingAccessRequest, type TeamMember, type TeamRole } from '@/modules/organiser/shared/teamModel';
import { ROLE_LINE } from '../../dash/team/teamDashModel';
import { R4_ADD_COPY, R4_ADD_ROLES, buildR4Team, r4AddButton } from '../r4TeamModel';

// Prod survey 2026-11-18 (entity_members, organiser pages; counts only): 30 pages 0 owners + 1 manager,
// 10 pages 1 owner + 1 manager, 6 pages 1 owner alone, 2 pages 2 owners + 1 manager, 1 page 3 owners + 1 manager.
// No contributor seats on prod (one synthetic case below keeps the group honest). 3 join requests open.
type Seat = { role: TeamRole; self?: boolean };
const team = (seats: Seat[]): TeamMember[] => seats.map((s, n) => ({
  userId: `u${n}`, personId: `p${n}`, role: s.role, isPrimary: n === 0, joinedAt: null, isSelf: !!s.self, email: `u${n}@x.test`, displayName: `Person ${String.fromCharCode(65 + n)}`,
}));
const req = (n: number): IncomingAccessRequest => ({ requestId: `r${n}`, userId: `ru${n}`, requesterEmail: n === 2 ? null : `asker${n}@x.test`, message: null, createdAt: '2026-11-17T10:00:00Z' });

const SHAPES: Record<string, Seat[]> = {
  'no owner, 1 manager (30 pages)': [{ role: 'manager', self: true }],
  'owner + manager (10 pages)': [{ role: 'owner', self: true }, { role: 'manager' }],
  'owner alone (6 pages)': [{ role: 'owner', self: true }],
  '2 owners + manager (2 pages)': [{ role: 'owner' }, { role: 'owner', self: true }, { role: 'manager' }],
  '3 owners + manager (1 page)': [{ role: 'owner' }, { role: 'owner' }, { role: 'owner', self: true }, { role: 'manager' }],
  'synthetic: contributor seat': [{ role: 'owner' }, { role: 'contributor', self: true }],
};

const viewerOf = (seats: Seat[]): TeamRole => seats.find((s) => s.self)!.role;

describe('R4 Team: every prod shape draws one section per role held, in board order, with real people only', () => {
  it.each(Object.entries(SHAPES))('%s', (_n, seats) => {
    const members = team(seats);
    const viewerRole = viewerOf(seats);
    const m = buildR4Team({ load: 'ready', viewerRole, members, listed: [], requests: [req(1), req(2)] });
    const want = (['owner', 'manager', 'contributor'] as const).filter((r) => seats.some((s) => s.role === r));
    expect(m.groups.map((g) => g.role)).toEqual(want);
    for (const g of m.groups) {
      expect(g.line).toBe(ROLE_LINE[g.role]);
      expect(g.rows.length).toBe(seats.filter((s) => s.role === g.role).length);
    }
    const rows = m.groups.flatMap((g) => g.rows);
    // "You" only on the caller's own row, and it comes first in its group.
    expect(rows.filter((r) => r.end === 'You').length).toBe(1);
    const mine = m.groups.find((g) => g.role === viewerRole)!;
    expect(mine.rows[0].end).toBe('You');
    const editor = viewerRole !== 'contributor';
    // Rows open the person screen for owners / managers only; a contributor sees names, nothing to tap.
    expect(rows.every((r) => (editor ? r.userId !== null : r.userId === null))).toBe(true);
    // Add: owners and managers get the orange button; a contributor gets none and a view-only line.
    expect(m.add?.disabled ?? null).toBe(editor ? false : null);
    expect(m.viewOnlyNote === null).toBe(editor);
    // Waiting to join: the real requests, for the people who can answer them.
    expect(m.waiting.map((w) => w.name)).toEqual(editor ? ['asker1@x.test', 'Someone'] : []);
    expect(m.waiting.every((w) => w.word === 'Asked to join')).toBe(true);
  });

  it('no requests: no Waiting section rows (Invited rows come from r4InvitedModel, not here)', () => {
    const m = buildR4Team({ load: 'ready', viewerRole: 'owner', members: team(SHAPES['owner alone (6 pages)']), listed: [], requests: [] });
    expect(m.waiting).toEqual([]);
  });

  it('interim manager: Add shares the join link, never opens the add sheet', () => {
    const m = buildR4Team({ load: 'ready', viewerRole: 'manager', members: team(SHAPES['no owner, 1 manager (30 pages)']), listed: [], requests: [], interim: true });
    expect(m.addVia).toBe('share');
    expect(m.groups[0].rows[0].end).toBe('Interim manager');
  });

  it('seat read failed: Add off with what happened and a retry', () => {
    const m = buildR4Team({ load: 'ready', viewerRole: 'owner', members: team(SHAPES['owner + manager (10 pages)']), listed: [], requests: [], seatKnown: false, seatFailed: true });
    expect(m.add).toMatchObject({ disabled: true, retry: true });
    expect(m.add?.reason).toBeTruthy();
  });

  it('full team: Add off with the full reason', () => {
    const seats: Seat[] = [{ role: 'owner', self: true }, ...Array.from({ length: TEAM_CAP - 1 }, () => ({ role: 'manager' as const }))];
    const m = buildR4Team({ load: 'ready', viewerRole: 'owner', members: team(seats), listed: [], requests: [] });
    expect(m.add).toMatchObject({ disabled: true, reason: TEAM_FULL_REASON });
  });

  it('shared read failed: rows still drawn from seats, with the read note', () => {
    const m = buildR4Team({ load: 'ready', viewerRole: 'owner', members: team(SHAPES['owner + manager (10 pages)']), listed: null, requests: [] });
    expect(m.groups.flatMap((g) => g.rows).length).toBe(2);
    expect(m.readNote).toBeTruthy();
  });

  it.each(['loading', 'error', 'nopage'] as const)('%s: no groups, no waiting rows', (load) => {
    const m = buildR4Team({ load, viewerRole: 'owner', members: [], listed: null, requests: [req(1)] });
    expect(m.groups).toEqual([]);
    expect(m.waiting).toEqual([]);
  });
});

describe('R4 Add a teammate: chips are exactly what the add command takes; Add to team says why it is off', () => {
  it('roles: Manager and Contributor only (no door seat on a team)', () => {
    expect(R4_ADD_ROLES).toEqual(['manager', 'contributor']);
  });
  it.each([
    [{ picked: false, full: false, pending: false }, true, R4_ADD_COPY.pickFirst],
    [{ picked: true, full: false, pending: false }, false, null],
    [{ picked: true, full: false, pending: true }, true, null],
    [{ picked: true, full: true, pending: false }, true, TEAM_FULL_REASON],
    [{ picked: false, full: true, pending: false }, true, TEAM_FULL_REASON],
  ])('%o', (s, disabled, reason) => {
    expect(r4AddButton(s)).toEqual({ disabled, reason });
  });
  it('done line names the role picked', () => {
    expect(R4_ADD_COPY.done('Maya Cole', 'contributor')).toBe('Maya C. is now a Contributor.');
    expect(R4_ADD_COPY.done('Maya Cole', 'manager')).toBe('Maya C. is now a Manager.');
  });
});
