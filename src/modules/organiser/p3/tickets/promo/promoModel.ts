import { formatPence, isoToLondonInput, londonInputToIso, penceOf } from '../../../tickets/ticketModel';
import { SESSION_ENDED } from '../../../shared/selfServeErrors';
import type { StatusTone } from '../../../ui/StatusTag';

/**
 * Promo codes for one event (ticket_promo_list_v1 / create_v1 / update_v1, admin PR #1125).
 * The ONE mapping every promo screen reads: state tag, discount words, uses, end date, the
 * locked reason, the server's refusals in plain words, and the patch builder (only the keys
 * that changed; an untouched save sends nothing). Who may change a code is the server's
 * answer (not_authorised); nothing here decides it.
 */

export type PromoKind = 'percent' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  kind: PromoKind;
  /** percent: 1..100; fixed: pence off each ticket, 1..100000. */
  value: number;
  /** null = no limit. Counts ORDERS. */
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string | null;
  paidOrders: number;
}

export type PromoState = 'on' | 'off' | 'expired' | 'used_up';

export const STATE_TAG: Record<PromoState, { label: string; tone: StatusTone }> = {
  on: { label: 'On', tone: 'live' },
  off: { label: 'Turned off', tone: 'neutral' },
  expired: { label: 'Ended', tone: 'draft' },
  used_up: { label: 'Used up', tone: 'draft' },
};

export function stateOf(c: PromoCode, now: Date): PromoState {
  if (!c.active) return 'off';
  if (c.expiresAt && Date.parse(c.expiresAt) <= now.getTime()) return 'expired';
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return 'used_up';
  return 'on';
}

/** What a buyer can no longer do with the code, and what the organiser can do about it. */
export const STATE_NEXT: Record<PromoState, string | null> = {
  on: null,
  off: 'Buyers cannot use this code. Turn it on to let them.',
  expired: 'Buyers cannot use this code any more. Tap it to give it a new end date.',
  used_up: 'This code has reached its limit. Tap it to raise the limit or remove it.',
};

export const discountWords = (kind: PromoKind, value: number): string =>
  kind === 'percent' ? `${value}% off each ticket` : `${formatPence(value)} off each ticket`;

const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;

export const usesLine = (c: Pick<PromoCode, 'usedCount' | 'maxUses'>): string =>
  c.maxUses === null ? `Used on ${orders(c.usedCount)}, no limit` : `Used on ${c.usedCount} of ${orders(c.maxUses)}`;

export const paidLine = (n: number): string => `${n} paid ${n === 1 ? 'order' : 'orders'}`;

const LONDON_LONG = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Friday 13 November, 23:59" in London time (full weekday names). */
export const londonLong = (iso: string): string => {
  const parts = Object.fromEntries(LONDON_LONG.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
};

export function expiryLine(c: Pick<PromoCode, 'expiresAt'>, now: Date): string {
  if (!c.expiresAt) return 'No end date';
  const when = londonLong(c.expiresAt);
  return Date.parse(c.expiresAt) <= now.getTime() ? `Ended ${when}` : `Ends ${when}`;
}

/**
 * The server locks kind and value once ANY order carries the code. The list cannot see an order
 * whose use was released (used_count leaves it out), so such a code looks open here; the server
 * then answers locked_after_use and the sheet shows LOCKED_WHY (INVENTORY G3).
 */
export const isLocked = (c: Pick<PromoCode, 'usedCount' | 'paidOrders'>): boolean => c.usedCount > 0 || c.paidOrders > 0;

export const LOCKED_WHY =
  'Someone has ordered with this code, so its discount cannot change. You can still change the limit and the end date, or turn it off and make a new code.';

/** The fixed-amount range, said one way everywhere. */
export const AMOUNT_RANGE = '\u00A30.01 to \u00A31,000';

export const LOCKED_SHORT = 'Discount locked: someone has ordered with this code.';

/** The app's one wording for an ended sign-in (selfServeErrors SESSION_ENDED, Arc 1 flow 9c). */
export const SIGNED_OUT = SESSION_ENDED;

/** A thrown rpc error that means "no signed-in person": Postgres 42501 or the not-signed-in wording. */
export function isSignedOutError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  const m = typeof message === 'string' ? message.trim() : '';
  return code === '42501' || /^(permission_denied: )?authentication_required/.test(m) || /not signed in/i.test(m);
}

/** What a thrown error says: sign in again when signed out, otherwise the connection line. */
export const thrownCopy = (e: unknown): string => (isSignedOutError(e) ? SIGNED_OUT : NETWORK);

export const NETWORK = 'We could not reach the server. Check your connection, then try again.';

/** The server's refusals in plain words, each with what the person can do next. */
export const REASON_COPY: Record<string, string> = {
  not_authorised: 'Only an owner or manager of this page can make or change promo codes. Ask one of them to do it for you.',
  series_not_organisers: 'This event is no longer run by this page, so it cannot have its codes. Refresh the page to see who runs it now.',
  invalid_code: 'Use 3 to 32 letters, numbers, dashes or underscores, with no spaces.',
  invalid_value: `Pick a discount from 1% to 100%, or an amount from ${AMOUNT_RANGE}.`,
  invalid_max_uses: 'The limit must be at least 1, and not below the orders already made with this code. Leave it empty for no limit.',
  invalid_expiry: 'Pick an end date in the future, or leave it empty for no end date.',
  code_taken: 'This event already has a code that is on with that name. Pick another name, or turn the other one off first.',
  locked_after_use: LOCKED_WHY,
  invalid_request: 'That change was not accepted. Close this, refresh the page and try again.',
};

