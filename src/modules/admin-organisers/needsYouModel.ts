import type { Decision, NeedsItem, NeedsReason, ResolveResult } from './frontDoorApi';

/** One mapping for the Needs you screen. Never offers approve_drafts_only (not wired). */

export const REASON_LABEL: Record<NeedsReason, string> = {
  email_mismatch_claim: 'Signed in with a different email',
  join_request: 'Wants to join',
  access_request: 'Asked for access',
  quiet_30_days: 'Quiet for 30 days',
};

export const REASON_HELP: Record<NeedsReason, string> = {
  email_mismatch_claim: 'Someone claimed this page with an email that is not the one on file. Approve to make them the owner, or decline.',
  join_request: 'Someone asked to join this page.',
  access_request: 'Someone asked for access.',
  quiet_30_days: 'Nothing has changed on this page for 30 days. You may want to check in.',
};

export const REASON_ORDER: readonly NeedsReason[] = ['email_mismatch_claim', 'join_request', 'access_request', 'quiet_30_days'];

export function canResolve(item: NeedsItem): boolean {
  return item.reason === 'email_mismatch_claim';
}

export function groupItems(items: readonly NeedsItem[]) {
  return REASON_ORDER.map((reason) => ({ reason, items: items.filter((i) => i.reason === reason) })).filter((g) => g.items.length > 0);
}

export const NEEDS_EMPTY = {
  title: 'Nothing needs you right now',
  body: 'You can add an organiser, or open the organisers list to check on invites.',
};
export const NEEDS_LOAD_ERROR = 'This list did not load. Check your connection, then try again.';

export const badgeText = (count: number | null): string | null => (count === null || count <= 0 ? null : count > 99 ? '99+' : String(count));

export const RESOLVE_ERROR_TEXT: Record<string, string> = {
  CLAIMANT_IS_ADMIN: 'This person is an admin, so they already have access and cannot be made an owner. You can decline instead.',
  DRAFTS_ONLY_NOT_WIRED: 'Approving drafts only is not available yet.',
  ITEM_NOT_FOUND: 'This request is no longer there. Someone may have already dealt with it. Refresh the list.',
  INVALID_DECISION: 'That choice was not understood. Refresh and try again.',
  PERMISSION_DENIED: 'Only admins can do this. Sign in with an admin account.',
};
export const RESOLVE_FALLBACK = 'That did not go through. Check your connection, then try again.';

export function resolveMessage(r: ResolveResult): { ok: boolean; text: string } {
  if (r.kind === 'ok') {
    const d: Decision = r.decision;
    return { ok: true, text: d === 'approve_full' ? 'Approved. They are now the owner of this page.' : 'Declined.' };
  }
  return { ok: false, text: RESOLVE_ERROR_TEXT[r.code] ?? RESOLVE_FALLBACK };
}
