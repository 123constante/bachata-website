// Pure model for the SENDER side of organiser invites (Arc 1 PR 2, slice B): the row's chip
// label and detail line, which button a row shows and why it is off, the Invite sheet's three
// choices, the link form's rules, and every refusal the issue and request RPCs RETURN, in plain
// words. Kept apart from inviteModel.ts (the redeem slice owns it): the status itself still comes
// from inviteModel's accessStatus, the one mapping, and is never re-derived here.

import { isPlausibleEmail } from '@/modules/organiser/shared/emailShape';
import { hasLiveInvite, latestInvite, type AccessStatus, type InviteRow } from './inviteModel';

// ---- the row -------------------------------------------------------------------

/** Chip text (mockups 5a-5f). The list, the row and the counts all draw it from here. */
export const SENDER_LABEL: Record<AccessStatus, string> = {
  unclaimed: 'Unclaimed',
  invited: 'Invited',
  invite_expired: 'Link ran out',
  managed: 'Managed',
};

/** The sentence under the row's name. `fmt` turns an ISO instant into a short date. */
export function senderDetail(status: AccessStatus | null, invites: readonly InviteRow[], fmt: (iso: string) => string, ownershipFresh = true): string {
  const latest = latestInvite(invites);
  if (status === 'invited' && latest?.expiresAt) return `Works until ${fmt(latest.expiresAt)}.`;
  if (status === 'invite_expired' && latest?.expiresAt) return `Ran out on ${fmt(latest.expiresAt)}.`;
  if (status === 'managed') {
    if (latest?.status === 'sent' && latest.expiresAt) return `Has an owner. A link works until ${fmt(latest.expiresAt)}.`;
    if (latest?.status === 'used' && latest.usedAt) return `Has an owner. Joined ${fmt(latest.usedAt)}.`;
    return 'Has an owner.';
  }
  if (status === 'unclaimed') {
    if (latest?.status === 'revoked') return 'The last link was withdrawn.';
    if (latest?.status === 'used') return ownershipFresh ? 'The last link was used, but the owner has since left.' : 'The last link was used.';
    return 'No link sent yet.';
  }
  return '';
}

/** The ONE button a row leads with (5a, 5d, 5e, 5f). */
export type PrimaryKind = 'invite' | 'copy_new_link' | 'send_new_link' | 'add_another';

export const PRIMARY_LABEL: Record<PrimaryKind, string> = {
  invite: 'Invite',
  copy_new_link: 'Copy new link',
  send_new_link: 'Send a new link',
  add_another: 'Add another person',
};

/** Where the primary button goes: the three choices, or straight to the link form. */
export const PRIMARY_OPENS: Record<PrimaryKind, 'choose' | 'link'> = {
  invite: 'choose',
  copy_new_link: 'link',
  send_new_link: 'link',
  add_another: 'choose',
};

export const LOADING_NOTE = 'Loading this organiser\u2019s links.';
export const LOAD_FAILED_NOTE = 'This organiser\u2019s links did not load. Tap Retry.';

export interface SenderActions {
  primary: PrimaryKind;
  /** Why the primary button is off, shown beside it; null when it can be pressed. */
  primaryDisabled: string | null;
  /** Withdraw shows only while a live link exists (a live link cannot be shown again). */
  showWithdraw: boolean;
  withdrawDisabled: string | null;
  /** A new link replaces the live one, so the link form says so before it is made. */
  replacesLiveLink: boolean;
}

/** Which controls a row offers, and the reason for each one that is off. */
export function senderActions(status: AccessStatus | null, invites: readonly InviteRow[], loadError = false): SenderActions {
  const live = status !== null && hasLiveInvite(invites);
  const primary: PrimaryKind =
    status === 'managed' ? 'add_another' : status === 'invited' ? 'copy_new_link' : status === 'invite_expired' ? 'send_new_link' : 'invite';
  const off = loadError ? LOAD_FAILED_NOTE : status === null ? LOADING_NOTE : null;
  return { primary, primaryDisabled: off, showWithdraw: live, withdrawDisabled: off, replacesLiveLink: live };
}

// ---- the Invite sheet (5b) -------------------------------------------------------

export type InviteChoice = 'link' | 'existing' | 'email';

export const INVITE_CHOICES: readonly { choice: InviteChoice; title: string; hint: string }[] = [
  { choice: 'link', title: 'Send a link', hint: 'Copy or WhatsApp. Works once, 7 days.' },
  { choice: 'existing', title: 'They already have an account', hint: 'Add them now by email.' },
  // admin_invite_person_v1 sends no email itself: it makes a ready message for one address.
  { choice: 'email', title: 'Invite by email', hint: 'A ready message for one address.' },
];

// ---- the link form -----------------------------------------------------------------

/** Under the email field (owner rule: a mistyped bound email stays allow-listed after a revoke). */
export const EMAIL_HELP = 'Check the spelling: this address can then sign up.';
export const PREFILL_NEEDS_EMAIL = 'Add their email to pre-fill these';
export const NO_EMAIL_NOTE = 'No email: anyone with the link can use it. Only for someone who already has an account.';
export const REPLACES_NOTE = 'This replaces the live link, so the old one stops working.';
export const ANOTHER_OWNER_NOTE = 'This page already has an owner. The link adds another owner.';
export const FIRST_NAME_MAX = 100;

/** Why "Make link" is off, or null. Everything is optional; what is typed must be usable. */
export function linkBlockedReason(email: string, firstName: string): string | null {
  if (email.trim() !== '' && !isPlausibleEmail(email)) return ISSUE_REFUSAL.invalid_email.text;
  if (firstName.trim().length > FIRST_NAME_MAX) return ISSUE_REFUSAL.invalid_first_name.text;
  return null;
}

