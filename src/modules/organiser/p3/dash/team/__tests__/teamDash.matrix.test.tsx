// @vitest-environment jsdom
// Table-driven: every Team shape (design: solo, two, huge, stub, lastowner, contributor, loading, error)
// x what the screen shows. Shapes mirror the prod survey (docs/design/profile-dash/organiser-team.md).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';
import type { SharedTeamRow } from '@/modules/organiser/team/teamShared';
import { buildPersonSheet, buildTeamDash, removalLoses, type TeamDashInput, type TeamLoad } from '../teamDashModel';
import { TeamDashView } from '../TeamDashView';

const mem = (n: string, role: TeamRole, o: Partial<TeamMember> = {}): TeamMember => ({
  userId: `u-${n}`, personId: `p-${n}`, role, isPrimary: false, joinedAt: null, isSelf: false, email: `${n}@example.com`, displayName: `${n} Sample`, ...o,
});
const sh = (m: TeamMember, o: Partial<SharedTeamRow> = {}): SharedTeamRow => ({
  personId: m.personId ?? null, userId: m.userId, slug: null, name: m.displayName ?? null, avatarUrl: null, accessRole: m.role, isStub: false, isPublic: true, publicReason: 'public', sortKey: 1, ...o,
});
const me = mem('Sam', 'owner', { isSelf: true });
const ben = mem('Ben', 'manager');
const cara = mem('Cara', 'contributor');
const eli = mem('Eli', 'contributor');
const fay = mem('Fay', 'contributor');
const many = Array.from({ length: 7 }, (_, i) => mem(`C${i}`, 'contributor'));

interface Shape { name: string; input: TeamDashInput; groups: Record<TeamRole, number> | null; solo?: boolean; viewOnly?: boolean; addDisabled?: boolean }
const rd = (viewerRole: TeamRole, members: TeamMember[], extra: Partial<SharedTeamRow>[] = [], load: TeamLoad = 'ready'): TeamDashInput => ({
  load, viewerRole, members, listed: members.map((m, i) => sh(m, extra[i] ?? {})),
});
const SHAPES: Shape[] = [
  { name: 'solo', input: rd('owner', [me]), groups: { owner: 1, manager: 0, contributor: 0 }, solo: true },
  { name: 'two', input: rd('owner', [me, ben, cara]), groups: { owner: 1, manager: 1, contributor: 1 } },
  { name: 'huge', input: rd('owner', [me, mem('Olu', 'owner'), ben, mem('Mia', 'manager'), ...many]), groups: { owner: 2, manager: 2, contributor: 7 } },
  { name: 'stub', input: rd('owner', [me, ben, eli], [{}, {}, { isStub: true, isPublic: false, publicReason: 'stub' }]), groups: { owner: 1, manager: 1, contributor: 1 } },
  { name: 'hidden contributor', input: rd('owner', [me, fay], [{}, { isPublic: false, publicReason: 'hidden' }]), groups: { owner: 1, manager: 0, contributor: 1 } },
  { name: 'contributor viewer', input: rd('contributor', [mem('Sam', 'owner'), ben, { ...cara, isSelf: true }]), groups: { owner: 1, manager: 1, contributor: 1 }, viewOnly: true },
  { name: 'full team', input: rd('owner', [me, ...Array.from({ length: 19 }, (_, i) => mem(`F${i}`, 'manager'))]), groups: { owner: 1, manager: 19, contributor: 0 }, addDisabled: true },
  { name: 'loading', input: { load: 'loading', viewerRole: 'owner', members: [], listed: null }, groups: null },
  { name: 'error', input: { load: 'error', viewerRole: 'owner', members: [], listed: null }, groups: null },
];

const actions = { onRetry: vi.fn(), onOpenMore: vi.fn(), onChangeRole: vi.fn().mockResolvedValue(undefined), onSetHidden: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined), onShareLink: vi.fn().mockResolvedValue(undefined) };
const mount = (input: TeamDashInput) => {
  const model = buildTeamDash(input);
  const me0 = input.members.find((m) => m.isSelf);
  render(<MemoryRouter><TeamDashView model={model} people={model.people} sheetFor={(p) => buildPersonSheet(p, input.viewerRole, input.members, { seat: input.viewerRole, personId: me0?.personId ?? null })} actions={actions} addTo="/add" moreTo="/more" /></MemoryRouter>);
  return model;
};
afterEach(cleanup);

