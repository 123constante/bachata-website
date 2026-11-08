// Team restructure C: the shared team read (organiser_team_shared_v1) as ONE view model for the
// organiser Team screen. Pure, client-free. The public page reads organiser_public_team_v1, which
// is this same list filtered by is_public (admin `_organiser_team_rows_v1`), so there is one source.
import { canSetHidden, type TeamSeat } from '@/modules/organiser/edit-in-place/teamHide';

export type SharedAccessRole = 'owner' | 'manager' | 'contributor' | 'none';

export interface SharedTeamRow {
  personId: string | null;
  userId: string | null;
  slug: string | null;
  name: string | null;
  avatarUrl: string | null;
  accessRole: SharedAccessRole;
  isStub: boolean;
  isPublic: boolean;
  publicReason: string;
  sortKey: number;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Tolerant of new columns; a bad shape throws (a failed read is an error line, never "no team"). */
export function parseSharedTeam(raw: unknown): SharedTeamRow[] {
  if (!Array.isArray(raw)) throw new Error('team_shared_bad_shape');
  return raw.map((r) => {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o !== 'object' || typeof o.sort_key !== 'number' || typeof o.is_public !== 'boolean') throw new Error('team_shared_bad_shape');
    const role = o.access_role;
    return {
      personId: text(o.person_id),
      userId: text(o.user_id),
      slug: text(o.slug),
      name: text(o.public_name),
      avatarUrl: text(o.avatar_url),
      accessRole: role === 'owner' || role === 'manager' || role === 'contributor' ? role : 'none',
      isStub: o.is_stub === true,
      isPublic: o.is_public,
      publicReason: typeof o.public_reason === 'string' ? o.public_reason : '',
      sortKey: o.sort_key,
    };
  });
}

/** The ONE label mapping for a row (screen, tests). */
export const SHARED_ROLE_LABEL: Record<SharedAccessRole, string> = { owner: 'Owner', manager: 'Manager', contributor: 'Contributor', none: 'Listed' };

export const NOBODY_LISTED = 'Nobody is listed yet. Add someone below and they appear on your public page.';
export const SHARED_READ_FAILED = 'Couldn\u2019t check who shows on your public page. Reload to try again.';

/** Why a switch cannot move, in the organiser's words. */
export const OFF_REASON: Record<string, string> = {
  no_profile: 'No dancer profile, so not on the public page.',
  page_not_live: 'Your page is not live yet, so nobody shows on it.',
  not_visible: 'This profile is not visible, so not on the public page.',
  stub: 'This person has not set up a profile yet, so they do not show.',
  not_listed: 'Not listed on your public page.',
};
export const NO_RIGHTS_REASON = 'Only an owner or manager can change who shows.';

export interface RowSwitch {
  /** On = visitors see this person. */
  on: boolean;
  /** The command this press sends, or null when the switch is disabled. */
  press: 'hide' | 'show' | null;
  /** Why it is disabled; null when it works. */
  reason: string | null;
}

export function rowSwitch(row: SharedTeamRow, caller: { seat: TeamSeat; personId: string | null }): RowSwitch {
  const hidden = row.publicReason === 'hidden';
  if (!row.isPublic && !hidden) return { on: false, press: null, reason: OFF_REASON[row.publicReason] ?? OFF_REASON.not_listed };
  const may = canSetHidden({ callerSeat: caller.seat, callerPersonId: caller.personId, target: { personId: row.personId, isOwner: row.accessRole === 'owner' } });
  if (!may) return { on: row.isPublic, press: null, reason: NO_RIGHTS_REASON };
  return { on: row.isPublic, press: row.isPublic ? 'hide' : 'show', reason: null };
}
