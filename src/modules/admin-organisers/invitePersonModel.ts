// Pure model for "Invite person": the ONE refusal table, the parser for
// admin_invite_person_v1's answer, and the message the admin copies or shares.
// Kept apart from inviteModel.ts (organiser R1 owns that file).

import { isPlausibleEmail } from '@/modules/organiser/shared/emailShape';

export interface PersonInvite {
  /** Null for a person with no page (teacher, DJ or other): no invite row is made. */
  inviteId: string | null;
  /** Null exactly when inviteId is null. */
  token: string | null;
  email: string;
  linkPath: string;
  message: string | null;
}

const INVITE_PATH_PREFIX = '/invite/';

/** No page: the server records the email on the profile and returns no invite (link_path '/account'). */
export const isNoPageInvite = (i: PersonInvite): boolean => i.inviteId === null;

/**
 * admin_invite_person_v1 -> {invite_id, token, email, link_path, message}. With a page both ids are
 * strings and the link is an /invite/ path; with no page both are JSON null and the link is not an
 * /invite/ path ('/account'). Anything else is refused.
 */
export function parsePersonInvite(data: unknown): PersonInvite | null {
  const r = (data ?? {}) as Record<string, unknown>;
  if (typeof r.email !== 'string' || typeof r.link_path !== 'string' || !r.link_path.startsWith('/')) return null;
  const message = typeof r.message === 'string' && r.message.trim() ? r.message.trim() : null;
  if (typeof r.invite_id === 'string' && typeof r.token === 'string') {
    return { inviteId: r.invite_id, token: r.token, email: r.email, linkPath: r.link_path, message };
  }
  if (r.invite_id === null && r.token === null && !r.link_path.startsWith(INVITE_PATH_PREFIX)) {
    return { inviteId: null, token: null, email: r.email, linkPath: r.link_path, message };
  }
  return null;
}

const GENERIC = 'Something went wrong. Please try again.';

/** Every refusal admin_invite_person_v1 can return, in plain words. Raw server text is never shown. */
export const INVITE_PERSON_COPY: Record<string, string> = {
  not_admin: 'Only an admin can send invites. Check you are signed in with your admin account.',
  invalid_email: 'That email address does not look right. Check it and try again.',
  email_in_use: "That email is already on another profile that nobody has claimed yet. Use that person's own profile, or a different email.",
  profile_not_found: 'That person no longer exists. Pick them again.',
  organiser_not_found: 'That organiser page no longer exists. Reload the page.',
  authentication_required: 'Your sign-in has ended. Sign in again, then retry.',
};

export function invitePersonErrorMessage(error: unknown): string {
  const text = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  const hit = Object.keys(INVITE_PERSON_COPY).find((code) => new RegExp(`(^|[^a-z_])${code}($|[^a-z_])`).test(text));
  return hit ? INVITE_PERSON_COPY[hit] : GENERIC;
}

export interface UpcomingEvent {
  name: string;
  date: string;
}

/** Why the Invite button is off, or null when it can be pressed. Always shown beside the button. */
export function inviteBlockedReason(personId: string | null, email: string): string | null {
  if (!personId) return 'Choose the person to invite.';
  if (!isPlausibleEmail(email)) return 'Enter their email address to invite them.';
  return null;
}

export interface InviteMessageInput {
  /** First name for the greeting; null when the person has none ("Hi!", never "Hi Unnamed!"). */
  personName: string | null;
  /**
   * admin_invite_person_v1's own `message`. It already holds the greeting, the link, the page's
   * events and the expiry, so when present it IS the message; nothing here is added to it.
   */
  serverMessage: string | null;
  organiserName: string | null;
  link: string;
  upcoming: readonly UpcomingEvent[];
  pageUrl: string | null;
}

const MAX_EVENTS = 5;

/**
 * The ready-to-send message: the server's own text as is when it sent one. Built here only when it
 * did not: what the link does, what to expect, the page and its upcoming events.
 */
export function buildInviteMessage(i: InviteMessageInput): string {
  if (i.serverMessage) return i.serverMessage;
  const lines: string[] = [];
  lines.push(i.personName ? `Hi ${i.personName}!` : 'Hi!');
  lines.push(
    i.organiserName
      ? `Here is your link to manage ${i.organiserName} on Bachata Calendar.`
      : 'Here is your link to join Bachata Calendar with your existing profile.',
  );
  // The expiry is the server's to state (a person invite may not last as long as a page invite).
  lines.push(
    i.organiserName
      ? 'Tap it and sign in with the email this was sent to. It works once.'
      : 'Tap it and sign in with the email this was sent to. Your profile is ready for you.',
  );
  if (i.organiserName) {
    lines.push(`Once you are in you can edit the page${i.upcoming.length ? ' and its events' : ''}.`);
    if (i.pageUrl) lines.push(`Your page: ${i.pageUrl}`);
    if (i.upcoming.length) {
      lines.push('Coming up:');
      for (const e of i.upcoming.slice(0, MAX_EVENTS)) lines.push(`- ${e.name} (${e.date})`);
      if (i.upcoming.length > MAX_EVENTS) lines.push(`- and ${i.upcoming.length - MAX_EVENTS} more`);
    }
  }
  lines.push(i.link);
  return lines.join('\n');
}

export const shareHref = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
