// Pure, client-free helpers for the onboarding screens (W1).
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';

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

/** What a search result row says about the organiser. */
export const HINT_TEXT: Record<ClaimHint, string> = {
  yours: 'You already manage this',
  managed: 'Run by someone else. Ask to join and the team replies within a day.',
  email_matches: 'Its contact email is yours, so you can claim it now.',
  email_differs: 'Listed with a different email. Ask to join and the team replies within a day.',
  no_email: 'No contact email listed. Ask to join and the team replies within a day.',
};

/** The one action a row offers: claim only when it can succeed; otherwise ask to join. */
export type RowAction = 'none' | 'claim' | 'request' | 'requested';

export function rowAction(hint: ClaimHint, requested: boolean): RowAction {
  if (hint === 'yours') return 'none';
  if (requested) return 'requested';
  return hint === 'email_matches' ? 'claim' : 'request';
}

/** The code length differs by project (prod uses 8, the default is 6), so accept 6 to 10 digits. */
export const EMAIL_CODE_PATTERN = /^\d{6,10}$/;
export const EMAIL_CODE_MAX_LENGTH = 10;
/** Seconds before another code can be sent; the mail provider rate-limits sends. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** "6 Oct" from an ISO timestamp, London time. */
export const askedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
