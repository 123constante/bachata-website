// Pure, client-free model for the admin organiser-invite screens and the redeem
// landing. ONE mapping per fact: the access status (list, row detail and
// counts all call accessStatus), the redeem reason copy, the add-person copy.
// The server owns the rules (admin arc PR 4b); this only decides words and
// which control is enabled, and mirrors the refusals so the screen does not
// offer what the RPC would refuse.

import { PROFILE_INCOMPLETE_CODE } from '@/lib/accountRouting';
import { TEAM_CAP } from '@/modules/organiser/shared/teamModel';

export type InviteStatus = 'sent' | 'used' | 'revoked' | 'expired';

export interface InviteRow {
  inviteId: string;
  status: InviteStatus;
  issuedAt: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const STATUSES: readonly string[] = ['sent', 'used', 'revoked', 'expired'];

/** admin_list_organiser_invites_v1 rows. Shapeless rows and unknown statuses are dropped. */
export function parseInvites(raw: unknown): InviteRow[] {
  if (!Array.isArray(raw)) return [];
  const out: InviteRow[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || typeof r.invite_id !== 'string') continue;
    if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) continue;
    out.push({
      inviteId: r.invite_id,
      status: r.status as InviteStatus,
      issuedAt: str(r.issued_at),
      expiresAt: str(r.expires_at),
      usedAt: str(r.used_at),
      revokedAt: str(r.revoked_at),
    });
  }
  return out;
}

/** The newest invite (by issued_at); the list endpoint's order is not relied on. */
export function latestInvite(invites: readonly InviteRow[]): InviteRow | null {
  let best: InviteRow | null = null;
  for (const i of invites) {
    if (!best || (i.issuedAt ?? '') > (best.issuedAt ?? '')) best = i;
  }
  return best;
}

export type AccessStatus = 'unclaimed' | 'invited' | 'invite_expired' | 'managed';

export const ACCESS_LABEL: Record<AccessStatus, string> = {
  unclaimed: 'Unclaimed',
  invited: 'Invited',
  invite_expired: 'Invite expired',
  managed: 'Managed',
};

export const ACCESS_ORDER: readonly AccessStatus[] = ['unclaimed', 'invited', 'invite_expired', 'managed'];

/**
 * THE status mapping. `managed` comes from organiser_ownership_v1.is_managed (an
 * owner exists); otherwise the newest invite decides. A used or revoked newest
 * invite on an organiser with no owner is Unclaimed (the person left, or the
 * link was withdrawn), never Managed. `invites` null = not loaded yet: the
 * caller shows no status rather than guessing Unclaimed.
 */
export function accessStatus(managed: boolean, invites: readonly InviteRow[] | null): AccessStatus | null {
  if (managed) return 'managed';
  if (invites === null) return null;
  const latest = latestInvite(invites);
  if (latest?.status === 'sent') return 'invited';
  if (latest?.status === 'expired') return 'invite_expired';
  return 'unclaimed';
}

/** Lifecycle values an admin sees; anything but `live` is not on the public site. */
export const LIVE_LIFECYCLE = 'live';

/** Small tag text for a non-live organiser, or null when live. The one mapping for the tag and the detail line. */
export const KNOWN_NOT_LIVE_LIFECYCLES = ['draft', 'hidden', 'unpublished'] as const;
export const UNKNOWN_LIFECYCLE_LABEL = 'status unknown';

export const lifecycleLabel = (lifecycle: string | null | undefined): string | null => {
  if (lifecycle === LIVE_LIFECYCLE) return null;
  if ((KNOWN_NOT_LIVE_LIFECYCLES as readonly string[]).includes(lifecycle ?? '')) return (lifecycle as string).replace(/_/g, ' ');
  return UNKNOWN_LIFECYCLE_LABEL; // missing or unrecognised: a neutral tag, never a claim
};

/** Detail-line sentence for a KNOWN non-live organiser (empty when live or unknown), so Unclaimed is not read as "invite them". */
export const notLiveNote = (lifecycle: string | null | undefined): string =>
  (KNOWN_NOT_LIVE_LIFECYCLES as readonly string[]).includes(lifecycle ?? '')
    ? `This organiser is not live (${lifecycle}), so it is not on the public site yet.`
    : '';

export interface RowActions {
  /** Issue a link. Always possible for an admin; a live link is replaced, so it asks first. */
  canGenerate: boolean;
  generateConfirms: boolean;
  generateNote: string | null;
  canRevoke: boolean;
  revokeNote: string | null;
  canAddPerson: boolean;
}

