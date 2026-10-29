import { londonDateKey, londonDaysBetweenKeys, parseUtcIso, weekdayOfKey } from '@/lib/londonDate';

/** One row of the ambassador pending queue. Deliberately has NO email field:
 *  `parseQueueRow` drops `submitter_email` at the boundary, so nothing downstream can render it. */
export type TargetType = 'organiser' | 'series';

export interface QueueItem {
  key: string;
  targetType: TargetType;
  targetId: string;
  name: string;
  cityId: string;
  cityName: string;
  /** The RPC's `submitted_at` is really `updated_at`: it means "last changed". */
  changedAt: string | null;
  organiserNames: string[];
  nextDates: string[];
  futureCount: number;
  venueName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Upper-case ISO code; null when the series mixes currencies (or has no priced pass). */
  priceCurrency: string | null;
  hasFlyer: boolean;
  publicSlug: string | null;
}

export const PAGE_SIZE = 100;
/** The list RPC pages NEWEST first, so every page is loaded before the list shows (the oldest are on the last page).
 *  Stop here per city: past it the oldest are not loaded, and `capText` says so. */
export const MAX_ROWS_PER_CITY = 1000;
/** A decision on an item the ambassador is party to is refused with this code. */
export const SELF_APPROVAL_CODE = 'self_approval_not_allowed';
export const MIN_REASON_LENGTH = 10;

export const itemKey = (type: string, id: string) => `${type}:${id}`;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []);

export function parseQueueRow(raw: unknown): QueueItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.target_type === 'organiser' || r.target_type === 'series' ? r.target_type : null;
  const id = str(r.target_id);
  if (!type || !id) return null;
  return {
    key: itemKey(type, id),
    targetType: type,
    targetId: id,
    name: str(r.name) ?? (type === 'series' ? 'Unnamed series' : 'Unnamed organiser'),
    cityId: str(r.city_id) ?? '',
    cityName: str(r.city_name) ?? '',
    changedAt: str(r.submitted_at),
    organiserNames: strList(r.organiser_names),
    nextDates: strList(r.next_occurrence_dates).slice(0, 3),
    futureCount: num(r.future_occurrence_count) ?? 0,
    venueName: str(r.venue_name),
    priceMin: num(r.price_min),
    priceMax: num(r.price_max),
    priceCurrency: str(r.price_currency)?.trim().toUpperCase() ?? null,
    hasFlyer: r.has_flyer === true,
    publicSlug: str(r.public_slug),
  };
}

export function parseQueueRows(raw: unknown): QueueItem[] {
  return Array.isArray(raw) ? raw.map(parseQueueRow).filter((x): x is QueueItem => x !== null) : [];
}

