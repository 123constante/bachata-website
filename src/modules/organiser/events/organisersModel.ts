// The event's organisers screen (ER-C11, replaces SW1). Pure. The rules live in
// organisers/organiserModel.ts (one table over owner / co / non-member); this file holds what
// only the screen needs. There is no Save and no series.set_organisers any more: invite, cancel,
// remove and leave each save at once through their own RPC.

import { eventLock } from '@/modules/organiser/shared/eventState';
import { BLOCK_TEXT, controlState, type Control, type ControlState, type OrganiserRow, type ViewerRole } from '../organisers/organiserModel';

export interface LinkedOrganiser { id: string; name: string; avatarUrl: string | null }

export { BLOCK_TEXT };
export const INVITE_LABEL = 'Invite an organiser';
export const LEAVE_LABEL = 'Leave this event';
export const INVITED_LABEL = 'Invited';
export const SEARCH_HINT = 'Type at least 2 letters of the page name.';
export const SEARCH_NONE = 'No organiser page found. Check the spelling, or ask them to set up their page first.';
export const SEARCH_ALL_TAKEN = 'Every page that matches already runs this event or has been invited.';
export const LEAVE_CONFIRM = 'You will stop being an organiser of this event. The owner can invite you again.';
export const ROLE_WORD: Record<'owner' | 'co', string> = { owner: 'Owner', co: 'Co-organiser' };

/** Why Invite is off, or null: the lock on an ended/archived event, else the role table. */
export const inviteOff = (role: ViewerRole, lifecycle: string): string | null => controlState(role, 'invite', eventLock(lifecycle)).reason;

/** The state of one control for this viewer on this event (the one shared mapping). */
export const controlFor = (role: ViewerRole, lifecycle: string, control: Control): ControlState =>
  controlState(role, control, control === 'invite' ? eventLock(lifecycle) : null);

/** What each row offers THIS viewer: Remove (owner, on a co), Cancel (an invited row), Leave (co, own row). */
export type RowAction = 'remove' | 'cancel' | 'leave' | null;
export function rowAction(row: OrganiserRow, role: ViewerRole, myPageIds: string[]): RowAction {
  if (role === 'none' || row.role === 'owner') return null;
  if (row.status === 'invited') return row.inviteId ? 'cancel' : null;
  if (role === 'owner') return 'remove';
  return myPageIds.includes(row.pageId) ? 'leave' : null;
}

/** The one line under the list when the viewer cannot remove others, or null. */
export const removeNote = (role: ViewerRole, rows: OrganiserRow[]): string | null =>
  role === 'co' && rows.some((r) => r.role === 'co' && r.status === 'accepted') ? controlState(role, 'removeOrganiser').reason : null;