/** True when the newest invite is still usable (an owner-granting link that works). */
export const hasLiveInvite = (invites: readonly InviteRow[]): boolean => latestInvite(invites)?.status === 'sent';

/** Which controls a row offers, and the reason for each one that is disabled. */
export function rowActions(status: AccessStatus | null, invites: readonly InviteRow[] = []): RowActions {
  // A live link is read from the invites, not the badge: a managed organiser can hold one too.
  const hasLive = status !== null && hasLiveInvite(invites);
  return {
    canGenerate: status !== null,
    generateConfirms: hasLive,
    generateNote: status === null ? 'Loading this organiser’s links.' : status === 'managed' ? 'This organiser already has an owner. A new link would add another owner.' : null,
    canRevoke: hasLive,
    revokeNote: hasLive ? null : status === null ? 'Loading this organiser’s links.' : 'There is no live link to revoke.',
    canAddPerson: true,
  };
}

/** The sentence under the status: expiry for a live link, the date otherwise. */
export function statusDetail(status: AccessStatus | null, invites: readonly InviteRow[], fmt: (iso: string) => string, ownershipFresh = true): string {
  const latest = latestInvite(invites);
  if (status === 'invited' && latest?.expiresAt) return `Link works until ${fmt(latest.expiresAt)}.`;
  if (status === 'invite_expired' && latest?.expiresAt) return `The last link ran out on ${fmt(latest.expiresAt)}.`;
  if (status === 'managed') return latest?.status === 'sent' && latest.expiresAt ? `Has an owner. Link works until ${fmt(latest.expiresAt)}.` : 'Has an owner.';
  if (status === 'unclaimed') return latest?.status === 'revoked' ? 'The last link was revoked.' : latest?.status === 'used' ? (ownershipFresh ? 'The last link was used, but the owner has since left.' : 'The last link was used.') : 'No link sent yet.';
  return '';
}

export const INVITE_PATH = '/invite';

/** The shareable link. The token is never stored; this is built from the one-time RPC answer. */
export const inviteUrl = (origin: string, token: string) => `${origin}${INVITE_PATH}/${token}`;