/** Oldest change first (the RPC returns newest first). Stable on ties. */
export function sortOldestFirst(items: readonly QueueItem[]): QueueItem[] {
  const t = (i: QueueItem) => parseUtcIso(i.changedAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  return items.map((it, n) => ({ it, n })).sort((a, b) => t(a.it) - t(b.it) || a.n - b.n).map((x) => x.it);
}

/** Whole London calendar days since the item last changed. Never negative. */
export function waitingDays(item: Pick<QueueItem, 'changedAt'>, now: Date = new Date()): number {
  const d = parseUtcIso(item.changedAt);
  if (!d) return 0;
  return Math.max(0, londonDaysBetweenKeys(londonDateKey(d), londonDateKey(now)));
}

export const OLD_AFTER_DAYS = 7;
export const isOld = (days: number) => days >= OLD_AFTER_DAYS;

/** "today", "1 day", "9 days": the ONE age phrase every screen uses. */
export const ageText = (days: number) => (days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`);
export const waitingChip = (days: number) => (days <= 0 ? 'Waiting since today' : `Waiting ${ageText(days)}`);
export const changedText = (days: number) => (days <= 0 ? 'Last changed today' : `Last changed ${ageText(days)} ago`);

export const typeLabel = (t: TargetType) => (t === 'series' ? 'Series' : 'Organiser');
export const typeNoun = (t: TargetType) => (t === 'series' ? 'series' : 'page');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Thursday 29 October" from a London calendar key; the raw text if it is not a key. */
export function dateLabel(key: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  const month = Number(key.slice(5, 7)) - 1;
  return `${WEEKDAYS[weekdayOfKey(key)]} ${Number(key.slice(8, 10))} ${MONTHS[month] ?? ''}`.trim();
}

const SYMBOLS: Record<string, string> = { GBP: '\u00a3', EUR: '\u20ac', USD: '$' };

/** The price in the series' own currency. A null currency (passes disagree, or none names one): amounts only, and it says so. */
export function priceText(i: Pick<QueueItem, 'priceMin' | 'priceMax' | 'priceCurrency'>): string {
  const { priceMin: lo, priceMax: hi, priceCurrency: cur } = i;
  if (lo == null && hi == null) return 'Price not given';
  const a = lo ?? hi ?? 0;
  const b = hi ?? lo ?? 0;
  if (a === 0 && b === 0) return 'Free';
  const amount = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const money = (n: number) => (cur ? (SYMBOLS[cur] ? `${SYMBOLS[cur]}${amount(n)}` : `${cur} ${amount(n)}`) : amount(n));
  const range = a === b ? money(a) : `${money(a)}\u2013${money(b)}`;
  return cur ? range : `${range} (currency not given)`;
}

/** Name shortened for a toast. */
export const shortName = (name: string) => (name.length > 34 ? `${name.slice(0, 34)}\u2026` : name);

export const leftText = (n: number) => (n === 0 ? 'None left.' : `${n} left.`);
export const decisionToast = (verb: 'Approved' | 'Rejected', name: string, left: number) => `${verb}: ${shortName(name)}. ${leftText(left)}`;

export interface ReasonCheck { ok: boolean; error: 'empty' | 'short' | null; length: number; message: string }
export function checkReason(text: string): ReasonCheck {
  const length = text.trim().length;
  if (length === 0) return { ok: false, error: 'empty', length, message: 'Say why, so the organiser knows what to fix.' };
  if (length < MIN_REASON_LENGTH) {
    return { ok: false, error: 'short', length, message: `Add a little more detail (${length} of ${MIN_REASON_LENGTH} characters so far).` };
  }
  return { ok: true, error: null, length, message: '' };
}

export type DecisionErrorKind = 'party' | 'gone' | 'access' | 'auth' | 'reason' | 'other';
/** For a non-admin `_moderate_entity` raises not_authorised BEFORE target_not_found, so an item the list served that was
 *  deleted or moved out of the person's cities comes back as "no access". The page shows this instead and takes it off. */
export const CHANGED_MESSAGE = 'This one has changed and is no longer yours to decide. It has been taken off your list.';
export interface DecisionError { kind: DecisionErrorKind; message: string }

function errorText(err: unknown): string {
  if (typeof err === 'string') return err.toLowerCase();
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; details?: unknown; status?: unknown };
    return [e.message, e.code, e.details, e.status === 401 ? '401' : null].filter((x) => typeof x === 'string').join(' ').toLowerCase();
  }
  return '';
}

/** `_moderate_entity` raises authentication_required; PostgREST answers an expired session with 401 / "JWT expired" (PGRST301/303). */
const SIGNED_OUT = /authentication_required|auth_required|jwt expired|pgrst30[13]|\b401\b/;
/** The list RPC raises admin_only, the decision RPCs not_authorized / not_authorised. */
const NO_ACCESS = /42501|forbidden|not_authori|admin_only|city_scope|not_in_scope/;
/** A missing table/function grant is a fault on our side, not a fact about the account: "did not go through", never "no access". */
const GRANT_FAILURE = /permission denied for (table|relation|view|schema|sequence|function)/;
const isNoAccess = (text: string) => NO_ACCESS.test(text) && !GRANT_FAILURE.test(text);

export const SIGNED_OUT_MESSAGE = 'You are signed out. Sign in again, then try again.';

/** Every error code the decision RPCs raise, as something a volunteer can read. Never the raw code. */
export function decisionError(err: unknown): DecisionError {
  const text = errorText(err);
  if (text.includes(SELF_APPROVAL_CODE)) {
    return { kind: 'party', message: 'You are part of this one, so an admin has to decide it.' };
  }
  if (SIGNED_OUT.test(text)) return { kind: 'auth', message: SIGNED_OUT_MESSAGE };
  if (/not_found|not_pending|already|invalid_state|not_in_review|wrong_state/.test(text)) {
    // The page takes a gone item off the list, the same as a decision that went through.
    return { kind: 'gone', message: 'This one is no longer waiting. Someone else may have decided it. It has been taken off your list.' };
  }
  if (/reason/.test(text)) {
    return { kind: 'reason', message: 'The reason was not accepted. Add a little more detail and try again.' };
  }
  if (isNoAccess(text)) {
    return { kind: 'access', message: 'You do not have access to decide this one. Ask an admin to check your city.' };
  }
  return { kind: 'other', message: 'That did not go through. Nothing was changed. Check your connection and try again.' };
}

/** Why the queue (or the city list) could not load: a refusal is "no access", never "check your connection". */
export function loadErrorKind(err: unknown): 'auth' | 'access' | 'other' {
  const text = errorText(err);
  if (SIGNED_OUT.test(text)) return 'auth';
  if (isNoAccess(text)) return 'access';
  return 'other';
}

/** Only when a city hit MAX_ROWS_PER_CITY: the list then holds that city's most recent rows, never its oldest. */
export function capText(cityNames: readonly string[]): string {
  const many = cityNames.length > 1;
  const where = many ? ` in each of ${cityNames.join(' and ')}` : cityNames.length ? ` in ${cityNames[0]}` : '';
  // "At least": a city that returned exactly the cap reads the same as one with more (no extra probe for it).
  return `At least ${MAX_ROWS_PER_CITY} are waiting${where}. Only the ${MAX_ROWS_PER_CITY} most recent${many ? ' in each' : ''} are here, so any older ones are not shown. Ask an admin to clear the rest.`;
}

/** The decision RPCs return Json; a soft refusal can arrive as data instead of an error. */
export function softRefusal(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { ok?: unknown; error?: unknown; code?: unknown };
  if (d.ok === false || typeof d.error === 'string') return String(d.error ?? d.code ?? 'refused');
  return null;
}

export const reviewPath = (i: Pick<QueueItem, 'targetType' | 'targetId'>) => `/ambassador/review/${i.targetType}/${encodeURIComponent(i.targetId)}`;

