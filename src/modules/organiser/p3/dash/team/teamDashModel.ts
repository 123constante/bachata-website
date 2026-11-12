// Organiser dashboard, Team tab (admin #1535, Option B: grouped by role). Pure, client-free.
// ONE place that turns the two team reads (organiser_team_v1 seats + organiser_team_shared_v1 public
// state) into what the screen draws, so every screen x shape reads the same facts. Built ONLY on
// RPCs that exist today; invite by email, a "waiting invites" read and role wording that needs an ACL
// decision are NOT here (see NEEDS_ADMIN_WORK).
import { TEAM_ROLES, TEAM_CAP, TEAM_FULL_REASON, memberLabel, type TeamMember, type TeamRole } from '@/modules/organiser/shared/teamModel';
import { LAST_OWNER_NOTE } from '@/modules/organiser/shared/teamModel';
import { NO_OWNER_REASON, canLeave, canManagePeople, canRemove, hasOwner, ownRowLabel } from '@/modules/organiser/shared/teamRules';
import { rowSwitch, OFF_REASON, SHARED_READ_FAILED, type SharedTeamRow } from '@/modules/organiser/team/teamShared';
import type { TeamSeat } from '@/modules/organiser/edit-in-place/teamHide';

export type TeamLoad = 'loading' | 'error' | 'nopage' | 'ready';
export const ROLES: readonly TeamRole[] = ['owner', 'manager', 'contributor'];
export const GROUP_TITLE: Record<TeamRole, string> = { owner: 'Owners', manager: 'Managers', contributor: 'Contributors' };
/** One plain line per role. Owner and Manager come from the ONE roles list (teamRoles); the contributor line is draft until the ACL decision. */
export const ROLE_LINE: Record<TeamRole, string> = {
  owner: TEAM_ROLES[0].can,
  manager: TEAM_ROLES[1].can,
  contributor: 'Can look at events, tickets and the team, but cannot change anything.',
};
export const FOLD_AFTER = 5;
export const FOLD_SHOWN = 4;

/** Each thing the design draws that has no RPC today, said once (also listed in the PR body). */
export const NEEDS_ADMIN_WORK = {
  email: 'Invite by email is not ready yet. Share a link instead.',
  waiting: 'Waiting invites need a read the database does not have yet.',
  rolePick: 'Choosing a role while adding needs an admin change. People are added as managers for now.',
} as const;

export interface Control { label: string; disabled: boolean; reason: string | null; /** Show the Message us link after the reason. */ messageUs?: boolean }

export interface PersonView {
  key: string;
  name: string;
  role: TeamRole | 'listed';
  userId: string | null;
  personId: string | null;
  email: string | null;
  photoUrl: string | null;
  isSelf: boolean;
  /** "Interim manager" on the caller's own row when they hold an interim seat; else null. */
  seatLabel: string | null;
  isStub: boolean;
  hidden: boolean;
  /** Public-page line under the name; null when the shared read failed (never a guess). */
  line: string | null;
  /** Opens the person sheet: owner/manager viewers only, never a roster-only name. */
  tappable: boolean;
  shared: SharedTeamRow | null;
}

export interface GroupView { role: TeamRole; title: string; can: string; count: number; rows: PersonView[]; folded: boolean; empty: string | null; add: Control | null }

export interface TeamDashModel {
  load: TeamLoad;
  viewOnly: boolean;
  solo: boolean;
  groups: GroupView[];
  /** Every seat holder, unfolded (the sheets look people up here). */
  people: PersonView[];
  /** On the public roster but with no seat: shown, not tappable, under their own heading. */
  listedOnly: PersonView[];
  add: Control | null;
  /** How Add behaves: open the sheet, or (interim managers) share the join link directly. */
  addVia: 'sheet' | 'share' | null;
  /** The shared read failed: rows have no public line. */
  readNote: string | null;
  publicNote: string;
  viewOnlyNote: string | null;
  viewOnlyMessageUs: boolean;
}

export const SEAT_UNKNOWN_REASON = 'Checking your seat on this page. Adding wakes up once that is done; if it stays off, reload.';

export interface TeamDashInput {
  load: TeamLoad;
  viewerRole: TeamRole;
  members: readonly TeamMember[];
  listed: readonly SharedTeamRow[] | null;
  /** Interim managers cannot add; they get the link only. */
  interim?: boolean;
  /** False while the seat read is pending or failed: Add stays disabled (never guess sheet vs share). Default true. */
  seatKnown?: boolean;
  openGroups?: ReadonlySet<TeamRole>;
}

const pageWord = (editor: boolean) => (editor ? 'your public page' : 'the public page');

/** Public-page line for one person (owner rule 2026-11-07), from the REAL shared row, never from the role alone. */
export function publicLine(shared: SharedTeamRow | null, editor: boolean): string | null {
  if (!shared) return null;
  const page = pageWord(editor);
  if (shared.isStub) return `Not claimed yet \u00b7 hidden from ${page} until they claim it`;
  if (shared.isPublic) return `Shown on ${page}`;
  if (shared.publicReason === 'hidden') return `Hidden from ${page}`;
  return OFF_REASON[shared.publicReason] ?? `Not shown on ${page}`;
}

