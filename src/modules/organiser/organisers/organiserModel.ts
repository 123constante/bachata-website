// Co-organisers (ER-C11): who runs an event, who may do what, and the invite rules.
// Pure (no client import). Built to ER-INTERFACE section 4 + the AS BUILT block:
// series_organisers_v1 is its own read; organiser changes save at once.

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

export const BLOCK_TEXT = 'Every organiser can edit. Only the owner can end the event.';
export const OWNER_ONLY_REASON = 'Only the owner can do this.';
export const REMOVE_OWNER_ONLY_REASON = 'Only the owner can remove an organiser.';
export const NOT_ON_EVENT_REASON = 'You are not an organiser of this event.';
export const NO_ORGANISERS = 'No organiser is listed for this event yet.';

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

/** The controls only the owner's team has (server: the owner organiser page's owner or manager seat). */
export const OWNER_ONLY: readonly Control[] = ['removeOrganiser', 'end', 'stopRepeating', 'deleteDraft', 'cancelOneOff'];

/**
 * ONE table for what each role may do (owner / co / none), shared by this screen and any screen that
 * shows an owner-only control. `closed` is the ended/archived lock text: the server refuses an invite
 * to such an event; the rest stays as is.
 */
export function controlState(role: ViewerRole, control: Control, closed: string | null = null): ControlState {
  if (role === 'none') return { on: false, reason: NOT_ON_EVENT_REASON };
  if (control === 'invite') return closed ? { on: false, reason: closed } : { on: true, reason: null };
  if (control === 'cancelInvite') return { on: true, reason: null };
  if (control === 'leave') return role === 'co' ? { on: true, reason: null } : { on: false, reason: 'The owner cannot leave.' };
  if (OWNER_ONLY.includes(control)) {
    if (role === 'owner') return { on: true, reason: null };
    return { on: false, reason: control === 'removeOrganiser' ? REMOVE_OWNER_ONLY_REASON : OWNER_ONLY_REASON };
  }
  return { on: false, reason: null };
}

/** Whether Remove shows on THIS row: never on the owner, never on an invited row (that one is Cancel). */
export const rowCanBeRemoved = (row: OrganiserRow): boolean => row.role === 'co' && row.status === 'accepted';

/** Whether the viewer's own row is the one they may leave. */
export const isMyLeaveRow = (row: OrganiserRow, role: ViewerRole, myPageIds: string[]): boolean =>
  role === 'co' && rowCanBeRemoved(row) && myPageIds.includes(row.pageId);

/** The public line: "By <owner>, <co-organisers>" with accepted pages only. */
export function publicLine(rows: OrganiserRow[]): string {
  const ok = rows.filter((r) => r.status === 'accepted');
  return ok.length ? `By ${ok.map((r) => r.name).join(', ')}` : '';
}

export const INVITATIONS_TITLE = 'Invitations';
/** An invitation never promises more than it does: the event shows on the page only after Accept. */
export const invitationLine = (i: Invitation): string => `${i.invitedByName} invited ${i.invitedPageName} to run ${i.seriesName}`;
