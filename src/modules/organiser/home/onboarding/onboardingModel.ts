// Pure, client-free helpers for the onboarding screens (W1).
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { londonYear } from '@/modules/organiser/shared/teamModel';

/**
 * Light client-side checks; the server (invalid_instagram / invalid_website)
 * stays the authority. Same rules as the old onboarding, which exports them
 * from a component file this module must not import (W5 deletes it).
 */
export function instagramProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?/i.test(v) ? null : 'Enter an Instagram handle or a full https:// link.';
  return /^@?[A-Za-z0-9._]{1,30}$/.test(v) ? null : 'Enter an Instagram handle or a full https:// link.';
}

export function websiteProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.') ? null : 'Enter a full website address starting with https://.';
  } catch {
    return 'Enter a full website address starting with https://.';
  }
}

/**
 * R3-5 / D63, verbatim: a page with no email on file has no claim step; the row
 * leads straight to Ask to join.
 */
export const NO_EMAIL_COPY = 'This page has no email on file yet. Ask to join and Ricky approves it, usually the same day.';

/** What a search result row says about the organiser (D28: words, not sentences, except D63's line). */
export const HINT_TEXT: Record<ClaimHint, string> = {
  yours: 'Yours',
  managed: 'Has a team',
  email_matches: 'Email on file is yours',
  // Names only that an email exists, never the address (the client never reads it).
  email_differs: 'Has an email on file',
  no_email: NO_EMAIL_COPY,
};

/** When the hint call failed: say nothing false. */
export const NO_HINT_TEXT = 'Ask to join';

/** The one action a row offers: claim only when it can succeed; Home for your own; otherwise ask to join. */
export type RowAction = 'home' | 'claim' | 'request' | 'requested';

export function rowAction(hint: ClaimHint | null, requested: boolean): RowAction {
  if (hint === 'yours') return 'home';
  if (requested) return 'requested';
  return hint === 'email_matches' ? 'claim' : 'request';
}

/** The code length differs by project (prod uses 8, the default is 6), so accept 6 to 10 digits. */
export const EMAIL_CODE_PATTERN = /^\d{6,10}$/;
export const EMAIL_CODE_MAX_LENGTH = 10;
/** Seconds before another code can be sent; the mail provider rate-limits sends. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** "6 Oct" from an ISO timestamp, London time; "6 Oct 2025" when not this year. */
export const askedOn = (iso: string, now: Date = new Date()) => {
  const d = new Date(iso);
  const year = londonYear(d) === londonYear(now) ? '' : ` ${londonYear(d)}`;
  return `${d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })}${year}`;
};
