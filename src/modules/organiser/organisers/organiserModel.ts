// Co-organisers (ER-C11): who runs an event, who may do what, and the invite rules.
// Pure (no client import). Built to ER-INTERFACE section 4 + the AS BUILT block:
// series_organisers_v1 is its own read; organiser changes save at once.
// ER-FIX2-S4 (owner decision 4, AD2 live on prod): everyone on an event has FULL
// control. The only difference left between owner and co is Leave: the owner page
// cannot leave (the server refuses it) and nobody removes the owner page.

import { eventLock } from '@/modules/organiser/shared/eventState';

export type OrganiserRole = 'owner' | 'co';
export type OrganiserStatus = 'accepted' | 'invited';

/** One row of series_organisers_v1. */
export interface OrganiserRow {
  pageId: string;
  name: string;
  role: OrganiserRole;
  status: OrganiserStatus;
  /** Present on an invited row: what Cancel sends. */
  inviteId: string | null;
}

/** One row of my_organiser_invites_v1 (Home "Invitations"). */
export interface Invitation {
  inviteId: string;
  seriesId: string;
  seriesName: string;
  invitedPageId: string;
  invitedPageName: string;
  invitedByName: string;
}

/** The viewer's place on ONE event. 'none' = not on it (or only invited). */
export type ViewerRole = 'owner' | 'co' | 'none';

export const BLOCK_TEXT = 'Every organiser on this event can edit it, invite, remove a co-organiser and end it.';
export const OWNER_CANNOT_LEAVE = 'The owner page cannot leave this event.';
export const NOT_ON_EVENT_REASON = 'You are not an organiser of this event.';
export const NO_ORGANISERS = 'No organiser page is listed for this event yet.';
/** F5: the empty list says what the person can do when Invite is on. */
export const emptyText = (inviteOn: boolean): string => (inviteOn ? `${NO_ORGANISERS} Use Invite an organiser below to add a page.` : NO_ORGANISERS);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** series_organisers_v1 result -> rows. Bad rows are dropped; a page appears once (accepted beats invited, owner first). */
export function parseOrganisers(data: unknown): OrganiserRow[] {
  const raw = (data as { organisers?: unknown } | null)?.organisers;
  if (!Array.isArray(raw)) return [];
  const rows: OrganiserRow[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const pageId = str(r?.page_id);
    if (!pageId) continue;
    const role: OrganiserRole = r.role === 'owner' ? 'owner' : 'co';
    const status: OrganiserStatus = r.status === 'invited' ? 'invited' : 'accepted';
    const seen = rows.findIndex((x) => x.pageId === pageId);
    const row: OrganiserRow = { pageId, name: str(r.name) || 'Organiser page', role, status, inviteId: str(r.invite_id) || null };
    if (seen === -1) rows.push(row);
    else if (rows[seen].status === 'invited' && status === 'accepted') rows[seen] = row;
  }
  return rows.sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'));
}

/** my_organiser_invites_v1 result -> invitations. A repeated invite_id appears once. */
export function parseInvitations(data: unknown): Invitation[] {
  const raw = (data as { invites?: unknown } | null)?.invites;
  if (!Array.isArray(raw)) return [];
  const out: Invitation[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const inviteId = str(r?.invite_id);
    if (!inviteId || out.some((x) => x.inviteId === inviteId)) continue;
    out.push({
      inviteId, seriesId: str(r.series_id), seriesName: str(r.series_name) || 'An event',
      invitedPageId: str(r.invited_page_id), invitedPageName: str(r.invited_page_name) || 'Your page',
      invitedByName: str(r.invited_by_name) || 'Another organiser',
    });
  }
  return out;
}

/** The viewer's role: their accepted pages decide. Owner beats co. An invited page has no rights yet. */
export function viewerRole(rows: OrganiserRow[], myPageIds: string[]): ViewerRole {
  const mine = rows.filter((r) => r.status === 'accepted' && myPageIds.includes(r.pageId));
  if (mine.some((r) => r.role === 'owner')) return 'owner';
  return mine.length ? 'co' : 'none';
}

/** What the event read and Home say about the viewer, for when the organiser list cannot. */
export interface EventStanding { organiserIds: readonly string[]; homeRole: 'owner' | 'manager' | null }

/**
 * F5: the viewer's role on THIS event. An accepted list is the truth. With no accepted row
 * (571 of 747 prod series link no page) the event read decides: my page first in its
 * organiser ids -> owner; linked, or the event listed under my page on Home -> co.
 */