const sharedFor = (m: TeamMember, listed: readonly SharedTeamRow[]): SharedTeamRow | null =>
  listed.find((r) => (m.personId && r.personId === m.personId) || (r.userId && r.userId === m.userId)) ?? null;

const roleOrder = (a: PersonView, b: PersonView) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name);

export function buildTeamDash(i: TeamDashInput): TeamDashModel {
  const editor = i.viewerRole === 'owner' || i.viewerRole === 'manager';
  const base = { viewOnly: !editor, solo: false, groups: [] as GroupView[], people: [] as PersonView[], listedOnly: [] as PersonView[], add: null as Control | null, addVia: null as TeamDashModel['addVia'], viewOnlyMessageUs: false, readNote: null as string | null, viewOnlyNote: null as string | null };
  const publicNote = editor
    ? 'Your public page lists owners and managers. Contributors show too unless you hide them. Someone who has not claimed their profile stays hidden until they do.'
    : 'The public page lists owners and managers. Contributors show unless an owner hides them. Someone who has not claimed their profile stays hidden until they do.';
  if (i.load !== 'ready') {
    return { ...base, load: i.load, publicNote, add: editor && i.load === 'loading' ? { label: 'Add a teammate', disabled: true, reason: 'Wakes up when your team loads.' } : null };
  }
  const listed = i.listed;
  const used = new Set<SharedTeamRow>();
  const people: PersonView[] = i.members.map((m) => {
    const shared = listed ? sharedFor(m, listed) : null;
    if (shared) used.add(shared);
    return {
      key: m.userId, name: memberLabel(m), role: m.role, userId: m.userId, personId: m.personId ?? shared?.personId ?? null,
      // Emails only reach an owner's browser; a contributor never gets one to mask.
      email: i.viewerRole === 'owner' ? m.email : null, photoUrl: m.photoUrl ?? shared?.avatarUrl ?? null, isSelf: m.isSelf, seatLabel: ownRowLabel(i.interim ? 'interim' : null, m.isSelf),
      isStub: shared?.isStub ?? false, hidden: !!shared && !shared.isPublic && shared.publicReason === 'hidden',
      line: publicLine(shared, editor), tappable: editor, shared,
    };
  });
  // Roster-only people (no seat): kept visible, never dropped, never given a role they do not hold.
  const listedOnly: PersonView[] = (listed ?? []).filter((r) => !used.has(r) && r.accessRole === 'none').map((r, n) => ({
    key: r.personId ?? r.userId ?? `listed-${n}`, name: r.name ?? 'A team member', role: 'listed' as const, userId: null, personId: r.personId, email: null,
    photoUrl: r.avatarUrl, isSelf: false, seatLabel: null, isStub: r.isStub, hidden: !r.isPublic && r.publicReason === 'hidden', line: publicLine(r, editor), tappable: false, shared: r,
  }));
  const full = i.members.length >= TEAM_CAP;
  const seatKnown = i.seatKnown ?? true;
  const add: Control | null = !editor ? null : !seatKnown ? { label: 'Add a teammate', disabled: true, reason: SEAT_UNKNOWN_REASON } : full ? { label: 'Add a teammate', disabled: true, reason: TEAM_FULL_REASON } : { label: 'Add a teammate', disabled: false, reason: null };
  const solo = i.members.length === 1 && editor;
  const groups: GroupView[] = ROLES.filter((r) => !(solo && r !== 'owner')).map((role) => {
    const rows = people.filter((p) => p.role === role).sort(roleOrder);
    const open = i.openGroups?.has(role) ?? false;
    const folded = rows.length > FOLD_AFTER && !open;
    const empty = rows.length > 0 ? null : !editor ? 'Nobody in this role.'
      : role === 'manager' ? 'No managers yet. A manager can run events and tickets with you.'
      : role === 'contributor' ? 'No contributors yet. A contributor can look but not change anything.' : null;
    // Only an empty Managers group offers its own Add (the add route adds managers); a contributor Add needs admin work.
    const groupAdd: Control | null = rows.length === 0 && editor && !i.interim && role === 'manager' ? { label: 'Add a manager', disabled: !!add?.disabled, reason: add?.reason ?? null } : null;
    return { role, title: GROUP_TITLE[role], can: ROLE_LINE[role], count: rows.length, rows: folded ? rows.slice(0, FOLD_SHOWN) : rows, folded, empty, add: groupAdd };
  });
  return {
    ...base, load: 'ready', solo, groups, people, listedOnly, add: editor && seatKnown && i.interim ? { label: 'Share a join link', disabled: false, reason: null } : add,
    addVia: editor && seatKnown ? (i.interim ? 'share' : 'sheet') : null, publicNote,
    readNote: listed ? null : SHARED_READ_FAILED,
    viewOnlyNote: editor ? null : hasOwner(i.members) ? 'You can see the team, but not change it. To add or remove someone, ask an owner.' : `You can see the team, but not change it. ${NO_OWNER_REASON('add or remove people')}`,
    viewOnlyMessageUs: !editor && !hasOwner(i.members),
  };
}

