import type { LinkReadResult, ParsedLinkEvent } from './smartImportClient';
import type { NewEventFormat } from '@/modules/organiser/shell/paths';

/**
 * ONE mapping from state to words and controls for "Paste a link". The panel
 * renders only what this returns, so no sentence can point at a control the
 * panel does not show, and every disabled control carries its reason.
 */

export const LINK_LABEL = 'Paste the event link (Facebook, Eventbrite, your own site)';
export const READ_LABEL = 'Read it';
export const CHECK_NOTE = 'Check this before saving';
export const PAST_DATE_NOTE = 'This date has passed, please set the date';
export const EMPTY_REASON = 'Paste a link first.';
export const READING_REASON = 'Reading the link.';
export const CANCEL_LABEL = 'Cancel';
export const BY_HAND_LABEL = 'Add by hand';
export const USE_LABEL = 'Use this to start';
export const SIGN_IN_LABEL = 'Sign in again';
const COULD_NOT = 'We could not read that link. You can add the event by hand';
const MAX_DESCRIPTION = 600;

export type FailReason = 'unreadable' | 'empty' | 'non_https' | 'signed_out' | 'daily_limit' | 'network' | 'timeout';

export type LinkCheck = { ok: true; link: string } | { ok: false; reason: 'empty' | 'non_https' };

/** Only a well-formed https link is ever sent. */
export function checkLink(input: string): LinkCheck {
  const link = input.trim();
  if (!link) return { ok: false, reason: 'empty' };
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:' || !u.hostname.includes('.')) return { ok: false, reason: 'non_https' };
  } catch {
    return { ok: false, reason: 'non_https' };
  }
  return { ok: true, link };
}

/** The Read it button: off with a reason when empty or reading. */
export function readButton(input: string, reading: boolean): { disabled: boolean; reason: string | null } {
  if (reading) return { disabled: true, reason: READING_REASON };
  if (!input.trim()) return { disabled: true, reason: EMPTY_REASON };
  return { disabled: false, reason: null };
}

export interface FailureView {
  message: string;
  /** Add by hand is on EVERY failure: it opens the normal empty start. */
  byHand: true;
  signIn: boolean;
}

export function failureView(reason: FailReason): FailureView {
  switch (reason) {
    case 'daily_limit':
      return { message: "You have used today's link reads; add this one by hand or try tomorrow", byHand: true, signIn: false };
    case 'signed_out':
      return { message: `Your sign-in has ended, so ${COULD_NOT.charAt(0).toLowerCase()}${COULD_NOT.slice(1)}. You can sign in again.`, byHand: true, signIn: true };
    case 'non_https':
      return { message: `That link does not start with https. ${COULD_NOT}.`, byHand: true, signIn: false };
    default:
      return { message: `${COULD_NOT}.`, byHand: true, signIn: false };
  }
}

/** Server code (or client code) -> the reason the person sees. `aborted` is the person's own cancel: no failure. */
export function reasonFor(code: string): FailReason | 'aborted' {
  switch (code) {
    case 'aborted': return 'aborted';
    case 'unauthenticated': return 'signed_out';
    case 'daily_limit': return 'daily_limit';
    case 'invalid_event_link': return 'non_https';
    case 'no_fields_extracted': return 'empty';
    case 'timeout': return 'timeout';
    case 'network': return 'network';
    default: return 'unreadable';
  }
}

export interface LinkDraft {
  title: string;
  /** Future dates only, YYYY-MM-DD. A past date is never copied. */
  dates: string[];
  /** A date was read but it has passed: show it blank with PAST_DATE_NOTE. */
  datePassed: boolean;
  venue: string;
  /** https only, else ''. */
  ticketUrl: string;
  description: string;
  format: NewEventFormat;
  /** What was missing, for the plain "not found" lines. */
  missing: Array<'title' | 'date' | 'venue' | 'ticket' | 'description'>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function httpsOnly(v: unknown): string {
  const s = text(v, 1000);
  try {
    return new URL(s).protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

/** Untrusted parsed event -> draft. Text only; nothing here is ever HTML. `today` is the London day. */
export function buildDraft(parsed: ParsedLinkEvent, today: string): LinkDraft {
  const read = [parsed.date_iso, ...(parsed.recurrence?.custom_dates_iso ?? [])]
    .filter((d): d is string => typeof d === 'string' && DATE_RE.test(d));
  const unique = Array.from(new Set(read)).sort();
  const dates = unique.filter((d) => d >= today).slice(0, 60);
  const draft: LinkDraft = {
    title: text(parsed.title, 120),
    dates,
    datePassed: unique.length > 0 && dates.length === 0,
    venue: text(parsed.venue_name, 120),
    ticketUrl: httpsOnly(parsed.ticket_url),
    description: text(parsed.description, MAX_DESCRIPTION),
    format: parsed.format === 'one_off' ? 'one_off' : 'recurring',
    missing: [],
  };
  if (!draft.title) draft.missing.push('title');
  if (!dates.length && !draft.datePassed) draft.missing.push('date');
  if (!draft.venue) draft.missing.push('venue');
  if (!draft.ticketUrl) draft.missing.push('ticket');
  if (!draft.description) draft.missing.push('description');
  return draft;
}

/** Nothing usable at all: no title and no date (a passed date still counts as read). */
export const isEmptyDraft = (d: LinkDraft): boolean => !d.title && !d.dates.length && !d.datePassed;

export type Outcome = { kind: 'draft'; draft: LinkDraft } | { kind: 'failed'; reason: FailReason } | { kind: 'cancelled' };

/** One read result -> what the panel does next. */
export function outcomeOf(result: LinkReadResult, today: string): Outcome {
  if ('error' in result) {
    const r = reasonFor(result.error);
    return r === 'aborted' ? { kind: 'cancelled' } : { kind: 'failed', reason: r };
  }
  const draft = buildDraft(result.parsed, today);
  return isEmptyDraft(draft) ? { kind: 'failed', reason: 'empty' } : { kind: 'draft', draft };
}
