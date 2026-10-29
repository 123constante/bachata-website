/*
 * The door scanner's ONE mapping (layout C, docs/design/qr-door-scanning/C.html): every answer
 * a scan can get, its band colour, words, vibration and next action, in one table. The screen,
 * the tests and the design record all read this table; nothing else spells these words.
 *
 * Data facts (prod, read-only, 2026-10-29): one `tickets` row per person, each with its own
 * qr_token (64 lowercase hex, encode(gen_random_bytes(32), 'hex')); `quantity` is the ORDER's
 * size, so a good scan lets ONE person in and says how many the order holds.
 * The ticket email (admin ticket-email) prints the bare token as text, one line per ticket.
 */

/** What ticket_check_in_v1 answers, plus no_signal (the read itself failed, client side). */
export type DoorResult = 'ok' | 'already_in' | 'wrong_event' | 'not_valid' | 'unknown_code' | 'not_allowed' | 'no_signal';
export const DOOR_RESULTS: readonly DoorResult[] = ['ok', 'already_in', 'wrong_event', 'not_valid', 'unknown_code', 'not_allowed', 'no_signal'];

/** ticket_check_in_v1's reply: every key always present, null when it does not apply. */
export interface CheckIn {
  result: Exclude<DoorResult, 'no_signal'>;
  ticket_type_name: string | null;
  first_name: string | null;
  quantity: number | null;
  checked_in_at: string | null;
  checked_in_by_first_name: string | null;
  in_count: number | null;
  total_count: number | null;
}

export type Band = 'ok' | 'warn' | 'bad' | 'grey';
/** scan = Scan next; type = Type code (focus the code box); list = open tonight's list; none = nothing to do here. */
export type NextAction = 'scan' | 'type' | 'list' | 'none';

export interface ResultRow {
  band: Band;
  headline: string;
  /** The band's second line. */
  sub: (c: CheckIn | null) => string;
  /** The "what to do" line under the person. */
  detail: (c: CheckIn | null) => string;
  /** navigator.vibrate pattern; [] = none. */
  vibrate: number[];
  actions: NextAction[];
  /** Keep the camera reading while this answer shows. */
  keepScanning: boolean;
}

const N = '\u2014';
const DOT = '\u00b7';
const RSQ = '\u2019';

export const ticketsWord = (n: number) => `${n} ticket${n === 1 ? '' : 's'}`;