// ---- the person sheet --------------------------------------------------------

export interface SheetRole { role: TeamRole; selected: boolean; disabled: boolean; reason: string | null; messageUs?: boolean }
export interface PersonSheetModel {
  roles: SheetRole[];
  publicText: string;
  /** null = nothing to switch (owners/managers who show, stubs, no profile). */
  publicSwitch: { on: boolean; press: 'hide' | 'show' | null; reason: string | null } | null;
  remove: Control;
  /** The sole owner on their own sheet: the reason role and Leave are locked. */
  lastOwnerNote: string | null;
  leaveVia: 'remove' | 'more' | null;
  stubNote: string | null;
  /** Some reason on this sheet is one only the Bachata Calendar team can act on: offer Message us. */
  messageUs: boolean;
}

const firstName = (n: string) => n.split(' ')[0];

/** What the sheet may OFFER the viewer, from the same rules the RPCs enforce (teamRules, memberAction). */
export function buildPersonSheet(p: PersonView, viewerRole: TeamRole, members: readonly TeamMember[], me: { seat: TeamSeat; personId: string | null }): PersonSheetModel {
  const role = p.role === 'listed' ? 'contributor' : p.role;
  const owners = members.filter((m) => m.role === 'owner').length;
  const lastOwner = role === 'owner' && p.isSelf && owners <= 1;
  const hasEmail = !!p.email;
  // ONE mapping (teamRules): who may change roles or remove, and what to say on a page with no owner.
  const manage = canManagePeople(viewerRole, members);
  const target = members.find((m) => m.userId === p.userId);
  const roles: SheetRole[] = ROLES.map((r) => {
    const selected = r === role;
    if (selected) return { role: r, selected, disabled: false, reason: null };
    if (!manage.ok) return { role: r, selected, disabled: true, reason: manage.reason, messageUs: manage.messageUs };
    if (role === 'owner') return { role: r, selected, disabled: true, reason: lastOwner ? LAST_OWNER_NOTE : 'Only the owner themselves can change an owner role.' };
    if (r === 'owner') return { role: r, selected, disabled: true, reason: 'To make someone the owner, hand the page over.' };
    if (!hasEmail) return { role: r, selected, disabled: true, reason: 'We could not read their email, so their role cannot be changed here.' };
    return { role: r, selected, disabled: false, reason: null };
  });
  const sw = p.shared && !p.isStub ? rowSwitch(p.shared, me) : null;
  const publicSwitch = sw && (sw.press !== null || !p.shared?.isPublic) ? sw : null;
  const publicText = p.isStub ? `Hidden until ${firstName(p.name)} claims their profile. Nothing to switch yet.`
    : p.line ?? 'We could not check this just now.';
  let remove: Control;
  let leaveVia: PersonSheetModel['leaveVia'] = null;
  if (p.isSelf) {
    if (lastOwner) remove = { label: 'Leave the team', disabled: true, reason: LAST_OWNER_NOTE };
    else if (role === 'owner') { remove = { label: 'Leave the team', disabled: false, reason: null }; leaveVia = 'more'; }
    else {
      const gate = canLeave(members);
      if (gate?.ok) { remove = { label: 'Leave the team', disabled: false, reason: null }; leaveVia = 'remove'; }
      else remove = { label: 'Leave the team', disabled: true, reason: gate?.reason ?? null, messageUs: gate?.messageUs };
    }
  } else if (!manage.ok) {
    remove = { label: 'Remove from team', disabled: true, reason: manage.reason, messageUs: manage.messageUs };
  } else if (role === 'owner') {
    remove = { label: 'Remove from team', disabled: true, reason: `Owners cannot remove another owner. ${firstName(p.name)} can leave from their own Team tab.` };
  } else {
    const gate = target ? canRemove(viewerRole, members, target) : null;
    if (gate && !gate.ok) remove = { label: 'Remove from team', disabled: true, reason: gate.reason, messageUs: gate.messageUs };
    else { remove = { label: 'Remove from team', disabled: false, reason: null }; leaveVia = 'remove'; }
  }
  return {
    roles, publicText, publicSwitch, remove, leaveVia,
    messageUs: roles.some((r) => r.messageUs) || !!remove.messageUs,
    lastOwnerNote: lastOwner ? 'Role stays Owner while there is only one owner.' : null,
    stubNote: p.isStub ? `${p.name} has not claimed their profile yet. They can still be on your team; the public page waits until they claim it.` : null,
  };
}

/** What the person loses on removal, by role (design `loses()`). */
export function removalLoses(role: TeamRole, hidden: boolean): string[] {
  const base = role === 'owner' ? ['Everything on this page: events, tickets, the page and the team']
    : role === 'manager' ? ['Editing events, tickets and the page', 'Adding people']
    : ['Seeing this page and its team'];
  return role === 'contributor' && hidden ? base : [...base, 'Their place under Team on your public page'];
}