/** A ready message for WhatsApp. No phone number is added; the admin picks the chat. */
export function whatsappHref(organiserName: string, link: string): string {
  const text = `Hi! Here is your link to manage ${organiserName} on Bachata Calendar. Tap it, sign in, add a few profile details (first name, city, dance role, photo), and you are in. It works once and runs out in 7 days: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const TOKEN_RE = /^[0-9a-f]{64}$/;

/**
 * Who a signed-in person joins the team as (M57: the link is bearer-style, so the
 * card names the account BEFORE it is used): the dancer first name, else the
 * display name, else the account e-mail.
 */
export function joiningAsName(row: { first_name?: string | null; display_name?: string | null } | null | undefined, email: string | null | undefined): string {
  return row?.first_name?.trim() || row?.display_name?.trim() || email?.trim() || 'this account';
}

// ---- redeem ---------------------------------------------------------------------

export type RedeemAction = 'sign_in' | 'retry' | 'home' | 'finish_profile' | null;

export interface RedeemCopy {
  title: string;
  body: string;
  /** The only control the screen shows besides the home link. Copy never names a control. */
  action: RedeemAction;
  /** True when the link is finished with and the token can leave the address bar. */
  terminal: boolean;
}

const ASK_NEW = 'Ask the admin who sent it for a new link.';

/** Every reason redeem_organiser_invite_v1 can return (4b), plus the raised authentication_required. */
export const REDEEM_COPY: Record<string, RedeemCopy> = {
  sign_in_required: { title: 'Sign in to continue', body: 'This link is for a signed-in account. Sign in with your own email, then you will come straight back here.', action: 'sign_in', terminal: false },
  authentication_required: { title: 'Sign in to continue', body: 'Sign in with your own email, then you will come straight back here.', action: 'sign_in', terminal: false },
  unconfirmed_account: { title: 'Confirm your account first', body: 'Your account has not been confirmed yet. Confirm your email address from the message we sent you, then open this link again.', action: 'home', terminal: false },
  rate_limited: { title: 'Too many tries', body: 'Too many links were tried from this account in the last hour. Wait an hour, then open this link again.', action: 'home', terminal: false },
  // The server refuses BEFORE consuming the link, so the token must stay in the URL for the way back.
  [PROFILE_INCOMPLETE_CODE]: { title: 'Finish your dancer profile first', body: 'Add your first name, city, dance role and photo, then you will come straight back here and the link is used.', action: 'finish_profile', terminal: false },
  // The masked hint is filled in by redeemCopy(); without one the body still reads whole.
  email_mismatch: { title: 'This link is for a different email', body: 'It was sent to another email address. Sign in with that email, or ask for a new link.', action: 'sign_in', terminal: false },
  email_unproven: { title: 'Use the email link to sign in', body: 'This link is for your email, but you signed in another way. Sign in with an email link or code, then open this link again.', action: 'sign_in', terminal: false },
  invalid: { title: 'This link does not work', body: `It may have been copied incompletely. ${ASK_NEW}`, action: 'home', terminal: true },
  used: { title: 'This link was already used', body: `A link works once. If that was not you, ${ASK_NEW}`, action: 'home', terminal: true },
  revoked: { title: 'This link was withdrawn', body: ASK_NEW, action: 'home', terminal: true },
  expired: { title: 'This link has run out', body: `Links last 7 days. ${ASK_NEW}`, action: 'home', terminal: true },
  // The page is at its cap (admin A1b). A joiner has no Remove control, so the shared TEAM_FULL_COPY ("Remove someone first") does not fit here: same cap, same support route, no absent control.
  team_full: { title: 'This team is full', body: `This team already has ${TEAM_CAP} people, so you cannot join it yet. Ask the page owner to make room, or ask the Bachata Calendar team.`, action: 'home', terminal: true },
};

export const REDEEM_FALLBACK: RedeemCopy = { title: 'Something went wrong', body: 'We could not use this link. Check your connection and try again.', action: 'retry', terminal: false };

export interface InvitePrefill { firstName: string | null; cityId: string | null }

export type RedeemOutcome =
  | { kind: 'redeemed'; organiserId: string; alreadyMember: boolean; prefill: InvitePrefill | null }
  | { kind: 'refused'; reason: string; copy: RedeemCopy; emailHint: string | null }
  | { kind: 'failed'; copy: RedeemCopy };

/** redeem_organiser_invite_v1's answer (or the raised error) -> what the landing does next. */
export function interpretRedeem(data: unknown, error: { message?: string } | null): RedeemOutcome {
  if (error) {
    const msg = error.message ?? '';
    const code = /authentication_required/.test(msg) ? 'authentication_required' : msg.includes(PROFILE_INCOMPLETE_CODE) ? PROFILE_INCOMPLETE_CODE : null;
    return code ? { kind: 'refused', reason: code, copy: REDEEM_COPY[code], emailHint: null } : { kind: 'failed', copy: REDEEM_FALLBACK };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === true && (row.status === 'redeemed' || row.status === 'already_member') && typeof row.organiser_id === 'string') {
    return { kind: 'redeemed', organiserId: row.organiser_id, alreadyMember: row.status === 'already_member', prefill: parsePrefill(row.prefill) };
  }
  const reason = typeof row.reason === 'string' ? row.reason : '';
  const copy = REDEEM_COPY[reason];
  return copy ? { kind: 'refused', reason, copy, emailHint: str(row.invite_email_hint) } : { kind: 'failed', copy: REDEEM_FALLBACK };
}

/** redeem's `prefill` key; null when absent or empty, so nothing is stored for a link that carries none. */
export function parsePrefill(raw: unknown): InvitePrefill | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const firstName = str(r.first_name);
  const cityId = str(r.city_id);
  return firstName || cityId ? { firstName, cityId } : null;
}

// ---- preview + "ask for a new link": ONE reason -> screen mapping ----------------------

export type PreviewStatus = 'open' | 'used' | 'revoked' | 'expired';
export interface InvitePreview { status: PreviewStatus; organiserName: string; inviterFirstName: string | null; emailHint: string | null }

/** organiser_invite_preview_v1: `{}` (malformed/unknown) and anything unreadable -> null. */
export function parsePreview(raw: unknown): InvitePreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const organiserName = str(r.organiser_name);
  if (!organiserName || !['open', 'used', 'revoked', 'expired'].includes(r.status as string)) return null;
  return { status: r.status as PreviewStatus, organiserName, inviterFirstName: str(r.inviter_first_name), emailHint: str(r.email_hint) };
}

/** Reasons whose fix is a NEW link from the sender (not a garbled link, not a sign-in problem). */
export const NEW_LINK_REASONS: readonly string[] = ['used', 'revoked', 'expired', 'email_mismatch'];

/** The label of the "ask for a new link" control: names the sender when the lookup knows them. */
export const newLinkLabel = (inviter: string | null | undefined): string => (inviter ? `Ask ${inviter} for a new one` : 'Request a new link');

export interface ReasonScreen extends RedeemCopy {
  /** Show the "ask for a new link" control (request_new_invite_v1). */
  offerNewLink: boolean;
  newLinkLabel: string;
}

/**
 * THE mapping from a redeem reason (or a preview status that is already broken) to what any screen
 * says. The landing, the preview card and the post-Join refusal all call this; none keeps its own words.
 */
export function reasonScreen(reason: string, ctx: { organiserName?: string | null; inviterFirstName?: string | null; emailHint?: string | null } = {}): ReasonScreen {
  const base = REDEEM_COPY[reason] ?? REDEEM_FALLBACK;
  const body = reason === 'email_mismatch' && ctx.emailHint ? `It was sent to ${ctx.emailHint}. Sign in with that email, or ask for a new link.` : base.body;
  return { ...base, body, offerNewLink: NEW_LINK_REASONS.includes(reason), newLinkLabel: newLinkLabel(ctx.inviterFirstName) };
}

/** request_new_invite_v1 answer -> one short line. Rate limit wording is the arc-wide one. */
export const TRY_LATER_COPY = 'Try again later.';
export function newLinkResultCopy(data: unknown, error: unknown): { ok: boolean; text: string } {
  if (error) return { ok: false, text: GENERIC };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true, text: 'Request sent. The admin will send you a new link.' };
  if (r.reason === 'already_requested') return { ok: true, text: 'You already asked. The admin will send a new link.' };
  if (r.reason === 'rate_limited') return { ok: false, text: TRY_LATER_COPY };
  return { ok: false, text: 'This link cannot be renewed from here.' };
}

/** request_signup_access_v1 answer -> a line under the form. */
export function accessResultCopy(data: unknown, error: unknown): { ok: boolean; text: string } {
  if (error) return { ok: false, text: GENERIC };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true, text: 'Request sent. We will email you when you are in.' };
  if (r.reason === 'rate_limited') return { ok: false, text: TRY_LATER_COPY };
  if (r.reason === 'invalid_email') return { ok: false, text: 'Check the email address.' };
  if (r.reason === 'invalid_note') return { ok: false, text: 'Keep the note under 300 characters.' };
  return { ok: false, text: GENERIC };
}

// ---- admin writes: plain-English refusals ----------------------------------------

const GENERIC = 'Something went wrong. Please try again.';

/**
 * Every code admin_add_entity_member_v1 and the invite RPCs can raise (read from
 * the live bodies, 2026-10-11). Raw server text is never shown.
 */
export const ADMIN_COPY: Record<string, string> = {
  authentication_required: 'Your sign-in has ended. Sign in again, then retry.',
  not_authorised: 'Only an admin can do that. Check you are signed in with your admin account.',
  actor_required: 'Your sign-in has ended. Sign in again, then retry.',
  organiser_not_found: 'That organiser no longer exists. Reload the page.',
  invalid_member_role: 'Choose Owner, Manager or Contributor.',
  ambassador_only_on_city: 'Ambassador is only for cities, not organisers.',
  use_transfer: 'Add person only adds Managers and Contributors. To add an owner, tap Generate invite. Or add them as a Manager here; the owner can then open their name on Team and tap Hand the page over.',
  user_not_found: 'No account has that email address. Ask them to sign up to Bachata Calendar first, then add them.',
  unconfirmed_email: 'That account has not confirmed its email address yet. Ask them to confirm it, then add them.',
};

export const ADD_PERSON_CODES = Object.keys(ADMIN_COPY);

export function adminErrorMessage(error: unknown): string {
  const text = String((error as { message?: unknown } | null)?.message ?? '');
  const hit = Object.keys(ADMIN_COPY).find((code) => new RegExp(`(^|[^a-z_])${code}($|[^a-z_])`).test(text));
  return hit ? ADMIN_COPY[hit] : GENERIC;
}

export const MEMBER_ROLES = ['owner', 'manager', 'contributor'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = { owner: 'Owner', manager: 'Manager', contributor: 'Contributor' };

