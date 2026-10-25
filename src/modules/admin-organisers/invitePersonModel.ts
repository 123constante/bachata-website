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

// ---- "Who is this for?" (W3: an invite always names the person) -------------------------

/** The person the page invite is for. Someone new is not a pick: it opens the person-less link form. */
export interface WhoPick {
  id: string;
  name: string;
  firstName: string | null;
  /** The profile is already joined to a login; undefined when not known. */
  hasLogin?: boolean;
}

export const WHO_COPY = {
  title: 'Who is this for?',
  lead: 'Pick the person, so their login is joined to the profile you already made.',
  leaderTag: 'Leader',
  noLogin: 'Profile you made, no login yet',
  hasLogin: 'Has their own login',
  teamLoading: 'Loading the team list.',
  teamFailed: 'The team list did not load. Check your connection, then tap Try again.',
  teamEmpty: 'Nobody is on this page\u2019s team list yet. Search for them below, or pick Someone new.',
  severalLeaders: 'This page has more than one Leader, so nobody is picked for you. Tap the one you mean.',
  searchLabel: 'Someone else',
  searchHint: 'Type at least two letters of their name.',
  someoneNew: 'Someone new, not on Bachata Calendar yet',
  someoneNewHint: 'A link with no profile. They make their profile when they join.',
  hasAccount: 'They already have an account',
  hasAccountHint: 'Add them now by the email they sign in with.',
  next: 'Next',
  emailLabel: 'Their email',
  emailHelp: (first: string | null) =>
    `We save it on ${first ? `${first}\u2019s` : 'their'} profile. When they sign in with it, the profile becomes theirs.`,
  hasLoginNote: (first: string | null) =>
    `${first ?? 'This person'} already has their own login. Use the email they sign in with, or the server will stop and say why.`,
  create: 'Create invite link',
  creating: 'Creating link',
  pickAgain: 'Pick someone else',
  // The expiry is the server's to state: its message below says how long the link works.
  ready: (name: string) => `Invite link ready for ${name}.`,
} as const;

/** The Leader pre-selection: exactly one Leader on the team list; none or several picks nobody. */
export function defaultPick<T extends { isLeader: boolean }>(team: readonly T[] | undefined): T | null {
  const leaders = (team ?? []).filter((p) => p.isLeader);
  return leaders.length === 1 ? leaders[0] : null;
}

/** Why "Next" is off on "Who is this for?", or null. Always shown beside the button. */
export const whoBlockedReason = (pick: WhoPick | null): string | null => (pick ? null : 'Pick the person this invite is for, or Someone new.');

/** A refusal that gets its own screen: what happened, why it may have happened, what to do next. */
export interface RefusalScreen {
  code: string;
  title: string;
  body: string;
  reasons: string[];
  next: string;
}

export interface RefusalContext {
  firstName: string | null;
  hasLogin: boolean | undefined;
  /** A2 (the old-login email switch) is applied on the server. */
  shadowSwitchLive: boolean;
}

const NOTHING_SENT = 'We stopped before making a link, so nothing was sent and nothing changed.';

/**
 * email_in_use and the shadow-login refusal (PLAN.md section 2b: 4 profiles you made come with an old,
 * never-used login holding another email). Never a dead end: each says what to do next.
 * Any other refusal stays a one-line message (INVITE_PERSON_COPY).
 */
export function refusalScreen(error: unknown, ctx: RefusalContext): RefusalScreen | null {
  const text = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  const who = ctx.firstName ?? 'this person';
  const Who = ctx.firstName ?? 'This person';
  if (/(^|[^a-z_])login_has_signed_in($|[^a-z_])/.test(text)) {
    return {
      code: 'login_has_signed_in',
      title: `${Who}\u2019s profile already has a login someone uses`,
      body: `${NOTHING_SENT} Its login has been signed into before, so we never switch it to another email.`,
      reasons: [`${Who} can sign in with the email that login already has, and the profile is theirs.`],
      next: 'Ask them which email they sign in with, then invite that email.',
    };
  }
  if (!/(^|[^a-z_])email_in_use($|[^a-z_])/.test(text)) return null;
  const reasons = [
    'The email may already belong to another person\u2019s login or profile.',
    ctx.hasLogin
      ? `${Who} already has their own login with a different email. Use the email they sign in with.`
      : `${Who}\u2019s profile may already have a login with a different email.`,
  ];
  if (!ctx.shadowSwitchLive && !ctx.hasLogin) {
    reasons.push(
      `If that login is an old one nobody has ever used, switching it to this email is available soon: it needs a server update that is not applied yet. Until then, ask Ricky to check ${who}\u2019s profile.`,
    );
  }
  return { code: 'email_in_use', title: 'This email cannot be used for this invite', body: NOTHING_SENT, reasons, next: 'Check the email with them and try again, or pick someone else.' };
}