export type IssueField = 'email' | 'first_name' | 'city';

/** Every refusal admin_issue_organiser_invite_v1 RETURNS (as-built), shown under its field. */
export const ISSUE_REFUSAL: Record<'invalid_email' | 'invalid_first_name' | 'city_not_found', { field: IssueField; text: string }> = {
  invalid_email: { field: 'email', text: 'That email does not look right. Check it and try again.' },
  invalid_first_name: { field: 'first_name', text: `Use their first name only, up to ${FIRST_NAME_MAX} letters.` },
  city_not_found: { field: 'city', text: 'That city is no longer in the list. Pick it again.' },
};
export type IssueRefusal = keyof typeof ISSUE_REFUSAL;
export const ISSUE_REFUSALS = Object.keys(ISSUE_REFUSAL) as IssueRefusal[];

export interface IssuedLink {
  inviteId: string;
  /** Shown once, then dropped: never stored, logged or sent anywhere. */
  token: string;
  expiresAt: string | null;
  emailBound: boolean;
  revokedPrevious: number;
}

export type IssueOutcome = { ok: true; link: IssuedLink } | { ok: false; reason: IssueRefusal };

/** admin_issue_organiser_invite_v1's answer. A shape it never sends throws (the generic error line). */
export function parseIssueResult(data: unknown): IssueOutcome {
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === false && typeof r.reason === 'string' && r.reason in ISSUE_REFUSAL) return { ok: false, reason: r.reason as IssueRefusal };
  if (typeof r.token !== 'string' || typeof r.invite_id !== 'string') throw new Error('malformed_invite_answer');
  return {
    ok: true,
    link: {
      inviteId: r.invite_id,
      token: r.token,
      expiresAt: typeof r.expires_at === 'string' ? r.expires_at : null,
      emailBound: r.email_bound === true,
      revokedPrevious: Array.isArray(r.revoked_previous) ? r.revoked_previous.length : 0,
    },
  };
}

/** The line under a one-time link (5c). */
export const linkOnceNote = (boundEmail: string | null): string =>
  boundEmail ? `Shown once. Works once, runs out in 7 days. Only ${boundEmail} can use it.` : 'Shown once. Works once, runs out in 7 days.';

// ---- admin lists: new-link requests and access requests --------------------------

export interface InviteRequest {
  id: string;
  organiserId: string;
  organiserName: string;
  /** The full bound address (admin-only); null for an unbound link. */
  inviteEmail: string | null;
  requestedAt: string | null;
  handledAt: string | null;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'dismissed';

export interface AccessRequest {
  id: string;
  email: string;
  note: string | null;
  requestedAt: string | null;
  status: AccessRequestStatus;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const ACCESS_STATUSES: readonly string[] = ['pending', 'approved', 'dismissed'];

/** admin_list_invite_requests_v1 rows; shapeless rows are dropped. */
export function parseInviteRequests(raw: unknown): InviteRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: InviteRequest[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.organiser_id !== 'string') continue;
    out.push({
      id: r.id,
      organiserId: r.organiser_id,
      organiserName: str(r.organiser_name) ?? 'Unnamed organiser',
      inviteEmail: str(r.invite_email),
      requestedAt: str(r.requested_at),
      handledAt: str(r.handled_at),
    });
  }
  return out;
}

/** admin_list_signup_access_requests_v1 rows; unknown statuses are dropped. */
export function parseAccessRequests(raw: unknown): AccessRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: AccessRequest[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.email !== 'string') continue;
    if (typeof r.status !== 'string' || !ACCESS_STATUSES.includes(r.status)) continue;
    out.push({ id: r.id, email: r.email, note: str(r.note), requestedAt: str(r.requested_at), status: r.status as AccessRequestStatus });
  }
  return out;
}

export const ACCESS_STATUS_LABEL: Record<AccessRequestStatus, string> = { pending: 'Waiting', approved: 'Approved', dismissed: 'Dismissed' };

/** Every refusal the two resolve RPCs RETURN. The list is re-read after each, so the copy says so. */
export const RESOLVE_REFUSAL: Record<string, string> = {
  already_handled: 'Someone already handled this one. The list is up to date now.',
  not_found: 'That request is gone. The list is up to date now.',
  invalid_action: 'Something went wrong. Please try again.',
};
export const RESOLVE_REFUSALS = Object.keys(RESOLVE_REFUSAL);

export type ResolveOutcome = { ok: true } | { ok: false; reason: string };

export function parseResolveResult(data: unknown): ResolveOutcome {
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true };
  return { ok: false, reason: typeof r.reason === 'string' ? r.reason : '' };
}

export const resolveRefusalMessage = (reason: string): string => RESOLVE_REFUSAL[reason] ?? RESOLVE_REFUSAL.invalid_action;

export const LINK_REQUESTS_EMPTY = 'No one is waiting for a new link. When someone taps Request a new link on a broken link, it shows here.';
export const ACCESS_REQUESTS_EMPTY = 'No access requests. When someone asks to join from the sign-up page, it shows here.';
export const APPROVE_NOTE = 'Approve lets that email sign up.';

/** Waiting link requests only (handled ones drop off), newest first as the server sends them. */
export const pendingInviteRequests = (rows: readonly InviteRequest[]): InviteRequest[] => rows.filter((r) => r.handledAt === null);

/** Waiting access requests first, then the rest, keeping the server's newest-first order inside each. */
export const orderAccessRequests = (rows: readonly AccessRequest[]): AccessRequest[] =>
  [...rows.filter((r) => r.status === 'pending'), ...rows.filter((r) => r.status !== 'pending')];
