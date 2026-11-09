/**
 * Organiser area v2 slice 1b (R1, R2; OPEN:7 and OPEN:11 decided): the ONE Team roles list
 * while P3 is live. Owner, Manager and Door only -- no contributor, no helper or interim seat.
 * Door is the per-event door role (Q25): never shown with sales or money. The database has
 * no door seat yet (entity_members.member_role = owner | manager | contributor | ambassador,
 * read on prod 2026-11-09), so Door is listed but cannot be added, and says why.
 */
import type { AddRole } from './teamPickerModel';

export type TeamRoleKey = 'owner' | 'manager' | 'door';

export interface TeamRoleEntry {
  key: TeamRoleKey;
  label: string;
  /** What the role can do, in one line. */
  can: string;
  /** null = can be added from the picker; otherwise the reason it cannot. */
  notAddable: string | null;
}

export const DOOR_NOT_OPEN = 'Door seats are not open yet. Add the person as a manager for now, or check them in yourself.';

/** The grep token the brief names: the Door entry of the Team roles list. */
export const teamRoleDoor: TeamRoleEntry = {
  key: 'door',
  label: 'Door',
  can: 'Checks people in at one event. Never sees sales or money.',
  notAddable: DOOR_NOT_OPEN,
};

export const TEAM_ROLES: readonly TeamRoleEntry[] = [
  { key: 'owner', label: 'Owner', can: 'Runs the page: the team, the money and handing the page over.', notAddable: 'A page has one owner. The owner hands the page over from the team list.' },
  { key: 'manager', label: 'Manager', can: 'Edits the page and every event. Cannot remove people or hand the page over.', notAddable: null },
  teamRoleDoor,
];

/** The roles the picker can add while P3 is live: the addable entries of TEAM_ROLES. */
export const P3_ADD_ROLES: readonly AddRole[] = TEAM_ROLES.filter((r) => r.notAddable === null).map((r) => r.key as AddRole);

/** The P3 role help line under the picker: built from TEAM_ROLES, no contributor word. */
export const P3_ROLE_HELP = `${TEAM_ROLES.map((r) => `${r.label}: ${r.can}`).join(' ')}`;

/** The P3 Team card's count line: owners and managers only (a contributor seat is not a P3 role; prod has none). */
export function p3TeamCountLine(counts: { owner: number; manager: number }): string {
  const parts: string[] = [];
  const say = (n: number, one: string) => { if (n > 0) parts.push(`${n} ${one}${n === 1 ? '' : 's'}`); };
  say(counts.owner, 'owner');
  say(counts.manager, 'manager');
  return parts.length === 0 ? 'No one is on the team yet. Add a person to share the work.' : `On the team: ${parts.join(', ')}.`;
}
