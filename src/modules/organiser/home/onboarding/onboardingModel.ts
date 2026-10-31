// Pure, client-free helpers for the onboarding screens (W1).
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { instantDateLabel } from '@/modules/organiser/shared/teamModel';
import { claimPrimary } from './claimStates';

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

// The row's words about a page (hintRowText) live with the claim screens in claimStates.ts: one map.

/** The one action a row offers: claim only when it can succeed; Home for your own; otherwise ask to join. */
export type RowAction = 'home' | 'claim' | 'request' | 'requested';

export function rowAction(hint: ClaimHint | null, requested: boolean): RowAction {
  const primary = claimPrimary(hint);
  if (primary === 'home') return 'home';
  return requested ? 'requested' : primary;
}

/** The code length differs by project (prod uses 8, the default is 6), so accept 6 to 10 digits. */
export const EMAIL_CODE_PATTERN = /^\d{6,10}$/;
export const EMAIL_CODE_MAX_LENGTH = 10;
/** Seconds before another code can be sent; the mail provider rate-limits sends. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** "Tuesday 6 October" from an ISO timestamp, London time, with the year when not this year (the shared formatter). */
export const askedOn = (iso: string, now: Date = new Date()) => instantDateLabel(iso, now) ?? '';

/**
 * The already-asked state (owner 2026-10-30), one wording for P3's Find row, its claim sheet and
 * Welcome's waiting row: a fact in normal text, never an error, and the Ask button is gone. No
 * date (the server said request_already_open before the list caught up): the same line without it.
 */
export const waitingRowText = (iso: string, now: Date = new Date()) => {
  const on = askedOn(iso, now);
  return on ? `Waiting for an answer, asked ${on}` : 'Waiting for an answer';
};
/** A declined request on P3 Welcome (F-46): the fact, then what the person can do. Names only controls on that screen. */
export const declinedLine = (iso: string | null, name: string | null, now: Date = new Date()) => {
  const on = iso ? askedOn(iso, now) : '';
  return `${name ?? 'An organiser'} said no${on ? ` on ${on}` : ''}.`;
};
export const DECLINED_NEXT = 'You can ask again with a note, or create a page of your own. Both start from Find your page.';
export const askedLine = (iso: string | null, now: Date = new Date()) => {
  const on = iso ? askedOn(iso, now) : '';
  return on ? `You asked on ${on}. We will get back to you.` : 'You already asked to join this page. We will get back to you.';
};