export function viewerRoleOnEvent(rows: OrganiserRow[], myPageIds: string[], ev: EventStanding): ViewerRole {
  if (rows.some((r) => r.status === 'accepted')) return viewerRole(rows, myPageIds);
  if (ev.organiserIds[0] && myPageIds.includes(ev.organiserIds[0])) return 'owner';
  if (ev.organiserIds.some((id) => myPageIds.includes(id)) || ev.homeRole) return 'co';
  return 'none';
}

/** Pages that must not be offered again: already linked or already invited. */
export const takenPageIds = (rows: OrganiserRow[]): string[] => rows.map((r) => r.pageId);

/** A page can be invited only once (server: already linked / already invited are refused). */
export const canOffer = (rows: OrganiserRow[], pageId: string): boolean => !takenPageIds(rows).includes(pageId);

/** Add a freshly invited page without ever duplicating it. */
export function withInvited(rows: OrganiserRow[], page: { id: string; name: string }, inviteId: string | null): OrganiserRow[] {
  return canOffer(rows, page.id) ? [...rows, { pageId: page.id, name: page.name, role: 'co', status: 'invited', inviteId }] : rows;
}

export type Control = 'invite' | 'cancelInvite' | 'removeOrganiser' | 'leave' | 'end' | 'stopRepeating' | 'deleteDraft' | 'cancelOneOff';
export interface ControlState { on: boolean; reason: string | null }

/**
 * ONE table for what each role may do (owner / co / none), shared by this screen and any screen that
 * asks. Full control (decision 4): every control is on for owner and co, except Leave for the owner.
 * `closed` is the ended/archived lock text: the server refuses an invite to such an event.
 */
export function controlState(role: ViewerRole, control: Control, closed: string | null = null): ControlState {
  if (role === 'none') return { on: false, reason: NOT_ON_EVENT_REASON };
  if (control === 'invite') return closed ? { on: false, reason: closed } : { on: true, reason: null };
  if (control === 'cancelInvite') return { on: true, reason: null };
  if (control === 'leave') return role === 'co' ? { on: true, reason: null } : { on: false, reason: OWNER_CANNOT_LEAVE };
  return { on: true, reason: null };
}

/** The public line: "By <owner>, <co-organisers>" with accepted pages only. */
export function publicLine(rows: OrganiserRow[]): string {
  const ok = rows.filter((r) => r.status === 'accepted');
  return ok.length ? `By ${ok.map((r) => r.name).join(', ')}` : '';
}

export const INVITATIONS_TITLE = 'Invitations';
/** An invitation never promises more than it does: the event shows on the page only after Accept. */
export const invitationLine = (i: Invitation): string => `${i.invitedByName} invited ${i.invitedPageName} to run ${i.seriesName}`;

// ---- Screen helpers (moved from events/organisersModel.ts by ER-FIX2-S4: one organisers model file) ----
export const INVITE_LABEL = 'Invite an organiser';
export const LEAVE_LABEL = 'Leave this event';
/** F11: the row keeps the short word so a long page name is not squeezed; the sheet keeps the full words. */
export const LEAVE_ROW_LABEL = 'Leave';
export const INVITED_LABEL = 'Invited';
export const SEARCH_HINT = 'Type at least 2 letters of the page name.';
export const SEARCH_NONE = 'No organiser page found. Check the spelling, or ask them to set up their page first.';
export const SEARCH_ALL_TAKEN = 'Every page that matches already runs this event or has been invited.';
/** F10: the search returns at most this many pages. */
export const SEARCH_LIMIT = 20;
export const searchMore = (found: number): string | null => (found >= SEARCH_LIMIT ? `Showing the first ${SEARCH_LIMIT}. Type more of the name.` : null);
export const LEAVE_CONFIRM = 'You will stop being an organiser of this event. Any organiser on the event can invite you again.';
export const ROLE_WORD: Record<'owner' | 'co', string> = { owner: 'Owner', co: 'Co-organiser' };

/** The state of one control for this viewer on this event (the one shared mapping). */
export const controlFor = (role: ViewerRole, lifecycle: string, control: Control): ControlState =>
  controlState(role, control, control === 'invite' ? eventLock(lifecycle) : null);

/** What each row offers THIS viewer: Remove (anyone on the event, on another co), Cancel (an invited row), Leave (co, own row). */
export type RowAction = 'remove' | 'cancel' | 'leave' | null;
export function rowAction(row: OrganiserRow, role: ViewerRole, myPageIds: string[]): RowAction {
  if (role === 'none' || row.role === 'owner') return null;
  if (row.status === 'invited') return row.inviteId ? 'cancel' : null;
  if (myPageIds.includes(row.pageId)) return role === 'co' ? 'leave' : null;
  return 'remove';
}