export const reasonCopy = (reason: string | null | undefined): string => (reason && REASON_COPY[reason]) || NETWORK;

export const GATE_PROMO = 'Finish your details first, then you can make or change promo codes.';
export const STILL_SAVING = 'Still saving your last change\u2026 Wait a moment, then try again.';

/** The toast after the switch: turning on a code buyers still cannot use says so, and why. */
export function switchedText(c: PromoCode, now: Date): string {
  if (c.active) return `${c.code} turned off. Buyers cannot use it now.`;
  const next = stateOf({ ...c, active: true }, now);
  return next === 'on' ? `${c.code} is on again.` : `${c.code} is on, but buyers still cannot use it. ${STATE_NEXT[next]}`;
}

// ---- the form ---------------------------------------------------------------

export interface PromoForm {
  code: string;
  kind: PromoKind;
  /** percent: whole number; fixed: pounds as typed ("2.50"). */
  amount: string;
  /** empty = no limit */
  maxUses: string;
  /** datetime-local, London time; empty = no end date */
  endsAt: string;
}

export type PromoErrors = Partial<Record<keyof PromoForm, string>>;

export const CODE_RE = /^[A-Z0-9_-]{3,32}$/;
export const normaliseCode = (s: string): string => s.trim().toUpperCase();

export const formOf = (c: PromoCode | null): PromoForm =>
  c
    ? {
        code: c.code,
        kind: c.kind,
        amount: c.kind === 'percent' ? String(c.value) : (c.value / 100).toFixed(2),
        maxUses: c.maxUses === null ? '' : String(c.maxUses),
        endsAt: isoToLondonInput(c.expiresAt),
      }
    : { code: '', kind: 'percent', amount: '', maxUses: '', endsAt: '' };

const wholeOf = (s: string): number | null => (/^\s*\d+\s*$/.test(s) ? Number(s) : null);

/** The value the server stores: percent as a whole number, fixed as pence. */
export const valueOf = (f: Pick<PromoForm, 'kind' | 'amount'>): number | null => (f.kind === 'percent' ? wholeOf(f.amount) : penceOf(f.amount));

/**
 * The same rules as the server, said before the tap (the server still decides). On an edit, a
 * field left as it was is never an error: an ended code or a limit a late payment passed can
 * still be saved for its other changes (the server checks expiry and limit only when sent).
 */
export function validate(f: PromoForm, original: PromoCode | null, now: Date): PromoErrors {
  const e: PromoErrors = {};
  const was = original ? formOf(original) : null;
  if (!original && !CODE_RE.test(normaliseCode(f.code))) e.code = REASON_COPY.invalid_code;
  const v = valueOf(f);
  if (f.kind === 'percent' && (v === null || v < 1 || v > 100)) e.amount = 'Type a whole number from 1 to 100.';
  if (f.kind === 'fixed' && (v === null || v < 1 || v > 100000)) e.amount = `Type an amount from ${AMOUNT_RANGE}.`;
  const minUses = Math.max(1, original?.usedCount ?? 0);
  if (f.maxUses.trim() !== '' && f.maxUses !== was?.maxUses) {
    const m = wholeOf(f.maxUses);
    if (m === null || m < minUses)
      e.maxUses = minUses > 1 ? `Type ${minUses} or more (orders already made with it), or leave it empty for no limit.` : 'Type a whole number of 1 or more, or leave it empty for no limit.';
  }
  if (f.endsAt && f.endsAt !== was?.endsAt) {
    const iso = londonInputToIso(f.endsAt);
    if (!iso) e.endsAt = 'Pick a date and time.';
    else if (Date.parse(iso) <= now.getTime()) e.endsAt = 'Pick a time in the future, or leave it empty for no end date.';
  }
  return e;
}

export interface CreateArgs {
  code: string;
  kind: PromoKind;
  value: number;
  maxUses: number | null;
  expiresAt: string | null;
}

export const createArgsOf = (f: PromoForm): CreateArgs => ({
  code: normaliseCode(f.code),
  kind: f.kind,
  value: valueOf(f) as number,
  maxUses: f.maxUses.trim() === '' ? null : Number(f.maxUses),
  expiresAt: f.endsAt ? londonInputToIso(f.endsAt) : null,
});

export type PromoPatch = Partial<{ active: boolean; expires_at: string | null; max_uses: number | null; kind: PromoKind; value: number }>;

/** Only the keys that changed. {} = nothing to send. A locked code never sends kind or value. */
export function patchOf(c: PromoCode, f: PromoForm, locked: boolean = isLocked(c)): PromoPatch {
  const p: PromoPatch = {};
  const next = createArgsOf({ ...f, code: c.code });
  // Compared as the form shows it (minutes, London): a stored time with seconds is not a change.
  if (f.endsAt !== formOf(c).endsAt) p.expires_at = next.expiresAt;
  if (c.maxUses !== next.maxUses) p.max_uses = next.maxUses;
  if (!locked) {
    if (c.kind !== next.kind) p.kind = next.kind;
    if (c.value !== next.value || c.kind !== next.kind) p.value = next.value;
  }
  return p;
}

export const isEmptyPatch = (p: PromoPatch): boolean => Object.keys(p).length === 0;

export const SWITCH_WORDS = { on: 'On', off: 'Off' } as const;