describe('Team dash: shape x screen', () => {
  for (const s of SHAPES) {
    describe(s.name, () => {
      it('model groups, counts and the add control', () => {
        const m = buildTeamDash(s.input);
        if (!s.groups) { expect(m.groups).toHaveLength(0); return; }
        expect(m.solo).toBe(!!s.solo);
        expect(m.viewOnly).toBe(!!s.viewOnly);
        for (const g of m.groups) expect(g.count).toBe(s.groups[g.role]);
        if (s.viewOnly) expect(m.add).toBeNull();
        else expect(m.add?.disabled).toBe(!!s.addDisabled);
        if (m.add?.disabled) expect(m.add.reason).toBeTruthy();
      });
      it('renders: no button without a reason, no email, no copy pointing at a missing control', () => {
        mount(s.input);
        const root = document.body;
        expect(root.textContent).not.toMatch(/@example\.com/);
        expect(root.textContent).not.toMatch(/Tap Add a teammate below/);
        for (const b of root.querySelectorAll('button[disabled]')) {
          const d = b.getAttribute('aria-describedby');
          expect(d && document.getElementById(d), `disabled "${b.textContent}" has a reason`).toBeTruthy();
        }
        if (s.viewOnly) {
          expect(screen.queryByTestId('team-dash-add')).toBeNull();
          expect(screen.getByTestId('team-dash-viewonly')).toBeTruthy();
          expect(screen.queryByTestId('team-dash-publicnote')!.textContent).toMatch(/Contributors show unless an owner hides them/);
        } else if (s.input.load === 'ready') {
          expect(screen.getByTestId('team-dash-add')).toBeTruthy();
        }
        if (s.input.load === 'loading') expect(screen.getByTestId('team-dash-loading')).toBeTruthy();
        if (s.input.load === 'error') { fireEvent.click(screen.getByTestId('team-dash-retry')); expect(actions.onRetry).toHaveBeenCalled(); }
      });
    });
  }

  it('solo draws only the Owners group and the add button directly under the card', () => {
    mount(SHAPES[0].input);
    expect(screen.getByTestId('team-dash-solo')).toBeTruthy();
    expect(screen.queryByTestId('team-dash-group-manager')).toBeNull();
    expect(screen.getAllByTestId('team-dash-add')).toHaveLength(1);
  });

  it('huge folds contributors after 5 and Show all asks to open them', () => {
    mount(SHAPES[2].input);
    const g = screen.getByTestId('team-dash-group-contributor');
    expect(within(g).getAllByTestId('team-dash-row')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('team-dash-more-contributor'));
    expect(actions.onOpenMore).toHaveBeenCalledWith('contributor');
  });

  it('a stub says it is hidden until claimed and has no public switch', () => {
    const m = mount(SHAPES[3].input);
    const eliRow = m.people.find((p) => p.isStub)!;
    expect(eliRow.line).toMatch(/Not claimed yet .* until they claim it/);
    expect(buildPersonSheet(eliRow, 'owner', SHAPES[3].input.members, { seat: 'owner', personId: 'p-Sam' }).publicSwitch).toBeNull();
  });

  it('last owner: role locked, Leave disabled with the reason', () => {
    const s = buildPersonSheet(buildTeamDash(SHAPES[1].input).people.find((p) => p.isSelf)!, 'owner', SHAPES[1].input.members, { seat: 'owner', personId: 'p-Sam' });
    expect(s.remove.disabled).toBe(true);
    expect(s.remove.reason).toMatch(/only owner/);
    expect(s.roles.filter((r) => !r.selected).every((r) => r.disabled && r.reason)).toBe(true);
  });

  it('another owner cannot be removed; a manager cannot manage anyone; a contributor cannot be removed (RPC says not_a_member)', () => {
    const two = [me, mem('Olu', 'owner'), ben, cara];
    const m = buildTeamDash(rd('owner', two));
    const by = (n: string) => m.people.find((p) => p.name.startsWith(n))!;
    const asOwner = (n: string) => buildPersonSheet(by(n), 'owner', two, { seat: 'owner', personId: 'p-Sam' });
    expect(asOwner('Olu').remove.disabled).toBe(true);
    expect(asOwner('Cara').remove.disabled).toBe(true);
    expect(asOwner('Ben').remove.disabled).toBe(false);
    expect(asOwner('Ben').roles.find((r) => r.role === 'contributor')!.disabled).toBe(false);
    expect(asOwner('Ben').roles.find((r) => r.role === 'owner')!.disabled).toBe(true);
    const asManager = buildPersonSheet(by('Cara'), 'manager', two, { seat: 'manager', personId: 'p-Ben' });
    expect(asManager.remove.disabled).toBe(true);
    expect(asManager.roles.filter((r) => !r.selected).every((r) => r.disabled)).toBe(true);
  });

  it('leaving: an owner goes through More, a manager removes themself, the last manager cannot', () => {
    const team = [{ ...me, isSelf: false }, { ...ben, isSelf: true }];
    const m = buildTeamDash({ ...rd('manager', team) });
    expect(buildPersonSheet(m.people.find((p) => p.isSelf)!, 'manager', team, { seat: 'manager', personId: 'p-Ben' }).leaveVia).toBe('remove');
    const t2 = [me, mem('Olu', 'owner')];
    const m2 = buildTeamDash(rd('owner', t2));
    expect(buildPersonSheet(m2.people.find((p) => p.isSelf)!, 'owner', t2, { seat: 'owner', personId: 'p-Sam' }).leaveVia).toBe('more');
    const t3 = [{ ...ben, isSelf: true }];
    const m3 = buildTeamDash(rd('manager', t3));
    expect(buildPersonSheet(m3.people[0], 'manager', t3, { seat: 'manager', personId: 'p-Ben' }).remove.disabled).toBe(true);
  });

  it('roster-only people stay visible and not tappable; a failed shared read says so and never invents public lines', () => {
    const m = buildTeamDash({ load: 'ready', viewerRole: 'owner', members: [me], listed: [sh(me), { ...sh(me), personId: 'x', userId: null, name: 'Roster Only', accessRole: 'none' }] });
    expect(m.listedOnly.map((p) => p.name)).toEqual(['Roster Only']);
    expect(m.listedOnly[0].tappable).toBe(false);
    const f = buildTeamDash({ load: 'ready', viewerRole: 'owner', members: [me, ben], listed: null });
    expect(f.readNote).toBeTruthy();
    expect(f.people.every((p) => p.line === null)).toBe(true);
  });

  it('a contributor never receives an email and sees no Waiting group', () => {
    const m = buildTeamDash(SHAPES[5].input);
    expect(m.people.every((p) => p.email === null)).toBe(true);
    mount(SHAPES[5].input);
    expect(document.body.textContent).not.toMatch(/Waiting to join/);
  });

  it('the person sheet opens from a row, remove confirms and calls the command once', async () => {
    mount(SHAPES[1].input);
    fireEvent.click(screen.getByRole('button', { name: /Ben Sample, Manager/ }));
    fireEvent.click(await screen.findByTestId('team-dash-remove'));
    expect((await screen.findByTestId('team-dash-loses')).textContent).toMatch(/Editing events/);
    fireEvent.click(screen.getByTestId('team-dash-confirm-remove'));
    await vi.waitFor(() => expect(actions.onRemove).toHaveBeenCalledTimes(1));
  });

  it('the add sheet: Email is disabled with its reason, Link shares', async () => {
    mount(SHAPES[1].input);
    fireEvent.click(screen.getByTestId('team-dash-add'));
    const email = await screen.findByTestId('team-dash-tab-email');
    expect((email as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('team-dash-email-why').textContent).toMatch(/not ready/);
    fireEvent.click(screen.getByTestId('team-dash-tab-link'));
    expect(actions.onShareLink).toHaveBeenCalled();
  });

  it('removal copy lists what each role loses', () => {
    expect(removalLoses('manager', false).join(' ')).toMatch(/Adding people/);
    expect(removalLoses('contributor', true)).toEqual(['Seeing this page and its team']);
  });
});
