// Edit in place: the Team sheet's "Who shows on your page" list (J7, scope 4/4a).
// Pure, client-free. Inputs: organiser_team_v1 (seats + the caller's role),
// organiser_public_team_v1 (who the public sees now), organiser_team_hidden_v1
// (who is hidden), and names for hidden people who are on neither of the other
// two reads. Whether a row gets a Hide / Show button is canSetHidden() and
// nothing else (the one rule, mirroring set_organiser_team_member_hidden_v1).
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';
import type { PublicTeamRow } from '@/modules/profile/organiserTeam';
import { canSetHidden, type TeamSeat } from './teamHide';

export const VISIBILITY_COPY = {
  open: 'Who shows on your page',
  title: 'Who shows on your page',
  close: 'Close',
  shown: 'Shown on the public page',
  hidden: 'Hidden from the public page',
  noPersona: 'No dancer profile, so not on the public page',
  notShown: 'Not on the public page right now',
  hide: 'Hide',
  show: 'Show',
  hiddenReadError: 'Couldn\u2019t check who is hidden. Try again',
  retry: 'Try again',
  teamReadError: 'Couldn\u2019t load the team. Try again',
  loading: 'Loading the team\u2026',
  empty: 'Nobody is on the team yet.',
  fallbackName: 'A team member',
} as const;

export type VisibilityAction = 'hide' | 'show';

export interface VisibilityRow {
  /** Stable React key: the person id, else the seat's account id. */
  key: string;
  personId: string | null;
  name: string;
  seat: 'owner' | 'manager' | null;
  isSelf: boolean;
  hidden: boolean;
  /** The one button this caller may press on this row; null = no control. */
  action: VisibilityAction | null;
  status: string;
}

export interface VisibilityInput {
  myRole: TeamRole | 'admin' | null | undefined;
  members: readonly TeamMember[];
  publicRows: readonly PublicTeamRow[];
  hidden: ReadonlySet<string>;
  /** Names for hidden people who are on no seat and no public row (dancer_profiles). */
  names?: ReadonlyMap<string, string>;
}

const clean = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** The caller's seat on THIS organiser; a seatless platform admin has none. */
export function callerSeatOf(myRole: TeamRole | 'admin' | null | undefined): TeamSeat {
  return myRole === 'owner' || myRole === 'manager' || myRole === 'contributor' ? myRole : null;
}

export function callerPersonIdOf(members: readonly TeamMember[]): string | null {
  return clean(members.find((m) => m.isSelf)?.personId ?? null);
}

/**
 * Who gets the Team card's "Who shows on your page" (lead decision, brief
 * p2-team-2): owner, admin, manager, and the self arm (the caller's own person
 * is on the team). Nobody else; never wider.
 */
export function visibilityAccess(input: { myRole: TeamRole | 'admin' | null | undefined; callerPersonId: string | null; onTeamIds: ReadonlySet<string> }): boolean {
  const r = input.myRole;
  if (r === 'owner' || r === 'admin' || r === 'manager') return true;
  return input.callerPersonId !== null && input.onTeamIds.has(input.callerPersonId);
}

/** Hidden ids that no seat and no public row names: these need a name read. */
export function unnamedHiddenIds(input: Pick<VisibilityInput, 'members' | 'publicRows' | 'hidden'>): string[] {
  const known = new Set<string>();
  // Owner/manager seats are rows of their own; a contributor seat is not (contributors are not on the public Team), so a hidden contributor who is also listed still needs its row here.
  for (const m of input.members) { const p = clean(m.personId ?? null); if (p && m.role !== 'contributor') known.add(p); }
  for (const r of input.publicRows) { const p = clean(r.person_id); if (p) known.add(p); }
  return [...input.hidden].filter((id) => !known.has(id)).sort();
}

/**
 * The sheet's rows: owners, then managers (organiser_team_v1 order), then
 * listed people in the public order (sort_key), then hidden listed people by
 * name. A person appears once. Contributors are not on the public Team, so
 * they are not rows (unless they are also listed).
 */
export function visibilityRows(input: VisibilityInput): VisibilityRow[] {
  const callerSeat = callerSeatOf(input.myRole);
  const callerPersonId = callerPersonIdOf(input.members);
  const publicById = new Map<string, PublicTeamRow>();
  for (const r of input.publicRows) {
    const pid = clean(r.person_id);
    if (!pid) continue;
    const prev = publicById.get(pid);
    if (!prev || r.sort_key < prev.sort_key) publicById.set(pid, r);
  }
  const seen = new Set<string>();
  const rows: VisibilityRow[] = [];
  const push = (personId: string | null, key: string, name: string, seat: 'owner' | 'manager' | null, isSelf: boolean) => {
    if (personId && seen.has(personId)) return;
    if (personId) seen.add(personId);
    const hidden = personId !== null && input.hidden.has(personId);
    const may = canSetHidden({ callerSeat, callerPersonId, target: { personId, isOwner: seat === 'owner' } });
    rows.push({
      key,
      personId,
      name,
      seat,
      isSelf,
      hidden,
      action: may ? (hidden ? 'show' : 'hide') : null,
      // "Shown" only when the public read really has them: a seat can be missing from it (draft page,
      // archived or non-public profile, no public name) without being hidden.
      status: personId === null ? VISIBILITY_COPY.noPersona : hidden ? VISIBILITY_COPY.hidden : publicById.has(personId) ? VISIBILITY_COPY.shown : VISIBILITY_COPY.notShown,
    });
  };
  const nameFor = (pid: string | null, fallback: string | null) =>
    (pid && clean(publicById.get(pid)?.public_name ?? null)) ?? clean(fallback) ?? (pid && clean(input.names?.get(pid) ?? null)) ?? VISIBILITY_COPY.fallbackName;

  // An owner who also holds a manager row is an owner (the RPC's owner_protected looks at any owner seat).
  const ownerIds = new Set(input.members.filter((m) => m.role === 'owner').map((m) => clean(m.personId ?? null)).filter((p): p is string => !!p));
  for (const role of ['owner', 'manager'] as const) {
    for (const m of input.members) {
      if (m.role !== role) continue;
      const pid = clean(m.personId ?? null);
      const seat = pid && ownerIds.has(pid) ? 'owner' : role;
      push(pid, pid ?? `seat:${m.userId}`, nameFor(pid, m.displayName), seat, m.isSelf);
    }
  }
  const listed = [...publicById.values()].sort((a, b) => a.sort_key - b.sort_key);
  for (const r of listed) {
    const pid = clean(r.person_id) as string;
    push(pid, pid, nameFor(pid, null), ownerIds.has(pid) ? 'owner' : null, pid === callerPersonId);
  }
  const hiddenOnly = unnamedHiddenIds(input)
    .map((pid) => ({ pid, name: nameFor(pid, input.members.find((m) => clean(m.personId ?? null) === pid)?.displayName ?? null) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.pid.localeCompare(b.pid));
  for (const h of hiddenOnly) push(h.pid, h.pid, h.name, null, h.pid === callerPersonId);
  return rows;
}

/** The button's spoken name: says who and what, so a list of "Hide" buttons is not ambiguous. */
export function actionAriaLabel(row: VisibilityRow): string {
  if (row.action === 'hide') return `Hide ${row.name} from the public page`;
  if (row.action === 'show') return `Show ${row.name} on the public page`;
  return '';
}