/** "21:42" in London; "21:42 on 27 Oct" when it was not today in London. */
export function londonClock(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = { timeZone: 'Europe/London' } as const;
  const time = new Intl.DateTimeFormat('en-GB', { ...tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const day = (x: Date) => new Intl.DateTimeFormat('en-GB', { ...tz, day: 'numeric', month: 'short' }).format(x);
  return day(d) === day(now) ? time : `${time} on ${day(d)}`;
}

const scannedLine = (c: CheckIn | null) => {
  const at = londonClock(c?.checked_in_at ?? null);
  const by = c?.checked_in_by_first_name?.trim();
  if (!at) return 'Scanned earlier';
  return `Scanned at ${at}${by ? ` by ${by}` : ''}`;
};

export const RESULT_TABLE: Record<DoorResult, ResultRow> = {
  ok: {
    band: 'ok', headline: 'LET IN',
    sub: (c) => (c?.quantity && c.quantity > 1 ? `1 person ${DOT} ticket 1 of an order of ${c.quantity}` : `1 person ${N} enjoy the night`),
    detail: (c) => (c?.quantity && c.quantity > 1
      ? `Let 1 person in. The other ${ticketsWord(c.quantity - 1)} in this order each have their own code.`
      : 'Let them in. Then scan the next code.'),
    vibrate: [80], actions: ['scan'], keepScanning: true,
  },
  already_in: {
    band: 'warn', headline: 'ALREADY IN',
    sub: scannedLine,
    detail: () => 'Do not let in again. Ask if someone else used this ticket; if unsure, call the organiser.',
    vibrate: [200, 100, 200], actions: ['scan'], keepScanning: true,
  },
  wrong_event: {
    band: 'bad', headline: 'NOT FOR THIS EVENT',
    sub: () => 'This ticket is for a different event',
    detail: () => 'Do not let in. Tell them the ticket is for another event.',
    vibrate: [400], actions: ['scan'], keepScanning: true,
  },
  not_valid: {
    band: 'bad', headline: 'NOT VALID',
    sub: () => 'This ticket was refunded or cancelled',
    detail: () => 'Do not let in. They can buy a new ticket if you sell on the door.',
    vibrate: [400], actions: ['scan'], keepScanning: true,
  },
  unknown_code: {
    band: 'bad', headline: 'CODE NOT RECOGNISED',
    sub: () => 'No ticket matches this code',
    detail: () => `Type the code from their ticket email, or find their name on tonight${RSQ}s list.`,
    vibrate: [400], actions: ['type', 'scan'], keepScanning: true,
  },
  not_allowed: {
    band: 'grey', headline: 'CANNOT CHECK TICKETS',
    sub: () => `You${RSQ}re not on this event${RSQ}s team`,
    detail: () => `Ask the event${RSQ}s organiser to add you to their team, then open this screen again.`,
    vibrate: [], actions: ['none'], keepScanning: false,
  },
  no_signal: {
    band: 'grey', headline: 'NO SIGNAL',
    sub: () => 'Cannot check this code right now',
    detail: () => `Find their name on tonight${RSQ}s list (as last loaded on this phone). Scan again when signal is back.`,
    vibrate: [], actions: ['list'], keepScanning: true,
  },
};

export const ACTION_LABEL: Record<NextAction, string> = {
  scan: 'Scan next', type: 'Type code', list: `Open tonight${RSQ}s list`, none: '',
};

/** The person line under the band: first name, then type and order size. Nothing for unknown / not allowed / no signal. */
export function personOf(c: CheckIn | null): { name: string; meta: string } | null {
  if (!c || c.result === 'unknown_code' || c.result === 'not_allowed') return null;
  const bits = [c.ticket_type_name?.trim(), c.quantity ? `order of ${c.quantity}` : null].filter(Boolean);
  return { name: c.first_name?.trim() || 'No name given', meta: bits.join(` ${DOT} `) };
}

/** "37 of 120 in"; null when the counts are unknown. */
export function counterText(inCount: number | null | undefined, total: number | null | undefined): string | null {
  if (inCount == null || total == null) return null;
  return `${inCount} of ${total} in`;
}

/**
 * The ticket code inside whatever the camera or the code box gave: a bare token, or a URL whose
 * `t` / `token` param or last path segment is the token. Spaces are dropped (a code typed in
 * groups) and a hex code is lower-cased (tokens are lowercase hex). Null when nothing is left.
 */
export function parseCode(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const q = u.searchParams.get('t') ?? u.searchParams.get('token');
      s = q ?? decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
    } catch {
      return null;
    }
  }
  s = s.replace(/\s+/g, '');
  if (!s) return null;
  return /^[0-9a-f]+$/i.test(s) ? s.toLowerCase() : s;
}

/** The same code inside `windowMs` does not fire again (a QR held in front of the camera). */
export function createScanGate(windowMs = 2500, now: () => number = Date.now) {
  let last: { code: string; at: number } | null = null;
  return {
    accept(code: string): boolean {
      const t = now();
      if (last && last.code === code && t - last.at < windowMs) return false;
      last = { code, at: t };
      return true;
    },
    reset() { last = null; },
  };
}

/** The code box's Check button: disabled with a reason, never silently dead. */
export function codeBoxBlock(text: string, busy: boolean): string | null {
  if (busy) return 'Checking the last code\u2026';
  if (!parseCode(text)) return 'Type or paste the code first';
  return null;
}

export type CameraState = 'starting' | 'on' | 'denied' | 'none' | 'failed' | 'off';

/** What the camera box says when there is no picture. */
export const CAMERA_WORDS: Record<Exclude<CameraState, 'on'>, string> = {
  starting: 'Starting the camera\u2026',
  denied: `Camera blocked. Allow the camera for this site in your browser settings, or type the code or use tonight${RSQ}s list.`,
  none: `No camera found on this phone. Type the code, or use tonight${RSQ}s list.`,
  failed: `The camera did not start. Type the code, or use tonight${RSQ}s list.`,
  off: 'Camera paused.',
};

/** A camera that will not come back without the person changing something: open the list for them. */
export const cameraDead = (s: CameraState) => s === 'denied' || s === 'none' || s === 'failed';
